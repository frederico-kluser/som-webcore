// @som-web/core — the public API: the Decisions API (`DecisionModel`), identical to Chrome's.
// Surface: docs/spec/decisions-api-surface.md (T-05). Contract: RFC-0001 (P-02). The backend over
// the fork comes in K-05; until then the library's own DecisionModel answers "unavailable".

import { createDecisionModelClass } from './decision-model.js';

export { configure, getConfig } from './config.js';
export { createDecisionModelClass } from './decision-model.js';
export { decodeDecision } from './decode.js';

/**
 * The browser's own `DecisionModel`, when the scope exposes one. The library never replaces it:
 * an application that finds it uses it, and the library stays out of the way.
 * @param {object} [scope] the global object to look at (`globalThis` by default)
 * @returns {any}
 */
export function getNativeDecisionModel(scope = globalThis) {
  const candidate = /** @type {{ DecisionModel?: unknown }} */ (scope).DecisionModel;
  return typeof candidate === 'function' ? candidate : undefined;
}

/** @type {import('../types/backend.js').DecisionBackend} */
const noModelYet = {
  languages: ['en'],
  async select() {
    return { tier: 'none', availability: 'unavailable' };
  },
  async load() {
    throw new DOMException('The model is not available on this device.', 'NotSupportedError');
  },
};

/** The browser's DecisionModel when there is one; otherwise this library's. */
export const DecisionModel = getNativeDecisionModel() ?? createDecisionModelClass(noModelYet);
