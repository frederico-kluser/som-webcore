# Forense do iPhone (2026-11-22): o que derrubou a aba, e o que o tamanho do modelo tem a ver com isso

Análise feita em 2026-11-23, só com os dados e o código do repositório. Não houve pesquisa na web, nenhum arquivo do repositório foi alterado e o laboratório não foi executado.

## Convenções

- **Caminhos** são relativos à raiz do repositório. Abreviações:
  - `R/` = `bench/results/`
  - `SM/` = `bench/spike-mobile/`
  - `ORT/` = `bench/spike-mobile/node_modules/onnxruntime-web/dist/` (onnxruntime-web **1.31.1**)
  - `JH/` = `bench/spike-mobile/node_modules/@johnhenry/`
- **Linhas de log:** `…-logs.jsonl:L430` e `…-requests.jsonl:L36` são números de linha do arquivo, contando a partir de 1.
- **Horários** estão em UTC. O aparelho está em `America/Sao_Paulo`, UTC−3 **[MEDIDO: `R/2026-11-22-iphone-0229-ambiente.json` → `checks.intl.timeZone`]**.
- **Rótulos:**
  - **[MEDIDO: fonte]**: está no arquivo citado.
  - **[HIPÓTESE]**: inferência minha, ou afirmação de fonte externa que não verifiquei.
  - **[REPORTADO]**: relato do dono ou do operador, não registrado por máquina.
  - **não há dado**: não está em lugar nenhum.
- **Rodadas:**
  - R1 = `0229`, com as etapas em iframes (hook do PR #21).
  - R2 = `0240`, com uma navegação da aba por etapa (PR #22).
  - R3 = `0245`, perfil `onnx` (PR #23, ainda sem a detecção de recarga do PR #24).
  - Os horários de merge (`git log`) foram 05:28:50, 05:40:20, 05:45:28 e 06:13:28 UTC.

---

## 0. Resposta curta

1. **A aba morreu em um caso só.** Foi o ONNX Runtime Web no provedor WebGPU nativo (build `asyncify`), com a variante `q8emb32-f16`, cujo ONNX tem 23.368.916 B. Ele derrubou o processo da aba duas vezes seguidas, **durante a inferência**, depois de 40 e de 128 decisões, e não no carregamento **[MEDIDO: `R/2026-11-22-iphone-0245-logs.jsonl:L430–L786`, `R/2026-11-22-iphone-0245-requests.jsonl:L31–L40`]**.
2. **O arquivo `f32` de 67.484.624 B nunca derrubou a aba.** O `@johnhenry` o carregou 8 vezes nas rodadas 1 e 2, incluindo 2 rodadas de 200 decisões, sem falha. Fez isso **nos mesmos processos em que o ONNX Runtime já não conseguia nem iniciar** **[MEDIDO: tabelas da seção 3]**.
3. **O `RangeError: Out of memory` não é morte da aba.** É uma exceção JavaScript lançada ao iniciar o backend do ONNX Runtime, e a aba segue viva.
   - Segue uma regra de contagem sem nenhuma exceção: em cada processo do Safari, as 3 primeiras inicializações do ONNX Runtime passam e todas a partir da 4ª falham. São 15 de 15 e 26 de 26, das quais uma é inferida (seção 2).
   - O tamanho do modelo não entra: arquivos de 17,2 MB a 68,4 MB passaram e também falharam.
   - Nas 20 execuções que falharam, o `.wasm` do ONNX Runtime **nunca chega a ser buscado**. A exceção vem, portanto, da criação de `new WebAssembly.Memory({initial:256, maximum:65536, shared:true})`, ou seja, 16 MiB iniciais, máximo de 4 GiB e compartilhada. Isso acontece antes de compilar o Wasm e antes de o modelo entrar na memória do Wasm (seção 4.1).
4. **O tamanho do modelo não explica nenhum dos dois modos de falha.** O pico estimado de cada motor com o 17M fica entre ~0,2 e 0,7 GB (seção 5), longe de 1,5–2 GB. O que chega perto de um teto é a **reserva virtual** de 4 GiB por instância do ONNX Runtime: 3 instâncias somam ~12 GiB. Isso esbarra no alocador do JavaScriptCore, não no jetsam **[HIPÓTESE]**.
5. **A causa da morte não está determinada.**
   - A mais provável **[HIPÓTESE]** é um estouro do limite de memória do processo WebContent (jetsam), por crescimento durante a inferência do ONNX Runtime WebGPU, com a memória da GPU contando para a aba.
   - Dois indícios apoiam essa leitura. O processo que já tinha rodado o ONNX Runtime Wasm morreu mais cedo (40 contra 128 decisões). E as mortes caíram em entradas diferentes, o que exclui um defeito determinístico por entrada.
   - A alternativa é uma queda (crash) do WebKit ou do caminho de GPU.
   - O teste decisivo é grátis: ler no iPhone os relatórios de análise (`JetsamEvent` contra relatório de crash) das 02:47 locais do dia 22 (seção 7, X0).

---

## 1. Aparelho e ambiente (comum às três rodadas)

| Item | Valor | Fonte |
|---|---|---|
| User agent | `Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.3 Mobile/15E148 Safari/604.1` | [MEDIDO: `R/2026-11-22-iphone-0229-ambiente.json` → `checks.navigator.userAgent`] |
| Tela · núcleos · RAM | 390×844 @3; `hardwareConcurrency` 4; `deviceMemory` `null`. O modelo do iPhone e a RAM **não estão registrados** (não há dado) | [MEDIDO: mesmo arquivo → `checks.screen`, `checks.navigator`] |
| Contexto | `isSecureContext` true; `crossOriginIsolated` false; `SharedArrayBuffer` ausente | [MEDIDO: `checks.context`, `checks.apis.SharedArrayBuffer`=false] |
| Wasm (sem isolamento) | SIMD true; relaxed SIMD false; JSPI false; threads false | [MEDIDO: `R/2026-11-22-iphone-0229-sonda.json` → `environment.wasm`] |
| Wasm (com COOP/COEP) | threads true; `sharedArrayBuffer` true | [MEDIDO: `R/2026-11-22-iphone-0229-sonda-coi.json` → `environment.wasm`] |
| APIs de memória | `performance.memory` false; `measureUserAgentSpecificMemory` false. **Nenhuma medida de memória é possível na página** | [MEDIDO: `R/…-0229-ambiente.json` → `checks.apis`] |
| Adaptador WebGPU | `vendor/architecture/device/description` = `apple`; `isFallbackAdapter` false; igual em `high-performance` e `low-power`. `subgroupMinSize/MaxSize` não foram expostos (não há dado) | [MEDIDO: `R/…-0229-sonda.json` → `environment.webgpu["high-performance"].info`] |
| Recursos WebGPU (18) | `bgra8unorm-storage, core-features-and-limits, depth-clip-control, depth32float-stencil8, float16-renderable, float32-blendable, float32-filterable, float32-renderable, indirect-first-instance, rg11b10ufloat-renderable, shader-f16, texture-compression-astc, texture-compression-astc-sliced-3d, texture-compression-bc, texture-compression-bc-sliced-3d, texture-compression-etc2, texture-formats-tier1, timestamp-query`. **Sem `subgroups`** | [MEDIDO: mesmo arquivo → `.features`] |
| Recursos da linguagem WGSL | `packed_4x8_integer_dot_product, pointer_composite_access, readonly_and_readwrite_storage_textures, unrestricted_pointer_parameters` | [MEDIDO: mesmo arquivo → `environment.webgpu.wgslLanguageFeatures`] |
| Limites | `maxBufferSize` 1.073.741.824; `maxStorageBufferBindingSize` 1.073.741.824; `maxUniformBufferBindingSize` 1.073.741.824; `maxComputeWorkgroupStorageSize` 32.768; `maxComputeInvocationsPerWorkgroup` 1.024; `maxComputeWorkgroupSizeX/Y/Z` 1.024; `maxComputeWorkgroupsPerDimension` 65.535; `maxStorageBuffersPerShaderStage` 44; `maxBindGroups` 11 | [MEDIDO: mesmo arquivo → `.limits`] |
| Teste real de computação | 1.048.576 floats, 0 divergências, nenhum erro não capturado: 129 ms na R1 e 8 ms na R2 | [MEDIDO: `R/…-0229-ambiente.json` e `R/…-0240-ambiente.json` → `checks.webgpuCompute`] |
| Armazenamento | `quota` 41.231.686.042 B (41,2 GB); `usage` 0; `persisted` false; OPFS ok (`createWritable`, 4.096 B). Na R3 não há verificação estendida (não há dado) | [MEDIDO: `checks.storage`, `checks.opfs`] |

---

## 2. Linha do tempo por processo

A unidade que importa é o **processo WebContent** do Safari, não a aba nem a página. A identidade dos processos abaixo é **[HIPÓTESE]**: nenhum dado registra o PID. Cada fronteira, porém, tem evidência própria, indicada em cada item.

- **P1 (R1).** A página `lab.html` hospeda iframes do mesmo site, todos no mesmo processo.
  - Inicializações do ONNX Runtime: n.º 1 `int8`, n.º 2 `8bit` e n.º 3 `fp32` passam. Da n.º 4 à n.º 13, todas falham.
  - O estado do processo antes da R1 não foi registrado (não há dado).
- **P2 (R2).** Navegações do mesmo site na mesma aba: n.º 1 a n.º 3 passam; n.º 4 a n.º 13 falham.
  - Não há dado para dizer se P2 = P1, ou seja, se o Safari foi fechado ou se a aba mudou entre as rodadas.
  - Como a n.º 1 da R2 passou, ou o processo era novo ou as reservas tinham sido devolvidas nos ~7,5 min entre as rodadas.
- **P3a (início da R3).** A sonda; depois `ort-wasm-q8emb32-f16-17m`, n.º 1, que passa; depois `ort-webgpu-q8emb32-f16-17m`, n.º 2, que inicia, roda 40 decisões e o processo morre.
  - O fato de a n.º 1 passar também mostra um processo novo ou reservas livres. Não há dado sobre o que aconteceu entre 05:43:52 e 05:46:37.
- **P3b.** A recarga automática do Safari às 05:47:01.605 traz a mesma página, n.º 1 no processo. Ela inicia, roda 128 decisões e o processo morre de novo. Depois disso não houve recarga automática, e o dono relata a tela “ocorreu um problema repetidamente” **[REPORTADO: `R/2026-11-22-iphone-0245-ort-webgpu-q8emb32-f16-17m.json` → `writtenBy`, `fatal.message`]**.
- **P3c.** Às 05:49:18 o dono abre `/` à mão.
  - O servidor serve `/index.html` para `/` [`SM/serve.mjs:230`]. Sem parâmetros, a página de teste usa `engine=ort-wasm` [`SM/app.js:10`] na variante padrão `int8` [`SM/engines/registry.js:22`].
  - Por isso **essa visita foi uma inicialização do ONNX Runtime**, a n.º 1 no processo. Indícios:
    - `model_int8.onnx` (17.180.077 B) foi baixado às 05:49:19.372 **[MEDIDO: `R/…-0245-requests.jsonl:L47`]**.
    - A página terminou com `resources: 18`: `script` 11 e `fetch` 7 **[MEDIDO: `R/…-0245-logs.jsonl:L796`]**. Uma execução do ONNX Runtime bem-sucedida tem exatamente 18 recursos fora da API, o `.wasm` entre eles. Uma execução que falhou tem 17, sem o `.wasm` **[MEDIDO: `R/…-0245-ort-wasm-q8emb32-f16-17m.json` e `R/…-0229-ort-wasm-q8emb-f16-17m.json` → `bytes.byCategory`]**.
    - O `encodedBodySize` dos 7 fetch (17.672.445 B) é exatamente a soma dos seis arquivos de dados, 17.180.077 + 483.304 + 6.872 + 1.059 + 774 + 359. O sétimo fetch é o `.wasm` vindo do cache, com 0 B.
    - Conclusão: a n.º 1 passou **[HIPÓTESE forte]**.
  - Seguem a resistência de 200 decisões (n.º 2, passa) e a `q8emb-f16` (n.º 3, passa), esta numa aba nova aberta por `window.open` com `noopener`. A partir da n.º 4 tudo falha, inclusive em duas abas novas abertas pelo botão. Nelas, **a primeira tentativa do ONNX Runtime já falhou** **[MEDIDO: `R/…-0245-logs.jsonl:L1938–L1954` e `L2212–L2228`; `R/…-0245-lab.json` → `steps[8].previous`]**. Essas abas, portanto, compartilham o processo esgotado. Isso não é inferência circular.
- **P3d.** Às 06:00:30 começa uma instância nova de `lab.html` (`seq` 0) **[MEDIDO: `R/…-0245-logs.jsonl:L2320`]**: n.º 1, n.º 2 e n.º 3 passam.

**O que o log mostra sobre “fechar o Safari”:**

- A mesma instância de `lab.html` foi ocultada às 05:57:57.567 (`seq` 5) e **voltou visível às 06:00:11.442** (`seq` 6) **[MEDIDO: `R/…-0245-logs.jsonl:L2303–L2304`]**. Esse processo, portanto, não foi encerrado às 05:57:57.
- Entre 06:00:22 e 06:00:24, quatro instâncias antigas de `lab.html` disparam `pagehide` **[MEDIDO: `L2305–L2319`]**.
- Às 06:00:30 nasce uma instância nova, com a URL antiga `?continue=1`, e o Wake Lock respondeu “`NotAllowedError Document is hidden`” **[MEDIDO: `L2320–L2322`]**.
- Leitura **[HIPÓTESE]**: o Safari pode ter sido reaberto entre 06:00:24 e 06:00:30, ou as abas do processo foram fechadas. Os dados mostram que um processo novo resolveu. O fechamento pelo seletor de apps é **[REPORTADO]** e não aparece no log.

**A regra de contagem.**

- As 41 inicializações do ONNX Runtime cuja ordem no processo é conhecida se dividem assim:
  - **15 na posição 1–3, todas bem-sucedidas**: 3 em P1, 3 em P2, 2 em P3a, 1 em P3b, 3 em P3c (uma inferida) e 3 em P3d.
  - **26 na posição ≥ 4, todas com `RangeError`**: 10 em P1, 10 em P2 e 6 em P3c.
- A divisão é perfeita. É sensível às fronteiras de processo acima, que são **[HIPÓTESE]**.
- A documentação atual diz “2 ou 3 sessões” (`docs/reports/teste-mobile.md:400`, `research/03-modelos-maiores-sem-travas-de-memoria.md:61`). O “2” vem de não contar a visita a `/`. Contando por processo, são **sempre 3**.

---

## 3. Todas as execuções (pergunta 1)

### 3.1 O que vale para toda página de etapa

- **Ciclo de vida** **[MEDIDO: contagem em `R/2026-11-22-iphone-{0229,0240,0245}-logs.jsonl`, campo `kind="lifecycle"`]**:

  | Rodada | `start` | `pageshow` (`persisted=false`) | `pagehide` (`persisted=false`) | `visibility hidden` | `visibility visible` |
  |---|---:|---:|---:|---:|---:|
  | R1 | 21 | 21 | 20 | 20 | — |
  | R2 | 39 | 39 | 39 | 39 | — |
  | R3 | 36 | 36 | 33 | 38 | 3 |

  - **Nenhum** `freeze` ou `resume`, **nenhum** `persisted=true` (nada entrou no cache de voltar/avançar) e nenhuma etapa ficou oculta durante uma medição.
  - Na R3 há 36 `start` e 33 `pagehide`. As três instâncias sem `pagehide` são as duas cargas do ONNX Runtime WebGPU (L430 e L521) e a última `lab.html`, que ainda estava aberta no fim. As abas de `lab.html` deixadas em segundo plano emitiram seus `pagehide` na rajada de 06:00:22–06:00:24.
- **`device.lost`:** todos os eventos registrados têm motivo `destroyed`, dois por página. Vêm da própria sonda, que chama `device.destroy()` [`SM/env.js:33–37`]. Na R1 aparecem como `webgpu/error` (38) só porque o hook do PR #21 classificava toda perda como erro (`git diff 286675a 238dcf9 -- SM/lab/hook.js`).
  - **Nenhum** `device lost: unknown`, **nenhum** `uncaptured …`, **nenhum** `requestDevice failed` em nenhuma rodada **[MEDIDO: busca nos três `logs.jsonl`]**.
- **Wake Lock:** `wake lock: NotAllowedError` 19× na R2 e 15× na R3; a tela foi mantida acesa à mão **[MEDIDO: `kind="lab"` nos logs]**.
- **Memória:** nenhum número.
  - `memory[]` de cada execução só tem `label` e `t`, porque `performance.memory` não existe no Safari [`SM/app.js:58–65`].
  - As colunas “Heap JS máx.” e “Memória máx.” dos três relatórios automáticos estão vazias, com “—” **[MEDIDO: `R/…-relatorio.md`]**.
  - **Não há dado de memória do iPhone.**

### 3.2 R1 (`0229`, iframes; um processo, P1)

A ordem do ONNX Runtime é a da inicialização no processo. Bytes, horários, estado e erro estão em cada `R/2026-11-22-iphone-0229-<etapa>.json`, nas chaves `engineInfo.modelBytes`, `startedAt`/`finishedAt`, `status` e `failures[].error.message`. As latências estão em `latency.warm`/`latency.endurance` **[MEDIDO]**.

| # | Etapa | Motor · backend | Variante · modelo | Bytes do arquivo | Ordem ORT | Página (UTC) | Resultado | Erro (literal) | p50/p95 quente (ms) |
|---:|---|---|---|---:|---:|---|---|---|---|
| 1 | `sonda` | — | — | — | — | 05:30:09.938–05:30:09.972 | posted | — | — |
| 2 | `ambiente` | — | — | — | — | 05:30:13.146–05:30:13.364 | ok | — | — |
| 3 | `ort-wasm-int8-17m` | ort-wasm · wasm | int8 · 17m | 17.180.077 | 1 | 05:30:15.513–05:30:29.765 | ok | — | 43,0 / 276,3 |
| 4 | `ort-wasm-8bit-17m` | ort-wasm · wasm | 8bit · 17m | 17.657.261 | 2 | 05:30:32.859–05:30:48.645 | ok | — | 50,0 / 310,1 |
| 5 | `ort-wasm-fp32-17m` | ort-wasm · wasm | fp32 · 17m | 68.381.159 | 3 | 05:30:51.749–05:31:08.567 | ok | — | 45,0 / 344,1 |
| 6 | `ort-wasm-q8emb-f16-17m` | ort-wasm · wasm | q8emb-f16 · 17m | 21.958.382 | 4 | 05:31:11.860–05:31:12.635 | failed | `no available backend found. ERR: [wasm] RangeError: Out of memory` | — |
| 7 | `ort-wasm-q8emb32-f16-17m` | ort-wasm · wasm | q8emb32-f16 · 17m | 23.368.916 | 5 | 05:31:15.911–05:31:16.695 | failed | idem | — |
| 8 | `ort-wasm-int8-32m` | ort-wasm · wasm | int8 · 32m | 32.492.842 | 6 | 05:31:19.976–05:31:21.037 | failed | idem | — |
| 9 | `ort-wasm-8bit-32m` | ort-wasm · wasm | 8bit · 32m | 34.047.948 | 7 | 05:31:24.032–05:31:25.096 | failed | idem | — |
| 10 | `ort-webgpu-fp32-17m` | ort-webgpu · webgpu | fp32 · 17m | 68.381.159 | 8 | 05:31:28.152–05:31:30.423 | failed | `no available backend found. ERR: [webgpu] RangeError: Out of memory` | — |
| 11 | `ort-webgpu-q8emb32-f16-17m` | ort-webgpu · webgpu | q8emb32-f16 · 17m | 23.368.916 | 9 | 05:31:33.703–05:31:33.803 | failed | idem `[webgpu]` | — |
| 12 | `jh-webgpu-f32-17m` | jh-webgpu · webgpu | f32 · 17m | 67.484.624 | — | 05:31:36.758–05:31:42.491 | ok | — | 10,0 / 70,0 |
| 13 | `jh-webgpu-f16-17m` | jh-webgpu · webgpu | f16 · 17m | 67.484.624 | — | 05:31:45.353–05:31:49.546 | ok | — | 5,0 / 28,0 |
| 14 | `jh-cpu-f32-17m` | jh-cpu · cpu | f32 · 17m | 67.484.624 | — | 05:31:52.597–05:33:01.733 | ok | — | 217,0 / 1.534,3 |
| 15 | `ort-wasm-8bit-17m-debug` | ort-wasm · wasm | 8bit · 17m | 17.657.261 | 10 | 05:33:04.922–05:33:05.077 | failed | idem `[wasm]` | — |
| 16 | `ort-wasm-q8emb32-f16-17m-resistencia-200` | ort-wasm · wasm | q8emb32-f16 · 17m | 23.368.916 | 11 | 05:33:07.982–05:33:08.119 | failed | idem `[wasm]` | — |
| 17 | `jh-webgpu-f32-17m-resistencia-200` | jh-webgpu · webgpu | f32 · 17m | 67.484.624 | — | 05:33:11.038–05:33:18.016 | ok | — | 200/200, 0 falhas |
| 18 | `ort-webgpu-8bit-17m` | ort-webgpu · webgpu | 8bit · 17m | 17.657.261 | 12 | 05:33:20.800–05:33:20.932 | failed | idem `[webgpu]` | — |
| 19 | `ort-webgpu-int8-17m` | ort-webgpu · webgpu | int8 · 17m | 17.180.077 | 13 | 05:33:23.879–05:33:23.998 | failed | idem `[webgpu]` | — |
| 20 | `sonda-coi` | — | — | — | — | 05:33:27.082–05:33:27.084 | posted | — | — |

Cada execução que falhou tem o mesmo erro 13 vezes, uma por esquema do corpus, porque o carregamento que falha fica falho para a página [`SM/polyfill/decision-model.js:113`].

### 3.3 R2 (`0240`, uma navegação por etapa; um processo, P2)

| # | Etapa | Bytes | Ordem ORT | Página (UTC) | Resultado | Erro (literal) | p50/p95 (ms) |
|---:|---|---:|---:|---|---|---|---|
| 1 | `sonda` | — | — | 05:41:05.554–05:41:05.564 | posted | — | — |
| 2 | `ambiente` | — | — | 05:41:06.699–05:41:06.739 | ok | — | — |
| 3 | `ort-wasm-int8-17m` | 17.180.077 | 1 | 05:41:07.302–05:41:20.961 | ok | — | 44,0 / 282,3 |
| 4 | `ort-wasm-8bit-17m` | 17.657.261 | 2 | 05:41:22.548–05:41:37.861 | ok | — | 50,0 / 309,2 |
| 5 | `ort-wasm-fp32-17m` | 68.381.159 | 3 | 05:41:39.352–05:41:56.521 | ok | — | 45,0 / 344,2 |
| 6 | `ort-wasm-q8emb-f16-17m` | 21.958.382 | 4 | 05:41:57.999–05:41:58.145 | failed | `no available backend found. ERR: [wasm] RangeError: Out of memory` | — |
| 7 | `ort-wasm-q8emb32-f16-17m` | 23.368.916 | 5 | 05:41:59.601–05:41:59.731 | failed | idem | — |
| 8 | `ort-wasm-int8-32m` | 32.492.842 | 6 | 05:42:01.058–05:42:02.077 | failed | idem | — |
| 9 | `ort-wasm-8bit-32m` | 34.047.948 | 7 | 05:42:03.671–05:42:04.740 | failed | idem | — |
| 10 | `ort-webgpu-fp32-17m` | 68.381.159 | 8 | 05:42:06.119–05:42:08.094 | failed | `no available backend found. ERR: [webgpu] RangeError: Out of memory` | — |
| 11 | `ort-webgpu-q8emb32-f16-17m` | 23.368.916 | 9 | 05:42:09.757–05:42:09.861 | failed | idem `[webgpu]` | — |
| 12 | `jh-webgpu-f32-17m` | 67.484.624 | — | 05:42:11.340–05:42:16.630 | ok | — | 10,0 / 71,0 |
| 13 | `jh-webgpu-f16-17m` | 67.484.624 | — | 05:42:17.985–05:42:21.579 | ok | — | 5,0 / 29,0 |
| 14 | `jh-cpu-f32-17m` | 67.484.624 | — | 05:42:23.000–05:43:34.689 | ok | — | 223,0 / 1.600,3 |
| 15 | `ort-wasm-8bit-17m-debug` | 17.657.261 | 10 | 05:43:36.210–05:43:36.388 | failed | idem `[wasm]` | — |
| 16 | `ort-wasm-q8emb32-f16-17m-resistencia-200` | 23.368.916 | 11 | 05:43:37.657–05:43:37.796 | failed | idem `[wasm]` | — |
| 17 | `jh-webgpu-f32-17m-resistencia-200` | 67.484.624 | — | 05:43:39.113–05:43:46.820 | ok | — | 200/200, 0 falhas |
| 18 | `ort-webgpu-8bit-17m` | 17.657.261 | 12 | 05:43:48.131–05:43:48.248 | failed | idem `[webgpu]` | — |
| 19 | `ort-webgpu-int8-17m` | 17.180.077 | 13 | 05:43:49.646–05:43:49.781 | failed | idem `[webgpu]` | — |
| 20 | `sonda-coi` | — | — | 05:43:51.302–05:43:51.306 | posted | — | — |

Motor, backend e variante são os mesmos da R1. A fonte é `R/2026-11-22-iphone-0240-<etapa>.json` e `R/2026-11-22-iphone-0240-lab.json` → `steps[].note` **[MEDIDO]**.

### 3.4 R3 (`0245`, perfil `onnx`; processos P3a a P3d)

As tentativas que falharam e foram repetidas **não têm JSON próprio**, porque o arquivo foi sobrescrito pela tentativa final. Os dados delas vêm de `R/2026-11-22-iphone-0245-lab.json` → `steps[].previous` e dos logs.

| # | Etapa (tentativa) | Motor · variante · modelo | Bytes | Processo · ordem ORT | Página (UTC) | Resultado | Erro / evidência (literal) |
|---:|---|---|---:|---|---|---|---|
| 1 | `sonda` | — | — | P3a · — | 05:46:39.254–05:46:40.190 (L8–L17) | posted | — |
| 2 | `ort-wasm-q8emb32-f16-17m` | ort-wasm · q8emb32-f16 · 17m | 23.368.916 | P3a · 1 | 05:46:40.757–05:46:54.778 | ok, p50/p95 42,0 / 321,1 | — |
| 3 | `ort-webgpu-q8emb32-f16-17m` (carga 1) | ort-webgpu (EP nativo, `asyncify`) · q8emb32-f16 · 17m | 23.368.916 (cache) | P3a · 2 | início 05:46:56.316 (L430) → **última marca 05:47:01.443 (L518)** | **processo morreu** depois de **40 decisões** (1ª passada, `en-01`…`pt-06`) | Nenhum erro JS e nenhum `pagehide`. Sessão criada às 05:46:56.880, com os avisos do ORT (L439–L440, abaixo). `asyncify.wasm` buscado às 05:46:56.534 (requests L35) |
| 4 | idem (**recarga do Safari**) | idem | idem | P3b · 1 | GET 05:47:01.605 (requests L36); início 05:47:01.662 (L521) → **última marca 05:47:11.238 (L786)** | **processo morreu** depois de **128 decisões** (66 da 1ª passada + 3 de aquecimento + 59 quentes) | Sessão às 05:47:02.424 (L530–L531). Sem erro e sem `pagehide`. **Sem nova recarga**: o próximo pedido ao servidor é às 05:49:18.613 (requests L40). Registro escrito à mão: `"writtenBy": "operador (a partir dos registros da sessão e do relato do dono)"` |
| 5 | `/` aberto à mão = `index.html` sem parâmetros | ort-wasm · int8 · 17m | 17.180.077 (requests L47) | P3c · 1 | 05:49:18.672–05:49:35.250 (L787–L797) | sem resultado gravado (sem `name`); **sucesso inferido** (seção 2) | `resources: 18` com `fetch` 7 |
| 6 | `ort-wasm-q8emb32-f16-17m-resistencia-200` | ort-wasm · q8emb32-f16 · 17m | 23.368.916 | P3c · 2 | 05:49:39.110–05:50:00.188 | ok, 200/200 e 0 falhas | — |
| — | pausa do laboratório | | | | 05:50:01.335 (L1356) | `[lab] new tab needed before ort-wasm-q8emb-f16-17m (3 ONNX Runtime sessions in this tab)` | Aba nova (`window.open` com `noopener`) às 05:51:28.202 (L1358) |
| 7 | `ort-wasm-q8emb-f16-17m` | ort-wasm · q8emb-f16 · 17m | 21.958.382 | P3c · 3 | 05:51:28.770–05:51:42.351 | ok, 41,0 / 306,5 | — |
| 8 | `ort-wasm-8bit-17m-debug` (1) | ort-wasm · 8bit · 17m | 17.657.261 | P3c · 4 | 05:51:43.855–05:51:44.790 (L1832–L1843) | failed | `no available backend found. ERR: [wasm] RangeError: Out of memory` (`steps[6].previous[0].note`) |
| 9 | `ort-wasm-int8-32m` (1) | ort-wasm · int8 · 32m | 32.492.842 | P3c · 5 | 05:51:45.317–05:51:46.252 | failed | idem (`steps[7].previous[0]`) |
| 10 | `ort-wasm-8bit-32m` (1), **1ª tentativa do ORT numa aba nova** (05:52:58.843, L1938) | ort-wasm · 8bit · 32m | 34.047.948 | P3c · 6 | 05:52:59.432–05:53:01.989 | failed | idem (`steps[8].previous[0]`) |
| 11 | `ort-wasm-8bit-17m-debug` (2), aba antiga recarregada (05:57:35.402, L2032) | | 17.657.261 | P3c · 7 | 05:57:35.916–05:57:36.978 | failed | idem (`previous[1]`) |
| 12 | `ort-wasm-int8-32m` (2) | | 32.492.842 | P3c · 8 | 05:57:37.510–05:57:38.441 | failed | idem |
| 13 | `ort-wasm-8bit-32m` (2), **1ª tentativa do ORT numa aba nova** (05:57:41.733, L2212) | | 34.047.948 | P3c · 9 | 05:57:42.227–05:57:44.665 | failed | idem |
| — | aba oculta → visível → abas fechadas → instância nova | | | | 05:57:57.567 (L2303) → 06:00:11.442 (L2304) → 06:00:22–06:00:24 (L2305–L2319) → 06:00:30.122 (L2320) | | Seção 2 |
| 14 | `ort-wasm-8bit-17m-debug` (3) | ort-wasm · 8bit · 17m | 17.657.261 | P3d · 1 | 06:00:30.776–06:00:36.137 | ok (`warm=0`) | — |
| 15 | `ort-wasm-int8-32m` (3) | ort-wasm · int8 · 32m | 32.492.842 | P3d · 2 | 06:00:40.254–06:01:20.888 | ok, 135,5 / 856,8 | — |
| 16 | `ort-wasm-8bit-32m` (3) | ort-wasm · 8bit · 32m | 34.047.948 | P3d · 3 | 06:01:22.438–06:02:09.981 | ok, 159,0 / 934,1 | — |
| — | `ort-webgpu-fp32-17m`, `-8bit-17m`, `-int8-17m` | | | | | `skipped` | `pulada: o ONNX Runtime WebGPU derrubou o processo do Safari na etapa q8emb32-f16` (`lab.json`) |

Avisos literais do ONNX Runtime na criação da sessão WebGPU, iguais nas duas cargas **[MEDIDO: `R/…-0245-logs.jsonl:L439–L440`, `L530–L531`]**:

- `[W:onnxruntime:, session_state.cc:1598 VerifyEachNodeIsAssignedToAnEp] Some nodes were not assigned to the preferred execution providers which may or may not have an negative impact on performance. e.g. ORT explicitly assigns shape related ops to CPU to improve perf.`
- `[W:onnxruntime:, session_state.cc:1600 VerifyEachNodeIsAssignedToAnEp] Rerunning with verbose output on a non-minimal build will show node assignments.`

Os mesmos dois avisos aparecem no Chrome de desktop em `R/2026-11-21-desktop-macmini-chrome157-ort-webgpu-int8-ts-ettin-17m.json` → `browserConsole`.

Também há `Script error. @ :0:0` em `lab.html` duas vezes: às 05:45:23.595, depois do fim da R2, e às 06:00:24.387, durante o fechamento de abas **[MEDIDO: `R/…-0240-logs.jsonl:L3879`, `R/…-0245-logs.jsonl:L2314`]**. Nenhum deles cai numa página de etapa.

---

## 4. Classificação de cada falha (pergunta 2)

### 4.1 `RangeError: Out of memory`: as 26 falhas

São 12 execuções `[wasm]` e 8 `[webgpu]` nas rodadas 1 e 2, mais 6 tentativas na R3.

**Classe: exceção JavaScript na inicialização do backend do ONNX Runtime, antes de qualquer GPU e antes de o modelo entrar no Wasm. Não é morte da aba, nem erro de WebGPU, nem queda de processo.**

1. **Onde a mensagem é montada.**
   - `tryResolveAndInitializeBackend` captura a exceção de `backend.init()` e a guarda como texto (`` backendInfo.error = `${e}` `` [`ORT/ort.wasm.mjs:97–98`]).
   - `resolveBackendAndExecutionProviders` lança `` `no available backend found. ERR: ${errors.map((e) => `[${e.name}] ${e.err}`)…}` `` [`ORT/ort.wasm.mjs:128`].
   - Logo, `[wasm] RangeError: Out of memory` é um `RangeError` saído de `init("wasm")`, e `[webgpu] …` saído de `init("webgpu")`.
   - O `init` é `initializeWebAssemblyAndOrtRuntime()` seguido de `initializeOrtEp()` [`ORT/ort.webgpu.mjs:4641–4645`].
2. **Qual chamada lançou.**
   - A fábrica do Emscripten, no mesmo fluxo síncrono, executa nesta ordem:
     - (a) `new WebAssembly.Memory({initial:0,maximum:0,shared:!0})` para obter o construtor de `SharedArrayBuffer` quando ele não existe, que é o caso no iPhone sem isolamento [`ORT/ort-wasm-simd-threaded.mjs:2`; `.asyncify.mjs:2`];
     - (b) `new WebAssembly.Memory({initial:256,maximum:65536,shared:!0})` [`ORT/ort-wasm-simd-threaded.mjs:46`; `.asyncify.mjs:103`];
     - (c) só depois, `await wa()` / `await Ea()`, que busca e compila o `.wasm` [`ORT/ort-wasm-simd-threaded.mjs:59`; `.asyncify.mjs:118`].
   - **Nas 20 execuções que falharam nas rodadas 1 e 2, o Resource Timing lista o pacote do ORT e a cola `.mjs`, mas não o `.wasm`. Em todas as execuções bem-sucedidas, o `.wasm` aparece** **[MEDIDO: cada `R/2026-11-22-iphone-{0229,0240}-ort-*.json` → `bytes.byCategory.runtime.files`]**.
   - Logo, a exceção saiu de (a) ou (b) e não da compilação **[HIPÓTESE forte]**. O caminho (b) é o candidato natural, a reserva de 4 GiB; o (a), com máximo 0, não reserva nada **[HIPÓTESE]**.
   - Isso descarta, entre outras, a hipótese de faltar memória executável para compilar o Wasm: a compilação nem começou.
3. **O modelo não participa.**
   - O modelo inteiro já estava baixado e guardado num `Uint8Array` quando a falha aconteceu: `engineInfo.modelBytes` vem preenchido em todas as falhas, porque `fetchResource` roda antes de `InferenceSession.create` [`SM/engines/ort.js:25–27`].
   - O ponto em que o tamanho do modelo importaria tem uma mensagem própria, `Can't create a session. failed to allocate a buffer of size ${model.byteLength}.` [`ORT/ort.wasm.mjs:2690–2697`], e **ela nunca aparece** **[MEDIDO: busca em todos os `R/2026-11-22-iphone-*`]**. O mesmo vale para `failed to allocate`, `bad_alloc` e `GPUOutOfMemoryError`.
   - Os tamanhos que passaram e que falharam se sobrepõem por completo, de 17,2 MB a 68,4 MB. Só a ordem no processo separa os dois grupos (seção 2).
4. **Não é falta de memória física.**
   - No mesmo processo, logo depois das falhas, o `@johnhenry` baixou 67.484.624 B para um `Uint8Array` e os enviou à GPU várias vezes, inclusive em 200 decisões seguidas **[MEDIDO: R1 linhas 12–14 e 17; R2 idem]**.
   - Falta de memória física no iOS costuma terminar em jetsam, não em `RangeError` **[HIPÓTESE]**.
5. **A liberação não aconteceu enquanto o processo viveu**, em nenhuma destas situações **[MEDIDO]**:
   - remoção de iframe (R1);
   - navegação do mesmo site, sempre com `pagehide persisted=false` (R2);
   - aba nova por `window.open` com `noopener` (R3, primeira tentativa já falha);
   - recarga da aba antiga (R3);
   - ~6 minutos no mesmo processo, de 05:51:43 a 05:57:44, com navegações, duas abas novas, uma recarga e ~4,5 min parado entre 05:53:02 e 05:57:35;
   - na R1 e na R2, ~2 minutos de etapas seguidas, incluindo os 70 s de JavaScript pesado do `jh-cpu`.

   Se é vazamento do JavaScriptCore, retenção por referência ou política de coleta: não há dado.
6. **Mecanismo mais provável [HIPÓTESE, fonte `research/03-modelos-maiores-sem-travas-de-memoria.md:61`, não verificada aqui].**
   - No iOS, o JavaScriptCore admite no máximo 3 *fast memories* de Wasm por processo, cada uma com 4 GiB + 8 MiB de espaço virtual.
   - Elas ficam numa gaiola de 16 GB por processo compartilhada com todos os `ArrayBuffer`.
   - Pela conta, 3 × 4,008 GiB = 12,02 GiB. A 4ª exigiria mais 4,008 GiB, e na gaiola restam no máximo 3,98 GiB, menos o que os outros `ArrayBuffer` ocupam.
   - As duas leituras, “limite de 3 memórias” e “limite de bytes na gaiola”, preveem exatamente o “3 passam, a 4ª falha” observado. **Os dados não separam as duas** (experimento X1).
   - A memória do ONNX Runtime é **compartilhada** (`shared:true`) mesmo com 1 thread, porque a 1.31.1 só traz builds `*-simd-threaded*` **[MEDIDO: `ls ORT/`]**. Uma memória compartilhada não pode mudar de lugar ao crescer, então qualquer alternativa à *fast memory* também precisaria reservar o máximo de 4 GiB **[HIPÓTESE]**.

### 4.2 As duas mortes com o ONNX Runtime WebGPU (R3)

**Classe: morte do processo inteiro da aba (WebContent). A causa (jetsam por memória, queda do próprio processo ou efeito do processo de GPU) está indeterminada.**

Evidência de que foi o processo da aba **[MEDIDO]**:

- (a) As duas instâncias pararam de emitir no meio do trabalho, sem `pagehide` nem `visibilitychange` (seção 3.1).
- (b) A mesma URL foi pedida de novo 162 ms depois da última marca da página, que é o padrão de recarga automática depois da queda do processo web. A nova instância começa do `seq` 0 e refaz tudo desde `0.1s first-pass en-01: session` (requests L36; logs L518–L521).
- (c) A segunda morte não teve recarga, e o dono relata a tela “ocorreu um problema repetidamente” **[REPORTADO]**.
- (d) As decisões vinham num ritmo de 39–90 ms de mediana por decisão, sem tendência de lentidão antes das mortes **[MEDIDO: diferenças entre marcas `decide` em L428–L786]**.
- Uma correção ao `research/03-modelos-maiores-sem-travas-de-memoria.md:59`: aqui o Safari **recarregou uma vez**, não duas. A primeira carga, às 05:46:56.250 (requests L31), foi a navegação do próprio laboratório.

Evidência de que **não foi no carregamento nem por tamanho** **[MEDIDO]**:

- As duas sessões foram criadas: os avisos do ORT saíram às 0,56 s e às 0,76 s da página.
- A primeira morte veio depois de 40 decisões, em `pt-06`. É o segundo item mais longo do corpus: máx. L = 482 tokens, 3 perguntas, 1.424 tokens no lote **[MEDIDO: `R/…-0245-ort-wasm-8bit-17m-debug.json` → `answers[].tokens`]**.
- A segunda morte veio depois de 128 decisões, em `warm pt-25` (máx. L = 112), **depois de já ter passado por `pt-06` e `pt-27` (523 tokens)**.
- Mortes em entradas diferentes não são um defeito determinístico por entrada.
- O modelo era o de 23.368.916 B, um terço do `f32`.

Por que a primeira morte veio antes **[HIPÓTESE]**:

- P3a já tinha rodado o ONNX Runtime Wasm na página anterior. Como as reservas não voltam enquanto o processo vive (4.1), a memória *comprometida* daquela instância provavelmente também não voltou. Com menos folga, o limite chegou em 40 decisões.
- P3b nasceu limpo da recarga e durou 128.

O que **não** se pode afirmar:

- O hook do laboratório **não registrou o adaptador nem o dispositivo do próprio ORT**. Nas duas cargas, `seq` vai de 0 a 10, sem lacunas, e só há os dois dispositivos da sonda (L430–L440 e L521–L531), embora o ORT chame `navigator.gpu.requestAdapter` [`ORT/ort.webgpu.mjs:3364`] e a cola chame `navigator.gpu.requestAdapter(e)` e `k.requestDevice(a)` [`ORT/ort-wasm-simd-threaded.asyncify.mjs:88`, `:81`].
- Por isso, **não haver `device.lost` nem `uncapturederror` do dispositivo do ORT não prova nada: não houve observação** (não há dado). Por que o envoltório de `navigator.gpu.requestAdapter` [`SM/lab/hook.js:117`] não pegou essas chamadas não ficou determinado.

Comparação no desktop **[MEDIDO]**:

- No Chrome 157 do Mac mini, o mesmo motor WebGPU do ORT fez 200 decisões sem falha com `fp32` e com `q8emb32-f16` (`R/2026-11-21-desktop-macmini-chrome157-ort-webgpu-{fp32,q8emb32-f16}-ts-ettin-17m-resistencia-200.json`).
- Com `int8` e `8bit`, **travou** na primeira passada: `the page did not post a result within 300 s; last stage: first-pass en-02` (`R/2026-11-21-desktop-macmini-chrome157-ort-webgpu-int8-ts-ettin-17m.json` → `fatal.message`).
- O motor WebGPU do ONNX Runtime **nunca completou uma execução num WebKit nos nossos dados**. No simulador de iOS, `requestAdapter` devolve `null`: `no available backend found. ERR: [webgpu] Error: Failed to get GPU adapter. …` em `R/2026-11-21-ios-simulador-safari27-ort-webgpu-8bit-ts-ettin-17m-r1.json`.

### 4.3 Registros benignos

- `device lost: destroyed`: autoinfligido pela sonda [`SM/env.js:36`].
- `wake lock: NotAllowedError`: sem toque do usuário.
- `Script error. @ :0:0`: fora das etapas.

Nenhum deles se relaciona com memória **[MEDIDO]**.

### 4.4 Lacunas que limitam toda conclusão

1. Não há nenhuma medida de memória do iPhone (3.1).
2. O dispositivo WebGPU do ORT não foi instrumentado (4.2).
3. Os registros de jetsam e de crash do iOS não foram coletados (não há dado). O laboratório não tem acesso a eles.
4. As tentativas da R3 que falharam foram sobrescritas; só restam `previous` e os logs.
5. O registro da queda foi escrito à mão (`writtenBy` de operador).
6. A identidade dos processos é inferida.
7. Há outros logs fora do repositório, `serve.log` e `session.json` em `/Volumes/Ext2TB/tmp/som-webcore/lab/<sessão>/` no Mac mini (`.agents/som-webcore-device-lab/SKILL.md`). Não foram consultados.

---

## 5. O que cada motor aloca por sessão (pergunta 3)

Neste banco de testes, **nenhuma sessão é liberada pela página**:

- `DecisionModel.destroy()` só marca uma flag [`SM/polyfill/decision-model.js:196`].
- O `dispose()` dos motores (`session.release()` no ORT [`SM/engines/ort.js:57`]; `model.dispose()` e `device.destroy()` no `@johnhenry` [`SM/engines/johnhenry.js:83`]) **não é chamado por ninguém** [`SM/app.js:233`; busca por chamadas a `dispose`].
- Tudo vive até a página morrer.
- Mesmo com `release()`, o ORT não oferece API para destruir a instância Wasm. `initialized` nunca volta a `false` [`ORT/ort.wasm.mjs:1587–1592`, `1758–1766`]. Só o caminho `env.wasm.proxy` usa um Worker [`ORT/ort.wasm.mjs:3440`, `3491–3533`], e ele está desligado por padrão [`ORT/ort.wasm.mjs:3838–3839`].

### 5.1 Tabela de alocação

| Motor | Memórias Wasm por página | Threads e workers | Cópias na CPU dos pesos | GPU | Liberação |
|---|---|---|---|---|---|
| ORT Wasm (`ORT/ort.wasm.min.mjs` + `ort-wasm-simd-threaded.wasm`, 14.848.852 B; 2.449.236 B em brotli **[MEDIDO: `R/…-0229-ort-wasm-int8-17m.json` → `bytes…runtime`]**) | 2: (a) a de 0/0, compartilhada (sem `SharedArrayBuffer`) [`ORT/ort-wasm-simd-threaded.mjs:2`]; (b) inicial **256 páginas = 16 MiB**, máximo **65.536 páginas = 4 GiB**, `shared:true` [`ORT/ort-wasm-simd-threaded.mjs:46`]. Cresce em +20% com teto de +96 MiB além do pedido, até 4.294.901.760 B. Uma falha de `grow` é capturada e vira `malloc` nulo [`ORT/ort-wasm-simd-threaded.mjs:42`] | `numThreads` = 1 [`SM/app.js:13`; `SM/engines/ort.js:23`; **[MEDIDO]** `engineInfo.threads`=1]. `hd()` cria `numThreads−1` = 0 workers [`ORT/ort-wasm-simd-threaded.mjs:18`]. Sem proxy | (1) pedaços do `fetch` + (2) `Uint8Array` concatenado [`SM/engines/fetch.js:18–31`] + (3) cópia para o heap do Wasm [`ORT/ort.wasm.mjs:2690–2697`], liberada depois da criação da sessão [`:2856`], mas o heap não encolhe + (4) inicializadores do grafo dentro do Wasm **[HIPÓTESE]** | nenhuma | nunca, enquanto a página vive; e as reservas não voltam enquanto o processo vive (4.1) |
| ORT WebGPU (`ort.webgpu.min.mjs` + `ort-wasm-simd-threaded.asyncify.wasm`, 28.747.738 B; 4.315.487 B em brotli **[MEDIDO: `R/…-0245-requests.jsonl:L35`]**) | as mesmas 2 [`.asyncify.mjs:2`, `:103`] | iguais | (1)+(2)+(3); os nós que ficam na CPU guardam inicializadores no heap. Os pesos vão à GPU por `writeBuffer` a partir de uma *subarray* do heap do Wasm [`.asyncify.mjs:103`] | dispositivo próprio (via `navigator.gpu.requestAdapter` [`ORT/ort.webgpu.mjs:3364`; `.asyncify.mjs:88`]); um *buffer* de leitura criado e destruído a cada leitura [`.asyncify.mjs:120`]. Tamanho do cache de *buffers*: **não há dado** | idem; o dispositivo vive até a página morrer |
| `@johnhenry` WebGPU (`JH/backend-webgpu` 0.6.0, `JH/modernbert` 0.3.1) | **0**: nenhum `WebAssembly` em `JH/*` nem em `@huggingface/tokenizers` **[MEDIDO: `grep -rl WebAssembly` vazio]** | 0 workers | (1)+(2) do arquivo inteiro [`SM/engines/fetch.js:18–31`]; visões sem cópia por tensor [`JH/modernbert/dist/index.js:96`]; todos os envios em voo de uma vez [`:134`, `:153`, `:376`]; cópias da cabeça em `Float64Array` [`SM/engines/johnhenry.js:34–42`] | pesos por `queue.writeBuffer` [`JH/backend-webgpu/dist/backend.js:250`, `runtime.js:176`] em *buffers* de um *pool* por classe de tamanho [`runtime.js:108–125`]. *Pool* ocioso de até **2³⁰ B = 1 GiB** [`backend.js:104`], com `trim()` [`runtime.js:152`] nunca chamado. Dispositivo com `requiredLimits` = máximos do adaptador, ou seja, 1 GiB aqui [`device.js:40–60`]; `subgroups` filtrado por ausência [`device.js:51`; `index.js:46–47`]. No `f16`: envia `f32`, converte na GPU e devolve o `f32` ao *pool* [`modernbert/dist/index.js:112–126`] | só no fim da página (`destroy()` [`backend.js:238–248`] não é chamado) |
| `@johnhenry` CPU | 0 | 0 | (1)+(2) + tensores `f32` na memória do JavaScript **[HIPÓTESE]** | nenhuma | fim da página |

### 5.2 Estimativa do pico de uma página com o 17M

Todas as estimativas são **[HIPÓTESE]**, salvo as colunas marcadas como medidas noutros ambientes.

| Motor · variante | Conta (MiB = 2²⁰ B) | Estimativa acima da base do navegador | Medido noutros ambientes (pico do processo inteiro, com a base) |
|---|---|---|---|
| ORT Wasm `fp32` (68.381.159 B ≈ 65,2 MiB) | JS transitório 2 × 65,2 ≈ 130 MiB. Heap do Wasm ≈ 16 + 65,2 (cópia) + ~65 (inicializadores) + empacotamento e ativações → ~150–260 MiB, que **não encolhe**. Reserva **virtual** de 4 GiB | ~0,3–0,45 GB físicos, com até 3 cópias do modelo ao mesmo tempo durante a carga | simulador iOS (Safari 27): **652 e 669 MiB** de RSS do WebContent **[MEDIDO: `R/2026-11-21-ios-simulador-safari27-ort-wasm-fp32-ts-ettin-17m-r{1,2}.json` → `iosMemory.samples[].rss`]**; emulador Android (Chrome 133): **505 MiB** de PSS **[MEDIDO: `R/2026-11-21-emulador-macmini-chrome133-ort-wasm-fp32-ts-ettin-17m-r1.json` → `androidMemory`]** |
| ORT Wasm `int8` / `q8emb32-f16` (17,2 / 23,4 MB) | proporcionalmente menor | ~0,15–0,3 GB | simulador `int8`: 559 e 530 MiB; emulador `int8` 306 MiB e `q8emb32` 372 MiB **[MEDIDO: arquivos equivalentes]** |
| ORT WebGPU `q8emb32-f16` (23,4 MB) | JS ≈ 45 MiB; heap do Wasm ≈ 16 + 22,3 + inicializadores dos nós na CPU (~60–120 MiB); GPU: pesos de 22–60 MiB, conforme o quanto for desquantizado, mais o cache de *buffers* | ~0,15–0,3 GB **na carga**; durante a inferência, **não há dado** | nenhum WebKit completou; no desktop, heap de JS +10,38 MiB em 200 decisões **[MEDIDO: `R/2026-11-21-desktop-macmini-chrome157-ort-webgpu-q8emb32-f16-ts-ettin-17m-resistencia-200.json` → `memory[]`, 38,64 → 49,02 MiB]** |
| `@johnhenry` WebGPU `f32` (67.484.624 B ≈ 64,4 MiB) | JS transitório ≈ 129 MiB; GPU: 64,4 MiB de pesos + ativações (a máscara densa `[3,1,523,523]` em `f32` tem ≈ 3,1 MiB) + *pool* ocioso com o que foi liberado (dezenas de MiB) | ~0,2–0,35 GB | desktop Chrome: heap de JS **96,04 → 146,12 MiB, +50,09 MiB em 200 decisões** **[MEDIDO: `R/2026-11-21-desktop-macmini-chrome157-jh-webgpu-f32-ts-ettin-17m-resistencia-200.json` → `memory[]`]**; iPhone: 200/200 sem falha nas duas rodadas **[MEDIDO]** |
| `@johnhenry` CPU `f32` | arquivo + tensores `f32` | ~0,15–0,3 GB | simulador **357 e 464 MiB**; emulador **241 MiB** **[MEDIDO: `…jh-cpu-f32-ts-ettin-17m-r*.json`]** |

**Isso está perto de 1,5–2 GB?** Não. Nenhuma página com o 17M chega perto disso sozinha.

- As medições do simulador e do emulador com o 17M, que incluem a base do navegador, ficam entre 241 e 710 MiB.
- Os 1,5–2 GB são de fonte externa (`research/03-modelos-maiores-sem-travas-de-memoria.md:59`) **[HIPÓTESE, não medido aqui]**. Não sabemos o modelo nem a RAM deste iPhone, então não há dado do limite deste aparelho.
- Os 4 GiB por instância do ORT são *virtuais*. Esgotam o alocador do JavaScriptCore (4.1), mas não entram na conta física do jetsam **[HIPÓTESE]**.
- Para o jetsam matar a aba durante a inferência, faltaria crescer ~1 GB acima desses picos, algo como um vazamento ou cache. O tamanho dos pesos do 17M (23–68 MB) é uma fração pequena disso.

Ressalvas: o simulador roda como processo do macOS e o emulador é outro navegador. São ordens de grandeza, não a medida do iPhone. Os números de desktop são só o heap de JavaScript do Chrome (`performance.memory.usedJSHeapSize` [`SM/app.js:60`]), sem a memória linear do Wasm nem a da GPU **[HIPÓTESE sobre a métrica]**.

---

## 6. Conclusão (pergunta 4)

### 6.1 Por que a aba morreu (as duas mortes da R3), em ordem de probabilidade

1. **Estouro do limite de memória do processo WebContent (jetsam), causado pelo ONNX Runtime WebGPU durante a inferência [HIPÓTESE: a mais provável, não confirmada].**
   - A favor:
     - a morte veio no meio das decisões, sem exceção e com o padrão do Safari (recarga, depois tela de erro);
     - o processo com sobras de uma página ORT anterior morreu antes (40 contra 128 decisões);
     - a memória da GPU conta para a aba no iOS, pela fonte externa em `research/03-modelos-maiores-sem-travas-de-memoria.md:59`.
   - Falta: qualquer medida de memória e o registro de jetsam.
2. **Queda (crash) não ligada a memória, no WebKit WebGPU, no processo de GPU ou no runtime `asyncify` do ORT [HIPÓTESE].**
   - A favor: o motor WebGPU do ORT é instável com grafos quantizados (travou com `int8` e `8bit` no desktop) e nunca completou uma execução num WebKit.
   - Neutro: não há `device.lost` porque o dispositivo do ORT não foi observado.
   - Contra uma queda só do processo de GPU: a página foi recarregada, que é o sintoma de queda do WebContent. Se uma queda da GPU leva o WebKit a recarregar a aba, não há dado.
3. **Reservas virtuais do Wasm [descartada como causa da morte].**
   - Os processos que morreram tinham no máximo 2 instâncias do ORT, abaixo do limiar observado de 3.
   - Processos com 3 reservas esgotadas seguiram vivos por minutos, rodando o `@johnhenry` (R1 e R2) **[MEDIDO]**.
   - Elas explicam os `RangeError`, não as mortes.
4. **Tamanho do modelo [descartada como causa principal].**
   - A morte veio com o ONNX de 23,37 MB.
   - O `f32` de 67,48 MB rodou 8 vezes, incluindo 2 × 200 decisões, no `@johnhenry`, inclusive em processos com o Wasm esgotado **[MEDIDO]**.
   - O peso do 17M é ≤ ~5–15% do teto citado **[HIPÓTESE]**.

### 6.2 Por que vieram os `RangeError: Out of memory`, em ordem

1. **Limite por processo de reservas de 4 GiB de memória Wasm no JavaScriptCore do iOS.** As reservas não voltam enquanto o processo vive. É a única explicação compatível com a divisão 15/26 (seção 2), com a ausência do `.wasm` nas falhas e com a independência do tamanho **[HIPÓTESE forte]**.
2. **Memória executável para o código Wasm compilado [descartada].** A compilação nem começou.
3. **Memória física esgotada [improvável].** Grandes alocações de JS e de GPU funcionaram em seguida, no mesmo processo.

### 6.3 O que os dados não decidem

- Se o limite é de **contagem** (3 *fast memories*) ou de **bytes na gaiola** (16 GB).
- Se uma memória **não compartilhada** ou com **máximo menor** escaparia do limite.
- Se as reservas voltam depois de coleta e de quanto tempo (vazamento ou retenção).
- Se a memória *comprometida* das instâncias antigas também fica presa, o que pesaria no jetsam.
- Jetsam ou crash nas duas mortes.
- O limite físico deste iPhone.
- Se o Safari foi fechado entre as rodadas.
- O que exatamente resolveu na R3: reabrir o Safari ou fechar todas as abas do processo.

### 6.4 Correções sugeridas à narrativa atual (para quem mantém os documentos)

- “**2 ou 3 sessões**” (`docs/reports/teste-mobile.md:400`; `.agents/som-webcore-device-lab/SKILL.md`; `research/03-modelos-maiores-sem-travas-de-memoria.md:61`) deve virar “**a 4ª inicialização do ONNX Runtime no mesmo processo**”. A visita manual a `/` às 05:49:18 rodou o ONNX Runtime sem que ninguém percebesse.
- “**A aba morreu com um modelo pequeno (17M, 67,48 MB `f32`)**” é impreciso. As mortes foram do ONNX Runtime WebGPU com `q8emb32-f16` (23,37 MB). O `f32` de 67,48 MB, no `@johnhenry`, nunca morreu.
- O comentário `Leaving a no-store page frees it.` [`SM/lab/lab.js:144`] é desmentido pela R2.
- A heurística “aba nova a cada 3 sessões” (PR #23) não funciona, porque a aba aberta por `window.open` com `noopener` compartilha o processo.
- `/` roda o ONNX Runtime por padrão [`SM/serve.mjs:230`; `SM/app.js:10`].
- “O Safari recarrega a página duas vezes” (`research/03-modelos-maiores-sem-travas-de-memoria.md:59`): aqui recarregou **uma**.
- “Fechar o Safari no seletor de apps resolveu”: o log mostra a mesma instância viva às 06:00:11 e uma instância nova às 06:00:30. A causa exata do recomeço está na seção 2.

---

## 7. Os experimentos mais baratos para fechar cada hipótese (pergunta 5)

Cada experimento é uma página de poucas dezenas de linhas no laboratório atual, com o hook, os logs e o `requests.jsonl`. Regras comuns:

- **um processo novo por variante**: fechar o Safari no seletor de apps e conferir pelo próprio X1, porque um processo novo dá 3 vagas;
- gravar um **marcador antes de cada passo arriscado**, em `localStorage` e com `navigator.sendBeacon('/api/lab/log', …)`;
- ao recarregar, ler `performance.getEntriesByType('navigation')[0].type === 'reload'` junto com o marcador, para saber onde morreu.

### X0. Grátis e decisivo para 6.1: os relatórios do próprio iPhone

No iPhone, abrir **Ajustes → Privacidade e Segurança → Análise e Melhorias → Dados de Análise** e procurar arquivos de **2026-11-22 entre 02:46 e 02:48 (hora local)**:

- `JetsamEvent-…`: se o maior processo for `com.apple.WebKit.WebContent` com motivo de limite por processo, confirma a hipótese 1. O arquivo também traz o limite em páginas do processo, que é o teto deste aparelho.
- `com.apple.WebKit.WebContent-…` ou `com.apple.WebKit.GPU-…` (`.ips`): queda, hipótese 2.
- Nada: a morte não foi do iOS. Investigar o WebKit.

### X1. Contador de vagas de memória Wasm: decide 6.2 e “contagem contra bytes”

```js
// wasm-slots.html?v=ort — uma variante por processo novo
const V = { ort:{initial:256,maximum:65536,shared:true},   // exatamente a chamada do ORT
            naoCompart:{initial:256,maximum:65536},        // mesma, sem shared
            max1g:{initial:256,maximum:16384,shared:true}, // máximo de 1 GiB
            minima:{initial:1,maximum:1},                  // 64 KiB
            shim:{initial:0,maximum:0,shared:true} }[v];   // a de 0/0 da cola
const mem = [];
for (let k = 1; k <= 12; k++) { marcar({v, k}); try { mem.push(new WebAssembly.Memory(V)); log(k, 'ok'); }
                                catch (e) { log(k, String(e)); break; } }
```

- **Leitura esperada pela hipótese:**
  - `ort` dá 3 `ok` e, no 4º, `RangeError: Out of memory`. Isso reproduz o ORT sem o ORT.
  - Se `naoCompart` ou `max1g` passarem de 3, a trava está na reserva compartilhada de 4 GiB. Nesse caso, um build não compartilhado (sem threads) ou com máximo menor escaparia.
  - Se `minima` também parar em 3, é **contagem**. Se `max1g` passar de ~12, são bytes na gaiola.
- **Custo:** 1 página e ~1 minuto por variante.

### X2. Liberação e identidade do processo: decide o que devolve as vagas e se a memória comprometida também fica presa

- Na mesma página do X1, depois de esgotar as vagas:
  - soltar as referências e pressionar o coletor (alocar e descartar `ArrayBuffer`s de 64 MiB);
  - tentar de novo em 1 s, 10 s, 60 s e 300 s;
  - depois em cada caso: navegação no mesmo site, recarga, `window.open` com `noopener`, aba nova com URL digitada, fechar todas as abas do site e abrir uma nova, e matar o Safari.
- Usar a **contagem de vagas restantes como impressão digital do processo**.
- Variante Worker: criar as memórias num Worker dedicado, encerrá-lo com `terminate()` e tentar de novo. Testa se o `env.wasm.proxy` do ORT seria um contorno.
- Variante “comprometida”: crescer cada memória a 256 MiB e escrever em todas as páginas antes de soltá-las; depois rodar o X3. Se a folga cair ~768 MiB, as páginas antigas continuam no consumo.

### X3. Orçamento real da aba para a GPU, até a morte, com marcador: decide o teto do aparelho e se GPU, Wasm e JS somam no mesmo limite

```js
const a = await navigator.gpu.requestAdapter();
const d = await a.requestDevice({ requiredLimits: { maxBufferSize: a.limits.maxBufferSize } });
for (let i = 0, total = 0; ; i++) {
  marcar({ passo: i, totalMiB: total >> 20 });        // ANTES do passo
  d.pushErrorScope('out-of-memory');
  const b = d.createBuffer({ size: 64 << 20, usage: GPUBufferUsage.STORAGE, mappedAtCreation: true });
  new Uint8Array(b.getMappedRange()).fill(1); b.unmap(); // compromete as páginas
  const err = await d.popErrorScope(); if (err) { log('GPUOutOfMemoryError', total); break; }
  total += 64 << 20; await d.queue.onSubmittedWorkDone();
}
```

- O último marcador visto após a recarga dá o orçamento efetivo da aba neste iPhone. Ele decide entre os 500 MB do LlamaWeb e os 2.048 MB citados no `research/03-modelos-maiores-sem-travas-de-memoria.md:59`.
- Variantes:
  - antes do laço, comprometer 256 MiB num `ArrayBuffer` e, noutra execução, 256 MiB numa memória Wasm. Se o teto cair o mesmo tanto, a conta é uma só;
  - repetir **logo depois de 3 páginas ORT**, para medir a folga roubada por elas.
- Pode servir junto com o X0 (o `JetsamEvent` dessa morte provocada dá o limite exato).

### X4. Livro-caixa da GPU e reprodução do ONNX Runtime WebGPU: decide 6.1 sem depender do X0

- **Instrumentação:** trocar o envoltório do hook por *protótipos*. Embrulhar `GPU.prototype.requestAdapter`, `GPUAdapter.prototype.requestDevice`, `GPUDevice.prototype.createBuffer` e `GPUBuffer.prototype.destroy`. Assim os dispositivos e *buffers* do ORT também são vistos (hoje não são, 4.2), e dá para somar os bytes vivos por página.
- **Por decisão:** gravar `{i, item, L, bytesVivosGPU, criados, destruídos}` no marcador e no log.
- **Rodar `ort-webgpu-q8emb32-f16`** em quatro condições:
  - (a) processo novo;
  - (b) logo após uma página ORT Wasm, para reproduzir P3a;
  - (c) com todas as entradas preenchidas até L = 512, para tirar a variação de forma;
  - (d) `fp32`.
- **Leitura:** bytes crescendo até a morte apontam para a hipótese 1, e dá para ver se o crescimento é por forma (cache) ou por decisão (vazamento). Bytes estáveis e morte mesmo assim apontam para a hipótese 2.
- Repetir o **`@johnhenry` WebGPU** com o mesmo livro-caixa, como linha de base.

### X5. *Streaming* do OPFS para a GPU em pedaços: decide se pesos grandes cabem sem cópia monolítica, e a vazão real

- **Escrita:** gerar no OPFS um arquivo de 512 MiB, depois de 1 GiB. Num Worker, com `createSyncAccessHandle`, escrever em pedaços de 4 MiB.
  - A disponibilidade de `createSyncAccessHandle` neste Safari é não há dado: a verificação só testou `createWritable`.
  - A cota de 41,2 GB **[MEDIDO]** comporta o arquivo.
- **Leitura:** pedaços de 4 MiB pelo *handle* síncrono, transferidos para a página com `postMessage(buf, [buf])`, seguidos de `queue.writeBuffer` em *slabs* de até 256 MiB ou num *buffer* de até 1 GiB (`maxBufferSize` **[MEDIDO]**), com `await onSubmittedWorkDone()` a cada 64 MiB e marcador a cada 64 MiB.
- **Medir:** MB/s de leitura do OPFS, MB/s de `writeBuffer` e de ponta a ponta, e se a aba sobrevive.
- **Comparar** com o mesmo volume carregado como hoje: `fetch`, depois `Uint8Array` inteiro e por fim `writeBuffer` [`SM/engines/fetch.js:18–31`]. Pelo X3, esse caminho deve morrer antes.
- Variante sem Worker: `file.stream()` na página.

### X6. Higiene do laboratório, para as próximas rodadas não confundirem as duas falhas (custo: horas)

- Uma página neutra em `/`.
- Contar inicializações do ORT **por processo** (com o X1 como sonda), não por aba.
- Chamar `engine.dispose()` no fim de cada execução.
- Gravar o livro-caixa do X4 em toda página.
- Rodar o ONNX Runtime WebGPU **numa sessão própria e primeiro**, em processo novo.

| Hipótese em aberto | Experimento | Custo |
|---|---|---|
| Morte por jetsam ou por queda | **X0**, depois X4 | zero; 1 página |
| Contagem contra bytes; compartilhada contra não compartilhada | **X1** | 1 página, ~5 min |
| Quando e como as vagas voltam; páginas comprometidas presas | **X2** | mesma página do X1 |
| Teto físico da aba neste iPhone; a GPU conta para a aba | **X3** (+ X0) | 1 página |
| Se o ORT WebGPU cresce durante a inferência | **X4** | hook + 4 execuções |
| Viabilidade de pesos grandes por *streaming* | **X5** | 1 página + Worker |

---

## 8. Como os números foram extraídos (reprodutível)

- **Tabelas 3.2 e 3.3:** script que percorre `R/2026-11-22-iphone-{0229,0240}-lab.json` → `steps[]` e lê cada `R/2026-11-22-iphone-<rodada>-<etapa>.json`, nas chaves `engineInfo`, `config`, `startedAt`, `finishedAt`, `status`, `failures[].error.message` e `latency`.
- **Ordem ORT:** contagem das etapas `ort-*` na ordem do `lab.json`. Na R3, também a visita a `/`, cuja prova está em `R/…-0245-requests.jsonl:L40–L47` e em `R/…-0245-logs.jsonl:L787–L797`.
- **Contagens do ciclo de vida e de WebGPU:** agregação de `kind` e `text` nos três `R/…-logs.jsonl`.
- **Decisões antes de cada morte:** linhas `kind="trace"` terminadas em `decide` entre L428–L518 (40) e L519–L786 (128) de `R/…-0245-logs.jsonl`.
- **Comprimentos de entrada:** `answers[].tokens[*].ids` em `R/2026-11-22-iphone-0245-ort-wasm-8bit-17m-debug.json`.
- **Picos de simulador e emulador:** máximo de `iosMemory.samples[].rss` (processos `WebContent#*`) e de `androidMemory.samples[].pss` (processo `sandboxed_process*`).
- **Fatos de código:** lidos nos arquivos citados. Os números de linha das colas minificadas do ORT (`ORT/ort-wasm-simd-threaded*.mjs`) foram calculados a partir do deslocamento do trecho no arquivo.
- **O que não foi feito:** nada foi executado no iPhone nem no Mac, e nenhum arquivo do repositório foi alterado.
