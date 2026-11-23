// Memory of a desktop Chromium run, sampled from outside the browser (the page itself cannot see its
// GPU memory): the browser process started by the runner and every process under it, classified by
// Chrome's --type= switch (gpu, renderer, utility/network, …). Used by run-desktop.mjs and
// lab/run-lab.mjs, like run-ios.mjs samples the simulator's WebKit processes.
//   - RSS (ps) of every process, every 500 ms by default;
//   - on macOS, phys_footprint and phys_footprint_peak (footprint(1)) of the browser, GPU and renderer
//     processes, every 2 s: GPU memory owned by a process (IOAccelerator, graphics) counts in its
//     footprint, not in its RSS.
// A sample can carry a label (the lab step running at that moment), so peaks can be read per step.
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";

const run = (cmd, args) => new Promise((resolve) => {
  execFile(cmd, args, { encoding: "utf8", maxBuffer: 32 << 20, timeout: 10000 }, (error, stdout) => resolve(error && !stdout ? "" : stdout || ""));
});

function kindOf(command, isRoot) {
  if (isRoot) return "browser";
  const type = command.match(/--type=([a-z-]+)/);
  if (!type) return /crashpad/i.test(command) ? "crashpad" : "other";
  if (type[1] === "gpu-process") return "gpu";
  if (type[1] === "utility") {
    const sub = command.match(/--utility-sub-type=([\w.]+)/);
    return sub ? `utility:${sub[1].split(".").pop()}` : "utility";
  }
  return type[1];
}

// Every process under rootPid (rootPid included), with its kind and RSS in bytes.
async function tree(rootPid) {
  const out = await run("ps", ["-axo", "pid=,ppid=,rss=,command="]);
  const rows = [];
  for (const line of out.split("\n")) {
    const m = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/);
    if (m) rows.push({ pid: Number(m[1]), ppid: Number(m[2]), rss: Number(m[3]) * 1024, command: m[4] });
  }
  const keep = new Set([rootPid]);
  for (let changed = true; changed;) {
    changed = false;
    for (const row of rows) if (!keep.has(row.pid) && keep.has(row.ppid)) { keep.add(row.pid); changed = true; }
  }
  return rows.filter((row) => keep.has(row.pid)).map((row) => ({ pid: row.pid, kind: kindOf(row.command, row.pid === rootPid), rss: row.rss }));
}

const FOOTPRINT = process.platform === "darwin" && existsSync("/usr/bin/footprint");
async function footprints(pids) {
  if (!FOOTPRINT || !pids.length) return {};
  const out = await run("/usr/bin/footprint", ["--noCategories", "-f", "bytes", ...pids.flatMap((pid) => ["-p", String(pid)])]);
  const result = {};
  let pid = null;
  for (const line of out.split("\n")) {
    const head = line.match(/\[(\d+)\]:.*Footprint:\s*(\d+)\s*B/);
    if (head) { pid = Number(head[1]); result[pid] = { footprint: Number(head[2]) }; continue; }
    const aux = line.match(/^\s*(phys_footprint(?:_peak)?):\s*(\d+)\s*B/);
    if (aux && pid !== null) result[pid][aux[1]] = Number(aux[2]);
  }
  return result;
}

export function startDesktopMemorySampler({ rootPid, everyMs = 500, footprintEveryMs = 2000, label = () => null }) {
  const samples = [];
  const footprintSamples = [];
  const started = Date.now();
  let stopped = false;
  let lastFootprint = 0;
  const loop = (async () => {
    while (!stopped) {
      const t0 = Date.now();
      try {
        const processes = await tree(rootPid);
        if (processes.length) {
          const rss = {};
          const byKind = {};
          for (const p of processes) {
            rss[`${p.kind}#${p.pid}`] = p.rss;
            byKind[p.kind] = (byKind[p.kind] || 0) + p.rss;
          }
          samples.push({ t: t0 - started, at: new Date(t0).toISOString(), label: label(), rss, byKind, total: processes.reduce((a, p) => a + p.rss, 0) });
          if (FOOTPRINT && t0 - lastFootprint >= footprintEveryMs) {
            lastFootprint = t0;
            const wanted = processes.filter((p) => ["browser", "gpu", "renderer"].includes(p.kind));
            const values = await footprints(wanted.map((p) => p.pid));
            const entry = { t: t0 - started, at: new Date(t0).toISOString(), label: label(), processes: {} };
            for (const p of wanted) if (values[p.pid]) entry.processes[`${p.kind}#${p.pid}`] = values[p.pid];
            footprintSamples.push(entry);
          }
        }
      } catch { /* a process went away mid-sample */ }
      const wait = everyMs - (Date.now() - t0);
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    }
  })();
  return {
    samples, footprintSamples,
    async stop() { stopped = true; await loop; return this.result(); },
    result() {
      return {
        method: `RSS (ps) of the browser process started by the runner and of every process under it, every ${everyMs} ms, bytes, keyed <kind>#<pid> (kind from Chrome's --type= switch)`
          + (FOOTPRINT ? `; phys_footprint and phys_footprint_peak (footprint(1)) of the browser, GPU and renderer processes, every ${footprintEveryMs} ms — GPU memory a process owns counts in its footprint, not in its RSS` : ""),
        rootPid, samples, footprint: FOOTPRINT ? footprintSamples : null,
      };
    },
  };
}

// The largest value seen, per kind of process, over the samples (optionally one label only): RSS and
// phys_footprint as sampled; over the whole run also phys_footprint_peak, the kernel's own peak for
// the life of each process (it can catch a spike between two samples).
export function peaks(result, wanted = null) {
  const pick = (list) => (wanted === null ? list : list.filter((s) => s.label === wanted));
  const rss = {};
  for (const s of pick(result.samples || [])) for (const [kind, bytes] of Object.entries(s.byKind || {})) rss[kind] = Math.max(rss[kind] || 0, bytes);
  const footprint = {};
  const lifetimePeak = {};
  for (const s of pick(result.footprint || [])) {
    for (const [key, value] of Object.entries(s.processes || {})) {
      const kind = key.split("#")[0];
      footprint[kind] = Math.max(footprint[kind] || 0, value.phys_footprint || value.footprint || 0);
      if (wanted === null) lifetimePeak[kind] = Math.max(lifetimePeak[kind] || 0, value.phys_footprint_peak || 0);
    }
  }
  return wanted === null ? { rss, footprint, footprintLifetimePeak: lifetimePeak } : { rss, footprint };
}
