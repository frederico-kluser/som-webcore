#!/usr/bin/env node
// Local server for the T milestone test page. No dependencies.
//
//   node bench/spike-mobile/serve.mjs [--port 8377] [--no-compress]
//
// - Static files from bench/spike-mobile/ (the page, the engines, node_modules).
// - /models/<repo>/<revision>/<file> from the local model cache (see fetch-models.py);
//   /models/derived/<...> from <cache>/derived (files generated from pinned weights).
// - POST /api/results?name=<file> stores the JSON body in bench/results/<file>.json.
// - POST /api/log prints a line (debugging pages on the emulator).
// - Brotli for text, JS and Wasm when the client accepts it, like a CDN; model weights
//   are sent as they are, like the Hugging Face CDN. Every response is no-store, so each
//   run is a first visit. Add ?coi=1 to a page URL to make it cross-origin isolated
//   (COOP + COEP), which the multi-threaded Wasm path needs.
// Binds to 127.0.0.1 (or --host). On the emulator, use `adb reverse tcp:8377 tcp:8377` so the
// page is http://localhost:8377 — a secure context, which the Decisions API requires.
//
// Device lab mode (lab/start-lab.sh sets SOM_LAB_TOKEN and SOM_LAB_SESSION): every request needs the
// session cookie, which GET /lab/enter?t=<token> sets (anything else answers 404); every HTML page gets
// lab/hook.js as its first script; GET/POST /api/lab/state keeps the session state in
// bench/results/<session>-lab.json; POST /api/lab/log appends the pages' logs to <session>-logs.jsonl;
// each request is recorded in <session>-requests.jsonl; files other than HTML may be cached.

import { createServer } from "node:http";
import { appendFileSync, createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, renameSync } from "node:fs";
import { createHash, timingSafeEqual } from "node:crypto";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

const HERE = resolve(fileURLToPath(new URL(".", import.meta.url)));
const ROOT = resolve(HERE, "..", "..");
const RESULTS = join(ROOT, "bench", "results");
const args = process.argv.slice(2);
const PORT = Number(args[args.indexOf("--port") + 1] || 0) || 8377;
const HOST = args.includes("--host") ? args[args.indexOf("--host") + 1] : "127.0.0.1";
const COMPRESS = !args.includes("--no-compress");
const BR_CACHE = join(tmpdir(), "som-spike-br");
const PROGRESS = new Map();

const LAB = process.env.SOM_LAB_TOKEN && process.env.SOM_LAB_SESSION
  ? { token: process.env.SOM_LAB_TOKEN, session: process.env.SOM_LAB_SESSION.replace(/[^A-Za-z0-9._-]/g, ""), errors: 0 }
  : null;
const LAB_FILE = (suffix) => join(RESULTS, `${LAB.session}-${suffix}`);
const QUIET = new Set(["/api/lab/log", "/api/progress", "/api/log"]); // too frequent for the request log

function labCookie(req) {
  const wanted = Buffer.from(`som_lab=${LAB.token}`);
  return String(req.headers.cookie || "").split(/;\s*/).some((c) => {
    const got = Buffer.from(c);
    return got.length === wanted.length && timingSafeEqual(got, wanted);
  });
}

function appendLabLogs(entries) {
  const now = new Date().toISOString();
  appendFileSync(LAB_FILE("logs.jsonl"), entries.map((e) => JSON.stringify({ receivedAt: now, ...e })).join("\n") + "\n");
  for (const e of entries) {
    if (e.level !== "error") continue;
    LAB.errors += 1;
    if (LAB.errors <= 10) console.log(`[lab] ${LAB.session} error ${e.source}: ${String(e.text).split("\n")[0].slice(0, 200)}`);
    else if (LAB.errors === 11) console.log(`[lab] ${LAB.session} more errors (see ${LAB.session}-logs.jsonl)`);
  }
}

// The lab page owns the session state; the server keeps it and prints each change of a step.
async function labState(req, res) {
  const file = LAB_FILE("lab.json");
  if (req.method !== "POST") return send(res, 200, existsSync(file) ? readFileSync(file, "utf8") : { session: LAB.session });
  const next = JSON.parse((await readBody(req, 4 << 20)).toString("utf8"));
  if (next.session !== LAB.session) return send(res, 400, { ok: false, error: "wrong session" });
  const previous = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  writeFileSync(file + ".tmp", JSON.stringify(next, null, 2));
  renameSync(file + ".tmp", file);
  const before = Object.fromEntries((previous.steps || []).map((s) => [s.id, s.status]));
  for (const step of next.steps || []) {
    if (before[step.id] !== step.status) console.log(`[lab] ${LAB.session} step ${step.id} ${step.status}${step.note ? ` (${step.note})` : ""}`);
  }
  if (next.done && !previous.done) console.log(`[lab] ${LAB.session} done`);
  return send(res, 200, { ok: true });
}

function modelCache() {
  if (process.env.SOM_MODEL_CACHE) return process.env.SOM_MODEL_CACHE;
  if (process.platform === "win32" && process.env.LOCALAPPDATA) return join(process.env.LOCALAPPDATA, "som-webcore", "models");
  return join(process.env.HOME || ".", ".cache", "som-webcore", "models");
}

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".wasm": "application/wasm", ".css": "text/css; charset=utf-8",
  ".txt": "text/plain; charset=utf-8", ".map": "application/json", ".onnx": "application/octet-stream",
  ".safetensors": "application/octet-stream", ".bin": "application/octet-stream", ".py": "text/plain; charset=utf-8",
};
const COMPRESSIBLE = new Set([".html", ".js", ".mjs", ".json", ".wasm", ".css", ".txt", ".map"]);
const WEIGHTS = new Set([".onnx", ".safetensors", ".bin"]);

function inside(base, path) {
  const full = resolve(base, "." + sep + normalize(path));
  return full === base || full.startsWith(base + sep) ? full : null;
}

function compressed(file, stat, encoding = "br") {
  const key = createHash("sha256").update(`${file}|${stat.size}|${stat.mtimeMs}`).digest("hex");
  const cached = join(BR_CACHE, `${key}.${encoding === "br" ? "br" : "gz"}`);
  if (existsSync(cached)) return readFileSync(cached);
  const data = encoding === "br"
    ? brotliCompressSync(readFileSync(file), { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: stat.size } })
    : gzipSync(readFileSync(file), { level: 9 });
  mkdirSync(BR_CACHE, { recursive: true });
  writeFileSync(cached + ".tmp", data);
  renameSync(cached + ".tmp", cached);
  return data;
}
const brotli = (file, stat) => compressed(file, stat, "br");

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

function readBody(req, limit = 64 << 20) {
  return new Promise((ok, fail) => {
    const parts = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) { fail(new Error("body too large")); req.destroy(); return; }
      parts.push(chunk);
    });
    req.on("end", () => ok(Buffer.concat(parts)));
    req.on("error", fail);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const common = { "Cache-Control": "no-store", "Cross-Origin-Resource-Policy": "same-origin", "Timing-Allow-Origin": "*" };
  try {
    if (LAB) {
      if (url.pathname === "/lab/enter") {
        const given = Buffer.from(url.searchParams.get("t") || "");
        const token = Buffer.from(LAB.token);
        if (given.length !== token.length || !timingSafeEqual(given, token)) return send(res, 404, { ok: false, error: "not found" });
        const secure = req.headers["x-forwarded-proto"] === "https" || req.socket.encrypted;
        res.writeHead(302, { Location: "/lab/lab.html", "Cache-Control": "no-store", "Set-Cookie": `som_lab=${LAB.token}; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}` });
        console.log(`[lab] ${LAB.session} device entered: ${String(req.headers["user-agent"] || "").slice(0, 160)}`);
        return res.end();
      }
      if (!labCookie(req)) return send(res, 404, { ok: false, error: "not found" });
      // A proxy in front (the Cloudflare tunnel) must pass the bodies as they are: it was sending
      // the brotli Wasm decompressed (14.8 MB instead of 2.5 MB) to a client that accepts brotli.
      const writeHead = res.writeHead;
      res.writeHead = function (status, headers = {}) {
        headers["Cache-Control"] = `${headers["Cache-Control"] || "no-store"}, no-transform`;
        res.labHeaders = headers;
        return writeHead.call(this, status, headers);
      };
      if (!QUIET.has(url.pathname)) {
        const started = Date.now();
        res.on("finish", () => {
          const path = url.pathname + url.search.replace(/([?&])t=[^&]*/g, "$1t=…");
          const sent = res.labHeaders || {};
          appendFileSync(LAB_FILE("requests.jsonl"), JSON.stringify({ at: new Date().toISOString(), method: req.method, path, status: res.statusCode, bytes: Number(sent["Content-Length"]) || null, encoding: sent["Content-Encoding"] || null, ms: Date.now() - started }) + "\n");
        });
      }
      if (url.pathname === "/api/lab/state") return await labState(req, res);
      if (req.method === "POST" && url.pathname === "/api/lab/log") {
        const entries = JSON.parse((await readBody(req, 4 << 20)).toString("utf8"));
        appendLabLogs(Array.isArray(entries) ? entries : [entries]);
        return send(res, 200, { ok: true });
      }
    }
    if (req.method === "POST" && url.pathname === "/api/results") {
      const name = (url.searchParams.get("name") || "").replace(/[^A-Za-z0-9._-]/g, "");
      if (!name) return send(res, 400, { ok: false, error: "missing ?name" });
      const body = await readBody(req);
      JSON.parse(body.toString("utf8")); // must be valid JSON
      mkdirSync(RESULTS, { recursive: true });
      const target = join(RESULTS, name.endsWith(".json") ? name : name + ".json");
      writeFileSync(target + ".tmp", body);
      renameSync(target + ".tmp", target);
      console.log(`[results] ${target} (${body.length} bytes)`);
      return send(res, 200, { ok: true, path: target });
    }
    if (req.method === "POST" && url.pathname === "/api/log") {
      const line = (await readBody(req, 1 << 20)).toString("utf8").slice(0, 4000);
      if (LAB) appendLabLogs([{ at: new Date().toISOString(), source: "page trace", kind: "trace", level: "info", text: line }]);
      else console.log(`[page] ${line}`);
      return send(res, 200, { ok: true });
    }
    // Last stage a page reached, kept in memory: a runner reads it when the page stops answering.
    if (url.pathname === "/api/progress") {
      const name = (url.searchParams.get("name") || "").replace(/[^A-Za-z0-9._-]/g, "");
      if (!name) return send(res, 400, { ok: false, error: "missing ?name" });
      if (req.method === "POST") {
        PROGRESS.set(name, { ...JSON.parse((await readBody(req, 1 << 16)).toString("utf8")), receivedAt: new Date().toISOString() });
        return send(res, 200, { ok: true });
      }
      return PROGRESS.has(name) ? send(res, 200, PROGRESS.get(name)) : send(res, 404, { ok: false });
    }
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { ok: false });

    let file = null;
    if (url.pathname.startsWith("/models/")) {
      file = inside(resolve(modelCache()), decodeURIComponent(url.pathname.slice("/models/".length)));
    } else {
      const path = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
      file = inside(HERE, path.slice(1));
    }
    if (!file || !existsSync(file) || statSync(file).isDirectory()) return send(res, 404, { ok: false, error: "not found" });

    const stat = statSync(file);
    const ext = extname(file).toLowerCase();
    const headers = { ...common, "Content-Type": TYPES[ext] || "application/octet-stream" };
    if (ext === ".html" && url.searchParams.get("coi") === "1") {
      headers["Cross-Origin-Opener-Policy"] = "same-origin";
      headers["Cross-Origin-Embedder-Policy"] = "require-corp";
    }
    if (LAB && ext === ".html") {
      // The log hook first, before any other script of the page.
      const html = readFileSync(file, "utf8");
      const tag = '<script src="/lab/hook.js"></script>';
      const body = Buffer.from(/<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (head) => `${head}\n${tag}`) : `${tag}\n${html}`, "utf8");
      res.writeHead(200, { ...headers, "Content-Length": body.length });
      return res.end(req.method === "HEAD" ? undefined : body);
    }
    // In the device lab, each file crosses the (tunneled) network once per session.
    if (LAB) headers["Cache-Control"] = "private, max-age=86400";
    // Brotli when the browser offers it, gzip otherwise: Safari offers br only over HTTPS, so on
    // http://localhost it gets gzip, as from a CDN that falls back to it.
    const accepts = String(req.headers["accept-encoding"] || "");
    const encoding = /\bbr\b/.test(accepts) ? "br" : /\bgzip\b/.test(accepts) ? "gzip" : null;
    if (COMPRESS && encoding && COMPRESSIBLE.has(ext) && !WEIGHTS.has(ext) && stat.size > 1024) {
      const data = compressed(file, stat, encoding);
      res.writeHead(200, { ...headers, "Content-Encoding": encoding, "Content-Length": data.length, Vary: "Accept-Encoding" });
      return res.end(req.method === "HEAD" ? undefined : data);
    }
    res.writeHead(200, { ...headers, "Content-Length": stat.size });
    if (req.method === "HEAD") return res.end();
    createReadStream(file).pipe(res);
  } catch (error) {
    console.error(`[error] ${req.method} ${req.url}: ${error.message}`);
    if (!res.headersSent) send(res, 500, { ok: false, error: error.message });
  }
});

// Brotli at quality 11 takes tens of seconds for the large Wasm files. Compress them before
// listening (the result is cached on disk), so no measured run pays for the compression.
function precompress() {
  if (!COMPRESS) return;
  const dist = join(HERE, "node_modules", "onnxruntime-web", "dist");
  const files = existsSync(dist) ? readdirSync(dist).filter((f) => /\.(wasm|mjs)$/.test(f)).map((f) => join(dist, f)) : [];
  for (const entry of readdirSync(modelCache(), { recursive: true }).map(String)) {
    if (/(^|[\\/])(tokenizer|tokenizer_config|config)\.json$/.test(entry)) files.push(join(modelCache(), entry));
  }
  const started = Date.now();
  for (const file of files) {
    const stat = statSync(file);
    compressed(file, stat, "br");
    compressed(file, stat, "gzip");
  }
  console.log(`precompressed ${files.length} files (brotli and gzip) in ${((Date.now() - started) / 1000).toFixed(1)} s`);
}

precompress();
server.listen(PORT, HOST, () => {
  console.log(`serve.mjs ready on http://${HOST === "127.0.0.1" ? "localhost" : HOST}:${PORT}/ (models: ${modelCache()}, results: ${RESULTS}, brotli: ${COMPRESS}${LAB ? `, lab session ${LAB.session}` : ""})`);
});
