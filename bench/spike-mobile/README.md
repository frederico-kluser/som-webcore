# Página de teste do marco T

Mede, com a API idêntica à do Chrome (`DecisionModel`), os motores que já existem — no Chrome de desktop e no Chrome do emulador Android. Contexto e critérios: [marco T do roadmap](../../ROADMAP.md#mt).

| Arquivo | Para quê |
|---|---|
| [`decision-model.d.ts`](decision-model.d.ts) | declarações da superfície ([especificação](../../docs/spec/decisions-api-surface.md)); `npx tsc -p tsconfig.json` compila contra elas o exemplo do roadmap e os do explainer (`types-check/`) |
| [`models.json`](models.json) · [`fetch-models.py`](fetch-models.py) | modelos fixados por revisão e SHA-256; o script baixa para um cache local, fora do git |
| [`serve.mjs`](serve.mjs) | servidor local em `http://localhost:8377`: arquivos, modelos do cache, `POST /api/results` grava em `bench/results/` |
| [`surface.html`](surface.html) | captura da superfície nativa (membros, validação, `availability()`, forma do resultado) |
| [`probe.html`](probe.html) · [`env.js`](env.js) | sonda do ambiente: WebGPU, WebAssembly, isolamento de origem |
| [`run-desktop.mjs`](run-desktop.mjs) | abre uma página no Chrome de desktop com perfil próprio (`%TEMP%\som-decisions-<navegador>`) e espera o resultado |
| [`run-android.mjs`](run-android.mjs) · [`EMULADOR.md`](EMULADOR.md) | o mesmo no Chrome do emulador Android, com amostras de memória |

```bash
python bench/spike-mobile/fetch-models.py
cd bench/spike-mobile && npm ci --ignore-scripts && node serve.mjs
```
