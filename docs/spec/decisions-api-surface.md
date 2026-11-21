# Decisions API surface (`DecisionModel`)

> **Status:** reference for the T milestone (activity `T-05` of the [roadmap](../../ROADMAP.md#padrao-chamada)). Normative for this project: the public API is this surface, with no names of our own.
> **Rule:** where the implementation and the explainer disagree, the implementation wins and the difference is listed in [section 7](#differences).
> **Checked:** 2026-11-21. TypeScript declarations: [`bench/spike-mobile/decision-model.d.ts`](../../bench/spike-mobile/decision-model.d.ts), type-checked against the roadmap example and every explainer example (`npx tsc -p bench/spike-mobile/tsconfig.json`).

## 1. Sources

| Tag | Source | What it gives |
|---|---|---|
| **I157** | Chrome stable **157.0.8103.79**: `third_party/blink/renderer/modules/ai/decision_model.{idl,cc}` and `chrome/browser/ai/{ai_manager.cc,decision_model_schema_compiler.*}` at tag `157.0.8103.79` of the Chromium source | the WebIDL, validation and availability logic of the shipped binary |
| **I160** | Chrome Canary **160.0.8174.2**: the same files at tag `160.0.8174.2` | idem, newer |
| **RT** | Runtime capture with [`bench/spike-mobile/surface.html`](../../bench/spike-mobile/surface.html) in both browsers, own `--user-data-dir`, `--enable-features=AIDecisionModelAPI`: [`2026-11-21-surface-chrome-stable-157.json`](../../bench/results/2026-11-21-surface-chrome-stable-157.json), [`2026-11-21-surface-chrome-canary-160.json`](../../bench/results/2026-11-21-surface-chrome-canary-160.json), [`2026-11-21-surface-chrome-canary-160-apos-download.json`](../../bench/results/2026-11-21-surface-chrome-canary-160-apos-download.json) | what the browsers actually expose and return |
| **EX** | Explainer `github.com/explainers-by-googlers/decisions-api`, commit `5ce6e10a81f766efaec670282696c0c57ba2de50` (2026-11-11, still the latest on 2026-11-21), `README.md` | intent, examples, open questions |

## 2. Interface

```webidl
[Exposed(Window AIDecisionModelAPI, Worker AIDecisionModelAPIForWorkers), RuntimeEnabled=AIDecisionModelAPI, SecureContext]
interface DecisionModel {
  static Promise<Availability> availability(optional DecisionModelCreateCoreOptions options = {});
  static Promise<DecisionModel> create(optional DecisionModelCreateOptions options = {});
  Promise<DecisionModelResult> decide(DOMString input, optional DecisionModelDecideOptions options = {});
  undefined destroy();
  readonly attribute PerformancePreference preference;
};
```

| Member | Kind (RT) | Source | Notes |
|---|---|---|---|
| `DecisionModel` | interface object, `length` 0, `[Symbol.toStringTag]` `"DecisionModel"`, prototype chain ends at `Object.prototype` | I157, I160, RT, EX | `new DecisionModel()` → `TypeError: Failed to construct 'DecisionModel': Illegal constructor` (RT). Secure contexts only; exposed to Window when `AIDecisionModelAPI` is enabled and to workers behind `AIDecisionModelAPIForWorkers` (workers not tested) |
| `DecisionModel.availability(options?)` | static method, `length` 0 | I157, I160, RT, EX | resolves to an `Availability`; `questions` may be absent |
| `DecisionModel.create(options?)` | static method, `length` 0 | I157, I160, RT, EX | `questions` required (non-empty) |
| `decide(input, options?)` | method, `length` 1 | I157, I160, RT, EX | `input` is a `DOMString`; must not be blank |
| `destroy()` | method, `length` 0 | I157, I160, RT, EX | aborts the session; later `decide()` calls reject |
| `preference` | read-only accessor, enumerable | I157, I160, RT | the `preference` passed to `create()`; `"auto"` by default. **Not in EX** |

## 3. Dictionaries and enums

| Name | Members | Source |
|---|---|---|
| `DecisionModelCreateCoreOptions` | `expectedInputs?: LanguageModelExpected[]`, `questions?: DecisionModelQuestion[]`, `preference?: PerformancePreference = "auto"` | I157, I160 (`expectedInputs`, `questions` also EX) |
| `DecisionModelCreateOptions : DecisionModelCreateCoreOptions` | `signal?: AbortSignal`, `monitor?: CreateMonitorCallback` | I157, I160, EX ("Built-in AI Platform Alignment") |
| `DecisionModelDecideOptions` | `signal?: AbortSignal` | I157, I160 |
| `DecisionModelQuestion` | `required id`, `required prompt`, `required type`, `options?: DecisionModelOption[]` | I157, I160, EX |
| `DecisionModelOption` | `required label`, `description?` | I157, I160, EX |
| `DecisionModelDecision` | `id`, `label`, `expectedScore`, `confidence`, `probabilities: record<DOMString, float>` — all optional in the IDL | I157, I160, EX |
| `DecisionModelResult` | `record<DOMString, DecisionModelDecision>`, keyed by question `id` | I157, I160, EX |
| `DecisionModelQuestionType` | `"boolean"`, `"choice"`, `"score"` | I157, I160, EX |
| `Availability` | `"unavailable"`, `"downloadable"`, `"downloading"`, `"available"` | I157, I160 (`availability.idl`), EX |
| `PerformancePreference` | `"auto"`, `"speed"`, `"capability"` (declared in `summarizer.idl`) | I157, I160 |
| `LanguageModelExpected` | `required type: LanguageModelMessageType`, `languages?: DOMString[]` (shared with the Prompt API) | I157, I160, EX |
| `LanguageModelMessageType` | `"text"`, `"image"`, `"audio"`, `"tool-call"`, `"tool-response"` | I157, I160 |
| `CreateMonitor : EventTarget` | `ondownloadprogress`; `downloadprogress` events carry `loaded` and `total` (RT: `total` = 1, `loaded` from 0 to 1) | I157, I160, RT, EX |

Version-specific members, **not** in the declarations: the `context` option (I157 only; removed from EX by commit `a25ccc9`, 2026-11-10; removed in I160) and the `devTrialBackend` option with the `DecisionModelBackend` enum `"embedding-gemma-v1"`, `"language-model"`, `"laya-en-wint8"`, `"laya-ml-wint8"` (I160 only, marked *Dev Trial Only*, "not slated for the final API shape").

## 4. Schema rules

The renderer validates before calling the browser, in `availability()` and `create()` alike (I157, I160 `ValidateQuestions`; RT). Messages are prefixed with `Failed to execute 'availability' on 'DecisionModel': ` (or `'create'`).

| Rule | Error (RT) |
|---|---|
| `questions` absent | `availability()`: allowed. `create()`: `TypeError` "DecisionModel requires a non-empty questions array." |
| `questions` empty | `TypeError` "DecisionModel requires a non-empty questions array." |
| more than **16** questions | `TypeError` "DecisionModel supports at most 16 questions per schema." |
| blank `id` (after trimming whitespace) | `TypeError` "Each DecisionModelQuestion must have a non-empty id." |
| repeated `id` | `TypeError` "Duplicate DecisionModelQuestion id: 'q'." |
| blank `prompt` | `TypeError` "Each DecisionModelQuestion must have a non-empty prompt." |
| missing `prompt`, `id` or `type` | `TypeError` from the WebIDL conversion ("Required member is undefined.") |
| unknown `type` | `TypeError` "… is not a valid enum value of type DecisionModelQuestionType." |
| `boolean` with options | `TypeError` "Boolean DecisionModelQuestion must not specify options." (an empty array is accepted) |
| `choice` without options or with fewer than **2** or more than **26** | `TypeError` "Choice DecisionModelQuestion requires between 2 and 26 options." |
| `score` with options outside **2–9** (I157) / **2–11** (I160); an empty array counts | `TypeError` "Score DecisionModelQuestion options must have between 2 and 9 levels when specified." (I157) / "… between 2 and 11 levels when specified." (I160) |
| blank option `label` | `TypeError` "Each DecisionModelOption must have a non-empty label." |
| repeated option `label` in a question | `TypeError` "Duplicate DecisionModelOption label: 'a'." |
| invalid BCP 47 tag in `languages` | `RangeError` "Invalid language tag: not a tag!" |
| unknown `preference` or `expectedInputs[].type` | `TypeError` (enum conversion) |
| `expectedInputs[].type` other than `"text"` | `availability()` → `"unavailable"`; `create()` → `NotSupportedError` "Only 'text' expectedInputs modality is currently supported." |

An option `description` is optional; without it the label stands for the option (I160 compiler).

## 5. Availability

| Fact | Source |
|---|---|
| **On Android the API always reports `"unavailable"`**: `AIManager::CanCreateDecisionModel` answers `kUnavailableFeatureNotEnabled` in the `#else` branch of `#if !BUILDFLAG(IS_ANDROID)` | I157, I160 (`ai_manager.cc`) |
| On desktop it also depends on the `"language-model"` Permissions-Policy feature (shared on purpose during the DevTrial), the enterprise policies `GenAILocalFoundationalModelSettings` and `BuiltInAIAPIsEnabled`, and the **"On-device AI"** setting in `chrome://settings/ai` | I157, I160 (`GetPrefBlockedResult`) |
| In a fresh I160 profile the setting read as off, and the console said: "On-device AI is disabled in Chrome settings. To use Built-In AI APIs, enable "On-device AI" in chrome://settings/ai." Every check then returned `"unavailable"`, and `create()` rejected with `NotSupportedError` "The feature flag gating model execution was disabled." Setting `optimization_guide.on_device_foundational_model_user_settings` to `true` in the profile's `Local State` (the setting's pref) removed the block. The source registers that pref with default `true`; why it read as off was not established | RT, I160 (`on_device_prefs.cc`) |
| I160 has four backends, picked by the feature parameter `backend` (default `"*"`, the first enabled one is the default): `embedding_gemma_v1` (default), `language_model` (needs the features `OptimizationGuideManifestBroker` and `OnDeviceModelForceCpuBackend`), `laya_en_wint8`, `laya_ml_wint8` | I160 |
| I157 has only the `language_model` backend (the Prompt API model), behind the same two features: without them it stays `"unavailable"` | I157, RT |
| I160, default backend, English or no language: `"downloadable"` → after the download, `"available"`. `language_model`: `"unavailable"`. `laya_*`: `"downloadable"` | RT |
| Languages other than English (`pt`, `pt-BR`, `xx`) → `"unavailable"`; console: "The requested language options are not supported." | RT |
| `create()` while `"downloadable"` or `"downloading"` without transient user activation → `NotAllowedError` "Requires a user gesture when availability is "downloading" or "downloadable"." With activation it downloads and reports progress through `monitor` | I157, I160, RT |

## 6. Results

Observed in I160, default backend (RT), for the questions `wants_refund` (boolean), `topic` (choice, 3 options) and `urgency` (score, no options):

```json
{
  "wants_refund": { "confidence": 0.5119, "id": "wants_refund", "label": "true", "probabilities": { "true": 0.5119, "false": 0.4881 } },
  "topic": { "confidence": 0.9975, "id": "topic", "label": "payment", "probabilities": { "payment": 0.9975, "delivery": 0.0017, "other": 0.0008 } },
  "urgency": { "confidence": 0.6892, "expectedScore": 1.8900, "id": "urgency", "label": "2", "probabilities": { "1": 0.2351, "2": 0.6892, "3": 0.0454, "4": 0.0114, "5": 0.0189 } }
}
```

| Rule | Source |
|---|---|
| One entry per question, keyed by `id`, in question order | I160 (`decide` callback), RT |
| Member order inside a decision is lexicographic — `confidence`, `expectedScore`, `id`, `label`, `probabilities` — as WebIDL defines for dictionaries | RT |
| `probabilities` keyed by option `label`, in option order; non-negative, normalized to sum 1 | I160 (`DecodeResult`), RT |
| `boolean`: labels `"true"` then `"false"` | I160 (compiler), RT |
| `score` without options: labels `"1"`–`"5"` | I160 (`kDefaultScoreLevels` = 5), RT, EX |
| `label` is the option with the highest probability (first one on ties) | I160 (`DecodeResult`) |
| `confidence` is the probability of `label` | I160 (`DecodeResult`), RT |
| `expectedScore` only for `score`: Σ value·probability, value = the numeric label when every label is a finite number, otherwise the 1-based position | I160 (`SetScoreValues`, `DecodeResult`), RT, EX |

`decide()` errors (RT, I160): blank input → `TypeError` "DecisionModel.decide() input cannot be empty."; an aborted `signal` → `AbortError` "signal is aborted without reason"; after `destroy()` → `AbortError` with the same message. An input too large for the model rejects with `QuotaExceededError` (I160 error mapping; not triggered in RT).

<a id="differences"></a>
## 7. Explainer and implementation

| Topic | Explainer (EX, `5ce6e10`) | Implementation | What this project follows |
|---|---|---|---|
| `preference` (option and attribute) | absent | present in I157 and I160 | implementation |
| `context` option | removed (`a25ccc9`) | I157 has it; I160 does not | not declared |
| `devTrialBackend` | absent | I160 only, Dev Trial | not declared |
| `confidence` | "Do not equate confidence with max option probability" (`c3ffa1d`); calibrated probabilities | equals the top probability (I160 `DecodeResult`) | implementation |
| options per question | "e.g., 2–16 options in compact models" (practical guidance) | `choice` 2–26; `score` 2–9 (I157) or 2–11 (I160) | implementation; the limit tracks the version |
| languages | `expectedInputs` checks language coverage | default backend: English only (RT) | implementation |
| Android and iOS | not mentioned | always `"unavailable"` on Android (I157, I160) | — |
| workers | open question | exposed to workers behind `AIDecisionModelAPIForWorkers` | not declared until tested |
| Permissions Policy | DevTrial reuses `"language-model"` | the same | the same |

## 8. Open, unstable or implementation-only

| Item | Where | State |
|---|---|---|
| Name of the API and entry point | EX "Naming" | open |
| Result shape (record keyed by `id` vs arrays or wrappers) | EX "Result Shape & Uncertainty Controls" | open |
| Controls to trade effort for confidence | EX, same section | open; not defined |
| `decideBatch(inputs)` | EX "Batching Inputs" | open; not defined in I157/I160 |
| `expectedLanguages` shorthand | EX "Input & Language Configuration" | open; not defined |
| Worker support | EX "Worker Support" | open; I160 has a separate feature for workers |
| Checking how much input fits (like the Prompt API) | EX "Core Requirements" | needed per EX; no member defined in I157/I160 |
| Calibration of `probabilities` | EX "Calibrated Probabilities" | model-dependent; not specified |
| Backend choice (`devTrialBackend`) | I160 | Dev Trial only |
| `preference` | I157, I160 | implementation-only |
| Security and privacy self-review, user research, browser and standards feedback | EX TODOs | open |

Anything else — `clone()`, `inputQuota`, `measureInputUsage()`, per-option metadata — is **not defined** by either source.
