// The library against Chrome's own answers: every case of the surface capture
// (bench/spike-mobile/surface.js) replayed on the library and compared with the native capture,
// with the same normalization as bench/spike-mobile/reference/compare_surface.py.
//   - before the download (Chrome Canary 160, fresh model): the library with a model that is not cached;
//   - after the download: the library with a cached model.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { createDecisionModelClass } from '../src/index.js';
import { fakeBackend } from './helpers/fake-backend.js';

const results = new URL('../../../bench/results/', import.meta.url);
const capture = (/** @type {string} */ name) => JSON.parse(readFileSync(new URL(name, results), 'utf8'));
const BEFORE = capture('2026-11-21-surface-macmini-chrome-canary-160.json');
const AFTER = capture('2026-11-21-surface-macmini-chrome-canary-160-apos-download.json');

const READY = new Set(['downloadable', 'available', 'downloading']);

/** surface.js `settle`, then compare_surface.py `norm`. @param {() => Promise<unknown>} fn */
async function outcome(fn) {
  try {
    const value = await fn();
    if (typeof value === 'string' && READY.has(value)) return ['ok', 'ready'];
    if (value instanceof Object && !Array.isArray(value)) return ['ok', 'object'];
    return ['ok', value];
  } catch (error) {
    const e = /** @type {Error} */ (error);
    return ['error', e?.name, String(e?.message ?? e)];
  }
}

/** compare_surface.py `norm` of a recorded outcome. @param {any} recorded */
function norm(recorded) {
  if (recorded.ok) {
    const v = recorded.value;
    if (READY.has(v)) return ['ok', 'ready'];
    if (typeof v === 'string' && v.startsWith('[object ')) return ['ok', 'object'];
    return ['ok', v];
  }
  return ['error', recorded.error?.name, recorded.error?.message];
}

/**
 * @param {any} native the capture
 * @param {typeof import('../types/index.js').DecisionModel} DecisionModel
 */
async function replay(native, DecisionModel) {
  let compared = 0;
  const diffs = [];
  for (const c of native.cases) {
    const args = c.schema === undefined || c.schema === null ? [] : [structuredClone(c.schema)];
    for (const op of /** @type {const} */ (['availability', 'create'])) {
      if (!c[op]) continue;
      compared += 1;
      const ours = await outcome(() => /** @type {any} */ (DecisionModel)[op](...args));
      const theirs = norm(c[op]);
      if (JSON.stringify(ours) !== JSON.stringify(theirs)) diffs.push(`${c.name} ${op}(): Chrome ${JSON.stringify(theirs)} · library ${JSON.stringify(ours)}`);
    }
  }
  return { compared, diffs };
}

/** surface.js `describeMembers`, reduced to what compare_surface.py compares. @param {object} target */
function members(target) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of Reflect.ownKeys(target)) {
    const d = /** @type {PropertyDescriptor} */ (Object.getOwnPropertyDescriptor(target, key));
    const name = typeof key === 'symbol' ? key.toString() : key;
    out[name] = [d.get || d.set ? 'accessor' : typeof d.value === 'function' ? 'method' : 'data', typeof d.value === 'function' ? d.value.length : undefined, !!d.get, d.enumerable];
  }
  return out;
}

/** @param {any} table */
const recordedMembers = (table) =>
  Object.fromEntries(Object.entries(table).map(([k, v]) => [k, [/** @type {any} */ (v).kind, /** @type {any} */ (v).length ?? undefined, /** @type {any} */ (v).getter, /** @type {any} */ (v).enumerable]]));

test('interface object and prototype match Chrome', async () => {
  const DecisionModel = createDecisionModelClass(fakeBackend());
  assert.deepEqual(members(DecisionModel), recordedMembers(BEFORE.static));
  assert.deepEqual(members(DecisionModel.prototype), recordedMembers(BEFORE.prototype));
  assert.equal(DecisionModel.length, BEFORE.interfaceLength);
  assert.equal(/** @type {any} */ (DecisionModel.prototype)[Symbol.toStringTag], BEFORE.toStringTag);
  assert.equal(Object.getPrototypeOf(DecisionModel.prototype), Object.prototype);
  assert.deepEqual(await outcome(async () => new /** @type {any} */ (DecisionModel)()), norm(BEFORE.construct));
});

test('the 72 validation outcomes match Chrome before the model download', async () => {
  const DecisionModel = createDecisionModelClass(fakeBackend({ availability: 'downloadable' }), { hasActivation: () => false });
  const { compared, diffs } = await replay(BEFORE, DecisionModel);
  assert.equal(compared, 72);
  assert.deepEqual(diffs, []);
});

test('the 72 validation outcomes match Chrome after the model download', async () => {
  const backend = fakeBackend({ availability: 'downloadable' });
  const DecisionModel = createDecisionModelClass(backend, { hasActivation: () => true });
  (await DecisionModel.create({ questions: [{ id: 'q', type: 'boolean', prompt: 'warm up' }] })).destroy(); // the download
  const { compared, diffs } = await replay(AFTER, DecisionModel);
  assert.equal(compared, 72);
  assert.deepEqual(diffs, []);
});

test('a session behaves like Chrome: create without activation, decide errors, destroy', async () => {
  const schema = AFTER.createWithoutActivation;
  // Before the download: create() without activation is refused, and the monitor callback was still called.
  {
    const DecisionModel = createDecisionModelClass(fakeBackend(), { hasActivation: () => false });
    /** @type {{ loaded: number, total: number }[] | undefined} */
    let events;
    const created = await outcome(() =>
      DecisionModel.create({
        questions: [{ id: 'q', type: 'boolean', prompt: 'p' }],
        monitor(m) {
          events = [];
          m.addEventListener('downloadprogress', (e) => events?.push({ loaded: /** @type {any} */ (e).loaded, total: /** @type {any} */ (e).total }));
        },
      }),
    );
    assert.deepEqual(created, norm(BEFORE.createWithoutActivation.create));
    assert.deepEqual(events, BEFORE.createWithoutActivation.monitorEvents);
  }
  // After the download: the whole session.
  const DecisionModel = createDecisionModelClass(fakeBackend({ availability: 'available' }), { hasActivation: () => false });
  /** @type {{ loaded: number, total: number }[]} */
  const events = [];
  const model = await DecisionModel.create({
    expectedInputs: [{ type: 'text', languages: ['en'] }],
    questions: [{ id: 'q', type: 'boolean', prompt: 'p' }],
    monitor(m) {
      m.addEventListener('downloadprogress', (e) => events.push({ loaded: /** @type {any} */ (e).loaded, total: /** @type {any} */ (e).total }));
    },
  });
  assert.equal(events[0].loaded, 0);
  assert.equal(events.at(-1)?.loaded, 1);
  assert.equal(model.preference, schema.preference);
  assert.deepEqual(await outcome(() => model.decide('   ')), norm(schema.decideEmpty));
  const controller = new AbortController();
  controller.abort();
  assert.deepEqual(await outcome(() => model.decide('text', { signal: controller.signal })), norm(schema.decideAborted));
  assert.deepEqual(await outcome(async () => model.destroy()), norm(schema.destroy));
  assert.deepEqual(await outcome(() => model.decide('text')), norm(schema.decideAfterDestroy));
});

test('a decision has the members, order and types of Chrome', async () => {
  const native = BEFORE.createWithActivation;
  const DecisionModel = createDecisionModelClass(fakeBackend({ availability: 'available' }));
  const model = await DecisionModel.create({
    questions: [
      { id: 'wants_refund', type: 'boolean', prompt: 'Does the customer ask for a refund?' },
      { id: 'topic', type: 'choice', prompt: 'What is the message about?', options: [{ label: 'payment' }, { label: 'delivery' }, { label: 'other' }] },
      { id: 'urgency', type: 'score', prompt: 'From 1 (low) to 5 (high), how urgent is it?' },
    ],
  });
  const result = await model.decide('I was charged twice and I need this fixed today.');
  assert.deepEqual(Object.keys(result), native.resultKeys);
  const types = Object.fromEntries(Object.entries(result).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([f, x]) => [f, typeof x]))]));
  assert.deepEqual(types, native.resultFieldTypes);
  for (const [id, decision] of Object.entries(result)) {
    assert.deepEqual(Object.keys(decision), Object.keys(native.result[id]), id);
    assert.deepEqual(Object.keys(decision.probabilities), Object.keys(native.result[id].probabilities), id);
  }
  model.destroy();
});
