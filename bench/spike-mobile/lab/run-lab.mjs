#!/usr/bin/env node
// Runs a device lab session (started by start-lab.sh) end to end in desktop Chrome on the Mac mini,
// through the real lab server, with a dedicated profile — never the everyday one. It is how the lab is
// validated before a round on the iPhone. No dependencies (Node >= 22: global WebSocket and fetch).
//
//   node bench/spike-mobile/lab/run-lab.mjs --session <SESSION> [--browser stable] [--apenas <tag>]
//        [--teto <MiB>] [--timeout 3600] [--tls spki|ignore] [--keep-profile] [--flags "<extra flags>"]
//        [--simular-queda <step>:<seconds>[,…]]   (test of the crash path: renderer crash + reload)
//        [--pagina /lab/memoria-unica.html]   (opens that page instead of the lab and taps its Começar)
//   node bench/spike-mobile/lab/run-lab.mjs --session <SESSION> --browser simulador --apenas vagas
//        (Safari on the project's iOS Simulator; no WebGPU there; erased at the end)
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
//   phys_footprint every second (desktop-memory.mjs), labelled with the running step:
//   bench/results/<SESSION>-desktop.json (desktopMemory.segments, one per browser launch).
import { execFileSync, spawn } from "node:child_process";
import { createHash, X509Certificate } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
// --browser simulador: Safari on the project's own iOS Simulator (MACMINI.md, section 4). No WebGPU
// there, so it serves the Wasm slot steps (--apenas vagas). A restart is `simctl terminate` of
// MobileSafari and a new openurl; the lab's CA goes into the simulator's keychain first.
const SIMULATOR = browser === "simulador";
const PAGE = opt("pagina", null);
const SIM_NAME = opt("device", "som-webcore iPhone 18 Pro");
const exe = SIMULATOR ? "xcrun simctl (MobileSafari)" : BROWSERS[browser] || browser;
if (!SIMULATOR && !existsSync(exe)) fail(`navegador não encontrado: ${exe}`, "instale-o ou passe o caminho em --browser");
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

// The iOS Simulator path. Errors are reported without the command line: the entry URL carries the token.
let sim = null;
let lastQuery = null;
function simctl(...args) {
  try { return execFileSync("xcrun", ["simctl", ...args], { encoding: "utf8", timeout: 300000, stdio: ["ignore", "pipe", "pipe"] }).trim(); } catch (error) {
    throw new Error(`simctl ${args[0]} falhou (${String(error.stderr || error.message).split("\n")[0].replace(/t=[0-9a-f]+/gi, "t=…").slice(0, 200)})`);
  }
}
function simPrepare() {
  const runtimes = JSON.parse(simctl("list", "runtimes", "-j")).runtimes.filter((r) => r.isAvailable !== false && r.identifier.includes("iOS"));
  const runtime = runtimes.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))[0];
  if (!runtime) fail("nenhum runtime de iOS instalado", "instale um pelo Xcode");
  const device = (JSON.parse(simctl("list", "devices", "-j")).devices[runtime.identifier] || []).find((d) => d.name === SIM_NAME && d.isAvailable !== false);
  if (!device) fail(`simulador dedicado "${SIM_NAME}" não encontrado`, "crie-o com bench/spike-mobile/run-ios.mjs (MACMINI.md, seção 4)");
  if (device.state !== "Booted") simctl("boot", device.udid);
  simctl("bootstatus", device.udid, "-b");
  // The simulator's services do not read the external disk: the CA goes through /tmp.
  const caPem = join(dirname(info.tlsCert || ""), "ca.pem");
  if (scheme === "https") {
    if (!existsSync(caPem)) fail("CA do laboratório não encontrada", "suba a sessão com --modo local");
    const tmpPem = join("/tmp", `som-lab-ca-${process.pid}.pem`);
    copyFileSync(caPem, tmpPem);
    try { simctl("keychain", device.udid, "add-root-cert", tmpPem); } finally { rmSync(tmpPem, { force: true }); }
  }
  const plist = join(runtime.runtimeRoot || "", "Applications", "MobileSafari.app", "Info.plist");
  let safari = null;
  try { safari = execFileSync("plutil", ["-extract", "CFBundleShortVersionString", "raw", plist], { encoding: "utf8" }).trim(); } catch { /* unknown */ }
  sim = { udid: device.udid, name: SIM_NAME, runtime: runtime.identifier, runtimeVersion: runtime.version, safari: safari ? `Mobile Safari ${safari} (simulador ${runtime.version})` : `simulador ${runtime.version}` };
  // The cookie: the entry page, once (the token goes to simctl, never to the output).
  simctl("openurl", device.udid, `${base}/lab/enter?t=${token}`);
}

async function launch(query, why) {
  lastQuery = query;
  if (SIMULATOR) {
    if (!sim) { simPrepare(); await sleep(5000); }
    browserVersion = sim.safari;
    simctl("openurl", sim.udid, `${base}/lab/lab.html?${query}`);
    segments.push({ launch: segments.length + 1, why, startedAt: new Date().toISOString(), query, browserVersion });
    console.log(`[run-lab] Safari ${segments.length} (${why}): ${browserVersion}, lab.html?${query}`);
    return;
  }
  exited = false;
  child = spawn(exe, [...flags, "about:blank"], { stdio: "ignore", detached: false });
  child.on("exit", () => { exited = true; });
  child.on("error", (e) => fail(`não foi possível abrir o navegador (${e.message})`, "confira o caminho"));
  sampler = startDesktopMemorySampler({ rootPid: child.pid, footprintEveryMs: 1000, label: () => runningStep });
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
  await cdp.send("Page.navigate", { url: PAGE ? `${base}${PAGE}` : `${base}/lab/lab.html?${query}` });
  if (PAGE && segments.length === 0) {
    // The page waits for a tap: a click with user activation, as the owner's.
    await sleep(4000);
    await cdp.send("Runtime.evaluate", { expression: 'document.getElementById("start").click()', userGesture: true }).catch(() => {});
  }
  cdp.close();
  // The version of each launch: Chrome's updater can swap the app between two launches of one session
  // (seen on the Mac mini, 2026-11-23: 157 before the first restart, 158 after).
  segments.push({ launch: segments.length + 1, why, startedAt: new Date().toISOString(), rootPid: child.pid, query, browserVersion });
  console.log(`[run-lab] navegador ${segments.length} (${why}): ${browserVersion}, lab.html?${query}`);
}

async function closeBrowser() {
  if (SIMULATOR) {
    try { simctl("terminate", sim.udid, "com.apple.mobilesafari"); } catch { /* not running */ }
    await sleep(2000);
    if (segments.length) segments[segments.length - 1].endedAt = new Date().toISOString();
    return;
  }
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
    browser: SIMULATOR
      ? { name: "simulador", executable: exe, version: browserVersion, versions: [...new Set(segments.map((s) => s.browserVersion))], device: sim ? { name: sim.name, runtime: sim.runtime, runtimeVersion: sim.runtimeVersion } : null, tls: "CA do laboratório no keychain do simulador dedicado" }
      : { name: browser, executable: exe, version: browserVersion, versions: [...new Set(segments.map((s) => s.browserVersion))], flags: flags.filter((f) => !f.startsWith("--user-data-dir=")), tls: tlsNote, profile: "dedicado (apagado no fim, salvo --keep-profile)" },
    base, restarts, browserExits, simulatedCrashes: simulated, reopens,
    desktopMemory: { segments: segments.map(({ samples, footprint, ...rest }) => ({ ...rest, samples: samples || [], footprint: footprint || null })), peaks: peaks(all), peaksByStep: Object.fromEntries(steps.map((step) => [step, peaks(all, step)])) },
    ...extraFields,
  };
  writeFileSync(outFile, JSON.stringify(report));
}

const restarts = [];
const browserExits = [];
// --simular-queda <step>:<seconds>[,…]: crash the renderer that many seconds into the step (CDP
// Page.crash), then reload the tab (Page.reload) — a test of the lab's crash path only.
const crashPlan = new Map((opt("simular-queda") || "").split(",").filter(Boolean).map((item) => { const [id, seconds] = item.split(":"); return [id, Number(seconds || 5)]; }));
const crashed = new Set();
const simulated = [];
async function simulateCrash(stepId) {
  const list = await cdpJson("/json/list");
  const page = list.find((t) => t.type === "page" && (t.url.includes(`labstep=${encodeURIComponent(stepId)}`) || (PAGE && t.url.includes(PAGE))));
  if (!page) { console.log(`[run-lab] queda simulada: página de ${stepId} não encontrada`); return; }
  const cdp = await Cdp.connect(page.webSocketDebuggerUrl);
  cdp.send("Page.crash").catch(() => {});
  await sleep(1500);
  cdp.close();
  const again = (await cdpJson("/json/list")).find((t) => t.id === page.id);
  if (!again) { console.log(`[run-lab] queda simulada: a aba de ${stepId} sumiu depois do Page.crash`); return; }
  const next = await Cdp.connect(again.webSocketDebuggerUrl);
  // The page comes back as a plain navigation to the same URL, not a "reload": that is what the iPhone
  // did after jetsam (2026-11-23), and the loop guards must not depend on the navigation type.
  await next.send("Page.navigate", { url: page.url }).catch(() => {});
  next.close();
  simulated.push({ step: stepId, at: new Date().toISOString() });
  console.log(`[run-lab] queda simulada em ${stepId} (Page.crash e nova navegação à mesma URL)`);
}
const reopens = [];
if (SIMULATOR) {
  console.log(`[run-lab] sessão ${session}; ${base}; simulador ${SIM_NAME}`);
} else {
  rmSync(profile, { recursive: true, force: true });
  mkdirSync(profile, { recursive: true });
  console.log(`[run-lab] sessão ${session}; ${base}; perfil dedicado ${profile}; TLS: ${tlsNote}`);
}
const firstQuery = new URLSearchParams({ auto: "1", reinicio: "1" });
if (opt("apenas")) firstQuery.set("apenas", opt("apenas"));
if (opt("teto")) firstQuery.set("teto", opt("teto"));
await launch(firstQuery.toString(), "início");

const deadline = Date.now() + timeoutMs;
let handled = null;
const printed = new Map(); // step id -> status last printed
let outcome = "timeout";
let lastSeen = "";
let lastChange = Date.now();
for (;;) {
  await sleep(1000);
  const state = labState();
  const running = state?.steps?.find((s) => s.status === "running") ?? null;
  runningStep = running?.id ?? null;
  const seen = JSON.stringify(state);
  if (seen !== lastSeen) { lastSeen = seen; lastChange = Date.now(); }
  // Right after a boot or a restart, the simulator's Safari can sit on a navigation that never reaches
  // the server (MACMINI.md, section 4): open the lab again.
  if (SIMULATOR && !running && !state?.done && !(state?.needsRestart && state.needsRestart.at !== handled) && Date.now() - lastChange > 45000 && reopens.length < 6) {
    reopens.push({ at: new Date().toISOString(), query: lastQuery });
    console.log(`[run-lab] o Safari do simulador não andou em 45 s: abrindo o laboratório de novo (${reopens.length})`);
    simctl("openurl", sim.udid, `${base}/lab/lab.html?${lastQuery}`);
    lastChange = Date.now();
  }
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
  // Test of the crash path: the renderer dies mid-step and the tab is reloaded, as Safari does after a
  // jetsam kill (on desktop, under the caps, nothing dies by itself).
  if (running && crashPlan.has(running.id) && !crashed.has(running.id)) {
    const started = Date.parse(running.startedAt || "") || Date.now();
    if (Date.now() - started >= crashPlan.get(running.id) * 1000) {
      crashed.add(running.id);
      await simulateCrash(running.id);
    }
  }
}
runningStep = null;
await closeBrowser();
write({ outcome });
if (SIMULATOR) {
  // The simulator keeps its data on the Mac's internal disk: shut it down and erase it (the CA and the
  // lab cookie go with it), unless --keep-profile.
  try { simctl("shutdown", sim.udid); } catch { /* already down */ }
  if (!flag("keep-profile")) { try { simctl("erase", sim.udid); } catch { /* keep going */ } }
} else if (!flag("keep-profile")) rmSync(profile, { recursive: true, force: true });
const total = peaks({ samples: segments.flatMap((s) => s.samples || []), footprint: segments.flatMap((s) => s.footprint || []) });
const mb = (x) => (x ? `${(x / 2 ** 20).toFixed(0)} MiB` : "—");
console.log(`[run-lab] ${outcome === "done" ? "pronto" : "tempo esgotado"}; ${restarts.length} reinício(s), ${browserExits.length} saída(s) inesperada(s)`);
console.log(`[run-lab] picos de RSS: GPU ${mb(total.rss.gpu)}, renderer ${mb(total.rss.renderer)}, browser ${mb(total.rss.browser)}; footprint: GPU ${mb(total.footprint.gpu)}, renderer ${mb(total.footprint.renderer)}`);
console.log(`[run-lab] memória dos processos: ${outFile}`);
process.exit(outcome === "done" ? 0 : 1);
