// The schema side of a session (labels and score values) and Chrome's result decoder.
//
// One decoder for every model, as in Chrome (I160 DecisionModelSchemaCompiler::DecodeResult and
// SetScoreValues; docs/spec/decisions-api-surface.md §6): negative and NaN scores become 0, the
// vector is normalized by its sum, the label is the most probable option (the first on ties),
// confidence is its probability, and expectedScore (score questions only) is Σ value × p, where
// value is the numeric label when every label is a finite number, else the 1-based position.
// Calibration (temperature per question type and option count) belongs to each model, before this.

/** @import { DecisionModelDecision } from '../types/index.js' */
/** @import { NormalizedQuestion } from './validate.js' */

export const BOOLEAN_LABELS = Object.freeze(['true', 'false']);
export const DEFAULT_SCORE_LABELS = Object.freeze(['1', '2', '3', '4', '5']);

// Chrome parses score labels with base::StringToDouble, which accepts plain decimal numbers only.
const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

/**
 * @typedef {object} QuestionLayout
 * @property {string} id
 * @property {'boolean' | 'choice' | 'score'} type
 * @property {string[]} labels result labels, in option order
 * @property {number[] | null} values score values (score questions only)
 */

/**
 * The labels and score values of a question, as the result will carry them.
 * @param {NormalizedQuestion} question
 * @returns {QuestionLayout}
 */
export function layoutOf(question) {
  let labels;
  if (question.type === 'boolean') labels = [...BOOLEAN_LABELS];
  else if (question.type === 'score' && !(question.options && question.options.length)) labels = [...DEFAULT_SCORE_LABELS];
  else labels = /** @type {{ label: string }[]} */ (question.options).map((o) => o.label);
  let values = null;
  if (question.type === 'score') {
    const numbers = labels.map((l) => (NUMBER.test(l) ? Number(l) : Number.NaN));
    const numeric = numbers.every((n) => Number.isFinite(n));
    values = labels.map((_, i) => (numeric ? numbers[i] : i + 1));
  }
  return { id: question.id, type: question.type, labels, values };
}

/**
 * Chrome's decoder: scores in option order (any non-negative scale) → a decision.
 * Members are created in lexicographic order, as a WebIDL dictionary is converted, and every
 * number is rounded to float32, as the WebIDL `float` type does.
 * @param {QuestionLayout} layout
 * @param {ArrayLike<number>} scores one per label
 * @returns {DecisionModelDecision}
 */
export function decodeDecision(layout, scores) {
  const k = layout.labels.length;
  if (scores.length !== k) throw new RangeError(`question '${layout.id}': ${scores.length} scores for ${k} options`);
  const clean = Array.from(scores, (s) => (Number.isNaN(s) || s < 0 ? 0 : s));
  const sum = clean.reduce((a, b) => a + b, 0);
  // All-zero scores: not observed in Chrome; the uniform distribution is this library's choice (RFC-0001, open questions).
  const p = sum > 0 && Number.isFinite(sum) ? clean.map((s) => s / sum) : clean.map(() => 1 / k);
  let top = 0;
  for (let i = 1; i < k; i += 1) if (p[i] > p[top]) top = i;
  /** @type {Record<string, number>} */
  const probabilities = {};
  layout.labels.forEach((label, i) => {
    probabilities[label] = Math.fround(p[i]);
  });
  /** @type {DecisionModelDecision} */
  const decision = /** @type {any} */ ({ confidence: Math.fround(p[top]) });
  if (layout.type === 'score') {
    const values = /** @type {number[]} */ (layout.values);
    decision.expectedScore = Math.fround(values.reduce((acc, v, i) => acc + v * p[i], 0));
  }
  decision.id = layout.id;
  decision.label = layout.labels[top];
  decision.probabilities = probabilities;
  return decision;
}
