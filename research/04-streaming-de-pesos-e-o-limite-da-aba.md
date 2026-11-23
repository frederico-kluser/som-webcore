# Streaming de pesos e o limite da aba

> **Relatório 4 da pasta `research/`, produzido com assistência de IA em 2026-11-23.** É uma pesquisa na web com verificação adversarial: 26 fontes lidas, 124 afirmações extraídas e 25 verificadas por três votos independentes, das quais 20 foram confirmadas e 5 refutadas.
>
> É **fonte não confiável até verificação** (ver a [metodologia](../docs/METHODOLOGY.md#pesquisa)). Os rótulos seguem esta regra:
> - fatos de terceiros vêm como **[REPORTADO]**, com a fonte primária que o verificador abriu;
> - ligações entre um mecanismo e o nosso sintoma vêm como **[HIPÓTESE]**;
> - números **[MEDIDO]** vêm da [análise forense dos logs do iPhone](../docs/reports/forense-iphone-2026-11-22.md), feita no mesmo dia só com os dados do repositório.
>
> As correções que este relatório provoca nos relatórios 2 e 3 estão na [errata](ERRATA.md), seção 7.

**Pergunta do dono (2026-11-23).** O plano original falava de transmitir os pesos em lotes, para não esgotar a memória da aba e processar tudo na GPU, de modo que o modelo fosse limitado pela máquina e não pelo navegador. Dá para aproveitar algo do documento de arquitetura — o relatório 2, `research/02-runtime-bare-metal-wgpu.txt` — para passar do limite da aba? Nos nossos testes, a aba morreu com um modelo minúsculo.

## Resposta curta

1. **A aba não morreu por causa do tamanho do modelo [MEDIDO].** Os logs de 2026-11-22 mostram dois modos de falha, e nenhum depende do tamanho:
   - **`RangeError: Out of memory`.** Em cada processo do Safari, as 3 primeiras inicializações do ONNX Runtime passaram (15 de 15) e todas a partir da 4ª falharam (26 de 26), com arquivos de 17 a 68 MB. A exceção sai da criação da memória Wasm compartilhada (16 MiB iniciais, 4 GiB de máximo), antes de o `.wasm` ser buscado. A aba segue viva.
   - **Morte da aba.** Aconteceu só com o ONNX Runtime em WebGPU, na variante `q8emb32-f16` (23,37 MB), no meio da inferência, depois de 40 e de 128 decisões.
   - **O nosso motor não falhou.** O `@johnhenry` (JavaScript + WGSL, sem Wasm) rodou o `f32` de 67,48 MB 8 vezes, incluindo 2 × 200 decisões, nos mesmos processos.
2. **O código do WebKit explica os dois modos [REPORTADO; a ligação com o nosso caso é HIPÓTESE].**
   - Cada memória Wasm "rápida" reserva 4 GiB + 8 MiB de endereços. O iOS admite 3 por processo, e elas só voltam pela coleta de lixo. É o "3 passam, a 4ª falha" medido.
   - No Safari 26, o compilador otimizante de Wasm (OMG) pode fazer picos de vários GiB que o jetsam pune. A própria WebKit liga isso às falhas do ONNX Runtime no iOS 26. É um candidato forte para as mortes no meio da inferência, quando as funções quentes sobem de nível de compilação.
   - O nosso motor não usa Wasm.
3. **No iPhone, memória de GPU é memória da aba [REPORTADO].**
   - Desde 2024-03, o WebKit cobra do processo da aba toda `GPUBuffer` e toda `GPUTexture`.
   - O teto desse processo fica entre ~1,5 e 2 GB e não sobe por *entitlement*.
   - Por isso, o adaptador aceitar buffers de 1 GiB é só validação. E os 41 GB de quota do OPFS não aumentam o que pode ficar residente.
4. **O streaming em lotes do relatório 2 resolve o pico da carga, não o teto.**
   - O relatório 2 transmite os pesos do OPFS para 2 ou 3 *slabs*, mas deixa **o modelo inteiro residente** na GPU. No Safari, isso conta inteiro na aba.
   - A técnica tira a dupla residência (o arquivo inteiro no JS mais as cópias do `writeBuffer`, pico de ~3 a 4× os pesos) e contorna limites por *buffer*.
   - O "sem limites do navegador" do relatório 2 é o perfil nativo, fora do navegador.
5. **Passar do teto da aba exige execução fora do núcleo (`C-07` do roadmap).**
   - Só uma janela dos pesos fica residente: 2 ou 3 fatias, um *staging* pequeno e as ativações. O resto é relido do OPFS a cada passada.
   - Nenhuma medição de vazão do OPFS para a GPU sobreviveu à verificação. A latência por passada é a incógnita, e a `C-01` a mede.
   - Pela conta **[HIPÓTESE]**: um encoder de 150M cabe residente até em f32 (~0,6 GB); um de ~1B só em int4 (~0,5 GB) ou, apertado, em int8 (~1 GB); em f16 (~2 GB), só por streaming.

## 1. O que derrubou a aba nos nossos testes

### 1.1 O que os logs mostram [MEDIDO]

Fonte: [análise forense](../docs/reports/forense-iphone-2026-11-22.md), que cita arquivo e linha de cada número.

| Falha | Motor | Quando | O que a página viu | A aba morreu? | Depende do tamanho? |
|---|---|---|---|---|---|
| `RangeError: Out of memory` | ONNX Runtime Web 1.31.1, Wasm e WebGPU (os dois rodam o runtime em Wasm) | da 4ª inicialização em diante, no mesmo processo (26 de 26); as 3 primeiras passam (15 de 15) | exceção ao iniciar o backend, antes de buscar o `.wasm` | não | não: 17 a 68 MB passaram e falharam igual |
| Queda do processo da aba | ONNX Runtime Web em WebGPU (build `asyncify`, `.wasm` de 28,7 MB), variante `q8emb32-f16` | no meio da inferência, depois de 40 e de 128 decisões, em entradas diferentes | nada: recarga, depois a tela “ocorreu um problema repetidamente” | sim | causa não determinada; o modelo tem 23,37 MB |

Os logs mostram mais três coisas:

- **Nenhuma medida de memória.** O Safari não dá à página `performance.memory` nem `measureUserAgentSpecificMemory`, então não há nenhuma medida de memória do iPhone.
- **Recursos do adaptador.** O adaptador expõe `shader-f16` e `packed_4x8_integer_dot_product`, mas não `subgroups`. Aceita buffers e bindings de 1 GiB.
- **O ONNX Runtime ficou fora do registro.** O laboratório não registrou o dispositivo WebGPU do próprio ONNX Runtime: a falta de `device.lost` não prova nada.

### 1.2 Os mecanismos do WebKit [REPORTADO]

**Memórias Wasm rápidas.** No JavaScriptCore, uma memória Wasm de 32 bits em modo rápido (*signaling*) reserva de uma vez 4 GiB de endereços mais 8 MiB de *redzone*. Isso vale qualquer que seja o tamanho declarado; só os bytes iniciais são cobrados como RAM ([BufferMemoryHandle.cpp](https://github.com/WebKit/WebKit/blob/main/Source/JavaScriptCore/runtime/BufferMemoryHandle.cpp), [WasmMemory.cpp](https://github.com/WebKit/WebKit/blob/main/Source/JavaScriptCore/wasm/WasmMemory.cpp)).

- **O teto por processo.** Ele é `maxNumWasmFastMemories = hasCapacityToUseLargeGigacage() ? 8 : 3`, ou seja, 3 no iOS. Veio do commit [5247798c3d0e](https://github.com/WebKit/WebKit/commit/5247798c3d0e) (2024-04-05), que ligou as memórias rápidas no iOS, e está nos ramos de release do Safari 26 ([OptionsList.h](https://github.com/WebKit/WebKit/blob/main/Source/JavaScriptCore/runtime/OptionsList.h), [Gigacage.h](https://github.com/WebKit/WebKit/blob/main/Source/bmalloc/bmalloc/Gigacage.h): Gigacage Primitive de 16 GiB no iOS).
- **A contagem é do processo.** Ela fica num *singleton* do processo. Uma vaga só volta quando a coleta destrói a memória; ao bater no teto, o motor faz uma única coleta completa e tenta de novo.
- **O gatilho exato do `RangeError` no 26.6.3 não ficou estabelecido.** Pode ser a contagem ou a falta de espaço no Gigacage. Uma afirmação detalhada sobre esse caminho foi refutada na verificação. O teste de vagas da `C-01` decide.
- **O sintoma tem histórico.** O [bug 222097](https://bugs.webkit.org/show_bug.cgi?id=222097) mostra “2 ou 3 recargas, até o Safari ser encerrado” do iOS 13 ao 17, corrigido com o Gigacage de 16 GB do iOS 18 (277115@main). Há sucessores da mesma classe: o [281657](https://bugs.webkit.org/show_bug.cgi?id=281657) e o [256023](https://bugs.webkit.org/show_bug.cgi?id=256023), este corrigido só em 2026-10-30, depois do 26.6.3.

**Picos do compilador otimizante de Wasm no Safari 26.** No [bug 304810](https://bugs.webkit.org/show_bug.cgi?id=304810), um módulo compilado com Asyncify, de 1 a 3 s de trabalho, foi morto por *per-process-limit* em 4 de 4 execuções num iPhone 16 Pro com iOS 26.6.2, cerca de 5 s depois do fim do trabalho.

- **Onde está a memória.** No macOS, o WebContent chega a ~4 GiB, com as amostras em `OMGPlan::work` e `allocateRegistersByGreedy`.
- **O que a WebKit diz.** Um engenheiro da WebKit escreveu em 2026-02-20 que este bug e o do ONNX Runtime estão sendo tratados com melhorias nos alocadores de registradores e de pilha ([306945@main](https://commits.webkit.org/306945@main); [onnxruntime #26827](https://github.com/microsoft/onnxruntime/issues/26827)).
- **Ainda reproduz.** Um duplicado foi dado como corrigido no beta do 26.5, mas o caso de setembro ainda reproduz no 26.6.x.
- **Por que serve de explicação [HIPÓTESE].** O padrão casa com as nossas mortes: build `asyncify`, morte no meio da inferência e não na carga, e morte mais cedo no processo que já tinha rodado o ONNX Runtime Wasm.

**Coleta cega à GPU.** No Safari publicado, inclusive no 26.6.x, o coletor do JavaScriptCore não enxerga a memória de GPU dos objetos WebGPU ([bug 283321](https://bugs.webkit.org/show_bug.cgi?id=283321)). A correção, [323447@main](https://github.com/WebKit/WebKit/commit/8184bca87862) de 2026-10-12, não está nos ramos de release conferidos. Já `GPUBuffer.destroy()` libera sem esperar a coleta.

**Por que isso importa [HIPÓTESE].** Sessões recriadas sem `destroy()` acumulam memória cobrada da aba até o jetsam. É compatível com a queda do ONNX Runtime em WebGPU, mas não a prova.

### 1.3 O que falta para fechar

Três experimentos da análise forense entraram na `C-01`:

- **O motivo da queda.** Os Dados de Análise do próprio iPhone, se trouxerem um `JetsamEvent` ou um relatório de queda, dizem se a morte foi por memória.
- **O tipo do limite.** O contador de vagas Wasm decide entre contagem e bytes.
- **Para onde a memória cresceu.** Um livro-caixa da GPU que embrulha os protótipos separa crescimento de GPU de pico do compilador: bytes de GPU estáveis com morte mesmo assim apontam para o compilador.

## 2. Como o Safari do iPhone conta a memória da aba [REPORTADO]

| O quê | Conta onde | Fonte |
|---|---|---|
| `GPUBuffer` e `GPUTexture` (memória Metal) | no processo da aba (WebContent), por troca de dono no kernel, sem contagem dupla | commit [276332@main](https://github.com/WebKit/WebKit/commit/d9844889d42d79dc040865b5928b1da71fbdddf5) (2024-03-19, [bug 254219](https://bugs.webkit.org/show_bug.cgi?id=254219)); [Buffer.mm](https://github.com/WebKit/WebKit/blob/main/Source/WebGPU/WebGPU/Buffer.mm), [Device.mm](https://github.com/WebKit/WebKit/blob/main/Source/WebGPU/WebGPU/Device.mm) |
| *staging* interno de `queue.writeBuffer` e `writeTexture` | no processo de GPU, sem atribuição desde 2025-03-18 | [Queue.mm](https://github.com/WebKit/WebKit/blob/main/Source/WebGPU/WebGPU/Queue.mm) (`skipMemoryAttribution`), commit [29155572a7c4](https://github.com/WebKit/WebKit/commit/29155572a7c4) |
| heap do processo de GPU | no processo de GPU, que tem orçamento de jetsam próprio | [bug 303203](https://bugs.webkit.org/show_bug.cgi?id=303203): ~650 MB não atribuídos levaram à morte do processo de GPU (corrigido em 2025-12-05) |
| reserva de endereços do Wasm | no espaço de endereços (Gigacage de 16 GiB), não na RAM | seção 1.2 |
| cache de páginas do OPFS | não verificado | — |

**O teto.** O limite de jetsam do WebContent em iPhones fica entre ~1,5 GB e 2.048 MB.

- **Na era do iOS 17**, engenheiros da WebKit falam num limite "suave" de cerca de 1,5 GB na maioria dos iPhones, menor nos de menos RAM e maior no iPad ([bug 277848](https://bugs.webkit.org/show_bug.cgi?id=277848), [bug 268816](https://bugs.webkit.org/show_bug.cgi?id=268816)).
- **No iOS 26**, só há registros de terceiros de "ActiveHard 2048 MB (fatal)" ([fórum da Apple, thread 823061](https://developer.apple.com/forums/thread/823061)).
- **Nada sobe esse teto.** A *entitlement* que eleva o limite de apps não vale para o WebContent ([bug 274637](https://bugs.webkit.org/show_bug.cgi?id=274637), WONTFIX).

**O que isso muda para o motor:**

- **Tudo disputa o mesmo teto.** Pesos residentes, ativações, heap JS e memória Wasm entram juntos na conta da aba. O teto do adaptador (1 GiB por buffer) é só validação.
- **O staging pesa no processo de GPU.** Muito *staging* de `writeBuffer` em voo pressiona o processo de GPU, cuja queda é outro modo de falha. Por isso: blocos pequenos e espera pela fila (`onSubmittedWorkDone`) a intervalos.
- **`destroy()` explícito e reutilização são obrigatórios**, porque o coletor não vê a GPU.
- **Um *staging* próprio feito com `GPUBuffer` mapeável conta na aba**, porque passa por `createBuffer`.

## 3. Streaming em lotes: o que passa e o que não passa do limite

São duas coisas diferentes:

| | Streaming na carga (relatório 2, `K-03`) | Streaming a cada passada (fora do núcleo, `C-07`) |
|---|---|---|
| O que fica residente | o modelo inteiro | 2 ou 3 fatias, o *staging* e as ativações |
| O que resolve | o pico de ~3 a 4× os pesos na carga e o limite por *binding* | o teto da aba |
| Teto do tamanho do modelo | o orçamento da aba | a quota do disco (41,2 GB na origem do iPhone **[MEDIDO]**) |
| Custo | nenhum depois da carga | reler os pesos a cada passada: bytes ÷ vazão de ponta a ponta |

**Bytes por passada [HIPÓTESE: parâmetros × bytes por peso, sem ativações nem embeddings fora da GPU]:**

| Parâmetros | f32 | f16 | int8 | int4 |
|---:|---:|---:|---:|---:|
| 150M | ~0,6 GB | ~0,3 GB | ~0,15 GB | ~0,08 GB |
| 400M | ~1,6 GB | ~0,8 GB | ~0,4 GB | ~0,2 GB |
| 1B | ~4 GB | ~2 GB | ~1 GB | ~0,5 GB |

O que cabe residente sai da faixa medida na `C-01`. O que não cabe só roda fora do núcleo, e a latência é a soma dos bytes transmitidos dividida pela vazão de ponta a ponta. Cada 1 GB/s de vazão significa ~1 s por GB transmitido a cada passada. A vazão real é a incógnita: nenhuma medição de leitura do OPFS nem de envio à GPU sobreviveu à verificação.

**Requisitos de desenho para a `C-07`.** Seguem das regras de contabilidade acima **[REPORTADO]** ou são inferência **[HIPÓTESE]**:

- **Recursos criados uma vez.** A janela residente e o *staging* nascem uma vez e são liberados com `destroy()`.
- **Vários submits por passada [HIPÓTESE].** Num único submit, tudo o que os shaders leem já precisa estar na GPU; o envio de uma fatia acontece entre submits.
- **Buffer duplo [HIPÓTESE].** Envia-se a fatia `k+1` enquanto a `k` calcula.
- **Decisões em lote.** Uma leitura dos pesos atende a todas as decisões da fila, o que amortiza o custo.
- **Envio contido.** Blocos pequenos de `writeBuffer`, com espera pela fila, para não matar o processo de GPU.
- **Só a pedido.** O modo só entra com `preference: "capability"`; com `"speed"`, acima da faixa, `availability()` responde `"unavailable"`.

Os trabalhos de referência de execução fora do núcleo — “LLM in a flash” ([arXiv 2312.11514](https://arxiv.org/abs/2312.11514)), o MediaPipe com modelos de 7B no navegador ([Google Research](https://research.google/blog/unlocking-7b-language-models-in-your-browser-a-deep-dive-with-google-ai-edges-mediapipe/)), os modelos grandes no ONNX Runtime Web ([tutorial](https://onnxruntime.ai/docs/tutorials/web/large-models.html)) e o [wllama](https://cdn.jsdelivr.net/npm/@wllama/wllama@3.8.1/README.md) — foram lidos. Mas nenhuma afirmação deles chegou à verificação, e por isso nenhum número deles entra aqui.

## 4. O relatório 2, técnica por técnica

| Técnica do relatório 2 | O que resolve de fato | No iPhone do laboratório | Veredito | No roadmap |
|---|---|---|---|---|
| Streaming do OPFS para *slabs*, com *staging* reutilizável de 8 MiB | o pico da carga, sem o arquivo inteiro no JS; não o residente | o *staging* do `writeBuffer` vai para o processo de GPU, que tem orçamento próprio | **aproveitar**, com blocos de até 4 MiB e espera pela fila | `K-03` |
| 2 ou 3 *slabs* com offsets dinâmicos alinhados a 256 B | o limite por *binding* (128 MiB no padrão; 26% dos Android) | binding de 1 GiB **[MEDIDO]**; todo buffer vivo conta na aba | **aproveitar** para o Android | `C-03` |
| Arena estática, ativações em *ping-pong*, nada alocado por decisão | crescimento e vazamento | o coletor do Safari 26.6 não vê a GPU: `destroy()` explícito | **aproveitar** | `K-04` |
| Memória linear do Wasm abaixo de 16 MiB | a RAM cobrada | a reserva continua de 4 GiB + 8 MiB, e o teto de 3 por processo também | **não resolve**; não usar Wasm resolve | `K-03`, `K-04`, `DA-01` |
| Motor em Rust → wasm32 + wgpu no navegador | — | cada instância ocupa uma vaga Wasm; o compilador OMG do Safari 26 faz picos | **não aproveitar**; a [ADR 0004](../docs/adr/0004-dp-01-fork-do-motor-leve.md) já escolheu JS | — |
| Quantização Q8_0/Q4_K com `dot4I8Packed` | o residente e os bytes transmitidos, na proporção dos bits | `packed_4x8_integer_dot_product` exposto **[MEDIDO]** | **aproveitar**, com orçamento de paridade | `A-07`, `C-02` |
| `enable f16` | metade da memória de ativações | `shader-f16` exposto **[MEDIDO]**; f16 puro errou 1,5e-3 a 1,7e-3 no `@johnhenry` **[MEDIDO]** | aproveitar com acumulação em f32 | `K-02`, `A-07` |
| `enable subgroups` (`subgroupAdd`, `subgroupMax`) | reduções mais rápidas | **não exposto** **[MEDIDO]** | só como caminho opcional; o padrão é reduzir em memória de *workgroup* | `K-02`, `C-03` |
| Todas as camadas num único *compute pass* e num único submit | menos sincronização | — | aproveitar quando o modelo couber inteiro; fora do núcleo, vários submits **[HIPÓTESE]** | `K-04`, `C-07` |
| Leitura de volta de 64 bytes | cópias e latência | — | **aproveitar**: o upstream lê `[B, L, H]` inteiro | `K-04` |
| *FlashAttention* bloco-diagonal com pulo de blocos | atenção e máscara | — | só para modelos treinados com opções independentes, como o Von ([E-06](ERRATA.md)); a máscara calculada no kernel vale para todos | `C-03` |
| Perfil nativo: buffers mapeáveis, *push constants*, *bindless*, matrizes cooperativas | é onde o relatório 2 fica “sem limites do navegador” | não existe no navegador | fora do navegador; SDKs nativos são a `X-04` | `X-04` |
| Teto de ~2 GiB por `ArrayBuffer` no Chrome | — | — | não verificado | — |

## 5. O que ficou sem verificação

Não é o mesmo que falso. Fica **[REPORTADO]** ou **[HIPÓTESE]** e não sustenta critério de aceite:

- Chrome Android e navegadores de desktop: como contam buffers WebGPU e *staging* na aba;
- a vazão do OPFS (`FileSystemSyncAccessHandle`) e do envio à GPU (`writeBuffer`, `mapAsync`, `copyBufferToBuffer`);
- o que AirLLM, FlexGen, “LLM in a flash”, PowerInfer-2, ZeRO-Inference, o `mmap` do llama.cpp, WebLLM, wllama e Transformers.js medem;
- o suporte a `shader-f16`, `subgroups` e `packed_4x8_integer_dot_product` além do nosso iPhone;
- o custo em acurácia da quantização int8 e int4 em encoders da família ModernBERT;
- a tabela de embeddings fora da GPU, a memória de ativações e a máscara no kernel;
- se o cache de páginas do OPFS conta na aba;
- como detectar que o limite está perto.

Quase todo o código citado é do `main` do WebKit em novembro de 2026; o Safari 26.6.3 vem da linha `safari-7624`. O teto de 3 memórias rápidas e a atribuição das `GPUBuffer` foram conferidos nos ramos de release. Ficaram só no `main` e provavelmente fora do 26.6.3:

- 323447@main: a coleta passa a ver a GPU;
- 325251@main: retenção de memória Wasm em AudioWorklet;
- 325766@main: vazamento de `TextureView` no processo de GPU.

## 6. Afirmações refutadas na verificação

Ficaram fora da síntese:

- que bater no teto de memórias rápidas não lança erro por si só, porque a memória cairia para o modo com checagem de limites (0-3);
- que o pico de compilação cresce cerca de 1 GiB por instância do módulo (0-3);
- que a instrumentação do Chrome exclui a memória do processo de GPU da conta da aba (0-3);
- que o teto “suave” do iPhone varia com a pressão de memória do aparelho (0-3);
- as métricas detalhadas da causa do vazamento do bug 303203 (0-3).

## 7. Fontes primárias

- WebKit, código no `main` de 2026-11-23:
  - [BufferMemoryHandle.cpp](https://github.com/WebKit/WebKit/blob/main/Source/JavaScriptCore/runtime/BufferMemoryHandle.cpp)
  - [WasmMemory.cpp](https://github.com/WebKit/WebKit/blob/main/Source/JavaScriptCore/wasm/WasmMemory.cpp)
  - [OptionsList.h](https://github.com/WebKit/WebKit/blob/main/Source/JavaScriptCore/runtime/OptionsList.h)
  - [Gigacage.h](https://github.com/WebKit/WebKit/blob/main/Source/bmalloc/bmalloc/Gigacage.h)
  - [Buffer.mm](https://github.com/WebKit/WebKit/blob/main/Source/WebGPU/WebGPU/Buffer.mm)
  - [Device.mm](https://github.com/WebKit/WebKit/blob/main/Source/WebGPU/WebGPU/Device.mm)
  - [Queue.mm](https://github.com/WebKit/WebKit/blob/main/Source/WebGPU/WebGPU/Queue.mm)
  - [process-entitlements.sh](https://github.com/WebKit/WebKit/blob/main/Source/WebKit/Scripts/process-entitlements.sh)
- Commits do WebKit:
  - [5247798c3d0e](https://github.com/WebKit/WebKit/commit/5247798c3d0e) (memórias rápidas no iOS, 2024-04-05)
  - [d9844889d42d](https://github.com/WebKit/WebKit/commit/d9844889d42d79dc040865b5928b1da71fbdddf5) (atribuição de memória da GPU, 2024-03-19)
  - [29155572a7c4](https://github.com/WebKit/WebKit/commit/29155572a7c4) (*staging* sem atribuição, 2025-03-18)
  - [8184bca87862](https://github.com/WebKit/WebKit/commit/8184bca87862) (a coleta vê a GPU, 2026-10-12)
  - [306945@main](https://commits.webkit.org/306945@main)
  - [303984@main](https://commits.webkit.org/303984@main)
  - [277115@main](https://commits.webkit.org/277115@main)
- Bugs do WebKit:
  - [170773](https://bugs.webkit.org/show_bug.cgi?id=170773)
  - [222097](https://bugs.webkit.org/show_bug.cgi?id=222097)
  - [254219](https://bugs.webkit.org/show_bug.cgi?id=254219)
  - [256023](https://bugs.webkit.org/show_bug.cgi?id=256023)
  - [256703](https://bugs.webkit.org/show_bug.cgi?id=256703)
  - [268816](https://bugs.webkit.org/show_bug.cgi?id=268816)
  - [269937](https://bugs.webkit.org/show_bug.cgi?id=269937)
  - [274637](https://bugs.webkit.org/show_bug.cgi?id=274637)
  - [277848](https://bugs.webkit.org/show_bug.cgi?id=277848)
  - [281657](https://bugs.webkit.org/show_bug.cgi?id=281657)
  - [283321](https://bugs.webkit.org/show_bug.cgi?id=283321)
  - [303203](https://bugs.webkit.org/show_bug.cgi?id=303203)
  - [304810](https://bugs.webkit.org/show_bug.cgi?id=304810)
  - [309251](https://bugs.webkit.org/show_bug.cgi?id=309251)
  - [319572](https://bugs.webkit.org/show_bug.cgi?id=319572)
  - [329399](https://bugs.webkit.org/show_bug.cgi?id=329399)
- Outros:
  - [Fórum de desenvolvedores da Apple, thread 823061](https://developer.apple.com/forums/thread/823061)
  - Apple, BrowserEngineKit, “Attributing memory to a content extension”
  - [onnxruntime #26827](https://github.com/microsoft/onnxruntime/issues/26827)
  - [repro do bug 304810](https://frankhinek.github.io/webkit-wasm-compiler-memory-repro/)
