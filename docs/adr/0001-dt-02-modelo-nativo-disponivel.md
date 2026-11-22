# ADR 0001 — DT-02: o modelo nativo ficou disponível; a bifurcação não se aplica

- **Data:** 2026-11-21
- **Estado:** aceita — 2026-11-21, no PR que concluiu a `T-03`
- **Bifurcação:** `DT-02` do [roadmap](../../ROADMAP.md#bifurcacoes) — “o modelo embutido do Chrome não fica disponível nesta máquina: como comparar com o nativo?”
- **Decidido por delegação do dono.**

## Contexto

Na verificação do ambiente, `DecisionModel.availability()` devolveu `"unavailable"` num perfil novo do Chrome em modo headless. Se continuasse assim num perfil real, a comparação da página de teste com a implementação nativa (`T-03`) ficaria sem respostas nativas, e a `DT-02` escolheria entre três ramos: (a) comparar só a forma da API; (b) instalar o Edge Canary e usar o modelo embutido dele; (c) deixar a comparação de respostas para outra máquina.

## Evidência

Tudo **[MEDIDO]** em 2026-11-21, com um `--user-data-dir` próprio (nunca o perfil do dia a dia), em janela real:

1. Chrome Canary 160.0.8174.2 com `--enable-features=AIDecisionModelAPI`, perfil novo: tudo `"unavailable"`; o console diz que o interruptor “On-device AI” de `chrome://settings/ai` está desligado. Captura: [`2026-11-21-surface-chrome-canary-160.json`](../../bench/results/2026-11-21-surface-chrome-canary-160.json) (a última execução, já com o interruptor ligado, guarda também o console).
2. Com a pref desse interruptor (`optimization_guide.on_device_foundational_model_user_settings`) ligada no perfil de teste: `availability()` → `"downloadable"` para inglês ou sem idioma; `create()` sem gesto → `NotAllowedError`; com a ativação de usuário dada pelo protocolo de depuração (`Runtime.evaluate` com `userGesture`), o `create()` baixou o modelo do backend padrão (`embedding-gemma-v1`) e o `decide()` respondeu. Mesma captura, chave `createWithActivation`.
3. Depois do download: `availability()` → `"available"`, e `create()` funciona sem gesto: [`2026-11-21-surface-chrome-canary-160-apos-download.json`](../../bench/results/2026-11-21-surface-chrome-canary-160-apos-download.json).
4. A página de teste roda inteira sobre o `DecisionModel` nativo — 66 entradas, sem falhas, forma conferida: [`2026-11-21-desktop-macmini-chrome160-native.json`](../../bench/results/2026-11-21-desktop-macmini-chrome160-native.json) ([relatório do marco T, seção 6](../reports/teste-mobile.md#6-api-nativa-t-03)).
5. Os passos 1 a 3 repetidos no macOS (Mac mini), com o Canary 160.0.8176.2: os mesmos valores, a mesma superfície (0 diferenças em 72 resultados de validação contra o Windows) e o modelo baixado sem uma pessoa — `2026-11-21-surface-macmini-chrome-canary-160*.json`.

O Chrome estável 157 continua `"unavailable"`: o único backend dele (`language_model`) exige mais duas features e o modelo da Prompt API, de vários GB ([especificação](../spec/decisions-api-surface.md#5-availability)).

## Critério aplicado

O prompt da `DT-02` no roadmap: “se `availability()` chegou a `"available"`, registre isso, feche a bifurcação como ‘não se aplica’ e siga”. E a regra do dono para esta bifurcação: tentar num perfil real, não headless, e usar as respostas nativas se for possível obtê-las sem uma pessoa.

## Decisão

A `DT-02` fecha como **não se aplica**. A `T-03` usa as respostas nativas do Chrome Canary 160 (160.0.8176.2 no macOS, onde a página rodou), backend padrão `embedding-gemma-v1`. O Edge Canary não foi instalado: deixou de ser necessário.

## Consequências

- A comparação com o nativo vale para um backend: o `embedding-gemma-v1` do Canary 160, que só aceita inglês. As respostas vêm de **outro modelo** (EmbeddingGemma, não TS-Ettin): compara-se forma e concordância, não paridade.
- O resultado depende de dois passos que uma pessoa faria e o agente fez no perfil de teste: ligar “On-device AI” e dar um gesto no primeiro `create()`.
- Os ramos (a), (b) e (c) não foram necessários.

## Como reverter

Se o modelo deixar de estar disponível (outra versão do Chrome, pref apagada, API mudada), repetir a captura com `bench/spike-mobile/surface.html`; se der `"unavailable"`, reabrir a `DT-02` com os três ramos e registrar a nova decisão numa ADR que substitua esta.
