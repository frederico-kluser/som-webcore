// WebGPU parity on Dawn (P-03): the test-only FP16 GEMV kernel against the same math on the
// CPU. It proves the CI link "WGSL kernels on a software adapter" before K-02 brings the engine.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { requestDawnDevice, webgpuRequired } from './helpers/dawn.js';
import { fromHalfBits, packHalfPairs, toHalfBits } from './helpers/f16.js';
import { uniform } from './helpers/prng.js';

const ROWS = 96; // not a multiple of the workgroup size, so the bounds check runs
const COLS = 256;

test('FP16 GEMV on WebGPU matches the CPU in f32', async (t) => {
  const ctx = await requestDawnDevice();
  if ('reason' in ctx) {
    if (webgpuRequired) assert.fail(`${ctx.reason} (SOM_REQUIRE_WEBGPU=1)`);
    t.skip(ctx.reason);
    return;
  }
  const { device, description } = ctx;
  t.diagnostic(`adapter: ${description}`);

  const rand = uniform(17);
  const wValues = Float32Array.from({ length: ROWS * COLS }, () => rand());
  const x = Float32Array.from({ length: COLS }, () => rand());
  const b = Float32Array.from({ length: ROWS }, () => rand());
  const wPacked = packHalfPairs(wValues);

  // CPU: the weights as the GPU sees them (decoded from FP16), products and sums in f32.
  const expected = new Float32Array(ROWS);
  const scale = new Float64Array(ROWS);
  for (let r = 0; r < ROWS; r += 1) {
    let acc = 0;
    for (let c = 0; c < COLS; c += 1) {
      const w = fromHalfBits(toHalfBits(wValues[r * COLS + c]));
      acc = Math.fround(acc + Math.fround(w * x[c]));
      scale[r] += Math.abs(w * x[c]);
    }
    expected[r] = Math.fround(acc + b[r]);
    scale[r] += Math.abs(b[r]);
  }

  const code = await readFile(new URL('./kernels/gemv_f16.wgsl', import.meta.url), 'utf8');
  device.pushErrorScope('validation');
  const pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module: device.createShaderModule({ code }), entryPoint: 'main' },
  });
  /**
   * @param {Uint32Array | Float32Array} data
   * @param {number} usage
   */
  const upload = (data, usage) => {
    const buf = device.createBuffer({ size: data.byteLength, usage: usage | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(buf, 0, data);
    return buf;
  };
  const dims = upload(new Uint32Array([ROWS, COLS]), GPUBufferUsage.UNIFORM);
  const wBuf = upload(wPacked, GPUBufferUsage.STORAGE);
  const xBuf = upload(x, GPUBufferUsage.STORAGE);
  const bBuf = upload(b, GPUBufferUsage.STORAGE);
  const yBuf = device.createBuffer({ size: ROWS * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
  const readBuf = device.createBuffer({ size: ROWS * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [dims, wBuf, xBuf, bBuf, yBuf].map((buf, binding) => ({ binding, resource: { buffer: buf } })),
  });

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(ROWS / 64));
  pass.end();
  encoder.copyBufferToBuffer(yBuf, 0, readBuf, 0, ROWS * 4);
  device.queue.submit([encoder.finish()]);
  const validation = await device.popErrorScope();
  assert.equal(validation, null, validation?.message);

  await readBuf.mapAsync(GPUMapMode.READ);
  const got = new Float32Array(readBuf.getMappedRange().slice(0));
  readBuf.unmap();

  // Only the summation order (and FMA contraction) may differ: a few f32 ulps of Σ|terms|.
  let worst = 0;
  for (let r = 0; r < ROWS; r += 1) {
    const err = Math.abs(got[r] - expected[r]);
    worst = Math.max(worst, err / scale[r]);
    assert.ok(err <= 1e-5 * scale[r], `row ${r}: GPU ${got[r]} vs CPU ${expected[r]}`);
  }
  t.diagnostic(`max |Δ| / Σ|terms| = ${worst.toExponential(2)}`);

  for (const buf of [dims, wBuf, xBuf, bBuf, yBuf, readBuf]) buf.destroy();
  device.destroy();
});
