# ADR 0005 — Replanejamento: modelos mais fortes sem travas de memória, e a Decisions API na prática

- **Data:** 2026-11-23
- **Estado:** aceita — 2026-11-23, no PR do replanejamento, por decisão do dono
- **Gatilho:** pedido do dono (2026-11-23) — rodar modelos de decisão mais potentes no navegador, sem travas de memória, mesmo que seja preciso portá-los para a GPU ou manter um fork do motor; aplicar na prática o padrão da Decisions API do Google; e refazer o roadmap se ele não estiver na direção certa. É um gatilho de replanejamento da [seção 13 do roadmap](../../ROADMAP.md#riscos-do-plano): o dono mudou o objetivo, e premissas do plano caíram com dados novos.
- **Substitui:** nenhuma ADR. Complementa a [0003](0003-gt-motor-nosso-em-webgpu.md) e a [0004](0004-dp-01-fork-do-motor-leve.md), que continuam valendo.

## Contexto

**O que os nossos logs mostram** **[MEDIDO]** ([relatório do marco T](../reports/teste-mobile.md), seção 9; `bench/results/2026-11-22-iphone-*`):

- No iPhone (Safari 26.6.3), a única configuração que acerta e cumpre o p95 de 150 ms é o motor `@johnhenry` em WebGPU, com pesos `f32`: p95 de 70 ms, máx. |Δp| de 1,3e-6. Em CPU, o mesmo motor tem p95 de 1,5 s.
- A memória do Wasm do ONNX Runtime fica presa no processo do Safari: depois de 2 ou 3 sessões, `RangeError: Out of memory` até o Safari ser fechado (corrigido em 2026-11-23: as 3 primeiras inicializações por processo passam e a 4ª falha — [análise forense](../reports/forense-iphone-2026-11-22.md)); iframes, uma página por etapa e `window.open` não resolvem. O motor em JS + WebGPU seguiu rodando no mesmo processo. O ONNX Runtime em WebGPU derrubou o processo duas vezes seguidas.
- O adaptador do iPhone aceita buffers e bindings de 1 GiB; a origem tem 41,2 GB de quota.
- O `@johnhenry` baixa só pesos `f32` (67,48 MB), o caminho `f16` calcula em f16 e erra 1,5e-3 a 1,7e-3, e o heap cresce 50,09 MiB em 200 decisões na WebGPU do desktop.

**O que o código do motor mostra** (lido em `bench/spike-mobile/node_modules/@johnhenry/*`, versões de 2026-11-21, e em `bench/spike-mobile/engines/johnhenry.js`): o adaptador baixa o `model.safetensors` inteiro para a memória do JS e o sobe com `queue.writeBuffer`; o `backend-webgpu` guarda até 1 GiB de buffers ociosos (`maxPooledBytes = 2 ** 30`); cada decisão lê de volta os estados ocultos inteiros, `[B, L, H]`.

**O que a pesquisa de 2026-11-23 reporta** **[REPORTADO]**, com as fontes primárias em [research/03-modelos-maiores-sem-travas-de-memoria.md](../../research/03-modelos-maiores-sem-travas-de-memoria.md):

- No iPhone, o teto é a memória do processo da aba — entre ~1,5 GB e 2.048 MB, contando a WebGPU, sem erro nem `device.lost`; um artigo de 2026 fala em menos de 500 MB. O código do WebKit limita o iOS a 3 memórias Wasm “rápidas” por processo, a explicação mais provável para a trava medida **[HIPÓTESE]**; não há Memory64 em Safari estável.
- O `writeBuffer` grande é copiado de novo pelo navegador: com o arquivo inteiro no JS, o pico de carga fica em ~3 a 4× os pesos. No Android, 26% dos aparelhos (94% das Adreno 7xx) expõem binding de só 128 MiB.
- O Chrome roda a Decisions API só no desktop, todos os backends em CPU; um modelo atende às sessões de todas as origens e é descarregado depois de 60 s ociosos; `preference` chega ao navegador, mas nenhum backend o lê. O polyfill do GoogleChromeLabs carrega uma cópia de 842,6 MB do modelo a cada `create()`.
- O upstream do fork tem um mantenedor e nunca rodou num navegador real na sua CI; o ONNX Runtime saiu do GitHub e não publicou a 1.32 no npm; a WebNN não saiu em nenhum navegador.
- Os modelos de decisão com licença permissiva mais fortes que o TS-Ettin vão de encoders ModernBERT de 150M (Full ~18–20) a decodificadores Qwen3.5 de 0,8B (~31–33) e de 2B (~38–41), no Decision Index 0.4.1, que só mede inglês; nenhum acima de 150M tem exportação para navegador publicada.

**O que estava errado no roadmap de 2026-11-21:** M1 a M3 ainda descreviam o motor do zero em Rust (Cargo, `crates/`, `wasm32`, `som-ref`, `.sombin` em Rust, memória linear do Wasm), que a ADR 0004 descartou; a escada parava no 150M e “modelos acima de 1B” estavam fora do roadmap; a escolha de modelo passava por uma API própria (`SOM.load`, `SOM.recommend()`), contra a regra da API idêntica; nenhuma atividade do ramo do fork expunha o `DecisionModel`; o G1 media só no desktop; os prompts do M1, o marco em execução, não estavam escritos.

## Decisão

1. **A direção fica.** Missão, API idêntica à do Chrome, celular primeiro e o fork do motor leve em WebGPU (ADRs 0003 e 0004) continuam. O fork é a base certa justamente porque não usa memória do Wasm.
2. **O M1 é refeito para o fork, sem travas de memória desde o começo.** Entram `K-03` (carga em streaming, sem dupla residência), `K-04` (memória fixa por sessão, sem vazamento, `destroy()` liberando a GPU) e `K-05` (o `DecisionModel` sobre o fork, com o comportamento do Chrome). A `P-03` passa a ser o workspace JavaScript e a CI do fork; a `K-01` ganha a auditoria de memória e a cadeia de oráculos do fork.
3. **Nasce a trilha C — Capacidade** (`C-01` a `C-10`, bifurcação `DC-01`): o teto deixa de ser um número de parâmetros e passa a ser o orçamento **medido** de cada classe de aparelho; a escada ModernBERT roda nos mesmos kernels; fatias, embeddings fora da GPU e máscara no kernel; avaliação em português; portes de arquiteturas novas (Laya, EmbeddingGemma, decodificadores) só depois do `G1` e da escolha do dono na `DC-01`; a execução fora do núcleo é uma investigação de prazo fixo. `B-01` e `B-02` passam a `descartada`, substituídas pela `C-02` e pela `C-03`.
4. **A escolha do modelo vai pela API padrão.** `preference` (`"speed"`, `"capability"`, `"auto"`) e `availability()` escolhem a faixa; catálogo, orçamento de download e licenças ficam num ponto de configuração separado. `SOM.load` e `SOM.recommend()` saem dos entregáveis (`B-07`, G4).
5. **O comportamento do Chrome é contrato**, não só a forma: um modelo por página, partilhado pelas sessões; trabalho do esquema no `create()`; descarga por ociosidade; download só com gesto e `monitor`; erro de cota em vez de truncamento; um só decodificador de resultados. A referência é um build fixado do Chrome (hoje o 160). API idêntica não promete probabilidades idênticas.
6. **O caminho sem WebGPU vira a bifurcação `DA-01`**, decidida pelo dono depois do `G1`; a `A-03` executa o ramo escolhido.
7. **Critérios de portão revistos antes de qualquer medição da PoC.** Nenhum limiar foi afrouxado:
   - **G1:** saem os critérios do motor em Rust (testes nativos, build `wasm32`, memória Wasm estável) e entram os equivalentes do fork (testes do backend CPU em Node, paridade WebGPU num adaptador de software); ficam iguais as tolerâncias de paridade, as 1.000 decisões sem crescimento e os limiares contra o baseline; **entram** a forma idêntica à do Chrome, a carga sem dupla residência, `destroy()` devolvendo a GPU, as sessões seguidas sem `Out of memory` no iPhone e o p95 ≤ 150 ms no iPhone.
   - **G2:** o fallback depende do ramo da `DA-01`; “pesos nunca inteiros na memória linear do Wasm” passa a “nunca inteiros na memória do host — nem no JS, nem no Wasm”; entram as 20 sessões seguidas no iPhone.
   - **G3:** entram a capacidade por aparelho (`C-10`) e o português (`C-09`); o 150M passa a exigir binding de 128 MiB, o piso real do Android.
   - **G4:** o fluxo completo passa a ser pelo `DecisionModel` com `preference`; entra 1 h abrindo e fechando sessões no iPhone sem `Out of memory`.
8. **Fora do roadmap:** sai “modelos acima de 1B”; entra “um teto fixo de parâmetros” — o que não cabe no orçamento medido, nem por streaming, responde `"unavailable"`. Decodificadores entram só como modelos de decisão de passada única, sem gerar token.
9. **Processo:** a `S-04` e a `S-06` deixam as contribuições prontas, e o dono as envia (regra do dono); o `scripts/roadmap.py` ganha o grupo `C` e os prefixos `DC` e `DA`, exige o prompt de toda atividade desbloqueada e deixa as atividades descartadas fora do caminho crítico.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Só ajustar estados e textos, mantendo M1 a M3 como estavam | o plano pediria artefatos que o fork não produz (crates, `wasm32`, `som-ref`) e não atenderia ao novo objetivo do dono |
| Trocar o fork por um motor que já roda modelos grandes (wllama 4, LiteRT-LM, Transformers.js) | megabytes de runtime e o heap do Wasm — justamente o que travou no iPhone do laboratório —, além do risco de fornecimento do ONNX Runtime |
| Memory64 para passar dos 4 GiB | não existe em Safari estável e custa de 10% a mais de 100% de velocidade **[REPORTADO]** |
| Esperar a WebNN ou o `DecisionModel` nativo no celular | a WebNN não saiu em nenhum navegador e não tem plano para iOS; o Chrome não compila a Decisions API para Android **[REPORTADO]** |
| Pôr os modelos maiores no M3, sem trilha própria | a medição de orçamento e a escada podem começar já, em paralelo; esperar o G2 adiaria o objetivo do dono sem ganho de risco |

## Consequências

- Mais trabalho antes da `v0.1.0`: `K-03` (M), `K-04` (L) e `K-05` (M). Em troca, a PoC já prova o que o celular exige.
- A trilha C pode começar agora, pela `C-01` (orçamento medido no laboratório) e pela `C-09` (avaliação em português).
- Três bifurcações novas ou reabertas exigem o dono: `DC-01`, `DA-01` e, no fim do M1, o próprio `G1`.
- A `P-03` revisa o `docs/STRUCTURE.md` e a `K-01` revisa a cadeia de oráculos do `docs/METHODOLOGY.md`, ambos ainda do ramo do motor do zero; as seções 4.5 e 6.7 do README, que mostram `SOM.load`, são corrigidas na `B-10`.
- Os achados da pesquisa sobre o README (o piso de 128 MiB de binding é da Adreno 7xx, não da Mali; os “16% com binding ≥ 2 GiB” são artefato de faixa; a edição do Decision Index é a 0.4.1; o contexto do d1-omni) vão para a errata depois de conferidos (`C-01`, `B-06`).
- O relatório de pesquisa entra no repositório como `research/03-*.md`, fonte não confiável até verificação, como os relatórios 1 e 2.

## Como reverter

- Se o dono recusar a trilha C, as atividades `C-*` e a `DC-01` passam a `descartada`, e a `B-01` e a `B-02` voltam a `a fazer` numa nova ADR.
- Se o `G1` mandar pivotar para um motor de terceiros, a trilha C continua sobre ele: o orçamento medido (`C-01`), a avaliação em português (`C-09`) e a escolha por `preference` (`C-08`) valem para qualquer motor; os portes (`C-04` a `C-06`) são reavaliados.
- Se o Chrome remover `preference`, a escolha de faixa fica só no ponto de configuração; o código da aplicação não muda.
