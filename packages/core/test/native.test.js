import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getNativeDecisionModel } from '../src/index.js';

test('no native DecisionModel in Node', () => {
  assert.equal(getNativeDecisionModel(), undefined);
});

test('finds a native DecisionModel on the given scope', () => {
  class DecisionModel {}
  assert.equal(getNativeDecisionModel({ DecisionModel }), DecisionModel);
  assert.equal(getNativeDecisionModel({ DecisionModel: {} }), undefined);
  assert.equal(getNativeDecisionModel({}), undefined);
});
