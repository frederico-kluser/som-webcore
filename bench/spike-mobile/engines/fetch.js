// Fetch helper shared by the engines: reports progress and keeps a log of what was downloaded.
// Byte counts for the run report come from Resource Timing (app.js), not from here.

export function createFetcher(onProgress = () => {}) {
  const log = [];
  async function fetchResource(url, kind = "bytes") {
    const started = performance.now();
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`GET ${url} failed: HTTP ${response.status}`);
    let value;
    if (kind === "json") {
      value = await response.json();
    } else {
      const total = Number(response.headers.get("Content-Length")) || 0;
      const reader = response.body.getReader();
      const chunks = [];
      let loaded = 0;
      for (;;) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        chunks.push(chunk);
        loaded += chunk.length;
        onProgress(url, loaded, total);
      }
      value = new Uint8Array(loaded);
      let offset = 0;
      for (const chunk of chunks) { value.set(chunk, offset); offset += chunk.length; }
    }
    log.push({ url, kind, ms: performance.now() - started });
    return value;
  }
  return { fetchResource, log };
}
