// Translation between the Decisions API and the TS-Ettin decision checkpoints (dinah.py format).
// The same rules are implemented in reference/run_reference.py; any change here changes both.
//
// One question = one sequence:  [CLS] prompt [SEP] input [SEP] [OPT] option_1 [OPT] option_2 ...
//   boolean -> dinah "noul" (qtype 0); model options ["The statement above is false.", prompt];
//              result labels "true" then "false" (Chrome's order)
//   choice  -> qtype 1; option text = description, or the label when there is no description
//   score   -> qtype 2; options default to labels "1".."5"; option text = description or label
// Each option is scored at its [OPT] marker; probabilities = softmax(logits / temperature), where
// the temperature comes from the checkpoint's config (dinah.calibration.temperature[qtype][k]).
// Result (Chrome's semantics, docs/spec/decisions-api-surface.md §6): label = most probable option
// (first on ties), confidence = its probability, expectedScore = sum(value * p) for score, value =
// the numeric label when every label is a finite number, else the 1-based position. Every number
// is rounded to float32, as the WebIDL `float` type does in the browser.

import { Tokenizer } from "@huggingface/tokenizers";

const QTYPE = { boolean: 0, choice: 1, score: 2 };
const NOUL_FALSE_DEFAULT = "The statement above is false.";
const DEFAULT_SCORE_LABELS = ["1", "2", "3", "4", "5"];

const isBlank = (s) => typeof s !== "string" || s.trim() === "";

export async function loadTsEttin(baseUrl, fetchResource) {
  const [config, tokenizerJson, tokenizerConfig] = await Promise.all([
    fetchResource(`${baseUrl}/config.json`, "json"),
    fetchResource(`${baseUrl}/tokenizer.json`, "json"),
    fetchResource(`${baseUrl}/tokenizer_config.json`, "json"),
  ]);
  const tokenizer = new Tokenizer(tokenizerJson, tokenizerConfig);
  const extra = config.dinah;
  const optId = tokenizer.token_to_id(extra.opt_token);
  if (optId !== extra.opt_token_id) throw new Error(`tokenizer does not match the model: [OPT] = ${optId}, expected ${extra.opt_token_id}`);
  return new TsEttinCodec(config, tokenizer);
}

export class TsEttinCodec {
  constructor(config, tokenizer) {
    this.config = config;
    this.tokenizer = tokenizer;
    const extra = config.dinah;
    this.optId = extra.opt_token_id;
    this.clsId = config.cls_token_id;
    this.sepId = config.sep_token_id;
    this.padId = config.pad_token_id;
    this.maxLength = extra.max_length;
    this.padMultiple = extra.pad_multiple;
    this.temperature = extra.calibration?.temperature ?? null;
    this.hidden = config.hidden_size;
  }

  ids(text) {
    const clean = typeof text === "string" ? text.trim() : "";
    return clean ? this.tokenizer.encode(clean, { add_special_tokens: false }).ids : [];
  }

  // Schema question -> everything that does not depend on the input (done once, at create()).
  compile(question) {
    const type = question.type;
    let labels, texts, toModel;
    if (type === "boolean") {
      labels = ["true", "false"];
      texts = [NOUL_FALSE_DEFAULT, question.prompt];
      toModel = [1, 0]; // Chrome index -> model index
    } else {
      const options = type === "score" && !(question.options && question.options.length)
        ? DEFAULT_SCORE_LABELS.map((label) => ({ label }))
        : question.options;
      labels = options.map((o) => o.label);
      texts = options.map((o) => (isBlank(o.description) ? o.label : o.description));
      toModel = labels.map((_, i) => i);
    }
    let values = null;
    if (type === "score") {
      // Plain decimal numbers only (Chrome parses labels with base::StringToDouble, which rejects whitespace).
      const numbers = labels.map((l) => (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(l) ? Number(l) : NaN));
      const allNumbers = numbers.every((n) => Number.isFinite(n));
      values = labels.map((_, i) => (allNumbers ? numbers[i] : i + 1));
    }
    return {
      id: question.id, type, qtype: QTYPE[type], labels, toModel, values,
      promptIds: this.ids(question.prompt),
      optionIds: texts.map((t) => this.ids(t)),
    };
  }

  // One sequence for one question and one input. Throws when it does not fit (nothing is truncated).
  encode(compiled, inputIds) {
    const ids = [this.clsId, ...compiled.promptIds, this.sepId, ...inputIds, this.sepId];
    const positions = [];
    for (const option of compiled.optionIds) {
      positions.push(ids.length);
      ids.push(this.optId, ...option);
    }
    if (ids.length > this.maxLength) {
      const error = new Error(`The request needs ${ids.length} tokens, above the model limit of ${this.maxLength}.`);
      error.name = "QuotaExceededError";
      error.requested = ids.length;
      error.quota = this.maxLength;
      throw error;
    }
    return { ids, positions, qtype: compiled.qtype };
  }

  // Batch layout shared by the engines: length padded to a multiple of pad_multiple, options to the max count.
  batch(sequences) {
    const B = sequences.length;
    const longest = Math.max(...sequences.map((s) => s.ids.length));
    const L = Math.ceil(longest / this.padMultiple) * this.padMultiple;
    const K = Math.max(...sequences.map((s) => s.positions.length));
    const ids = new Int32Array(B * L).fill(this.padId);
    const mask = new Uint8Array(B * L);
    const positions = new Int32Array(B * K);
    const optMask = new Uint8Array(B * K);
    const qtype = new Int32Array(B);
    sequences.forEach((s, b) => {
      ids.set(s.ids, b * L);
      mask.fill(1, b * L, b * L + s.ids.length);
      positions.set(s.positions, b * K);
      optMask.fill(1, b * K, b * K + s.positions.length);
      qtype[b] = s.qtype;
    });
    return { B, L, K, ids, mask, positions, optMask, qtype };
  }

  // Model logits (model order) -> Chrome-shaped decision. Arithmetic in doubles, output in float32.
  decode(compiled, logits) {
    const k = compiled.labels.length;
    let t = 1;
    if (this.temperature) t = this.temperature[compiled.qtype][Math.min(Math.max(k, 2), 9) - 2];
    const z = compiled.toModel.map((m) => logits[m] / t);
    const max = Math.max(...z);
    const e = z.map((v) => Math.exp(v - max));
    const sum = e.reduce((a, b) => a + b, 0);
    const p = e.map((v) => v / sum);
    let top = 0;
    for (let i = 1; i < k; i++) if (p[i] > p[top]) top = i;
    const probabilities = {};
    compiled.labels.forEach((label, i) => { probabilities[label] = Math.fround(p[i]); });
    // Member order mirrors the WebIDL dictionary conversion: lexicographic.
    const decision = { confidence: Math.fround(p[top]) };
    if (compiled.type === "score") decision.expectedScore = Math.fround(compiled.values.reduce((acc, v, i) => acc + v * p[i], 0));
    decision.id = compiled.id;
    decision.label = compiled.labels[top];
    decision.probabilities = probabilities;
    return decision;
  }
}
