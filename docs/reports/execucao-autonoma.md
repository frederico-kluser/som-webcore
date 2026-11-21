# Diário da execução autônoma do roadmap

> Execução do [ROADMAP.md](../../ROADMAP.md) por um agente de código, sem consulta ao dono no meio do caminho: as bifurcações e os portões são decididos pela regra de decisão delegada e registrados em ADR com a frase “decidido por delegação do dono”.
> **Para retomar:** leia a última seção “Estado e próximo passo”, rode `python3 scripts/roadmap.py waves` e continue pela primeira atividade liberada. Cada linha do diário aponta para a evidência versionada.

## Diário

| Data | Atividade | O que foi feito | Evidência | Decisão tomada | Pendência |
|---|---|---|---|---|---|
| 2026-11-21 | infraestrutura do marco T | Modelos fixados por revisão e SHA-256 (o TS-Ettin-32M foi fixado no roadmap antes do download); servidor local com coleta de resultados; executores para o Chrome de desktop (perfil próprio, protocolo de depuração) e para o Chrome do emulador | [`models.json`](../../bench/spike-mobile/models.json), [`fetch-models.py`](../../bench/spike-mobile/fetch-models.py), [`serve.mjs`](../../bench/spike-mobile/serve.mjs), [`run-desktop.mjs`](../../bench/spike-mobile/run-desktop.mjs), [`run-android.mjs`](../../bench/spike-mobile/run-android.mjs) | o pacote `onnx` 1.23.2 foi instalado no `.venv` para inspecionar os grafos | — |
| 2026-11-21 | `T-05` | Superfície da Decisions API fixada a partir do WebIDL e do código do Chrome 157 e 160 (tags da fonte do Chromium), de uma captura em execução nos dois navegadores e do explainer no commit `5ce6e10` | [especificação](../spec/decisions-api-surface.md), [`decision-model.d.ts`](../../bench/spike-mobile/decision-model.d.ts) (o exemplo do roadmap e os quatro casos de uso do explainer compilam), capturas `bench/results/2026-11-21-surface-chrome-*.json` | Onde explainer e implementação divergem, vale a implementação: `confidence` = maior probabilidade; campos do resultado em ordem lexicográfica; `context` (157) e `devTrialBackend` (160) ficam fora das declarações | — |
| 2026-11-21 | `T-07` | Imagem do Android 36 reinstalada pelo `sdkmanager` (tinha sido removida); página servida ao Chrome do emulador por `adb reverse`; resultado recolhido; WebGPU testada com GPU por software e com `-gpu host`, com e sem flags; segunda execução idêntica | [`EMULADOR.md`](../../bench/spike-mobile/EMULADOR.md), `bench/results/2026-11-21-emulador-probe-*.json` | Medições do marco T no Chrome 133 da imagem, GPU por software (padrão da skill) | **Pendência externa:** atualizar o Chrome do emulador pela Play Store exige uma conta Google, que o emulador não tem |
| 2026-11-21 | `T-06` | Oito candidatos levantados, com tamanhos medidos nos arquivos publicados e no jsDelivr | [`motores-existentes.md`](motores-existentes.md) | Candidatos: ONNX Runtime Web 1.31.1 com Tokenizers.js 0.2.0, e o motor `@johnhenry` (CPU e WebGPU) | — |

## Achados que mudam o plano

- **O Chrome não oferece a Decisions API no Android**: no código do 157 e do 160, `AIManager::CanCreateDecisionModel` responde sempre “indisponível” no Android. Reforça a premissa do celular em primeiro lugar.
- **O modelo nativo fica disponível sem uma pessoa**: no Canary 160, com o interruptor “On-device AI” ligado no perfil de teste e a ativação de usuário dada pelo protocolo de depuração, o `create()` baixou o modelo do backend padrão (`embedding-gemma-v1`) e o `decide()` respondeu. Só aceita inglês.
- **O repositório-fonte do ONNX Runtime devolve 404** no GitHub (2026-11-21); os pacotes npm e PyPI continuam publicados. Pesa contra um fork desse motor.
- **Não há WebGPU no Chrome do emulador** em nenhuma configuração: o caminho WebGPU só pode ser medido em aparelho real.

## Estado e próximo passo

Onda 1 do marco T concluída (`T-05`, `T-06`, `T-07`). Próximo: `T-01` (página de teste), depois `T-08`, `T-09` e `T-03`.
