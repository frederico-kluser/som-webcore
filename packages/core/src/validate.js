// Option conversion and schema validation, with Chrome's errors and messages.
//
// Reference build: Chrome 160 (docs/spec/decisions-api-surface.md, sources I160 and RT). Two steps,
// in Chrome's order:
//   1. WebIDL dictionary conversion: members in lexicographic order, inherited dictionaries first;
//      a missing required member or an unknown enum value is a TypeError that names the path.
//   2. Blink's ValidateQuestions: counts, blanks, duplicates and per-type option limits.
// Language tags are checked last (RangeError), then the modality and the languages decide
// "unavailable" (availability) or NotSupportedError (create).

/** @import { DecisionModelCreateCoreOptions, DecisionModelCreateOptions, DecisionModelQuestion } from '../types/index.js' */

export const LIMITS = Object.freeze({ questions: 16, choiceMin: 2, choiceMax: 26, scoreMin: 2, scoreMax: 11 });

const QUESTION_TYPES = ['boolean', 'choice', 'score'];
const PREFERENCES = ['auto', 'speed', 'capability'];
const MESSAGE_TYPES = ['text', 'image', 'audio', 'tool-call', 'tool-response'];
// I160 only, "Dev Trial Only": converted like Chrome does, never declared in the types.
const DEV_TRIAL_BACKENDS = ['embedding-gemma-v1', 'language-model', 'laya-en-wint8', 'laya-ml-wint8'];

/** @param {'availability' | 'create' | 'decide'} method */
export const prefix = (method) => `Failed to execute '${method}' on 'DecisionModel': `;

const blank = (/** @type {string} */ s) => s.trim() === '';
const read = (/** @type {string} */ where, /** @type {string} */ what) => `Failed to read the '${what}' property from '${where}': `;

/**
 * @typedef {object} NormalizedQuestion
 * @property {string} id
 * @property {string} prompt
 * @property {'boolean' | 'choice' | 'score'} type
 * @property {{ label: string, description?: string }[] | undefined} options
 */

/**
 * @typedef {object} NormalizedOptions
 * @property {string | undefined} devTrialBackend
 * @property {{ type: string, languages?: string[] }[] | undefined} expectedInputs
 * @property {'auto' | 'speed' | 'capability'} preference
 * @property {NormalizedQuestion[] | undefined} questions
 * @property {AbortSignal | undefined} signal
 * @property {Function | undefined} monitor
 */

/**
 * @param {unknown} value
 * @param {string} message
 */
function requireObject(value, message) {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) throw new TypeError(message);
  return /** @type {Record<string, any>} */ (value);
}

/**
 * WebIDL conversion of DecisionModelCreateCoreOptions (availability) or DecisionModelCreateOptions (create).
 * @param {unknown} options
 * @param {'availability' | 'create'} method
 * @returns {NormalizedOptions}
 */
export function convertOptions(options, method) {
  const p = prefix(method);
  const dict = method === 'create' ? 'DecisionModelCreateOptions' : 'DecisionModelCreateCoreOptions';
  const core = 'DecisionModelCreateCoreOptions';
  /** @type {NormalizedOptions} */
  const out = { devTrialBackend: undefined, expectedInputs: undefined, preference: 'auto', questions: undefined, signal: undefined, monitor: undefined };
  if (options === undefined || options === null) return out;
  const o = requireObject(options, `${p}The provided value is not of type '${dict}'.`);

  // DecisionModelCreateCoreOptions, lexicographic: devTrialBackend, expectedInputs, preference, questions.
  if (o.devTrialBackend !== undefined) {
    const v = String(o.devTrialBackend);
    if (!DEV_TRIAL_BACKENDS.includes(v)) throw new TypeError(`${p}${read(core, 'devTrialBackend')}The provided value '${v}' is not a valid enum value of type DecisionModelBackend.`);
    out.devTrialBackend = v;
  }
  if (o.expectedInputs !== undefined) {
    const where = p + read(core, 'expectedInputs');
    out.expectedInputs = sequence(o.expectedInputs, where).map((item) => {
      const e = requireObject(item, `${where}The provided value is not of type 'LanguageModelExpected'.`);
      let languages;
      if (e.languages !== undefined) languages = sequence(e.languages, where + read('LanguageModelExpected', 'languages')).map(String);
      if (e.type === undefined) throw new TypeError(`${where}${read('LanguageModelExpected', 'type')}Required member is undefined.`);
      const type = String(e.type);
      if (!MESSAGE_TYPES.includes(type)) throw new TypeError(`${where}${read('LanguageModelExpected', 'type')}The provided value '${type}' is not a valid enum value of type LanguageModelMessageType.`);
      return languages === undefined ? { type } : { languages, type };
    });
  }
  if (o.preference !== undefined) {
    const v = String(o.preference);
    if (!PREFERENCES.includes(v)) throw new TypeError(`${p}${read(core, 'preference')}The provided value '${v}' is not a valid enum value of type PerformancePreference.`);
    out.preference = /** @type {NormalizedOptions['preference']} */ (v);
  }
  if (o.questions !== undefined) {
    const where = p + read(core, 'questions');
    out.questions = sequence(o.questions, where).map((item) => convertQuestion(item, where));
  }

  // DecisionModelCreateOptions adds monitor and signal.
  if (method === 'create') {
    if (o.monitor !== undefined && typeof o.monitor !== 'function') {
      throw new TypeError(`${p}${read(dict, 'monitor')}The provided value is not a function.`);
    }
    out.monitor = o.monitor;
    if (o.signal !== undefined && !(o.signal instanceof AbortSignal)) {
      throw new TypeError(`${p}${read(dict, 'signal')}Failed to convert value to 'AbortSignal'.`);
    }
    out.signal = o.signal;
  }
  return out;
}

/**
 * @param {unknown} value
 * @param {string} where
 * @returns {unknown[]}
 */
function sequence(value, where) {
  if (value === null || typeof value !== 'object' || typeof (/** @type {any} */ (value)[Symbol.iterator]) !== 'function') {
    throw new TypeError(`${where}The provided value cannot be converted to a sequence.`);
  }
  return Array.from(/** @type {Iterable<unknown>} */ (value));
}

/**
 * DecisionModelQuestion, lexicographic: id, options, prompt, type.
 * @param {unknown} item
 * @param {string} where
 * @returns {NormalizedQuestion}
 */
function convertQuestion(item, where) {
  const q = requireObject(item, `${where}The provided value is not of type 'DecisionModelQuestion'.`);
  const at = (/** @type {string} */ member) => where + read('DecisionModelQuestion', member);
  if (q.id === undefined) throw new TypeError(`${at('id')}Required member is undefined.`);
  const id = String(q.id);
  let options;
  if (q.options !== undefined) {
    options = sequence(q.options, at('options')).map((raw) => {
      const o = requireObject(raw, `${at('options')}The provided value is not of type 'DecisionModelOption'.`);
      // DecisionModelOption, lexicographic: description, label.
      const description = o.description === undefined ? undefined : String(o.description);
      if (o.label === undefined) throw new TypeError(`${at('options')}${read('DecisionModelOption', 'label')}Required member is undefined.`);
      return description === undefined ? { label: String(o.label) } : { description, label: String(o.label) };
    });
  }
  if (q.prompt === undefined) throw new TypeError(`${at('prompt')}Required member is undefined.`);
  const prompt = String(q.prompt);
  if (q.type === undefined) throw new TypeError(`${at('type')}Required member is undefined.`);
  const type = String(q.type);
  if (!QUESTION_TYPES.includes(type)) throw new TypeError(`${at('type')}The provided value '${type}' is not a valid enum value of type DecisionModelQuestionType.`);
  return { id, prompt, type: /** @type {NormalizedQuestion['type']} */ (type), options };
}

/**
 * Blink's ValidateQuestions (I160), same messages.
 * @param {NormalizedQuestion[] | undefined} questions
 * @param {boolean} required true for create()
 * @param {'availability' | 'create'} method
 */
export function validateQuestions(questions, required, method) {
  const fail = (/** @type {string} */ message) => {
    throw new TypeError(prefix(method) + message);
  };
  if (questions === undefined) {
    if (required) fail('DecisionModel requires a non-empty questions array.');
    return;
  }
  if (questions.length === 0) fail('DecisionModel requires a non-empty questions array.');
  if (questions.length > LIMITS.questions) fail(`DecisionModel supports at most ${LIMITS.questions} questions per schema.`);
  const ids = new Set();
  for (const q of questions) {
    if (blank(q.id)) fail('Each DecisionModelQuestion must have a non-empty id.');
    if (ids.has(q.id)) fail(`Duplicate DecisionModelQuestion id: '${q.id}'.`);
    ids.add(q.id);
    if (blank(q.prompt)) fail('Each DecisionModelQuestion must have a non-empty prompt.');
    const n = q.options ? q.options.length : 0;
    if (q.type === 'boolean' && n > 0) fail('Boolean DecisionModelQuestion must not specify options.');
    if (q.type === 'choice' && (n < LIMITS.choiceMin || n > LIMITS.choiceMax)) {
      fail(`Choice DecisionModelQuestion requires between ${LIMITS.choiceMin} and ${LIMITS.choiceMax} options.`);
    }
    if (q.type === 'score' && q.options && (n < LIMITS.scoreMin || n > LIMITS.scoreMax)) {
      fail(`Score DecisionModelQuestion options must have between ${LIMITS.scoreMin} and ${LIMITS.scoreMax} levels when specified.`);
    }
    if (n > 0) {
      const labels = new Set();
      for (const o of /** @type {{ label: string }[]} */ (q.options)) {
        if (blank(o.label)) fail('Each DecisionModelOption must have a non-empty label.');
        if (labels.has(o.label)) fail(`Duplicate DecisionModelOption label: '${o.label}'.`);
        labels.add(o.label);
      }
    }
  }
}

/**
 * Canonical BCP 47 tags of every expected input; RangeError on an invalid one.
 * @param {NormalizedOptions} opts
 * @param {'availability' | 'create'} method
 * @returns {string[]}
 */
export function languageTags(opts, method) {
  const tags = [];
  for (const expected of opts.expectedInputs ?? []) {
    for (const tag of expected.languages ?? []) {
      try {
        tags.push(Intl.getCanonicalLocales(tag)[0]);
      } catch {
        throw new RangeError(`${prefix(method)}Invalid language tag: ${tag}`);
      }
    }
  }
  return tags;
}

/**
 * Why the request cannot be served, or null: a modality other than text, a language the models do
 * not cover, or the Dev Trial "language-model" backend, which this library does not have.
 * @param {NormalizedOptions} opts
 * @param {string[]} tags canonical tags
 * @param {readonly string[]} languages primary subtags the backend covers
 * @returns {'modality' | 'language' | 'backend' | null}
 */
export function unsupportedReason(opts, tags, languages) {
  if ((opts.expectedInputs ?? []).some((e) => e.type !== 'text')) return 'modality';
  if (tags.some((tag) => !languages.includes(tag.split('-')[0].toLowerCase()))) return 'language';
  if (opts.devTrialBackend === 'language-model') return 'backend';
  return null;
}
