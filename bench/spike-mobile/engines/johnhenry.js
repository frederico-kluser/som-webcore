// Engine: the @johnhenry ModernBERT encoder (CPU in JavaScript, or WebGPU in WGSL) loading the
// TS-Ettin weights from model.safetensors; the decision head runs on the host, in doubles:
//   h = hidden[pos] + type_embedding[qtype];  logit = Linear(GELU(Linear(LayerNorm(h))))
// (dinah.py: scorer = LayerNorm -> Dropout -> Linear -> GELU -> Linear; LayerNorm eps 1e-5).

import { createCpuBackend, erf } from "@johnhenry/backend-cpu";
import { readSafetensors } from "@johnhenry/math-plus-safetensors";
import { loadModernBert, parseModernBertConfig, safetensorsWeights } from "@johnhenry/modernbert";
import { toF32 } from "@johnhenry/tensor-backend";

export function createJohnhenryEngine({ backend = "cpu", dtype = "f32", modelUrl, config }) {
  let device = null;
  let model = null;
  let head = null;
  let modelBytes = 0;
  const H = config.hidden_size;

  return {
    name: `jh-${backend}`,
    async load({ fetchResource }) {
      if (backend === "webgpu") {
        const { createWebGpuBackend } = await import("@johnhenry/backend-webgpu");
        device = await createWebGpuBackend({ preferF16: dtype === "f16" });
      } else if (backend === "cpu") {
        if (dtype !== "f32") throw new Error("the CPU backend computes in f32 only");
        device = createCpuBackend();
      } else {
        throw new Error(`unknown backend ${backend}`);
      }
      const bytes = await fetchResource(modelUrl, "bytes");
      modelBytes = bytes.length;
      const file = readSafetensors(bytes);
      model = await loadModernBert(device, parseModernBertConfig(config), safetensorsWeights(file), { dtype, prefix: "encoder." });
      head = {
        type: Float64Array.from(file.toF32("type_embedding.weight")),
        lnW: Float64Array.from(file.toF32("scorer.0.weight")),
        lnB: Float64Array.from(file.toF32("scorer.0.bias")),
        w1: Float64Array.from(file.toF32("scorer.2.weight")),
        b1: Float64Array.from(file.toF32("scorer.2.bias")),
        w2: Float64Array.from(file.toF32("scorer.4.weight")),
        b2: file.toF32("scorer.4.bias")[0],
      };
    },
    async score(batch) {
      const { B, L, K } = batch;
      const hiddenTensor = await model.forward(batch.ids, batch.mask, B, L);
      const host = await device.read(hiddenTensor);
      device.dispose(hiddenTensor);
      const hidden = toF32(host);
      const x = new Float64Array(H);
      const y = new Float64Array(H);
      const rows = [];
      for (let b = 0; b < B; b++) {
        const logits = new Float32Array(K);
        const q = batch.qtype[b];
        for (let j = 0; j < K; j++) {
          if (!batch.optMask[b * K + j]) continue;
          const base = (b * L + batch.positions[b * K + j]) * H;
          let mean = 0;
          for (let d = 0; d < H; d++) { x[d] = hidden[base + d] + head.type[q * H + d]; mean += x[d]; }
          mean /= H;
          let variance = 0;
          for (let d = 0; d < H; d++) variance += (x[d] - mean) ** 2;
          const inv = 1 / Math.sqrt(variance / H + 1e-5);
          for (let d = 0; d < H; d++) x[d] = (x[d] - mean) * inv * head.lnW[d] + head.lnB[d];
          for (let o = 0; o < H; o++) {
            let u = head.b1[o];
            const row = o * H;
            for (let d = 0; d < H; d++) u += head.w1[row + d] * x[d];
            y[o] = 0.5 * u * (1 + erf(u / Math.SQRT2));
          }
          let logit = head.b2;
          for (let d = 0; d < H; d++) logit += head.w2[d] * y[d];
          logits[j] = logit;
        }
        rows.push(logits);
      }
      return rows;
    },
    describe() {
      return { runtime: "@johnhenry/modernbert", backend, dtype, modelUrl, modelBytes, deviceName: device?.name ?? null };
    },
    async dispose() { model?.dispose(); model = null; device?.destroy?.(); },
  };
}
