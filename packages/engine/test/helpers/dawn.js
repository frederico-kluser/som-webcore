// WebGPU in Node through Dawn (the `webgpu` package): the software-adapter link of the
// oracle chain (METHODOLOGY §6). In CI, SOM_REQUIRE_WEBGPU=1 turns "no adapter" into a
// failure instead of a skip — the upstream CI skipped silently, and that is what we avoid.

import { create, globals } from 'webgpu';

export const webgpuRequired = process.env.SOM_REQUIRE_WEBGPU === '1';

// The GPU object must outlive every adapter and device made from it: if the garbage collector
// takes it, Dawn's instance goes away under them and the process crashes (seen on Windows/D3D12).
/** @type {GPU[]} */
const keepAlive = [];

/**
 * @typedef {{ adapter: GPUAdapter, device: GPUDevice, description: string }} DawnContext
 */

/**
 * Requests a Dawn adapter and device. Resolves to `{ reason }` when there is none.
 * @returns {Promise<DawnContext | { reason: string }>}
 */
export async function requestDawnDevice() {
  let gpu;
  try {
    Object.assign(globalThis, globals);
    gpu = create([]);
    keepAlive.push(gpu);
  } catch (error) {
    return { reason: `Dawn did not load: ${error instanceof Error ? error.message : String(error)}` };
  }
  const adapter = await gpu.requestAdapter();
  if (!adapter) return { reason: 'Dawn found no WebGPU adapter' };
  const device = await adapter.requestDevice();
  const info = adapter.info ?? {};
  const description = [info.vendor, info.architecture, info.device, info.description]
    .filter(Boolean)
    .join(' · ') || 'unknown adapter';
  return { adapter, device, description };
}

/**
 * Compiles WGSL with the device's compiler (Tint, in Dawn) and returns the error messages.
 * @param {GPUDevice} device
 * @param {string} code
 * @returns {Promise<string[]>}
 */
export async function compileWgsl(device, code) {
  device.pushErrorScope('validation');
  const module = device.createShaderModule({ code });
  const info = await module.getCompilationInfo();
  const scopeError = await device.popErrorScope();
  const errors = info.messages
    .filter((m) => m.type === 'error')
    .map((m) => `${m.lineNum}:${m.linePos} ${m.message}`);
  if (errors.length === 0 && scopeError) errors.push(scopeError.message);
  return errors;
}
