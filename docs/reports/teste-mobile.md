# Teste do motor existente no Android — relatório do marco T

> Atividades `T-01`, `T-08`, `T-09`, `T-03`, `T-10` e `T-04` do [roadmap](../../ROADMAP.md#mt). Tudo foi medido em 2026-11-21 nesta máquina; os dados brutos estão em `bench/results/` e cada tabela abaixo é gerada deles por `bench/spike-mobile/reference/summarize.py` e `compare.py`.
> O emulador roda no processador do computador e não tem WebGPU: **nenhuma latência daqui é latência de celular** ([EMULADOR.md](../../bench/spike-mobile/EMULADOR.md)).

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

## 3. Medição no emulador (`T-08`) — **parcial**

> **Interrompida.** Em 2026-11-21 o Claude Code encerrou o servidor da página e a segunda rodada desta medição por falta de memória no computador, e a orientação do ambiente é não religá-los sem o dono pedir. Estão abaixo as **7 primeiras execuções** (a primeira repetição de 7 das 10 configurações); faltam a segunda repetição de todas, a primeira do `jh-cpu` com o 32M e as duas tentativas WebGPU. Nada aqui fecha a `T-08`.

Ambiente de todas as linhas: emulador `jev_playstore_36` (Android 16), Chrome 133.0.6943.137, `-gpu swiftshader_indirect` (linha de comando do processo gravada em cada arquivo; renderizador WebGL “Google SwiftShader”), dados do Chrome apagados antes de cada execução, Wasm de uma thread, sem isolamento de origem. Latências **indicativas** (emulador). A coluna “≤ 128 tokens · > 128” separa as entradas pelo tamanho da sequência mais longa (128 = a janela local de atenção); as quatro entradas longas puxam o p95 do corpus inteiro.

| Execução | Motor | Variante | Modelo | Estado | 1ª resposta (ms) | 1ª passada p50 (ms) | Quente p50 / p95 / p99 (ms) | Quente p50 / p95: ≤ 128 tokens · > 128 (ms) | 1ª visita (MB) | Heap JS máx. (MB) | PSS máx. (MB) | máx. \|Δp\| · top-1 | Falha |
|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| `2026-11-21-emulador-chrome133-jh-cpu-f32-ts-ettin-17m-r1` | jh-cpu | f32 | ts-ettin-17m | ok | 2,304 | 358.9 | 610.0 / 2,771.9 / 5,372.3 | 589.2 / 1,662.1 · 4,170.3 / 7,386.0 | 68.06 | 10.0 | 438 | 1.1e-06 · 156/156 | — |
| `2026-11-21-emulador-chrome133-ort-wasm-8bit-ts-ettin-17m-r1` | ort-wasm | 8bit | ts-ettin-17m | ok | 1,579 | 65.8 | 62.6 / 393.5 / 570.7 | 62.4 / 128.6 · 444.4 / 612.3 | 20.63 | 10.0 | 465 | 4.5e-02 · 151/156 | — |
| `2026-11-21-emulador-chrome133-ort-wasm-8bit-ts-ettin-32m-r1` | ort-wasm | 8bit | ts-ettin-32m | ok | 4,052 | 491.6 | 489.9 / 2,863.4 / 4,078.3 | 484.2 / 1,024.5 · 3,225.2 / 4,620.5 | 37.02 | 10.0 | 629 | 4.5e-02 · 155/156 | — |
| `2026-11-21-emulador-chrome133-ort-wasm-fp32-ts-ettin-17m-r1` | ort-wasm | fp32 | ts-ettin-17m | ok | 2,285 | 59.5 | 52.3 / 420.6 / 636.0 | 52.1 / 117.1 · 496.9 / 738.0 | 71.36 | 10.0 | 696 | 1.6e-06 · 156/156 | — |
| `2026-11-21-emulador-chrome133-ort-wasm-int8-ts-ettin-17m-r1` | ort-wasm | int8 | ts-ettin-17m | ok | 1,588 | 49.0 | 40.4 / 281.6 / 428.5 | 39.7 / 87.5 · 312.9 / 464.2 | 20.16 | 10.0 | 522 | 4.1e-01 · 93/156 | — |
| `2026-11-21-emulador-chrome133-ort-wasm-int8-ts-ettin-32m-r1` | ort-wasm | int8 | ts-ettin-32m | ok | 4,180 | 340.7 | 279.4 / 1,824.0 / 2,598.4 | 278.0 / 588.4 · 2,186.4 / 2,891.3 | 35.47 | 10.0 | 617 | 7.1e-01 · 103/156 | — |
| `2026-11-21-emulador-chrome133-ort-wasm-q8emb-f16-ts-ettin-17m-r1` | ort-wasm | q8emb-f16 | ts-ettin-17m | ok | 1,906 | 55.1 | 52.3 / 431.1 / 734.2 | 52.0 / 121.6 · 457.3 / 757.3 | 24.93 | 10.0 | 548 | 2.0e-02 · 153/156 | — |

O que já se vê, sem fechar a atividade:

- **Funciona no Chrome do Android:** o ONNX Runtime Web em Wasm rodou as quatro variantes do 17M e as duas do 32M; o motor `@johnhenry` rodou em CPU. Sem WebGPU no emulador ([EMULADOR.md](../../bench/spike-mobile/EMULADOR.md)).
- **Primeira visita:** 20,16 MB (`int8`) e 20,63 MB (`8bit`) no 17M; 35,47 e 37,02 MB no 32M; 24,93 MB com a variante derivada `q8emb-f16`; 68–71 MB com pesos FP32.
- **Memória:** PSS somado dos processos do Chrome entre 438 e 696 MB. A coluna de heap JS não serve para medir variação: sem a flag `--enable-precise-memory-info`, o Chrome arredonda `performance.memory` (todas as execuções deram o mesmo valor). As 200 decisões da `T-09` precisam dessa flag.

## 4. Teste do motor existente (`T-09`) — **parcial**

**Referência.** `.venv/Scripts/python.exe -I bench/spike-mobile/reference/run_reference.py ts-ettin-17m` (e `ts-ettin-32m`) regenera [`reference/ts-ettin-17m.json`](../../bench/spike-mobile/reference/ts-ettin-17m.json): o `dinah.py` do modelo, PyTorch FP32 em CPU, uma thread; duas execuções deram arquivos idênticos byte a byte.

**Tokenizador.** Nas execuções de desenvolvimento com `debug=1`, os ids de tokens da página (Tokenizers.js) e os da referência (Transformers) foram idênticos nas 156 perguntas, inclusive acentos e emoji; esses arquivos não foram guardados, então o resultado ainda precisa de uma execução final versionada com `debug=1`.

**Forma do resultado.** `reference/check_shape.py` não encontrou nenhum problema nas 7 execuções do emulador (66 itens cada).

**Paridade, por motor e precisão** — contra a referência e contra o ONNX Runtime **nativo** rodando o mesmo arquivo (`run_reference.py --onnx`), o que separa o erro do motor do erro do artefato:

| Motor e variante (emulador) | máx. \|Δp\| e vencedora igual, contra a referência FP32 | máx. \|Δp\| contra o ONNX Runtime nativo, mesmo arquivo |
|---|---|---|
| ONNX Runtime Web Wasm, `fp32` (17M) | 1,6e-6 · 156/156 | 1,2e-6 |
| ONNX Runtime Web Wasm, `8bit` (17M · 32M) | 4,5e-2 · 151/156 · 4,5e-2 · 155/156 | 1,2e-6 · 1,1e-6 |
| ONNX Runtime Web Wasm, `q8emb-f16` (17M) | 2,0e-2 · 153/156 | 1,5e-6 |
| ONNX Runtime Web Wasm, `int8` (17M · 32M) | 4,1e-1 · 93/156 · 7,1e-1 · 103/156 | **1,7e-1 · 2,8e-1** |
| `@johnhenry` CPU, `f32` (17M) | 1,1e-6 · 156/156 | — |

Leitura: o motor é fiel (≈ 1e-6) em FP32 e com pesos de 8 bits; o desvio das variantes de 8 bits contra a referência é do **artefato quantizado**. A exceção é o `int8` (ativações quantizadas em tempo de execução): ali o ONNX Runtime Web também diverge do nativo.

**Fronteira entre tamanho e paridade** — o mesmo modelo de 17M, artefatos publicados e derivados, no ONNX Runtime nativo (que o Web reproduz em ≈ 1e-6, acima). Primeira visita ≈ pesos + 2,98 MB de runtime, tokenizador e configuração:

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

Nenhum artefato testado cabe em 25 MB **e** cumpre a tolerância Q8 ao mesmo tempo: o único que cumpre (`q8emb32-f16`) leva a primeira visita a ≈ 26,3 MB. Em todos os de 8 bits por peso, as vencedoras trocadas são quase-empates — com margem da referência ≥ 0,01 a concordância é 138/138. O critério do portão não tem essa exceção e não foi mudado.

**Falta:** as 200 decisões seguidas (memória no início e no fim) e as execuções finais do desktop.
