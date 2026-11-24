# Base do fork do motor leve (`K-01`)

Atividade `K-01` do [roadmap](../../ROADMAP.md#m1): licença, o que fica e o que sai, a auditoria de memória do motor e o plano para acompanhar o upstream. Decisão registrada na [ADR 0006](../adr/0006-k-01-base-do-fork.md). **Nenhum fork foi feito**: a `K-02` traz o código para `packages/engine`.

**Fontes e convenções.** Lido em 2026-11-23.

- `UP` = repositório `johnhenry/laya-js` no GitHub, lido pela API (`gh api repos/johnhenry/laya-js/...`).
- `JH/` = `bench/spike-mobile/node_modules/@johnhenry/` no clone do Mac mini, instalado pelo `bench/spike-mobile/package-lock.json` (as versões abaixo); `arquivo:linha` aponta para o `dist/` publicado no npm.
- `SM/` = `bench/spike-mobile/`; `R/` = `bench/results/`.
- Rótulos como na [metodologia](../METHODOLOGY.md#rotulos): **[MEDIDO]** por este projeto (com arquivo), **[REPORTADO]** por terceiros (com fonte e data), **[HIPÓTESE]** sem dados.

## 1. Licença, lida na fonte

| Fonte | O que diz | Rótulo |
|---|---|---|
| `UP/LICENSE` (raiz) | MIT, “Copyright (c) 2026 John Henry” | [MEDIDO, API do GitHub, 2026-11-23] |
| `UP/LICENSE-APACHE-2.0` (raiz) | texto integral da Apache License 2.0 (10.173 B) | [MEDIDO, idem] |
| `UP/NOTICE` e `JH/modernbert/NOTICE` (iguais) | “laya-js, Copyright 2026 John Henry”; o pacote é Apache-2.0 e porta lógica de três obras Apache-2.0: `mizorewww/laya-mlx`, `NandhaKishorM/laya` e a arquitetura ModernBERT do Hugging Face Transformers; “Those works were modified: rewritten in TypeScript”; os pesos não são distribuídos com o código | [MEDIDO] |
| `package.json` de cada pacote em `UP/packages/*` | MIT: `tensor-backend` 0.4.0, `backend-cpu` 0.3.4, `backend-webgpu` 0.6.0, `backend-mlx` 0.5.0, `backend-mlx-darwin-arm64` 0.1.1, `hf-cache` 0.1.2, `pyjson` 0.1.2. Apache-2.0: `modernbert` 0.3.1, `laya` 0.3.2, `laya-core` 0.1.1, `laya-cli` 0.3.1, `laya-router` 0.1.4, `laya-presets` 0.2.0, `langdetect-lite` 0.1.1, `laya-fixtures` 0.0.0 (privado) | [MEDIDO] |
| `JH/*/LICENSE` | `tensor-backend`, `backend-cpu`, `backend-webgpu`: MIT; `modernbert`: Apache-2.0 | [MEDIDO, clone do Mac] |
| Dependências do que fica (npm) | `@johnhenry/math-plus-tensor-cpu` 0.3.0, `math-plus-tensor-core` 0.2.1, `math-plus-special` 0.1.1, `math-plus-safetensors` 0.1.3 — MIT, repositório `johnhenry/math-plus` (MIT, não arquivado); `webgpu` 0.6.2 (Dawn para Node) — MIT | [MEDIDO, `npm view` e API do GitHub] |
| Obras portadas pelo `modernbert` | `mizorewww/laya-mlx` e `NandhaKishorM/laya`: Apache-2.0, não arquivados | [MEDIDO, API do GitHub] |

**Observação.** O `NOTICE` da raiz diz “licensed under the Apache License, Version 2.0 (see LICENSE)”, mas o `LICENSE` da raiz é o MIT; vale a licença declarada em cada pacote, e o `NOTICE` é o do `modernbert`. Não muda nada para o fork.

**Conclusão: as duas licenças permitem o fork, a modificação e a redistribuição, inclusive comercial.**

**Obrigações do fork** (cumpridas na `K-02`):

1. **MIT** (`tensor-backend`, `backend-cpu`, `backend-webgpu`, `math-plus-*`): manter o aviso de copyright e o texto da licença em todas as cópias ou partes substanciais — um `LICENSE` por pacote trazido.
2. **Apache-2.0** (`modernbert`), seção 4: (a) entregar a cópia da licença; (b) marcar com aviso visível cada arquivo modificado (“Modificado pelo SOM WebCore em AAAA-MM-DD: …”); (c) manter os avisos de copyright, patente, marca e atribuição da origem; (d) incluir o conteúdo do `NOTICE` do upstream num `NOTICE` legível da distribuição — o `NOTICE` do projeto ganha uma seção do fork, sem apagar a do upstream.
3. **Uso do nome** (Apache-2.0, seção 6; o MIT não concede marca): os nomes `laya`, `laya-js` e o escopo `@johnhenry` só aparecem para descrever a origem. Os pacotes do fork têm nomes neutros do projeto e nunca são publicados no escopo do autor.
4. **Origem registrada**: repositório, tag e commit de cada pacote trazido (seção 4) num arquivo de origem em `packages/engine`, mais a marcação das mudanças.
5. **Pesos**: o código não traz pesos; o modelo tem licença própria e entra pelo catálogo (`P-01`).

## 2. O que fica e o que sai

O monorepo tem 15 pacotes em `UP/packages/` [MEDIDO]. Um modelo de decisão de passada única no navegador precisa de um backend de tensores, de kernels WGSL e do grafo do ModernBERT; o resto é CLI, roteamento, presets, cache de disco ou backend nativo.

| Pacote | Licença | Destino | Motivo |
|---|---|---|---|
| `tensor-backend` 0.4.0 | MIT | **fica** | a interface de backend que os dois backends implementam; manter igual é o que permite receber correções de kernels (seção 5) |
| `backend-webgpu` 0.6.0 | MIT | **fica** (com mudanças: `K-03`, `K-04`) | os kernels WGSL e o runtime; o caminho que roda no iPhone |
| `modernbert` 0.3.1 | Apache-2.0 | **fica** (com mudanças: `K-02`, `K-03`) | o grafo do encoder; o carregamento de pesos é substituído pelo streaming |
| `backend-cpu` 0.3.4 | MIT | **fica como referência** | segundo elo da cadeia de oráculos (seção 6); roda nos testes em Node, não entra no pacote do navegador |
| `math-plus-tensor-cpu` 0.3.0, `math-plus-tensor-core` 0.2.1, `math-plus-special` 0.1.1 | MIT | **ficam com o `backend-cpu`** (dependências dele; `erf` vem daqui e a cabeça do TS-Ettin o usa) | só nos testes e na referência |
| `math-plus-safetensors` 0.1.3 | MIT | **sai do caminho de carga** | lê o arquivo inteiro na memória (seção 3, trava 1); o conversor da `K-02` é em Python e o leitor da `K-03` lê o cabeçalho e faz streaming |
| `webgpu` 0.6.2 (Dawn) | MIT | **só desenvolvimento** | hoje é dependência de execução do `backend-webgpu`; no fork vira `devDependency`, para a paridade WebGPU em Node na CI (`P-03`) |
| `backend-mlx`, `backend-mlx-darwin-arm64` | MIT | **sai** | backend nativo do macOS (MLX via FFI), não roda em navegador |
| `laya-cli` | Apache-2.0 | **sai** | linha de comando |
| `laya-router`, `laya-presets`, `langdetect-lite` | Apache-2.0 | **saem** | roteamento entre modelos, presets e detecção de idioma do produto Laya; a escolha de modelo do projeto é por `preference` e catálogo (`C-08`) |
| `hf-cache` | MIT | **sai** | cache em disco do Node; o cache do navegador é OPFS (`A-02`) |
| `pyjson` | MIT | **sai** | serialização compatível com Python para os prompts do Laya; o TS-Ettin monta a sequência pelo `dinah.py` |
| `laya-core`, `laya` | Apache-2.0 | **saem** | o contrato e o carregador do produto Laya (outra API, outro formato de pergunta); a superfície do projeto é a Decisions API (`P-02`, `K-05`) |
| `laya-fixtures` | Apache-2.0, privado | **sai** | fixtures do Laya; as do projeto vêm da `P-04` |

Os “a confirmar” da [ADR 0004](../adr/0004-dp-01-fork-do-motor-leve.md) ficam confirmados, com dois acréscimos: as três dependências `math-plus-*` do `backend-cpu` e a passagem do `webgpu` (Dawn) a dependência de desenvolvimento.

## 3. Auditoria de memória

Cada trava com a evidência no código, a evidência medida e a atividade que a resolve. As mudanças entram nas atividades citadas, não aqui.

| # | Trava | Evidência no código | Evidência medida ou reportada | Resolve |
|---|---|---|---|---|
| 1 | **O arquivo de pesos inteiro na memória do JS** | `SM/engines/fetch.js:18–31` junta os pedaços da resposta e depois os copia num `Uint8Array` do tamanho do arquivo (duas cópias no pico); `SM/engines/johnhenry.js:30–33` passa o arquivo inteiro a `readSafetensors`; `JH/modernbert/dist/index.js:96–105` cria uma visão por tensor sobre esse arquivo, que fica vivo enquanto as escritas estão em voo | arquivo `f32` de 67.484.624 B; no iPhone, o caminho monolítico com 1 GiB matou a aba ao montar o `Uint8Array`, e 512 MiB passaram **[MEDIDO: `R/2026-11-23-iphone-2124-opfs-monolitico.json`, [orçamento, seção 5](orcamento-memoria.md#5-a-carga-monolítica-de-hoje-derruba-a-aba-a-partir-de-1-gib)]**; o streaming em blocos carregou o mesmo 1 GiB **[MEDIDO: seção 3 do orçamento]** | `K-03` |
| 2 | **As cópias do `queue.writeBuffer`** | `JH/backend-webgpu/dist/runtime.js:176` envia cada tensor inteiro num `writeBuffer`; `JH/modernbert/dist/index.js:151–167` (`loadInBatch`) dispara todos os envios de uma vez, sem esperar a fila | no Chrome, escritas de 4 MiB ou mais passam por memória partilhada nova e por um *staging* do mesmo tamanho: de 3 a 4 cópias do modelo na carga **[REPORTADO: [research/03](../../research/03-modelos-maiores-sem-travas-de-memoria.md), 2026-11-23]**; no iPhone, 8 GiB de `writeBuffer` sem esperar a fila não derrubaram o processo de GPU, e blocos de 4 MiB com espera a cada 64 MiB são seguros **[MEDIDO: `R/2026-11-23-iphone-2124-gpu-escrita.json`]** | `K-03` |
| 3 | **O pool de até 1 GiB de buffers ociosos** | `JH/backend-webgpu/dist/backend.js:104` (`maxPooledBytes ?? 2 ** 30`); `runtime.js:127–145` guarda cada buffer liberado no pool por classe de tamanho até esse teto; `runtime.js:152` (`trim()`) nunca é chamado pelo adaptador; no caminho `f16`, cada peso sobe em `f32`, é convertido na GPU e o `f32` volta ao pool (`JH/modernbert/dist/index.js:112–128`) | no iPhone, GPU, `ArrayBuffer` e Wasm somam num teto só da aba, de ~1,7 a 2,0 GiB, sem erro antes da morte **[MEDIDO: [orçamento, seção 1](orcamento-memoria.md#1-o-teto-da-aba-no-iphone-um-orçamento-só-de-17-a-20-gib)]**: 1 GiB de pool ocioso cabe nesse teto só uma vez | `K-04` |
| 4 | **O readback de `[B, L, H]` por decisão** | `SM/engines/johnhenry.js:46–49` lê de volta todos os estados ocultos e os converte com `toF32`; `JH/backend-webgpu/dist/backend.js:314–330` (`read`) e `runtime.js:333–367` (`readBytes`, com pool de *staging* por tamanho, sem teto) | para o lote do relatório forense (`B = 3`, `L = 523`, `H = 256`), são 1.606.656 B de readback contra 8 KiB de `K × H` para 8 opções (conta a partir das formas; [forense, seção 5](forense-iphone-2026-11-22.md#5-o-que-cada-motor-aloca-por-sessão-pergunta-3)) | `K-04` |
| 5 | **O caminho `f16` que calcula em f16** | `JH/backend-webgpu/dist/kernels.js:2–17`: cada kernel carrega para o tipo de cálculo e grava de volta no tipo de armazenamento — com `preferF16`, toda ativação intermediária é gravada em f16, e o erro de arredondamento se acumula entre as operações (o cálculo dentro do kernel é f32 em `backend.js:573` e `:1216`); a dequantização com `r16` multiplica em f16 (`kernels.js:311–324`) | máx. \|Δp\| 1,7e-3 no desktop e 1,5e-3 no iPhone, acima da tolerância de FP16 (1e-3) **[MEDIDO: `R/2026-11-21-desktop-macmini-chrome157-jh-webgpu-f16-ts-ettin-17m.json`, `R/2026-11-22-iphone-0229-jh-webgpu-f16-17m.json`; [teste-mobile](teste-mobile.md)]**. Que o acúmulo venha das ativações em f16 é **[HIPÓTESE]** | `K-02` (pesos FP16 decodificados com `unpack2x16float`, ativações e aritmética em f32) |
| 6 | **O heap +50 MiB em 200 decisões** | candidatos no código: o readback da trava 4 e a cópia em `Float32Array` a cada decisão; o cache de bind groups, de até 4.096 entradas (`runtime.js:253–263`); o pool de *staging* sem teto (`runtime.js:365–367`) | heap de JS 96,04 → 146,12 MiB nas 200 decisões (+50,09 MiB), Chrome 157 no Mac mini **[MEDIDO: `R/2026-11-21-desktop-macmini-chrome157-jh-webgpu-f32-ts-ettin-17m-resistencia-200.json` → `memory[]`]**. Qual candidato responde por quanto é **[HIPÓTESE]** — a `K-04` mede com as estatísticas internas | `K-04` |

**Travas a mais achadas na leitura** (entram nas mesmas atividades):

- **A liberação depende de quem chama.** O motor só devolve a GPU em `model.dispose()` e `device.destroy()` (`SM/engines/johnhenry.js:83`; `JH/backend-webgpu/dist/backend.js:238–248`). Até a análise forense ninguém os chamava ([forense, seção 5](forense-iphone-2026-11-22.md#5-o-que-cada-motor-aloca-por-sessão-pergunta-3)); a página da bancada passou a chamá-los no fim de cada execução (`SM/app.js:271–289`, experimento X6), mas o motor não tem contagem de referências, descarga por ociosidade nem `pagehide`, e no Safari 26.6 só o `destroy()` explícito devolve a memória de GPU → `K-04` e `K-05`.
- **Dispositivo pedido com os limites máximos do adaptador** (`JH/backend-webgpu/dist/device.js:40–60`; 1 GiB de buffer no iPhone **[MEDIDO: `R/2026-11-23-iphone-2011-sonda.json`]**). Não aloca nada por si, mas esconde até a hora da morte que o modelo pede mais do que o aparelho aguenta → `K-04` pede só os limites que o modelo precisa e a `C-03` fatia o que passar.
- **Até 128 *dispatches* por submit** (`backend.js:104`, `maxBatch ?? 128`), contra a regra de uma passada por command buffer no WebKit **[REPORTADO, bug 311598 do WebKit]** → `K-04`.
- **Cópias da cabeça em `Float64Array`** (`SM/engines/johnhenry.js:34–42`): ≈ 0,5 MiB para `H = 256`, pequenas mas por carga → a cabeça no host da `K-02`, a partir de pesos já em f32.

**O que já ajuda.** O `Runtime` mantém `stats` com `liveBytes`, `pooledBytes`, `buffersCreated`, `bindGroups` e `submits` (`runtime.js:58`): é a base das estatísticas internas que a `K-04` expõe aos testes. O `backend-webgpu` já tem pesos quantizados em 8 bits por grupo, decodificados na GPU com `unpack2x16float` (`kernels.js:303–330`, desde a versão 0.4; `UP`, commit `07941a43b0d5`, 2026-09-24): a `K-02` parte daí para os embeddings em 8 bits.

## 4. O estado do upstream

| Campo | Valor | Fonte |
|---|---|---|
| Repositório | `johnhenry/laya-js`, público, não arquivado, MIT na raiz; criado em 2026-09-23 | API do GitHub, 2026-11-23 |
| Último commit | `1efbe7ee9101`, 2026-11-07 (merge do PR #26, bit de execução de exemplos); o último que toca os pacotes que ficam é `f69ba36d92db`, 2026-10-23 (`backend-cpu` 0.3.4) | idem |
| Últimas mudanças nos pacotes que ficam | `backend-webgpu` e `modernbert`: `d265c55feebb`, 2026-10-02 (versões); antes, `805676f086ba`, 2026-09-25 (cumsum em u32) e `07941a43b0d5`, 2026-09-24 (pesos quantizados no dispositivo) | idem |
| Versões no npm (= as do lockfile da bancada) | `tensor-backend` 0.4.0, `backend-webgpu` 0.6.0, `modernbert` 0.3.1 — tag `@johnhenry/<pacote>@<versão>` no commit `8c4d3bdafc30`, 2026-10-02; `backend-cpu` 0.3.4 — commit `f69ba36d92db`, 2026-10-23 | `npm view`, tags do `UP` |
| Mantenedores | `johnhenry` (93 commits) e `christopherpaulmorrison` (1); 0 estrelas, 0 forks | API do GitHub |
| Issues e PRs abertos | 1 issue (#21, 2026-10-16: entrada para navegador, progresso de download, downloads retomáveis, tipo no CPU, tabela de tamanhos no `modernbert` e no `hf-cache`); 0 PRs | idem |
| CI | `ci.yml`: Node 24 e Bun 1.2 no Linux; as suítes WebGPU rodam só se o Dawn achar adaptador no runner e, se não, são puladas (o próprio workflow avisa); jobs MLX no macOS com `continue-on-error`. `pages.yml` publica dois exemplos, sem teste. **Nenhum job roda num navegador.** Actions fixadas por versão (`@v4`), não por SHA | `UP/.github/workflows/*.yml` |

Leitura: um projeto novo, de um autor, com 0.x e mudanças de interface entre versões menores (o `tensor-backend` foi da 0.2.0, em 2026-09-24, à 0.4.0, em 2026-10-02) **[MEDIDO: tags]**. O motor nunca foi testado num navegador pela CI do upstream: essa cobertura é nossa (`P-03`, adaptador de software; laboratório no iPhone).

## 5. Plano para acompanhar o upstream

**O que se mantém igual**, para continuar recebendo correções de kernels:

1. A interface do `tensor-backend` (tipos, `dtype`, `fromHost`, `read`, `dispose`, operações) — nada de método removido ou com assinatura mudada; o que o fork precisar a mais entra como extensão num arquivo novo.
2. Os geradores de WGSL do `backend-webgpu` (`kernels.js` e o `src/` correspondente), byte a byte sempre que possível. Correção de precisão ou de desempenho num kernel do upstream deve entrar como cópia direta.
3. O grafo do encoder no `modernbert` (`forward`, máscaras, RoPE, atenção local e global).

**O que muda, isolado** em módulos novos, com o mínimo de remendos nos arquivos do upstream (cada remendo marcado, como pede o Apache-2.0):

- carga em streaming e leitor do cabeçalho (`K-03`) no lugar de `loadInBatch` e do `math-plus-safetensors`;
- arena por sessão, pool limitado, coleta dos `[OPT]` na GPU e submissão por passada (`K-04`) — no `Runtime`, é a parte que mais diverge;
- formato de pesos de 8 bits/FP16 com ativações em f32 (`K-02`), sobre o caminho quantizado que o upstream já tem.

**Como acompanhar:**

1. A `K-02` registra, num arquivo de origem em `packages/engine`, o repositório, a tag, o commit e a integridade do npm de cada pacote trazido (hoje: tags no `8c4d3bdafc30` e no `f69ba36d92db`).
2. A cada nova tag `@johnhenry/{tensor-backend,backend-webgpu,modernbert,backend-cpu}@*` — conferida a cada release do projeto e no começo de cada marco —, gerar o diff entre a tag registrada e a nova nos pacotes que ficam, aplicar o que for correção e rodar a paridade (`P-04`, CPU e WebGPU) antes de atualizar o registro.
3. As suítes de teste do upstream para os pacotes que ficam (`tensor-backend/fixtures` e os testes de conformidade dos backends) rodam na nossa CI (`P-03`).
4. Correções nossas que sirvam ao upstream (por exemplo, o teto do pool ou o readback mínimo) ficam prontas como patch; **quem as envia é o dono** (regra do dono; mesma regra da `S-04` e da `S-06`).
5. Se o upstream parar ou mudar a licença, o fork segue sozinho a partir da última versão registrada: as licenças já concedidas não se revogam.

## 6. A cadeia de oráculos do fork

Escrita na [metodologia, seção 6](../METHODOLOGY.md#6-paridade-numérica): referência PyTorch FP32 → backend CPU do fork (f32, em Node) → kernels WGSL (Dawn no Node e adaptador de software na CI) → navegador. O backend CPU já está a 1,1e-6 da referência com os pesos publicados do 17M (156/156 com a mesma vencedora) **[MEDIDO: [teste-mobile](teste-mobile.md), resumo do marco T]**, e o WebGPU em f32 a 1,9e-6 **[MEDIDO: `R/2026-11-21-desktop-macmini-chrome157-jh-webgpu-f32-ts-ettin-17m.json`]**. As tolerâncias continuam as mesmas; só muda quem ocupa cada elo.

## 7. O que fica para a `K-02` em diante

- Trazer os pacotes da seção 2 com `LICENSE`, `NOTICE`, origem e marcação de mudanças (`K-02`).
- Resolver as travas 1 e 2 (`K-03`), 3, 4 e 6 (`K-04`) e 5 (`K-02`), com as medições que cada uma pede.
- Nenhum fork público no GitHub nem pacote publicado: o código entra neste repositório (`packages/engine`), e publicar é decisão do dono (`A-08`).
