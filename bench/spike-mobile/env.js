// Environment description shared by every page of the spike: browser, WebGPU, WebAssembly.
// Reports what the browser exposes; never infers capabilities from version numbers.

// Smallest modules that validate only with the feature (from the WebAssembly feature-detection set).
const WASM_SIMD = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);
const WASM_THREADS = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0, 5, 4, 1, 3, 1, 1, 10, 11, 1, 9, 0, 65, 0, 254, 16, 2, 0, 26, 11]);
const WASM_RELAXED_SIMD = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 15, 1, 13, 0, 65, 1, 253, 15, 65, 2, 253, 15, 253, 128, 2, 11]);

function validates(bytes) {
  try { return WebAssembly.validate(bytes); } catch { return false; }
}

async function describeWebGpu() {
  const gpu = { hasNavigatorGpu: typeof navigator !== "undefined" && !!navigator.gpu };
  if (!gpu.hasNavigatorGpu) return gpu;
  try {
    gpu.preferredCanvasFormat = navigator.gpu.getPreferredCanvasFormat?.();
    gpu.wgslLanguageFeatures = navigator.gpu.wgslLanguageFeatures ? [...navigator.gpu.wgslLanguageFeatures].sort() : null;
  } catch (error) { gpu.navigatorError = String(error?.message ?? error); }
  for (const powerPreference of ["high-performance", "low-power"]) {
    const entry = {};
    try {
      const adapter = await navigator.gpu.requestAdapter({ powerPreference });
      entry.adapter = adapter !== null;
      if (adapter) {
        const info = adapter.info ?? (await adapter.requestAdapterInfo?.());
        entry.info = info ? { vendor: info.vendor, architecture: info.architecture, device: info.device, description: info.description, isFallbackAdapter: info.isFallbackAdapter, subgroupMinSize: info.subgroupMinSize, subgroupMaxSize: info.subgroupMaxSize } : null;
        entry.isFallbackAdapter = adapter.isFallbackAdapter;
        entry.features = [...adapter.features].sort();
        const limits = {};
        for (const key in adapter.limits) limits[key] = adapter.limits[key];
        entry.limits = limits;
        try {
          const device = await adapter.requestDevice();
          entry.device = true;
          device.destroy();
        } catch (error) { entry.deviceError = `${error?.name}: ${error?.message}`; }
      }
    } catch (error) {
      entry.error = `${error?.name}: ${error?.message}`;
    }
    gpu[powerPreference] = entry;
  }
  return gpu;
}

// The GPU behind WebGL tells software rendering (SwiftShader) from the host GPU on the emulator.
function describeWebGl() {
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    if (!gl) return null;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    };
  } catch (error) { return { error: String(error?.message ?? error) }; }
}

export async function probeEnvironment() {
  const env = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: navigator.deviceMemory ?? null,
    isSecureContext,
    crossOriginIsolated,
    screen: { width: screen.width, height: screen.height, devicePixelRatio },
    connection: navigator.connection ? { effectiveType: navigator.connection.effectiveType, saveData: navigator.connection.saveData } : null,
    hasDecisionModel: typeof globalThis.DecisionModel !== "undefined",
    wasm: {
      simd: validates(WASM_SIMD),
      threads: validates(WASM_THREADS) && typeof SharedArrayBuffer !== "undefined",
      relaxedSimd: validates(WASM_RELAXED_SIMD),
      jspi: typeof WebAssembly.Suspending === "function",
      sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
    },
    float16Array: typeof globalThis.Float16Array === "function",
    performanceMemory: performance.memory ? { jsHeapSizeLimit: performance.memory.jsHeapSizeLimit } : null,
    measureUserAgentSpecificMemory: typeof performance.measureUserAgentSpecificMemory === "function",
  };
  try {
    env.userAgentData = await navigator.userAgentData?.getHighEntropyValues(["fullVersionList", "platform", "platformVersion", "architecture", "model", "mobile"]);
  } catch (error) { env.userAgentDataError = String(error?.message ?? error); }
  env.webgl = describeWebGl();
  env.webgpu = await describeWebGpu();
  return env;
}
