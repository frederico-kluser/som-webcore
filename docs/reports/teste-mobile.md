# Teste do motor existente no Android — relatório do marco T

> Atividades `T-01`, `T-08`, `T-09`, `T-03`, `T-10` e `T-04` do [roadmap](../../ROADMAP.md#mt). Tudo foi medido em 2026-11-21, no computador de desenvolvimento e, a partir da seção 5, no Mac mini ([MACMINI.md](../../bench/spike-mobile/MACMINI.md)); os dados brutos estão em `bench/results/` e cada tabela abaixo é gerada deles pelos scripts de `bench/spike-mobile/reference/` (`summarize.py`, `compare.py`, `repeatability.py`, `web_vs_native.py`).
> O emulador e o simulador rodam no processador de um computador e não têm WebGPU: **nenhuma latência daqui é latência de celular** ([EMULADOR.md](../../bench/spike-mobile/EMULADOR.md)).

## 1. Como cada critério do portão GT é verificado

Fixado em 2026-11-21, **antes** das medições finais, a partir do texto do portão [GT](../../ROADMAP.md#gt) e das tolerâncias da [metodologia](../METHODOLOGY.md#paridade). Nenhum limiar foi criado aqui.

| Critério de GT | Como se verifica |
|---|---|
| **Acerta igual?** — mesmas respostas da referência, dentro da tolerância da variante | Referência: o `dinah.py` do próprio modelo, PyTorch FP32 em CPU (`reference/run_reference.py`). Tolerância por variante, da metodologia: pesos **FP32 ou FP16** → `Δp` ≤ 1e-3 e vencedora idêntica quando a margem da referência é ≥ 0,01 (linha “motor contra o oráculo”); variantes com pesos em **8 bits** (`int8` e `8bit` publicadas; as derivadas `q8emb*`, que guardam as embeddings em 8 bits) → `Δp` ≤ 0,03 e vencedora igual em ≥ 99% das perguntas (linha “variante quantizada em 8 bits”). `Δp` = maior diferença absoluta de probabilidade de uma opção, sobre as 156 perguntas do corpus |
| **A primeira visita é leve?** — runtime, pesos e tokenizador somam até 25 MB | Bytes na rede medidos pela página (Resource Timing, `encodedBodySize`) de runtime, adaptador, pesos, tokenizador e `config.json`, com MB = 10⁶ bytes (como nos tamanhos do roadmap: 17.180.077 B = “17,2 MB”). O servidor local comprime JS e Wasm em brotli de qualidade máxima — o caso de quem hospeda os próprios arquivos; os pesos vão sem compressão, como no CDN do Hugging Face. Como referência, também se dá o total com o runtime nos bytes que o jsDelivr transfere ([motores-existentes.md](motores-existentes.md)) |
| **Aguenta?** — 200 decisões seguidas sem a aba recarregar nem travar | Página com `endurance=200`: as 200 decisões terminam sem falha e a página posta o resultado (sem travar nem recarregar). Memória registrada no início e no fim: heap JS e, no Android, o PSS de cada processo do Chrome; para a `T-09`, “sem crescimento” = heap JS no fim ≤ início + 1 MiB (a tolerância do portão G1) |
| **A decisão é rápida?** — p95 ≤ 150 ms (Android intermediário e iPhone), ≤ 300 ms (Android de entrada) | Só vale em aparelho real. No emulador o p95 é registrado como **indicativo**, e o critério fica “não medido” |

## 2. A página de teste (`T-01`)

[`bench/spike-mobile/`](../../bench/spike-mobile/README.md): uma página estática que faz as 66 entradas de [`corpus.json`](../../bench/spike-mobile/corpus.json) (34 em inglês, 32 em português; 13 esquemas; `boolean`, `choice` de 2 a 8 opções e `score` com e sem rótulos numéricos; 4 entradas longas, de 346 a 523 tokens) **só pela Decisions API**. O motor por trás de `DecisionModel` vem da URL, por um único ponto de ligação ([`engines/registry.js`](../../bench/spike-mobile/engines/registry.js)); a página não muda nenhuma chamada entre motores. Motores ligados:

| `engine` | Motor | Variantes de pesos |
|---|---|---|
| `native` | o `DecisionModel` do navegador | — |
| `ort-wasm` · `ort-webgpu` · `ort-webgpu-jsep` | ONNX Runtime Web 1.31.1: Wasm; WebGPU com o provedor nativo; WebGPU com o provedor em JavaScript | `int8` e `8bit` (publicados), `fp32`, `q8emb-f16` e `q8emb32-f16` (derivados localmente dos pesos fixados) |
| `jh-cpu` · `jh-webgpu` | motor `@johnhenry` (ModernBERT em JavaScript e WGSL), com a cabeça de decisão no host | `f32` (pesos publicados); `f16` no WebGPU |

A tradução de uma pergunta da API para o formato do TS-Ettin está no [README da página](../../bench/spike-mobile/README.md#tradução-para-o-ts-ettin); o script de referência em Python aplica a mesma regra. A forma de cada resposta é conferida contra a [especificação](../spec/decisions-api-surface.md) por `reference/check_shape.py`.

**Validação no Chrome de desktop.** Em 2026-11-21, no Mac mini: Chrome 157.0.8103.79 no macOS 27.2 (Apple M1), com janela, perfil próprio e `--enable-precise-memory-info` ([MACMINI.md, seção 8](../../bench/spike-mobile/MACMINI.md#8-chrome-de-desktop-no-mac-t-01)); a [sonda](../../bench/results/2026-11-21-desktop-macmini-chrome157-probe.json) mostra WebGPU sobre Metal, com `shader-f16`. A mesma página, sem mudar nenhuma chamada, rodou os 15 pares motor × variante do 17M; o que não rodou ficou no JSON como falha, com a mensagem do motor **[MEDIDO; latência de desktop, fora do portão GT]**:

| Execução | Motor | Variante | Modelo | Estado | 1ª resposta (ms) | 1ª passada p50 (ms) | Quente p50 / p95 / p99 (ms) | Quente p50 / p95: ≤ 128 tokens · > 128 (ms) | 1ª visita (MB) | Heap JS máx. (MB) | Memória máx. (MB; PSS no Android, RSS no simulador iOS) | máx. \|Δp\| · top-1 | Falha |
|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| `2026-11-21-desktop-macmini-chrome157-jh-cpu-f32-ts-ettin-17m` | jh-cpu | f32 | ts-ettin-17m | ok | 1,107 | 475.6 | 474.5 / 3,430.6 / 5,091.3 | 474.1 / 982.6 · 3,535.7 / 5,708.6 | 68.06 | 183.4 | — | 1.1e-06 · 156/156 | — |
| `2026-11-21-desktop-macmini-chrome157-jh-webgpu-f16-ts-ettin-17m` | jh-webgpu | f16 | ts-ettin-17m | ok | 715 | 6.2 | 6.2 / 24.5 / 41.7 | 6.1 / 11.8 · 33.3 / 46.7 | 68.11 | 132.2 | — | 1.7e-03 · 156/156 | — |
| `2026-11-21-desktop-macmini-chrome157-jh-webgpu-f32-ts-ettin-17m` | jh-webgpu | f32 | ts-ettin-17m | ok | 750 | 6.6 | 6.7 / 26.9 / 40.3 | 6.5 / 11.7 · 35.7 / 45.8 | 68.11 | 131.8 | — | 1.9e-06 · 156/156 | — |
| `2026-11-21-desktop-macmini-chrome157-ort-wasm-8bit-ts-ettin-17m` | ort-wasm | 8bit | ts-ettin-17m | ok | 794 | 53.1 | 52.8 / 321.6 / 445.5 | 52.7 / 102.5 · 324.4 / 489.8 | 20.63 | 21.7 | — | 4.5e-02 · 151/156 | — |
| `2026-11-21-desktop-macmini-chrome157-ort-wasm-fp32-ts-ettin-17m` | ort-wasm | fp32 | ts-ettin-17m | ok | 944 | 46.5 | 45.2 / 348.3 / 511.3 | 45.1 / 96.3 · 367.3 / 574.6 | 71.36 | 83.5 | — | 1.6e-06 · 156/156 | — |
| `2026-11-21-desktop-macmini-chrome157-ort-wasm-int8-ts-ettin-17m` | ort-wasm | int8 | ts-ettin-17m | ok | 859 | 50.0 | 49.6 / 322.9 / 446.8 | 49.5 / 101.0 · 326.2 / 493.2 | 20.16 | 32.5 | — | 4.1e-01 · 93/156 | — |
| `2026-11-21-desktop-macmini-chrome157-ort-wasm-q8emb-f16-ts-ettin-17m` | ort-wasm | q8emb-f16 | ts-ettin-17m | ok | 686 | 45.4 | 45.1 / 347.9 / 507.5 | 45.0 / 95.8 · 348.4 / 569.7 | 24.93 | 16.7 | — | 2.0e-02 · 153/156 | — |
| `2026-11-21-desktop-macmini-chrome157-ort-wasm-q8emb32-f16-ts-ettin-17m` | ort-wasm | q8emb32-f16 | ts-ettin-17m | ok | 691 | 45.5 | 45.2 / 348.1 / 508.3 | 45.1 / 95.4 · 352.8 / 569.9 | 26.34 | 38.9 | — | 8.9e-03 · 155/156 | — |
| `2026-11-21-desktop-macmini-chrome157-ort-webgpu-8bit-ts-ettin-17m` | ort-webgpu | 8bit | ts-ettin-17m | failed | — | — | — / — / — | — | — | — | — | — | the page did not post a result within 300 s; last stage: first-pass en-02 |
| `2026-11-21-desktop-macmini-chrome157-ort-webgpu-fp32-ts-ettin-17m` | ort-webgpu | fp32 | ts-ettin-17m | ok | 1,774 | 19.6 | 18.9 / 73.8 / 119.2 | 18.2 / 31.1 · 84.8 / 137.9 | 73.24 | 89.2 | — | 4.8e-02 · 154/156 | — |
| `2026-11-21-desktop-macmini-chrome157-ort-webgpu-int8-ts-ettin-17m` | ort-webgpu | int8 | ts-ettin-17m | failed | — | — | — / — / — | — | — | — | — | — | the page did not post a result within 300 s; last stage: first-pass en-02 |
| `2026-11-21-desktop-macmini-chrome157-ort-webgpu-jsep-8bit-ts-ettin-17m` | ort-webgpu-jsep | 8bit | ts-ettin-17m | failed | — | — | — / — / — | — | 22.37 | 32.2 | — | — | Can't create a session. ERROR_CODE: 1, ERROR_MESSAGE: /mnt/azure_nvme_temp/_work/1/s/onnxruntime/contrib_ops/js/quantization/matmul_nbits.h: |
| `2026-11-21-desktop-macmini-chrome157-ort-webgpu-jsep-fp32-ts-ettin-17m` | ort-webgpu-jsep | fp32 | ts-ettin-17m | failed | — | — | — / — / — | — | 73.09 | 41.7 | — | — | [WebGPU] Kernel "[SkipLayerNormalization] SkipLayerNormalization" failed. Error: Beta must be 1D |
| `2026-11-21-desktop-macmini-chrome157-ort-webgpu-jsep-int8-ts-ettin-17m` | ort-webgpu-jsep | int8 | ts-ettin-17m | failed | — | — | — / — / — | — | 21.89 | 39.6 | — | — | [WebGPU] Kernel "[MultiHeadAttention] /bert/layers.0/attn/MultiHeadAttention" failed. Error: Mask not supported |
| `2026-11-21-desktop-macmini-chrome157-ort-webgpu-q8emb32-f16-ts-ettin-17m` | ort-webgpu | q8emb32-f16 | ts-ettin-17m | ok | 1,205 | 23.3 | 18.0 / 77.5 / 121.9 | 17.7 / 28.8 · 89.4 / 133.9 | 28.22 | 43.8 | — | 4.8e-02 · 153/156 | — |

- **Rodam:** o ONNX Runtime em Wasm (as cinco variantes) e em WebGPU com `fp32` e `q8emb32-f16`; o `@johnhenry` em CPU e em WebGPU (`f32` e `f16`). A forma de todas as respostas confere (`check_shape.py`).
- **Não rodam:** o ONNX Runtime em WebGPU com `8bit` e `int8` — a página trava na segunda decisão (`first-pass en-02`) e só sai pelo tempo limite, depois de o ONNX Runtime avisar que parte dos nós não foi atribuída ao WebGPU; e o provedor WebGPU em JavaScript (JSEP), nas três variantes, que falha ao criar ou rodar a sessão: `8bit` — “Only 2b and 4b quantization is supported for MatMulNBits op”; `fp32` — `SkipLayerNormalization`: “Beta must be 1D”; `int8` — `MultiHeadAttention`: “Mask not supported”.
- A validação da `T-01` está cumprida: a página roda no Chrome de desktop e produz o JSON; trocar de motor não muda nenhuma chamada (o motor vem da URL, por `engines/registry.js`); o que não roda aparece no JSON como falha, com a mensagem de erro.

## 3. Medição no emulador (`T-08`)

> **No emulador Android do Mac mini** (arm64), não no do Acer: a rodada do Acer foi interrompida pela falta de memória do computador ([diário](execucao-autonoma.md#incidentes-de-medição)), e o dono pediu para seguir testando pelo Mac. Ambiente **[MEDIDO]**: Android Emulator 37.2.12, aparelho virtual `som-webcore-android36` (Pixel 6, Android 16 / API 36, `google_apis` arm64-v8a, 4 GB), GPU por software (`swiftshader_indirect`, como no Acer) e **Chrome 133.0.6943.137**, a mesma versão do emulador do Acer ([MACMINI.md, seção 7](../../bench/spike-mobile/MACMINI.md#7-emulador-android-no-mac-t-08)). O Chrome é zerado antes de cada execução. **Toda latência daqui é de emulador: indicativa, não é latência de celular.**

**Funciona ou não.**

- **Rodam**, nas duas execuções (três nas que variaram mais de 10%), com as 66 entradas respondidas, a forma de todas as respostas conferida (`check_shape.py`: nenhum problema) e os tokens idênticos aos da referência (156/156 nas execuções com `debug=1`): o ONNX Runtime Web em Wasm, nas variantes `int8`, `8bit`, `fp32`, `q8emb-f16` e `q8emb32-f16` do 17M e `int8` e `8bit` do 32M; o motor `@johnhenry` em CPU, no 17M e no 32M.
- **Não rodam os caminhos WebGPU** (`ort-webgpu` e `jh-webgpu`): o Chrome do emulador não entrega adaptador. Com as flags inseguras (`--enable-unsafe-webgpu --enable-features=Vulkan`) ele entrega um — de fallback com a GPU por software, da Apple com `-gpu host` —, mas nenhum dispositivo (“A valid external Instance reference no longer exists.”); com `-gpu host` e as flags, os dois motores falharam também, duas vezes cada (`…-gpuhost-flags-webgpu-r*.json`). A falha fica no JSON com a mensagem de cada motor.
- **O `DecisionModel` nativo não existe** no Chrome do Android: a implementação responde sempre “indisponível” no Android (achado da `T-05`).

**Quanto baixa, quanto ocupa e quanto demora** (`summarize.py`). Bytes com brotli de qualidade máxima para JS e Wasm e pesos sem compressão; memória: PSS de todos os processos do Chrome. O heap JS aparece como 10,0 MB em todas porque, sem `--enable-precise-memory-info`, o Chrome arredonda `performance.memory`; as 200 decisões seguidas (seção 4) usam o valor preciso. Latência **[MEDIDO no emulador; indicativo]**:

| Execução | Motor | Variante | Modelo | Estado | 1ª resposta (ms) | 1ª passada p50 (ms) | Quente p50 / p95 / p99 (ms) | Quente p50 / p95: ≤ 128 tokens · > 128 (ms) | 1ª visita (MB) | Heap JS máx. (MB) | Memória máx. (MB; PSS no Android, RSS no simulador iOS) | máx. \|Δp\| · top-1 | Falha |
|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| `2026-11-21-emulador-macmini-chrome133-jh-cpu-f32-ts-ettin-17m-r1` | jh-cpu | f32 | ts-ettin-17m | ok | 3,658 | 410.0 | 408.2 / 2,860.2 / 4,275.1 | 405.4 / 879.1 · 3,230.8 / 4,635.0 | 0.58 ⚠ sem o registro dos pesos | 10.0 | 415 | 1.1e-06 · 156/156 | — |
| `2026-11-21-emulador-macmini-chrome133-jh-cpu-f32-ts-ettin-17m-r2` | jh-cpu | f32 | ts-ettin-17m | ok | 2,067 | 366.0 | 366.7 / 2,623.6 / 3,859.4 | 365.5 / 770.9 · 2,821.2 / 4,289.4 | 0.58 ⚠ sem o registro dos pesos | 10.0 | 442 | 1.1e-06 · 156/156 | — |
| `2026-11-21-emulador-macmini-chrome133-jh-cpu-f32-ts-ettin-17m-r3` | jh-cpu | f32 | ts-ettin-17m | ok | 3,143 | 398.4 | 399.0 / 2,826.6 / 4,128.0 | 394.6 / 830.2 · 2,905.9 / 4,561.8 | 68.06 | 10.0 | 415 | 1.1e-06 · 156/156 | — |
| `2026-11-21-emulador-macmini-chrome133-jh-cpu-f32-ts-ettin-32m-r1` | jh-cpu | f32 | ts-ettin-32m | ok | 4,400 | 1,146.7 | 1,121.3 / 7,549.9 / 10,860.0 | 1,112.1 / 2,324.7 · 7,710.9 / 12,154.7 | 0.58 ⚠ sem o registro dos pesos | 10.0 | 527 | 1.7e-06 · 156/156 | — |
| `2026-11-21-emulador-macmini-chrome133-jh-cpu-f32-ts-ettin-32m-r2` | jh-cpu | f32 | ts-ettin-32m | ok | 3,390 | 1,065.1 | 1,118.9 / 7,444.7 / 11,253.5 | 1,108.9 / 2,302.9 · 7,835.2 / 12,538.8 | 0.58 ⚠ sem o registro dos pesos | 10.0 | 502 | 1.7e-06 · 156/156 | — |
| `2026-11-21-emulador-macmini-chrome133-jh-webgpu-f32-ts-ettin-17m-r1` | jh-webgpu | f32 | ts-ettin-17m | failed | — | — | — / — / — | — | 0.62 | 10.0 | — | — | webgpu: no GPU adapter available |
| `2026-11-21-emulador-macmini-chrome133-jh-webgpu-f32-ts-ettin-17m-r2` | jh-webgpu | f32 | ts-ettin-17m | failed | — | — | — / — / — | — | 0.62 | 10.0 | 280 | — | webgpu: no GPU adapter available |
| `2026-11-21-emulador-macmini-chrome133-ort-wasm-8bit-ts-ettin-17m-r1` | ort-wasm | 8bit | ts-ettin-17m | ok | 4,250 | 101.7 | 94.9 / 577.1 / 796.3 | 94.3 / 188.5 · 586.4 / 926.2 | 20.63 | 10.0 | 482 | 4.5e-02 · 151/156 | — |
| `2026-11-21-emulador-macmini-chrome133-ort-wasm-8bit-ts-ettin-17m-r2` | ort-wasm | 8bit | ts-ettin-17m | ok | 3,546 | 109.4 | 95.7 / 568.9 / 793.1 | 95.2 / 188.0 · 683.9 / 880.5 | 20.63 | 10.0 | 480 | 4.5e-02 · 151/156 | — |
| `2026-11-21-emulador-macmini-chrome133-ort-wasm-8bit-ts-ettin-32m-r1` | ort-wasm | 8bit | ts-ettin-32m | ok | 4,982 | 334.7 | 288.8 / 1,665.2 / 2,499.2 | 286.2 / 577.6 · 1,862.4 / 2,599.1 | 37.02 | 10.0 | 598 | 4.5e-02 · 155/156 | — |
| `2026-11-21-emulador-macmini-chrome133-ort-wasm-8bit-ts-ettin-32m-r2` | ort-wasm | 8bit | ts-ettin-32m | ok | 2,631 | 259.0 | 264.8 / 1,527.1 / 2,226.8 | 257.5 / 544.3 · 1,809.1 / 2,355.6 | 37.02 | 10.0 | 598 | 4.5e-02 · 155/156 | — |
| `2026-11-21-emulador-macmini-chrome133-ort-wasm-fp32-ts-ettin-17m-r1` | ort-wasm | fp32 | ts-ettin-17m | ok | 4,169 | 85.1 | 78.8 / 606.1 / 894.5 | 78.5 / 168.4 · 651.3 / 1,022.9 | 71.36 | 10.0 | 678 | 1.6e-06 · 156/156 | — |
| `2026-11-21-emulador-macmini-chrome133-ort-wasm-fp32-ts-ettin-17m-r2` | ort-wasm | fp32 | ts-ettin-17m | ok | 3,707 | 85.9 | 96.5 / 698.7 / 1,130.6 | 94.0 / 228.2 · 747.5 / 1,210.3 | 71.36 | 10.0 | 675 | 1.6e-06 · 156/156 | — |
| `2026-11-21-emulador-macmini-chrome133-ort-wasm-fp32-ts-ettin-17m-r3` | ort-wasm | fp32 | ts-ettin-17m | ok | 3,943 | 86.2 | 79.5 / 611.5 / 890.6 | 79.2 / 167.3 · 670.3 / 1,022.8 | 71.36 | 10.0 | 677 | 1.6e-06 · 156/156 | — |
| `2026-11-21-emulador-macmini-chrome133-ort-wasm-int8-ts-ettin-17m-r1` | ort-wasm | int8 | ts-ettin-17m | ok | 6,922 | 105.2 | 69.1 / 449.4 / 653.3 | 68.5 / 142.7 · 461.8 / 734.8 | 20.16 | 10.0 | 467 | 4.1e-01 · 93/156 | — |
| `2026-11-21-emulador-macmini-chrome133-ort-wasm-int8-ts-ettin-17m-r2` | ort-wasm | int8 | ts-ettin-17m | ok | 3,364 | 72.9 | 67.9 / 433.9 / 648.5 | 67.1 / 143.3 · 499.4 / 720.2 | 20.16 | 10.0 | 472 | 4.1e-01 · 93/156 | — |
| `2026-11-21-emulador-macmini-chrome133-ort-wasm-int8-ts-ettin-32m-r1` | ort-wasm | int8 | ts-ettin-32m | ok | 4,353 | 202.2 | 206.3 / 1,292.7 / 2,046.2 | 203.0 / 567.1 · 1,339.6 / 2,143.7 | 35.47 | 10.0 | 594 | 7.1e-01 · 103/156 | — |
| `2026-11-21-emulador-macmini-chrome133-ort-wasm-int8-ts-ettin-32m-r2` | ort-wasm | int8 | ts-ettin-32m | ok | 2,641 | 180.7 | 179.3 / 1,178.5 / 1,634.0 | 178.3 / 395.7 · 1,300.6 / 1,803.0 | 35.47 | 10.0 | 598 | 7.1e-01 · 103/156 | — |
| `2026-11-21-emulador-macmini-chrome133-ort-wasm-int8-ts-ettin-32m-r3` | ort-wasm | int8 | ts-ettin-32m | ok | 3,409 | 198.7 | 193.9 / 1,277.6 / 1,784.1 | 193.6 / 409.7 · 1,286.8 / 1,952.7 | 35.47 | 10.0 | 565 | 7.1e-01 · 103/156 | — |
| `2026-11-21-emulador-macmini-chrome133-ort-wasm-q8emb-f16-ts-ettin-17m-r1` | ort-wasm | q8emb-f16 | ts-ettin-17m | ok | 6,342 | 85.4 | 79.3 / 609.6 / 887.0 | 79.1 / 167.7 · 625.8 / 998.8 | 24.93 | 10.0 | 517 | 2.0e-02 · 153/156 | — |
| `2026-11-21-emulador-macmini-chrome133-ort-wasm-q8emb-f16-ts-ettin-17m-r2` | ort-wasm | q8emb-f16 | ts-ettin-17m | ok | 3,648 | 100.8 | 79.7 / 615.3 / 904.3 | 79.0 / 170.8 · 646.5 / 1,033.2 | 24.93 | 10.0 | 508 | 2.0e-02 · 153/156 | — |
| `2026-11-21-emulador-macmini-chrome133-ort-wasm-q8emb32-f16-ts-ettin-17m-r1` | ort-wasm | q8emb32-f16 | ts-ettin-17m | ok | 3,822 | 85.0 | 79.5 / 618.6 / 896.7 | 79.2 / 169.2 · 638.5 / 1,004.1 | 26.34 | 10.0 | 538 | 8.9e-03 · 155/156 | — |
| `2026-11-21-emulador-macmini-chrome133-ort-wasm-q8emb32-f16-ts-ettin-17m-r2` | ort-wasm | q8emb32-f16 | ts-ettin-17m | ok | 3,265 | 89.7 | 78.8 / 595.1 / 909.6 | 78.3 / 179.1 · 737.8 / 1,012.1 | 26.34 | 10.0 | 538 | 8.9e-03 · 155/156 | — |
| `2026-11-21-emulador-macmini-chrome133-ort-webgpu-8bit-ts-ettin-17m-r1` | ort-webgpu | 8bit | ts-ettin-17m | failed | — | — | — / — / — | — | 22.51 | 10.0 | 429 | — | no available backend found. ERR: [webgpu] Error: Failed to get GPU adapter. You may need to enable flag "--enable-unsafe-webgpu" if you are  |
| `2026-11-21-emulador-macmini-chrome133-ort-webgpu-8bit-ts-ettin-17m-r2` | ort-webgpu | 8bit | ts-ettin-17m | failed | — | — | — / — / — | — | 22.51 | 10.0 | 431 | — | no available backend found. ERR: [webgpu] Error: Failed to get GPU adapter. You may need to enable flag "--enable-unsafe-webgpu" if you are  |

Em quatro execuções do `@johnhenry` (r1 e r2, no 17M e no 32M) o motor carregou os 67,48 MB de pesos (`engineInfo.modelBytes`), mas o Chrome não registrou o download na Resource Timing, e a tabela marca o total como incompleto; a primeira visita correta é a da r3, **68,06 MB**. A causa não foi estabelecida: as execuções seguintes, com o mesmo procedimento, registraram.

**Repetição** (`repeatability.py`). Três configurações variaram mais de 10% entre a primeira e a segunda execução e, como manda a `T-08`, foram medidas uma terceira vez. Em duas, a terceira confirma a primeira e a segunda foi o ponto fora (`fp32` 17M: 78,8 · 96,5 · 79,5 ms; `@johnhenry` 17M: 408,2 · 366,7 · 399,0 ms); no `int8` do 32M as três se espalham em 15% (206,3 · 179,3 · 193,9 ms). Nas demais, a diferença ficou entre 0,2% e 9,1%.

| Configuração | Repetições | Estado | Quente p50 por repetição (ms) | Maior diferença | Acima de 10%? |
|---|---:|---|---|---:|---|
| `2026-11-21-emulador-macmini-chrome133-jh-cpu-f32-ts-ettin-17m` | 3 | ok · ok · ok | 408.2 / 366.7 / 399.0 | 11.3% | **sim** |
| `2026-11-21-emulador-macmini-chrome133-jh-cpu-f32-ts-ettin-32m` | 2 | ok · ok | 1121.3 / 1118.9 | 0.2% | não |
| `2026-11-21-emulador-macmini-chrome133-jh-webgpu-f32-ts-ettin-17m` | 2 | failed · failed | — | — | — |
| `2026-11-21-emulador-macmini-chrome133-ort-wasm-8bit-ts-ettin-17m` | 2 | ok · ok | 94.9 / 95.7 | 0.9% | não |
| `2026-11-21-emulador-macmini-chrome133-ort-wasm-8bit-ts-ettin-32m` | 2 | ok · ok | 288.8 / 264.8 | 9.1% | não |
| `2026-11-21-emulador-macmini-chrome133-ort-wasm-fp32-ts-ettin-17m` | 3 | ok · ok · ok | 78.8 / 96.5 / 79.5 | 22.4% | **sim** |
| `2026-11-21-emulador-macmini-chrome133-ort-wasm-int8-ts-ettin-17m` | 2 | ok · ok | 69.1 / 67.9 | 1.8% | não |
| `2026-11-21-emulador-macmini-chrome133-ort-wasm-int8-ts-ettin-32m` | 3 | ok · ok · ok | 206.3 / 179.3 / 193.9 | 15.0% | **sim** |
| `2026-11-21-emulador-macmini-chrome133-ort-wasm-q8emb-f16-ts-ettin-17m` | 2 | ok · ok | 79.3 / 79.7 | 0.4% | não |
| `2026-11-21-emulador-macmini-chrome133-ort-wasm-q8emb32-f16-ts-ettin-17m` | 2 | ok · ok | 79.5 / 78.8 | 0.8% | não |
| `2026-11-21-emulador-macmini-chrome133-ort-webgpu-8bit-ts-ettin-17m` | 2 | failed · failed | — | — | — |

**O motor do navegador contra o nativo, com o mesmo arquivo** (`web_vs_native.py`): o mesmo do Safari do iOS (seção 5). Idêntico ao nativo em `8bit`, `fp32`, `q8emb-f16` e `q8emb32-f16` (máx. |Δp| ≤ 1,6e-6) e o mesmo desvio no `int8` (1,7e-1 no 17M; 2,8e-1 no 32M) nos dois navegadores — o desvio é do kernel `int8` do ONNX Runtime Web, não do navegador.

| Execução | Variante | Modelo | Web × nativo: máx. \|Δp\| · vencedora igual | Nativo × referência | Web × referência |
|---|---|---|---|---|---|
| `2026-11-21-emulador-macmini-chrome133-ort-wasm-8bit-ts-ettin-17m-r1` | 8bit | ts-ettin-17m | 1.2e-06 · 156/156 | 4.5e-02 · 151/156 | 4.5e-02 · 151/156 |
| `2026-11-21-emulador-macmini-chrome133-ort-wasm-8bit-ts-ettin-32m-r1` | 8bit | ts-ettin-32m | 1.1e-06 · 156/156 | 4.5e-02 · 155/156 | 4.5e-02 · 155/156 |
| `2026-11-21-emulador-macmini-chrome133-ort-wasm-fp32-ts-ettin-17m-r1` | fp32 | ts-ettin-17m | 1.2e-06 · 156/156 | 1.0e-06 · 156/156 | 1.6e-06 · 156/156 |
| `2026-11-21-emulador-macmini-chrome133-ort-wasm-int8-ts-ettin-17m-r1` | int8 | ts-ettin-17m | 1.7e-01 · 133/156 | 4.1e-01 · 96/156 | 4.1e-01 · 93/156 |
| `2026-11-21-emulador-macmini-chrome133-ort-wasm-int8-ts-ettin-32m-r1` | int8 | ts-ettin-32m | 2.8e-01 · 134/156 | 7.0e-01 · 105/156 | 7.1e-01 · 103/156 |
| `2026-11-21-emulador-macmini-chrome133-ort-wasm-q8emb-f16-ts-ettin-17m-r1` | q8emb-f16 | ts-ettin-17m | 1.4e-06 · 156/156 | 2.0e-02 · 153/156 | 2.0e-02 · 153/156 |
| `2026-11-21-emulador-macmini-chrome133-ort-wasm-q8emb32-f16-ts-ettin-17m-r1` | q8emb32-f16 | ts-ettin-17m | 1.6e-06 · 156/156 | 8.9e-03 · 155/156 | 8.9e-03 · 155/156 |

**Resumo da `T-08`** **[MEDIDO no emulador]**:

- **Funciona** no Chrome do Android: o ONNX Runtime Web em Wasm, em todas as variantes, e o `@johnhenry` em CPU. **Não funciona:** WebGPU, em nenhuma configuração do emulador.
- **Primeira visita** (brotli): `int8` 20,16 MB · `8bit` 20,63 MB · `q8emb-f16` 24,93 MB · `q8emb32-f16` 26,34 MB · `fp32` 71,36 MB · `@johnhenry` `f32` 68,06 MB. O runtime do ONNX Runtime Web em Wasm tem 2.483.259 B (o do ponto de entrada WebGPU, 4.362.190 B); o do `@johnhenry`, 86.798 B; o tokenizador, 483.663 B.
- **Memória** (PSS máximo do Chrome): de 415 a 678 MB nas execuções que rodaram.
- **Latência quente no emulador** (indicativa): p50 de 67,9 a 96,5 ms no ONNX Runtime 17M e de 366,7 a 408,2 ms no `@johnhenry` 17M. A p95 do ONNX Runtime 17M (de 433,9 a 698,7 ms) cai nas 4 entradas longas (346 a 523 tokens; p50 de 461,8 a 747,5 ms entre elas); só com as entradas de até 128 tokens, a p95 fica entre 142,7 e 228,2 ms.

## 4. Teste do motor existente (`T-09`)

**Referência.** `.venv/Scripts/python.exe -I bench/spike-mobile/reference/run_reference.py ts-ettin-17m` (e `ts-ettin-32m`) regenera [`reference/ts-ettin-17m.json`](../../bench/spike-mobile/reference/ts-ettin-17m.json): o `dinah.py` do modelo, PyTorch FP32 em CPU, uma thread; duas execuções deram arquivos idênticos byte a byte.

**Os artefatos, no ONNX Runtime nativo.** `run_reference.py --onnx <arquivo>` roda cada grafo no ONNX Runtime 1.32 (Python, CPU, uma thread) com as mesmas entradas e grava o resultado em `bench/results/2026-11-21-nativo-onnxruntime-cpu-*.json`. É o que separa o erro do **artefato** do erro do **motor do navegador**; a comparação Web × nativo, com o mesmo arquivo, está nas seções 3 e 5 e logo abaixo. Fronteira entre tamanho e paridade, TS-Ettin-17M (no Chrome, primeira visita = pesos + 2.975.831 B de runtime, adaptador, tokenizador e configuração, medidos nas execuções da seção 3):

| Variante | Pesos (B) | máx. \|Δp\| | Vencedora igual | Vencedora igual com margem ≥ 0,01 | Tolerância Q8 (Δp ≤ 0,03 e ≥ 99%) |
|---|---:|---:|---:|---:|---|
| `int8 (publicado)` | 17.180.077 | 4.1e-01 | 96/156 | 90/138 | não cumpre |
| `8bit (publicado)` | 17.657.261 | 4.5e-02 | 151/156 | 138/138 | não cumpre |
| `fp32 (exportado)` | 68.381.159 | 1.0e-06 | 156/156 | 138/138 | — |
| `q8emb-f16` | 21.958.382 | 2.0e-02 | 153/156 | 138/138 | não cumpre |
| `q8emb128-s16` | 21.958.715 | 2.0e-02 | 154/156 | 138/138 | não cumpre |
| `q8emb64-s16` | 22.160.191 | 8.8e-03 | 152/156 | 138/138 | não cumpre |
| `q8emb32-f16` | 23.368.916 | 8.9e-03 | 155/156 | 138/138 | cumpre |
| `q8emb32-mm8-s16` | 19.036.424 | 2.7e-02 | 149/156 | 138/138 | não cumpre |

Nenhum artefato testado cabe em 25 MB **e** cumpre a tolerância Q8 ao mesmo tempo: o único que cumpre (`q8emb32-f16`) leva a primeira visita a 26,34 MB (medido no Chrome do Android, seção 3). Em todos os de 8 bits por peso, as vencedoras trocadas são quase-empates — com margem da referência ≥ 0,01 a concordância é 138/138. O critério do portão não tem essa exceção e não foi mudado. No TS-Ettin-32M: `int8` → Δp 7,0e-1 e 105/156; `8bit` → Δp 4,5e-2 e 155/156.

**Web × nativo, forma e tokens:** no Chrome do Android (seção 3) e no Safari do iOS (seção 5), com o mesmo arquivo, o motor do navegador reproduz o nativo em todas as variantes, menos `int8`; a forma confere em todas as execuções; os tokens são idênticos aos da referência (156/156 com `debug=1`, nos dois motores).

**200 decisões seguidas** (`endurance.py`), no emulador do Mac, uma execução por variante do 17M, com `--enable-precise-memory-info` **[MEDIDO]**:

| Execução | Motor | Variante | Estado | Decisões ok / pedidas | Falhas | Heap JS início → fim (MB) | Diferença (MiB) | Sem crescimento (≤ 1 MiB)? | Heap preciso? | PSS máx. (MB) | p50 / p95 (ms) |
|---|---|---|---|---:|---:|---|---:|---|---|---:|---:|
| `2026-11-21-emulador-macmini-chrome133-jh-cpu-f32-ts-ettin-17m-resistencia-200-r1` | jh-cpu | f32 | ok | 200 / 200 | 0 | 90.27 → 98.53 | +7.88 | **não** | sim | 429 | 398.6 / 2896.4 |
| `2026-11-21-emulador-macmini-chrome133-ort-wasm-8bit-ts-ettin-17m-resistencia-200-r1` | ort-wasm | 8bit | ok | 200 / 200 | 0 | 22.25 → 17.17 | -4.85 | sim | sim | 457 | 94.0 / 573.7 |
| `2026-11-21-emulador-macmini-chrome133-ort-wasm-fp32-ts-ettin-17m-resistencia-200-r1` | ort-wasm | fp32 | ok | 200 / 200 | 0 | 152.45 → 15.52 | -130.58 | sim | sim | 678 | 80.2 / 612.7 |
| `2026-11-21-emulador-macmini-chrome133-ort-wasm-int8-ts-ettin-17m-resistencia-200-r1` | ort-wasm | int8 | ok | 200 / 200 | 0 | 32.99 → 14.91 | -17.24 | sim | sim | 480 | 69.4 / 461.2 |
| `2026-11-21-emulador-macmini-chrome133-ort-wasm-q8emb-f16-ts-ettin-17m-resistencia-200-r1` | ort-wasm | q8emb-f16 | ok | 200 / 200 | 0 | 37.61 → 38.41 | +0.76 | sim | sim | 534 | 79.3 / 613.1 |
| `2026-11-21-emulador-macmini-chrome133-ort-wasm-q8emb32-f16-ts-ettin-17m-resistencia-200-r1` | ort-wasm | q8emb32-f16 | ok | 200 / 200 | 0 | 39.16 → 14.92 | -23.11 | sim | sim | 538 | 76.0 / 585.5 |

Nenhuma falha e nenhuma aba recarregada ou travada nas seis: o critério “aguenta” do portão GT é cumprido por todas. O critério de memória da `T-09` (heap JS no fim ≤ início + 1 MiB, fixado na seção 1) é cumprido pelo ONNX Runtime em todas as variantes (no pior caso, +0,76 MiB no `q8emb-f16`) e **não** pelo `@johnhenry` (+7,88 MiB: o heap subiu de 90,27 para 98,53 MB, passando por 89,45, 96,54 e 96,41 MB a cada 50 decisões). O heap é lido sem forçar coleta de lixo — as quedas grandes do ONNX Runtime (de 152,45 para 15,52 MB no `fp32`) são coletas no meio do caminho, e a subida do `@johnhenry` pode ser coleta ainda não feita —, mas o critério não tem essa exceção e não foi mudado.

**Os caminhos WebGPU** só existem no desktop (seção 2): no celular, nem o emulador nem o simulador entregam WebGPU. Com o mesmo arquivo, contra o nativo e contra a referência (`web_vs_native.py`):

| Execução | Variante | Modelo | Web × nativo: máx. \|Δp\| · vencedora igual | Nativo × referência | Web × referência |
|---|---|---|---|---|---|
| `2026-11-21-desktop-macmini-chrome157-ort-webgpu-fp32-ts-ettin-17m` | fp32 | ts-ettin-17m | 4.8e-02 · 154/156 | 1.0e-06 · 156/156 | 4.8e-02 · 154/156 |
| `2026-11-21-desktop-macmini-chrome157-ort-webgpu-q8emb32-f16-ts-ettin-17m` | q8emb32-f16 | ts-ettin-17m | 4.9e-02 · 154/156 | 8.9e-03 · 155/156 | 4.8e-02 · 153/156 |

O provedor WebGPU do ONNX Runtime erra **mesmo com os pesos FP32**: máx. |Δp| 4,8e-2 contra o nativo com o mesmo arquivo, que fica a 1,0e-6 da referência — o erro é do motor, não do artefato. Com os quantizados publicados ele trava, e o JSEP não cria a sessão. O `@johnhenry` em WebGPU acerta com os pesos FP32 (1,9e-6) e, em FP16, fica em 1,7e-3, acima da tolerância de FP16 (1e-3), com a vencedora igual nas 156 perguntas. **200 decisões seguidas no desktop** (`endurance.py`), nos caminhos WebGPU que rodam:

| Execução | Motor | Variante | Estado | Decisões ok / pedidas | Falhas | Heap JS início → fim (MB) | Diferença (MiB) | Sem crescimento (≤ 1 MiB)? | Heap preciso? | PSS máx. (MB) | p50 / p95 (ms) |
|---|---|---|---|---:|---:|---|---:|---|---|---:|---:|
| `2026-11-21-desktop-macmini-chrome157-jh-webgpu-f32-ts-ettin-17m-resistencia-200` | jh-webgpu | f32 | ok | 200 / 200 | 0 | 100.70 → 153.22 | +50.09 | **não** | sim | — | 6.8 / 28.5 |
| `2026-11-21-desktop-macmini-chrome157-ort-webgpu-fp32-ts-ettin-17m-resistencia-200` | ort-webgpu | fp32 | ok | 200 / 200 | 0 | 92.36 → 16.52 | -72.32 | sim | sim | — | 17.9 / 80.0 |
| `2026-11-21-desktop-macmini-chrome157-ort-webgpu-q8emb32-f16-ts-ettin-17m-resistencia-200` | ort-webgpu | q8emb32-f16 | ok | 200 / 200 | 0 | 40.52 → 51.40 | +10.38 | **não** | sim | — | 17.8 / 79.8 |

**Veredito de corretude da `T-09`**, por variante do 17M — Wasm e CPU no emulador Android, WebGPU no desktop **[MEDIDO]**:

| Motor e variante | Acerta igual (tolerância da variante)? | Forma | 200 decisões sem falha | Sem crescimento de memória |
|---|---|---|---|---|
| ONNX Runtime Wasm `fp32` | **sim** — máx. \|Δp\| 1,6e-6, 156/156 | igual à especificação | sim | sim |
| ONNX Runtime Wasm `q8emb32-f16` | **sim** — 8,9e-3 e 155/156 (99,4%) | igual | sim | sim |
| ONNX Runtime Wasm `q8emb-f16` | não — 153/156 (98,1% < 99%) | igual | sim | sim |
| ONNX Runtime Wasm `8bit` (publicado) | não — 4,5e-2 > 0,03 | igual | sim | sim |
| ONNX Runtime Wasm `int8` (publicado) | não — 4,1e-1 | igual | sim | sim |
| `@johnhenry` CPU `f32` | **sim** — 1,1e-6, 156/156 | igual | sim | **não** (+7,88 MiB) |
| ONNX Runtime WebGPU `fp32` (desktop) | **não** — 4,8e-2; o mesmo arquivo dá 1,0e-6 no nativo | igual | sim | sim |
| ONNX Runtime WebGPU `q8emb32-f16` (desktop) | **não** — 4,8e-2 | igual | sim | **não** (+10,38 MiB) |
| ONNX Runtime WebGPU `8bit` e `int8` (desktop) | não roda — trava na segunda decisão | — | — | — |
| ONNX Runtime WebGPU JSEP, as três (desktop) | não roda — a sessão falha | — | — | — |
| `@johnhenry` WebGPU `f32` (desktop) | **sim** — 1,9e-6, 156/156 | igual | sim | **não** (+50,09 MiB) |
| `@johnhenry` WebGPU `f16` (desktop) | não — 1,7e-3 > 1e-3 (156/156) | igual | não medido | não medido |

**Em uma frase:** o ONNX Runtime Web responde certo no navegador quando o artefato é bom — em `fp32` e na `q8emb32-f16`, com forma idêntica e sem falhas nem crescimento de memória em 200 decisões —, e o erro das variantes publicadas é do artefato, não do motor; mas a única variante de 8 bits que acerta leva a primeira visita a 26,34 MB no Chrome do Android, acima dos 25 MB do portão, e a que cabe (`q8emb-f16`, 24,93 MB) erra a vencedora em 3 das 156 perguntas. No WebGPU, que só existe no desktop, o provedor do ONNX Runtime erra mesmo com os pesos FP32 e trava com os quantizados; o `@johnhenry` acerta em FP32, com 68 MB de pesos.

## 5. Safari do iOS no simulador (complemento da `T-08`)

> Medido em 2026-11-21 no **Mac mini** (Apple M1, 16 GB, macOS 27.2), no simulador do Xcode 27.1 — iOS 27.0 (24A434), Mobile Safari 27.0 (8625.1.29.10.29) —, pelo [`run-ios.mjs`](../../bench/spike-mobile/run-ios.mjs), que apaga e religa o aparelho antes de cada execução ([MACMINI.md](../../bench/spike-mobile/MACMINI.md)). O simulador roda no processador e na GPU do Mac: **nenhuma latência daqui é latência de iPhone**. Complementa a `T-08` com o WebKit do iOS; não substitui a `T-02` (iPhone real). Mesmas dez configurações da matriz do emulador, duas execuções cada: `bench/results/2026-11-21-ios-simulador-safari27-*.json`.

**O que rodou e o que não rodou.** Rodaram, nas duas execuções, com as 66 entradas respondidas e a forma de todas as respostas conferida (`check_shape.py`: nenhum problema): o ONNX Runtime Web em Wasm nas cinco variantes (`int8`, `8bit`, `fp32` e `q8emb-f16` no 17M; `int8` e `8bit` no 32M) e o motor `@johnhenry` em CPU (17M e 32M). **Não rodaram os dois caminhos WebGPU**: o Safari do simulador tem `navigator.gpu`, mas não entrega adaptador ([sonda](../../bench/results/2026-11-21-ios-simulador-probe.json)); a falha ficou no JSON com a mensagem de cada motor. O `DecisionModel` nativo não existe no Safari.

**Quanto baixa, quanto ocupa e quanto demora.** Bytes na rede com **gzip** — o Safari só anuncia brotli em HTTPS, e a página é servida em `http://localhost`. Memória: o RSS, visto pelo Mac, dos processos WebKit do aparelho. Latência **[MEDIDO no simulador; indicativo]**:

| Execução | Motor | Variante | Modelo | Estado | 1ª resposta (ms) | 1ª passada p50 (ms) | Quente p50 / p95 / p99 (ms) | Quente p50 / p95: ≤ 128 tokens · > 128 (ms) | 1ª visita (MB) | Heap JS máx. (MB) | Memória máx. (MB; PSS no Android, RSS no simulador iOS) | máx. \|Δp\| · top-1 | Falha |
|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| `2026-11-21-ios-simulador-safari27-jh-cpu-f32-ts-ettin-17m-r1` | jh-cpu | f32 | ts-ettin-17m | ok | 6,990 | 313.5 | 310.5 / 2,210.3 / 3,204.3 | 309.0 / 643.8 · 2,273.0 / 3,552.3 | 68.23 | — | 529 | 1.1e-06 · 156/156 | — |
| `2026-11-21-ios-simulador-safari27-jh-cpu-f32-ts-ettin-17m-r2` | jh-cpu | f32 | ts-ettin-17m | ok | 4,154 | 313.5 | 302.0 / 2,172.5 / 3,181.8 | 302.0 / 627.0 · 2,226.0 / 3,542.5 | 68.23 | — | 873 | 1.1e-06 · 156/156 | — |
| `2026-11-21-ios-simulador-safari27-jh-cpu-f32-ts-ettin-32m-r1` | jh-cpu | f32 | ts-ettin-32m | ok | 2,168 | 819.0 | 809.0 / 5,615.4 / 8,035.6 | 808.0 / 1,650.8 · 5,635.0 / 8,875.5 | 128.91 | — | 1,169 | 1.7e-06 · 156/156 | — |
| `2026-11-21-ios-simulador-safari27-jh-cpu-f32-ts-ettin-32m-r2` | jh-cpu | f32 | ts-ettin-32m | ok | 4,765 | 835.5 | 795.0 / 5,449.3 / 7,938.5 | 784.0 / 1,687.8 · 5,752.0 / 8,650.7 | 128.91 | — | 1,234 | 1.7e-06 · 156/156 | — |
| `2026-11-21-ios-simulador-safari27-jh-webgpu-f32-ts-ettin-17m-r1` | jh-webgpu | f32 | ts-ettin-17m | failed | — | — | — / — / — | — | 0.79 | — | 878 | — | webgpu: no GPU adapter available |
| `2026-11-21-ios-simulador-safari27-jh-webgpu-f32-ts-ettin-17m-r2` | jh-webgpu | f32 | ts-ettin-17m | failed | — | — | — / — / — | — | 0.79 | — | 882 | — | webgpu: no GPU adapter available |
| `2026-11-21-ios-simulador-safari27-ort-wasm-8bit-ts-ettin-17m-r1` | ort-wasm | 8bit | ts-ettin-17m | ok | 4,923 | 59.5 | 59.0 / 350.1 / 504.5 | 58.0 / 119.8 · 361.0 / 563.0 | 22.17 | — | 867 | 4.5e-02 · 151/156 | — |
| `2026-11-21-ios-simulador-safari27-ort-wasm-8bit-ts-ettin-17m-r2` | ort-wasm | 8bit | ts-ettin-17m | ok | 1,579 | 59.5 | 58.0 / 348.1 / 490.9 | 58.0 / 118.0 · 435.0 / 538.5 | 22.17 | — | 1,053 | 4.5e-02 · 151/156 | — |
| `2026-11-21-ios-simulador-safari27-ort-wasm-8bit-ts-ettin-32m-r1` | ort-wasm | 8bit | ts-ettin-32m | ok | 2,760 | 179.0 | 179.0 / 1,050.5 / 1,539.1 | 178.0 / 361.4 · 1,085.0 / 1,679.8 | 38.56 | — | 705 | 4.5e-02 · 155/156 | — |
| `2026-11-21-ios-simulador-safari27-ort-wasm-8bit-ts-ettin-32m-r2` | ort-wasm | 8bit | ts-ettin-32m | ok | 24,512 | 190.5 | 172.5 / 943.3 / 1,434.6 | 171.0 / 335.0 · 1,059.0 / 1,476.2 | 38.56 | — | 1,183 | 4.5e-02 · 155/156 | — |
| `2026-11-21-ios-simulador-safari27-ort-wasm-fp32-ts-ettin-17m-r1` | ort-wasm | fp32 | ts-ettin-17m | ok | 2,532 | 49.5 | 49.0 / 370.2 / 553.8 | 49.0 / 105.0 · 380.0 / 628.2 | 72.89 | — | 1,315 | 1.6e-06 · 156/156 | — |
| `2026-11-21-ios-simulador-safari27-ort-wasm-fp32-ts-ettin-17m-r2` | ort-wasm | fp32 | ts-ettin-17m | ok | 23,344 | 50.0 | 48.0 / 375.0 / 567.8 | 48.0 / 105.8 · 376.0 / 659.9 | 72.89 | — | 1,286 | 1.6e-06 · 156/156 | — |
| `2026-11-21-ios-simulador-safari27-ort-wasm-int8-ts-ettin-17m-r1` | ort-wasm | int8 | ts-ettin-17m | ok | 9,199 | 55.0 | 53.0 / 346.1 / 490.2 | 53.0 / 108.0 · 368.0 / 543.5 | 21.69 | — | 1,235 | 4.1e-01 · 93/156 | — |
| `2026-11-21-ios-simulador-safari27-ort-wasm-int8-ts-ettin-17m-r2` | ort-wasm | int8 | ts-ettin-17m | ok | 2,125 | 53.5 | 52.0 / 342.1 / 479.4 | 52.0 / 106.0 · 348.0 / 531.1 | 21.69 | — | 1,157 | 4.1e-01 · 93/156 | — |
| `2026-11-21-ios-simulador-safari27-ort-wasm-int8-ts-ettin-32m-r1` | ort-wasm | int8 | ts-ettin-32m | ok | 2,767 | 155.0 | 153.0 / 992.8 / 1,403.6 | 153.0 / 322.4 · 1,107.0 / 1,551.0 | 37.01 | — | 1,196 | 7.1e-01 · 103/156 | — |
| `2026-11-21-ios-simulador-safari27-ort-wasm-int8-ts-ettin-32m-r2` | ort-wasm | int8 | ts-ettin-32m | ok | 1,756 | 154.0 | 154.0 / 1,007.3 / 1,520.4 | 153.0 / 337.4 · 1,175.0 / 1,617.2 | 37.01 | — | 1,111 | 7.1e-01 · 103/156 | — |
| `2026-11-21-ios-simulador-safari27-ort-wasm-q8emb-f16-ts-ettin-17m-r1` | ort-wasm | q8emb-f16 | ts-ettin-17m | ok | 6,090 | 51.0 | 48.0 / 371.2 / 557.2 | 48.0 / 103.4 · 379.0 / 616.8 | 26.47 | — | 1,336 | 2.0e-02 · 153/156 | — |
| `2026-11-21-ios-simulador-safari27-ort-wasm-q8emb-f16-ts-ettin-17m-r2` | ort-wasm | q8emb-f16 | ts-ettin-17m | ok | 7,404 | 50.0 | 48.0 / 375.1 / 571.2 | 48.0 / 103.0 · 386.0 / 625.7 | 26.47 | — | 994 | 2.0e-02 · 153/156 | — |
| `2026-11-21-ios-simulador-safari27-ort-webgpu-8bit-ts-ettin-17m-r1` | ort-webgpu | 8bit | ts-ettin-17m | failed | — | — | — / — / — | — | 25.49 | — | 748 | — | no available backend found. ERR: [webgpu] Error: Failed to get GPU adapter. You may need to enable flag "--enable-unsafe-webgpu" if you are  |
| `2026-11-21-ios-simulador-safari27-ort-webgpu-8bit-ts-ettin-17m-r2` | ort-webgpu | 8bit | ts-ettin-17m | failed | — | — | — / — / — | — | 25.49 | — | 827 | — | no available backend found. ERR: [webgpu] Error: Failed to get GPU adapter. You may need to enable flag "--enable-unsafe-webgpu" if you are  |

O Safari não expõe `performance.memory`, daí a coluna de heap vazia. O RSS da mesma configuração variou bastante entre as duas execuções (no `@johnhenry` 17M, 529 e 873 MB): ele inclui o que o WebKit guarda do carregamento e não serve para comparar motores entre si.

**Repetição** (`repeatability.py`): o p50 quente variou no máximo 3,8% entre as duas execuções de cada configuração — abaixo do limite de 10% da `T-08`, então não houve terceira rodada.

| Configuração | Repetições | Estado | Quente p50 por repetição (ms) | Maior diferença | Acima de 10%? |
|---|---:|---|---|---:|---|
| `2026-11-21-ios-simulador-safari27-jh-cpu-f32-ts-ettin-17m` | 2 | ok · ok | 310.5 / 302.0 | 2.8% | não |
| `2026-11-21-ios-simulador-safari27-jh-cpu-f32-ts-ettin-32m` | 2 | ok · ok | 809.0 / 795.0 | 1.8% | não |
| `2026-11-21-ios-simulador-safari27-jh-webgpu-f32-ts-ettin-17m` | 2 | failed · failed | — | — | — |
| `2026-11-21-ios-simulador-safari27-ort-wasm-8bit-ts-ettin-17m` | 2 | ok · ok | 59.0 / 58.0 | 1.7% | não |
| `2026-11-21-ios-simulador-safari27-ort-wasm-8bit-ts-ettin-32m` | 2 | ok · ok | 179.0 / 172.5 | 3.8% | não |
| `2026-11-21-ios-simulador-safari27-ort-wasm-fp32-ts-ettin-17m` | 2 | ok · ok | 49.0 / 48.0 | 2.1% | não |
| `2026-11-21-ios-simulador-safari27-ort-wasm-int8-ts-ettin-17m` | 2 | ok · ok | 53.0 / 52.0 | 1.9% | não |
| `2026-11-21-ios-simulador-safari27-ort-wasm-int8-ts-ettin-32m` | 2 | ok · ok | 153.0 / 154.0 | 0.7% | não |
| `2026-11-21-ios-simulador-safari27-ort-wasm-q8emb-f16-ts-ettin-17m` | 2 | ok · ok | 48.0 / 48.0 | 0.0% | não |
| `2026-11-21-ios-simulador-safari27-ort-webgpu-8bit-ts-ettin-17m` | 2 | failed · failed | — | — | — |

**O tempo até a primeira resposta não é estável no simulador:** de 1.579 a 24.512 ms na mesma bateria. A variação está quase toda no carregamento da própria página logo depois de religar o aparelho (`timings.navigationToScriptMs`, de 296 a 23.395 ms nas execuções do ONNX Runtime), não no motor: o preparo do motor na primeira pergunta (`timings.create[0].ms`, que inclui baixar e compilar runtime e pesos) ficou entre 628 e 4.535 ms. Este número fica fora das conclusões.

**O motor do navegador contra o nativo, com o mesmo arquivo** (`web_vs_native.py`) — a comparação que faltava na `T-09`:

| Execução | Variante | Modelo | Web × nativo: máx. \|Δp\| · vencedora igual | Nativo × referência | Web × referência |
|---|---|---|---|---|---|
| `2026-11-21-ios-simulador-safari27-ort-wasm-8bit-ts-ettin-17m-r1` | 8bit | ts-ettin-17m | 1.2e-06 · 156/156 | 4.5e-02 · 151/156 | 4.5e-02 · 151/156 |
| `2026-11-21-ios-simulador-safari27-ort-wasm-8bit-ts-ettin-17m-r2` | 8bit | ts-ettin-17m | 1.2e-06 · 156/156 | 4.5e-02 · 151/156 | 4.5e-02 · 151/156 |
| `2026-11-21-ios-simulador-safari27-ort-wasm-8bit-ts-ettin-32m-r1` | 8bit | ts-ettin-32m | 1.1e-06 · 156/156 | 4.5e-02 · 155/156 | 4.5e-02 · 155/156 |
| `2026-11-21-ios-simulador-safari27-ort-wasm-8bit-ts-ettin-32m-r2` | 8bit | ts-ettin-32m | 1.1e-06 · 156/156 | 4.5e-02 · 155/156 | 4.5e-02 · 155/156 |
| `2026-11-21-ios-simulador-safari27-ort-wasm-fp32-ts-ettin-17m-r1` | fp32 | ts-ettin-17m | 1.2e-06 · 156/156 | 1.0e-06 · 156/156 | 1.6e-06 · 156/156 |
| `2026-11-21-ios-simulador-safari27-ort-wasm-fp32-ts-ettin-17m-r2` | fp32 | ts-ettin-17m | 1.2e-06 · 156/156 | 1.0e-06 · 156/156 | 1.6e-06 · 156/156 |
| `2026-11-21-ios-simulador-safari27-ort-wasm-int8-ts-ettin-17m-r1` | int8 | ts-ettin-17m | 1.7e-01 · 133/156 | 4.1e-01 · 96/156 | 4.1e-01 · 93/156 |
| `2026-11-21-ios-simulador-safari27-ort-wasm-int8-ts-ettin-17m-r2` | int8 | ts-ettin-17m | 1.7e-01 · 133/156 | 4.1e-01 · 96/156 | 4.1e-01 · 93/156 |
| `2026-11-21-ios-simulador-safari27-ort-wasm-int8-ts-ettin-32m-r1` | int8 | ts-ettin-32m | 2.8e-01 · 134/156 | 7.0e-01 · 105/156 | 7.1e-01 · 103/156 |
| `2026-11-21-ios-simulador-safari27-ort-wasm-int8-ts-ettin-32m-r2` | int8 | ts-ettin-32m | 2.8e-01 · 134/156 | 7.0e-01 · 105/156 | 7.1e-01 · 103/156 |
| `2026-11-21-ios-simulador-safari27-ort-wasm-q8emb-f16-ts-ettin-17m-r1` | q8emb-f16 | ts-ettin-17m | 1.4e-06 · 156/156 | 2.0e-02 · 153/156 | 2.0e-02 · 153/156 |
| `2026-11-21-ios-simulador-safari27-ort-wasm-q8emb-f16-ts-ettin-17m-r2` | q8emb-f16 | ts-ettin-17m | 1.4e-06 · 156/156 | 2.0e-02 · 153/156 | 2.0e-02 · 153/156 |
| `2026-11-21-ios-simulador-safari27-ort-webgpu-8bit-ts-ettin-17m-r1` | 8bit | ts-ettin-17m | — | 4.5e-02 · 151/156 | — |
| `2026-11-21-ios-simulador-safari27-ort-webgpu-8bit-ts-ettin-17m-r2` | 8bit | ts-ettin-17m | — | 4.5e-02 · 151/156 | — |

O que essas tabelas mostram **[MEDIDO]**:

- Nas variantes `8bit`, `fp32` e `q8emb-f16`, o ONNX Runtime Web no Safari reproduz o ONNX Runtime nativo com o mesmo arquivo (máx. |Δp| ≤ 1,4e-6, vencedora igual em 156/156). **O erro contra a referência é do artefato quantizado, não do motor do navegador**; a fronteira tamanho × paridade da seção 4 vale também no navegador.
- No `int8`, o Wasm se afasta do nativo (máx. |Δp| 1,7e-1 no 17M e 2,8e-1 no 32M): a quantização dinâmica das ativações não dá o mesmo resultado nos dois. O artefato já fica longe da referência (4,1e-1), então o veredito da variante não muda.
- Só o FP32 cumpre a tolerância da sua variante: `fp32` no ONNX Runtime (1,6e-6) e o `@johnhenry` com os pesos publicados (1,1e-6 no 17M; 1,7e-6 no 32M) — mas com 72,89 e 68,23 MB na primeira visita. Com os mesmos pesos FP32, o p50 quente do `@johnhenry` em CPU é cerca de 6 vezes o do ONNX Runtime no mesmo simulador (310,5 e 302,0 ms contra 49,0 e 48,0 ms).
- O runtime pesa diferente nos dois motores: 3.865.323 B em gzip no ONNX Runtime Web em Wasm (7.184.673 B no ponto de entrada WebGPU) contra 98.664 B no `@johnhenry`; o tokenizador, 637.107 B. Na variante `8bit` do 17M, o runtime do ONNX Runtime é 17% da primeira visita.
