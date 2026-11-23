#!/usr/bin/env node
// Runs a device lab session (started by start-lab.sh) end to end in desktop Chrome on the Mac mini,
// through the real lab server, with a dedicated profile — never the everyday one. It is how the lab is
// validated before a round on the iPhone. No dependencies (Node >= 22: global WebSocket and fetch).
//
//   node bench/spike-mobile/lab/run-lab.mjs --session <SESSION> [--browser stable] [--apenas <tag>]
//        [--teto <MiB>] [--timeout 3600] [--tls spki|ignore] [--keep-profile] [--flags "<extra flags>"]
//
// - Trust: the lab serves HTTPS with a certificate from its own CA. The dedicated profile accepts only
//   that server's key (--ignore-certificate-errors-spki-list, which Chrome honours only with
//   --user-data-dir); --tls ignore accepts any certificate, in that profile only.
// - Entry: the lab cookie is set over the DevTools protocol, so the token never appears in a URL, in
//   the browser history, on a command line or in this script's output. The token file stays on the Mac.
// - The lab runs with ?auto=1&reinicio=1: when a step needs a fresh process (lab.js, process epochs),
//   the lab asks, and this runner closes the browser and opens it again (same profile) with
//   ?reaberto=1 — the desktop stand-in for the owner closing Safari. An unexpected browser exit gets
//   a relaunch too, and the lab takes the running step as a crash.
// - Memory: RSS of the browser, GPU and renderer processes every 500 ms, and on macOS their
//   phys_footprint every 2 s (desktop-memory.mjs), labelled with the running step:
//   bench/results/<SESSION>-desktop.json (desktopMemory.segments, one per browser launch).
import { spawn } from "node:child_process";
import { createHash, X509Certificate } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { peaks, startDesktopMemorySampler } from "../desktop-memory.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..", "..");
const RESULTS = join(ROOT, "bench", "results");
const argv = process.argv.slice(2);
const opt = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : fallback; };
const flag = (name) => argv.includes(`--${name}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function fail(what, how) { console.error(`Erro: ${what} — Solução: ${how}`); process.exit(1); }

const session = opt("session");
if (!session) fail("falta --session", "passe a linha SESSION= do start-lab.sh");
const EXT = "/Volumes/Ext2TB";
const runBase = process.env.SOM_LAB_RUN || (existsSync(EXT) ? join(EXT, "tmp", "som-webcore", "lab") : join(tmpdir(), "som-webcore-lab"));
const sessionFile = join(runBase, session, "session.json");
if (!existsSync(sessionFile)) fail(`sessão ${session} não encontrada (${sessionFile})`, "suba a sessão com start-lab.sh e confira o nome");
const info = JSON.parse(readFileSync(sessionFile, "utf8"));
if (info.mode === "tunel") fail("o executor de desktop usa o servidor local", "suba a sessão com --modo local ou local-http");
const tokenFile = process.env.SOM_LAB_TOKEN_FILE || (existsSync(EXT) ? join(EXT, "State", "som-webcore", "lab-token") : join(homedir(), ".local", "state", "som-webcore", "lab-token"));
if (!existsSync(tokenFile)) fail("arquivo do token do laboratório não encontrado", "suba a sessão com start-lab.sh (ele cria o token)");
const token = readFileSync(tokenFile, "utf8").trim(); // never printed
const scheme = info.mode === "local" ? "https" : "http";
const base = `${scheme}://localhost:${info.port}`;

const macApp = (name) => {
  const app = [join(EXT, "Applications", `${name}.app`), join("/Applications", `${name}.app`)].find(existsSync) ?? join("/Applications", `${name}.app`);
  return join(app, "Contents", "MacOS", name);
};
const BROWSERS = process.platform === "darwin"
  ? { stable: macApp("Google Chrome"), canary: macApp("Google Chrome Canary") }
  : { stable: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" };
const browser = opt("browser", "stable");
const exe = BROWSERS[browser] || browser;
if (!existsSync(exe)) fail(`navegador não encontrado: ${exe}`, "instale-o ou passe o caminho em --browser");
const cdpPort = Number(opt("port", "9334"));
const timeoutMs = Number(opt("timeout", "3600")) * 1000;
const profile = opt("profile", join(existsSync(EXT) ? join(EXT, "tmp", "som-webcore") : tmpdir(), `chrome-lab-${session}`));

let tlsFlags = [];
let tlsNote = "http (sem TLS)";
if (scheme === "https") {
  if (opt("tls", "spki") === "ignore") {
    tlsFlags = ["--ignore-certificate-errors"];
    tlsNote = "--ignore-certificate-errors (só no perfil dedicado)";
  } else {
    if (!info.tlsCert || !existsSync(info.tlsCert)) fail("a sessão não diz qual é o certificado do servidor", "suba a sessão de novo com o start-lab.sh atual, ou use --tls ignore");
    const cert = new X509Certificate(readFileSync(info.tlsCert));
    const spki = createHash("sha256").update(cert.publicKey.export({ type: "spki", format: "der" })).digest("base64");
    tlsFlags = [`--ignore-certificate-errors-spki-list=${spki}`];
    tlsNote = "--ignore-certificate-errors-spki-list com a chave do servidor do laboratório (só no perfil dedicado)";
  }
}
const flags = [
  `--user-data-dir=${profile}`, `--remote-debugging-port=${cdpPort}`, "--no-first-run", "--no-default-browser-check",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
  "--hide-crash-restore-bubble", "--enable-precise-memory-info", ...tlsFlags,
];
// macOS: a new profile asks the login Keychain for "Chrome Safe Storage"; automation uses a mock.
if (process.platform === "darwin") flags.push("--use-mock-keychain");
const extra = opt("flags");
if (extra) flags.push(...extra.split(/\s+/).filter(Boolean));

class Cdp {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); ws.onmessage = (m) => this.onMessage(m); }
  static async connect(url) {
    const ws = new WebSocket(url);
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

async function cdpJson(path) {
  for (let i = 0; i < 120; i++) {
    try { return await (await fetch(`http://127.0.0.1:${cdpPort}${path}`)).json(); } catch { await sleep(500); }
  }
  throw new Error(`DevTools endpoint ${path} did not answer`);
}

const labState = () => { try { return JSON.parse(readFileSync(join(RESULTS, `${session}-lab.json`), "utf8")); } catch { return null; } };
let runningStep = null;
const segments = [];
let child = null;
let sampler = null;
let browserVersion = null;
let exited = false;

async function launch(query, why) {
  exited = false;
  child = spawn(exe, [...flags, "about:blank"], { stdio: "ignore", detached: false });
  child.on("exit", () => { exited = true; });
  child.on("error", (e) => fail(`não foi possível abrir o navegador (${e.message})`, "confira o caminho"));
  sampler = startDesktopMemorySampler({ rootPid: child.pid, label: () => runningStep });
  const version = await cdpJson("/json/version");
  browserVersion = version.Browser;
  const list = await cdpJson("/json/list");
  const page = list.find((t) => t.type === "page");
  if (!page) throw new Error("no page target");
  const cdp = await Cdp.connect(page.webSocketDebuggerUrl);
  await cdp.send("Network.enable");
  // The lab cookie, as /lab/enter would set it (token never in a URL).
  await cdp.send("Network.setCookie", { name: "som_lab", value: token, url: base, path: "/", httpOnly: true, secure: scheme === "https", sameSite: "Lax", expires: Math.floor(Date.now() / 1000) + 24 * 3600 });
  await cdp.send("Page.enable");
  await cdp.send("Page.navigate", { url: `${base}/lab/lab.html?${query}` });
  cdp.close();
  segments.push({ launch: segments.length + 1, why, startedAt: new Date().toISOString(), rootPid: child.pid, query });
  console.log(`[run-lab] navegador ${segments.length} (${why}): ${browserVersion}, lab.html?${query}`);
}

async function closeBrowser() {
  try {
    const version = await (await fetch(`http://127.0.0.1:${cdpPort}/json/version`)).json();
    const cdp = await Cdp.connect(version.webSocketDebuggerUrl);
    await cdp.send("Browser.close").catch(() => {});
    cdp.close();
  } catch { /* already closed */ }
  for (let i = 0; i < 40 && !exited; i++) await sleep(250);
  if (!exited) { try { child.kill("SIGKILL"); } catch { /* gone */ } await sleep(1000); }
  await saveSegment();
}
async function saveSegment() {
  if (!sampler) return;
  const result = await sampler.stop();
  sampler = null;
  Object.assign(segments[segments.length - 1], { endedAt: new Date().toISOString(), ...result });
}

const outFile = join(RESULTS, `${session}-desktop.json`);
function write(extraFields = {}) {
  const all = { samples: segments.flatMap((s) => s.samples || []), footprint: segments.flatMap((s) => s.footprint || []) };
  const steps = [...new Set(all.samples.map((s) => s.label).filter(Boolean))];
  const report = {
    kind: "device-lab-desktop-run", schemaVersion: 1, session, runner: "lab/run-lab.mjs", writtenAt: new Date().toISOString(),
    browser: { name: browser, executable: exe, version: browserVersion, flags: flags.filter((f) => !f.startsWith("--user-data-dir=")), tls: tlsNote, profile: "dedicado (apagado no fim, salvo --keep-profile)" },
    base, restarts, browserExits,
    desktopMemory: { segments: segments.map(({ samples, footprint, ...rest }) => ({ ...rest, samples: samples || [], footprint: footprint || null })), peaks: peaks(all), peaksByStep: Object.fromEntries(steps.map((step) => [step, peaks(all, step)])) },
    ...extraFields,
  };
  writeFileSync(outFile, JSON.stringify(report));
}

const restarts = [];
const browserExits = [];
rmSync(profile, { recursive: true, force: true });
mkdirSync(profile, { recursive: true });
console.log(`[run-lab] sessão ${session}; ${base}; perfil dedicado ${profile}; TLS: ${tlsNote}`);
const firstQuery = new URLSearchParams({ auto: "1", reinicio: "1" });
if (opt("apenas")) firstQuery.set("apenas", opt("apenas"));
if (opt("teto")) firstQuery.set("teto", opt("teto"));
await launch(firstQuery.toString(), "início");

const deadline = Date.now() + timeoutMs;
let handled = null;
const printed = new Map(); // step id -> status last printed
let outcome = "timeout";
for (;;) {
  await sleep(1000);
  const state = labState();
  const running = state?.steps?.find((s) => s.status === "running") ?? null;
  runningStep = running?.id ?? null;
  for (const s of state?.steps || []) {
    if (printed.get(s.id) === s.status || (s.status === "pending" && !printed.has(s.id))) continue;
    printed.set(s.id, s.status);
    console.log(`[run-lab] ${s.id} ${s.status}${s.epoch !== undefined ? ` (processo ${s.epoch})` : ""}${s.note ? ` — ${String(s.note).slice(0, 160)}` : ""}`);
  }
  if (state?.done) { outcome = "done"; break; }
  if (Date.now() > deadline) break;
  if (state?.needsRestart && state.needsRestart.at !== handled) {
    handled = state.needsRestart.at;
    restarts.push({ at: new Date().toISOString(), before: state.needsRestart.step, reason: state.needsRestart.reason ?? null });
    console.log(`[run-lab] reinício pedido antes de ${state.needsRestart.step}: ${state.needsRestart.reason}`);
    await closeBrowser();
    await launch("auto=1&reinicio=1&reaberto=1", `reinício antes de ${state.needsRestart.step}`);
    write();
    continue;
  }
  if (exited) {
    browserExits.push({ at: new Date().toISOString(), step: runningStep });
    console.log(`[run-lab] o navegador saiu sozinho durante ${runningStep ?? "—"}: reabrindo`);
    await saveSegment();
    await launch("auto=1&reinicio=1", `o navegador saiu durante ${runningStep ?? "—"}`);
    write();
  }
}
runningStep = null;
await closeBrowser();
write({ outcome });
if (!flag("keep-profile")) rmSync(profile, { recursive: true, force: true });
const total = peaks({ samples: segments.flatMap((s) => s.samples || []), footprint: segments.flatMap((s) => s.footprint || []) });
const mb = (x) => (x ? `${(x / 2 ** 20).toFixed(0)} MiB` : "—");
console.log(`[run-lab] ${outcome === "done" ? "pronto" : "tempo esgotado"}; ${restarts.length} reinício(s), ${browserExits.length} saída(s) inesperada(s)`);
console.log(`[run-lab] picos de RSS: GPU ${mb(total.rss.gpu)}, renderer ${mb(total.rss.renderer)}, browser ${mb(total.rss.browser)}; footprint: GPU ${mb(total.footprint.gpu)}, renderer ${mb(total.footprint.renderer)}`);
console.log(`[run-lab] memória dos processos: ${outFile}`);
process.exit(outcome === "done" ? 0 : 1);
