# ADR 0004 — DP-01: o motor nosso nasce de um fork do motor leve existente

- **Data:** 2026-11-22
- **Estado:** aceita
- **Bifurcação:** `DP-01` do [roadmap](../../ROADMAP.md#bifurcacoes) — “o motor nosso nasce de um fork do motor leve existente ou do zero?”
- **Decidido por delegação do dono.**

## Contexto

O portão `GT` escolheu o motor nosso em WebGPU ([ADR 0003](0003-gt-motor-nosso-em-webgpu.md)). O motor leve escolhido na `T-06` é o `@johnhenry` (repositório `johnhenry/laya-js`): ModernBERT em JavaScript e WGSL, com backends de CPU e de WebGPU ([motores-existentes.md](../reports/motores-existentes.md)). A janela da `T-10` ([relatório, seção 7](../reports/teste-mobile.md#7-análise-da-janela-t-10)) tem duas partes: o peso do runtime do ONNX Runtime Web e o caminho WebGPU dele.

## Evidência

**Licenças, lidas na fonte em 2026-11-22** **[MEDIDO]**: o repositório `johnhenry/laya-js` (público, não arquivado, último push em 2026-11-07, pela API do GitHub) tem `LICENSE` (MIT, “Copyright (c) 2026 John Henry”), `LICENSE-APACHE-2.0` e `NOTICE`. Nos `package.json` publicados: `@johnhenry/tensor-backend` 0.4.0, `backend-cpu` 0.3.4 e `backend-webgpu` 0.6.0 são **MIT**; `@johnhenry/modernbert` 0.3.1 é **Apache-2.0** — o `NOTICE` diz que ele porta lógica de obras Apache-2.0 (laya-mlx, Laya da Convai Innovations e a arquitetura ModernBERT do Hugging Face Transformers); `@johnhenry/math-plus-safetensors` 0.1.3 (repositório `johnhenry/math-plus`) é **MIT**. As duas licenças permitem o fork e a redistribuição, com os avisos de copyright e, no Apache-2.0, o `NOTICE` e a marcação das mudanças.

**O que o motor leve já resolve** **[MEDIDO]**: runtime de 86.798 B em brotli (limitação 1 da `T-10`); no WebGPU, paridade de FP32 com os pesos publicados — máx. |Δp| 1,9e-6, vencedora igual em 156/156 (limitação 2); as 66 entradas com a forma conferida, no desktop, no emulador e no simulador.

**O que precisaria ser reescrito para fechar a janela** (escopo da `K-02`, a confirmar na `K-01`):

1. **Pesos menores**: hoje ele baixa o `model.safetensors` em FP32 (68,06 MB na primeira visita; limitação 6). O fork precisa de um formato com embeddings de 8 bits e o resto em FP16, como a `q8emb32-f16` (23.368.916 B, que cumpre a tolerância de 8 bits), com aritmética em f32 — o caminho `f16` atual calcula em f16 e fica em 1,7e-3, acima da tolerância de FP16.
2. **Memória**: o heap cresce nas 200 decisões (+7,88 MiB em CPU, +50,09 MiB em WebGPU; limitação 7).

**O que sai**: o monorepo tem 15 pacotes; um modelo de decisão de passada única no navegador usa o `tensor-backend`, o `backend-webgpu` e o `modernbert` (e o `backend-cpu` como referência). Ficariam de fora, a confirmar na `K-01`: `backend-mlx`, `backend-mlx-darwin-arm64`, `laya-cli`, `laya-router`, `laya-presets`, `langdetect-lite`, `hf-cache`, `pyjson`, `laya-core`, `laya` e `laya-fixtures`.

**Custo de acompanhar o original**: um projeto novo (versões 0.x), de um autor só; manter iguais as interfaces do `tensor-backend` e do `backend-webgpu` deixa receber correções de kernels. O plano é entregável da `K-01`.

**O motor do zero** (`P-05` a `P-10`, seções 6.1 e 6.2 do roadmap): tokenizador, contêiner de pesos, referência em Rust, kernels WGSL, motor nativo e alvo web — tamanhos M, M, L, L, M e M **[ALVO]** —, sem nenhum motor WebGPU que já funcione como ponto de partida.

## Ramos

| Ramo | O que será feito | Esforço **[ALVO]** | Risco | O que se perde |
|---|---|---|---|---|
| (a) fork do motor leve existente | `K-01` (base do fork) e `K-02` (fork enxuto, pesos de 8 bits/FP16, memória) | S + L | dependência de um projeto de um autor só; obrigações do Apache-2.0 | a pilha em Rust do plano original |
| (b) do zero | `P-05` a `P-10` | M + M + L + L + M + M | refazer o que o motor leve já mostrou funcionar | tempo |

**Recomendação:** (a).

## Critério aplicado

A regra do dono para a `DP-01`: “fork, se a licença permitir e a limitação puder ser corrigida dentro dele. Senão, do zero.” A licença permite (lida na fonte, acima). As limitações da janela cabem dentro do fork: o peso do runtime e a precisão no WebGPU ele já resolve, medidos; o formato de pesos e a memória são mudanças no próprio motor, sem nada medido que as impeça. Pela ordem de desempate do dono, o fork também é o caminho de menor esforço que cumpre os critérios.

## Decisão

Ramo **(a), fork do motor leve existente**. A `DP-01` passa a `feito`; `P-05` a `P-10` (motor do zero) passam a `descartada`; seguem `K-01` e `K-02`.

## Consequências

- A `K-01` confere tudo o que está marcado “a confirmar” acima antes de qualquer fork: o que sai, o que muda e o plano para acompanhar o original.
- As seções 6.1 e 6.2 do roadmap descrevem o ramo do motor do zero; no ramo do fork valem como referência de arquitetura (pesos em FP16 com aritmética em f32, cabeça e calibração no host, embeddings no host).
- A PoC continua medindo o motor contra o ONNX Runtime Web com o mesmo modelo.

## Como reverter

Se a `K-01` ou a `K-02` mostrarem que o formato de pesos ou a memória não podem ser corrigidos dentro do fork, reabrir a `DP-01` numa nova ADR, com `P-05` a `P-10` de volta a `a fazer`.
