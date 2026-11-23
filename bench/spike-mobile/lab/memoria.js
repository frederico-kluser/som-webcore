// Device lab, memory profile (start-lab.sh --perfil memoria; ROADMAP C-01, forensic report
// 2026-11-22, section 7): how much a page can hold before the tab dies, and how. One experiment per
// lab step, chosen by ?exp= (and ?variante=):
//   gpu-rampa      X3: 64 MiB STORAGE buffers, mappedAtCreation and filled, until an error, a cap or
//                  the tab's death; variants simples, ab256 (256 MiB committed in an ArrayBuffer
//                  first) and wasm256 (256 MiB in a non-shared Wasm memory first)
//   host-rampa     the same with 64 MiB ArrayBuffers
//   vagas          X1: how many Wasm memories of one descriptor fit (up to 16, all held), with the exact
//                  error; variant ort adds X2: drop them, pressure the collector, count again at 1, 10
//                  and 60 s, then the Worker variant (create in a Worker, terminate(), count in the page)
//   vagas-navegacao X2: the ort count again, on the next lab step (a same-site navigation)
//   gpu-escrita    the GPU process's tolerance: 4 MiB queue.writeBuffer into 4 fixed buffers, first
//                  awaiting the queue every 64 MiB, then without awaiting, until device.lost, death or a cap
//   opfs-streaming X5: 512 MiB and 1 GiB files in OPFS, read back in 4 MiB chunks in a Worker and sent
//                  to the GPU, through a ring of 3 × 64 MiB slabs (3 passes, a WGSL kernel reads each
//                  slab) and into slabs of 256 MiB covering the whole file
//   opfs-monolitico today's path: the whole file into one Uint8Array (engines/fetch.js), then writeBuffer
// Before each risky step the page writes a crash-proof marker (lab/hook.js mark()): after Safari kills
// the tab, the lab writes the result with the last marker and what the page had checkpointed. Every
// result records the device, the adapter (info, limits, features, WGSL features), the storage
// estimate, the parameters, the per-step timings, the last marker and the outcome: completou, erro
// (with the verbatim message) or morreu (written by the lab). Caps: none on phones; 3 GiB of GPU and
// 2 GiB of host on desktop, so the Mac mini stays healthy (?teto=<MiB> overrides; teto=0: none).
import { createFetcher } from "/engines/fetch.js";

const params = new URLSearchParams(location.search);
const lab = window.__somLab ?? null;
const EXP = params.get("exp") || "";
const VARIANT = params.get("variante") || null;
const MiB = 1 << 20;
const GiB = 1 << 30;
const CHUNK = 4 * MiB;
const GROUP = 64 * MiB;
const version = new URL(import.meta.url).searchParams.get("v");
const scriptUrl = (path) => `${path}${version ? `?v=${encodeURIComponent(version)}` : ""}`;
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const round = (x, digits = 2) => (x === null || x === undefined || !Number.isFinite(x) ? null : Math.round(x * 10 ** digits) / 10 ** digits);
const mibOf = (bytes) => round(bytes / MiB);
const mbps = (bytes, ms) => (ms > 0 ? round(bytes / 1e6 / (ms / 1000), 1) : null); // MB/s, 10^6 bytes
const errorText = (error) => `${error?.name ?? typeof error}: ${error?.message ?? String(error)}`;
const ua = navigator.userAgent;
const PHONE = navigator.userAgentData?.mobile === true || /iPhone|iPad|iPod|Android/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);

const report = {
  kind: "device-lab-memoria", schemaVersion: 1, experiment: EXP, variant: VARIANT, status: "running", outcome: null, erro: null, resumo: null,
  startedAt: new Date().toISOString(), page: location.pathname + location.search, params: Object.fromEntries(params),
  epoch: params.get("epoch") !== null ? { n: Number(params.get("epoch")), reason: params.get("epocamotivo"), before: (params.get("antes") || "").split(",").filter(Boolean) } : null,
  aparelho: PHONE ? "celular" : "desktop", teto: null, environment: null, steps: [], phases: {}, timings: {},
  ledger: lab ? { method: "lab/hook.js (WebGPU and WebAssembly prototypes wrapped)", start: lab.ledger.snapshot(32) } : null,
};

function log(line) {
  console.info(`[memoria] ${line}`);
  const pre = $("log");
  if (pre) pre.textContent = `${(performance.now() / 1000).toFixed(1)}s ${line}\n${pre.textContent}`.slice(0, 8000);
}
const status = (text) => { const el = $("status"); if (el) el.textContent = text; };

// Every marker also checkpoints the report: if the step that follows kills the tab, the lab writes
// the result with everything measured until then.
function mark(data, options = {}) {
  checkpoint();
  const payload = { exp: EXP, variante: VARIANT, ...data };
  if (lab) return lab.mark(payload, options);
  try { localStorage.setItem("somLab.marker", JSON.stringify({ step: null, at: new Date().toISOString(), data: payload })); } catch { /* blocked */ }
  return null;
}
// What the lab keeps if the tab dies: the whole report so far (without the ledger snapshots, which
// the last marker carries in short), in localStorage.
function checkpoint() {
  if (!lab) return;
  const { ledger, ...rest } = report;
  lab.checkpoint({ ...rest, steps: report.steps.slice(-200) });
}

// Incompressible filler. iOS and macOS compress memory, and pages of a constant compress to almost
// nothing, which would let a ramp go far past what real weights can hold. A 4 MiB block of xorshift
// output, copied over and over, is random within every page.
let RANDOM = null;
function randomBlock() {
  if (RANDOM) return RANDOM;
  const words = new Uint32Array(CHUNK / 4);
  let x = ((Math.random() * 0xffffffff) >>> 0) || 0x9e3779b9;
  for (let i = 0; i < words.length; i++) {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    words[i] = x;
  }
  RANDOM = new Uint8Array(words.buffer);
  return RANDOM;
}
function fillRandom(target) {
  const block = randomBlock();
  for (let offset = 0; offset < target.length; offset += block.length) {
    const n = Math.min(block.length, target.length - offset);
    target.set(n === block.length ? block : block.subarray(0, n), offset);
  }
}

// Caps: none on phones (until an error or the death); on desktop, the Mac mini stays healthy.
const DESKTOP_CAP = { gpu: 3 * GiB, host: 2 * GiB, escrita: 2 * GiB };
const PHONE_CAP = { gpu: null, host: null, escrita: 8 * GiB };
function capFor(kind) {
  const given = params.get("teto");
  if (given !== null && given !== "") {
    const value = Number(given);
    return value > 0 ? { bytes: value * MiB, motivo: `parâmetro teto=${given} MiB` } : { bytes: null, motivo: "parâmetro teto=0: sem teto" };
  }
  const bytes = (PHONE ? PHONE_CAP : DESKTOP_CAP)[kind];
  return { bytes, motivo: PHONE ? (bytes ? `padrão de celular (${kind})` : "celular: sem teto, até falhar ou morrer") : `padrão de desktop (${kind}), para o Mac mini continuar saudável` };
}

let adapterCache = null;
async function describe() {
  const env = {
    userAgent: ua, platform: navigator.platform, vendor: navigator.vendor, language: navigator.language, hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: navigator.deviceMemory ?? null, maxTouchPoints: navigator.maxTouchPoints, screen: { width: screen.width, height: screen.height, devicePixelRatio },
    isSecureContext, crossOriginIsolated, userAgentData: navigator.userAgentData ? { mobile: navigator.userAgentData.mobile, platform: navigator.userAgentData.platform, brands: navigator.userAgentData.brands } : null,
    apis: {
      sharedArrayBuffer: typeof SharedArrayBuffer === "function", weakRef: typeof WeakRef === "function", finalizationRegistry: typeof FinalizationRegistry === "function",
      performanceMemory: !!performance.memory, measureUserAgentSpecificMemory: typeof performance.measureUserAgentSpecificMemory === "function",
      opfs: typeof navigator.storage?.getDirectory === "function", createWritable: typeof FileSystemFileHandle === "function" && "createWritable" in FileSystemFileHandle.prototype,
      syncAccessHandleInterface: typeof FileSystemSyncAccessHandle === "function",
    },
  };
  try { env.storage = { estimate: await navigator.storage?.estimate?.() ?? null, persisted: await navigator.storage?.persisted?.() ?? null }; } catch (error) { env.storage = { error: errorText(error) }; }
  if (performance.memory) env.performanceMemory = { jsHeapSizeLimit: performance.memory.jsHeapSizeLimit, totalJSHeapSize: performance.memory.totalJSHeapSize, usedJSHeapSize: performance.memory.usedJSHeapSize };
  env.webgpu = { navigatorGpu: !!navigator.gpu };
  if (navigator.gpu) {
    try { env.webgpu.wgslLanguageFeatures = navigator.gpu.wgslLanguageFeatures ? [...navigator.gpu.wgslLanguageFeatures].sort() : null; } catch (error) { env.webgpu.wgslError = errorText(error); }
    try {
      const adapter = await navigator.gpu.requestAdapter();
      adapterCache = adapter;
      if (adapter) {
        const info = adapter.info ?? {};
        const limits = {};
        for (const key in adapter.limits) limits[key] = adapter.limits[key];
        env.webgpu.adapter = {
          info: { vendor: info.vendor, architecture: info.architecture, device: info.device, description: info.description, isFallbackAdapter: info.isFallbackAdapter ?? adapter.isFallbackAdapter ?? null, subgroupMinSize: info.subgroupMinSize ?? null, subgroupMaxSize: info.subgroupMaxSize ?? null },
          features: [...adapter.features].sort(), limits,
        };
      } else env.webgpu.adapter = null;
    } catch (error) { env.webgpu.error = errorText(error); }
  }
  return env;
}

// A device from the adapter of describe() (an adapter gives one device), else a new adapter.
async function getDevice(wanted = {}) {
  let adapter = adapterCache;
  adapterCache = null;
  if (!adapter) adapter = navigator.gpu ? await navigator.gpu.requestAdapter() : null;
  if (!adapter) throw new Error("WebGPU indisponível: requestAdapter() devolveu null ou navigator.gpu não existe");
  const requiredLimits = {};
  for (const [key, value] of Object.entries(wanted)) if (adapter.limits[key] !== undefined) requiredLimits[key] = Math.min(value, adapter.limits[key]);
  const device = await adapter.requestDevice({ requiredLimits });
  const rec = { requiredLimits, lost: null, uncaptured: [] };
  device.lost.then((info) => {
    rec.lost = { reason: info?.reason, message: info?.message, t: round(performance.now()) };
    if (info?.reason !== "destroyed") log(`device lost: ${info?.reason} ${info?.message}`);
  });
  device.addEventListener("uncapturederror", (event) => { if (rec.uncaptured.length < 20) rec.uncaptured.push(errorText(event.error)); });
  (report.devices ??= []).push(rec);
  return { device, rec };
}

// ------------------------------------------------------------------------------------------------
// X3: GPU buffers of 64 MiB until the end.
async function gpuRamp() {
  const STEP = 64 * MiB;
  const cap = capFor("gpu");
  report.teto = cap;
  let held = null;
  if (VARIANT === "ab256" || VARIANT === "wasm256") {
    mark({ fase: "pre", MiB: 256 }, { announce: true, text: `comprometendo 256 MiB antes da rampa (${VARIANT})` });
    const started = performance.now();
    const descriptor = VARIANT === "wasm256" ? { initial: 4096, maximum: 4096 } : null;
    try {
      if (VARIANT === "ab256") {
        const buffer = new ArrayBuffer(256 * MiB);
        fillRandom(new Uint8Array(buffer));
        held = buffer;
      } else {
        const memory = new WebAssembly.Memory(descriptor);
        fillRandom(new Uint8Array(memory.buffer));
        held = memory;
      }
      report.phases.pre = { kind: VARIANT, bytes: 256 * MiB, descriptor, ms: round(performance.now() - started) };
    } catch (error) {
      report.phases.pre = { kind: VARIANT, descriptor, error: errorText(error), ms: round(performance.now() - started) };
      return { outcome: "erro", erro: `não comprometeu os 256 MiB (${VARIANT}): ${errorText(error)}`, resumo: `${VARIANT}: a pré-alocação falhou (${errorText(error)})` };
    }
    checkpoint();
  }
  const { device, rec } = await getDevice({ maxBufferSize: Number.MAX_SAFE_INTEGER });
  const buffers = [];
  let total = 0;
  let stop = null;
  for (let i = 0; ; i++) {
    if (cap.bytes && total + STEP > cap.bytes) { stop = "teto"; break; }
    if (rec.lost) { stop = "lost"; break; }
    mark({ fase: "gpu", i, confirmadoMiB: mibOf(total), alvoMiB: mibOf(total + STEP) }, { announce: i % 4 === 0, text: `GPU passo ${i}: ${mibOf(total)} → ${mibOf(total + STEP)} MiB` });
    status(`GPU: ${mibOf(total)} MiB`);
    device.pushErrorScope("out-of-memory");
    device.pushErrorScope("validation");
    const t0 = performance.now();
    let buffer = null;
    let thrown = null;
    try {
      buffer = device.createBuffer({ size: STEP, usage: GPUBufferUsage.STORAGE, mappedAtCreation: true });
      fillRandom(new Uint8Array(buffer.getMappedRange()));
      buffer.unmap();
    } catch (error) { thrown = error; }
    const t1 = performance.now();
    const validation = await device.popErrorScope();
    const oom = await device.popErrorScope();
    if (thrown || oom || validation) {
      try { buffer?.destroy(); } catch { /* invalid buffer */ }
      const why = thrown ? errorText(thrown) : oom ? `GPUOutOfMemoryError: ${oom.message}` : `GPUValidationError: ${validation.message}`;
      report.steps.push({ i, totalMiB: mibOf(total), createFillMs: round(t1 - t0), erro: why });
      report.erro = why;
      stop = "erro";
      break;
    }
    buffers.push(buffer);
    total += STEP;
    await device.queue.onSubmittedWorkDone();
    const t2 = performance.now();
    report.steps.push({ i, totalMiB: mibOf(total), createFillMs: round(t1 - t0), waitMs: round(t2 - t1) });
    report.maiorAlocacaoOkBytes = total;
    checkpoint();
  }
  if (report.ledger) report.ledger.peak = lab.ledger.snapshot(16);
  // Read the pre-allocation after the loop, so no engine can treat it as dead during the ramp.
  if (report.phases.pre) report.phases.pre.heldUntilEnd = held ? (held.byteLength ?? held.buffer.byteLength) : 0;
  for (const buffer of buffers) buffer.destroy();
  device.destroy();
  held = null;
  const pre = report.phases.pre ? ` depois de ${VARIANT === "ab256" ? "256 MiB num ArrayBuffer" : "256 MiB numa memória Wasm"}` : "";
  if (stop === "teto") return { outcome: "completou", resumo: `chegou ao teto de ${mibOf(cap.bytes)} MiB de GPU${pre} sem falhar` };
  if (stop === "lost") return { outcome: "erro", erro: `device lost: ${rec.lost.reason} ${rec.lost.message}`, resumo: `dispositivo perdido com ${mibOf(total)} MiB de GPU${pre}` };
  return { outcome: "erro", erro: report.erro, resumo: `${mibOf(total)} MiB de GPU funcionaram${pre}; o passo seguinte deu ${report.erro}` };
}

// The same with ArrayBuffers on the host.
async function hostRamp() {
  const STEP = 64 * MiB;
  const cap = capFor("host");
  report.teto = cap;
  const keep = [];
  let total = 0;
  let stop = null;
  for (let i = 0; ; i++) {
    if (cap.bytes && total + STEP > cap.bytes) { stop = "teto"; break; }
    mark({ fase: "host", i, confirmadoMiB: mibOf(total), alvoMiB: mibOf(total + STEP) }, { announce: i % 4 === 0, text: `host passo ${i}: ${mibOf(total)} → ${mibOf(total + STEP)} MiB` });
    status(`host: ${mibOf(total)} MiB`);
    const t0 = performance.now();
    try {
      const buffer = new ArrayBuffer(STEP);
      fillRandom(new Uint8Array(buffer));
      keep.push(buffer);
    } catch (error) {
      report.erro = errorText(error);
      report.steps.push({ i, totalMiB: mibOf(total), ms: round(performance.now() - t0), erro: report.erro });
      stop = "erro";
      break;
    }
    total += STEP;
    report.steps.push({ i, totalMiB: mibOf(total), ms: round(performance.now() - t0) });
    report.maiorAlocacaoOkBytes = total;
    checkpoint();
    if (i % 4 === 3) await sleep(0);
  }
  keep.length = 0;
  if (stop === "teto") return { outcome: "completou", resumo: `chegou ao teto de ${mibOf(cap.bytes)} MiB de ArrayBuffer sem falhar` };
  return { outcome: "erro", erro: report.erro, resumo: `${mibOf(total)} MiB de ArrayBuffer funcionaram; o passo seguinte deu ${report.erro}` };
}

// ------------------------------------------------------------------------------------------------
// X1/X2: Wasm memory slots.
const VARIANTS = {
  ort: { initial: 256, maximum: 65536, shared: true },   // exactly ONNX Runtime's call
  naoCompart: { initial: 256, maximum: 65536 },          // the same, not shared
  max1g: { initial: 256, maximum: 16384, shared: true }, // maximum of 1 GiB
  minima: { initial: 1, maximum: 1 },                    // 64 KiB
  shim: { initial: 0, maximum: 0, shared: true },        // the 0/0 memory of the Emscripten glue
};
function countMemories(descriptor, label, max = 16) {
  const held = [];
  const attempts = [];
  let error = null;
  for (let k = 1; k <= max; k++) {
    mark({ fase: label, k }, { ledger: k === 1, text: `${label}: memória ${k} de até ${max} (${held.length} criadas)` });
    const t0 = performance.now();
    try {
      held.push(new WebAssembly.Memory(descriptor));
      attempts.push({ k, ok: true, ms: round(performance.now() - t0) });
    } catch (e) {
      error = errorText(e);
      attempts.push({ k, ok: false, ms: round(performance.now() - t0), error });
      break;
    }
  }
  log(`${label}: ${held.length} ok${error ? `; ${error}` : ""}`);
  return { label, descriptor, ok: held.length, max, error, attempts, held, ledger: lab?.ledger.summary().wasm ?? null };
}
const strip = (count) => { const { held, ...rest } = count; return rest; };
// Pressure on the collector: allocate and drop 64 MiB ArrayBuffers (they count as extra memory for
// the collector even untouched); then a turn of the event loop, so finalizers can run.
async function pressure(label, n = 8) {
  const t0 = performance.now();
  let made = 0;
  let error = null;
  for (let i = 0; i < n; i++) {
    try {
      let buffer = new ArrayBuffer(64 * MiB);
      new Uint8Array(buffer)[i] = 1;
      buffer = null;
      made += 1;
    } catch (e) { error = errorText(e); break; }
    await sleep(0);
  }
  await sleep(50);
  return { label, mib: made * 64, ms: round(performance.now() - t0), error, wasmLedger: lab?.ledger.summary().wasm ?? null };
}
async function waitUntil(t0, seconds) {
  const wait = t0 + seconds * 1000 - performance.now();
  if (wait > 0) await sleep(wait);
}

async function slots() {
  const descriptor = VARIANTS[VARIANT];
  if (!descriptor) return { outcome: "erro", erro: `variante desconhecida: ${VARIANT}`, resumo: `variante desconhecida ${VARIANT}` };
  report.descriptor = descriptor;
  mark({ fase: "contagem", k: 0 }, { announce: true, text: `vagas ${VARIANT}: contando até 16 memórias ${JSON.stringify(descriptor)}` });
  const first = countMemories(descriptor, "contagem");
  report.contagem = strip(first);
  checkpoint();
  // With this variant's memories still held: how many of ONNX Runtime's still fit.
  if (VARIANT !== "ort") {
    const ort = countMemories(VARIANTS.ort, "ort-com-estas-presas", 4);
    report.ortComEstasPresas = strip(ort);
    ort.held.length = 0;
    checkpoint();
  }
  if (VARIANT === "ort") await release(first);
  first.held.length = 0;
  const tail = first.error ? `; a ${first.ok + 1}ª deu ${first.error}` : ` (o máximo testado, sem erro)`;
  return { outcome: first.error ? "erro" : "completou", erro: first.error, resumo: `${VARIANT}: ${first.ok} memória(s)${tail}` };
}

// X2, after exhausting ONNX Runtime's slots.
async function release(first) {
  const out = { semReferencias: [], pressao: [] };
  report.liberacao = out;
  first.held.length = 0;
  const t0 = performance.now();
  out.pressao.push(await pressure("logo depois de soltar as referências"));
  for (const seconds of [1, 10, 60]) {
    await waitUntil(t0, seconds);
    status(`liberação: ${seconds} s`);
    mark({ fase: `liberacao-${seconds}s` }, { announce: true, text: `vagas ort: nova contagem ${seconds} s depois de soltar` });
    const count = countMemories(VARIANTS.ort, `liberacao-${seconds}s`);
    out.semReferencias.push({ seconds, ...strip(count) });
    count.held.length = 0;
    out.pressao.push(await pressure(`depois da contagem de ${seconds} s`));
    checkpoint();
  }
  // Worker variant: create in a dedicated Worker, terminate it, count in the page.
  mark({ fase: "worker" }, { announce: true, text: "vagas ort: memórias num Worker, terminate() e nova contagem na página" });
  status("Worker…");
  const worker = new Worker(scriptUrl("/lab/wasm-worker.js"));
  const inWorker = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ error: "the Worker did not answer in 30 s" }), 30000);
    worker.onmessage = (event) => { clearTimeout(timer); resolve(event.data); };
    worker.onerror = (event) => { clearTimeout(timer); resolve({ error: `worker error: ${event.message}` }); };
    worker.postMessage({ desc: VARIANTS.ort, max: 16 });
  });
  worker.terminate();
  const t1 = performance.now();
  const afterTerminate = [];
  for (const seconds of [0, 1, 10]) {
    await waitUntil(t1, seconds);
    const count = countMemories(VARIANTS.ort, `pagina-apos-terminate-${seconds}s`);
    afterTerminate.push({ seconds, ...strip(count) });
    count.held.length = 0;
    out.pressao.push(await pressure(`depois da contagem de ${seconds} s após terminate()`));
  }
  out.worker = { noWorker: inWorker, paginaAposTerminate: afterTerminate };
  checkpoint();
}

// X2: the next lab step (a same-site navigation) counts again.
async function slotsAfterNavigation() {
  report.descriptor = VARIANTS.ort;
  mark({ fase: "apos-navegacao" }, { announce: true, text: "vagas ort: contagem depois da navegação" });
  const first = countMemories(VARIANTS.ort, "apos-navegacao");
  report.contagem = strip(first);
  first.held.length = 0;
  const p = await pressure("depois da contagem");
  checkpoint();
  await sleep(10000);
  const second = countMemories(VARIANTS.ort, "apos-navegacao-10s");
  report.contagem10s = { ...strip(second), pressao: p };
  second.held.length = 0;
  return { outcome: "completou", resumo: `depois da navegação: ${first.ok} memória(s) ort${first.error ? ` (${first.error})` : ""}; 10 s e pressão depois: ${second.ok}` };
}

// ------------------------------------------------------------------------------------------------
// The GPU process's tolerance to queue.writeBuffer in flight (research/04, open question).
async function gpuWrites() {
  const cap = capFor("escrita");
  report.teto = cap;
  const volume = cap.bytes ?? 8 * GiB;
  const SLOTS = 4;
  const data = randomBlock();
  let { device, rec } = await getDevice({ maxBufferSize: 256 * MiB });
  const make = (d) => Array.from({ length: SLOTS }, () => d.createBuffer({ size: GROUP, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }));
  let buffers = make(device);
  // Phase 1, awaiting the queue every 64 MiB: the safe throughput, measured first.
  mark({ fase: "com-espera", MiB: 0 }, { announce: true, text: `writeBuffer com espera a cada 64 MiB, até ${mibOf(volume)} MiB` });
  status("writeBuffer com espera…");
  let written = 0;
  let waitMs = 0;
  let callMs = 0;
  const groupsA = [];
  let groupStart = performance.now();
  const tA = performance.now();
  for (let k = 0; written < volume && !rec.lost; k++) {
    const tc = performance.now();
    device.queue.writeBuffer(buffers[(k >> 4) % SLOTS], (k & 15) * CHUNK, data);
    callMs += performance.now() - tc;
    written += CHUNK;
    if (written % GROUP === 0) {
      if (written % GiB === 0) mark({ fase: "com-espera", MiB: mibOf(written) }, { announce: true, text: `com espera: ${mibOf(written)} MiB` });
      const tw = performance.now();
      await device.queue.onSubmittedWorkDone();
      waitMs += performance.now() - tw;
      groupsA.push(round(performance.now() - groupStart));
      groupStart = performance.now();
    }
  }
  const msA = performance.now() - tA;
  report.phases.comEspera = { bytes: written, ms: round(msA), callMs: round(callMs), waitMs: round(waitMs), mbps: mbps(written, msA), groupMs: stats(groupsA), lost: rec.lost };
  checkpoint();
  if (rec.lost) {
    ({ device, rec } = await getDevice({ maxBufferSize: 256 * MiB }));
    buffers = make(device);
  }
  // Phase 2, without awaiting: everything queued, a marker every 64 MiB and a turn of the event loop
  // (so device.lost can arrive), then one wait for the queue to drain.
  mark({ fase: "sem-espera", MiB: 0 }, { announce: true, text: `writeBuffer SEM espera, até ${mibOf(volume)} MiB` });
  status("writeBuffer sem espera…");
  written = 0;
  callMs = 0;
  const tB = performance.now();
  for (let k = 0; written < volume; k++) {
    const tc = performance.now();
    device.queue.writeBuffer(buffers[(k >> 4) % SLOTS], (k & 15) * CHUNK, data);
    callMs += performance.now() - tc;
    written += CHUNK;
    if (written % GROUP === 0) {
      mark({ fase: "sem-espera", enfileiradoMiB: mibOf(written) }, { announce: written % GiB === 0, ledger: false, text: `sem espera: ${mibOf(written)} MiB enfileirados` });
      await sleep(0);
      if (rec.lost) break;
    }
  }
  const enqueueMs = performance.now() - tB;
  mark({ fase: "drenando", enfileiradoMiB: mibOf(written) }, { announce: true, text: `drenando a fila (${mibOf(written)} MiB)` });
  const tD = performance.now();
  await device.queue.onSubmittedWorkDone();
  const drainMs = performance.now() - tD;
  report.phases.semEspera = {
    bytes: written, enqueueMs: round(enqueueMs), callMs: round(callMs), drainMs: round(drainMs), mbpsEnfileirar: mbps(written, enqueueMs),
    mbpsEfetivo: mbps(written, enqueueMs + drainMs), lost: rec.lost,
  };
  report.phaseOrder = ["comEspera", "semEspera"];
  for (const buffer of buffers) buffer.destroy();
  device.destroy();
  const lost = report.phases.comEspera.lost || report.phases.semEspera.lost;
  if (lost && lost.reason !== "destroyed") return { outcome: "erro", erro: `device lost: ${lost.reason} ${lost.message}`, resumo: `dispositivo perdido (${lost.reason}) com writeBuffer em voo` };
  return { outcome: "completou", resumo: `com espera ${report.phases.comEspera.mbps} MB/s; sem espera ${mibOf(written)} MiB enfileirados a ${report.phases.semEspera.mbpsEnfileirar} MB/s, drenados em ${round(drainMs, 0)} ms; sem perda do dispositivo` };
}

function stats(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.round((s.length - 1) * p))];
  return { n: s.length, min: s[0], p50: q(0.5), p95: q(0.95), max: s[s.length - 1] };
}

// ------------------------------------------------------------------------------------------------
// X5: OPFS → GPU.
function rpcFor(worker) {
  let next = 0;
  const pending = new Map();
  worker.onmessage = (event) => {
    const reply = event.data || {};
    const entry = pending.get(reply.id);
    if (!entry) return;
    pending.delete(reply.id);
    if (reply.error) {
      const error = new Error(reply.error);
      error.buf = reply.buf;
      entry.reject(error);
    } else entry.resolve(reply);
  };
  worker.onerror = (event) => { for (const entry of pending.values()) entry.reject(new Error(`opfs worker: ${event.message}`)); pending.clear(); };
  return (message, transfer = []) => new Promise((resolve, reject) => {
    const id = ++next;
    pending.set(id, { resolve, reject });
    worker.postMessage({ ...message, id }, transfer);
  });
}

const KERNEL = `
@group(0) @binding(0) var<storage, read> data: array<vec4<u32>>;
@group(0) @binding(1) var<storage, read_write> sums: array<u32>;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let threads = 65536u;
  let n = arrayLength(&data);
  var acc = 0u;
  for (var i = gid.x; i < n; i = i + threads) {
    let v = data[i];
    acc = acc + v.x + v.y + v.z + v.w;
  }
  sums[gid.x] = sums[gid.x] + acc;
}`;
function makeKernel(device) {
  const module = device.createShaderModule({ code: KERNEL });
  const pipeline = device.createComputePipeline({ layout: "auto", compute: { module, entryPoint: "main" } });
  const sums = device.createBuffer({ size: 65536 * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
  const readback = device.createBuffer({ size: 65536 * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
  const groups = new Map();
  return {
    reset() { device.queue.writeBuffer(sums, 0, new Uint32Array(65536)); },
    dispatch(slab) {
      if (!groups.has(slab)) groups.set(slab, device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: slab } }, { binding: 1, resource: { buffer: sums } }] }));
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, groups.get(slab));
      pass.dispatchWorkgroups(256);
      pass.end();
      device.queue.submit([encoder.finish()]);
    },
    async total() {
      const encoder = device.createCommandEncoder();
      encoder.copyBufferToBuffer(sums, 0, readback, 0, 65536 * 4);
      device.queue.submit([encoder.finish()]);
      await readback.mapAsync(GPUMapMode.READ);
      const words = new Uint32Array(readback.getMappedRange().slice(0));
      readback.unmap();
      let sum = 0;
      for (let i = 0; i < words.length; i++) sum = (sum + words[i]) >>> 0;
      return sum;
    },
    destroy() { sums.destroy(); readback.destroy(); },
  };
}
// The sum of every 32-bit word of a file written by the worker (chunk k holds k + 1), mod 2^32.
function expectedSum(bytes) {
  let sum = 0;
  for (let k = 0; k * CHUNK < bytes; k++) sum = (sum + Math.imul(Math.min(CHUNK, bytes - k * CHUNK) / 4, k + 1)) >>> 0;
  return sum;
}

// One pass over a file: the worker reads 4 MiB chunks (up to DEPTH in flight, buffers lent back and
// forth), the page writes them to the GPU where target() says, waiting for the queue every 64 MiB.
const DEPTH = 4;
async function streamPass({ rpc, name, bytes, device, rec, target, kernel, label, mode }) {
  const opened = await rpc({ cmd: "open", name, mode });
  const pool = Array.from({ length: DEPTH + 1 }, () => new ArrayBuffer(CHUNK));
  const inflight = new Map();
  let next = 0;
  let readMs = 0;
  let callMs = 0;
  let waitMs = 0;
  const groupMs = [];
  if (kernel) kernel.reset();
  const t0 = performance.now();
  let groupStart = t0;
  for (let at = 0; at < bytes; at += CHUNK) {
    while (next < bytes && inflight.size < DEPTH) {
      const buf = pool.pop() ?? new ArrayBuffer(CHUNK);
      inflight.set(next, rpc({ cmd: "read", at: next, n: Math.min(CHUNK, bytes - next), buf }, [buf]));
      next += CHUNK;
    }
    const chunk = await inflight.get(at);
    inflight.delete(at);
    readMs += chunk.ms;
    const { buffer, offset } = target(at);
    const tc = performance.now();
    device.queue.writeBuffer(buffer, offset, chunk.buf, 0, chunk.n);
    callMs += performance.now() - tc;
    pool.push(chunk.buf);
    const done = at + CHUNK;
    if (done % GROUP === 0 || done >= bytes) {
      if (kernel) kernel.dispatch(buffer);
      mark({ fase: label, MiB: mibOf(Math.min(done, bytes)) }, { ledger: false });
      const tw = performance.now();
      await device.queue.onSubmittedWorkDone();
      waitMs += performance.now() - tw;
      groupMs.push(round(performance.now() - groupStart));
      groupStart = performance.now();
      if (rec.lost) throw new Error(`device lost: ${rec.lost.reason} ${rec.lost.message}`);
    }
  }
  const wallMs = performance.now() - t0;
  await rpc({ cmd: "close" });
  const result = {
    path: opened.path, bytes, wallMs: round(wallMs), readMs: round(readMs), writeCallMs: round(callMs), waitMs: round(waitMs),
    mbps: { leituraOPFS: mbps(bytes, readMs), envioGPU: mbps(bytes, callMs + waitMs), pontaAPonta: mbps(bytes, wallMs) }, groupMs: stats(groupMs),
  };
  if (kernel) {
    const got = await kernel.total();
    result.kernel = { soma: got, esperada: expectedSum(bytes), confere: got === expectedSum(bytes) };
  }
  return result;
}

const fileName = (mib) => `som-lab-${mib}.bin`;
function sizesMiB() {
  return (params.get("tamanhos") || "512,1024").split(",").map((v) => Number(v)).filter((v) => v > 0 && v % 64 === 0);
}

async function opfsStreaming() {
  const worker = new Worker(scriptUrl("/lab/opfs-worker.js"));
  const rpc = rpcFor(worker);
  const mode = params.get("leitura") === "stream" ? "stream" : "auto";
  report.phases.capacidades = await rpc({ cmd: "probe" });
  report.phases.leituraPedida = mode;
  const { device, rec } = await getDevice({ maxBufferSize: 256 * MiB });
  const kernel = params.get("kernel") === "0" ? null : makeKernel(device);
  const summary = [];
  try {
    for (const mib of sizesMiB()) {
      const name = fileName(mib);
      const bytes = mib * MiB;
      const entry = (report.phases[`${mib}MiB`] = {});
      mark({ fase: "escrita", mib }, { announce: true, text: `OPFS: escrevendo ${mib} MiB` });
      status(`OPFS: escrevendo ${mib} MiB`);
      entry.escrita = await rpc({ cmd: "write", name, bytes, chunk: CHUNK });
      entry.escrita.mbps = mbps(bytes, entry.escrita.ms);
      checkpoint();
      // (ii) out-of-core: a ring of 3 × 64 MiB slabs, reused; 3 full passes; a kernel reads each slab.
      const ring = Array.from({ length: 3 }, () => device.createBuffer({ size: GROUP, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }));
      entry.anel = { slabs: 3, slabMiB: 64, kernel: !!kernel, passes: [] };
      for (let pass = 1; pass <= 3; pass++) {
        mark({ fase: "anel", mib, pass }, { announce: true, text: `OPFS → GPU: anel 3 × 64 MiB, passada ${pass} de ${mib} MiB` });
        status(`anel: passada ${pass} de ${mib} MiB`);
        const result = await streamPass({ rpc, name, bytes, device, rec, kernel, label: `anel-${mib}-${pass}`, mode, target: (at) => ({ buffer: ring[Math.floor(at / GROUP) % 3], offset: at % GROUP }) });
        entry.anel.passes.push({ pass, ...result, mbpsPassada: mbps(bytes, result.wallMs) });
        checkpoint();
      }
      for (const buffer of ring) buffer.destroy();
      // (i) resident: slabs of up to 256 MiB covering the whole file.
      const slabSize = Math.min(256 * MiB, device.limits.maxBufferSize);
      mark({ fase: "placas", mib }, { announce: true, text: `OPFS → GPU: ${Math.ceil(bytes / slabSize)} placa(s) de ${mibOf(slabSize)} MiB cobrindo ${mib} MiB` });
      status(`placas: ${mib} MiB residentes`);
      const slabs = Array.from({ length: Math.ceil(bytes / slabSize) }, () => device.createBuffer({ size: slabSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }));
      entry.placas = { slabMiB: mibOf(slabSize), slabs: slabs.length, ...(await streamPass({ rpc, name, bytes, device, rec, kernel: null, label: `placas-${mib}`, mode, target: (at) => ({ buffer: slabs[Math.floor(at / slabSize)], offset: at % slabSize }) })) };
      for (const buffer of slabs) buffer.destroy();
      entry.removido = await rpc({ cmd: "remove", name });
      checkpoint();
      const passes = entry.anel.passes.map((p) => p.mbpsPassada);
      summary.push(`${mib} MiB: escrita ${entry.escrita.mbps} MB/s (${entry.escrita.path.split(" ")[0]}); anel ${passes.join("/")} MB/s por passada; placas ${entry.placas.mbps.pontaAPonta} MB/s ponta a ponta`);
    }
  } finally {
    for (const mib of sizesMiB()) { try { await rpc({ cmd: "remove", name: fileName(mib) }); } catch { /* gone */ } }
    kernel?.destroy();
    device.destroy();
    worker.terminate();
  }
  const bad = Object.values(report.phases).flatMap((p) => (p && p.anel ? p.anel.passes : [])).filter((p) => p.kernel && !p.kernel.confere);
  report.phases.kernelConfere = bad.length === 0;
  return { outcome: "completou", resumo: summary.join(" · ") + (bad.length ? ` · ATENÇÃO: ${bad.length} passada(s) com soma do kernel diferente` : "") };
}

// Today's path: the whole file in one Uint8Array (engines/fetch.js over a blob: URL of the OPFS file:
// chunks, then one concatenated copy), then writeBuffer into 256 MiB slabs.
async function opfsMonolithic() {
  const worker = new Worker(scriptUrl("/lab/opfs-worker.js"));
  const rpc = rpcFor(worker);
  const { device, rec } = await getDevice({ maxBufferSize: 256 * MiB });
  const summary = [];
  try {
    for (const mib of sizesMiB()) {
      const name = fileName(mib);
      const bytes = mib * MiB;
      const entry = (report.phases[`${mib}MiB`] = {});
      mark({ fase: "escrita", mib }, { announce: true, text: `monolítico: escrevendo ${mib} MiB no OPFS` });
      status(`escrevendo ${mib} MiB`);
      entry.escrita = await rpc({ cmd: "write", name, bytes, chunk: CHUNK });
      checkpoint();
      const dir = await navigator.storage.getDirectory();
      const file = await (await dir.getFileHandle(name)).getFile();
      const url = URL.createObjectURL(file);
      mark({ fase: "monolitico-leitura", mib }, { announce: true, text: `monolítico: o arquivo inteiro de ${mib} MiB num Uint8Array (engines/fetch.js)` });
      status(`lendo ${mib} MiB inteiros`);
      const t0 = performance.now();
      let whole = await createFetcher().fetchResource(url, "bytes");
      const readMs = performance.now() - t0;
      URL.revokeObjectURL(url);
      entry.leitura = { bytes: whole.length, ms: round(readMs), mbps: mbps(whole.length, readMs), via: "engines/fetch.js (fetch de blob: URL, pedaços e uma cópia concatenada)" };
      checkpoint();
      const slabSize = Math.min(256 * MiB, device.limits.maxBufferSize);
      const slabs = [];
      const t1 = performance.now();
      for (let offset = 0, i = 0; offset < bytes; offset += slabSize, i++) {
        mark({ fase: "monolitico-envio", mib, placa: i }, { announce: true, text: `monolítico: writeBuffer da placa ${i} (${mibOf(Math.min(slabSize, bytes - offset))} MiB)` });
        const slab = device.createBuffer({ size: slabSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
        slabs.push(slab);
        device.queue.writeBuffer(slab, 0, whole, offset, Math.min(slabSize, bytes - offset));
        await device.queue.onSubmittedWorkDone();
        if (rec.lost) throw new Error(`device lost: ${rec.lost.reason} ${rec.lost.message}`);
      }
      const sendMs = performance.now() - t1;
      entry.envio = { ms: round(sendMs), mbps: mbps(bytes, sendMs), slabs: slabs.length, slabMiB: mibOf(slabSize) };
      entry.pontaAPonta = { ms: round(readMs + sendMs), mbps: mbps(bytes, readMs + sendMs) };
      for (const slab of slabs) slab.destroy();
      whole = null;
      entry.removido = await rpc({ cmd: "remove", name });
      checkpoint();
      summary.push(`${mib} MiB: leitura inteira ${entry.leitura.mbps} MB/s, envio ${entry.envio.mbps} MB/s, ponta a ponta ${entry.pontaAPonta.mbps} MB/s`);
    }
  } finally {
    for (const mib of sizesMiB()) { try { await rpc({ cmd: "remove", name: fileName(mib) }); } catch { /* gone */ } }
    device.destroy();
    worker.terminate();
  }
  return { outcome: "completou", resumo: `sobreviveu: ${summary.join(" · ")}` };
}

// ------------------------------------------------------------------------------------------------
const EXPERIMENTS = {
  "gpu-rampa": gpuRamp, "host-rampa": hostRamp, vagas: slots, "vagas-navegacao": slotsAfterNavigation,
  "gpu-escrita": gpuWrites, "opfs-streaming": opfsStreaming, "opfs-monolitico": opfsMonolithic,
};

async function post() {
  const name = params.get("name");
  if (!name) { log("sem ?name=: resultado só na página"); $("log").textContent = JSON.stringify(report, null, 2); return; }
  const response = await fetch(`/api/results?name=${encodeURIComponent(name)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(report) });
  document.title = response.ok ? "posted" : "post failed";
}

async function main() {
  $("exp").textContent = `${EXP}${VARIANT ? ` · ${VARIANT}` : ""}`;
  const run = EXPERIMENTS[EXP];
  const started = performance.now();
  try {
    report.environment = await describe();
    checkpoint();
    if (!run) throw new Error(`experimento desconhecido: ${EXP} (${Object.keys(EXPERIMENTS).join(", ")})`);
    log(`começou: ${EXP}${VARIANT ? ` ${VARIANT}` : ""}`);
    const result = await run();
    Object.assign(report, result);
  } catch (error) {
    // Not a failure of the lab: what the platform said, verbatim (a missing API is a result too).
    report.outcome = "erro";
    report.erro = errorText(error);
    report.resumo = `erro: ${report.erro}`;
    log(`erro: ${report.erro}`);
  }
  report.status = "ok";
  report.timings.totalMs = round(performance.now() - started);
  report.finishedAt = new Date().toISOString();
  try { report.storageEnd = await navigator.storage?.estimate?.() ?? null; } catch { /* ignore */ }
  if (lab) {
    report.ledger.end = lab.ledger.snapshot(64);
    report.lastMarker = lab.lastMarker();
  }
  status(`${report.outcome}: ${report.resumo ?? ""}`);
  log(`fim: ${report.outcome} — ${report.resumo ?? ""}`);
  await post();
}

main();
