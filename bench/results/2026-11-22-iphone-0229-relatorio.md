# Laboratório de aparelho — sessão `2026-11-22-iphone-0229`

> Gerado por `bench/spike-mobile/lab/analyze.py` a partir dos arquivos da sessão em `bench/results/`. Aparelho: **iphone**; perfil `completo`; modo `local`; início 2026-11-22T05:30:09.850Z; fim 2026-11-22T05:33:30.101Z. Tudo **[MEDIDO no aparelho]**; os limites do portão GT são **[ALVO]** do roadmap.

## Aparelho e navegador

| Item | Valor |
|---|---|
| Navegador | `Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.3 Mobile/15E148 Safari/604.1` |
| Tela | 390×844 @3x; núcleos lógicos 4; `deviceMemory` None |
| Contexto seguro | True; isolado (sonda com COOP/COEP): True |
| WebAssembly | SIMD True; SIMD relaxado False; JSPI False; threads False (isolado: True) |
| WebGPU | `navigator.gpu` True; adaptador True {"vendor": "apple", "architecture": "apple", "device": "apple", "description": "apple", "isFallbackAdapter": false}; dispositivo True  |
| Teste de computação WebGPU | 1048576 floats, 129 ms, 0 divergências; `shader-f16`: True (compilação: []) |
| WebGL | Apple GPU (WebGL 1.0) |
| Armazenamento | quota 41,232 MB; OPFS True; IndexedDB True |
| APIs presentes | navigator.gpu, wakeLock, caches, serviceWorker, Worker, OffscreenCanvas, Atomics.waitAsync, Float16Array, CompressionStream, WebTransport, VideoDecoder (WebCodecs) |
| Resolução de `performance.now()` | 0.999999999998181 ms |

## Etapas

| Etapa | Estado | Tentativas | Início | Fim | Nota | Tentativas anteriores |
|---|---|---:|---|---|---|---|
| `sonda` | posted | 1 | 2026-11-22T05:30:09.850Z | 2026-11-22T05:30:10.916Z | — | — |
| `ambiente` | ok | 1 | 2026-11-22T05:30:12.959Z | 2026-11-22T05:30:13.378Z | — | — |
| `ort-wasm-int8-17m` | posted | 1 | 2026-11-22T05:30:15.391Z | 2026-11-22T05:30:30.792Z | — | — |
| `ort-wasm-8bit-17m` | posted | 1 | 2026-11-22T05:30:32.810Z | 2026-11-22T05:30:49.667Z | — | — |
| `ort-wasm-fp32-17m` | posted | 1 | 2026-11-22T05:30:51.685Z | 2026-11-22T05:31:09.593Z | — | — |
| `ort-wasm-q8emb-f16-17m` | posted | 1 | 2026-11-22T05:31:11.613Z | 2026-11-22T05:31:13.835Z | — | — |
| `ort-wasm-q8emb32-f16-17m` | posted | 1 | 2026-11-22T05:31:15.856Z | 2026-11-22T05:31:17.890Z | — | — |
| `ort-wasm-int8-32m` | posted | 1 | 2026-11-22T05:31:19.916Z | 2026-11-22T05:31:21.953Z | — | — |
| `ort-wasm-8bit-32m` | posted | 1 | 2026-11-22T05:31:23.973Z | 2026-11-22T05:31:26.008Z | — | — |
| `ort-webgpu-fp32-17m` | posted | 1 | 2026-11-22T05:31:28.068Z | 2026-11-22T05:31:31.628Z | — | — |
| `ort-webgpu-q8emb32-f16-17m` | posted | 1 | 2026-11-22T05:31:33.648Z | 2026-11-22T05:31:34.683Z | — | — |
| `jh-webgpu-f32-17m` | posted | 1 | 2026-11-22T05:31:36.703Z | 2026-11-22T05:31:43.255Z | — | — |
| `jh-webgpu-f16-17m` | posted | 1 | 2026-11-22T05:31:45.274Z | 2026-11-22T05:31:50.338Z | — | — |
| `jh-cpu-f32-17m` | posted | 1 | 2026-11-22T05:31:52.474Z | 2026-11-22T05:33:02.771Z | — | — |
| `ort-wasm-8bit-17m-debug` | posted | 1 | 2026-11-22T05:33:04.839Z | 2026-11-22T05:33:05.895Z | — | — |
| `ort-wasm-q8emb32-f16-17m-resistencia-200` | posted | 1 | 2026-11-22T05:33:07.918Z | 2026-11-22T05:33:08.954Z | — | — |
| `jh-webgpu-f32-17m-resistencia-200` | posted | 1 | 2026-11-22T05:33:10.972Z | 2026-11-22T05:33:18.588Z | — | — |
| `ort-webgpu-8bit-17m` | posted | 1 | 2026-11-22T05:33:20.687Z | 2026-11-22T05:33:21.771Z | — | — |
| `ort-webgpu-int8-17m` | posted | 1 | 2026-11-22T05:33:23.792Z | 2026-11-22T05:33:24.849Z | — | — |
| `sonda-coi` | posted | 1 | 2026-11-22T05:33:27.052Z | 2026-11-22T05:33:28.083Z | — | — |

## Página de teste

A latência é a do aparelho. Os pesos ficam em cache entre as etapas da sessão (`cache=1`), então o tempo até a primeira resposta não é o de uma primeira visita.

| Execução | Motor | Variante | Modelo | Estado | 1ª resposta (ms) | 1ª passada p50 (ms) | Quente p50 / p95 / p99 (ms) | Quente p50 / p95: ≤ 128 tokens · > 128 (ms) | 1ª visita (MB) | Heap JS máx. (MB) | Memória máx. (MB; PSS no Android, RSS no simulador iOS) | máx. \|Δp\| · top-1 | Falha |
|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| `2026-11-22-iphone-0229-ort-wasm-int8-17m` | ort-wasm | int8 | ts-ettin-17m | ok | 1,369 | 41.0 | 43.0 / 276.3 / 400.9 | 43.0 / 89.0 · 291.0 / 439.4 | 20.16 | — | — | 4.1e-01 · 93/156 | — |
| `2026-11-22-iphone-0229-ort-wasm-8bit-17m` | ort-wasm | 8bit | ts-ettin-17m | ok | 980 | 51.0 | 50.0 / 310.1 / 434.6 | 50.0 / 98.0 · 314.0 / 474.9 | 17.66 | — | — | 4.5e-02 · 151/156 | — |
| `2026-11-22-iphone-0229-ort-wasm-fp32-17m` | ort-wasm | fp32 | ts-ettin-17m | ok | 2,254 | 42.5 | 45.0 / 344.1 / 513.3 | 45.0 / 96.0 · 352.0 / 573.1 | 68.38 | — | — | 1.6e-06 · 156/156 | — |
| `2026-11-22-iphone-0229-ort-wasm-q8emb-f16-17m` | ort-wasm | q8emb-f16 | ts-ettin-17m | failed | — | — | — / — / — | — | 21.96 | — | — | — | no available backend found. ERR: [wasm] RangeError: Out of memory |
| `2026-11-22-iphone-0229-ort-wasm-q8emb32-f16-17m` | ort-wasm | q8emb32-f16 | ts-ettin-17m | failed | — | — | — / — / — | — | 23.37 | — | — | — | no available backend found. ERR: [wasm] RangeError: Out of memory |
| `2026-11-22-iphone-0229-ort-wasm-int8-32m` | ort-wasm | int8 | ts-ettin-32m | failed | — | — | — / — / — | — | 32.98 | — | — | — | no available backend found. ERR: [wasm] RangeError: Out of memory |
| `2026-11-22-iphone-0229-ort-wasm-8bit-32m` | ort-wasm | 8bit | ts-ettin-32m | failed | — | — | — / — / — | — | 34.05 | — | — | — | no available backend found. ERR: [wasm] RangeError: Out of memory |
| `2026-11-22-iphone-0229-ort-webgpu-fp32-17m` | ort-webgpu | fp32 | ts-ettin-17m | failed | — | — | — / — / — | — | 68.42 | — | — | — | no available backend found. ERR: [webgpu] RangeError: Out of memory |
| `2026-11-22-iphone-0229-ort-webgpu-q8emb32-f16-17m` | ort-webgpu | q8emb32-f16 | ts-ettin-17m | failed | — | — | — / — / — | — | — | — | — | — | no available backend found. ERR: [webgpu] RangeError: Out of memory |
| `2026-11-22-iphone-0229-jh-webgpu-f32-17m` | jh-webgpu | f32 | ts-ettin-17m | ok | 2,455 | 9.0 | 10.0 / 70.0 / 105.2 | 10.0 / 22.0 · 76.0 / 113.0 | 67.60 | — | — | 1.3e-06 · 156/156 | — |
| `2026-11-22-iphone-0229-jh-webgpu-f16-17m` | jh-webgpu | f16 | ts-ettin-17m | ok | 2,474 | 8.5 | 5.0 / 28.0 / 41.0 | 5.0 / 9.0 · 31.0 / 45.2 | 67.48 | — | — | 1.5e-03 · 155/156 | — |
| `2026-11-22-iphone-0229-jh-cpu-f32-17m` | jh-cpu | f32 | ts-ettin-17m | ok | 2,181 | 201.0 | 217.0 / 1,534.3 / 2,266.0 | 214.0 / 451.4 · 1,605.0 / 2,534.4 | 67.48 | — | — | 1.1e-06 · 156/156 | — |
| `2026-11-22-iphone-0229-ort-wasm-8bit-17m-debug` | ort-wasm | 8bit | ts-ettin-17m | failed | — | — | — / — / — | — | — | — | — | — | no available backend found. ERR: [wasm] RangeError: Out of memory |
| `2026-11-22-iphone-0229-ort-wasm-q8emb32-f16-17m-resistencia-200` | ort-wasm | q8emb32-f16 | ts-ettin-17m | failed | — | — | — / — / — | — | — | — | — | — | no available backend found. ERR: [wasm] RangeError: Out of memory |
| `2026-11-22-iphone-0229-jh-webgpu-f32-17m-resistencia-200` | jh-webgpu | f32 | ts-ettin-17m | ok | 2,073 | 9.0 | — / — / — | — | 67.48 | — | — | 1.3e-06 · 156/156 | — |
| `2026-11-22-iphone-0229-ort-webgpu-8bit-17m` | ort-webgpu | 8bit | ts-ettin-17m | failed | — | — | — / — / — | — | — | — | — | — | no available backend found. ERR: [webgpu] RangeError: Out of memory |
| `2026-11-22-iphone-0229-ort-webgpu-int8-17m` | ort-webgpu | int8 | ts-ettin-17m | failed | — | — | — / — / — | — | — | — | — | — | no available backend found. ERR: [webgpu] RangeError: Out of memory |

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
| `ort-wasm-int8-17m` | não cumpre (8 bits: Δp ≤ 0,03 e ≥ 99%) | 20.16 MB — sim | 276.3 ms — não | — |
| `ort-wasm-8bit-17m` | não cumpre (8 bits: Δp ≤ 0,03 e ≥ 99%) | 17.66 MB — sim | 310.1 ms — não | — |
| `ort-wasm-fp32-17m` | cumpre (FP32/FP16: Δp ≤ 1e-3) | 68.38 MB — não | 344.1 ms — não | — |
| `jh-webgpu-f32-17m` | cumpre (FP32/FP16: Δp ≤ 1e-3) | 67.60 MB — não | 70.0 ms — sim | — |
| `jh-webgpu-f16-17m` | não cumpre (FP32/FP16: Δp ≤ 1e-3) | 67.48 MB — não | 28.0 ms — sim | — |
| `jh-cpu-f32-17m` | cumpre (FP32/FP16: Δp ≤ 1e-3) | 67.48 MB — não | 1534.3 ms — não | — |
| `jh-webgpu-f32-17m-resistencia-200` | cumpre (FP32/FP16: Δp ≤ 1e-3) | 67.48 MB — não | — | 200/200, falhas 0 — sim |

## Logs

3750 entradas. Por tipo e nível: `trace`/info 3484; `lifecycle`/info 82; `webgpu`/info 82; `console`/info 44; `webgpu`/error 38; `performance`/info 20.

**WebGPU** (eventos distintos):

- `2026-11-22-iphone-0229-sonda (iframe)` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-sonda (iframe)` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0229-sonda (iframe)` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-sonda (iframe)` — error: device lost: destroyed 
- `2026-11-22-iphone-0229-ort-wasm-int8-17m (iframe)` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-ort-wasm-int8-17m (iframe)` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0229-ort-wasm-int8-17m (iframe)` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-ort-wasm-int8-17m (iframe)` — error: device lost: destroyed 
- `2026-11-22-iphone-0229-ort-wasm-8bit-17m (iframe)` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-ort-wasm-8bit-17m (iframe)` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0229-ort-wasm-8bit-17m (iframe)` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-ort-wasm-8bit-17m (iframe)` — error: device lost: destroyed 
- `2026-11-22-iphone-0229-ort-wasm-fp32-17m (iframe)` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-ort-wasm-fp32-17m (iframe)` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0229-ort-wasm-fp32-17m (iframe)` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-ort-wasm-fp32-17m (iframe)` — error: device lost: destroyed 
- `2026-11-22-iphone-0229-ort-wasm-q8emb-f16-17m (iframe)` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-ort-wasm-q8emb-f16-17m (iframe)` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0229-ort-wasm-q8emb-f16-17m (iframe)` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-ort-wasm-q8emb-f16-17m (iframe)` — error: device lost: destroyed 
- `2026-11-22-iphone-0229-ort-wasm-q8emb32-f16-17m (iframe)` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-ort-wasm-q8emb32-f16-17m (iframe)` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0229-ort-wasm-q8emb32-f16-17m (iframe)` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-ort-wasm-q8emb32-f16-17m (iframe)` — error: device lost: destroyed 
- `2026-11-22-iphone-0229-ort-wasm-int8-32m (iframe)` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-ort-wasm-int8-32m (iframe)` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0229-ort-wasm-int8-32m (iframe)` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-ort-wasm-int8-32m (iframe)` — error: device lost: destroyed 
- `2026-11-22-iphone-0229-ort-wasm-8bit-32m (iframe)` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-ort-wasm-8bit-32m (iframe)` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0229-ort-wasm-8bit-32m (iframe)` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-ort-wasm-8bit-32m (iframe)` — error: device lost: destroyed 
- `2026-11-22-iphone-0229-ort-webgpu-fp32-17m (iframe)` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-ort-webgpu-fp32-17m (iframe)` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0229-ort-webgpu-fp32-17m (iframe)` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-ort-webgpu-fp32-17m (iframe)` — error: device lost: destroyed 
- `2026-11-22-iphone-0229-ort-webgpu-q8emb32-f16-17m (iframe)` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-ort-webgpu-q8emb32-f16-17m (iframe)` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0229-ort-webgpu-q8emb32-f16-17m (iframe)` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-ort-webgpu-q8emb32-f16-17m (iframe)` — error: device lost: destroyed 
- `2026-11-22-iphone-0229-jh-webgpu-f32-17m (iframe)` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-jh-webgpu-f32-17m (iframe)` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0229-jh-webgpu-f32-17m (iframe)` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-jh-webgpu-f32-17m (iframe)` — error: device lost: destroyed 
- `2026-11-22-iphone-0229-jh-webgpu-f16-17m (iframe)` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-jh-webgpu-f16-17m (iframe)` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0229-jh-webgpu-f16-17m (iframe)` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-jh-webgpu-f16-17m (iframe)` — error: device lost: destroyed 
- `2026-11-22-iphone-0229-jh-webgpu-f16-17m (iframe)` — info: requestDevice → ok; features: core-features-and-limits, shader-f16
- `2026-11-22-iphone-0229-jh-cpu-f32-17m (iframe)` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-jh-cpu-f32-17m (iframe)` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0229-jh-cpu-f32-17m (iframe)` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-jh-cpu-f32-17m (iframe)` — error: device lost: destroyed 
- `2026-11-22-iphone-0229-ort-wasm-8bit-17m-debug (iframe)` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-ort-wasm-8bit-17m-debug (iframe)` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0229-ort-wasm-8bit-17m-debug (iframe)` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-ort-wasm-8bit-17m-debug (iframe)` — error: device lost: destroyed 
- `2026-11-22-iphone-0229-ort-wasm-q8emb32-f16-17m-resistencia-200 (iframe)` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-ort-wasm-q8emb32-f16-17m-resistencia-200 (iframe)` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0229-ort-wasm-q8emb32-f16-17m-resistencia-200 (iframe)` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-ort-wasm-q8emb32-f16-17m-resistencia-200 (iframe)` — error: device lost: destroyed 
- `2026-11-22-iphone-0229-jh-webgpu-f32-17m-resistencia-200 (iframe)` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-jh-webgpu-f32-17m-resistencia-200 (iframe)` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0229-jh-webgpu-f32-17m-resistencia-200 (iframe)` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-jh-webgpu-f32-17m-resistencia-200 (iframe)` — error: device lost: destroyed 
- `2026-11-22-iphone-0229-ort-webgpu-8bit-17m (iframe)` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-ort-webgpu-8bit-17m (iframe)` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0229-ort-webgpu-8bit-17m (iframe)` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-ort-webgpu-8bit-17m (iframe)` — error: device lost: destroyed 
- `2026-11-22-iphone-0229-ort-webgpu-int8-17m (iframe)` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-ort-webgpu-int8-17m (iframe)` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0229-ort-webgpu-int8-17m (iframe)` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-ort-webgpu-int8-17m (iframe)` — error: device lost: destroyed 
- `2026-11-22-iphone-0229-sonda-coi (iframe)` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-sonda-coi (iframe)` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0229-sonda-coi (iframe)` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0229-sonda-coi (iframe)` — error: device lost: destroyed 

**Ciclo de vida:** a página ficou oculta 0 vez(es).

## Rede

184 requisições respondidas; 557.22 MB enviados ao aparelho. As maiores:

| Caminho | Bytes | Tempo (ms) | MB/s |
|---|---:|---:|---:|
| `/models/derived/typestrict/TS-Ettin-17M/026af312e41d24a1126f8d927bb6314fc2d5f592/model_fp3` | 68,381,159 | 1822 | 37.5 |
| `/models/derived/typestrict/TS-Ettin-17M/026af312e41d24a1126f8d927bb6314fc2d5f592/model_fp3` | 68,381,159 | 2010 | 34.0 |
| `/models/typestrict/TS-Ettin-17M/026af312e41d24a1126f8d927bb6314fc2d5f592/model.safetensors` | 67,484,624 | 1852 | 36.4 |
| `/models/typestrict/TS-Ettin-17M/026af312e41d24a1126f8d927bb6314fc2d5f592/model.safetensors` | 67,484,624 | 1964 | 34.4 |
| `/models/typestrict/TS-Ettin-17M/026af312e41d24a1126f8d927bb6314fc2d5f592/model.safetensors` | 67,484,624 | 1739 | 38.8 |
| `/models/typestrict/TS-Ettin-17M/026af312e41d24a1126f8d927bb6314fc2d5f592/model.safetensors` | 67,484,624 | 1790 | 37.7 |
| `/models/typestrict/TS-Ettin-32M/a0f7b67dc8618365792896f46d52ec4013b899de/onnx/model_8bit.o` | 34,047,948 | 868 | 39.2 |
| `/models/typestrict/TS-Ettin-32M/a0f7b67dc8618365792896f46d52ec4013b899de/onnx/model_int8.o` | 32,492,842 | 805 | 40.4 |
| `/models/derived/typestrict/TS-Ettin-17M/026af312e41d24a1126f8d927bb6314fc2d5f592/model_q8e` | 23,368,916 | 606 | 38.6 |
| `/models/derived/typestrict/TS-Ettin-17M/026af312e41d24a1126f8d927bb6314fc2d5f592/model_q8e` | 21,958,382 | 589 | 37.3 |

Estados HTTP: {200: 184}.

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

