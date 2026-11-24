// Picks the DecisionModel implementation for a run. The page calls only the Decisions API on what
// this returns; switching engines changes this binding, never a call in the page.
//   native     -> the browser's own DecisionModel
//   ort-wasm   -> ONNX Runtime Web, Wasm   (variants: int8, 8bit, fp32)
//   ort-webgpu -> ONNX Runtime Web, WebGPU, native provider (variants: int8, 8bit, fp32)
//   ort-webgpu-jsep -> ONNX Runtime Web, WebGPU, JavaScript provider (variants: int8, 8bit, fp32)
//   jh-cpu     -> @johnhenry ModernBERT, CPU in JavaScript (variant: f32)
//   jh-webgpu  -> @johnhenry ModernBERT, WebGPU (variants: f32, f16)
//   core-<engine> -> @som-web/core (packages/core): the library's DecisionModel, with Chrome's
//                 behaviour (RFC-0001), over one of the engines above, e.g. core-jh-webgpu

// Engines are imported on demand, so a run downloads only the runtime it measures.
import { createDecisionModelClass } from "../polyfill/decision-model.js";
import { createFetcher } from "./fetch.js";
import { loadTsEttin } from "./ts-ettin.js";

// int8 and 8bit are the published graphs; fp32 and q8emb-f16 are derived locally from the pinned
// weights (reference/export_onnx.py, reference/requantize_onnx.py) and never enter git.
const ORT_FILES = {
  int8: "onnx/model_int8.onnx", "8bit": "onnx/model_8bit.onnx",
  fp32: "model_fp32.onnx", "q8emb-f16": "model_q8emb_f16.onnx", "q8emb32-f16": "model_q8emb32_f16.onnx",
};
const DERIVED = new Set(["fp32", "q8emb-f16", "q8emb32-f16"]);
const DEFAULT_VARIANT = { "ort-wasm": "int8", "ort-webgpu": "int8", "ort-webgpu-jsep": "int8", "jh-cpu": "f32", "jh-webgpu": "f32" };

// One engine for a codec: the same code for the polyfill and for the library binding.
async function loadEngine({ engine, chosen, entry, base, codec, progress, threads, optimization }) {
  const { fetchResource } = createFetcher((url, loaded, total) => progress(total ? Math.min(loaded / total, 1) * 0.99 : 0));
  let instance;
  if (engine.startsWith("ort-")) {
    if (!ORT_FILES[chosen]) throw new Error(`unknown ONNX variant ${chosen}`);
    const file = DERIVED.has(chosen) ? `/models/derived/${entry.repo}/${entry.revision}/${ORT_FILES[chosen]}` : `${base}/${ORT_FILES[chosen]}`;
    const { createOrtEngine } = await import("./ort.js");
    instance = createOrtEngine({ backend: engine.slice(4), modelUrl: file, threads, optimization: optimization || "all" });
  } else {
    const { createJohnhenryEngine } = await import("./johnhenry.js");
    instance = createJohnhenryEngine({ backend: engine.slice(3), dtype: chosen, modelUrl: `${base}/model.safetensors`, config: codec.config });
  }
  await instance.load({ fetchResource });
  return instance;
}

// Model logits -> calibrated probabilities in Chrome's label order (the codec's decode, before rounding).
function probabilities(codec, compiled, logits) {
  const k = compiled.labels.length;
  const t = codec.temperature ? codec.temperature[compiled.qtype][Math.min(Math.max(k, 2), 9) - 2] : 1;
  const z = compiled.toModel.map((m) => logits[m] / t);
  const max = Math.max(...z);
  const e = z.map((v) => Math.exp(v - max));
  const sum = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / sum);
}

// @som-web/core over a bench engine: the library supplies the surface and Chrome's behaviour; this
// backend supplies the model. No OPFS in the bench: "available" once loaded in this page.
async function getCoreDecisionModel({ engine, entry, base, chosen, threads, optimization }) {
  const { createDecisionModelClass } = await import("/packages/core/src/index.js");
  let codec = null;
  let instance = null;
  let cached = false;
  const backend = {
    languages: ["en"], // TS-Ettin model cards declare English only
    async select() {
      return { tier: `${entry.id}/${engine}-${chosen}`, availability: cached ? "available" : "downloadable" };
    },
    async load({ onProgress }) {
      codec = await loadTsEttin(base, createFetcher().fetchResource);
      instance = await loadEngine({ engine, chosen, entry, base, codec, progress: onProgress, threads, optimization });
      cached = true;
      return {
        compile: (question) => codec.compile(question),
        async score(compiled, input) {
          const ids = codec.ids(input);
          const rows = await instance.score(codec.batch(compiled.map((c) => codec.encode(c, ids))));
          return compiled.map((c, i) => probabilities(codec, c, rows[i]));
        },
        async unload() {
          const engineToFree = instance;
          instance = null;
          await engineToFree?.dispose?.();
        },
      };
    },
  };
  return {
    DecisionModel: createDecisionModelClass(backend),
    variant: chosen,
    describe: () => ({ library: "@som-web/core", model: entry.id, repo: entry.repo, revision: entry.revision, variant: chosen, ...(instance?.describe() ?? {}) }),
    async dispose() {
      const engineToFree = instance;
      instance = null;
      await engineToFree?.dispose?.();
    },
    encodeForDebug: () => null,
  };
}

export async function getDecisionModel({ engine, model, variant, threads, optimization }) {
  if (engine === "native") {
    if (typeof globalThis.DecisionModel === "undefined") throw new Error("this browser has no native DecisionModel (enable chrome://flags/#decisions-api)");
    return { DecisionModel: globalThis.DecisionModel, describe: () => ({ runtime: "native" }), variant: null };
  }
  const library = engine.startsWith("core-");
  if (library) engine = engine.slice("core-".length);
  if (!(engine in DEFAULT_VARIANT)) throw new Error(`unknown engine ${engine}`);
  const manifest = await (await fetch("models.json", { cache: "no-store" })).json();
  const entry = manifest.models.find((m) => m.id === model);
  if (!entry) throw new Error(`unknown model ${model}`);
  const base = `/models/${entry.repo}/${entry.revision}`;
  const chosen = variant || DEFAULT_VARIANT[engine];
  if (library) return getCoreDecisionModel({ engine, entry, base, chosen, threads, optimization });
  let instance = null;
  let codecRef = null;

  const DecisionModel = createDecisionModelClass({
    languages: ["en"], // TS-Ettin model cards declare English only
    async loadCodec() {
      const { fetchResource } = createFetcher();
      codecRef = await loadTsEttin(base, fetchResource);
      return codecRef;
    },
    async createEngine(codec, progress) {
      instance = await loadEngine({ engine, chosen, entry, base, codec, progress, threads, optimization });
      return instance;
    },
  });

  return {
    DecisionModel,
    variant: chosen,
    describe: () => ({ model: entry.id, repo: entry.repo, revision: entry.revision, variant: chosen, ...(instance?.describe() ?? {}) }),
    // Hygiene, not part of the API: releases what the engine holds (ONNX Runtime session, @johnhenry
    // model and WebGPU device). The page calls it at the end of every run.
    async dispose() {
      const engineToFree = instance;
      instance = null;
      await engineToFree?.dispose?.();
    },
    // Diagnostics only (not part of the API): the token ids of one question, to compare with the reference.
    encodeForDebug(question, input) {
      if (!codecRef) return null;
      const compiled = codecRef.compile(question);
      return codecRef.encode(compiled, codecRef.ids(input));
    },
  };
}
