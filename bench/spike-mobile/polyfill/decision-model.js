// A `DecisionModel` with the surface of docs/spec/decisions-api-surface.md, over any engine that
// scores TS-Ettin sequences. Validation, limits and messages follow Chrome 160 (the newest checked).
// Known difference, on purpose for automated runs: create() does not require user activation
// before downloading (Chrome does when availability is "downloadable").

const LIMITS = { questions: 16, choiceMin: 2, choiceMax: 26, scoreMin: 2, scoreMax: 11 };
const QUESTION_TYPES = ["boolean", "choice", "score"];
const PREFERENCES = ["auto", "speed", "capability"];
const MESSAGE_TYPES = ["text", "image", "audio", "tool-call", "tool-response"];

const blank = (s) => String(s).trim() === "";

function prefix(method) {
  return method === "decide" ? "Failed to execute 'decide' on 'DecisionModel': " : `Failed to execute '${method}' on 'DecisionModel': `;
}

// WebIDL dictionary conversion: required members and enum values (errors come before validation).
function convert(options, method) {
  const p = prefix(method);
  const read = (where, what) => `Failed to read the '${what}' property from '${where}': `;
  if (options == null) return {};
  if (typeof options !== "object") throw new TypeError(p + "The provided value is not of type 'DecisionModelCreateCoreOptions'.");
  if (options.preference !== undefined && !PREFERENCES.includes(String(options.preference))) {
    throw new TypeError(p + read("DecisionModelCreateCoreOptions", "preference") + `The provided value '${options.preference}' is not a valid enum value of type PerformancePreference.`);
  }
  for (const expected of options.expectedInputs ?? []) {
    if (expected?.type === undefined) throw new TypeError(p + read("DecisionModelCreateCoreOptions", "expectedInputs") + read("LanguageModelExpected", "type") + "Required member is undefined.");
    if (!MESSAGE_TYPES.includes(String(expected.type))) throw new TypeError(p + read("DecisionModelCreateCoreOptions", "expectedInputs") + read("LanguageModelExpected", "type") + `The provided value '${expected.type}' is not a valid enum value of type LanguageModelMessageType.`);
  }
  for (const q of options.questions ?? []) {
    for (const member of ["id", "prompt", "type"]) {
      if (q?.[member] === undefined) throw new TypeError(p + read("DecisionModelCreateCoreOptions", "questions") + read("DecisionModelQuestion", member) + "Required member is undefined.");
    }
    if (!QUESTION_TYPES.includes(String(q.type))) throw new TypeError(p + read("DecisionModelCreateCoreOptions", "questions") + read("DecisionModelQuestion", "type") + `The provided value '${q.type}' is not a valid enum value of type DecisionModelQuestionType.`);
    for (const o of q.options ?? []) {
      if (o?.label === undefined) throw new TypeError(p + read("DecisionModelCreateCoreOptions", "questions") + read("DecisionModelQuestion", "options") + read("DecisionModelOption", "label") + "Required member is undefined.");
    }
  }
  return {
    expectedInputs: options.expectedInputs?.map((e) => ({ type: String(e.type), languages: e.languages?.map(String) })),
    questions: options.questions?.map((q) => ({
      id: String(q.id), prompt: String(q.prompt), type: String(q.type),
      options: q.options?.map((o) => ({ label: String(o.label), description: o.description === undefined ? undefined : String(o.description) })),
    })),
    preference: options.preference === undefined ? "auto" : String(options.preference),
  };
}

// Chrome's ValidateQuestions (Blink) with the same messages.
function validate(opts, requireQuestions, method) {
  const fail = (message) => { throw new TypeError(prefix(method) + message); };
  if (opts.questions === undefined) {
    if (requireQuestions) fail("DecisionModel requires a non-empty questions array.");
    return;
  }
  if (opts.questions.length === 0) fail("DecisionModel requires a non-empty questions array.");
  if (opts.questions.length > LIMITS.questions) fail("DecisionModel supports at most 16 questions per schema.");
  const ids = new Set();
  for (const q of opts.questions) {
    if (blank(q.id)) fail("Each DecisionModelQuestion must have a non-empty id.");
    if (ids.has(q.id)) fail(`Duplicate DecisionModelQuestion id: '${q.id}'.`);
    ids.add(q.id);
    if (blank(q.prompt)) fail("Each DecisionModelQuestion must have a non-empty prompt.");
    const n = q.options ? q.options.length : 0;
    if (q.type === "boolean" && n > 0) fail("Boolean DecisionModelQuestion must not specify options.");
    if (q.type === "choice" && (!q.options || n < LIMITS.choiceMin || n > LIMITS.choiceMax)) fail("Choice DecisionModelQuestion requires between 2 and 26 options.");
    if (q.type === "score" && q.options && (n < LIMITS.scoreMin || n > LIMITS.scoreMax)) fail("Score DecisionModelQuestion options must have between 2 and 11 levels when specified.");
    if (n > 0) {
      const labels = new Set();
      for (const o of q.options) {
        if (blank(o.label)) fail("Each DecisionModelOption must have a non-empty label.");
        if (labels.has(o.label)) fail(`Duplicate DecisionModelOption label: '${o.label}'.`);
        labels.add(o.label);
      }
    }
  }
}

function canonicalLanguages(opts, method) {
  const out = [];
  for (const expected of opts.expectedInputs ?? []) {
    for (const tag of expected.languages ?? []) {
      try { out.push(Intl.getCanonicalLocales(tag)[0]); } catch { throw new RangeError(prefix(method) + `Invalid language tag: ${tag}`); }
    }
  }
  return out;
}

class CreateMonitorShim extends EventTarget {
  ondownloadprogress = null;
  dispatchProgress(loaded) {
    const event = new ProgressEvent("downloadprogress", { loaded, total: 1, lengthComputable: true });
    this.dispatchEvent(event);
    if (typeof this.ondownloadprogress === "function") this.ondownloadprogress(event);
  }
}

export function createDecisionModelClass({ loadCodec, createEngine, languages }) {
  const token = Symbol("DecisionModel");
  let ready = null;         // Promise<{ codec, engine }>
  let loaded = false;
  let queue = Promise.resolve();
  const listeners = new Set();

  function load() {
    if (!ready) {
      ready = (async () => {
        const codec = await loadCodec((fraction) => listeners.forEach((fn) => fn(fraction)));
        const engine = await createEngine(codec, (fraction) => listeners.forEach((fn) => fn(fraction)));
        loaded = true;
        return { codec, engine };
      })();
      ready.catch(() => {}); // a failed load stays failed for the page: no silent re-download per create()
    }
    return ready;
  }

  function unsupported(opts) {
    if ((opts.expectedInputs ?? []).some((e) => e.type !== "text")) return "modality";
    const tags = canonicalLanguages(opts, "availability");
    return tags.some((tag) => !languages.includes(tag.split("-")[0].toLowerCase())) ? "language" : null;
  }

  class DecisionModel {
    #compiled;
    #preference;
    #destroyed = false;

    // No declared parameters: DecisionModel.length is 0, as in the browser.
    constructor(...args) {
      const [key, compiled, preference] = args;
      if (key !== token) throw new TypeError("Failed to construct 'DecisionModel': Illegal constructor");
      this.#compiled = compiled;
      this.#preference = preference;
    }

    static async availability(options = {}) {
      const opts = convert(options, "availability");
      validate(opts, false, "availability");
      canonicalLanguages(opts, "availability");
      if (unsupported(opts)) return "unavailable";
      return loaded ? "available" : "downloadable";
    }

    static async create(options = {}) {
      const opts = convert(options, "create");
      validate(opts, true, "create");
      canonicalLanguages(opts, "create");
      const signal = options?.signal;
      if (signal?.aborted) throw signal.reason ?? new DOMException("signal is aborted without reason", "AbortError");
      const why = unsupported(opts);
      if (why === "modality") throw new DOMException("Only 'text' expectedInputs modality is currently supported.", "NotSupportedError");
      if (why === "language") throw new DOMException("The requested language options are not supported.", "NotSupportedError");
      let monitor = null;
      if (typeof options?.monitor === "function") {
        monitor = new CreateMonitorShim();
        options.monitor(monitor);
      }
      const progress = (fraction) => monitor?.dispatchProgress(fraction);
      monitor?.dispatchProgress(0);
      listeners.add(progress);
      let codec;
      try {
        ({ codec } = await load());
      } finally {
        listeners.delete(progress);
      }
      monitor?.dispatchProgress(1);
      if (signal?.aborted) throw signal.reason ?? new DOMException("signal is aborted without reason", "AbortError");
      return new DecisionModel(token, opts.questions.map((q) => codec.compile(q)), opts.preference);
    }

    async decide(input, options = {}) {
      const signal = options?.signal;
      if (this.#destroyed || signal?.aborted) throw new DOMException(prefix("decide") + "signal is aborted without reason", "AbortError");
      const text = String(input);
      if (blank(text)) throw new TypeError(prefix("decide") + "DecisionModel.decide() input cannot be empty.");
      const { codec, engine } = await load();
      const inputIds = codec.ids(text);
      let sequences;
      try {
        sequences = this.#compiled.map((c) => codec.encode(c, inputIds));
      } catch (error) {
        if (error.name === "QuotaExceededError") throw new DOMException(error.message, "QuotaExceededError");
        throw error;
      }
      const run = queue.then(() => engine.score(codec.batch(sequences)));
      queue = run.catch(() => {});
      const rows = await run;
      if (this.#destroyed) throw new DOMException(prefix("decide") + "signal is aborted without reason", "AbortError");
      const result = {};
      this.#compiled.forEach((c, i) => { result[c.id] = codec.decode(c, rows[i]); });
      return result;
    }

    destroy() { this.#destroyed = true; }

    get preference() { return this.#preference; }
  }

  // WebIDL operations and attributes are enumerable; class members are not by default.
  for (const target of [DecisionModel, DecisionModel.prototype]) {
    for (const key of Object.getOwnPropertyNames(target)) {
      if (["length", "name", "prototype", "constructor"].includes(key)) continue;
      Object.defineProperty(target, key, { ...Object.getOwnPropertyDescriptor(target, key), enumerable: true });
    }
  }
  Object.defineProperty(DecisionModel.prototype, Symbol.toStringTag, { value: "DecisionModel", configurable: true });
  return DecisionModel;
}
