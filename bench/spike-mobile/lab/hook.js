// Device lab log hook. serve.mjs (lab mode) injects it as the first script of every HTML page of a
// lab session — the lab itself, the probe, the test pages and the memory pages, each a navigation of
// the tab — so whatever a page does on the device reaches the server: console output, errors (also
// failed resource loads), rejected promises, failed requests, the page lifecycle and two ledgers:
//   - the GPU ledger wraps the WebGPU prototypes (GPU, GPUAdapter, GPUDevice, GPUBuffer, GPUTexture,
//     GPUQueue), so every adapter, device and buffer of the page is seen — also ONNX Runtime's own
//     device, which the old wrapper on navigator.gpu missed (forensic report 2026-11-22, 4.2) — with
//     the live bytes per device, created/destroyed/collected counts and device.lost for every device;
//   - the Wasm ledger wraps the WebAssembly.Memory constructor (initial, maximum, shared, the exact
//     error), Memory.prototype.grow, compilation and instantiation (memories a module defines and
//     exports), with the live memories and their bytes.
// It also gives the pages crash-proof markers: mark() writes the marker to localStorage and sends it
// with sendBeacon BEFORE a risky step, so the lab can say where a page was when Safari killed the tab.
// Entries are batched to /api/lab/log every second and flushed with sendBeacon when the page goes
// away. It never throws and never changes what the page sees, apart from wrapping these functions.
(() => {
  "use strict";
  if (window.__somLab) return;
  const params = new URLSearchParams(location.search);
  const isTop = window.top === window;
  const source = (params.get("name") || location.pathname.split("/").pop() || "page") + (isTop ? "" : " (iframe)");
  const labStep = params.get("labstep");
  const labAttempt = Number(params.get("labattempt") || 0) || null;
  const pageId = Math.random().toString(36).slice(2, 10);
  const MAX_TEXT = 4000;
  const MARKER_KEY = "somLab.marker";
  const PARTIAL_KEY = "somLab.partial";
  const MiB = 1 << 20;
  const queue = [];
  let seq = 0;
  const realFetch = typeof window.fetch === "function" ? window.fetch.bind(window) : null;
  const now = () => Math.round(performance.now());
  const mib = (bytes) => Math.round((bytes / MiB) * 100) / 100;

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
  const errorText = (error) => {
    try { return `${error && error.name ? error.name : typeof error}: ${error && error.message !== undefined ? error.message : String(error)}`; } catch { return "[unprintable error]"; }
  };

  function push(kind, level, data = {}) {
    try {
      const entry = { seq: seq++, t: now(), at: new Date().toISOString(), source, kind, level, ...data };
      if (typeof entry.text === "string" && entry.text.length > MAX_TEXT) entry.text = `${entry.text.slice(0, MAX_TEXT)}…`;
      queue.push(entry);
      if (queue.length >= 50) flush();
    } catch { /* never break the page */ }
  }

  // Beacons first: the browser delivers them even after the page is gone. Each beacon stays under the
  // 64 KiB limit; a batch the beacon refuses goes by fetch.
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

  // ---------------------------------------------------------------------------------------------
  // GPU ledger. Prototype wrappers: an own property on navigator.gpu (the old hook) is lost when
  // WebKit recreates the object's wrapper, and other code never goes through it.
  const gpu = {
    wrapped: [], adapters: 0, adapterNull: 0, devicesCreated: 0, deviceFailures: 0, live: 0, peak: 0, peakAt: null,
    buffers: { created: 0, destroyed: 0, collected: 0, thrown: 0, bytesCreated: 0 },
    textures: { created: 0, destroyed: 0, collected: 0, thrown: 0, bytesCreated: 0, estimated: true },
    writeBuffer: { calls: 0, bytes: 0 }, submits: 0, lost: [], uncaptured: 0, devices: [],
  };
  const deviceRec = new WeakMap(); // GPUDevice -> record
  const queueRec = new WeakMap();  // GPUQueue -> record
  const resourceMeta = new WeakMap(); // GPUBuffer | GPUTexture -> { rec, size, kind, destroyed, collected }
  const gpuRegistry = typeof FinalizationRegistry === "function" ? new FinalizationRegistry((meta) => release(meta, "collected")) : null;

  function bumpPeak() {
    if (gpu.live > gpu.peak) { gpu.peak = gpu.live; gpu.peakAt = now(); }
  }
  function recFor(device) {
    let rec = deviceRec.get(device);
    if (!rec) rec = registerDevice(device, null, "seen first at createBuffer/createTexture");
    return rec;
  }
  function registerDevice(device, descriptor, note) {
    const rec = {
      id: gpu.devices.length + 1, createdAt: now(), note: note || null, label: (descriptor && descriptor.label) || device.label || null,
      requiredFeatures: descriptor && descriptor.requiredFeatures ? [...descriptor.requiredFeatures] : [],
      requiredLimits: descriptor && descriptor.requiredLimits ? { ...descriptor.requiredLimits } : {},
      live: 0, peak: 0, buffers: { created: 0, destroyed: 0, collected: 0, live: 0 }, textures: { created: 0, destroyed: 0, collected: 0, live: 0 },
      writeBytes: 0, writeCalls: 0, submits: 0, destroyedAt: null, liveAtDestroy: null, lost: null,
    };
    deviceRec.set(device, rec);
    gpu.devices.push(rec);
    try { queueRec.set(device.queue, rec); } catch { /* no queue */ }
    try {
      device.lost.then((info) => {
        rec.lost = { reason: info && info.reason, message: info && info.message, at: now() };
        gpu.lost.push({ device: rec.id, reason: rec.lost.reason, message: rec.lost.message, at: rec.lost.at });
        push("webgpu", rec.lost.reason === "destroyed" ? "info" : "error", { text: `device lost: ${rec.lost.reason} ${rec.lost.message || ""}`.trim(), device: rec.id, ledger: summary() });
      });
    } catch { /* no lost promise */ }
    try {
      device.addEventListener("uncapturederror", (event) => {
        gpu.uncaptured += 1;
        const error = event.error;
        push("webgpu", "error", { text: `uncaptured ${error && error.constructor && error.constructor.name}: ${error && error.message}`, device: rec.id });
      });
    } catch { /* no events */ }
    return rec;
  }
  // A texture's bytes, estimated from its descriptor (format table below; unknown formats count 4 B).
  const TEXEL = {
    r8unorm: 1, r8snorm: 1, r8uint: 1, r8sint: 1, stencil8: 1, r16uint: 2, r16sint: 2, r16float: 2, rg8unorm: 2, rg8snorm: 2, rg8uint: 2, rg8sint: 2, depth16unorm: 2,
    r32uint: 4, r32sint: 4, r32float: 4, rg16uint: 4, rg16sint: 4, rg16float: 4, rgba8unorm: 4, "rgba8unorm-srgb": 4, rgba8snorm: 4, rgba8uint: 4, rgba8sint: 4,
    bgra8unorm: 4, "bgra8unorm-srgb": 4, rgb10a2unorm: 4, rgb10a2uint: 4, rg11b10ufloat: 4, rgb9e5ufloat: 4, depth24plus: 4, "depth24plus-stencil8": 4, depth32float: 4,
    "depth32float-stencil8": 5, rg32uint: 8, rg32sint: 8, rg32float: 8, rgba16uint: 8, rgba16sint: 8, rgba16float: 8, rgba32uint: 16, rgba32sint: 16, rgba32float: 16,
  };
  function textureBytes(descriptor) {
    try {
      const size = descriptor.size;
      const w = Array.isArray(size) ? size[0] : (size.width ?? 1);
      const h = Array.isArray(size) ? (size[1] ?? 1) : (size.height ?? 1);
      const d = Array.isArray(size) ? (size[2] ?? 1) : (size.depthOrArrayLayers ?? 1);
      const texel = TEXEL[descriptor.format] ?? 4;
      let total = 0;
      for (let level = 0, mw = w, mh = h; level < (descriptor.mipLevelCount || 1); level++, mw = Math.max(1, mw >> 1), mh = Math.max(1, mh >> 1)) total += mw * mh * d * texel;
      return total * (descriptor.sampleCount || 1);
    } catch { return 0; }
  }
  function track(device, resource, kind, size, extra) {
    const rec = recFor(device);
    const meta = { rec, kind, size, destroyed: false, collected: false, ...extra };
    resourceMeta.set(resource, meta);
    if (gpuRegistry) gpuRegistry.register(resource, meta);
    const counters = kind === "buffer" ? gpu.buffers : gpu.textures;
    counters.created += 1;
    counters.bytesCreated += size;
    rec[kind === "buffer" ? "buffers" : "textures"].created += 1;
    rec[kind === "buffer" ? "buffers" : "textures"].live += 1;
    rec.live += size;
    if (rec.live > rec.peak) rec.peak = rec.live;
    gpu.live += size;
    bumpPeak();
  }
  function release(meta, how) {
    if (!meta || meta.destroyed || meta.collected) return;
    meta[how] = true;
    // A destroyed device already gave back everything it owned (see the device wrapper).
    if (meta.rec.destroyedAt !== null) return;
    const counters = meta.kind === "buffer" ? gpu.buffers : gpu.textures;
    counters[how === "destroyed" ? "destroyed" : "collected"] += 1;
    const per = meta.rec[meta.kind === "buffer" ? "buffers" : "textures"];
    per[how === "destroyed" ? "destroyed" : "collected"] += 1;
    per.live -= 1;
    meta.rec.live -= meta.size;
    gpu.live -= meta.size;
  }
  function wrapProto(Ctor, name, make) {
    try {
      const proto = Ctor && Ctor.prototype;
      const desc = proto && Object.getOwnPropertyDescriptor(proto, name);
      if (!desc || typeof desc.value !== "function") return false;
      Object.defineProperty(proto, name, { ...desc, value: make(desc.value) });
      gpu.wrapped.push(`${Ctor.name}.${name}`);
      return true;
    } catch { return false; }
  }
  try {
    if (typeof GPU === "function") {
      wrapProto(GPU, "requestAdapter", (original) => function requestAdapter() {
        const options = arguments[0];
        return original.apply(this, arguments).then((adapter) => {
          gpu.adapters += 1;
          if (!adapter) gpu.adapterNull += 1;
          const info = adapter && adapter.info ? { vendor: adapter.info.vendor, architecture: adapter.info.architecture, device: adapter.info.device, description: adapter.info.description } : null;
          push("webgpu", adapter ? "info" : "warn", { text: `requestAdapter(${text(options || {})}) → ${adapter ? text(info || "adapter") : "null"}` });
          return adapter;
        }, (error) => {
          push("webgpu", "error", { text: `requestAdapter failed: ${text(error)}` });
          throw error;
        });
      });
    }
    if (typeof GPUAdapter === "function") {
      wrapProto(GPUAdapter, "requestDevice", (original) => function requestDevice() {
        const descriptor = arguments[0];
        return original.apply(this, arguments).then((device) => {
          gpu.devicesCreated += 1;
          const rec = registerDevice(device, descriptor, null);
          push("webgpu", "info", { text: `requestDevice → ok (device ${rec.id}); features: ${[...device.features].sort().join(", ")}`, device: rec.id, requiredLimits: rec.requiredLimits });
          return device;
        }, (error) => {
          gpu.deviceFailures += 1;
          push("webgpu", "error", { text: `requestDevice failed: ${text(error)}` });
          throw error;
        });
      });
    }
    if (typeof GPUDevice === "function") {
      wrapProto(GPUDevice, "createBuffer", (original) => function createBuffer(descriptor) {
        let buffer;
        try { buffer = original.apply(this, arguments); } catch (error) {
          gpu.buffers.thrown += 1;
          push("webgpu", "error", { text: `createBuffer(${descriptor && descriptor.size}) threw ${errorText(error)}` });
          throw error;
        }
        try { track(this, buffer, "buffer", Number(descriptor && descriptor.size) || 0, { usage: descriptor && descriptor.usage, mappedAtCreation: !!(descriptor && descriptor.mappedAtCreation) }); } catch { /* ignore */ }
        return buffer;
      });
      wrapProto(GPUDevice, "createTexture", (original) => function createTexture(descriptor) {
        let texture;
        try { texture = original.apply(this, arguments); } catch (error) {
          gpu.textures.thrown += 1;
          push("webgpu", "error", { text: `createTexture threw ${errorText(error)}` });
          throw error;
        }
        try { track(this, texture, "texture", textureBytes(descriptor || {}), { format: descriptor && descriptor.format }); } catch { /* ignore */ }
        return texture;
      });
      wrapProto(GPUDevice, "destroy", (original) => function destroy() {
        try {
          const rec = deviceRec.get(this);
          if (rec && rec.destroyedAt === null) {
            // The device takes its resources with it (the implementation may free them now): what was
            // still alive is kept in liveAtDestroy and leaves the live total.
            rec.destroyedAt = now();
            rec.liveAtDestroy = rec.live;
            rec.resourcesAtDestroy = { buffers: rec.buffers.live, textures: rec.textures.live };
            gpu.live -= rec.live;
            rec.live = 0;
            rec.buffers.live = 0;
            rec.textures.live = 0;
          }
        } catch { /* ignore */ }
        return original.apply(this, arguments);
      });
    }
    if (typeof GPUBuffer === "function") {
      wrapProto(GPUBuffer, "destroy", (original) => function destroy() {
        try { release(resourceMeta.get(this), "destroyed"); } catch { /* ignore */ }
        return original.apply(this, arguments);
      });
    }
    if (typeof GPUTexture === "function") {
      wrapProto(GPUTexture, "destroy", (original) => function destroy() {
        try { release(resourceMeta.get(this), "destroyed"); } catch { /* ignore */ }
        return original.apply(this, arguments);
      });
    }
    if (typeof GPUQueue === "function") {
      wrapProto(GPUQueue, "writeBuffer", (original) => function writeBuffer(buffer, bufferOffset, data, dataOffset, size) {
        try {
          const unit = ArrayBuffer.isView(data) && data.BYTES_PER_ELEMENT ? data.BYTES_PER_ELEMENT : 1;
          const bytes = size !== undefined ? size * unit : (data.byteLength - (dataOffset || 0) * unit);
          gpu.writeBuffer.calls += 1;
          gpu.writeBuffer.bytes += bytes;
          const rec = queueRec.get(this);
          if (rec) { rec.writeCalls += 1; rec.writeBytes += bytes; }
        } catch { /* ignore */ }
        return original.apply(this, arguments);
      });
      wrapProto(GPUQueue, "submit", (original) => function submit() {
        gpu.submits += 1;
        try { const rec = queueRec.get(this); if (rec) rec.submits += 1; } catch { /* ignore */ }
        return original.apply(this, arguments);
      });
    }
  } catch (error) {
    push("hook", "warn", { text: `WebGPU ledger not installed: ${text(error)}` });
  }

  // ---------------------------------------------------------------------------------------------
  // Wasm ledger.
  const WA = typeof WebAssembly === "object" && WebAssembly ? WebAssembly : null;
  const OriginalMemory = WA && WA.Memory;
  const wasm = {
    wrapped: [], created: 0, failed: 0, collected: 0, grows: 0, growFailures: 0, compiles: 0, compileBytes: 0, compileMs: 0,
    instances: 0, instantiateFailures: 0, exportedMemories: 0, peakBytes: 0, peakAt: null, lastError: null, memories: [],
  };
  const memoryRefs = []; // { ref: WeakRef<Memory>, rec }
  const memorySeen = new WeakSet();
  const wasmRegistry = typeof FinalizationRegistry === "function" ? new FinalizationRegistry((rec) => { rec.collectedAt = now(); wasm.collected += 1; }) : null;
  const isShared = (buffer) => {
    try { return typeof SharedArrayBuffer === "function" ? buffer instanceof SharedArrayBuffer : Object.prototype.toString.call(buffer) === "[object SharedArrayBuffer]"; } catch { return null; }
  };
  function wasmLive() {
    let live = 0;
    let bytes = 0;
    for (let i = memoryRefs.length - 1; i >= 0; i--) {
      const memory = memoryRefs[i].ref.deref();
      if (!memory) { memoryRefs.splice(i, 1); continue; }
      live += 1;
      try { bytes += memory.buffer.byteLength; } catch { /* detached */ }
    }
    if (bytes > wasm.peakBytes) { wasm.peakBytes = bytes; wasm.peakAt = now(); }
    return { live, bytes };
  }
  function trackMemory(memory, rec) {
    memorySeen.add(memory);
    try { rec.bytes = memory.buffer.byteLength; rec.sharedBuffer = isShared(memory.buffer); } catch { /* ignore */ }
    // WeakRef keeps the ledger from holding memories alive; without it (old engines) the ledger
    // would pin them, so it does not track liveness at all.
    if (typeof WeakRef === "function") memoryRefs.push({ ref: new WeakRef(memory), rec });
    if (wasmRegistry) wasmRegistry.register(memory, rec);
    if (wasm.memories.length < 256) wasm.memories.push(rec);
    wasmLive();
  }
  function onInstance(instance, how) {
    try {
      wasm.instances += 1;
      const exports = instance && instance.exports ? Object.values(instance.exports) : [];
      for (const value of exports) {
        if (OriginalMemory && value instanceof OriginalMemory && !memorySeen.has(value)) {
          wasm.exportedMemories += 1;
          trackMemory(value, { n: wasm.created + wasm.failed + wasm.exportedMemories, source: `defined and exported by a module (${how})`, at: now(), ok: true, initial: null, maximum: null, shared: null });
        }
      }
    } catch { /* ignore */ }
  }
  try {
    if (OriginalMemory) {
      WA.Memory = new Proxy(OriginalMemory, {
        construct(target, args, newTarget) {
          const descriptor = args[0] || {};
          const rec = {
            n: wasm.created + wasm.failed + wasm.exportedMemories + 1, source: "new WebAssembly.Memory", at: now(), page: pageId,
            initial: descriptor.initial ?? descriptor.minimum ?? null, maximum: descriptor.maximum ?? null, shared: !!descriptor.shared,
          };
          const started = performance.now();
          try {
            const memory = Reflect.construct(target, args, newTarget);
            rec.ok = true;
            rec.ms = Math.round((performance.now() - started) * 100) / 100;
            wasm.created += 1;
            trackMemory(memory, rec);
            return memory;
          } catch (error) {
            rec.ok = false;
            rec.error = errorText(error);
            wasm.failed += 1;
            wasm.lastError = rec;
            if (wasm.memories.length < 256) wasm.memories.push(rec);
            push("wasm", "warn", { text: `new WebAssembly.Memory(${text(descriptor)}) threw ${rec.error}`, ledger: summary() });
            throw error;
          }
        },
      });
      wasm.wrapped.push("WebAssembly.Memory");
      const growDescriptor = Object.getOwnPropertyDescriptor(OriginalMemory.prototype, "grow");
      const grow = growDescriptor && growDescriptor.value;
      if (typeof grow === "function") {
        Object.defineProperty(OriginalMemory.prototype, "grow", {
          ...growDescriptor,
          value: function grow(delta) {
            const before = (() => { try { return this.buffer.byteLength; } catch { return null; } })();
            try {
              const result = growDescriptor.value.apply(this, arguments);
              wasm.grows += 1;
              wasmLive();
              return result;
            } catch (error) {
              wasm.growFailures += 1;
              wasm.lastError = { source: "Memory.prototype.grow", at: now(), delta, before, error: errorText(error) };
              push("wasm", "warn", { text: `Memory.grow(${delta}) from ${before} B threw ${errorText(error)}` });
              throw error;
            }
          },
        });
        wasm.wrapped.push("WebAssembly.Memory.prototype.grow");
      }
    }
    if (WA) {
      const timeCompile = (name) => {
        const original = WA[name];
        if (typeof original !== "function") return;
        WA[name] = function () {
          const started = performance.now();
          const bytes = arguments[0] && arguments[0].byteLength;
          return original.apply(this, arguments).then((result) => {
            wasm.compiles += 1;
            wasm.compileMs += performance.now() - started;
            if (bytes) wasm.compileBytes += bytes;
            return result;
          });
        };
        wasm.wrapped.push(`WebAssembly.${name}`);
      };
      timeCompile("compile");
      timeCompile("compileStreaming");
      for (const name of ["instantiate", "instantiateStreaming"]) {
        const original = WA[name];
        if (typeof original !== "function") continue;
        WA[name] = function () {
          const started = performance.now();
          const bytes = arguments[0] && arguments[0].byteLength;
          return original.apply(this, arguments).then((result) => {
            const isInstance = typeof WA.Instance === "function" && result instanceof WA.Instance;
            if (!isInstance) {
              wasm.compiles += 1;
              wasm.compileMs += performance.now() - started;
              if (bytes) wasm.compileBytes += bytes;
            }
            onInstance(isInstance ? result : result && result.instance, name);
            return result;
          }, (error) => {
            wasm.instantiateFailures += 1;
            wasm.lastError = { source: `WebAssembly.${name}`, at: now(), error: errorText(error) };
            push("wasm", "warn", { text: `WebAssembly.${name} failed: ${errorText(error)}` });
            throw error;
          });
        };
        wasm.wrapped.push(`WebAssembly.${name}`);
      }
      if (typeof WA.Instance === "function") {
        WA.Instance = new Proxy(WA.Instance, {
          construct(target, args, newTarget) {
            const instance = Reflect.construct(target, args, newTarget);
            onInstance(instance, "new WebAssembly.Instance");
            return instance;
          },
        });
        wasm.wrapped.push("WebAssembly.Instance");
      }
    }
  } catch (error) {
    push("hook", "warn", { text: `Wasm ledger not installed: ${text(error)}` });
  }

  // ---------------------------------------------------------------------------------------------
  // Snapshots: summary() is small (markers, traces), snapshot() has every device and memory.
  function summary() {
    const memories = wasmLive();
    let devicesAlive = 0;
    for (const rec of gpu.devices) if (rec.destroyedAt === null && !rec.lost) devicesAlive += 1;
    return {
      gpu: {
        devices: devicesAlive, devicesCreated: gpu.devicesCreated, liveMiB: mib(gpu.live), peakMiB: mib(gpu.peak),
        buffers: gpu.buffers.created, destroyed: gpu.buffers.destroyed, collected: gpu.buffers.collected,
        textures: gpu.textures.created, writeMiB: mib(gpu.writeBuffer.bytes), submits: gpu.submits,
        lost: gpu.lost.filter((l) => l.reason !== "destroyed").length,
      },
      wasm: {
        live: memories.live, created: wasm.created, failed: wasm.failed, collected: wasm.collected, liveMiB: mib(memories.bytes),
        peakMiB: mib(wasm.peakBytes), instances: wasm.instances, lastError: wasm.lastError ? wasm.lastError.error : null,
      },
    };
  }
  function snapshot(maxMemories = 256) {
    const memories = wasmLive();
    return {
      at: new Date().toISOString(), t: now(),
      gpu: {
        wrapped: gpu.wrapped, adapters: gpu.adapters, adapterNull: gpu.adapterNull, devicesCreated: gpu.devicesCreated, deviceFailures: gpu.deviceFailures,
        liveBytes: gpu.live, peakBytes: gpu.peak, peakAt: gpu.peakAt, buffers: { ...gpu.buffers }, textures: { ...gpu.textures },
        writeBuffer: { ...gpu.writeBuffer }, submits: gpu.submits, uncaptured: gpu.uncaptured, lost: gpu.lost.slice(),
        devices: gpu.devices.map((rec) => ({ ...rec, buffers: { ...rec.buffers }, textures: { ...rec.textures } })),
      },
      wasm: {
        wrapped: wasm.wrapped, created: wasm.created, failed: wasm.failed, collected: wasm.collected, live: memories.live, liveBytes: memories.bytes,
        peakBytes: wasm.peakBytes, peakAt: wasm.peakAt, grows: wasm.grows, growFailures: wasm.growFailures, compiles: wasm.compiles,
        compileBytes: wasm.compileBytes, compileMs: Math.round(wasm.compileMs), instances: wasm.instances, instantiateFailures: wasm.instantiateFailures,
        exportedMemories: wasm.exportedMemories, lastError: wasm.lastError, memories: wasm.memories.slice(0, maxMemories).map((m) => ({ ...m })),
      },
    };
  }
  function ledgerText(s = summary()) {
    return `gpu ${s.gpu.liveMiB} MiB vivos (pico ${s.gpu.peakMiB}; ${s.gpu.buffers} buffers, ${s.gpu.destroyed} destruídos; ${s.gpu.devices} dispositivo(s)${s.gpu.lost ? `, ${s.gpu.lost} perdido(s)` : ""}) · wasm ${s.wasm.live} memória(s), ${s.wasm.liveMiB} MiB (${s.wasm.created} criadas, ${s.wasm.failed} falhas)`;
  }
  // Logged periodically (when it changed) and when the page goes away.
  let lastLogged = "";
  setInterval(() => {
    try {
      const s = summary();
      const key = JSON.stringify(s);
      if (key === lastLogged) return;
      lastLogged = key;
      push("ledger", "info", { text: ledgerText(s), ledger: s });
    } catch { /* ignore */ }
  }, 5000);

  // ---------------------------------------------------------------------------------------------
  // Crash-proof markers: written BEFORE a risky step, to localStorage (it survives the web process)
  // and by sendBeacon (it leaves the page at once). After Safari kills the tab, the lab reads both.
  let markerCount = 0;
  let lastMarker = null;
  function mark(data = {}, options = {}) {
    try {
      const entry = {
        seq: seq++, t: now(), at: new Date().toISOString(), source, kind: "marker", level: "info", step: labStep, attempt: labAttempt, page: pageId,
        n: ++markerCount, text: options.text || text(data).slice(0, 300), data, ledger: options.ledger === false ? undefined : summary(),
      };
      if (options.announce) entry.announce = true;
      try { localStorage.setItem(MARKER_KEY, JSON.stringify(entry)); } catch { /* storage full or blocked */ }
      let sent = false;
      try { sent = !!(navigator.sendBeacon && navigator.sendBeacon("/api/lab/log", new Blob([JSON.stringify([entry])], { type: "application/json" }))); } catch { /* ignore */ }
      if (!sent) queue.push(entry);
      lastMarker = entry;
      return entry;
    } catch { return null; }
  }
  // A page's partial result, so a step that dies still reports what it measured before.
  function checkpoint(report) {
    try { localStorage.setItem(PARTIAL_KEY, JSON.stringify({ step: labStep, attempt: labAttempt, page: pageId, at: new Date().toISOString(), report })); } catch { /* too big or blocked */ }
  }
  function readStored(key) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
  }

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
        try { push("ledger", "info", { text: `final: ${ledgerText()}`, ledger: snapshot(32) }); } catch { /* ignore */ }
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
  let reloaded = false;
  try { reloaded = performance.getEntriesByType("navigation")[0]?.type === "reload"; } catch { /* no Navigation Timing */ }
  if (labStep && isTop && reloaded) {
    // A step page is never reloaded on purpose; Safari reloads a page whose web process crashed (ONNX
    // Runtime WebGPU on the iPhone did that twice in a row; the memory pages die on purpose). Stop
    // before the page's own scripts run the step again and tell the lab, with the last marker.
    const marker = readStored(MARKER_KEY);
    const own = marker && marker.step === labStep ? marker : null;
    push("lab", "warn", { text: `step ${labStep}: the page came back as a reload (the web process crashed); back to the lab without running it again${own ? `; last marker: ${own.text}` : ""}`, lastMarker: own });
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

  window.__somLab = {
    push, flush, source, mark, checkpoint, pageId, step: labStep, attempt: labAttempt,
    lastMarker: () => lastMarker, storedMarker: () => readStored(MARKER_KEY), storedPartial: () => readStored(PARTIAL_KEY),
    ledger: { summary, snapshot, text: ledgerText },
  };
  push("lifecycle", "info", { text: `start ${location.pathname}${location.search.replace(/([?&])t=[^&]*/g, "$1t=…")}`, userAgent: navigator.userAgent, top: isTop, secureContext: window.isSecureContext, crossOriginIsolated: window.crossOriginIsolated === true, ledgers: { gpu: gpu.wrapped, wasm: wasm.wrapped } });
})();
