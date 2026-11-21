#!/usr/bin/env node
// Opens a page in Safari on an iOS Simulator device (macOS, Xcode) and waits for the page to post its
// result to serve.mjs, running on the same Mac. No dependencies. Procedure: MACMINI.md.
//
//   node bench/spike-mobile/run-ios.mjs --result 2026-11-21-ios-probe --path "/probe.html?name=2026-11-21-ios-probe"
//
// --device       simulator name, created when missing (default "som-webcore iPhone 18 Pro")
// --device-type  default com.apple.CoreSimulator.SimDeviceType.iPhone-18-Pro
// --runtime      default: the newest iOS runtime installed
// --path         page path on the local server (Safari opens http://localhost:<port><path>)
// --timeout      seconds to wait for the result (default 900)
// --sample       seconds between memory samples (default 5; 0 = off)
// --keep-data    do not erase the device first (by default it is erased: Safari restores the tabs of
//                the previous session, and a restored test page would run next to the measured one)
// --keep-booted  leave the device booted at the end (default: shut down, to free the Mac's memory)
//
// After the page posts, the runner adds `device` (simulator, runtime, Safari build, Xcode, macOS,
// host model) and `iosMemory` (RSS of the device's WebContent processes, as seen by the Mac) to the JSON.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeTimeoutResult } from "./timeout-result.mjs";

const HERE = resolve(fileURLToPath(new URL(".", import.meta.url)));
const RESULTS = resolve(HERE, "..", "results");
const argv = process.argv.slice(2);
const opt = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : fallback; };
const flag = (name) => argv.includes(`--${name}`);

const deviceName = opt("device", "som-webcore iPhone 18 Pro");
const deviceType = opt("device-type", "com.apple.CoreSimulator.SimDeviceType.iPhone-18-Pro");
const path = opt("path");
const resultName = opt("result");
const port = Number(opt("port", "8377"));
const timeout = Number(opt("timeout", "900")) * 1000;
const sampleEvery = Number(opt("sample", "5")) * 1000;

function fail(what, how) { console.error(`Erro: ${what} — Solução: ${how}`); process.exit(1); }
if (process.platform !== "darwin") fail("o simulador de iOS só existe no macOS", "rode no Mac mini (MACMINI.md)");
if (!path || !resultName) fail("faltam --path ou --result", "passe o caminho da página e o nome do arquivo de resultado");

const run = (cmd, args, ms = 120000) => execFileSync(cmd, args, { encoding: "utf8", timeout: ms }).trim();
const simctl = (...args) => run("xcrun", ["simctl", ...args], 300000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const resultFile = join(RESULTS, resultName.endsWith(".json") ? resultName : `${resultName}.json`);
const mtime = () => (existsSync(resultFile) ? statSync(resultFile).mtimeMs : 0);

// Runtime: the one given, else the newest iOS runtime.
const runtimes = JSON.parse(simctl("list", "runtimes", "-j")).runtimes.filter((r) => r.isAvailable !== false && r.identifier.includes("iOS"));
const runtime = runtimes.find((r) => r.identifier === opt("runtime")) ?? runtimes.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))[0];
if (!runtime) fail("nenhum runtime de iOS instalado", "instale um pelo Xcode");

// Device: reuse the dedicated one, or create it (never touches the owner's other simulators).
function findDevice() {
  const all = JSON.parse(simctl("list", "devices", "-j")).devices[runtime.identifier] ?? [];
  return all.find((d) => d.name === deviceName && d.isAvailable !== false);
}
let device = findDevice();
if (!device) {
  simctl("create", deviceName, deviceType, runtime.identifier);
  device = findDevice();
}
if (!device) fail(`não foi possível criar o simulador ${deviceName}`, "confira o tipo de aparelho e o runtime");
const udid = device.udid;

if (!flag("keep-data")) {
  if (findDevice().state !== "Shutdown") simctl("shutdown", udid);
  simctl("erase", udid);
}
if (findDevice().state !== "Booted") simctl("boot", udid);
simctl("bootstatus", udid, "-b");

const safariPlist = join(runtime.runtimeRoot, "Applications", "MobileSafari.app", "Info.plist");
const plist = (key) => { try { return run("plutil", ["-extract", key, "raw", safariPlist]); } catch { return null; } };
const deviceInfo = {
  simulator: { name: deviceName, udid, deviceType, runtime: runtime.identifier, runtimeVersion: runtime.version, runtimeBuild: runtime.buildversion },
  mobileSafari: { version: plist("CFBundleShortVersionString"), build: plist("CFBundleVersion") },
  xcode: run("xcodebuild", ["-version"]).split("\n").join(" "),
  macOS: run("sw_vers", ["-productVersion"]),
  hostModel: run("sysctl", ["-n", "hw.model"]),
  dataErased: !flag("keep-data"),
};

// RSS (bytes, from the Mac) of every WebContent process running inside this simulator device.
function webContentMemory() {
  const services = simctl("spawn", udid, "launchctl", "list").split("\n");
  const processes = {};
  for (const line of services) {
    const [pid, , label] = line.trim().split(/\s+/);
    if (!label || !/WebContent|GPU|Networking/.test(label) || !/^\d+$/.test(pid)) continue;
    try { processes[`${label}#${pid}`] = Number(run("ps", ["-o", "rss=", "-p", pid])) * 1024; } catch { /* exited */ }
  }
  return processes;
}

const url = `http://localhost:${port}${path}`;
const before = mtime();
console.log(`open ${url} on ${deviceName} (${runtime.identifier}, Safari ${deviceInfo.mobileSafari.version})`);
simctl("openurl", udid, url);

const samples = [];
const start = Date.now();
let ok = false;
while (Date.now() - start < timeout) {
  if (sampleEvery > 0 && (samples.length === 0 || Date.now() - start >= samples.length * sampleEvery)) {
    try { samples.push({ t: Date.now() - start, rss: webContentMemory() }); } catch { /* device busy */ }
  }
  if (mtime() > before) { ok = true; break; }
  await sleep(500);
}
if (!ok) {
  await writeTimeoutResult({ resultFile, resultName, pageUrl: url, seconds: timeout / 1000, port, runner: "run-ios.mjs" });
  console.error(`Erro: a página não postou o resultado em ${timeout / 1000} s — Solução: veja o simulador; a falha foi gravada em ${resultFile}`);
}

const data = JSON.parse(readFileSync(resultFile, "utf8"));
data.device = deviceInfo;
data.iosMemory = { method: "RSS on the Mac of the simulator's WebContent, GPU and Networking processes (launchctl list inside the device), bytes", samples };
writeFileSync(resultFile, JSON.stringify(data, null, 2));
if (!flag("keep-booted")) { try { simctl("shutdown", udid); } catch { /* already down */ } }
console.log(`result: ${resultFile} (${samples.length} memory samples)`);
if (!ok) process.exit(1);
