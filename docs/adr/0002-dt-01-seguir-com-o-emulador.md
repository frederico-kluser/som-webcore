# ADR 0002 — DT-01: seguir só com o emulador; a medição em celulares reais fica descartada

- **Data:** 2026-11-21
- **Estado:** aceita — 2026-11-21, depois de concluídas a `T-08` e a `T-09`
- **Bifurcação:** `DT-01` do [roadmap](../../ROADMAP.md#bifurcacoes) — “os resultados do emulador bastam para decidir?”
- **Decidido por delegação do dono.**

## Contexto

A `DT-01` decide se o portão `GT` pode ser fechado só com o emulador Android (`T-08`, `T-09`) ou se antes é preciso medir em aparelhos reais (`T-02`: pelo menos um Android intermediário, um Android de entrada e um iPhone).

## Evidência

Resumo da `T-08` e da `T-09` no [relatório do marco T](../reports/teste-mobile.md) (seções 3 e 4), com os dados brutos em `bench/results/2026-11-21-emulador-macmini-*.json`: a medição foi feita no emulador Android **arm64 do Mac mini**, com o mesmo Chrome 133 do emulador do Acer, e complementada pelo Safari do simulador de iOS (seção 5). O que o emulador e o simulador **não** permitem concluir:

- **Latência de celular.** O emulador e o simulador rodam no processador de um computador (o Apple M1 do Mac mini) e a GPU é emulada; toda latência medida neles é indicativa.
- **WebGPU no celular.** O Chrome do emulador não oferece WebGPU utilizável em nenhuma configuração — sem flags não há adaptador; com as flags inseguras há adaptador, mas nenhum dispositivo ([MACMINI.md, seção 7](../../bench/spike-mobile/MACMINI.md#7-emulador-android-no-mac-t-08)) — e o Safari do simulador também não entrega adaptador. O caminho WebGPU dos motores só foi medido no desktop.
- **Chrome atual.** O Chrome do emulador é o 133 da imagem: atualizá-lo pela Play Store exige uma conta Google.

Recursos disponíveis nesta execução: nenhum celular ligado ao computador nem ao Mac mini (`adb devices` só lista os emuladores) e nenhum iPhone; no Mac, só o simulador de iOS.

## Ramos

| Ramo | O que seria feito | Esforço | O que se perde |
|---|---|---|---|
| (a) seguir só com o emulador | fechar `T-10`, `T-04` e `GT` com os dados do emulador e do desktop | nenhum adicional | o critério de latência de GT fica “não medido”; WebGPU no Android fica sem dado |
| (b) medir também em aparelhos reais (`T-02`) | rodar a mesma página em três aparelhos, duas vezes por configuração | `S`, mas exige os aparelhos e uma pessoa para o iPhone | — |

## Critério aplicado

A regra do dono para esta bifurcação: sem aparelho real, seguir só com o emulador, marcar a `T-02` como “descartada” e tratar toda latência como indicativa.

## Decisão

Ramo **(a)**. A `DT-01` passa a feito e a `T-02` a **descartada**. A latência do emulador entra em `T-04` como indicativa, e o critério “a decisão é rápida?” do portão `GT` fica como **não medido**.

## Consequências

- O portão `GT` é decidido sem o critério de latência e sem dado de WebGPU no Android; o relatório lista essas lacunas.
- A recomendação ao dono é medir em aparelho real assim que houver um (a página e os executores já servem: `bench/spike-mobile/run-android.mjs` funciona com qualquer aparelho Android ligado por `adb`).

## Como reverter

Com aparelhos disponíveis, reabrir a `T-02` (estado `a fazer`), medir, e registrar numa nova ADR que substitua esta se os dados mudarem o veredito de `GT`.
