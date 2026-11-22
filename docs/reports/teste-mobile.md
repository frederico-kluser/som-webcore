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

## 3. Medição no emulador (`T-08`) — **em curso**

> **Interrompida.** Em 2026-11-21 o Claude Code encerrou o servidor da página e a rodada desta medição por falta de memória no computador, e a orientação do ambiente é não religá-los sem o dono pedir. Antes disso, duas rodadas foram descartadas por defeito de método: o Chrome do Android restaurava as abas da sessão anterior e páginas antigas rodavam ao lado da execução medida ([diário, incidentes](execucao-autonoma.md#incidentes-de-medição)). Uma terceira rodada, já com o Chrome zerado antes de cada execução, também foi descartada: os rótulos da pergunta de classificação de campos (“nome de usuário”, “senha atual”, em inglês) faziam o verificador de segredos do repositório tratar as probabilidades como credenciais, e o corpus foi trocado. **Não há, por enquanto, nenhuma execução versionada da `T-08`.**

O que a medição já mostrou, sem dados versionados que o sustentem — por isso só como orientação para a retomada: o ONNX Runtime Web em Wasm e o motor `@johnhenry` em CPU rodam no Chrome 133 do emulador, e o WebGPU não roda ali ([EMULADOR.md](../../bench/spike-mobile/EMULADOR.md), este sim com dados).

## 4. Teste do motor existente (`T-09`) — **em curso**

**Referência.** `.venv/Scripts/python.exe -I bench/spike-mobile/reference/run_reference.py ts-ettin-17m` (e `ts-ettin-32m`) regenera [`reference/ts-ettin-17m.json`](../../bench/spike-mobile/reference/ts-ettin-17m.json): o `dinah.py` do modelo, PyTorch FP32 em CPU, uma thread; duas execuções deram arquivos idênticos byte a byte.

**Os artefatos, no ONNX Runtime nativo.** `run_reference.py --onnx <arquivo>` roda cada grafo no ONNX Runtime 1.32 (Python, CPU, uma thread) com as mesmas entradas e grava o resultado em `bench/results/2026-11-21-nativo-onnxruntime-cpu-*.json`. É o que separa o erro do **artefato** do erro do **motor do navegador**: a comparação Web × nativo, com o mesmo arquivo, fica para a retomada. Fronteira entre tamanho e paridade, TS-Ettin-17M (primeira visita ≈ pesos + 2,98 MB de runtime, tokenizador e configuração, pelos bytes medidos na página):

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

Nenhum artefato testado cabe em 25 MB **e** cumpre a tolerância Q8 ao mesmo tempo: o único que cumpre (`q8emb32-f16`) leva a primeira visita a ≈ 26,3 MB. Em todos os de 8 bits por peso, as vencedoras trocadas são quase-empates — com margem da referência ≥ 0,01 a concordância é 138/138. O critério do portão não tem essa exceção e não foi mudado. No TS-Ettin-32M: `int8` → Δp 7,0e-1 e 105/156; `8bit` → Δp 4,5e-2 e 155/156.

**Web × nativo e forma, no Safari do iOS:** feitas na [seção 5](#5-safari-do-ios-no-simulador-complemento-da-t-08) — com o mesmo arquivo, o motor do navegador reproduz o nativo em `8bit`, `fp32` e `q8emb-f16`; a forma das respostas confere em todas as execuções.

**Falta:** as mesmas comparações no Chrome (emulador e desktop), a identidade dos tokens numa execução versionada (`debug=1`) e as 200 decisões seguidas (com `--enable-precise-memory-info`).

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
