import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decodeDecision, layoutOf } from '../src/decode.js';

const q = (/** @type {any} */ over) => ({ id: 'q', prompt: 'p', type: 'choice', options: undefined, ...over });

test('labels and score values', () => {
  assert.deepEqual(layoutOf(q({ type: 'boolean' })).labels, ['true', 'false']);
  const score = layoutOf(q({ type: 'score' }));
  assert.deepEqual(score.labels, ['1', '2', '3', '4', '5']);
  assert.deepEqual(score.values, [1, 2, 3, 4, 5]);
  assert.deepEqual(layoutOf(q({ type: 'score', options: [{ label: '0' }, { label: '2.5' }, { label: '-1e1' }] })).values, [0, 2.5, -10]);
  // One label that is not a plain number: positions 1…N (Chrome's StringToDouble rejects " 2").
  assert.deepEqual(layoutOf(q({ type: 'score', options: [{ label: '1' }, { label: ' 2' }] })).values, [1, 2]);
  assert.deepEqual(layoutOf(q({ type: 'score', options: [{ label: 'low' }, { label: 'high' }] })).values, [1, 2]);
  assert.equal(layoutOf(q({ options: [{ label: 'a' }, { label: 'b' }] })).values, null);
});

test("Chrome's example result decodes to the same decision (spec §6)", () => {
  const layout = layoutOf(q({ id: 'urgency', type: 'score' }));
  const d = decodeDecision(layout, [0.2351, 0.6892, 0.0454, 0.0114, 0.0189]);
  assert.deepEqual(Object.keys(d), ['confidence', 'expectedScore', 'id', 'label', 'probabilities']);
  assert.equal(d.label, '2');
  assert.equal(d.confidence, Math.fround(0.6892));
  assert.ok(Math.abs(/** @type {number} */ (d.expectedScore) - 1.89) < 1e-3);
  assert.deepEqual(Object.keys(d.probabilities), ['1', '2', '3', '4', '5']);
});

test('negative and NaN scores count as zero; the vector is normalized; ties go to the first', () => {
  const layout = layoutOf(q({ options: [{ label: 'a' }, { label: 'b' }, { label: 'c' }] }));
  const d = decodeDecision(layout, [-1, Number.NaN, 3]);
  assert.deepEqual(d.probabilities, { a: 0, b: 0, c: 1 });
  assert.equal(d.label, 'c');
  const tie = decodeDecision(layout, [2, 2, 1]);
  assert.equal(tie.label, 'a');
  assert.equal(tie.confidence, Math.fround(0.4));
  assert.equal('expectedScore' in tie, false);
  const zeros = decodeDecision(layout, [0, 0, 0]);
  assert.equal(zeros.confidence, Math.fround(1 / 3));
  assert.throws(() => decodeDecision(layout, [1, 2]), RangeError);
});

test('every number is a float32', () => {
  const layout = layoutOf(q({ type: 'boolean' }));
  const d = decodeDecision(layout, [0.1, 0.2]);
  for (const v of [d.confidence, ...Object.values(d.probabilities)]) assert.equal(v, Math.fround(v));
});
