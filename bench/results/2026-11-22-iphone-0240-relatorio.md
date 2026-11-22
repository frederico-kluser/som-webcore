# Laboratório de aparelho — sessão `2026-11-22-iphone-0240`

> Gerado por `bench/spike-mobile/lab/analyze.py` a partir dos arquivos da sessão em `bench/results/`. Aparelho: **iphone**; perfil `completo`; modo `local`; início 2026-11-22T05:41:04.826Z; fim 2026-11-22T05:43:52.339Z. Tudo **[MEDIDO no aparelho]**; os limites do portão GT são **[ALVO]** do roadmap.

## Aparelho e navegador

| Item | Valor |
|---|---|
| Navegador | `Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.3 Mobile/15E148 Safari/604.1` |
| Tela | 390×844 @3x; núcleos lógicos 4; `deviceMemory` None |
| Contexto seguro | True; isolado (sonda com COOP/COEP): True |
| WebAssembly | SIMD True; SIMD relaxado False; JSPI False; threads False (isolado: True) |
| WebGPU | `navigator.gpu` True; adaptador True {"vendor": "apple", "architecture": "apple", "device": "apple", "description": "apple", "isFallbackAdapter": false}; dispositivo True  |
| Teste de computação WebGPU | 1048576 floats, 8 ms, 0 divergências; `shader-f16`: True (compilação: []) |
| WebGL | Apple GPU (WebGL 1.0) |
| Armazenamento | quota 41,232 MB; OPFS True; IndexedDB True |
| APIs presentes | navigator.gpu, wakeLock, caches, serviceWorker, Worker, OffscreenCanvas, Atomics.waitAsync, Float16Array, CompressionStream, WebTransport, VideoDecoder (WebCodecs) |
| Resolução de `performance.now()` | 1 ms |

## Etapas

| Etapa | Estado | Tentativas | Início | Fim | Nota | Tentativas anteriores |
|---|---|---:|---|---|---|---|
| `sonda` | posted (environment-probe) | 1 | 2026-11-22T05:41:04.826Z | 2026-11-22T05:41:06.662Z | — | — |
| `ambiente` | ok | 1 | 2026-11-22T05:41:06.686Z | 2026-11-22T05:41:06.797Z | — | — |
| `ort-wasm-int8-17m` | posted (ok) | 1 | 2026-11-22T05:41:06.809Z | 2026-11-22T05:41:21.991Z | — | — |
| `ort-wasm-8bit-17m` | posted (ok) | 1 | 2026-11-22T05:41:22.015Z | 2026-11-22T05:41:38.835Z | — | — |
| `ort-wasm-fp32-17m` | posted (ok) | 1 | 2026-11-22T05:41:38.858Z | 2026-11-22T05:41:57.500Z | — | — |
| `ort-wasm-q8emb-f16-17m` | posted (failed) | 1 | 2026-11-22T05:41:57.521Z | 2026-11-22T05:41:59.103Z | no available backend found. ERR: [wasm] RangeError: Out of memory | — |
| `ort-wasm-q8emb32-f16-17m` | posted (failed) | 1 | 2026-11-22T05:41:59.128Z | 2026-11-22T05:42:00.557Z | no available backend found. ERR: [wasm] RangeError: Out of memory | — |
| `ort-wasm-int8-32m` | posted (failed) | 1 | 2026-11-22T05:42:00.582Z | 2026-11-22T05:42:03.174Z | no available backend found. ERR: [wasm] RangeError: Out of memory | — |
| `ort-wasm-8bit-32m` | posted (failed) | 1 | 2026-11-22T05:42:03.199Z | 2026-11-22T05:42:05.625Z | no available backend found. ERR: [wasm] RangeError: Out of memory | — |
| `ort-webgpu-fp32-17m` | posted (failed) | 1 | 2026-11-22T05:42:05.649Z | 2026-11-22T05:42:09.211Z | no available backend found. ERR: [webgpu] RangeError: Out of memory | — |
| `ort-webgpu-q8emb32-f16-17m` | posted (failed) | 1 | 2026-11-22T05:42:09.238Z | 2026-11-22T05:42:10.830Z | no available backend found. ERR: [webgpu] RangeError: Out of memory | — |
| `jh-webgpu-f32-17m` | posted (ok) | 1 | 2026-11-22T05:42:10.859Z | 2026-11-22T05:42:17.390Z | — | — |
| `jh-webgpu-f16-17m` | posted (ok) | 1 | 2026-11-22T05:42:17.413Z | 2026-11-22T05:42:22.445Z | — | — |
| `jh-cpu-f32-17m` | posted (ok) | 1 | 2026-11-22T05:42:22.468Z | 2026-11-22T05:43:35.689Z | — | — |
| `ort-wasm-8bit-17m-debug` | posted (failed) | 1 | 2026-11-22T05:43:35.727Z | 2026-11-22T05:43:37.159Z | no available backend found. ERR: [wasm] RangeError: Out of memory | — |
| `ort-wasm-q8emb32-f16-17m-resistencia-200` | posted (failed) | 1 | 2026-11-22T05:43:37.183Z | 2026-11-22T05:43:38.617Z | no available backend found. ERR: [wasm] RangeError: Out of memory | — |
| `jh-webgpu-f32-17m-resistencia-200` | posted (ok) | 1 | 2026-11-22T05:43:38.644Z | 2026-11-22T05:43:47.628Z | — | — |
| `ort-webgpu-8bit-17m` | posted (failed) | 1 | 2026-11-22T05:43:47.655Z | 2026-11-22T05:43:49.092Z | no available backend found. ERR: [webgpu] RangeError: Out of memory | — |
| `ort-webgpu-int8-17m` | posted (failed) | 1 | 2026-11-22T05:43:49.116Z | 2026-11-22T05:43:50.604Z | no available backend found. ERR: [webgpu] RangeError: Out of memory | — |
| `sonda-coi` | posted (environment-probe) | 1 | 2026-11-22T05:43:50.636Z | 2026-11-22T05:43:52.313Z | — | — |

## Página de teste

A latência é a do aparelho. Os pesos ficam em cache entre as etapas da sessão (`cache=1`), então o tempo até a primeira resposta não é o de uma primeira visita.

| Execução | Motor | Variante | Modelo | Estado | 1ª resposta (ms) | 1ª passada p50 (ms) | Quente p50 / p95 / p99 (ms) | Quente p50 / p95: ≤ 128 tokens · > 128 (ms) | 1ª visita (MB) | Heap JS máx. (MB) | Memória máx. (MB; PSS no Android, RSS no simulador iOS) | máx. \|Δp\| · top-1 | Falha |
|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| `2026-11-22-iphone-0240-ort-wasm-int8-17m` | ort-wasm | int8 | ts-ettin-17m | ok | 464 | 42.0 | 44.0 / 282.3 / 410.5 | 44.0 / 91.0 · 299.0 / 446.6 | — | — | — | 4.1e-01 · 93/156 | — |
| `2026-11-22-iphone-0240-ort-wasm-8bit-17m` | ort-wasm | 8bit | ts-ettin-17m | ok | 479 | 50.0 | 50.0 / 309.2 / 437.4 | 50.0 / 99.4 · 320.0 / 484.2 | — | — | — | 4.5e-02 · 151/156 | — |
| `2026-11-22-iphone-0240-ort-wasm-fp32-17m` | ort-wasm | fp32 | ts-ettin-17m | ok | 2,471 | 44.0 | 45.0 / 344.2 / 510.3 | 45.0 / 96.0 · 350.0 / 570.1 | 68.38 | — | — | 1.6e-06 · 156/156 | — |
| `2026-11-22-iphone-0240-ort-wasm-q8emb-f16-17m` | ort-wasm | q8emb-f16 | ts-ettin-17m | failed | — | — | — / — / — | — | — | — | — | — | no available backend found. ERR: [wasm] RangeError: Out of memory |
| `2026-11-22-iphone-0240-ort-wasm-q8emb32-f16-17m` | ort-wasm | q8emb32-f16 | ts-ettin-17m | failed | — | — | — / — / — | — | — | — | — | — | no available backend found. ERR: [wasm] RangeError: Out of memory |
| `2026-11-22-iphone-0240-ort-wasm-int8-32m` | ort-wasm | int8 | ts-ettin-32m | failed | — | — | — / — / — | — | 32.49 | — | — | — | no available backend found. ERR: [wasm] RangeError: Out of memory |
| `2026-11-22-iphone-0240-ort-wasm-8bit-32m` | ort-wasm | 8bit | ts-ettin-32m | failed | — | — | — / — / — | — | 34.05 | — | — | — | no available backend found. ERR: [wasm] RangeError: Out of memory |
| `2026-11-22-iphone-0240-ort-webgpu-fp32-17m` | ort-webgpu | fp32 | ts-ettin-17m | failed | — | — | — / — / — | — | 68.38 | — | — | — | no available backend found. ERR: [webgpu] RangeError: Out of memory |
| `2026-11-22-iphone-0240-ort-webgpu-q8emb32-f16-17m` | ort-webgpu | q8emb32-f16 | ts-ettin-17m | failed | — | — | — / — / — | — | — | — | — | — | no available backend found. ERR: [webgpu] RangeError: Out of memory |
| `2026-11-22-iphone-0240-jh-webgpu-f32-17m` | jh-webgpu | f32 | ts-ettin-17m | ok | 2,025 | 9.5 | 10.0 / 71.0 / 106.4 | 10.0 / 22.0 · 76.0 / 113.3 | 67.48 | — | — | 1.3e-06 · 156/156 | — |
| `2026-11-22-iphone-0240-jh-webgpu-f16-17m` | jh-webgpu | f16 | ts-ettin-17m | ok | 2,089 | 8.0 | 5.0 / 29.0 / 42.0 | 5.0 / 9.0 · 30.0 / 46.2 | 67.48 | — | — | 1.5e-03 · 155/156 | — |
| `2026-11-22-iphone-0240-jh-cpu-f32-17m` | jh-cpu | f32 | ts-ettin-17m | ok | 2,229 | 206.0 | 223.0 / 1,600.3 / 2,419.9 | 220.0 / 472.0 · 1,804.0 / 2,595.9 | 67.48 | — | — | 1.1e-06 · 156/156 | — |
| `2026-11-22-iphone-0240-ort-wasm-8bit-17m-debug` | ort-wasm | 8bit | ts-ettin-17m | failed | — | — | — / — / — | — | — | — | — | — | no available backend found. ERR: [wasm] RangeError: Out of memory |
| `2026-11-22-iphone-0240-ort-wasm-q8emb32-f16-17m-resistencia-200` | ort-wasm | q8emb32-f16 | ts-ettin-17m | failed | — | — | — / — / — | — | — | — | — | — | no available backend found. ERR: [wasm] RangeError: Out of memory |
| `2026-11-22-iphone-0240-jh-webgpu-f32-17m-resistencia-200` | jh-webgpu | f32 | ts-ettin-17m | ok | 2,198 | 11.0 | — / — / — | — | 67.48 | — | — | 1.3e-06 · 156/156 | — |
| `2026-11-22-iphone-0240-ort-webgpu-8bit-17m` | ort-webgpu | 8bit | ts-ettin-17m | failed | — | — | — / — / — | — | — | — | — | — | no available backend found. ERR: [webgpu] RangeError: Out of memory |
| `2026-11-22-iphone-0240-ort-webgpu-int8-17m` | ort-webgpu | int8 | ts-ettin-17m | failed | — | — | — / — / — | — | — | — | — | — | no available backend found. ERR: [webgpu] RangeError: Out of memory |

**Paridade e forma**

| Execução | Variante | Contra a referência | Tolerância da variante | Contra o nativo (mesmo arquivo) | Forma |
|---|---|---|---|---|---|
| `ort-wasm-int8-17m` | int8 | 4.1e-01 · 93/156 | não cumpre (8 bits: Δp ≤ 0,03 e ≥ 99%) | 1.7e-01 · 133/156 | igual |
| `ort-wasm-8bit-17m` | 8bit | 4.5e-02 · 151/156 | não cumpre (8 bits: Δp ≤ 0,03 e ≥ 99%) | 1.2e-06 · 156/156 | igual |
| `ort-wasm-fp32-17m` | fp32 | 1.6e-06 · 156/156 | cumpre (FP32/FP16: Δp ≤ 1e-3) | 1.2e-06 · 156/156 | igual |
| `ort-wasm-q8emb-f16-17m` | q8emb-f16 | — | — | — | igual |
| `ort-wasm-q8emb32-f16-17m` | q8emb32-f16 | — | — | — | igual |
| `ort-wasm-int8-32m` | int8 | — | — | — | igual |
| `ort-wasm-8bit-32m` | 8bit | — | — | — | igual |
| `ort-webgpu-fp32-17m` | fp32 | — | — | — | igual |
| `ort-webgpu-q8emb32-f16-17m` | q8emb32-f16 | — | — | — | igual |
| `jh-webgpu-f32-17m` | f32 | 1.3e-06 · 156/156 | cumpre (FP32/FP16: Δp ≤ 1e-3) | — | igual |
| `jh-webgpu-f16-17m` | f16 | 1.5e-03 · 155/156 | não cumpre (FP32/FP16: Δp ≤ 1e-3) | — | igual |
| `jh-cpu-f32-17m` | f32 | 1.1e-06 · 156/156 | cumpre (FP32/FP16: Δp ≤ 1e-3) | — | igual |
| `ort-wasm-8bit-17m-debug` | 8bit | — | — | — | igual |
| `ort-wasm-q8emb32-f16-17m-resistencia-200` | q8emb32-f16 | — | — | — | igual |
| `jh-webgpu-f32-17m-resistencia-200` | f32 | 1.3e-06 · 156/156 | cumpre (FP32/FP16: Δp ≤ 1e-3) | — | igual |
| `ort-webgpu-8bit-17m` | 8bit | — | — | — | igual |
| `ort-webgpu-int8-17m` | int8 | — | — | — | igual |

## Critérios do portão GT neste aparelho (17M)

| Execução | Acerta igual? | Primeira visita até 25 MB? | p95 quente até 150 ms (iPhone e Android intermediário) **[ALVO]**? | 200 decisões sem falha? |
|---|---|---|---|---|
| `ort-wasm-int8-17m` | não cumpre (8 bits: Δp ≤ 0,03 e ≥ 99%) | — | 282.3 ms — não | — |
| `ort-wasm-8bit-17m` | não cumpre (8 bits: Δp ≤ 0,03 e ≥ 99%) | — | 309.2 ms — não | — |
| `ort-wasm-fp32-17m` | cumpre (FP32/FP16: Δp ≤ 1e-3) | 68.38 MB — não | 344.2 ms — não | — |
| `jh-webgpu-f32-17m` | cumpre (FP32/FP16: Δp ≤ 1e-3) | 67.48 MB — não | 71.0 ms — sim | — |
| `jh-webgpu-f16-17m` | não cumpre (FP32/FP16: Δp ≤ 1e-3) | 67.48 MB — não | 29.0 ms — sim | — |
| `jh-cpu-f32-17m` | cumpre (FP32/FP16: Δp ≤ 1e-3) | 67.48 MB — não | 1600.3 ms — não | — |
| `jh-webgpu-f32-17m-resistencia-200` | cumpre (FP32/FP16: Δp ≤ 1e-3) | 67.48 MB — não | — | 200/200, falhas 0 — sim |

## Logs

3882 entradas. Por tipo e nível: `trace`/info 3484; `lifecycle`/info 156; `webgpu`/info 123; `console`/info 60; `performance`/info 39; `lab`/warn 19; `error`/error 1.

**Erros** (os mais frequentes):

| Origem | Mensagem | Vezes |
|---|---|---:|
| `lab.html` | Script error. @ :0:0 | 1 |

**WebGPU** (eventos distintos):

- `2026-11-22-iphone-0240-sonda` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0240-sonda` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0240-sonda` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0240-sonda` — info: device lost: destroyed 
- `lab.html` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `lab.html` — info: requestDevice → ok; features: core-features-and-limits
- `lab.html` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `lab.html` — info: device lost: destroyed 
- `lab.html` — info: requestAdapter({}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `lab.html` — info: requestDevice → ok; features: core-features-and-limits, shader-f16
- `2026-11-22-iphone-0240-ort-wasm-int8-17m` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0240-ort-wasm-int8-17m` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0240-ort-wasm-int8-17m` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0240-ort-wasm-int8-17m` — info: device lost: destroyed 
- `2026-11-22-iphone-0240-ort-wasm-8bit-17m` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0240-ort-wasm-8bit-17m` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0240-ort-wasm-8bit-17m` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0240-ort-wasm-8bit-17m` — info: device lost: destroyed 
- `2026-11-22-iphone-0240-ort-wasm-fp32-17m` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0240-ort-wasm-fp32-17m` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0240-ort-wasm-fp32-17m` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0240-ort-wasm-fp32-17m` — info: device lost: destroyed 
- `2026-11-22-iphone-0240-ort-wasm-q8emb-f16-17m` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0240-ort-wasm-q8emb-f16-17m` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0240-ort-wasm-q8emb-f16-17m` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0240-ort-wasm-q8emb-f16-17m` — info: device lost: destroyed 
- `2026-11-22-iphone-0240-ort-wasm-q8emb32-f16-17m` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0240-ort-wasm-q8emb32-f16-17m` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0240-ort-wasm-q8emb32-f16-17m` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0240-ort-wasm-q8emb32-f16-17m` — info: device lost: destroyed 
- `2026-11-22-iphone-0240-ort-wasm-int8-32m` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0240-ort-wasm-int8-32m` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0240-ort-wasm-int8-32m` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0240-ort-wasm-int8-32m` — info: device lost: destroyed 
- `2026-11-22-iphone-0240-ort-wasm-8bit-32m` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0240-ort-wasm-8bit-32m` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0240-ort-wasm-8bit-32m` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0240-ort-wasm-8bit-32m` — info: device lost: destroyed 
- `2026-11-22-iphone-0240-ort-webgpu-fp32-17m` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0240-ort-webgpu-fp32-17m` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0240-ort-webgpu-fp32-17m` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0240-ort-webgpu-fp32-17m` — info: device lost: destroyed 
- `2026-11-22-iphone-0240-ort-webgpu-q8emb32-f16-17m` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0240-ort-webgpu-q8emb32-f16-17m` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0240-ort-webgpu-q8emb32-f16-17m` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0240-ort-webgpu-q8emb32-f16-17m` — info: device lost: destroyed 
- `2026-11-22-iphone-0240-jh-webgpu-f32-17m` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0240-jh-webgpu-f32-17m` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0240-jh-webgpu-f32-17m` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0240-jh-webgpu-f32-17m` — info: device lost: destroyed 
- `2026-11-22-iphone-0240-jh-webgpu-f16-17m` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0240-jh-webgpu-f16-17m` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0240-jh-webgpu-f16-17m` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0240-jh-webgpu-f16-17m` — info: device lost: destroyed 
- `2026-11-22-iphone-0240-jh-webgpu-f16-17m` — info: requestDevice → ok; features: core-features-and-limits, shader-f16
- `2026-11-22-iphone-0240-jh-cpu-f32-17m` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0240-jh-cpu-f32-17m` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0240-jh-cpu-f32-17m` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0240-jh-cpu-f32-17m` — info: device lost: destroyed 
- `2026-11-22-iphone-0240-ort-wasm-q8emb32-f16-17m-resistencia-200` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0240-ort-wasm-q8emb32-f16-17m-resistencia-200` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0240-ort-wasm-q8emb32-f16-17m-resistencia-200` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0240-ort-wasm-q8emb32-f16-17m-resistencia-200` — info: device lost: destroyed 
- `2026-11-22-iphone-0240-jh-webgpu-f32-17m-resistencia-200` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0240-jh-webgpu-f32-17m-resistencia-200` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0240-jh-webgpu-f32-17m-resistencia-200` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0240-jh-webgpu-f32-17m-resistencia-200` — info: device lost: destroyed 
- `2026-11-22-iphone-0240-ort-webgpu-8bit-17m` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0240-ort-webgpu-8bit-17m` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0240-ort-webgpu-8bit-17m` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0240-ort-webgpu-8bit-17m` — info: device lost: destroyed 
- `2026-11-22-iphone-0240-ort-webgpu-int8-17m` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0240-ort-webgpu-int8-17m` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0240-ort-webgpu-int8-17m` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0240-ort-webgpu-int8-17m` — info: device lost: destroyed 
- `2026-11-22-iphone-0240-sonda-coi` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0240-sonda-coi` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0240-sonda-coi` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0240-sonda-coi` — info: device lost: destroyed 

**Ciclo de vida:** a página ficou oculta 0 vez(es).

**Avisos** (os mais frequentes): “wake lock: NotAllowedError” ×19

## Rede

241 requisições respondidas; 473.70 MB enviados ao aparelho. As maiores:

| Caminho | Bytes | Tempo (ms) | MB/s |
|---|---:|---:|---:|
| `/models/derived/typestrict/TS-Ettin-17M/026af312e41d24a1126f8d927bb6314fc2d5f592/model_fp3` | 68,381,159 | 2036 | 33.6 |
| `/models/derived/typestrict/TS-Ettin-17M/026af312e41d24a1126f8d927bb6314fc2d5f592/model_fp3` | 68,381,159 | 1758 | 38.9 |
| `/models/typestrict/TS-Ettin-17M/026af312e41d24a1126f8d927bb6314fc2d5f592/model.safetensors` | 67,484,624 | 1740 | 38.8 |
| `/models/typestrict/TS-Ettin-17M/026af312e41d24a1126f8d927bb6314fc2d5f592/model.safetensors` | 67,484,624 | 1717 | 39.3 |
| `/models/typestrict/TS-Ettin-17M/026af312e41d24a1126f8d927bb6314fc2d5f592/model.safetensors` | 67,484,624 | 1700 | 39.7 |
| `/models/typestrict/TS-Ettin-17M/026af312e41d24a1126f8d927bb6314fc2d5f592/model.safetensors` | 67,484,624 | 1925 | 35.1 |
| `/models/typestrict/TS-Ettin-32M/a0f7b67dc8618365792896f46d52ec4013b899de/onnx/model_8bit.o` | 34,047,948 | 875 | 38.9 |
| `/models/typestrict/TS-Ettin-32M/a0f7b67dc8618365792896f46d52ec4013b899de/onnx/model_int8.o` | 32,492,842 | 826 | 39.3 |
| `/corpus.json` | 6,872 | 3 | 2.3 |
| `/corpus.json` | 6,872 | 1 | 6.9 |

Estados HTTP: {200: 241}.

## Conclusões automáticas

- Etapas: {'posted': 19, 'ok': 1} de 20; a sessão terminou.
- WebGPU no aparelho: **disponível** (apple apple); computação correta.
- Rodaram: `ort-wasm-int8-17m`, `ort-wasm-8bit-17m`, `ort-wasm-fp32-17m`, `jh-webgpu-f32-17m`, `jh-webgpu-f16-17m`, `jh-cpu-f32-17m`, `jh-webgpu-f32-17m-resistencia-200`.
- Não rodou `ort-wasm-q8emb-f16-17m`: no available backend found. ERR: [wasm] RangeError: Out of memory
- Não rodou `ort-wasm-q8emb32-f16-17m`: no available backend found. ERR: [wasm] RangeError: Out of memory
- Não rodou `ort-wasm-int8-32m`: no available backend found. ERR: [wasm] RangeError: Out of memory
- Não rodou `ort-wasm-8bit-32m`: no available backend found. ERR: [wasm] RangeError: Out of memory
- Não rodou `ort-webgpu-fp32-17m`: no available backend found. ERR: [webgpu] RangeError: Out of memory
- Não rodou `ort-webgpu-q8emb32-f16-17m`: no available backend found. ERR: [webgpu] RangeError: Out of memory
- Não rodou `ort-wasm-8bit-17m-debug`: no available backend found. ERR: [wasm] RangeError: Out of memory
- Não rodou `ort-wasm-q8emb32-f16-17m-resistencia-200`: no available backend found. ERR: [wasm] RangeError: Out of memory
- Não rodou `ort-webgpu-8bit-17m`: no available backend found. ERR: [webgpu] RangeError: Out of memory
- Não rodou `ort-webgpu-int8-17m`: no available backend found. ERR: [webgpu] RangeError: Out of memory

