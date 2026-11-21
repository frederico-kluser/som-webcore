// T milestone test harness. Every decision goes through the Decisions API only:
// DecisionModel.availability(), DecisionModel.create(), model.decide(), model.destroy().
// The engine behind `DecisionModel` is chosen by the URL (engines/registry.js).

import { probeEnvironment } from "./env.js";
import { getDecisionModel } from "./engines/registry.js";

const params = new URLSearchParams(location.search);
const config = {
  engine: params.get("engine") || "ort-wasm",
  model: params.get("model") || "ts-ettin-17m",
  variant: params.get("variant") || null,
  threads: Number(params.get("threads") || 1),
  optimization: params.get("opt") || null,
  warmup: Number(params.get("warmup") || 3),
  warm: Number(params.get("warm") || 120),
  endurance: Number(params.get("endurance") || 0),
  lang: params.get("lang") || "all",
  debug: params.get("debug") === "1",
  uaMemory: params.get("uamem") === "1",
};
const logEl = document.getElementById("log");
const statusEl = document.getElementById("status");
const trace = params.get("trace") === "1";
const log = (line) => {
  logEl.textContent += line + "\n";
  if (trace) fetch("/api/log", { method: "POST", body: `${(performance.now() / 1000).toFixed(1)}s ${line}` }).catch(() => {});
};
// Last stage reached, kept by the server: if the page hangs, the runner records where. Never sent
// inside a timed loop.
const progress = (stage, detail = null) => {
  const name = params.get("name");
  if (name) fetch(`/api/progress?name=${encodeURIComponent(name)}`, { method: "POST", body: JSON.stringify({ stage, detail, t: performance.now() }) }).catch(() => {});
};

const report = {
  kind: "spike-mobile-run", schemaVersion: 1, startedAt: new Date().toISOString(), page: location.href, config,
  status: "running", failures: [], timings: {}, latency: {}, memory: [], answers: [],
};

function describeError(error) {
  return { name: error?.name ?? typeof error, message: String(error?.message ?? error) };
}

// Linear interpolation between closest ranks (numpy's default).
function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
function stats(samples) {
  const s = [...samples].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / (s.length || 1);
  return { n: s.length, p50: quantile(s, 0.5), p95: quantile(s, 0.95), p99: quantile(s, 0.99), mean, min: s[0] ?? null, max: s[s.length - 1] ?? null };
}

async function memory(label) {
  const snap = { label, t: performance.now() };
  if (performance.memory) { snap.jsHeapUsed = performance.memory.usedJSHeapSize; snap.jsHeapTotal = performance.memory.totalJSHeapSize; }
  if (config.uaMemory && crossOriginIsolated && performance.measureUserAgentSpecificMemory) {
    try { snap.uaSpecificBytes = (await performance.measureUserAgentSpecificMemory()).bytes; } catch (e) { snap.uaSpecificError = String(e); }
  }
  report.memory.push(snap);
}

function category(url) {
  const path = new URL(url).pathname;
  if (path.startsWith("/models/")) {
    if (/\/(tokenizer|tokenizer_config)\.json$/.test(path)) return "tokenizer";
    if (/\/config\.json$/.test(path)) return "modelConfig";
    return "weights";
  }
  if (path.startsWith("/node_modules/")) return "runtime";
  if (path.startsWith("/engines/") || path.startsWith("/polyfill/")) return "adapter";
  if (path.startsWith("/api/")) return "api";
  return "page";
}
function bytesReport() {
  const out = {};
  for (const e of performance.getEntriesByType("resource")) {
    const c = category(e.name);
    out[c] ??= { transferSize: 0, encodedBodySize: 0, decodedBodySize: 0, files: [] };
    out[c].transferSize += e.transferSize; out[c].encodedBodySize += e.encodedBodySize; out[c].decodedBodySize += e.decodedBodySize;
    out[c].files.push({ path: new URL(e.name).pathname, transferSize: e.transferSize, encodedBodySize: e.encodedBodySize, decodedBodySize: e.decodedBodySize, durationMs: e.duration });
  }
  const sum = (key, cats) => cats.reduce((acc, c) => acc + (out[c]?.[key] ?? 0), 0);
  const firstVisit = ["runtime", "adapter", "weights", "tokenizer", "modelConfig"];
  return {
    method: "Resource Timing; encodedBodySize = bytes on the wire (brotli from serve.mjs for text, JS and Wasm; weights uncompressed)",
    byCategory: out,
    firstVisitEncoded: sum("encodedBodySize", firstVisit),
    firstVisitDecoded: sum("decodedBodySize", firstVisit),
  };
}

async function post() {
  const name = params.get("name");
  if (!name) return;
  const response = await fetch(`/api/results?name=${encodeURIComponent(name)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(report) });
  document.title = response.ok ? "posted" : "post failed";
}

function summarize() {
  const rows = [
    ["engine", `${config.engine} ${report.engineInfo?.variant ?? ""}`],
    ["status", report.status],
    ["time to first answer (ms since navigation)", report.timings.firstAnswerMs?.toFixed(1)],
    ["warm p50 / p95 (ms)", report.latency.warm ? `${report.latency.warm.p50?.toFixed(2)} / ${report.latency.warm.p95?.toFixed(2)}` : "—"],
    ["first-visit bytes (encoded)", report.bytes?.firstVisitEncoded?.toLocaleString()],
    ["failures", report.failures.length],
  ];
  document.getElementById("summary").innerHTML = rows.map(([k, v]) => `<tr><th>${k}</th><td>${v ?? "—"}</td></tr>`).join("");
}

async function main() {
  performance.setResourceTimingBufferSize?.(2000);
  report.timings.navigationToScriptMs = performance.now();
  report.environment = await probeEnvironment();
  const corpus = await (await fetch("corpus.json", { cache: "no-store" })).json();
  const items = corpus.items.filter((i) => config.lang === "all" || i.lang === config.lang);
  await memory("start");

  let binding;
  progress("engine");
  try {
    binding = await getDecisionModel(config);
  } catch (error) {
    report.failures.push({ stage: "engine", error: describeError(error) });
    throw error;
  }
  const { DecisionModel } = binding;

  // ---- From here on: the Decisions API only. ----
  const sessions = new Map();     // schema id -> DecisionModel | null (unavailable)
  const availability = {};
  report.timings.create = [];
  async function session(schemaId) {
    if (sessions.has(schemaId)) return sessions.get(schemaId);
    const schema = corpus.schemas[schemaId];
    try {
      availability[schemaId] = await DecisionModel.availability(schema);
    } catch (error) {
      availability[schemaId] = `error: ${error.name}`;
      report.failures.push({ stage: "availability", schema: schemaId, error: describeError(error) });
      sessions.set(schemaId, null);
      return null;
    }
    if (availability[schemaId] === "unavailable") { sessions.set(schemaId, null); return null; }
    const t0 = performance.now();
    try {
      const progress = [];
      const model = await DecisionModel.create({ ...schema, monitor(m) { m.addEventListener("downloadprogress", (e) => progress.push(e.loaded)); } });
      report.timings.create.push({ schema: schemaId, ms: performance.now() - t0, monitorEvents: progress.length });
      sessions.set(schemaId, model);
      return model;
    } catch (error) {
      report.failures.push({ stage: "create", schema: schemaId, error: describeError(error) });
      sessions.set(schemaId, null);
      return null;
    }
  }

  async function decideItem(item, phase) {
    if (trace) log(`${phase} ${item.id}: session`);
    const model = await session(item.schema);
    if (!model) return { ok: false, skipped: true };
    if (trace) log(`${phase} ${item.id}: decide`);
    const t0 = performance.now();
    try {
      const result = await model.decide(item.input);
      const ms = performance.now() - t0;
      return { ok: true, ms, result, at: performance.now() };
    } catch (error) {
      report.failures.push({ stage: phase, item: item.id, error: describeError(error) });
      return { ok: false, ms: performance.now() - t0, error: describeError(error) };
    }
  }

  // Pass 1: every item once (the first call loads the engine and the model).
  statusEl.textContent = "first pass…";
  for (const item of items) {
    progress("first-pass", item.id);
    const r = await decideItem(item, "first-pass");
    if (r.ok && report.timings.firstAnswerMs === undefined) report.timings.firstAnswerMs = r.at;
    const answer = { item: item.id, lang: item.lang, schema: item.schema, availability: availability[item.schema] };
    if (r.ok) Object.assign(answer, { status: "ok", ms: r.ms, result: r.result });
    else Object.assign(answer, { status: r.skipped ? "skipped" : "failed", error: r.error });
    if (config.debug && binding.encodeForDebug) {
      answer.tokens = Object.fromEntries(corpus.schemas[item.schema].questions.map((q) => [q.id, binding.encodeForDebug(q, item.input)]));
    }
    report.answers.push(answer);
  }
  report.engineInfo = binding.describe();
  report.availability = availability;
  await memory("after-first-pass");
  report.latency.firstPass = stats(report.answers.filter((a) => a.status === "ok").map((a) => a.ms));
  const runnable = items.filter((i) => sessions.get(i.schema));
  log(`first pass: ${report.answers.filter((a) => a.status === "ok").length}/${items.length} answered`);

  // Warm latency: warm-up decisions discarded, then N timed decisions over the corpus, round-robin.
  if (runnable.length && config.warm > 0) {
    statusEl.textContent = "warm latency…";
    progress("warm");
    for (let i = 0; i < config.warmup; i++) await decideItem(runnable[i % runnable.length], "warm-up");
    const samples = [];
    for (let i = 0; i < config.warm; i++) {
      const r = await decideItem(runnable[i % runnable.length], "warm");
      if (r.ok) samples.push(r.ms);
    }
    report.latency.warm = { ...stats(samples), samplesMs: samples };
    await memory("after-warm");
    log(`warm: n=${samples.length} p50=${report.latency.warm.p50?.toFixed(2)} ms p95=${report.latency.warm.p95?.toFixed(2)} ms`);
  }

  // Endurance: M consecutive decisions; failures and memory at the start and at the end.
  if (runnable.length && config.endurance > 0) {
    statusEl.textContent = "endurance…";
    progress("endurance");
    await memory("endurance-start");
    const samples = [];
    let failures = 0;
    for (let i = 0; i < config.endurance; i++) {
      const r = await decideItem(runnable[i % runnable.length], "endurance");
      if (r.ok) samples.push(r.ms); else failures++;
      if ((i + 1) % 50 === 0) await memory(`endurance-${i + 1}`);
    }
    await memory("endurance-end");
    report.latency.endurance = { ...stats(samples), failures, samplesMs: samples };
    log(`endurance: ${samples.length}/${config.endurance} ok, failures=${failures}`);
  }

  for (const model of sessions.values()) model?.destroy();
  // ---- End of the Decisions API part. ----
  report.status = report.answers.some((a) => a.status === "ok") ? "ok" : "failed";
}

main()
  .catch((error) => { report.status = "failed"; report.fatal = describeError(error); log(`fatal: ${error?.stack ?? error}`); })
  .finally(async () => {
    report.bytes = bytesReport();
    report.finishedAt = new Date().toISOString();
    statusEl.textContent = `done: ${report.status}`;
    summarize();
    await post();
  });
