// Captures the native DecisionModel surface: members, descriptors, availability values,
// validation errors and, when a session can be created, the result shape.
// Writes only what the browser reports; nothing here is inferred.

const params = new URLSearchParams(location.search);
const out = document.getElementById("out");
const report = { kind: "decision-model-surface", startedAt: new Date().toISOString(), page: location.href, cases: [] };

function describeError(error) {
  if (error === undefined) return null;
  return { name: error?.name ?? typeof error, message: String(error?.message ?? error), constructor: error?.constructor?.name };
}

async function settle(fn) {
  try {
    const value = await fn();
    return { ok: true, value: value instanceof Object && !(value instanceof Array) ? Object.prototype.toString.call(value) : value };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

function describeMembers(target) {
  if (!target) return null;
  const members = {};
  for (const key of Reflect.ownKeys(target)) {
    const d = Object.getOwnPropertyDescriptor(target, key);
    const name = typeof key === "symbol" ? key.toString() : key;
    members[name] = {
      kind: d.get || d.set ? "accessor" : typeof d.value === "function" ? "method" : "data",
      length: typeof d.value === "function" ? d.value.length : undefined,
      getter: !!d.get, setter: !!d.set, enumerable: d.enumerable, configurable: d.configurable, writable: d.writable,
      native: typeof d.value === "function" ? /\[native code\]/.test(Function.prototype.toString.call(d.value)) : undefined,
      value: typeof d.value === "string" || typeof d.value === "number" ? d.value : undefined,
    };
  }
  return members;
}

const q = (over = {}) => ({ id: "q", type: "boolean", prompt: "Is this a test?", ...over });
const opts = (n, prefix = "o") => Array.from({ length: n }, (_, i) => ({ label: `${prefix}${i + 1}`, description: `option ${i + 1}` }));
const scoreLevels = (n) => Array.from({ length: n }, (_, i) => ({ label: String(i + 1) }));

const ROADMAP_SCHEMA = {
  expectedInputs: [{ type: "text", languages: ["pt", "en"] }],
  questions: [
    { id: "quer_reembolso", type: "boolean", prompt: "O cliente pede reembolso?" },
    { id: "assunto", type: "choice", prompt: "Qual é o assunto da mensagem?", options: [
      { label: "pagamento", description: "Cobrança, fatura ou estorno" },
      { label: "entrega", description: "Prazo, rastreio ou extravio" },
      { label: "outro", description: "Qualquer outro assunto" }] },
    { id: "urgencia", type: "score", prompt: "De 1 (baixa) a 5 (alta), qual a urgência?" },
  ],
};

const CASES = [
  ["no-arguments", undefined],
  ["empty-options", {}],
  ["empty-questions", { questions: [] }],
  ["boolean-minimal", { questions: [q()] }],
  ["roadmap-example", ROADMAP_SCHEMA],
  ["languages-en", { expectedInputs: [{ type: "text", languages: ["en"] }], questions: [q()] }],
  ["languages-pt", { expectedInputs: [{ type: "text", languages: ["pt"] }], questions: [q()] }],
  ["languages-pt-BR", { expectedInputs: [{ type: "text", languages: ["pt-BR"] }], questions: [q()] }],
  ["languages-xx", { expectedInputs: [{ type: "text", languages: ["xx"] }], questions: [q()] }],
  ["languages-invalid-tag", { expectedInputs: [{ type: "text", languages: ["not a tag!"] }], questions: [q()] }],
  ["input-image", { expectedInputs: [{ type: "image" }], questions: [q()] }],
  ["input-bogus-type", { expectedInputs: [{ type: "bogus" }], questions: [q()] }],
  ["questions-16", { questions: Array.from({ length: 16 }, (_, i) => q({ id: `q${i}` })) }],
  ["questions-17", { questions: Array.from({ length: 17 }, (_, i) => q({ id: `q${i}` })) }],
  ["choice-0-options", { questions: [q({ type: "choice" })] }],
  ["choice-1-option", { questions: [q({ type: "choice", options: opts(1) })] }],
  ["choice-2-options", { questions: [q({ type: "choice", options: opts(2) })] }],
  ["choice-26-options", { questions: [q({ type: "choice", options: opts(26) })] }],
  ["choice-27-options", { questions: [q({ type: "choice", options: opts(27) })] }],
  ["score-no-options", { questions: [q({ type: "score" })] }],
  ["score-empty-options", { questions: [q({ type: "score", options: [] })] }],
  ["score-1-level", { questions: [q({ type: "score", options: scoreLevels(1) })] }],
  ["score-2-levels", { questions: [q({ type: "score", options: scoreLevels(2) })] }],
  ["score-9-levels", { questions: [q({ type: "score", options: scoreLevels(9) })] }],
  ["score-10-levels", { questions: [q({ type: "score", options: scoreLevels(10) })] }],
  ["score-11-levels", { questions: [q({ type: "score", options: scoreLevels(11) })] }],
  ["score-12-levels", { questions: [q({ type: "score", options: scoreLevels(12) })] }],
  ["boolean-empty-options", { questions: [q({ options: [] })] }],
  ["boolean-1-option", { questions: [q({ options: opts(1) })] }],
  ["duplicate-question-id", { questions: [q(), q()] }],
  ["blank-question-id", { questions: [q({ id: "  " })] }],
  ["blank-prompt", { questions: [q({ prompt: " " })] }],
  ["missing-prompt", { questions: [{ id: "q", type: "boolean" }] }],
  ["duplicate-option-label", { questions: [q({ type: "choice", options: [{ label: "a" }, { label: "a" }] })] }],
  ["blank-option-label", { questions: [q({ type: "choice", options: [{ label: "a" }, { label: " " }] })] }],
  ["option-without-description", { questions: [q({ type: "choice", options: [{ label: "a" }, { label: "b" }] })] }],
  ["unknown-question-type", { questions: [q({ type: "rating" })] }],
  ["preference-speed", { preference: "speed", questions: [q()] }],
  ["preference-capability", { preference: "capability", questions: [q()] }],
  ["preference-bogus", { preference: "bogus", questions: [q()] }],
  ["context-member", { context: "Some shared context.", questions: [q()] }],
  ["backend-embedding-gemma-v1", { devTrialBackend: "embedding-gemma-v1", questions: [q()] }],
  ["backend-language-model", { devTrialBackend: "language-model", questions: [q()] }],
  ["backend-laya-en-wint8", { devTrialBackend: "laya-en-wint8", questions: [q()] }],
  ["backend-laya-ml-wint8", { devTrialBackend: "laya-ml-wint8", questions: [q()] }],
  ["backend-bogus", { devTrialBackend: "bogus", questions: [q()] }],
];

async function environment() {
  const env = {
    userAgent: navigator.userAgent, isSecureContext, crossOriginIsolated,
    hasDecisionModel: typeof globalThis.DecisionModel, hasLanguageModel: typeof globalThis.LanguageModel,
    hasCreateMonitor: typeof globalThis.CreateMonitor, hasGpu: !!navigator.gpu,
  };
  try {
    env.userAgentData = await navigator.userAgentData?.getHighEntropyValues(["fullVersionList", "platform", "platformVersion", "architecture", "model"]);
  } catch (error) { env.userAgentDataError = describeError(error); }
  return env;
}

// English-only copy of the roadmap example: the native implementation rejects "pt" (unsupported language).
const ENGLISH_SCHEMA = {
  expectedInputs: [{ type: "text", languages: ["en"] }],
  questions: [
    { id: "wants_refund", type: "boolean", prompt: "Does the customer ask for a refund?" },
    { id: "topic", type: "choice", prompt: "What is the message about?", options: [
      { label: "payment", description: "Billing, invoice or chargeback" },
      { label: "delivery", description: "Delivery time, tracking or lost parcel" },
      { label: "other", description: "Anything else" }] },
    { id: "urgency", type: "score", prompt: "From 1 (low) to 5 (high), how urgent is it?" },
  ],
};

async function tryCreateAndDecide(label) {
  const entry = { label, userActivation: { isActive: navigator.userActivation?.isActive, hasBeenActive: navigator.userActivation?.hasBeenActive } };
  const schema = ENGLISH_SCHEMA;
  const created = await settle(async () => {
    const model = await DecisionModel.create({
      ...schema,
      monitor(m) { entry.monitorEvents = []; m.addEventListener("downloadprogress", (e) => entry.monitorEvents.push({ loaded: e.loaded, total: e.total })); },
    });
    entry.model = model;
    return "created";
  });
  entry.create = created;
  if (entry.model) {
    const model = entry.model;
    delete entry.model;
    entry.instanceMembers = describeMembers(Object.getPrototypeOf(model));
    entry.preference = model.preference;
    entry.decide = await settle(async () => {
      const r = await model.decide("I was charged twice and I need this fixed today.");
      entry.result = JSON.parse(JSON.stringify(r));
      entry.resultKeys = Object.keys(r);
      entry.resultFieldTypes = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([f, x]) => [f, typeof x]))]));
      return "decided";
    });
    entry.decideEmpty = await settle(() => model.decide("   "));
    const controller = new AbortController();
    controller.abort();
    entry.decideAborted = await settle(() => model.decide("text", { signal: controller.signal }));
    entry.destroy = await settle(() => model.destroy());
    entry.decideAfterDestroy = await settle(() => model.decide("text"));
  }
  return entry;
}

async function main() {
  report.environment = await environment();
  if (typeof DecisionModel === "undefined") {
    report.note = "DecisionModel is not defined in this context";
  } else {
    report.static = describeMembers(DecisionModel);
    report.prototype = describeMembers(DecisionModel.prototype);
    report.prototypeParent = Object.getPrototypeOf(DecisionModel.prototype) === Object.prototype ? "Object.prototype" : String(Object.getPrototypeOf(DecisionModel.prototype)?.constructor?.name);
    report.interfaceLength = DecisionModel.length;
    report.toStringTag = DecisionModel.prototype[Symbol.toStringTag];
    report.construct = await settle(() => new DecisionModel());
    for (const [name, schema] of CASES) {
      const availability = await settle(() => (schema === undefined ? DecisionModel.availability() : DecisionModel.availability(schema)));
      const create = name === "no-arguments" || name === "boolean-minimal" || name.startsWith("questions-") || name.startsWith("choice-") || name.startsWith("score-") || name.includes("duplicate") || name.includes("blank") || name === "empty-questions" || name === "empty-options" || name === "unknown-question-type" || name === "input-image"
        ? await settle(() => (schema === undefined ? DecisionModel.create() : DecisionModel.create(schema)))
        : undefined;
      report.cases.push({ name, schema, availability, create });
    }
    report.createWithoutActivation = await tryCreateAndDecide("without-activation");
  }
  report.finishedAt = new Date().toISOString();
  out.textContent = JSON.stringify(report, null, 2);
  await post(report);
  if (params.get("activate") === "1" && typeof DecisionModel !== "undefined") {
    document.getElementById("go").addEventListener("click", async () => {
      report.createWithActivation = await tryCreateAndDecide("with-activation");
      report.finishedAt = new Date().toISOString();
      out.textContent = JSON.stringify(report, null, 2);
      await post(report);
    }, { once: true });
    out.textContent += "\n\nwaiting for a click on the button…";
  }
}

async function post(data) {
  const name = params.get("name");
  if (!name) return;
  const response = await fetch(`/api/results?name=${encodeURIComponent(name)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data, null, 2) });
  document.title = response.ok ? "posted" : "post failed";
}

main().catch(async (error) => {
  report.fatal = describeError(error);
  out.textContent = JSON.stringify(report, null, 2);
  await post(report);
});
