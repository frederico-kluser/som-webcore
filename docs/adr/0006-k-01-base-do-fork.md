# ADR 0006 — K-01: a base do fork do motor leve

- **Data:** 2026-11-23
- **Estado:** aceita
- **Atividade:** `K-01` do [roadmap](../../ROADMAP.md#m1) — base do fork: licença, o que sai, o que muda, auditoria de memória e plano para acompanhar o upstream.
- **Evidência:** [docs/reports/base-do-fork.md](../reports/base-do-fork.md).
- **Complementa:** [ADR 0004](0004-dp-01-fork-do-motor-leve.md) (fork do motor leve) e [ADR 0005](0005-replanejamento-capacidade-e-memoria.md) (sem travas de memória).

## Contexto

A [ADR 0004](0004-dp-01-fork-do-motor-leve.md) escolheu o fork do `@johnhenry` (repositório `johnhenry/laya-js`) e deixou para a `K-01` o que estava “a confirmar”: o que sai, o que muda e como acompanhar o original. A [ADR 0005](0005-replanejamento-capacidade-e-memoria.md) acrescentou a auditoria de memória e a cadeia de oráculos do fork.

## Decisão

1. **Licença.** O fork é permitido: MIT nos backends e no `tensor-backend`, Apache-2.0 com `NOTICE` no `modernbert`, MIT nas dependências `math-plus-*` — lidos na fonte em 2026-11-23 **[MEDIDO]**. O fork cumpre as obrigações da [seção 1 do relatório](../reports/base-do-fork.md#1-licença-lida-na-fonte): `LICENSE` por pacote, `NOTICE` do upstream preservado no `NOTICE` do projeto, cada arquivo do `modernbert` modificado com aviso visível, origem registrada e nenhum uso do nome do upstream além de descrever a origem.
2. **O que fica:** `tensor-backend`, `backend-webgpu` e `modernbert` no pacote do navegador; `backend-cpu` e as suas dependências `math-plus-tensor-cpu`, `math-plus-tensor-core` e `math-plus-special` só como referência nos testes; `webgpu` (Dawn) só como dependência de desenvolvimento.
3. **O que sai:** `backend-mlx`, `backend-mlx-darwin-arm64`, `laya-cli`, `laya-router`, `laya-presets`, `langdetect-lite`, `hf-cache`, `pyjson`, `laya-core`, `laya` e `laya-fixtures`; e o `math-plus-safetensors` sai do caminho de carga.
4. **Travas de memória e quem as resolve** ([seção 3 do relatório](../reports/base-do-fork.md#3-auditoria-de-memória)): arquivo inteiro no JS e cópias do `writeBuffer` → `K-03`; pool de até 1 GiB, readback de `[B, L, H]`, heap +50 MiB em 200 decisões, liberação só por chamada explícita, limites máximos do adaptador e 128 *dispatches* por submit → `K-04`; cálculo com ativações em f16 → `K-02`.
5. **Acompanhar o upstream** ([seção 5 do relatório](../reports/base-do-fork.md#5-plano-para-acompanhar-o-upstream)): a interface do `tensor-backend`, os geradores de WGSL e o grafo do `modernbert` ficam iguais; as mudanças vão para módulos novos, com remendos mínimos e marcados; cada nova tag do upstream nos pacotes que ficam é comparada e só entra com a paridade verde; patches que sirvam ao upstream ficam prontos e o dono os envia.
6. **Cadeia de oráculos do fork**, agora na [metodologia](../METHODOLOGY.md#6-paridade-numérica): PyTorch FP32 → backend CPU do fork (f32) → kernels WGSL (Dawn e adaptador de software) → navegador. As tolerâncias não mudam; o backend CPU ocupa o lugar do `som-ref`, nos mesmos limiares.
7. **Nenhum fork público.** O código entra neste repositório na `K-02`; nada é publicado em nome do dono.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Depender dos pacotes do npm e remendar por cima (`patch-package`) | as travas 1 a 4 estão no `Runtime` e no carregador, que precisam mudar por dentro; e a interface 0.x muda entre versões menores |
| Trazer o monorepo inteiro | 11 dos 15 pacotes não servem a um modelo de decisão no navegador e trariam a API do produto Laya, contra a regra da API idêntica à do Chrome |
| Reescrever os kernels já na `K-02` | perde as correções de kernels do upstream; o caminho WebGPU `f32` já acerta (1,9e-6 **[MEDIDO]**) |

## Consequências

- A `K-02` tem a lista exata do que trazer e das obrigações a cumprir; a `K-03` e a `K-04` têm cada trava com evidência e critério.
- A seção 8 da metodologia (testes) ainda cita o motor do zero em alguns pontos; a `P-03` a revisa junto com o `docs/STRUCTURE.md`.

## Como reverter

Se a `K-02` mostrar que o formato de pesos ou a memória não cabem no fork, vale a reversão da [ADR 0004](0004-dp-01-fork-do-motor-leve.md): reabrir a `DP-01` numa nova ADR.
