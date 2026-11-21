#!/usr/bin/env node
// Opens a page in Chrome on an Android device or emulator and waits for the page to post its
// result to serve.mjs (running on this computer). No dependencies.
//
//   node bench/spike-mobile/run-android.mjs --result 2026-11-21-emulador-probe \
//        --path "/probe.html?name=2026-11-21-emulador-probe" [--flags "--enable-unsafe-webgpu"]
//
// --serial   adb serial (default: emulator-5554)
// --path     page path on the local server (the device opens http://localhost:<port><path>)
// --flags    Chrome command-line flags (written to /data/local/tmp/chrome-command-line; Chrome
//            reads it because the runner marks it as the debug app). "" = no extra flags.
// --timeout  seconds to wait for the result (default 900)
// --sample   seconds between memory samples of the Chrome processes (default 2; 0 = off)
//
// After the page posts its result, the runner adds `device` (build, Chrome version, flags) and
// `androidMemory` (PSS of every Chrome process over time, from `dumpsys meminfo`) to the JSON.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = resolve(fileURLToPath(new URL(".", import.meta.url)));
const RESULTS = resolve(HERE, "..", "results");
const argv = process.argv.slice(2);
const opt = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : fallback; };

const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || join(process.env.LOCALAPPDATA || "", "Android", "Sdk");
const ADB = join(sdk, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb");
const serial = opt("serial", "emulator-5554");
const path = opt("path");
const resultName = opt("result");
const flags = opt("flags", "");
const port = Number(opt("port", "8377"));
const timeout = Number(opt("timeout", "900")) * 1000;
const sampleEvery = Number(opt("sample", "2")) * 1000;
const CHROME = "com.android.chrome";

function fail(what, how) { console.error(`Erro: ${what} — Solução: ${how}`); process.exit(1); }
if (!path || !resultName) fail("faltam --path ou --result", "passe o caminho da página e o nome do arquivo de resultado");
if (!existsSync(ADB)) fail(`adb não encontrado em ${ADB}`, "instale o platform-tools ou defina ANDROID_HOME");

const adb = (...args) => execFileSync(ADB, ["-s", serial, ...args], { encoding: "utf8", timeout: 60000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const resultFile = join(RESULTS, resultName.endsWith(".json") ? resultName : `${resultName}.json`);
const mtime = () => (existsSync(resultFile) ? statSync(resultFile).mtimeMs : 0);

function chromeMemory() {
  // "Total PSS by process:" section of `dumpsys meminfo`, one line per process:
  //   "    107,599K: com.android.chrome (pid 13123 / activities)"
  const lines = adb("shell", "dumpsys", "meminfo").split(/\r?\n/);
  const first = lines.findIndex((l) => l.startsWith("Total PSS by process"));
  const processes = {};
  for (let i = first + 1; first >= 0 && i < lines.length && lines[i].trim(); i++) {
    const m = lines[i].match(/^\s*([\d,]+)K:\s*(\S+)\s*\(pid (\d+)/);
    if (m && m[2].startsWith(CHROME)) processes[`${m[2]}#${m[3]}`] = Number(m[1].replace(/,/g, "")) * 1024;
  }
  return processes;
}

const device = {
  serial,
  fingerprint: adb("shell", "getprop", "ro.build.fingerprint"),
  androidRelease: adb("shell", "getprop", "ro.build.version.release"),
  sdk: adb("shell", "getprop", "ro.build.version.sdk"),
  model: adb("shell", "getprop", "ro.product.model"),
  emulatorGpuMode: adb("shell", "getprop", "ro.boot.qemu.gles") || null,
  vulkan: adb("shell", "getprop", "ro.hardware.vulkan") || null,
  chrome: (adb("shell", "dumpsys", "package", CHROME).match(/versionName=(\S+)/) || [])[1] || null,
  chromeFlags: flags,
};

// Chrome flags: mark Chrome as the debug app so it reads the command-line file.
const tmp = mkdtempSync(join(tmpdir(), "som-android-"));
const local = join(tmp, "chrome-command-line");
writeFileSync(local, `_ --disable-fre --no-default-browser-check --no-first-run ${flags}\n`);
adb("shell", "am", "set-debug-app", "--persistent", CHROME);
adb("push", local, "/data/local/tmp/chrome-command-line");
rmSync(tmp, { recursive: true, force: true });
adb("reverse", `tcp:${port}`, `tcp:${port}`);
adb("shell", "am", "force-stop", CHROME);
await sleep(1000);

const url = `http://localhost:${port}${path}`;
const before = mtime();
console.log(`open ${url} on ${serial} (Chrome ${device.chrome}, flags: ${flags || "none"})`);
adb("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", `'${url}'`, CHROME);

const samples = [];
const start = Date.now();
let ok = false;
while (Date.now() - start < timeout) {
  if (sampleEvery > 0 && (samples.length === 0 || Date.now() - start >= samples.length * sampleEvery)) {
    try { samples.push({ t: Date.now() - start, pss: chromeMemory() }); } catch { /* device busy */ }
  }
  if (mtime() > before) { ok = true; break; }
  await sleep(500);
}
if (!ok) fail(`a página não postou o resultado em ${timeout / 1000} s`, "veja a tela do emulador (android ui dump -Text) e o log do serve.mjs");

const data = JSON.parse(readFileSync(resultFile, "utf8"));
data.device = device;
data.androidMemory = { method: "dumpsys meminfo --package com.android.chrome (Total PSS by process), bytes", samples };
writeFileSync(resultFile, JSON.stringify(data, null, 2));
console.log(`result: ${resultFile} (${samples.length} memory samples)`);
