// Device lab orchestrator. Opened on a real device (iPhone, Android) through start-lab.sh: it runs
// the environment probe, an extended environment check and the test page for each engine and
// variant, one step at a time, each in an iframe. The session state lives on the server
// (/api/lab/state), so a reload — Safari kills heavy tabs — resumes at the next step. Every page
// of the session also carries hook.js, which sends its logs to the server.
import { probeEnvironment } from "/env.js";

const params = new URLSearchParams(location.search);
const auto = params.get("auto") === "1";
const continueAfterReopen = params.get("continue") === "1"; // set when the lab reopens itself cross-origin isolated
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PAGE = (engine, variant, model = "ts-ettin-17m", extra = "") =>
  `/index.html?engine=${engine}&variant=${variant}&model=${model}${extra}`;
const HANG = 150; // seconds: configurations that hung on desktop (ONNX Runtime WebGPU with quantized weights)

// Steps per profile. `rapido` ≈ 110 MB of downloads; `completo` ≈ 290 MB; `extra` adds the paths
// that failed everywhere so far (JSEP) and the slowest one (@johnhenry CPU, 32M). Weights are cached
// between steps (the page asks for `cache=1`), so each file crosses the network once.
const BASE_STEPS = [
  { id: "sonda", url: "/probe.html", timeout: 90 },
  { id: "ambiente", kind: "env" },
];
const PLANS = {
  rapido: [
    ...BASE_STEPS,
    { id: "ort-wasm-8bit-17m", url: PAGE("ort-wasm", "8bit") },
    { id: "ort-wasm-q8emb32-f16-17m", url: PAGE("ort-wasm", "q8emb32-f16") },
    { id: "ort-webgpu-q8emb32-f16-17m", url: PAGE("ort-webgpu", "q8emb32-f16") },
    { id: "jh-webgpu-f32-17m", url: PAGE("jh-webgpu", "f32") },
    { id: "sonda-coi", url: "/probe.html?coi=1", coi: true, timeout: 90 },
  ],
  completo: [
    ...BASE_STEPS,
    { id: "ort-wasm-int8-17m", url: PAGE("ort-wasm", "int8") },
    { id: "ort-wasm-8bit-17m", url: PAGE("ort-wasm", "8bit") },
    { id: "ort-wasm-fp32-17m", url: PAGE("ort-wasm", "fp32") },
    { id: "ort-wasm-q8emb-f16-17m", url: PAGE("ort-wasm", "q8emb-f16") },
    { id: "ort-wasm-q8emb32-f16-17m", url: PAGE("ort-wasm", "q8emb32-f16") },
    { id: "ort-wasm-int8-32m", url: PAGE("ort-wasm", "int8", "ts-ettin-32m") },
    { id: "ort-wasm-8bit-32m", url: PAGE("ort-wasm", "8bit", "ts-ettin-32m") },
    { id: "ort-webgpu-fp32-17m", url: PAGE("ort-webgpu", "fp32") },
    { id: "ort-webgpu-q8emb32-f16-17m", url: PAGE("ort-webgpu", "q8emb32-f16") },
    { id: "jh-webgpu-f32-17m", url: PAGE("jh-webgpu", "f32") },
    { id: "jh-webgpu-f16-17m", url: PAGE("jh-webgpu", "f16") },
    { id: "jh-cpu-f32-17m", url: PAGE("jh-cpu", "f32") },
    { id: "ort-wasm-8bit-17m-debug", url: PAGE("ort-wasm", "8bit", "ts-ettin-17m", "&debug=1&warm=0") },
    { id: "ort-wasm-q8emb32-f16-17m-resistencia-200", url: PAGE("ort-wasm", "q8emb32-f16", "ts-ettin-17m", "&warm=0&endurance=200"), timeout: 600 },
    { id: "jh-webgpu-f32-17m-resistencia-200", url: PAGE("jh-webgpu", "f32", "ts-ettin-17m", "&warm=0&endurance=200"), timeout: 600 },
    { id: "ort-webgpu-8bit-17m", url: PAGE("ort-webgpu", "8bit"), timeout: HANG },
    { id: "ort-webgpu-int8-17m", url: PAGE("ort-webgpu", "int8"), timeout: HANG },
    { id: "sonda-coi", url: "/probe.html?coi=1", coi: true, timeout: 90 },
  ],
};
PLANS.extra = [
  ...PLANS.completo.slice(0, -1),
  { id: "ort-webgpu-jsep-fp32-17m", url: PAGE("ort-webgpu-jsep", "fp32"), timeout: HANG },
  { id: "ort-webgpu-jsep-8bit-17m", url: PAGE("ort-webgpu-jsep", "8bit"), timeout: HANG },
  { id: "ort-webgpu-jsep-int8-17m", url: PAGE("ort-webgpu-jsep", "int8"), timeout: HANG },
  { id: "jh-cpu-f32-32m", url: PAGE("jh-cpu", "f32", "ts-ettin-32m"), timeout: 1200 },
  PLANS.completo.at(-1),
];

let state = null;
let running = false;
let current = null; // { step, frame, skip }
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

function render() {
  $("session").textContent = `sessão ${state.session} · perfil ${state.profile} · ${state.label}`;
  const steps = state.steps || [];
  const done = steps.filter((s) => !["pending", "running"].includes(s.status)).length;
  $("steps").innerHTML = steps.map((s) => `<li class="${s.status}">${s.id} — ${s.status}${s.note ? ` (${s.note})` : ""}</li>`).join("");
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

// The failure record of a page that never posted, in the format of bench/spike-mobile/timeout-result.mjs.
async function postFailure(step, name, message) {
  let lastProgress = null;
  try { lastProgress = await api(`/api/progress?name=${encodeURIComponent(name)}`); } catch { /* none */ }
  const url = new URL(step.url, location.origin);
  const report = {
    kind: step.url.startsWith("/probe.html") ? "environment-probe" : "spike-mobile-run",
    schemaVersion: 1, status: "failed", writtenBy: "lab.js", page: `${url.pathname}${url.search}`,
    config: Object.fromEntries(url.searchParams), fatal: { name: "Timeout", message },
    failures: [{ stage: lastProgress?.stage ?? "load", item: lastProgress?.detail ?? null, error: { name: "Timeout", message } }],
    lastProgress, answers: [], finishedAt: new Date().toISOString(),
  };
  await api(`/api/results?name=${encodeURIComponent(name)}`, report);
}

async function runPageStep(step) {
  const name = `${state.session}-${step.id}`;
  const url = `${step.url}${step.url.includes("?") ? "&" : "?"}name=${encodeURIComponent(name)}&trace=1&cache=1`;
  const frame = document.createElement("iframe");
  frame.title = step.id;
  frame.src = url;
  $("frame").replaceChildren(frame);
  current.frame = frame;
  const deadline = Date.now() + (step.timeout ?? 420) * 1000;
  for (;;) {
    if (current.skip) return { status: "skipped", note: "pulada na tela" };
    let title = "";
    try { title = frame.contentDocument?.title ?? ""; } catch { /* navigating */ }
    if (title === "posted") return { status: "posted" }; // the run's own status is in its JSON
    if (title === "post failed") return { status: "failed", note: "a página não conseguiu gravar o resultado" };
    if (Date.now() > deadline) {
      const message = `the page did not post a result within ${step.timeout ?? 420} s (device lab)`;
      try { await postFailure(step, name, message); } catch (error) { log(`falha ao gravar o tempo esgotado: ${error.message}`); }
      return { status: "timeout", note: `sem resultado em ${step.timeout ?? 420} s` };
    }
    await sleep(500);
  }
}

async function runEnvStep(step) {
  const name = `${state.session}-${step.id}`;
  const report = { kind: "device-lab-environment", startedAt: new Date().toISOString(), probe: await probeEnvironment(), checks: await extraChecks() };
  report.finishedAt = new Date().toISOString();
  await api(`/api/results?name=${encodeURIComponent(name)}`, report);
  return { status: "ok" };
}

async function run() {
  running = true;
  $("start").hidden = true;
  $("skip").hidden = false;
  await keepAwake();
  state.startedAt ??= new Date().toISOString();
  for (const step of state.steps) {
    if (step.status !== "pending") continue;
    if (step.coi && !crossOriginIsolated) {
      await save();
      log("abrindo o laboratório com isolamento de origem (COOP/COEP)");
      location.href = `/lab/lab.html?coi=1&continue=1${auto ? "&auto=1" : ""}`;
      return;
    }
    current = { step, frame: null, skip: false };
    step.status = "running";
    step.startedAt = new Date().toISOString();
    step.attempts = (step.attempts ?? 0) + 1;
    await save();
    render();
    log(`etapa ${step.id}`);
    let outcome;
    try {
      outcome = step.kind === "env" ? await runEnvStep(step) : await runPageStep(step);
    } catch (error) {
      outcome = { status: "failed", note: `${error.name}: ${error.message}` };
    }
    if (current.frame) {
      // Last logs of the page out before it goes (hook.js sends them as beacons).
      try { current.frame.contentWindow?.__somLab?.flush(); } catch { /* cross-origin or gone */ }
      await sleep(500);
      current.frame.src = "about:blank";
      current.frame.remove();
    }
    Object.assign(step, outcome, { endedAt: new Date().toISOString() });
    current = null;
    await save();
    render();
    log(`${step.id}: ${step.status}${step.note ? ` (${step.note})` : ""}`);
    await sleep(2000); // let the removed page's memory go before the next one
  }
  state.done = true;
  state.finishedAt = new Date().toISOString();
  await save();
  running = false;
  $("skip").hidden = true;
  render();
  log("pronto");
  try { await wakeLock?.release(); } catch { /* already released */ }
}

async function main() {
  state = await api("/api/lab/state");
  if (!state.steps) {
    const plan = PLANS[state.profile] ?? PLANS.completo;
    state.steps = plan.map((s) => ({ ...s, status: "pending", attempts: 0 }));
    await save();
  }
  // A step still "running" means the page reloaded or crashed in the middle of it.
  for (const step of state.steps) {
    if (step.status === "running") {
      const retry = (step.attempts ?? 1) < 2;
      Object.assign(step, retry ? { status: "pending", note: "a página recarregou; repetindo" } : { status: "interrupted", note: "a página recarregou duas vezes nesta etapa", endedAt: new Date().toISOString() });
      log(`a página recarregou durante ${step.id}`);
      console.warn(`[lab] page reloaded during step ${step.id}`);
    }
  }
  await save();
  render();
  $("skip").addEventListener("click", () => { if (current) current.skip = true; });
  if (state.done) return;
  const resume = state.steps.some((s) => s.status !== "pending");
  $("status").textContent = resume ? "Toque para continuar" : "Toque para começar";
  $("start").textContent = resume ? "Continuar" : "Começar";
  if (auto || continueAfterReopen) { run(); return; }
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
