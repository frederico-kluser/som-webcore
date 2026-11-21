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

**Falta:** a comparação Web × nativo, a forma do resultado nas execuções do navegador, a identidade dos tokens numa execução versionada (`debug=1`) e as 200 decisões seguidas (com `--enable-precise-memory-info`).
