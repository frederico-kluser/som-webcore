// The separate configuration point (RFC-0001 §5): everything that is ours and not Chrome's.
//
// It lives outside the DecisionModel surface. An application may call configure() once, before its
// first availability() or create(), or never: removing the call changes no other line of code,
// and the defaults below apply.

/** @import { DecisionModelLibraryConfig, LicenseCategory } from '../types/config.js' */

const LICENSE_CATEGORIES = /** @type {const} */ (['permissive', 'non-commercial', 'custom']);

/** @type {Readonly<Required<Omit<DecisionModelLibraryConfig, 'catalog' | 'downloadBudgetBytes'>> & Pick<DecisionModelLibraryConfig, 'catalog' | 'downloadBudgetBytes'>>} */
export const DEFAULT_CONFIG = Object.freeze({
  // The catalog bundled with the library (models/catalog.json); a URL or an object replaces it.
  catalog: undefined,
  // No budget of our own: the device's measured budget decides (C-01, B-07).
  downloadBudgetBytes: undefined,
  // Only models whose licence allows commercial use and redistribution, unless the application widens it.
  licenses: Object.freeze(/** @type {LicenseCategory[]} */ (['permissive'])),
  // Chrome unloads an idle model after 60 s ("O padrão na prática", ROADMAP); the same here.
  idleUnloadMs: 60_000,
});

let current = DEFAULT_CONFIG;

/**
 * Sets the library configuration. Unknown keys and invalid values are errors, so a typo does not
 * silently fall back to a default.
 * @param {DecisionModelLibraryConfig} options
 * @returns {Readonly<DecisionModelLibraryConfig>}
 */
export function configure(options) {
  if (options === null || typeof options !== 'object') throw new TypeError('configure() expects an object');
  const next = { ...current };
  for (const [key, value] of Object.entries(options)) {
    switch (key) {
      case 'catalog':
        if (value !== undefined && typeof value !== 'string' && !(value instanceof URL) && (value === null || typeof value !== 'object')) {
          throw new TypeError('catalog must be a URL, a string or a catalog object');
        }
        next.catalog = value;
        break;
      case 'downloadBudgetBytes':
        if (value !== undefined && !(Number.isSafeInteger(value) && value > 0)) throw new RangeError('downloadBudgetBytes must be a positive integer');
        next.downloadBudgetBytes = value;
        break;
      case 'licenses':
        if (!Array.isArray(value) || value.length === 0 || value.some((c) => !LICENSE_CATEGORIES.includes(c))) {
          throw new TypeError(`licenses must be a non-empty list of ${LICENSE_CATEGORIES.join(', ')}`);
        }
        next.licenses = Object.freeze(/** @type {LicenseCategory[]} */ ([...new Set(value)]));
        break;
      case 'idleUnloadMs':
        if (!(value === Infinity || (Number.isSafeInteger(value) && value >= 0))) throw new RangeError('idleUnloadMs must be a non-negative integer or Infinity');
        next.idleUnloadMs = value;
        break;
      default:
        throw new TypeError(`unknown configuration key '${key}'`);
    }
  }
  current = Object.freeze(next);
  return current;
}

/** @returns {Readonly<DecisionModelLibraryConfig>} */
export function getConfig() {
  return current;
}

/** Back to the defaults (tests). */
export function resetConfig() {
  current = DEFAULT_CONFIG;
}
