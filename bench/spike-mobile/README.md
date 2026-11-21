# Página de teste do marco T

Mede, com a API idêntica à do Chrome (`DecisionModel`), os motores que já existem — no Chrome de desktop e no Chrome do emulador Android. Contexto e critérios: [marco T do roadmap](../../ROADMAP.md#mt).

```bash
python bench/spike-mobile/fetch-models.py                      # modelos fixados, conferidos por SHA-256
cd bench/spike-mobile && npm ci --ignore-scripts && node serve.mjs
# outro terminal:
node bench/spike-mobile/run-desktop.mjs --browser stable --no-api --result <nome> \
     --url "http://localhost:8377/index.html?engine=ort-wasm&variant=8bit&name=<nome>"
node bench/spike-mobile/run-android.mjs --result <nome> --path "/index.html?engine=ort-wasm&variant=8bit&name=<nome>"
```

## A página (`index.html`, `app.js`)

Faz todas as perguntas de [`corpus.json`](corpus.json) — 66 entradas (34 em inglês, 32 em português), 13 esquemas, `boolean`, `choice` de 2 a 8 opções e `score` com e sem rótulos numéricos — **só pela Decisions API**: `DecisionModel.availability()`, `DecisionModel.create()`, `model.decide()` e `model.destroy()`. O motor por trás de `DecisionModel` vem da URL ([`engines/registry.js`](engines/registry.js)); trocar de motor não muda nenhuma chamada da página.

| Parâmetro | Valores |
|---|---|
| `engine` | `native` (o `DecisionModel` do navegador) · `ort-wasm` · `ort-webgpu` (provedor WebGPU nativo do ONNX Runtime) · `ort-webgpu-jsep` (provedor WebGPU em JavaScript) · `jh-cpu` · `jh-webgpu` |
| `model` | `ts-ettin-17m` (padrão) · `ts-ettin-32m` |
| `variant` | ONNX Runtime: `int8` · `8bit` · `fp32` (exportado por `reference/export_onnx.py`, só no cache local). `@johnhenry`: `f32` · `f16` (só WebGPU) |
| `threads` | threads do Wasm do ONNX Runtime (padrão 1; mais de 1 exige `coi=1`) |
| `warm` · `warmup` · `endurance` | decisões cronometradas (padrão 120), descartadas antes (padrão 3) e seguidas de resistência (padrão 0) |
| `lang` | `all` · `pt` · `en` |
| `coi=1` · `uamem=1` · `debug=1` · `trace=1` | isolamento de origem · `measureUserAgentSpecificMemory` · ids de tokens no JSON · etapas no log do servidor |
| `name` | arquivo de resultado em `bench/results/` |

**O que se mede**, num JSON por execução: ambiente (navegador, sistema, WebGPU, WebAssembly); tempo até a primeira resposta (desde a navegação; inclui baixar e iniciar o motor); latência da primeira passada e latência quente (p50, p95 e p99, interpolação linear entre postos, depois de 3 decisões descartadas); bytes por categoria pelo Resource Timing (`encodedBodySize` = bytes na rede, com brotli do `serve.mjs` para JS, Wasm e JSON, e pesos sem compressão, como no CDN do Hugging Face); memória (heap JS; no Android o `run-android.mjs` junta o PSS de cada processo do Chrome); e **todas** as respostas. O que falha fica no JSON com a mensagem de erro; se a página travar, o executor grava a falha com a última etapa que a página reportou.

## Tradução para o TS-Ettin

Igual em [`engines/ts-ettin.js`](engines/ts-ettin.js) e em [`reference/run_reference.py`](reference/run_reference.py). Cada pergunta vira uma sequência `[CLS] prompt [SEP] entrada [SEP] [OPT] opção₁ [OPT] opção₂ …`:

| Pergunta | Tipo no modelo | Texto das opções | Rótulos no resultado |
|---|---|---|---|
| `boolean` | `noul` (0) | `"The statement above is false."` e o próprio `prompt` (o padrão do `dinah.py`) | `"true"`, `"false"` |
| `choice` | `choice` (1) | `description`, ou o `label` quando não há descrição | os `label` |
| `score` | `score` (2) | `description` ou `label`; sem opções, `"1"`–`"5"` | os `label` |

Probabilidades: `softmax(logits / temperatura)`, com a temperatura do `config.json` do checkpoint. Resultado com a semântica do Chrome: `label` = opção mais provável (a primeira em empate), `confidence` = a probabilidade dela, `expectedScore` = Σ valor × p (rótulos numéricos, ou posição 1…N), membros em ordem lexicográfica e números arredondados para float32. A cabeça de confiança do modelo não é usada: o Chrome define `confidence` como a maior probabilidade.

**Diferença consciente em relação ao Chrome:** o polyfill da página não exige ativação de usuário antes de baixar o modelo, para as execuções automáticas.

## Referência e comparação (`reference/`)

| Arquivo | Para quê |
|---|---|
| [`run_reference.py`](reference/run_reference.py) | respostas de referência com o `dinah.py` do modelo (PyTorch FP32, CPU, uma thread): `reference/ts-ettin-17m.json` e `ts-ettin-32m.json`, idênticos entre execuções. Com `--onnx`, roda um ONNX publicado no ONNX Runtime nativo (diagnóstico) |
| [`export_onnx.py`](reference/export_onnx.py) | exporta o ONNX FP32 do checkpoint (para medir o motor sem erro de quantização) |
| [`compare.py`](reference/compare.py) | identidade dos tokens, maior \|Δp\|, concordância da vencedora, \|Δ expectedScore\| e \|Δ confidence\| |
| [`check_shape.py`](reference/check_shape.py) | forma de cada resposta contra a [especificação](../../docs/spec/decisions-api-surface.md) |

```bash
.venv/Scripts/python.exe -I bench/spike-mobile/reference/run_reference.py ts-ettin-17m
python bench/spike-mobile/reference/compare.py bench/spike-mobile/reference/ts-ettin-17m.json bench/results/<execução>.json
python bench/spike-mobile/reference/check_shape.py bench/results/<execução>.json
```

## Outros arquivos

| Arquivo | Para quê |
|---|---|
| [`decision-model.d.ts`](decision-model.d.ts) | declarações da superfície ([especificação](../../docs/spec/decisions-api-surface.md)); `npx tsc -p tsconfig.json` compila contra elas o exemplo do roadmap e os do explainer (`types-check/`) |
| [`models.json`](models.json) · [`fetch-models.py`](fetch-models.py) | modelos fixados por revisão e SHA-256; o script baixa para um cache local, fora do git |
| [`serve.mjs`](serve.mjs) | servidor local em `http://localhost:8377`: arquivos, modelos do cache, `POST /api/results` grava em `bench/results/` |
| [`surface.html`](surface.html) | captura da superfície nativa (membros, validação, `availability()`, forma do resultado) |
| [`probe.html`](probe.html) · [`env.js`](env.js) | sonda do ambiente: WebGPU, WebAssembly, isolamento de origem |
| [`run-desktop.mjs`](run-desktop.mjs) | abre uma página no Chrome de desktop com perfil próprio (`%TEMP%\som-decisions-<navegador>`) e espera o resultado |
| [`run-android.mjs`](run-android.mjs) · [`EMULADOR.md`](EMULADOR.md) | o mesmo no Chrome do emulador Android, com amostras de memória |
