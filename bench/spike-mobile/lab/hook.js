// Device lab log hook. serve.mjs (lab mode) injects it as the first script of every HTML page of a
// lab session — the lab itself, the probe and the test pages, each a navigation of the tab — so whatever a page
// does on the device reaches the server: console output, errors (also failed resource loads),
// rejected promises, failed requests, WebGPU adapter/device events and the page lifecycle. Entries
// are batched to /api/lab/log every second and flushed with sendBeacon when the page goes away.
// It never throws and never changes what the page sees, apart from wrapping these functions.
(() => {
  "use strict";
  if (window.__somLab) return;
  const params = new URLSearchParams(location.search);
  const isTop = window.top === window;
  const source = (params.get("name") || location.pathname.split("/").pop() || "page") + (isTop ? "" : " (iframe)");
  const MAX_TEXT = 4000;
  const queue = [];
  let seq = 0;
  const realFetch = typeof window.fetch === "function" ? window.fetch.bind(window) : null;

  function text(value) {
    try {
      if (value instanceof Error) return `${value.name}: ${value.message}${value.stack ? `\n${value.stack}` : ""}`;
      if (typeof value === "string") return value;
      if (value === undefined) return "undefined";
      if (typeof value === "function") return `[function ${value.name || "anonymous"}]`;
      if (typeof Event !== "undefined" && value instanceof Event) return `[${value.type} event]`;
      const json = JSON.stringify(value, (_, v) => (typeof v === "bigint" ? `${v}n` : v));
      return json === undefined ? String(value) : json;
    } catch {
      try { return String(value); } catch { return "[unprintable]"; }
    }
  }

  function push(kind, level, data = {}) {
    try {
      const entry = { seq: seq++, t: Math.round(performance.now()), at: new Date().toISOString(), source, kind, level, ...data };
      if (typeof entry.text === "string" && entry.text.length > MAX_TEXT) entry.text = `${entry.text.slice(0, MAX_TEXT)}…`;
      queue.push(entry);
      if (queue.length >= 50) flush();
    } catch { /* never break the page */ }
  }

  // Beacons first: the browser delivers them even after the page is gone — a lab step removes its
  // iframe right after the page posts, and a fetch still in flight was being cancelled with it.
  // Each beacon stays under the 64 KiB limit; a batch the beacon refuses goes by fetch.
  function flush() {
    while (queue.length) {
      const batch = [];
      let size = 2;
      while (queue.length && (batch.length === 0 || size + JSON.stringify(queue[0]).length < 60000)) {
        const entry = queue.shift();
        size += JSON.stringify(entry).length + 1;
        batch.push(entry);
      }
      const body = JSON.stringify(batch);
      try {
        if (navigator.sendBeacon && navigator.sendBeacon("/api/lab/log", new Blob([body], { type: "application/json" }))) continue;
        if (realFetch) realFetch("/api/lab/log", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: body.length < 60000 }).catch(() => {});
      } catch { /* ignore */ }
    }
  }
  setInterval(flush, 1000);

  // Console.
  for (const level of ["log", "info", "warn", "error", "debug", "trace"]) {
    const original = console[level];
    if (typeof original !== "function") continue;
    console[level] = function (...args) {
      push("console", level, { text: args.map(text).join(" ") });
      return original.apply(this, args);
    };
  }

  // Errors, also failed loads of scripts, images and links (capture phase).
  window.addEventListener("error", (event) => {
    const target = event.target;
    if (target && target !== window && (target.src || target.href)) push("resource-error", "error", { text: `${target.tagName} ${target.src || target.href}` });
    else push("error", "error", { text: `${event.message} @ ${event.filename}:${event.lineno}:${event.colno}`, stack: event.error && event.error.stack });
  }, true);
  window.addEventListener("unhandledrejection", (event) => push("unhandledrejection", "error", { text: text(event.reason) }));
  document.addEventListener("securitypolicyviolation", (event) => push("csp", "warn", { text: `${event.violatedDirective} ${event.blockedURI}` }));

  // Page lifecycle: a hidden page is throttled, and a reload or a crash shows up here.
  for (const type of ["pageshow", "pagehide", "freeze", "resume"]) {
    window.addEventListener(type, (event) => {
      push("lifecycle", "info", { text: type, persisted: event.persisted });
      if (type === "pagehide") {
        resourceSummary();
        flush();
      }
    });
  }
  document.addEventListener("visibilitychange", () => {
    push("lifecycle", "info", { text: `visibility ${document.visibilityState}` });
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("orientationchange", () => push("lifecycle", "info", { text: `orientation ${(screen.orientation && screen.orientation.type) || window.orientation}` }));

  // Requests that fail or answer with an error status (the lab's own log posts are left out).
  if (realFetch) {
    window.fetch = async function (input, init) {
      const url = typeof input === "string" ? input : input && input.url;
      const started = performance.now();
      try {
        const response = await realFetch(input, init);
        if (!response.ok && !String(url).includes("/api/lab/")) push("fetch", "warn", { text: `${response.status} ${url}`, ms: Math.round(performance.now() - started) });
        return response;
      } catch (error) {
        push("fetch", "error", { text: `${url}: ${text(error)}`, ms: Math.round(performance.now() - started) });
        throw error;
      }
    };
  }

  // WebGPU: what the adapter and the device say, device loss and uncaptured errors.
  try {
    if (navigator.gpu && typeof navigator.gpu.requestAdapter === "function") {
      const requestAdapter = navigator.gpu.requestAdapter.bind(navigator.gpu);
      navigator.gpu.requestAdapter = async (options) => {
        try {
          const adapter = await requestAdapter(options);
          const info = adapter && adapter.info ? { vendor: adapter.info.vendor, architecture: adapter.info.architecture, device: adapter.info.device, description: adapter.info.description } : null;
          push("webgpu", adapter ? "info" : "warn", { text: `requestAdapter(${text(options || {})}) → ${adapter ? text(info || "adapter") : "null"}` });
          if (adapter && typeof adapter.requestDevice === "function") {
            const requestDevice = adapter.requestDevice.bind(adapter);
            adapter.requestDevice = async (descriptor) => {
              try {
                const device = await requestDevice(descriptor);
                push("webgpu", "info", { text: `requestDevice → ok; features: ${[...device.features].sort().join(", ")}` });
                device.lost.then((lost) => push("webgpu", lost.reason === "destroyed" ? "info" : "error", { text: `device lost: ${lost.reason} ${lost.message}` }));
                device.addEventListener("uncapturederror", (event) => push("webgpu", "error", { text: `uncaptured ${event.error && event.error.constructor && event.error.constructor.name}: ${event.error && event.error.message}` }));
                return device;
              } catch (error) {
                push("webgpu", "error", { text: `requestDevice failed: ${text(error)}` });
                throw error;
              }
            };
          }
          return adapter;
        } catch (error) {
          push("webgpu", "error", { text: `requestAdapter failed: ${text(error)}` });
          throw error;
        }
      };
    }
  } catch (error) {
    push("hook", "warn", { text: `WebGPU hook not installed: ${text(error)}` });
  }

  // What the page loaded, in short, when it goes away (the test page keeps the full list itself).
  let summarized = false;
  function resourceSummary() {
    if (summarized) return;
    summarized = true;
    try {
      const resources = performance.getEntriesByType("resource");
      const byType = {};
      for (const entry of resources) {
        const key = entry.initiatorType || "other";
        byType[key] ??= { count: 0, transferSize: 0, encodedBodySize: 0 };
        byType[key].count += 1;
        byType[key].transferSize += entry.transferSize || 0;
        byType[key].encodedBodySize += entry.encodedBodySize || 0;
      }
      const navigation = performance.getEntriesByType("navigation")[0];
      push("performance", "info", {
        text: `resources: ${resources.length}`,
        byType,
        navigation: navigation ? { type: navigation.type, domContentLoaded: Math.round(navigation.domContentLoadedEventEnd), load: Math.round(navigation.loadEventEnd), transferSize: navigation.transferSize } : null,
      });
    } catch { /* ignore */ }
  }

  // A lab step is a page of its own (lab.js navigates to it with ?labstep=): keep the screen on, and
  // go back to the lab once the page has posted its result, or when the step's time is up.
  const labStep = params.get("labstep");
  let reloaded = false;
  try { reloaded = performance.getEntriesByType("navigation")[0]?.type === "reload"; } catch { /* no Navigation Timing */ }
  if (labStep && isTop && reloaded) {
    // A step page is never reloaded on purpose; Safari reloads a page whose web process crashed (ONNX
    // Runtime WebGPU on the iPhone did that twice in a row). Stop before the page's own scripts run the
    // step again and tell the lab.
    push("lab", "warn", { text: `step ${labStep}: the page came back as a reload (the web process crashed); back to the lab without running it again` });
    try { window.stop(); } catch { /* keep going */ }
    flush();
    location.replace(`/lab/lab.html?continue=1&labcrashed=${encodeURIComponent(labStep)}`);
  } else if (labStep && isTop) {
    const limit = Number(params.get("labtimeout") || 420) * 1000;
    let leaving = false;
    const backToLab = (extra) => {
      if (leaving) return;
      leaving = true;
      flush();
      setTimeout(() => location.replace(`/lab/lab.html?continue=1${extra}`), 400);
    };
    try {
      if (navigator.wakeLock) navigator.wakeLock.request("screen").then(() => push("lab", "info", { text: "wake lock on" }), (error) => push("lab", "warn", { text: `wake lock: ${error.name}` }));
    } catch { /* not available */ }
    setInterval(() => {
      if (document.title === "posted" || document.title === "post failed") backToLab("");
    }, 500);
    setTimeout(() => {
      push("lab", "warn", { text: `step ${labStep} reached its time limit (${limit / 1000} s)` });
      backToLab(`&labtimedout=${encodeURIComponent(labStep)}`);
    }, limit);
  }

  window.__somLab = { push, flush, source };
  push("lifecycle", "info", { text: `start ${location.pathname}${location.search.replace(/([?&])t=[^&]*/g, "$1t=…")}`, userAgent: navigator.userAgent, top: isTop, secureContext: window.isSecureContext, crossOriginIsolated: window.crossOriginIsolated === true });
})();
