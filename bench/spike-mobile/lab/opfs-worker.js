// Device lab, memory profile (lab/memoria.js, experiments "opfs-streaming" and "opfs-monolitico"): the
// OPFS side of the streaming test (forensic report 2026-11-22, X5), in a dedicated Worker, where
// FileSystemSyncAccessHandle lives. It writes the test files in fixed chunks (chunk k holds the 32-bit
// value k + 1 everywhere, so a GPU kernel can check what it read) and reads them back on request into
// buffers the page lends it (transferred both ways, so nothing piles up). Without a sync access
// handle it falls back to createWritable() for writing and file.stream() for reading, and says which
// path ran. Protocol: { id, cmd, ... } in, { id, ok: true, ... } or { id, error } out.
"use strict";

const state = { handle: null, async: false, path: null, reader: null, position: 0, pending: null, size: 0 };
const isPromise = (v) => v && typeof v.then === "function";
const call = async (fn) => { const v = fn(); return isPromise(v) ? await v : v; };
const has = (name) => typeof FileSystemFileHandle === "function" && name in FileSystemFileHandle.prototype;

async function root() { return navigator.storage.getDirectory(); }

async function closeAll() {
  if (state.handle) { try { await call(() => state.handle.close()); } catch { /* already closed */ } }
  if (state.reader) { try { await state.reader.cancel(); } catch { /* ignore */ } }
  Object.assign(state, { handle: null, reader: null, path: null, position: 0, pending: null, size: 0 });
}

async function write({ name, bytes, chunk, mode }) {
  await closeAll();
  const dir = await root();
  try { await dir.removeEntry(name); } catch { /* not there */ }
  const fh = await dir.getFileHandle(name, { create: true });
  const buf = new ArrayBuffer(chunk);
  const words = new Uint32Array(buf);
  const u8 = new Uint8Array(buf);
  const started = performance.now();
  let maxChunkMs = 0;
  let path;
  let asyncMethods = null;
  if (mode !== "writable" && has("createSyncAccessHandle")) {
    path = "FileSystemSyncAccessHandle.write (Worker)";
    const handle = await fh.createSyncAccessHandle();
    asyncMethods = isPromise(handle.getSize());
    try {
      for (let at = 0, k = 0; at < bytes; at += chunk, k++) {
        const n = Math.min(chunk, bytes - at);
        words.fill(k + 1);
        const t0 = performance.now();
        await call(() => handle.write(n === chunk ? u8 : u8.subarray(0, n), { at }));
        maxChunkMs = Math.max(maxChunkMs, performance.now() - t0);
      }
      await call(() => handle.flush());
    } finally {
      await call(() => handle.close());
    }
  } else if (has("createWritable")) {
    path = "FileSystemFileHandle.createWritable (Worker)";
    const writable = await fh.createWritable();
    for (let at = 0, k = 0; at < bytes; at += chunk, k++) {
      const n = Math.min(chunk, bytes - at);
      words.fill(k + 1);
      const t0 = performance.now();
      // A copy per chunk: some implementations keep the view until close().
      await writable.write(u8.slice(0, n));
      maxChunkMs = Math.max(maxChunkMs, performance.now() - t0);
    }
    await writable.close();
  } else {
    throw new Error("no way to write to OPFS here: neither createSyncAccessHandle nor createWritable");
  }
  const ms = performance.now() - started;
  const size = (await fh.getFile()).size;
  return { path, ms: Math.round(ms), bytes: size, chunks: Math.ceil(bytes / chunk), maxChunkMs: Math.round(maxChunkMs * 100) / 100, syncHandleMethodsReturnPromises: asyncMethods };
}

async function open({ name, mode }) {
  await closeAll();
  const dir = await root();
  const fh = await dir.getFileHandle(name);
  if (mode !== "stream" && has("createSyncAccessHandle")) {
    state.handle = await fh.createSyncAccessHandle();
    state.async = isPromise(state.handle.getSize());
    state.size = await call(() => state.handle.getSize());
    state.path = "FileSystemSyncAccessHandle.read (Worker)";
  } else {
    const file = await fh.getFile();
    state.reader = file.stream().getReader();
    state.size = file.size;
    state.position = 0;
    state.path = "File.stream() (Worker, re-chunked)";
  }
  return { path: state.path, size: state.size, syncHandleMethodsReturnPromises: state.handle ? state.async : null };
}

// One chunk, into the buffer the page lent. The stream path only reads forward, in order.
async function read({ at, n, buf }) {
  const target = new Uint8Array(buf, 0, n);
  const started = performance.now();
  let got = 0;
  if (state.handle) {
    got = await call(() => state.handle.read(target, { at }));
  } else if (state.reader) {
    if (at !== state.position) throw new Error(`stream read out of order: at ${at}, position ${state.position}`);
    while (got < n) {
      if (state.pending && state.pending.length) {
        const take = Math.min(n - got, state.pending.length);
        target.set(state.pending.subarray(0, take), got);
        state.pending = state.pending.subarray(take);
        got += take;
        continue;
      }
      const { done, value } = await state.reader.read();
      if (done) break;
      state.pending = value;
    }
    state.position += got;
  } else {
    throw new Error("no file open");
  }
  return { at, n: got, buf, ms: performance.now() - started };
}

async function remove({ name }) {
  await closeAll();
  const dir = await root();
  try { await dir.removeEntry(name); return { removed: true }; } catch (error) { return { removed: false, why: `${error.name}: ${error.message}` }; }
}

self.onmessage = async (event) => {
  const message = event.data || {};
  const { id, cmd } = message;
  try {
    let result;
    if (cmd === "probe") result = { syncAccessHandle: has("createSyncAccessHandle"), createWritable: has("createWritable"), stream: typeof Blob === "function" && "stream" in Blob.prototype };
    else if (cmd === "write") result = await write(message);
    else if (cmd === "open") result = await open(message);
    else if (cmd === "read") {
      result = await read(message);
      self.postMessage({ id, ok: true, ...result }, [result.buf]);
      return;
    } else if (cmd === "close") { await closeAll(); result = { closed: true }; }
    else if (cmd === "remove") result = await remove(message);
    else if (cmd === "estimate") result = { estimate: await navigator.storage.estimate() };
    else throw new Error(`unknown command ${cmd}`);
    self.postMessage({ id, ok: true, ...result });
  } catch (error) {
    // A buffer lent for a failed read goes back too, so the page's pool stays whole.
    const transfer = message.buf && message.buf.byteLength ? [message.buf] : [];
    self.postMessage({ id, error: `${error && error.name}: ${error && error.message}`, buf: transfer.length ? message.buf : undefined }, transfer);
  }
};
