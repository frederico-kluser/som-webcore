// The WGSL validator (scripts/validate-wgsl.mjs) must reject a broken shader: a CI that only
// ever sees valid WGSL cannot show that it would catch an invalid one.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { requestDawnDevice, webgpuRequired } from './helpers/dawn.js';

const script = fileURLToPath(new URL('../../../scripts/validate-wgsl.mjs', import.meta.url));
const kernel = fileURLToPath(new URL('./kernels/gemv_f16.wgsl', import.meta.url));

/** @param {string[]} args */
const run = (args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });

test('the validator accepts valid WGSL and rejects invalid WGSL', async (t) => {
  const ctx = await requestDawnDevice();
  if ('reason' in ctx) {
    if (webgpuRequired) assert.fail(`${ctx.reason} (SOM_REQUIRE_WEBGPU=1)`);
    t.skip(ctx.reason);
    return;
  }
  ctx.device.destroy();

  const ok = run([kernel]);
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);

  const dir = await mkdtemp(join(tmpdir(), 'som-wgsl-'));
  try {
    const broken = join(dir, 'broken.wgsl');
    await writeFile(broken, '@compute @workgroup_size(1)\nfn main() { let x: f32 = 1u; }\n');
    const bad = run([kernel, broken]);
    assert.equal(bad.status, 1, bad.stdout + bad.stderr);
    assert.match(bad.stdout + bad.stderr, /broken\.wgsl/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
