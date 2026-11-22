# Laboratório de aparelho — sessão `2026-11-22-iphone-0245`

> Gerado por `bench/spike-mobile/lab/analyze.py` a partir dos arquivos da sessão em `bench/results/`. Aparelho: **iphone**; perfil `onnx`; modo `local`; início 2026-11-22T05:46:38.706Z; fim 2026-11-22T06:02:11.033Z. Tudo **[MEDIDO no aparelho]**; os limites do portão GT são **[ALVO]** do roadmap.

## Aparelho e navegador

| Item | Valor |
|---|---|
| Navegador | `Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.3 Mobile/15E148 Safari/604.1` |
| Tela | None×None @Nonex; núcleos lógicos None; `deviceMemory` None |
| Contexto seguro | None; isolado (sonda com COOP/COEP): — |
| WebAssembly | SIMD True; SIMD relaxado False; JSPI False; threads False (isolado: —) |
| WebGPU | `navigator.gpu` True; adaptador True {"vendor": "apple", "architecture": "apple", "device": "apple", "description": "apple", "isFallbackAdapter": false}; dispositivo True  |
| WebGL | — (—) |
| Armazenamento | quota 0 MB; OPFS None; IndexedDB None |
| APIs presentes | — |
| Resolução de `performance.now()` | None ms |

## Etapas

| Etapa | Estado | Tentativas | Início | Fim | Nota | Tentativas anteriores |
|---|---|---:|---|---|---|---|
| `sonda` | posted (environment-probe) | 1 | 2026-11-22T05:46:38.706Z | 2026-11-22T05:46:40.244Z | — | — |
| `ort-wasm-q8emb32-f16-17m` | posted (ok) | 1 | 2026-11-22T05:46:40.270Z | 2026-11-22T05:46:55.823Z | — | — |
| `ort-webgpu-q8emb32-f16-17m` | posted (failed) | 1 | 2026-11-22T05:46:55.846Z | 2026-11-22T05:48:29.256306Z | o processo do Safari caiu (duas vezes) | — |
| `ort-webgpu-fp32-17m` | skipped | 0 | — | — | pulada: o ONNX Runtime WebGPU derrubou o processo do Safari na etapa q8emb32-f16 | — |
| `ort-wasm-q8emb32-f16-17m-resistencia-200` | posted (ok) | 1 | 2026-11-22T05:49:38.627Z | 2026-11-22T05:50:01.314Z | — | — |
| `ort-wasm-q8emb-f16-17m` | posted (ok) | 1 | 2026-11-22T05:51:28.227Z | 2026-11-22T05:51:43.327Z | — | — |
| `ort-wasm-8bit-17m-debug` | posted (ok) | 3 | 2026-11-22T06:00:30.163Z | 2026-11-22T06:00:36.202Z | — | failed: no available backend found. ERR: [wasm] RangeError: Out of memory (aba aberta pelo botao Continuar numa aba nova (window.open com noopener)); failed: no available backend found. ERR: [wasm] RangeError: Out of memory (mesmo processo do Safari das abas anteriores (aba antiga recarregada e aba aberta pelo botao)) |
| `ort-wasm-int8-32m` | posted (ok) | 3 | 2026-11-22T06:00:39.712Z | 2026-11-22T06:01:21.928Z | — | failed: no available backend found. ERR: [wasm] RangeError: Out of memory (aba aberta pelo botao Continuar numa aba nova (window.open com noopener)); failed: no available backend found. ERR: [wasm] RangeError: Out of memory (mesmo processo do Safari das abas anteriores (aba antiga recarregada e aba aberta pelo botao)) |
| `ort-wasm-8bit-32m` | posted (ok) | 3 | 2026-11-22T06:01:21.967Z | 2026-11-22T06:02:10.995Z | — | failed: no available backend found. ERR: [wasm] RangeError: Out of memory (aba aberta pelo botao Continuar numa aba nova (window.open com noopener)); failed: no available backend found. ERR: [wasm] RangeError: Out of memory (mesmo processo do Safari das abas anteriores (aba antiga recarregada e aba aberta pelo botao)) |
| `ort-webgpu-8bit-17m` | skipped | 0 | — | — | pulada: o ONNX Runtime WebGPU derrubou o processo do Safari na etapa q8emb32-f16 | — |
| `ort-webgpu-int8-17m` | skipped | 0 | — | — | pulada: o ONNX Runtime WebGPU derrubou o processo do Safari na etapa q8emb32-f16 | — |

## Página de teste

A latência é a do aparelho. Os pesos ficam em cache entre as etapas da sessão (`cache=1`), então o tempo até a primeira resposta não é o de uma primeira visita.

| Execução | Motor | Variante | Modelo | Estado | 1ª resposta (ms) | 1ª passada p50 (ms) | Quente p50 / p95 / p99 (ms) | Quente p50 / p95: ≤ 128 tokens · > 128 (ms) | 1ª visita (MB) | Heap JS máx. (MB) | Memória máx. (MB; PSS no Android, RSS no simulador iOS) | máx. \|Δp\| · top-1 | Falha |
|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| `2026-11-22-iphone-0245-ort-wasm-q8emb32-f16-17m` | ort-wasm | q8emb32-f16 | ts-ettin-17m | ok | 431 | 40.0 | 42.0 / 321.1 / 487.0 | 42.0 / 90.0 · 337.0 / 541.1 | — | — | — | 8.9e-03 · 155/156 | — |
| `2026-11-22-iphone-0245-ort-webgpu-q8emb32-f16-17m` | ort-webgpu | q8emb32-f16 | ts-ettin-17m | failed | — | — | — / — / — | — | — | — | — | — | Safari recarregou a página durante a sessão do ONNX Runtime WebGPU (05:46:55 e 05:47:01 UTC, requests.jsonl) e mostrou que ocorreu um proble |
| `2026-11-22-iphone-0245-ort-wasm-q8emb32-f16-17m-resistencia-200` | ort-wasm | q8emb32-f16 | ts-ettin-17m | ok | 365 | 42.0 | — / — / — | — | — | — | — | 8.9e-03 · 155/156 | — |
| `2026-11-22-iphone-0245-ort-wasm-q8emb-f16-17m` | ort-wasm | q8emb-f16 | ts-ettin-17m | ok | 424 | 38.0 | 41.0 / 306.5 / 479.6 | 41.0 / 89.0 · 328.0 / 525.0 | — | — | — | 2.0e-02 · 153/156 | — |
| `2026-11-22-iphone-0245-ort-wasm-8bit-17m-debug` | ort-wasm | 8bit | ts-ettin-17m | ok | 753 | 45.0 | — / — / — | — | — | — | — | 4.5e-02 · 151/156 | — |
| `2026-11-22-iphone-0245-ort-wasm-int8-32m` | ort-wasm | int8 | ts-ettin-32m | ok | 552 | 129.0 | 135.5 / 856.8 / 1,217.4 | 135.0 / 279.0 · 889.0 / 1,320.2 | — | — | — | 7.1e-01 · 103/156 | — |
| `2026-11-22-iphone-0245-ort-wasm-8bit-32m` | ort-wasm | 8bit | ts-ettin-32m | ok | 1,735 | 154.0 | 159.0 / 934.1 / 1,286.8 | 159.0 / 309.0 · 959.0 / 1,432.6 | 34.05 | — | — | 4.5e-02 · 155/156 | — |

**Paridade e forma**

| Execução | Variante | Contra a referência | Tolerância da variante | Contra o nativo (mesmo arquivo) | Forma |
|---|---|---|---|---|---|
| `ort-wasm-q8emb32-f16-17m` | q8emb32-f16 | 8.9e-03 · 155/156 | cumpre (8 bits: Δp ≤ 0,03 e ≥ 99%) | 1.6e-06 · 156/156 | igual |
| `ort-webgpu-q8emb32-f16-17m` | q8emb32-f16 | — | — | — | — |
| `ort-wasm-q8emb32-f16-17m-resistencia-200` | q8emb32-f16 | 8.9e-03 · 155/156 | cumpre (8 bits: Δp ≤ 0,03 e ≥ 99%) | 1.6e-06 · 156/156 | igual |
| `ort-wasm-q8emb-f16-17m` | q8emb-f16 | 2.0e-02 · 153/156 | não cumpre (8 bits: Δp ≤ 0,03 e ≥ 99%) | 1.4e-06 · 156/156 | igual |
| `ort-wasm-8bit-17m-debug` | 8bit | 4.5e-02 · 151/156 | não cumpre (8 bits: Δp ≤ 0,03 e ≥ 99%) | 1.2e-06 · 156/156 | igual |
| `ort-wasm-int8-32m` | int8 | 7.1e-01 · 103/156 | não cumpre (8 bits: Δp ≤ 0,03 e ≥ 99%) | 2.8e-01 · 134/156 | igual |
| `ort-wasm-8bit-32m` | 8bit | 4.5e-02 · 155/156 | não cumpre (8 bits: Δp ≤ 0,03 e ≥ 99%) | 1.1e-06 · 156/156 | igual |

## Critérios do portão GT neste aparelho (17M)

| Execução | Acerta igual? | Primeira visita até 25 MB? | p95 quente até 150 ms (iPhone e Android intermediário) **[ALVO]**? | 200 decisões sem falha? |
|---|---|---|---|---|
| `ort-wasm-q8emb32-f16-17m` | cumpre (8 bits: Δp ≤ 0,03 e ≥ 99%) | — | 321.1 ms — não | — |
| `ort-wasm-q8emb32-f16-17m-resistencia-200` | cumpre (8 bits: Δp ≤ 0,03 e ≥ 99%) | — | — | 200/200, falhas 0 — sim |
| `ort-wasm-q8emb-f16-17m` | não cumpre (8 bits: Δp ≤ 0,03 e ≥ 99%) | — | 306.5 ms — não | — |
| `ort-wasm-8bit-17m-debug` | não cumpre (8 bits: Δp ≤ 0,03 e ≥ 99%) | — | — | — |

## Logs

3277 entradas. Por tipo e nível: `trace`/info 2926; `lifecycle`/info 146; `webgpu`/info 96; `console`/info 53; `performance`/info 33; `lab`/warn 15; `console`/error 4; `console`/warn 3; `error`/error 1.

**Erros** (os mais frequentes):

| Origem | Mensagem | Vezes |
|---|---|---:|
| `lab.html` | Script error. @ :0:0 | 1 |

**WebGPU** (eventos distintos):

- `2026-11-22-iphone-0245-sonda` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0245-sonda` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0245-sonda` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0245-sonda` — info: device lost: destroyed 
- `2026-11-22-iphone-0245-ort-wasm-q8emb32-f16-17m` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0245-ort-wasm-q8emb32-f16-17m` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0245-ort-wasm-q8emb32-f16-17m` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0245-ort-wasm-q8emb32-f16-17m` — info: device lost: destroyed 
- `2026-11-22-iphone-0245-ort-webgpu-q8emb32-f16-17m` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0245-ort-webgpu-q8emb32-f16-17m` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0245-ort-webgpu-q8emb32-f16-17m` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0245-ort-webgpu-q8emb32-f16-17m` — info: device lost: destroyed 
- `page` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `page` — info: requestDevice → ok; features: core-features-and-limits
- `page` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `page` — info: device lost: destroyed 
- `2026-11-22-iphone-0245-ort-wasm-q8emb32-f16-17m-resistencia-200` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0245-ort-wasm-q8emb32-f16-17m-resistencia-200` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0245-ort-wasm-q8emb32-f16-17m-resistencia-200` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0245-ort-wasm-q8emb32-f16-17m-resistencia-200` — info: device lost: destroyed 
- `2026-11-22-iphone-0245-ort-wasm-q8emb-f16-17m` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0245-ort-wasm-q8emb-f16-17m` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0245-ort-wasm-q8emb-f16-17m` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0245-ort-wasm-q8emb-f16-17m` — info: device lost: destroyed 
- `2026-11-22-iphone-0245-ort-wasm-8bit-17m-debug` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0245-ort-wasm-8bit-17m-debug` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0245-ort-wasm-8bit-17m-debug` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0245-ort-wasm-8bit-17m-debug` — info: device lost: destroyed 
- `2026-11-22-iphone-0245-ort-wasm-int8-32m` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0245-ort-wasm-int8-32m` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0245-ort-wasm-int8-32m` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0245-ort-wasm-int8-32m` — info: device lost: destroyed 
- `2026-11-22-iphone-0245-ort-wasm-8bit-32m` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0245-ort-wasm-8bit-32m` — info: requestDevice → ok; features: core-features-and-limits
- `2026-11-22-iphone-0245-ort-wasm-8bit-32m` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-22-iphone-0245-ort-wasm-8bit-32m` — info: device lost: destroyed 

**Ciclo de vida:** a página ficou oculta 1 vez(es) — as medições dessas etapas podem ter sido estranguladas pelo navegador.
- 2026-11-22T05:57:57.567Z em `lab.html`

**Avisos** (os mais frequentes): “wake lock: NotAllowedError” ×15; “[W:onnxruntime:, session_state.cc:1598 VerifyEachNodeIsAssignedToAnEp] Some nodes were not assigned to the preferred execution providers which may or may not have an negative impact on performance. e.” ×2; “[W:onnxruntime:, session_state.cc:1600 VerifyEachNodeIsAssignedToAnEp] Rerunning with verbose output on a non-minimal build will show node assignments.” ×2; “[lab] new tab needed before ort-wasm-8bit-32m (3 ONNX Runtime sessions in this tab)” ×2; “[lab] new tab needed before ort-wasm-q8emb-f16-17m (3 ONNX Runtime sessions in this tab)” ×1

## Rede

209 requisições respondidas; 124.57 MB enviados ao aparelho. As maiores:

| Caminho | Bytes | Tempo (ms) | MB/s |
|---|---:|---:|---:|
| `/models/typestrict/TS-Ettin-32M/a0f7b67dc8618365792896f46d52ec4013b899de/onnx/model_8bit.o` | 34,047,948 | 1048 | 32.5 |
| `/models/typestrict/TS-Ettin-32M/a0f7b67dc8618365792896f46d52ec4013b899de/onnx/model_8bit.o` | 34,047,948 | 984 | 34.6 |
| `/models/typestrict/TS-Ettin-32M/a0f7b67dc8618365792896f46d52ec4013b899de/onnx/model_8bit.o` | 34,047,948 | 1067 | 31.9 |
| `/models/typestrict/TS-Ettin-17M/026af312e41d24a1126f8d927bb6314fc2d5f592/onnx/model_int8.o` | 17,180,077 | 536 | 32.1 |
| `/node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm` | 4,315,487 | 158 | 27.3 |
| `/models/typestrict/TS-Ettin-17M/026af312e41d24a1126f8d927bb6314fc2d5f592/tokenizer.json` | 483,304 | 61 | 7.9 |
| `/corpus.json` | 6,872 | 3 | 2.3 |
| `/corpus.json` | 6,872 | 1 | 6.9 |
| `/corpus.json` | 6,872 | 2 | 3.4 |
| `/corpus.json` | 6,872 | 3 | 2.3 |

Estados HTTP: {200: 209}.

## Conclusões automáticas

- Etapas: {'posted': 8, 'skipped': 3} de 11; a sessão terminou.
- WebGPU no aparelho: **disponível** (apple apple); computação com divergências ou não testada.
- Rodaram: `ort-wasm-q8emb32-f16-17m`, `ort-wasm-q8emb32-f16-17m-resistencia-200`, `ort-wasm-q8emb-f16-17m`, `ort-wasm-8bit-17m-debug`, `ort-wasm-int8-32m`, `ort-wasm-8bit-32m`.
- Não rodou `ort-webgpu-q8emb32-f16-17m`: Safari recarregou a página durante a sessão do ONNX Runtime WebGPU (05:46:55 e 05:47:01 UTC, requests.jsonl) e mostrou que ocorreu um problema repetidamente: o processo da aba caiu duas vezes
- Sem resultado (etapa não executada): `ort-webgpu-fp32-17m`, `ort-webgpu-8bit-17m`, `ort-webgpu-int8-17m`.
- Tentativas que pararam em `Out of memory` e foram repetidas: 6, em `ort-wasm-8bit-17m-debug`, `ort-wasm-8bit-32m`, `ort-wasm-int8-32m`. É memória do Wasm presa no processo do Safari, não o motor: a repetição depois de reabrir o Safari é a medição.

