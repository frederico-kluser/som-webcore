// The memory life cycle of RFC-0001 §3, Chrome's: one model per page and tier, shared by the
// sessions; destroy() releases a session; the last one, an idle time or pagehide unloads the model;
// a later decide() reloads it from the local cache.

import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { configure, createDecisionModelClass } from '../src/index.js';
import { resetConfig } from '../src/config.js';
import { fakeBackend } from './helpers/fake-backend.js';

const schema = { questions: [{ id: 'q', type: /** @type {const} */ ('boolean'), prompt: 'p' }] };
const tick = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));

afterEach(() => resetConfig());

test('one model for every session; the last destroy() unloads it', async () => {
  const backend = fakeBackend({ availability: 'available' });
  const DecisionModel = createDecisionModelClass(backend);
  const sessions = await Promise.all([1, 2, 3].map(() => DecisionModel.create(schema)));
  assert.equal(backend.stats.loads, 1, 'three create() calls, one load');
  await Promise.all(sessions.map((s) => s.decide('x')));
  sessions[0].destroy();
  sessions[0].destroy(); // idempotent
  sessions[1].destroy();
  await tick(0);
  assert.equal(backend.stats.unloads, 0, 'a session is still alive');
  sessions[2].destroy();
  await tick(0);
  assert.equal(backend.stats.unloads, 1);
  // A new session loads it again (from the local cache: the backend now reports "available").
  const again = await DecisionModel.create(schema);
  assert.equal(backend.stats.loads, 2);
  again.destroy();
});

test('the model leaves after the idle time and comes back on the next decide()', async () => {
  configure({ idleUnloadMs: 20 });
  const backend = fakeBackend({ availability: 'available' });
  const DecisionModel = createDecisionModelClass(backend);
  const model = await DecisionModel.create(schema);
  await model.decide('x');
  await tick(60);
  assert.equal(backend.stats.unloads, 1, 'idle unload');
  const result = await model.decide('x');
  assert.equal(backend.stats.loads, 2, 'reloaded for the next decision');
  assert.equal(result.q.label, 'false'); // fake scores: [1, 2] for ["true", "false"]
  model.destroy();
  await tick(0);
  assert.equal(backend.stats.unloads, 2);
});

test('destroy() during a decision: the decision rejects and the model waits for it before unloading', async () => {
  const backend = fakeBackend({ availability: 'available' });
  const DecisionModel = createDecisionModelClass(backend);
  const model = await DecisionModel.create(schema);
  const pending = model.decide('x');
  model.destroy();
  await assert.rejects(pending, { name: 'AbortError' });
  await tick(0);
  assert.equal(backend.stats.unloads, 1);
});

test('the schema is translated once, at create()', async () => {
  const backend = fakeBackend({ availability: 'available' });
  const DecisionModel = createDecisionModelClass(backend);
  const model = await DecisionModel.create({ questions: [...schema.questions, { id: 'u', type: 'score', prompt: 'p' }] });
  for (let i = 0; i < 5; i += 1) await model.decide(`x${i}`);
  assert.equal(backend.stats.compiles, 2);
  assert.equal(backend.stats.scores, 5);
  model.destroy();
});

test('create() needs activation while the model is downloadable, and reports the download', async () => {
  let active = false;
  const backend = fakeBackend({ availability: 'downloadable' });
  const DecisionModel = createDecisionModelClass(backend, { hasActivation: () => active });
  assert.equal(await DecisionModel.availability(schema), 'downloadable');
  await assert.rejects(DecisionModel.create(schema), { name: 'NotAllowedError' });
  assert.equal(backend.stats.loads, 0, 'nothing downloaded without a gesture');
  active = true;
  /** @type {number[]} */
  const seen = [];
  const model = await DecisionModel.create({ ...schema, monitor: (/** @type {any} */ m) => { m.ondownloadprogress = (/** @type {any} */ e) => seen.push(e.loaded); } });
  assert.deepEqual(seen, [0, 0.25, 0.5, 0.75, 1]);
  active = false;
  assert.equal(await DecisionModel.availability(schema), 'available');
  const second = await DecisionModel.create(schema); // available: no gesture needed
  model.destroy();
  second.destroy();
});

test('an aborted create() leaves nothing loaded', async () => {
  const backend = fakeBackend({ availability: 'available', loadDelayMs: 10 });
  const DecisionModel = createDecisionModelClass(backend);
  const controller = new AbortController();
  const pending = DecisionModel.create({ ...schema, signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  await tick(50);
  assert.equal(backend.stats.unloads, backend.stats.loads, 'the load that finished after the abort was undone');
});

test('an input above the model limit is a QuotaExceededError, never truncated', async () => {
  const backend = fakeBackend({ availability: 'available', quotaTokens: 10 });
  const DecisionModel = createDecisionModelClass(backend);
  const model = await DecisionModel.create(schema);
  await assert.rejects(model.decide('x'.repeat(11)), (error) => error instanceof DOMException && error.name === 'QuotaExceededError');
  assert.equal((await model.decide('short')).q.id, 'q');
  model.destroy();
});

test('preference reaches the backend and comes back on the attribute', async () => {
  /** @type {string[]} */
  const asked = [];
  const base = fakeBackend({ availability: 'available' });
  const backend = { ...base, select: (/** @type {any} */ request) => { asked.push(request.preference); return base.select(request); } };
  const DecisionModel = createDecisionModelClass(backend);
  const speed = await DecisionModel.create({ ...schema, preference: 'speed' });
  const auto = await DecisionModel.create(schema);
  assert.equal(speed.preference, 'speed');
  assert.equal(auto.preference, 'auto');
  assert.deepEqual(asked, ['speed', 'auto']);
  speed.destroy();
  auto.destroy();
});

test('configure() rejects unknown keys and bad values', () => {
  assert.throws(() => configure(/** @type {any} */ ({ idleUnloadMS: 1 })), TypeError);
  assert.throws(() => configure({ licenses: /** @type {any} */ (['gpl']) }), TypeError);
  assert.throws(() => configure({ downloadBudgetBytes: -1 }), RangeError);
  assert.deepEqual(configure({ licenses: ['permissive', 'custom'] }).licenses, ['permissive', 'custom']);
});
