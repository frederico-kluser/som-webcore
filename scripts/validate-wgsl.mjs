#!/usr/bin/env node
// Validates WGSL with Tint, the compiler inside Dawn (and Chrome), through the `webgpu` package.
//
// Usage:
//   node scripts/validate-wgsl.mjs            every *.wgsl in the repository (tracked or not ignored)
//   node scripts/validate-wgsl.mjs a.wgsl …   only these files
//
// WGSL that the engine assembles at run time (strings in JavaScript) is compiled by the same
// Tint when the WebGPU tests create their pipelines, inside an error scope that fails the test.
//
// Exit codes: 0 every file compiles · 1 at least one does not · 3 no WebGPU adapter.

import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileWgsl, requestDawnDevice } from '../packages/engine/test/helpers/dawn.js';

const root = fileURLToPath(new URL('..', import.meta.url));

function listWgsl() {
  const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', '*.wgsl'], {
    cwd: root,
    encoding: 'utf8',
  });
  return out.split('\n').filter(Boolean).map((f) => resolve(root, f));
}

const files = process.argv.length > 2 ? process.argv.slice(2).map((f) => resolve(f)) : listWgsl();
if (files.length === 0) {
  console.log('Nenhum arquivo .wgsl encontrado.');
  process.exit(0);
}

const ctx = await requestDawnDevice();
if ('reason' in ctx) {
  console.error(`Erro: ${ctx.reason} — Solução: rode num ambiente com WebGPU (na CI Linux, instale mesa-vulkan-drivers).`);
  process.exit(3);
}
console.log(`Tint via Dawn · adaptador: ${ctx.description}`);

let failed = 0;
for (const file of files) {
  const name = relative(root, file).replaceAll('\\', '/');
  const errors = await compileWgsl(ctx.device, await readFile(file, 'utf8'));
  if (errors.length === 0) {
    console.log(`OK   ${name}`);
  } else {
    failed += 1;
    for (const e of errors) console.log(`ERRO ${name}:${e}`);
  }
}
ctx.device.destroy();

if (failed > 0) {
  console.error(`Erro: ${failed} de ${files.length} arquivo(s) WGSL não compilam — Solução: corrija os erros acima.`);
  process.exit(1);
}
console.log(`${files.length} arquivo(s) WGSL válidos.`);
