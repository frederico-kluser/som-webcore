// Device lab, memory profile on ONE page (the owner's "link direto sem sublinks", 2026-11-23): the
// experiments of lab/memoria.js run in sequence in this same page, with no navigation. On the iPhone
// a page killed by jetsam came back with a navigation type that was not "reload" and re-ran its ramp
// ~200 times; so this page never trusts the navigation type (it is kept only as information):
//   - before each experiment it writes {experiment, step, startedAt} to localStorage AND to the server
//     (the lab state, /api/lab/state — awaited, with a sendBeacon fallback);
//   - on load, an experiment recorded as running and not finished died with the tab: it is written as
//     "morreu" with its last marker and what it had measured, marked done, and the page goes on with
//     the NEXT experiment — never the same one again;
//   - more than 3 loads within 60 s stop the page on a "parado" screen, with a button.
// Results go to the usual files (<session>-<step>.json, the lab state, the logs), so analyze.py reads
// them. The test pages of the ONNX Runtime and @johnhenry ledger runs need their own navigation and
// are not here.
import { runExperiment } from "/lab/memoria.js";

const $ = (id) => document.getElementById(id);
const LOCAL = "somLab.unica";
const LOADS = "somLab.unica.loads";
const MEM = (exp, variante = "") => `/lab/memoria.html?exp=${exp}${variante ? `&variante=${variante}` : ""}`;
// Non-crashing first, crash-expected last.
const PLAN = [
  { id: "vagas-shim", exp: "vagas", variant: "shim" },
  { id: "vagas-minima", exp: "vagas", variant: "minima" },
  { id: "vagas-naocompart", exp: "vagas", variant: "naoCompart" },
  { id: "vagas-max1g", exp: "vagas", variant: "max1g" },
  { id: "opfs-streaming", exp: "opfs-streaming" },
  { id: "gpu-escrita", exp: "gpu-escrita", cai: true },
  { id: "gpu-rampa-wasm256", exp: "gpu-rampa", variant: "wasm256", cai: true },
  { id: "opfs-monolitico", exp: "opfs-monolitico", cai: true },
];
const RANK = { pending: 0, running: 1, posted: 2, crashed: 2 };
let state = null;
let wakeLock = null;
let running = false;

function log(line) {
  console.info(`[unica] ${line}`);
  $("log").textContent = `${new Date().toLocaleTimeString()} ${line}\n${$("log").textContent}`.slice(0, 6000);
}
const read = (key) => { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* full or blocked */ } };
async function api(path, body) {
  const response = await fetch(path, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}
// Both places, localStorage first (synchronous); the server write is awaited, with a beacon if it fails.
async function save() {
  state.updatedAt = new Date().toISOString();
  write(LOCAL, state);
  try { await api("/api/lab/state", state); } catch {
    try { navigator.sendBeacon("/api/lab/state", new Blob([JSON.stringify(state)], { type: "application/json" })); } catch { /* offline */ }
  }
}
const epoch = () => state.epochs[state.epochs.length - 1];
function newEpoch(reason) {
  state.epochs.push({ n: state.epochs.length, startedAt: new Date().toISOString(), reason, steps: [], used: false, wasm: false, residuo: false, ort: 0 });
}

function render() {
  $("steps").innerHTML = state.steps.map((s) => `<li class="${s.status}">${s.id} — ${s.status}${s.epoch !== undefined ? ` · p${s.epoch}` : ""}${s.note ? ` (${String(s.note).replace(/</g, "&lt;").slice(0, 200)})` : ""}</li>`).join("");
  const done = state.steps.filter((s) => RANK[s.status] === 2).length;
  if (state.done) $("status").textContent = `Pronto: ${done}/${state.steps.length}. Pode fechar.`;
}

// The newest of the stored and the server state, step by step (a server write can be lost when the
// tab dies right after it).
function merge(server, local) {
  if (!local || local.session !== server.session || !local.unica) return server;
  if (!server.unica) return local;
  const base = (Date.parse(local.updatedAt || 0) > Date.parse(server.updatedAt || 0)) ? local : server;
  const other = base === local ? server : local;
  for (const step of base.steps) {
    const twin = other.steps.find((s) => s.id === step.id);
    if (twin && RANK[twin.status] > RANK[step.status]) Object.assign(step, twin);
  }
  return base;
}

async function settleCrashed() {
  for (const step of state.steps.filter((s) => s.status === "running")) {
    const stored = read("somLab.marker");
    const partial = read("somLab.partial");
    let server = null;
    try { server = (await api("/api/lab/markers"))[step.id] ?? null; } catch { /* none */ }
    const mine = (m) => !!m && m.step === step.id && (!m.at || m.at >= step.startedAt);
    const marker = [stored, server].filter(mine).sort((a, b) => String(b.at).localeCompare(String(a.at)))[0] ?? null;
    const navigation = performance.getEntriesByType("navigation")[0]?.type ?? null;
    const how = `a página voltou com o experimento em andamento (navegação: ${navigation ?? "?"})`;
    const report = {
      ...(mine(partial) ? partial.report : {}), kind: "device-lab-memoria", schemaVersion: 1, experiment: step.exp, variant: step.variant ?? null,
      params: { exp: step.exp, variante: step.variant ?? null, unica: "1" }, status: "crashed", outcome: "morreu", erro: null,
      resumo: `morreu${marker ? ` — último marcador: ${marker.text}` : " (sem marcador)"}`, writtenBy: "lab/memoria-unica.js (a página morreu)",
      lastMarker: marker, lastMarkerSources: { localStorage: mine(stored), servidor: mine(server) },
      death: { how, navigationType: navigation, detectedAt: new Date().toISOString() },
      epoch: { n: step.epoch, reason: step.epochReason, before: step.before }, finishedAt: new Date().toISOString(),
    };
    try { await api(`/api/results?name=${encodeURIComponent(`${state.session}-${step.id}`)}`, report); } catch (error) { log(`falha ao gravar a queda: ${error.message}`); }
    Object.assign(step, { status: "crashed", outcome: "morreu", endedAt: new Date().toISOString(), note: report.resumo, lastMarker: marker ? { n: marker.n, at: marker.at, text: marker.text, data: marker.data } : null });
    newEpoch(`queda em ${step.id}`);
    log(`${step.id}: morreu (${marker ? marker.text : "sem marcador"}); segue para o próximo`);
  }
  await save();
}

async function cleanupOpfs() {
  try {
    const root = await navigator.storage.getDirectory();
    for (const name of ["som-lab-512.bin", "som-lab-1024.bin"]) { try { await root.removeEntry(name); log(`OPFS: removido ${name}`); } catch { /* not there */ } }
  } catch { /* no OPFS */ }
}

async function run() {
  if (running) return;
  running = true;
  $("start").hidden = true;
  $("parado").hidden = true;
  try { wakeLock = await navigator.wakeLock?.request("screen"); } catch (error) { log(`wake lock: ${error.name}`); }
  state.started = true;
  if (!state.epochs.length) newEpoch("início (página única)");
  for (const step of state.steps) {
    if (step.status !== "pending") continue;
    const current = epoch();
    Object.assign(step, { status: "running", startedAt: new Date().toISOString(), attempts: (step.attempts ?? 0) + 1, epoch: current.n, epochReason: current.reason, before: [...current.steps] });
    current.steps.push(step.id);
    current.used = true;
    await save(); // BEFORE the experiment: if it kills the tab, the next load knows
    render();
    $("status").textContent = `${step.id}…`;
    log(`começou ${step.id}`);
    const report = await runExperiment({ exp: step.exp, variant: step.variant ?? null, step: step.id, epoch: { n: step.epoch, reason: step.epochReason, before: step.before }, name: `${state.session}-${step.id}` });
    try { await api(`/api/results?name=${encodeURIComponent(`${state.session}-${step.id}`)}`, report); } catch (error) { log(`falha ao gravar ${step.id}: ${error.message}`); }
    Object.assign(step, { status: "posted", outcome: report.outcome, endedAt: new Date().toISOString(), note: report.resumo });
    await save();
    render();
  }
  state.done = true;
  state.finishedAt = new Date().toISOString();
  await save();
  render();
  running = false;
  try { await wakeLock?.release(); } catch { /* released */ }
}

async function main() {
  const server = await api("/api/lab/state");
  state = merge(server, read(LOCAL));
  if (!state.unica) {
    Object.assign(state, { unica: { version: 1, page: "/lab/memoria-unica.html" }, steps: PLAN.map((s) => ({ ...s, url: MEM(s.exp, s.variant), status: "pending", attempts: 0 })), epochs: [], done: false, started: false });
    delete state.needsRestart;
  }
  // The hard guard: more than 3 loads within 60 s stop here.
  const now = Date.now();
  const loads = (read(LOADS) || []).filter((t) => now - t < 60000).concat(now);
  write(LOADS, loads);
  await settleCrashed();
  await cleanupOpfs();
  render();
  $("reset").hidden = false;
  $("reset").onclick = async () => {
    if (!confirm("Recomeçar do zero? Os resultados já gravados continuam nos arquivos, mas a lista volta ao início.")) return;
    Object.assign(state, { steps: PLAN.map((s) => ({ ...s, url: MEM(s.exp, s.variant), status: "pending", attempts: 0 })), epochs: [], done: false, started: false });
    write(LOADS, []);
    await save();
    location.reload();
  };
  if (state.done) return;
  const button = $("start");
  button.hidden = false;
  button.onclick = () => { write(LOADS, []); run(); };
  if (loads.length > 3) {
    $("parado").hidden = false;
    $("parado").textContent = `Parado: a página carregou ${loads.length} vezes em 60 s. Toque em Continuar para seguir com o próximo experimento.`;
    console.warn(`[unica] stopped: ${loads.length} loads within 60 s`);
    button.textContent = "Continuar";
    $("status").textContent = "parado";
    return;
  }
  if (state.started) {
    // After a crash: on with the next experiment, by itself (the one that died is never re-run).
    button.textContent = "Continuar agora";
    $("status").textContent = "continuando em 3 s…";
    setTimeout(() => run(), 3000);
    return;
  }
  button.textContent = "Começar";
  $("status").textContent = "Toque em Começar";
}

main().catch((error) => { $("status").textContent = `Erro: ${error.message}`; console.error(error); });
