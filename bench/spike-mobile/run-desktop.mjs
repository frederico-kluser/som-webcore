#!/usr/bin/env node
// Opens a page in a desktop Chromium browser with its own profile and waits for the page to
// post its result to serve.mjs. No dependencies (Node >= 22: global WebSocket and fetch).
//
//   node bench/spike-mobile/run-desktop.mjs --browser canary --result 2026-11-21-surface-canary \
//        --url "http://localhost:8377/surface.html?name=2026-11-21-surface-canary" [--click "#go"]
//
// --browser   stable | canary | edge | <path to the executable>          (default: canary)
// --profile   user-data-dir (default: %TEMP%/som-decisions-<browser>) — never the everyday profile
// --fresh     delete the profile first
// --headless  run headless (default: a real, visible window)
// --flags     extra command-line flags (default adds --enable-features=AIDecisionModelAPI)
// --no-api    do not enable the Decisions API flag
// --click     CSS selector clicked through the DevTools protocol after the first result,
//             which gives the page real transient user activation; then waits for a second post
// --timeout   seconds to wait for each result (default 300)
// --keep      leave the browser open at the end

import { spawn } from "node:child_process";
import { existsSync, rmSync, statSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = resolve(fileURLToPath(new URL(".", import.meta.url)));
const RESULTS = resolve(HERE, "..", "results");
const argv = process.argv.slice(2);
const opt = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : fallback; };
const flag = (name) => argv.includes(`--${name}`);

const LOCAL = process.env.LOCALAPPDATA || "";
const BROWSERS = {
  stable: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  canary: join(LOCAL, "Google", "Chrome SxS", "Application", "chrome.exe"),
  edge: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "edge-canary": join(LOCAL, "Microsoft", "Edge SxS", "Application", "msedge.exe"),
};

const browser = opt("browser", "canary");
const exe = BROWSERS[browser] || browser;
const url = opt("url");
const resultName = opt("result");
const timeout = Number(opt("timeout", "300")) * 1000;
const port = Number(opt("port", "9333"));
const profile = opt("profile", join(tmpdir(), `som-decisions-${browser.replace(/[^a-z-]/gi, "")}`));

function fail(what, how) { console.error(`Erro: ${what} — Solução: ${how}`); process.exit(1); }
if (!url || !resultName) fail("faltam --url ou --result", "passe a URL da página e o nome do arquivo de resultado");
if (!existsSync(exe)) fail(`navegador não encontrado: ${exe}`, "instale-o ou passe o caminho em --browser");
if (flag("fresh") && existsSync(profile)) rmSync(profile, { recursive: true, force: true });
mkdirSync(profile, { recursive: true });

const resultFile = join(RESULTS, resultName.endsWith(".json") ? resultName : `${resultName}.json`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mtime = () => (existsSync(resultFile) ? statSync(resultFile).mtimeMs : 0);

async function waitForResult(after, label) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (mtime() > after) return true;
    await sleep(500);
  }
  console.error(`timeout waiting for ${label}`);
  return false;
}

class Cdp {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); ws.onmessage = (m) => this.onMessage(m); }
  static async connect(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((ok, ko) => { ws.onopen = ok; ws.onerror = ko; });
    return new Cdp(ws);
  }
  onMessage(m) {
    const msg = JSON.parse(m.data);
    if (msg.id && this.pending.has(msg.id)) { const { ok, ko } = this.pending.get(msg.id); this.pending.delete(msg.id); msg.error ? ko(new Error(msg.error.message)) : ok(msg.result); }
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((ok, ko) => this.pending.set(id, { ok, ko }));
  }
  close() { try { this.ws.close(); } catch { /* ignore */ } }
}

async function pageTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === "page" && t.url.startsWith(url.split("?")[0]));
      if (page) return page;
    } catch { /* not up yet */ }
    await sleep(500);
  }
  return null;
}

// Clicks through the DevTools protocol with `userGesture: true`, which Chrome treats as a
// user-initiated action: the page gets transient user activation, as with a real click.
async function click(selector) {
  const target = await pageTarget();
  if (!target) throw new Error("page target not found");
  const cdp = await Cdp.connect(target.webSocketDebuggerUrl);
  await cdp.send("Runtime.evaluate", {
    expression: `document.querySelector(${JSON.stringify(selector)}).click()`,
    userGesture: true,
  });
  cdp.close();
}

// Collects the page console and browser log entries (Log.enable replays earlier entries),
// so warnings the browser writes to the page console end up next to the result.
async function collectConsole() {
  const target = await pageTarget();
  if (!target) return null;
  const cdp = await Cdp.connect(target.webSocketDebuggerUrl);
  const entries = [];
  const original = cdp.onMessage.bind(cdp);
  cdp.onMessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.method === "Log.entryAdded") entries.push({ source: msg.params.entry.source, level: msg.params.entry.level, text: msg.params.entry.text });
    if (msg.method === "Runtime.consoleAPICalled") entries.push({ source: "console", level: msg.params.type, text: msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ") });
    if (msg.method === "Runtime.exceptionThrown") entries.push({ source: "exception", level: "error", text: msg.params.exceptionDetails?.exception?.description ?? msg.params.exceptionDetails?.text });
    original(m);
  };
  cdp.ws.onmessage = (m) => cdp.onMessage(m);
  await cdp.send("Log.enable");
  await cdp.send("Runtime.enable");
  return { entries, cdp };
}

async function attachConsole(collector) {
  if (!collector || !existsSync(resultFile)) return;
  const data = JSON.parse(readFileSync(resultFile, "utf8"));
  data.browserConsole = collector.entries;
  writeFileSync(resultFile, JSON.stringify(data, null, 2));
}

async function closeBrowser() {
  try {
    const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    const cdp = await Cdp.connect(version.webSocketDebuggerUrl);
    await cdp.send("Browser.close").catch(() => {});
    cdp.close();
  } catch { /* already closed */ }
}

const flags = [
  `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, "--no-first-run", "--no-default-browser-check",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
];
if (!flag("no-api")) flags.push("--enable-features=AIDecisionModelAPI");
if (flag("headless")) flags.push("--headless=new");
const extra = opt("flags");
if (extra) flags.push(...extra.split(/\s+/).filter(Boolean));

const before = mtime();
console.log(`launch ${exe}\n  ${flags.join(" ")}\n  ${url}`);
const child = spawn(exe, [...flags, url], { stdio: "ignore", detached: false });
child.on("error", (e) => fail(`não foi possível abrir o navegador (${e.message})`, "confira o caminho"));

const collector = flag("console") ? await collectConsole().catch(() => null) : null;
let ok = await waitForResult(before, "first result");
if (ok) console.log(`result: ${resultFile}`);
const selector = opt("click");
if (ok && selector) {
  const first = mtime();
  await sleep(1000);
  await click(selector);
  console.log(`clicked ${selector} through CDP (user activation)`);
  ok = await waitForResult(first, "result after click");
  if (ok) console.log(`result (after click): ${resultFile}`);
}
if (collector) { await sleep(500); await attachConsole(collector); collector.cdp.close(); }
if (!flag("keep")) { await closeBrowser(); await sleep(1500); try { child.kill(); } catch { /* ignore */ } }
process.exit(ok ? 0 : 1);
