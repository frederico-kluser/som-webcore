// What @som-web/core asks of a decision backend (RFC-0001 §6). Internal: applications never see it.
// K-05 implements it over the fork (packages/engine); the bench binds it to the T-milestone engines.

import type { Availability, PerformancePreference } from './index.js';
import type { DecisionModelLibraryConfig } from './config.js';

/** A question after WebIDL conversion and validation (Chrome 160 rules). */
export interface NormalizedQuestion {
  id: string;
  prompt: string;
  type: 'boolean' | 'choice' | 'score';
  options: { label: string; description?: string }[] | undefined;
}

/** The labels and score values a result carries, in option order. */
export interface QuestionLayout {
  id: string;
  type: 'boolean' | 'choice' | 'score';
  /** "true", "false" for boolean; "1"–"5" for score without options; else the option labels. */
  labels: string[];
  /** Score questions: the numeric labels when all are finite numbers, else 1…N. Null otherwise. */
  values: number[] | null;
}

export interface SelectRequest {
  preference: PerformancePreference;
  /** Chrome 160 Dev Trial option, already converted; "language-model" never reaches here. */
  devTrialBackend?: string;
  /** Tiers already loaded in this page: "auto" reuses one rather than loading a second model. */
  resident: string[];
  config: Readonly<DecisionModelLibraryConfig>;
}

export interface DecisionBackend {
  /** Primary language subtags the models cover (lower case): an expected language outside them gives "unavailable". */
  readonly languages: readonly string[];
  /**
   * Picks the tier for a preference and says where it stands: "available" when it is verified in
   * the local cache (no network needed), "downloadable" when it fits the device and the policy but
   * is not cached, "downloading" while a download runs, "unavailable" when nothing fits.
   */
  select(request: SelectRequest): Promise<{ tier: string; availability: Availability }>;
  /** Loads one tier; called once per page and tier, again only after an unload. */
  load(request: { tier: string; onProgress: (fraction: number) => void }): Promise<LoadedModel>;
}

export interface LoadedModel {
  /** Translates one question to the model's format, once, at create(). Throws a QuotaExceededError-named error when it cannot fit. */
  compile(question: NormalizedQuestion, layout: QuestionLayout): unknown;
  /**
   * One forward pass per question for this input: non-negative scores in option order
   * (the model's calibrated probabilities). An input that does not fit throws an error named
   * "QuotaExceededError"; nothing is truncated.
   */
  score(compiled: unknown[], input: string, signal?: AbortSignal): Promise<ArrayLike<number>[]>;
  /** Frees the GPU and host memory of the model. */
  unload(): void | Promise<void>;
}
