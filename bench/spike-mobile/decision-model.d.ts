// TypeScript declarations of the Decisions API surface (`DecisionModel`), as implemented in
// Chrome and documented by the explainer. Specification and per-member provenance:
// docs/spec/decisions-api-surface.md.
//
// Sources (checked 2026-11-21):
//   [I157] Chrome 157.0.8103.79 — third_party/blink/renderer/modules/ai/decision_model.idl at that tag
//   [I160] Chrome 160.0.8174.2  — the same file at that tag
//   [RT]   runtime capture in both browsers: bench/results/2026-11-21-surface-chrome-*.json
//   [EX]   explainer github.com/explainers-by-googlers/decisions-api, commit
//          5ce6e10a81f766efaec670282696c0c57ba2de50 (2026-11-11), README.md
// Version-specific members that are left out on purpose (see the specification):
//   `context` (option; I157 only, removed from EX in commit a25ccc9) and
//   `devTrialBackend` (option; I160 only, marked "Dev Trial Only").

/** [I157][I160] availability.idl · [EX] "Potential Solution". */
type Availability = "unavailable" | "downloadable" | "downloading" | "available";

/** [I157][I160] declared in summarizer.idl, used by decision_model.idl. Not in [EX]. */
type PerformancePreference = "auto" | "speed" | "capability";

/** [I157][I160] decision_model.idl · [EX] "Common Decision Tasks". */
type DecisionModelQuestionType = "boolean" | "choice" | "score";

/** [I157][I160] language_model_create_options.idl (shared with the Prompt API). */
type LanguageModelMessageType = "text" | "image" | "audio" | "tool-call" | "tool-response";

/** [I157][I160] language_model_create_options.idl · [EX] "Input & Language Configuration". */
interface LanguageModelExpected {
  type: LanguageModelMessageType;
  languages?: string[];
}

/** [I157][I160] decision_model.idl · [EX] use case 1. */
interface DecisionModelOption {
  label: string;
  description?: string;
}

/** [I157][I160] decision_model.idl · [EX] "Potential Solution". */
interface DecisionModelQuestion {
  id: string;
  prompt: string;
  type: DecisionModelQuestionType;
  /** Required for "choice" (2–26), optional for "score" (2–9 in I157, 2–11 in I160; default "1"–"5"), forbidden for "boolean". */
  options?: DecisionModelOption[];
}

/** [I157][I160] decision_model.idl (`DecisionModelCreateCoreOptions`). */
interface DecisionModelCreateCoreOptions {
  /** [I157][I160] · [EX] "Input & Language Configuration". */
  expectedInputs?: LanguageModelExpected[];
  /** [I157][I160] At most 16. Required by create(); optional for availability(). */
  questions?: DecisionModelQuestion[];
  /** [I157][I160] Defaults to "auto". Not in [EX]. */
  preference?: PerformancePreference;
}

/** [I157][I160] create_monitor.idl (shared with the other built-in AI APIs) · [EX] "monitor callbacks". */
interface CreateMonitor extends EventTarget {
  ondownloadprogress: ((this: CreateMonitor, event: ProgressEvent) => unknown) | null;
  addEventListener(type: "downloadprogress", listener: (this: CreateMonitor, event: ProgressEvent) => unknown, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
}

/** [I157][I160] create_monitor.idl. */
type CreateMonitorCallback = (monitor: CreateMonitor) => void;

/** [I157][I160] decision_model.idl (`DecisionModelCreateOptions`) · [EX] "`AbortSignal` (`signal`) support", "`monitor` callbacks". */
interface DecisionModelCreateOptions extends DecisionModelCreateCoreOptions {
  signal?: AbortSignal;
  monitor?: CreateMonitorCallback;
}

/** [I157][I160] decision_model.idl (`DecisionModelDecideOptions`). */
interface DecisionModelDecideOptions {
  signal?: AbortSignal;
}

/**
 * [I157][I160] decision_model.idl (`DecisionModelDecision`) · [EX] "Potential Solution".
 * The IDL marks every member optional; the implementation always sets id, label, confidence and
 * probabilities, and sets expectedScore only for "score" questions ([I160] DecisionModelSchemaCompiler::DecodeResult, [RT]).
 */
interface DecisionModelDecision {
  id: string;
  label: string;
  /** Only for "score": sum of value × probability, value = the numeric label when every label is a finite number, else the 1-based position. */
  expectedScore?: number;
  /** Implementation: the probability of the winning label. [EX] says it should not equal the top probability. */
  confidence: number;
  /** Keyed by option label; "true"/"false" for "boolean"; "1"–"5" for "score" without options. */
  probabilities: Record<string, number>;
}

/** [I157][I160] decision_model.idl — keyed by question id. */
type DecisionModelResult = Record<string, DecisionModelDecision>;

/**
 * [I157][I160] decision_model.idl — `[Exposed=(Window, Worker), SecureContext]`, gated by the
 * `AIDecisionModelAPI` feature. Not constructible: `new DecisionModel()` throws TypeError "Illegal constructor".
 */
declare class DecisionModel {
  private constructor();
  /** [I157][I160] [EX]. Rejects with TypeError/RangeError on an invalid schema. */
  static availability(options?: DecisionModelCreateCoreOptions): Promise<Availability>;
  /** [I157][I160] [EX]. Needs transient user activation when the model is "downloadable" or "downloading". */
  static create(options?: DecisionModelCreateOptions): Promise<DecisionModel>;
  /** [I157][I160] [EX]. The input must not be blank. */
  decide(input: string, options?: DecisionModelDecideOptions): Promise<DecisionModelResult>;
  /** [I157][I160] [EX]. */
  destroy(): void;
  /** [I157][I160] Read-only; the preference passed to create(). Not in [EX]. */
  readonly preference: PerformancePreference;
}
