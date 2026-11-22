# Prior art and positioning

> Activity `S-01` of the [roadmap](../../ROADMAP.md#trilha-s). Every item was checked at its primary source on **2026-11-21**. For each one: what it is, its state, what it covers of this project's problem, and this project's role in one sentence.
> The problem: typed, single-pass decisions (`boolean`, `choice`, `score`) running on the user's device, in every browser engine, with mobile first.

## 1. Decisions API (`window.DecisionModel`)

| Part | What it is and its state | Source |
|---|---|---|
| Explainer | Proposed by the Google Chrome Built-in AI team: `DecisionModel.availability()`, `create()`, `decide()`, `destroy()`; questions `boolean`, `choice` and `score`; results with `label`, `probabilities`, `confidence` and `expectedScore`. “An early design sketch… It has not been approved to ship in Chrome.” Running custom model weights is a non-goal. No feedback from WebKit, Mozilla, the TAG or the WebML Community Group yet | `github.com/explainers-by-googlers/decisions-api`, commit `5ce6e10a81f766efaec670282696c0c57ba2de50` (2026-11-11), repository created 2026-09-30 |
| Chrome implementation | Behind the `AIDecisionModelAPI` feature in Chrome 157 (stable) and 160 (Canary). In 160, four backends: `embedding-gemma-v1` (default), `language-model`, `laya-en-wint8`, `laya-ml-wint8`; in 157, only `language-model`. **Always unavailable on Android.** Default backend: English only | Chromium source at tags `157.0.8103.79` and `160.0.8174.2`; runtime capture in this repository ([surface specification](../spec/decisions-api-surface.md)) |
| Microsoft Edge | Developer preview in Edge Canary behind a flag, using the “Aion Instruct” small language model built into Edge | `learn.microsoft.com/en-us/microsoft-edge/web-platform/decisions-api` (`ms.date` 2026-11-18) |
| Polyfill | `built-in-ai-task-apis-polyfills` 2.1.2 (GoogleChromeLabs, Apache-2.0) defines `DecisionModel` over two in-browser runtimes: Laya (default; model `convaiinnovations/laya`, about 0.8 GB) or open-jev (Transformers.js; `kev-0.6b`, about 0.4 GB) — sizes as reported by the package README | npm registry and package README (2026-11-11 release) |

**Role of this project:** implement exactly this surface, with no names of our own, and supply what it does not cover yet — mobile, measured evidence, a model per device and conformance tests.

## 2. The other built-in AI APIs

| API | State on the web (Chrome) | Source |
|---|---|---|
| Translator, Language Detector, Summarizer | shipped in Chrome 138 | Chrome developer documentation, “Built-in AI APIs” status table |
| Prompt API (`LanguageModel`) | Chrome 148 on the web; Chrome 138 in extensions | same table |
| Writer, Rewriter, Proofreader | developer trial | same table |

They share the conventions the Decisions API reuses: `availability()` before `create()`, `monitor` for download progress, `signal` for cancellation, `destroy()`, transient user activation to start a download, and the `"language-model"` Permissions-Policy feature (`decision_model.cc` in the Chromium source). Generating text is out of scope for decisions; the explainer points generative needs to the Prompt API.

**Role of this project:** follow the same conventions so `DecisionModel` behaves like its siblings, and stay out of generation.

## 3. WebNN

A W3C **Candidate Recommendation Draft** of the Web Machine Learning Working Group (version of 2026-11-20): “a dedicated low-level API for neural network inference hardware acceleration”. It runs model graphs; it does not define questions, options or decisions. The Decisions API explainer lists it, with WebGPU, as the place for developer-supplied weights.

Source: `w3.org/TR/webnn/`.

**Role of this project:** a future backend for running decision models on accelerators (`X-01`), not an alternative to a decision API.

## 4. Cross-Origin Storage

An explainer in the WICG: a content-addressable cache that lets different origins share large files, such as AI models and Wasm modules, by their hashes. Not implemented natively by any browser; a browser extension and a Vite plugin let developers try the proposed surface. The Decisions API explainer names it as a possible remedy for duplicated model downloads.

Source: `github.com/WICG/cross-origin-storage` (created 2024-12-06; last change 2026-11-16).

**Role of this project:** the way out of one download per site; weights would be stored there by hash as soon as browsers ship it.

## 5. Libraries that already run decision models in the browser

Detail, sizes and maintenance in [motores-existentes.md](../reports/motores-existentes.md) (all checked 2026-11-21).

| Library | What it runs | Role of this project |
|---|---|---|
| ONNX Runtime Web 1.31.1 (MIT) | any ONNX graph, Wasm and WebGPU; runs the published TS-Ettin graphs; the source repository returned HTTP 404 on 2026-11-21 | one of the engines measured in the T milestone |
| Transformers.js 4.3.2 (Apache-2.0) | model classes over ONNX Runtime Web; tokenizers | its tokenizer library (`@huggingface/tokenizers`) is used as is |
| open-jev 0.1.2 (MIT) | Jev-shaped decision models (`open-jev`, `kev`) through Transformers.js | a reference for the same API on other models |
| crivo-web 0.1.0 (CC BY-NC 4.0 per its README) | the Crivo family through Transformers.js | a published measurement to compare with, not a base (non-commercial) |
| laya-js engine (`@johnhenry/*`, MIT and Apache-2.0) | ModernBERT encoders in JavaScript and WGSL, CPU and WebGPU | the other engine measured in the T milestone |
| LiteRT.js 2.6.0 (Apache-2.0) | `.tflite` models, Wasm and WebGPU | out of the measurement: there is no TS-Ettin `.tflite` |

## 6. Where this leaves the project

Nobody covers mobile today: Chrome's implementation is unavailable on Android, Edge's documentation does not mention mobile, the polyfill's default models weigh hundreds of megabytes, and we found no published measurement of these libraries on phones. The project's contribution is the same API working there, measured, with a model chosen for each device — and the evidence that the capability belongs in the browser, so that this library can one day become a thin polyfill.
