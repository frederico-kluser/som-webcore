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
// Binds to 127.0.0.1 only. On the emulator, use `adb reverse tcp:8377 tcp:8377` so the
// page is http://localhost:8377 — a secure context, which the Decisions API requires.

import { createServer } from "node:http";
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, renameSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, constants } from "node:zlib";

const HERE = resolve(fileURLToPath(new URL(".", import.meta.url)));
const ROOT = resolve(HERE, "..", "..");
const RESULTS = join(ROOT, "bench", "results");
const args = process.argv.slice(2);
const PORT = Number(args[args.indexOf("--port") + 1] || 0) || 8377;
const COMPRESS = !args.includes("--no-compress");
const BR_CACHE = join(tmpdir(), "som-spike-br");
const PROGRESS = new Map();

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

function brotli(file, stat) {
  const key = createHash("sha256").update(`${file}|${stat.size}|${stat.mtimeMs}`).digest("hex");
  const cached = join(BR_CACHE, key + ".br");
  if (existsSync(cached)) return readFileSync(cached);
  const data = brotliCompressSync(readFileSync(file), {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: stat.size },
  });
  mkdirSync(BR_CACHE, { recursive: true });
  writeFileSync(cached + ".tmp", data);
  renameSync(cached + ".tmp", cached);
  return data;
}

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
      console.log(`[page] ${(await readBody(req, 1 << 20)).toString("utf8").slice(0, 4000)}`);
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
    const accepts = String(req.headers["accept-encoding"] || "");
    if (COMPRESS && COMPRESSIBLE.has(ext) && !WEIGHTS.has(ext) && /\bbr\b/.test(accepts) && stat.size > 1024) {
      const data = brotli(file, stat);
      res.writeHead(200, { ...headers, "Content-Encoding": "br", "Content-Length": data.length, Vary: "Accept-Encoding" });
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
  for (const file of files) brotli(file, statSync(file));
  console.log(`precompressed ${files.length} files in ${((Date.now() - started) / 1000).toFixed(1)} s`);
}

precompress();
server.listen(PORT, "127.0.0.1", () => {
  console.log(`serve.mjs ready on http://localhost:${PORT}/ (models: ${modelCache()}, results: ${RESULTS}, brotli: ${COMPRESS})`);
});
