// The separate configuration point of @som-web/core (RFC-0001 §5). Not part of the Decisions API:
// an application may call configure() once, before its first availability() or create(), or
// never; removing the call changes no other line of code.

/** Licence categories of models/catalog.schema.json. */
export type LicenseCategory = 'permissive' | 'non-commercial' | 'custom';

export interface DecisionModelLibraryConfig {
  /** The model catalog: a URL of a catalog.json, or the catalog object. Default: the bundled catalog. */
  catalog?: string | URL | object;
  /** Upper bound for one model download, in bytes. Default: none of our own (the device's measured budget). */
  downloadBudgetBytes?: number;
  /** Licence categories the library may pick a model from. Default: ["permissive"]. */
  licenses?: readonly LicenseCategory[];
  /** Milliseconds without a decision before the model leaves the GPU. Default: 60000, as Chrome. */
  idleUnloadMs?: number;
}

export declare function configure(options: DecisionModelLibraryConfig): Readonly<DecisionModelLibraryConfig>;
export declare function getConfig(): Readonly<DecisionModelLibraryConfig>;
