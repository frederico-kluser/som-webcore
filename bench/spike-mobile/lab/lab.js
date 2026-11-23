// Device lab orchestrator. Opened on a real device (iPhone, Android) through start-lab.sh: it runs
// the environment probe, an extended environment check and the test page for each engine and
// variant, one step at a time. Each page step is a navigation of the tab (goToStep), and lab/hook.js
// brings the tab back here when the page has posted. The session state lives on the server
// (/api/lab/state), so a reload — Safari kills heavy tabs — resumes at the next step. Every page of
// the session also carries hook.js, which sends its logs, its ledgers and its markers to the server.
//
// Process epochs. What matters on the iPhone is Safari's web process, not the tab: Wasm memory slots
// and memory that is never given back belong to the process (forensic report 2026-11-22). The lab
// keeps one epoch per process it knows to be new: the start, each crash (Safari reloads a killed tab
// in a new process) and each restart of the browser. Every step records its epoch and the steps that
// ran before it in the same process. A step can require a fresh process (`precisa: "novo"`: nothing
// but clean steps ran in it) or one without memory that is never given back (`precisa: "limpo"`);
// when the current process does not qualify, the lab first runs a pending step that is expected to
// crash (`cai`) — its crash gives a fresh process for free — and only then asks for a restart: the
// owner closes Safari, or an automated runner (run-lab.mjs, ?reinicio=1) restarts the browser.
import { probeEnvironment } from "/env.js";

const params = new URLSearchParams(location.search);
const continueRun = params.get("continue") === "1"; // set when a step page comes back to the lab
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const escapeHtml = (text) => String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const UA = navigator.userAgent;
// Safari on iPhone and iPad: the 3 Wasm memories per process were measured there (2026-11-22).
const APPLE_MOBILE = /iPhone|iPad|iPod/.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1);

const PAGE = (engine, variant, model = "ts-ettin-17m", extra = "") =>
  `/index.html?engine=${engine}&variant=${variant}&model=${model}${extra}`;
const MEM = (exp, variante = "", extra = "") => `/lab/memoria.html?exp=${exp}${variante ? `&variante=${variante}` : ""}${extra}`;
const HANG = 150; // seconds: configurations that hung on desktop (ONNX Runtime WebGPU with quantized weights)
const isOrt = (step) => /[?&]engine=ort-/.test(step.url || "");
const isMemoria = (step) => (step.url || "").startsWith("/lab/memoria.html");

// Steps per profile. `rapido` ≈ 110 MB of downloads; `completo` ≈ 290 MB; `extra` adds the paths
// that failed everywhere so far (JSEP) and the slowest one (@johnhenry CPU, 32M). Weights are cached
// between steps (the page asks for `cache=1`), so each file crosses the network once. The ONNX Runtime
// WebGPU steps come first, right after the clean steps, in the session's first process (forensic
// report, X6): on the iPhone they crashed the tab, and a crash gives the next steps a fresh process.
const BASE_STEPS = [
  { id: "sonda", url: "/probe.html", timeout: 90, limpa: true },
  { id: "ambiente", kind: "env", limpa: true },
];
const COI_PROBE = { id: "sonda-coi", url: "/probe.html?coi=1", timeout: 90, limpa: true };
const PLANS = {
  rapido: [
    ...BASE_STEPS,
    { id: "ort-webgpu-q8emb32-f16-17m", url: PAGE("ort-webgpu", "q8emb32-f16"), cai: true },
    { id: "ort-wasm-8bit-17m", url: PAGE("ort-wasm", "8bit") },
    { id: "ort-wasm-q8emb32-f16-17m", url: PAGE("ort-wasm", "q8emb32-f16") },
    { id: "jh-webgpu-f32-17m", url: PAGE("jh-webgpu", "f32") },
    COI_PROBE,
  ],
  completo: [
    ...BASE_STEPS,
    { id: "ort-webgpu-q8emb32-f16-17m", url: PAGE("ort-webgpu", "q8emb32-f16"), cai: true },
    { id: "ort-webgpu-fp32-17m", url: PAGE("ort-webgpu", "fp32"), cai: true },
    { id: "ort-wasm-int8-17m", url: PAGE("ort-wasm", "int8") },
    { id: "ort-wasm-8bit-17m", url: PAGE("ort-wasm", "8bit") },
    { id: "ort-wasm-fp32-17m", url: PAGE("ort-wasm", "fp32") },
    { id: "ort-wasm-q8emb-f16-17m", url: PAGE("ort-wasm", "q8emb-f16") },
    { id: "ort-wasm-q8emb32-f16-17m", url: PAGE("ort-wasm", "q8emb32-f16") },
    { id: "ort-wasm-int8-32m", url: PAGE("ort-wasm", "int8", "ts-ettin-32m") },
    { id: "ort-wasm-8bit-32m", url: PAGE("ort-wasm", "8bit", "ts-ettin-32m") },
    { id: "jh-webgpu-f32-17m", url: PAGE("jh-webgpu", "f32") },
    { id: "jh-webgpu-f16-17m", url: PAGE("jh-webgpu", "f16") },
    { id: "jh-cpu-f32-17m", url: PAGE("jh-cpu", "f32") },
    { id: "ort-wasm-8bit-17m-debug", url: PAGE("ort-wasm", "8bit", "ts-ettin-17m", "&debug=1&warm=0") },
    { id: "ort-wasm-q8emb32-f16-17m-resistencia-200", url: PAGE("ort-wasm", "q8emb32-f16", "ts-ettin-17m", "&warm=0&endurance=200"), timeout: 600 },
    { id: "jh-webgpu-f32-17m-resistencia-200", url: PAGE("jh-webgpu", "f32", "ts-ettin-17m", "&warm=0&endurance=200"), timeout: 600 },
    { id: "ort-webgpu-8bit-17m", url: PAGE("ort-webgpu", "8bit"), timeout: HANG, cai: true },
    { id: "ort-webgpu-int8-17m", url: PAGE("ort-webgpu", "int8"), timeout: HANG, cai: true },
    COI_PROBE,
  ],
};
// Only the ONNX Runtime steps, the WebGPU ones first.
PLANS.onnx = [
  { id: "sonda", url: "/probe.html", timeout: 90, limpa: true },
  { id: "ort-webgpu-q8emb32-f16-17m", url: PAGE("ort-webgpu", "q8emb32-f16"), cai: true },
  { id: "ort-webgpu-fp32-17m", url: PAGE("ort-webgpu", "fp32"), cai: true },
  { id: "ort-wasm-q8emb32-f16-17m", url: PAGE("ort-wasm", "q8emb32-f16") },
  { id: "ort-wasm-q8emb32-f16-17m-resistencia-200", url: PAGE("ort-wasm", "q8emb32-f16", "ts-ettin-17m", "&warm=0&endurance=200"), timeout: 600 },
  { id: "ort-wasm-q8emb-f16-17m", url: PAGE("ort-wasm", "q8emb-f16") },
  { id: "ort-wasm-8bit-17m-debug", url: PAGE("ort-wasm", "8bit", "ts-ettin-17m", "&debug=1&warm=0") },
  { id: "ort-wasm-int8-32m", url: PAGE("ort-wasm", "int8", "ts-ettin-32m") },
  { id: "ort-wasm-8bit-32m", url: PAGE("ort-wasm", "8bit", "ts-ettin-32m") },
  { id: "ort-webgpu-8bit-17m", url: PAGE("ort-webgpu", "8bit"), timeout: HANG, cai: true },
  { id: "ort-webgpu-int8-17m", url: PAGE("ort-webgpu", "int8"), timeout: HANG, cai: true },
];
PLANS.extra = [
  ...PLANS.completo.slice(0, -1),
  { id: "ort-webgpu-jsep-fp32-17m", url: PAGE("ort-webgpu-jsep", "fp32"), timeout: HANG },
  { id: "ort-webgpu-jsep-8bit-17m", url: PAGE("ort-webgpu-jsep", "8bit"), timeout: HANG },
  { id: "ort-webgpu-jsep-int8-17m", url: PAGE("ort-webgpu-jsep", "int8"), timeout: HANG },
  { id: "jh-cpu-f32-32m", url: PAGE("jh-cpu", "f32", "ts-ettin-32m"), timeout: 1200 },
  COI_PROBE,
];
// C-01: the memory budget (lab/memoria.js; forensic report, section 7). The order puts every step
// that needs a fresh process right after a step expected to crash, so the owner closes Safari as few
// times as possible: the ramps die on purpose on a phone, and each death is a new process.
//   precisa: "novo"  — nothing but clean steps ran in the process (the Wasm slot counts, ONNX Runtime)
//   precisa: "limpo" — no memory that is never given back in the process (ramps and streaming)
//   deixa: "wasm"    — leaves Wasm memories (slots) behind; "residuo": memory never given back too
//   cai: true        — expected to crash the tab on a phone (no cap); depois: runs right after that step
PLANS.memoria = [
  ...BASE_STEPS,
  { id: "vagas-ort", url: MEM("vagas", "ort"), precisa: "novo", deixa: "wasm", timeout: 300, tags: ["vagas"] },
  { id: "vagas-ort-navegacao", url: MEM("vagas-navegacao", "ort"), depois: "vagas-ort", deixa: "wasm", timeout: 120, tags: ["vagas"] },
  { id: "gpu-rampa", url: MEM("gpu-rampa", "simples"), precisa: "limpo", cai: true, timeout: 300, tags: ["rampas"] },
  { id: "vagas-naocompart", url: MEM("vagas", "naoCompart"), precisa: "novo", deixa: "wasm", timeout: 120, tags: ["vagas"] },
  { id: "gpu-rampa-ab256", url: MEM("gpu-rampa", "ab256"), precisa: "limpo", cai: true, timeout: 300, tags: ["rampas"] },
  { id: "vagas-max1g", url: MEM("vagas", "max1g"), precisa: "novo", deixa: "wasm", timeout: 120, tags: ["vagas"] },
  { id: "host-rampa", url: MEM("host-rampa"), precisa: "limpo", cai: true, timeout: 300, tags: ["rampas"] },
  { id: "gpu-rampa-wasm256", url: MEM("gpu-rampa", "wasm256"), precisa: "novo", deixa: "residuo", cai: true, timeout: 300, tags: ["rampas"] },
  { id: "vagas-minima", url: MEM("vagas", "minima"), precisa: "novo", deixa: "wasm", timeout: 120, tags: ["vagas"] },
  { id: "opfs-monolitico", url: MEM("opfs-monolitico"), precisa: "limpo", cai: true, timeout: 900, tags: ["opfs"] },
  { id: "vagas-shim", url: MEM("vagas", "shim"), precisa: "novo", deixa: "wasm", timeout: 120, tags: ["vagas"] },
  { id: "opfs-streaming", url: MEM("opfs-streaming"), precisa: "limpo", timeout: 1500, tags: ["opfs"] },
  { id: "gpu-escrita", url: MEM("gpu-escrita"), precisa: "limpo", cai: true, timeout: 600, tags: ["gpu-escrita"] },
  // X4: ONNX Runtime WebGPU with both ledgers, first in a fresh process, then right after an ONNX
  // Runtime Wasm page; the @johnhenry WebGPU f32 as the baseline, with the same ledgers.
  { id: "ort-webgpu-q8emb32-f16-17m", url: PAGE("ort-webgpu", "q8emb32-f16"), precisa: "novo", deixa: "residuo", cai: true, tags: ["ort"] },
  { id: "ort-wasm-q8emb32-f16-17m", url: PAGE("ort-wasm", "q8emb32-f16"), precisa: "novo", deixa: "residuo", tags: ["ort"] },
  { id: "ort-webgpu-q8emb32-f16-17m-apos-wasm", url: PAGE("ort-webgpu", "q8emb32-f16"), depois: "ort-wasm-q8emb32-f16-17m", deixa: "residuo", cai: true, tags: ["ort"] },
  { id: "jh-webgpu-f32-17m", url: PAGE("jh-webgpu", "f32"), tags: ["ort"] },
];

let state = null;
let running = false;
let current = null; // { step }
let wakeLock = null;

function log(line) {
  const text = `${new Date().toLocaleTimeString()} ${line}`;
  console.info(`[lab] ${line}`);
  const pre = $("log");
  pre.textContent = `${text}\n${pre.textContent}`.slice(0, 6000);
}

async function api(path, body) {
  const response = await fetch(path, body === undefined ? { cache: "no-store" } : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}
const save = () => api("/api/lab/state", state);

const currentEpoch = () => (state.epochs && state.epochs.length ? state.epochs[state.epochs.length - 1] : null);
function newEpoch(reason, extra = {}) {
  state.epochs ??= [];
  state.epochs.push({ n: state.epochs.length, startedAt: new Date().toISOString(), reason, steps: [], used: false, wasm: false, residuo: false, ort: 0, ...extra });
}
// What a step leaves in its process, recorded when it starts (a crash ends the process anyway).
function enterEpoch(step) {
  const epoch = currentEpoch();
  Object.assign(step, { epoch: epoch.n, epochReason: epoch.reason, before: [...epoch.steps] });
  epoch.steps.push(step.id);
  if (!step.limpa) epoch.used = true;
  if (step.deixa === "wasm") epoch.wasm = true;
  if (step.deixa === "residuo" || isOrt(step)) Object.assign(epoch, { wasm: true, residuo: true });
  if (isOrt(step)) epoch.ort += 1;
}
// Why the current process does not suit a step, or null.
function unmet(step, epoch) {
  if (step.precisa === "novo" && epoch.used) return `precisa de um processo novo do navegador (neste já rodaram: ${epoch.steps.filter((id) => !(state.steps.find((s) => s.id === id) || {}).limpa).join(", ")})`;
  if (step.precisa === "limpo" && epoch.residuo) return `precisa de um processo sem memória presa (neste já rodaram: ${epoch.steps.join(", ")})`;
  if (isOrt(step) && APPLE_MOBILE && epoch.ort >= 3) return `o ONNX Runtime já iniciou ${epoch.ort} vezes neste processo do Safari, e a 4ª falha com "Out of memory"`;
  return null;
}
// The next step to run, a crash-expected step to run first, or a restart.
function pickNext() {
  const epoch = currentEpoch();
  for (const step of state.steps) {
    if (step.status !== "pending") continue;
    if (step.depois) {
      const before = state.steps.find((s) => s.id === step.depois);
      if (before && before.status === "pending") continue; // runs after its predecessor
      if (epoch.steps[epoch.steps.length - 1] === step.depois && before && before.status === "posted") return { step };
      Object.assign(step, { status: "skipped", note: `pulada: precisa rodar logo depois de ${step.depois}, no mesmo processo (${before ? before.status : "ausente"})` });
      continue;
    }
    const why = unmet(step, epoch);
    if (!why) return { step };
    if (state.auto && !state.restartable) return { step, unverified: why };
    const ahead = state.steps.find((s) => s.status === "pending" && s !== step && s.cai && !s.depois && !unmet(s, epoch));
    if (ahead) return { step: ahead, aheadOf: step.id, why };
    return { restart: step, why };
  }
  return { done: true };
}

function render() {
  const epoch = state.epochs ? currentEpoch() : null;
  $("session").textContent = `sessão ${state.session} · perfil ${state.profile} · ${state.label}${epoch ? ` · processo ${epoch.n}` : ""}`;
  const steps = state.steps || [];
  const done = steps.filter((s) => !["pending", "running"].includes(s.status)).length;
  $("steps").innerHTML = steps.map((s) => `<li class="${s.status}">${escapeHtml(s.id)} — ${s.status}${s.epoch !== undefined ? ` · p${s.epoch}` : ""}${s.note ? ` (${escapeHtml(String(s.note).slice(0, 160))})` : ""}</li>`).join("");
  if (state.done) $("status").textContent = `Pronto: ${done}/${steps.length} etapas. Pode fechar.`;
  else if (current) $("status").textContent = `Etapa ${steps.indexOf(current.step) + 1}/${steps.length}: ${current.step.id}`;
}

async function keepAwake() {
  try {
    if (!("wakeLock" in navigator)) { log("sem Wake Lock: mantenha a tela ligada"); return; }
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => log("wake lock liberado"));
    log("tela mantida ligada (wake lock)");
  } catch (error) {
    log(`wake lock: ${error.name} ${error.message}`);
  }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && running) keepAwake();
});

// Where a page that died was: the last marker (localStorage survives the web process; the server got
// it by sendBeacon) and the partial result the page checkpointed.
async function crashEvidence(step) {
  const read = (key) => { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } };
  const stored = read("somLab.marker");
  const partial = read("somLab.partial");
  let server = null;
  try { server = (await api("/api/lab/markers"))[step.id] ?? null; } catch { /* server without markers */ }
  const mine = (entry) => !!entry && entry.step === step.id && (entry.attempt === null || entry.attempt === undefined || entry.attempt === step.attempts);
  const candidates = [stored, server].filter(mine).sort((a, b) => String(b.at).localeCompare(String(a.at)) || (b.n ?? 0) - (a.n ?? 0));
  return { marker: candidates[0] ?? null, sources: { localStorage: mine(stored), servidor: mine(server) }, partial: mine(partial) ? partial.report : null };
}

// The record of a page that never posted: a time limit or a crash. Memory pages get a memory result
// (outcome "morreu" for a crash, with the last marker and what the page had measured); the other pages
// get the failure format of bench/spike-mobile/timeout-result.mjs, with the same evidence.
async function postFailure(step, name, message, kind = "Timeout", evidence = {}, how = null) {
  let lastProgress = null;
  try { lastProgress = await api(`/api/progress?name=${encodeURIComponent(name)}`); } catch { /* none */ }
  const url = new URL(step.url, location.origin);
  const crashed = kind === "Crash";
  const marker = evidence.marker ?? null;
  const common = {
    writtenBy: "lab.js", page: `${url.pathname}${url.search}`, fatal: { name: kind, message }, outcome: crashed ? "morreu" : "erro",
    lastMarker: marker, lastMarkerSources: evidence.sources ?? null, death: crashed ? { how, message, detectedAt: new Date().toISOString() } : null,
    epoch: { n: step.epoch ?? null, reason: step.epochReason ?? null, before: step.before ?? [] }, labUserAgent: navigator.userAgent, finishedAt: new Date().toISOString(),
  };
  const report = isMemoria(step)
    ? {
      ...(evidence.partial || {}), kind: "device-lab-memoria", schemaVersion: 1, experiment: url.searchParams.get("exp"), variant: url.searchParams.get("variante"),
      params: Object.fromEntries(url.searchParams), status: crashed ? "crashed" : "failed", erro: crashed ? null : message,
      resumo: crashed ? `morreu${marker ? ` — último marcador: ${marker.text}` : " (sem marcador)"}` : message, ...common,
    }
    : {
      kind: url.pathname === "/probe.html" ? "environment-probe" : "spike-mobile-run", schemaVersion: 1, status: "failed", config: Object.fromEntries(url.searchParams),
      failures: [{ stage: lastProgress?.stage ?? "load", item: lastProgress?.detail ?? null, error: { name: kind, message } }],
      lastProgress, answers: [], partial: evidence.partial ?? null, ...common,
    };
  await api(`/api/results?name=${encodeURIComponent(name)}`, report);
}

// Each page step is a navigation of this tab: the test page becomes the page, posts its result and
// lab/hook.js brings the tab back to /lab/lab.html?continue=1 (or after the step's time limit). The
// first version ran the steps in iframes, which share the tab's process. A navigation does not give
// memory back either: on the iPhone, Wasm memory stays in Safari's web process until it ends
// (forensic report 2026-11-22) — hence the process epochs. The URL carries the step's epoch.
function goToStep(step) {
  const query = new URLSearchParams({
    name: `${state.session}-${step.id}`, trace: "1", cache: "1", labstep: step.id, labtimeout: String(step.timeout ?? 420),
    labattempt: String(step.attempts), epoch: String(step.epoch), epocamotivo: step.epochReason ?? "", antes: (step.before || []).join(","),
  });
  location.href = `${step.url}${step.url.includes("?") ? "&" : "?"}${query}`;
}

// On the iPhone (Safari 26.6.3, 2026-11-22), in each web process the first 3 ONNX Runtime
// initializations passed and every later one failed at start with "RangeError: Out of memory" — Wasm
// and WebGPU alike — in iframes, in pages of their own, in a tab opened with window.open (noopener:
// still the same process) and in an old tab reopened by hand. Closing Safari in the app switcher gave
// a fresh process. A step that fails with "Out of memory" goes back to pending and the lab asks for a
// restart, up to MAX_OOM failures per step; the lab also counts the initializations per process and
// asks before the 4th.
const MAX_OOM = 3;
const outOfMemory = (text) => /out of memory/i.test(text || "");
const FIXED_URL = `${location.origin}/lab/lab.html`;
async function confirmRestart(reason) {
  const asked = state.needsRestart ?? null;
  delete state.needsRestart;
  newEpoch(`reinício: ${reason}`, { asked });
  (state.restarts ??= []).push({ at: new Date().toISOString(), reason, before: asked?.step ?? null, why: asked?.reason ?? null });
  await save();
}
function askForRestart() {
  running = false;
  const asked = state.needsRestart || {};
  const next = asked.step ?? state.steps.find((s) => s.status === "pending")?.id ?? "?";
  const why = asked.reason ?? "o Safari ficou sem memória para o Wasm";
  log(`antes de ${next}: feche o Safari e abra ${FIXED_URL} (${why})`);
  console.warn(`[lab] Safari restart needed before ${next}: ${why}`);
  $("status").textContent = `Feche o Safari (deslize-o para cima no seletor de apps), abra-o de novo em ${FIXED_URL} e toque em Continuar. Motivo: ${why}.`;
  const button = $("start");
  button.textContent = "Já fechei e reabri o Safari: continuar";
  button.hidden = false;
  button.onclick = async () => {
    button.hidden = true;
    await confirmRestart("o dono fechou e reabriu o Safari");
    run();
  };
}
async function requestRestart(step, why) {
  running = false;
  state.needsRestart = { at: new Date().toISOString(), step: step.id, reason: why };
  await save();
  render();
  if (state.auto && state.restartable) {
    $("status").textContent = `Aguardando o executor reabrir o navegador antes de ${step.id} (${why}).`;
    console.warn(`[lab] browser restart requested before ${step.id}: ${why}`);
    return;
  }
  askForRestart();
}

// Back from a step page: what did it leave on the server?
async function settleRunningStep() {
  const step = state.steps.find((s) => s.status === "running");
  if (!step) return;
  const name = `${state.session}-${step.id}`;
  const now = new Date().toISOString();
  let posted = null;
  try { posted = (await api("/api/lab/results"))[name] ?? null; } catch { /* server without the list */ }
  const crashedByReload = params.get("labcrashed") === step.id;
  if (posted) {
    Object.assign(step, { status: "posted", outcome: posted.outcome ?? posted.status ?? posted.kind ?? null, note: posted.resumo ?? posted.fatal ?? "", endedAt: now });
    // The page posted and then its process died (on the way back): the measurement stands, the
    // process is new.
    if (crashedByReload) {
      step.note = `${step.note ? `${step.note}; ` : ""}o processo caiu depois de postar`;
      newEpoch(`queda em ${step.id} (depois de postar)`);
    }
    if (!isMemoria(step) && posted.status === "failed" && outOfMemory(posted.fatal) && (step.oom ?? 0) + 1 < MAX_OOM) {
      step.oom = (step.oom ?? 0) + 1;
      (step.previous ??= []).push({ outcome: step.outcome, note: step.note, startedAt: step.startedAt, endedAt: now, epoch: step.epoch });
      Object.assign(step, { status: "pending", outcome: null, note: "sem memória no processo do Safari: repete depois de reabrir o Safari" });
      state.needsRestart = { at: now, step: step.id, reason: "o Safari ficou sem memória para o Wasm (RangeError: Out of memory)" };
    }
  } else if (params.get("labtimedout") === step.id) {
    const message = `the page did not post a result within ${step.timeout ?? 420} s (device lab)`;
    try { await postFailure(step, name, message, "Timeout", await crashEvidence(step)); } catch (error) { log(`falha ao gravar o tempo esgotado: ${error.message}`); }
    Object.assign(step, { status: "timeout", note: `sem resultado em ${step.timeout ?? 420} s`, endedAt: now });
  } else if (crashedByReload || isMemoria(step) || step.cai) {
    // lab/hook.js saw the step page come back as a reload: Safari reloads a page whose web process
    // crashed. Running it again would crash again (ONNX Runtime WebGPU on the iPhone, 2026-11-22; the
    // memory pages die on purpose). A memory page or a crash-expected step that comes back with no
    // result and no reload is taken as a crash too (Safari can show its error page instead of
    // reloading); the epoch says it was inferred.
    const how = crashedByReload ? "o Safari recarregou a página (processo novo)" : "voltou sem resultado nem recarga (queda inferida)";
    const message = `Safari's web process died during this step: ${how} (device lab)`;
    const evidence = await crashEvidence(step);
    try { await postFailure(step, name, message, "Crash", evidence, how); } catch (error) { log(`falha ao gravar a queda: ${error.message}`); }
    Object.assign(step, {
      status: "crashed", outcome: "morreu", endedAt: now,
      note: `o processo do Safari caiu; não repetida${evidence.marker ? ` — último marcador: ${evidence.marker.text}` : ""}`,
      lastMarker: evidence.marker ? { n: evidence.marker.n, at: evidence.marker.at, text: evidence.marker.text, data: evidence.marker.data } : null,
    });
    newEpoch(`${crashedByReload ? "queda" : "queda inferida"} em ${step.id}`, { inferred: !crashedByReload });
  } else {
    // Neither a result nor the time limit: the page was left by hand, or it crashed without a reload.
    const retry = (step.attempts ?? 1) < 2;
    Object.assign(step, retry
      ? { status: "pending", note: "voltou sem resultado; repetindo" }
      : { status: "interrupted", note: "voltou sem resultado duas vezes", endedAt: now });
    console.warn(`[lab] step ${step.id} came back without a result`);
  }
  log(`${step.id}: ${step.status}${step.outcome ? ` (${step.outcome})` : ""}`);
  await save();
}

async function runEnvStep(step) {
  const name = `${state.session}-${step.id}`;
  const report = { kind: "device-lab-environment", startedAt: new Date().toISOString(), epoch: { n: step.epoch, reason: step.epochReason, before: step.before }, probe: await probeEnvironment(), checks: await extraChecks() };
  report.finishedAt = new Date().toISOString();
  await api(`/api/results?name=${encodeURIComponent(name)}`, report);
  return { status: "ok" };
}

// Test files a memory step left in OPFS when its tab died (the step deletes them when it lives).
async function cleanupOpfs() {
  try {
    const root = await navigator.storage.getDirectory();
    const names = new Set(["som-lab-512.bin", "som-lab-1024.bin"]);
    try {
      if (typeof root.keys === "function") for await (const name of root.keys()) if (/^som-lab-\d+\.bin$/.test(name)) names.add(name);
    } catch { /* no iteration here */ }
    const removed = [];
    for (const name of names) {
      try { await root.removeEntry(name); removed.push(name); } catch { /* not there */ }
    }
    if (removed.length) {
      log(`OPFS: removidos ${removed.join(", ")} (sobras de uma etapa que caiu)`);
      (state.opfsCleanup ??= []).push({ at: new Date().toISOString(), removed });
    }
  } catch { /* no OPFS */ }
}

function startReason() {
  if (state.firstEpochReason) return state.firstEpochReason;
  if (state.auto && state.restartable) return "início: navegador aberto pelo executor";
  if (state.auto) return "início automático (processo não verificado)";
  return "início";
}

async function run() {
  running = true;
  $("start").hidden = true;
  $("start2").hidden = true;
  await keepAwake();
  state.startedAt ??= new Date().toISOString();
  if (!currentEpoch()) newEpoch(startReason());
  for (;;) {
    const next = pickNext();
    if (next.done) break;
    if (next.restart) { await requestRestart(next.restart, next.why); return; }
    const step = next.step;
    current = { step };
    delete step.note; // a previous attempt's note (kept in step.previous) does not describe this one
    delete step.aheadOf;
    if (next.aheadOf) step.aheadOf = { before: next.aheadOf, why: next.why };
    if (next.unverified) step.processoNaoRenovado = next.unverified;
    enterEpoch(step);
    step.status = "running";
    step.startedAt = new Date().toISOString();
    step.attempts = (step.attempts ?? 0) + 1;
    await save();
    render();
    log(`etapa ${step.id} (processo ${step.epoch})${next.aheadOf ? ` — antes de ${next.aheadOf}, para ganhar um processo novo se cair` : ""}${next.unverified ? ` — sem processo novo (modo automático): ${next.unverified}` : ""}`);
    if (step.kind !== "env") {
      window.__somLab?.flush();
      await sleep(400);
      goToStep(step);
      return; // the tab navigates to the step; settleRunningStep() picks it up on the way back
    }
    let outcome;
    try { outcome = await runEnvStep(step); } catch (error) { outcome = { status: "failed", note: `${error.name}: ${error.message}` }; }
    Object.assign(step, outcome, { endedAt: new Date().toISOString() });
    current = null;
    await save();
    render();
  }
  state.done = true;
  state.finishedAt = new Date().toISOString();
  await save();
  running = false;
  render();
  log("pronto");
  try { await wakeLock?.release(); } catch { /* already released */ }
}

async function main() {
  state = await api("/api/lab/state");
  if (params.get("auto") === "1") state.auto = true;
  if (params.get("reinicio") === "1") state.restartable = true;
  // The plan is built once; ?apenas=<tag> (only those steps, plus the clean ones) and ?teto=<MiB> (a
  // cap for the memory pages) shape it while no step has started.
  const untouched = !state.steps || state.steps.every((s) => s.status === "pending" && !s.attempts);
  if (!state.steps || (untouched && (params.has("apenas") || params.has("teto")))) {
    const plan = PLANS[state.profile] ?? PLANS.completo;
    const only = params.get("apenas") || null;
    const cap = params.get("teto");
    state.apenas = only;
    state.teto = cap ?? null;
    state.steps = plan
      .filter((s) => !only || s.limpa || (s.tags || []).includes(only))
      .map((s) => ({ ...s, url: s.url && cap && isMemoria(s) ? `${s.url}&teto=${encodeURIComponent(cap)}` : s.url, status: "pending", attempts: 0 }));
  }
  await save();
  await cleanupOpfs();
  await settleRunningStep();
  render();
  if (state.done) return;
  if (state.needsRestart) {
    if (params.get("reaberto")) {
      await confirmRestart("o executor fechou e reabriu o navegador");
    } else if (state.auto && !state.restartable) {
      // Automatic runs that cannot restart the browser (the simulator) go on, and say so in the steps.
      delete state.needsRestart;
      await save();
    } else if (state.auto && state.restartable) {
      $("status").textContent = `Aguardando o executor reabrir o navegador (${state.needsRestart.reason ?? ""}).`;
      return;
    } else { askForRestart(); return; }
  }
  if (state.auto || continueRun) { run(); return; }
  const resume = state.steps.some((s) => s.status !== "pending");
  $("status").textContent = resume ? "Toque para continuar" : "Toque para começar";
  if (state.profile === "memoria" && !resume) {
    $("aviso").hidden = false;
    $("start").textContent = "Já fechei e reabri o Safari: começar";
    $("start2").textContent = "Começar sem reabrir o Safari";
    $("start").hidden = false;
    $("start2").hidden = false;
    $("start").addEventListener("click", () => { state.firstEpochReason = "início: o dono fechou e reabriu o Safari"; run(); }, { once: true });
    $("start2").addEventListener("click", () => { state.firstEpochReason = "início sem reabrir o Safari (processo não verificado)"; run(); }, { once: true });
    return;
  }
  $("start").textContent = resume ? "Continuar" : "Começar";
  $("start").hidden = false;
  $("start").addEventListener("click", () => run(), { once: true });
}

// Checks that the probe does not make: storage, other built-in AI APIs, timers, WebGL details and
// a real WebGPU compute pass (a device that is created but cannot compute shows up here).
async function extraChecks() {
  const checks = {};
  const safe = async (key, fn) => {
    try { checks[key] = await fn(); } catch (error) { checks[key] = { error: `${error?.name}: ${error?.message}` }; }
  };
  await safe("navigator", () => ({
    userAgent: navigator.userAgent, platform: navigator.platform, vendor: navigator.vendor, language: navigator.language,
    languages: navigator.languages, hardwareConcurrency: navigator.hardwareConcurrency, deviceMemory: navigator.deviceMemory ?? null,
    maxTouchPoints: navigator.maxTouchPoints, onLine: navigator.onLine, standalone: navigator.standalone ?? null, webdriver: navigator.webdriver ?? null,
  }));
  await safe("screen", () => ({
    width: screen.width, height: screen.height, availWidth: screen.availWidth, availHeight: screen.availHeight, colorDepth: screen.colorDepth,
    devicePixelRatio, innerWidth, innerHeight, orientation: screen.orientation?.type ?? null,
    visualViewport: window.visualViewport ? { width: visualViewport.width, height: visualViewport.height, scale: visualViewport.scale } : null,
  }));
  await safe("media", () => Object.fromEntries(["(prefers-color-scheme: dark)", "(prefers-reduced-motion: reduce)", "(dynamic-range: high)", "(color-gamut: p3)", "(pointer: coarse)"].map((q) => [q, matchMedia(q).matches])));
  await safe("intl", () => Intl.DateTimeFormat().resolvedOptions());
  await safe("context", () => ({ isSecureContext, crossOriginIsolated, origin: location.origin.replace(/^https?:\/\/[^/]+/, "(host)") }));
  await safe("storage", async () => ({ estimate: await navigator.storage?.estimate?.() ?? null, persisted: await navigator.storage?.persisted?.() ?? null }));
  await safe("opfs", async () => {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle("som-lab-test.bin", { create: true });
    let mode = "createWritable";
    if (handle.createWritable) {
      const writable = await handle.createWritable();
      await writable.write(new Uint8Array(4096));
      await writable.close();
    } else mode = "no createWritable (sync access handle only)";
    const size = (await handle.getFile()).size;
    await root.removeEntry("som-lab-test.bin");
    return { ok: true, size, mode };
  });
  await safe("indexedDB", () => new Promise((ok, fail) => {
    const request = indexedDB.open("som-lab-test", 1);
    request.onsuccess = () => { request.result.close(); indexedDB.deleteDatabase("som-lab-test"); ok({ ok: true }); };
    request.onerror = () => fail(request.error);
  }));
  await safe("apis", () => Object.fromEntries([
    ["DecisionModel", "DecisionModel" in self], ["LanguageModel", "LanguageModel" in self], ["Summarizer", "Summarizer" in self],
    ["Writer", "Writer" in self], ["Rewriter", "Rewriter" in self], ["Proofreader", "Proofreader" in self], ["Translator", "Translator" in self],
    ["LanguageDetector", "LanguageDetector" in self], ["navigator.ml (WebNN)", "ml" in navigator], ["navigator.gpu", "gpu" in navigator],
    ["wakeLock", "wakeLock" in navigator], ["caches", "caches" in self], ["serviceWorker", "serviceWorker" in navigator],
    ["Worker", typeof Worker === "function"], ["OffscreenCanvas", typeof OffscreenCanvas === "function"],
    ["SharedArrayBuffer", typeof SharedArrayBuffer === "function"], ["Atomics.waitAsync", typeof Atomics?.waitAsync === "function"],
    ["Float16Array", typeof Float16Array === "function"], ["CompressionStream", typeof CompressionStream === "function"],
    ["WebTransport", typeof WebTransport === "function"], ["VideoDecoder (WebCodecs)", typeof VideoDecoder === "function"],
    ["requestIdleCallback", typeof requestIdleCallback === "function"], ["scheduler.postTask", typeof globalThis.scheduler?.postTask === "function"],
    ["performance.memory", !!performance.memory], ["measureUserAgentSpecificMemory", typeof performance.measureUserAgentSpecificMemory === "function"],
    ["PerformanceObserver.supportedEntryTypes", globalThis.PerformanceObserver?.supportedEntryTypes ?? null],
  ]));
  await safe("timerResolution", () => {
    let min = Infinity;
    let last = performance.now();
    for (let i = 0; i < 200000; i++) {
      const now = performance.now();
      if (now > last && now - last < min) min = now - last;
      last = now;
    }
    return { minDeltaMs: min };
  });
  await safe("webgl", () => webglInfo("webgl"));
  await safe("webgl2", () => webglInfo("webgl2"));
  await safe("webgpuCompute", () => webgpuCompute());
  return checks;
}

function webglInfo(kind) {
  const gl = document.createElement("canvas").getContext(kind);
  if (!gl) return { available: false };
  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  return {
    available: true, version: gl.getParameter(gl.VERSION), shadingLanguage: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
    vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
    renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE), extensions: gl.getSupportedExtensions(),
  };
}

// One compute pass over 1 Mi floats (x * 2 + 1), read back and checked; and an f16 shader if offered.
async function webgpuCompute() {
  if (!navigator.gpu) return { available: false };
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return { available: true, adapter: null };
  const f16 = adapter.features.has("shader-f16");
  const device = await adapter.requestDevice(f16 ? { requiredFeatures: ["shader-f16"] } : undefined);
  const errors = [];
  device.addEventListener("uncapturederror", (event) => errors.push(event.error?.message));
  const n = 1 << 20;
  const input = new Float32Array(n);
  for (let i = 0; i < n; i++) input[i] = i % 1000;
  const module = device.createShaderModule({ code: `
    @group(0) @binding(0) var<storage, read_write> data: array<f32>;
    @compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id: vec3<u32>) {
      if (id.x < arrayLength(&data)) { data[id.x] = data[id.x] * 2.0 + 1.0; }
    }` });
  const compilation = (await module.getCompilationInfo?.())?.messages?.map((m) => `${m.type}: ${m.message}`) ?? [];
  const buffer = device.createBuffer({ size: input.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
  const readback = device.createBuffer({ size: input.byteLength, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(buffer, 0, input);
  const pipeline = device.createComputePipeline({ layout: "auto", compute: { module, entryPoint: "main" } });
  const bindGroup = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer } }] });
  const started = performance.now();
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(n / 64));
  pass.end();
  encoder.copyBufferToBuffer(buffer, 0, readback, 0, input.byteLength);
  device.queue.submit([encoder.finish()]);
  await readback.mapAsync(GPUMapMode.READ);
  const output = new Float32Array(readback.getMappedRange().slice(0));
  readback.unmap();
  const ms = performance.now() - started;
  let mismatches = 0;
  for (let i = 0; i < n; i++) if (output[i] !== input[i] * 2 + 1) mismatches++;
  let f16Shader = null;
  if (f16) {
    try {
      const m16 = device.createShaderModule({ code: "enable f16;\n@compute @workgroup_size(1) fn main() { var x: f16 = 1.5h; x = x * 2.0h; }" });
      f16Shader = (await m16.getCompilationInfo?.())?.messages?.filter((m) => m.type === "error").map((m) => m.message) ?? [];
    } catch (error) { f16Shader = [`${error.name}: ${error.message}`]; }
  }
  const info = adapter.info ?? {};
  const result = {
    available: true, adapter: { vendor: info.vendor, architecture: info.architecture, device: info.device, description: info.description },
    features: [...adapter.features].sort(), limits: { maxBufferSize: adapter.limits.maxBufferSize, maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize, maxComputeWorkgroupStorageSize: adapter.limits.maxComputeWorkgroupStorageSize, maxComputeInvocationsPerWorkgroup: adapter.limits.maxComputeInvocationsPerWorkgroup },
    compute: { n, ms: Math.round(ms * 100) / 100, mismatches, compilation }, f16Shader, uncapturedErrors: errors,
  };
  device.destroy();
  return result;
}

main().catch((error) => {
  $("status").textContent = `Erro: ${error.message}`;
  console.error(error);
});
