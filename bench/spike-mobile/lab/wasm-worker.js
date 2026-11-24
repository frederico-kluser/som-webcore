// Device lab, memory profile (lab/memoria.js, experiment "vagas", variant "ort"): counts how many Wasm
// memories with a given descriptor a dedicated Worker can create, holding every one, and reports the
// exact error of the first that fails. The page then terminates this Worker and counts again on its
// own side: if terminate() gives the slots back, ONNX Runtime's Worker proxy (env.wasm.proxy) would be
// a way around Safari's per-process ceiling (forensic report 2026-11-22, X2).
"use strict";
self.onmessage = (event) => {
  const { desc, max } = event.data || {};
  const held = [];
  const attempts = [];
  let error = null;
  for (let k = 1; k <= (max || 16); k++) {
    const started = performance.now();
    try {
      held.push(new WebAssembly.Memory(desc));
      attempts.push({ k, ok: true, ms: Math.round((performance.now() - started) * 100) / 100 });
    } catch (e) {
      error = `${e && e.name}: ${e && e.message}`;
      attempts.push({ k, ok: false, ms: Math.round((performance.now() - started) * 100) / 100, error });
      break;
    }
  }
  self.held = held; // kept alive until terminate()
  self.postMessage({ ok: held.length, error, attempts, sharedArrayBuffer: typeof SharedArrayBuffer === "function" });
};
