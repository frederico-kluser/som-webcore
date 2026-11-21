// Engine: ONNX Runtime Web running the published TS-Ettin ONNX graphs (the head is inside the graph).
//   backend "wasm"   -> onnxruntime-web/wasm   (ort-wasm-simd-threaded.wasm)
//   backend "webgpu" -> onnxruntime-web/webgpu (ort-wasm-simd-threaded.asyncify.wasm, the native
//                       WebGPU provider); nodes the WebGPU provider lacks run on the Wasm CPU provider.
//   backend "webgpu-jsep" -> onnxruntime-web (default entry; ort-wasm-simd-threaded.jsep.wasm, the
//                       JavaScript WebGPU provider)
// Inputs: ids, pad_mask, opt_positions, opt_mask, qtype; outputs: logits, conf_logit (decision_ai.json).

const DIST = "/node_modules/onnxruntime-web/dist/";
const ENTRY = { wasm: "ort.wasm.min.mjs", webgpu: "ort.webgpu.min.mjs", "webgpu-jsep": "ort.min.mjs" };

export function createOrtEngine({ backend = "wasm", modelUrl, threads = 1, optimization = "all" }) {
  let ort = null;
  let session = null;
  let modelBytes = 0;

  return {
    name: `ort-${backend}`,
    async load({ fetchResource }) {
      if (!ENTRY[backend]) throw new Error(`unknown ONNX Runtime backend ${backend}`);
      ort = await import(DIST + ENTRY[backend]);
      ort.env.wasm.wasmPaths = new URL(DIST, location.href).href;
      ort.env.wasm.numThreads = threads;
      ort.env.logLevel = "warning";
      const bytes = await fetchResource(modelUrl, "bytes");
      modelBytes = bytes.length;
      session = await ort.InferenceSession.create(bytes, {
        executionProviders: [backend.startsWith("webgpu") ? "webgpu" : "wasm"],
        graphOptimizationLevel: optimization, // "all" by default; "basic"/"disabled" to isolate fused kernels
      });
    },
    async score(batch) {
      const { B, L, K } = batch;
      const int64 = (a) => BigInt64Array.from(a, (x) => BigInt(x));
      const feeds = {
        ids: new ort.Tensor("int64", int64(batch.ids), [B, L]),
        pad_mask: new ort.Tensor("bool", batch.mask, [B, L]),
        opt_positions: new ort.Tensor("int64", int64(batch.positions), [B, K]),
        opt_mask: new ort.Tensor("bool", batch.optMask, [B, K]),
        qtype: new ort.Tensor("int64", int64(batch.qtype), [B]),
      };
      const out = await session.run(feeds, ["logits"]);
      const logits = out.logits.data;
      const rows = [];
      for (let b = 0; b < B; b++) rows.push(Float32Array.from(logits.subarray(b * K, (b + 1) * K)));
      for (const t of Object.values(feeds)) t.dispose?.();
      out.logits.dispose?.();
      return rows;
    },
    describe() {
      return {
        runtime: "onnxruntime-web", version: ort?.env?.versions?.web ?? null, backend, entry: ENTRY[backend], graphOptimizationLevel: optimization,
        executionProviders: [backend.startsWith("webgpu") ? "webgpu" : "wasm"], threads: ort?.env?.wasm?.numThreads ?? threads,
        modelUrl, modelBytes, inputNames: session?.inputNames ?? null, outputNames: session?.outputNames ?? null,
      };
    },
    async dispose() { await session?.release?.(); session = null; },
  };
}
