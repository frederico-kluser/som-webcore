# ADR 0003 — Portão GT: motor nosso em WebGPU

- **Data:** 2026-11-22
- **Estado:** aceita
- **Portão:** `GT` do [roadmap](../../ROADMAP.md#gt) — “o motor existente serve, ou há uma janela para um motor nosso?”
- **Decidido por delegação do dono.**

## Contexto

O marco T mediu o motor existente — o ONNX Runtime Web 1.31.1, com o Tokenizers.js — e o motor leve `@johnhenry`, no Chrome do emulador Android (arm64, no Mac mini), no Safari do simulador de iOS e no Chrome de desktop do macOS, sempre pela Decisions API idêntica à do Chrome. A evidência está no [relatório do marco T](../reports/teste-mobile.md): o veredito da `T-04` (seção 8) e a análise da janela da `T-10` (seção 7), com os dados brutos em `bench/results/`.

## Evidência

Tudo **[MEDIDO]**, modelo TS-Ettin-17M:

- **Veredito da `T-04`: o motor existente não é satisfatório.** No Chrome do Android ele acerta com o artefato certo (`q8emb32-f16`: máx. |Δp| 8,9e-3 e vencedora igual em 155/156; `fp32`: 1,6e-6) e aguenta 200 decisões seguidas sem falha, mas a configuração que acerta pesa 26,34 MB na primeira visita, acima dos 25 MB do portão, e as que cabem não acertam. A latência em celular não foi medida (`T-02` descartada, [ADR 0002](0002-dt-01-seguir-com-o-emulador.md)).
- **Conclusão da `T-10`: há janela.** Duas limitações medidas do motor existente são resolvidas por um motor próprio:
  1. o runtime do ONNX Runtime Web (2.483.259 B em brotli) é o que tira a `q8emb32-f16` do limite: sem ele, a primeira visita seria 23,86 MB; o runtime do motor leve `@johnhenry` tem 86.798 B;
  2. no WebGPU (desktop, Metal), o provedor do ONNX Runtime erra mesmo com os pesos FP32 (máx. |Δp| 4,8e-2 contra o nativo com o mesmo arquivo) e trava com os quantizados publicados; o `@johnhenry` em WebGPU acerta com FP32 (1,9e-6).
- **O que a janela não cobre:** nos ambientes móveis medidos não há WebGPU utilizável (emulador e simulador); ali, o ONNX Runtime em Wasm é o caminho que funciona.

## Ramos

| Ramo | O que será feito | Esforço **[ALVO, tamanhos do roadmap]** | Risco | O que se perde |
|---|---|---|---|---|
| (a) motor existente, biblioteca fina | `L-01` e `L-02`: o `DecisionModel` sobre o ONNX Runtime Web, com Worker e cache | M + M | a configuração que acerta continua acima de 25 MB; o caminho WebGPU do ONNX Runtime erra e trava | o critério de 25 MB com paridade; WebGPU correto |
| (b) motor nosso em WebGPU | bifurcação `DP-01`: fork do motor leve existente (`K-01`, `K-02`) ou motor do zero (`P-05` a `P-10`) | S + L (fork) ou a sequência `P-05`–`P-10` | manter um motor; sem WebGPU nos ambientes móveis medidos, o motor só WebGPU não roda neles | o atalho de usar um motor pronto |
| (c) só evidência e contribuições | a trilha S; os marcos de produto passam a `descartada` | só a trilha S | — | o produto |

**Recomendação:** (b). É o único ramo em que a limitação medida — runtime pesado e WebGPU incorreto — tem conserto, e a regra do dono o escolhe (abaixo). O ONNX Runtime em Wasm continua útil como referência de comparação na PoC e como caminho para aparelhos sem WebGPU.

## Critério aplicado

A regra do dono para o `GT`: “escolha o motor nosso só se a `T-10` apontar uma limitação MEDIDA que um motor nosso resolve. Sem isso, o ramo é o motor existente. Se nada funcionar no Android, o ramo é ‘só evidência’.” Alguma coisa funciona no Android (o ONNX Runtime em Wasm), então não é (c); a `T-10` aponta duas limitações medidas que um motor nosso resolve, então é (b). Os critérios escritos do `GT` dizem o mesmo: o ramo “motor existente” exige que o motor cumpra os critérios **e** que a análise não encontre janela — nenhuma das duas coisas aconteceu.

## Decisão

Ramo **(b), motor nosso em WebGPU**. O `GT` passa a `feito`; `L-01` e `L-02` (ramo do motor existente) passam a `descartada`; a próxima decisão é a bifurcação `DP-01` (fork ou do zero).

## Consequências

- A PoC (`M1`) mede o motor nosso contra o ONNX Runtime Web rodando o mesmo modelo, como o roadmap já prevê.
- **O que fica sem cobertura:** aparelhos sem WebGPU. O motor nosso é WebGPU; o fallback para CPU está fora do escopo da PoC no roadmap. Em celular, o caminho comprovado hoje é o ONNX Runtime em Wasm — e ele não cumpre os 25 MB com paridade. O relatório da PoC deve dizer o que fazer com esses aparelhos.
- O critério de latência continua **não medido**: só um aparelho real responde.

## Como reverter

Se a PoC (`P-14`, portão `G1`) mostrar que o motor nosso não supera o ONNX Runtime Web, o próprio roadmap já prevê o pivô para um motor de terceiros (risco 1 da seção de riscos). Uma nova ADR substitui esta se dados de aparelho real (uma `T-02` reaberta) mudarem o veredito.
