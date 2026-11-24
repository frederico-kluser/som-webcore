// @som-web/core — the public API: the Decisions API (`DecisionModel`), identical to Chrome's.
// The surface and its behavior are fixed in docs/spec/decisions-api-surface.md (T-05); the
// contract is RFC-0001 (P-02); the implementation over the engine comes in K-05.

/**
 * The browser's own `DecisionModel`, when the scope exposes one. The library never replaces it
 * (ROADMAP, K-05): an application that finds it uses it, and the library stays out of the way.
 * @param {object} [scope] the global object to look at (`globalThis` by default)
 * @returns {Function | undefined}
 */
export function getNativeDecisionModel(scope = globalThis) {
  const candidate = /** @type {{ DecisionModel?: unknown }} */ (scope).DecisionModel;
  return typeof candidate === 'function' ? candidate : undefined;
}
