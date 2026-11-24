# Laboratório de aparelho — sessão `2026-11-23-desktop-1958`

> Gerado por `bench/spike-mobile/lab/analyze.py` a partir dos arquivos da sessão em `bench/results/`. Aparelho: **desktop**; perfil `memoria`; modo `local`; início 2026-11-23T22:58:33.428Z; fim 2026-11-23T23:02:09.231Z. Tudo **[MEDIDO no aparelho]**; os limites do portão GT são **[ALVO]** do roadmap.

## Aparelho e navegador

| Item | Valor |
|---|---|
| Navegador | `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36` |
| Tela | 1680×1050 @1x; núcleos lógicos 8; `deviceMemory` 16 |
| Contexto seguro | True; isolado (sonda com COOP/COEP): — |
| WebAssembly | SIMD True; SIMD relaxado True; JSPI True; threads False (isolado: —) |
| WebGPU | `navigator.gpu` True; adaptador True {"vendor": "apple", "architecture": "metal-3", "device": "", "description": "", "isFallbackAdapter": false, "subgroupMinSize": 32, "subgroupMaxSize": 32}; dispositivo True  |
| Teste de computação WebGPU | 1048576 floats, 5.7 ms, 0 divergências; `shader-f16`: True (compilação: []) |
| WebGL | ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version) (WebGL 1.0 (OpenGL ES 2.0 Chromium)) |
| Armazenamento | quota 10,737 MB; OPFS True; IndexedDB True |
| APIs presentes | LanguageModel, Summarizer, Translator, LanguageDetector, navigator.gpu, wakeLock, caches, serviceWorker, Worker, OffscreenCanvas, Atomics.waitAsync, Float16Array, CompressionStream, WebTransport, VideoDecoder (WebCodecs), requestIdleCallback, scheduler.postTask, performance.memory |
| Resolução de `performance.now()` | 0.09999996423721313 ms |

## Etapas

| Etapa | Estado | Processo | Tentativas | Início | Fim | Nota | Tentativas anteriores |
|---|---|---:|---:|---|---|---|---|
| `sonda` | posted (environment-probe) | 0 | 1 | 2026-11-23T22:58:33.429Z | 2026-11-23T22:58:34.815Z | — | — |
| `ambiente` | ok | 0 | 1 | 2026-11-23T22:58:34.818Z | 2026-11-23T22:58:34.974Z | — | — |
| `vagas-ort` | posted (completou) | 0 | 1 | 2026-11-23T22:58:34.975Z | 2026-11-23T22:59:46.380Z | ort: 16 memória(s) (o máximo testado, sem erro) | — |
| `vagas-ort-navegacao` | posted (completou) | 0 | 1 | 2026-11-23T22:59:46.383Z | 2026-11-23T22:59:57.761Z | depois da navegação: 16 memória(s) ort; 10 s e pressão depois: 16 | — |
| `gpu-rampa` | posted (completou) | 0 | 1 | 2026-11-23T22:59:57.765Z | 2026-11-23T22:59:59.637Z | chegou ao teto de 3072 MiB de GPU sem falhar | — |
| `vagas-naocompart` | posted (completou) | 1 | 1 | 2026-11-23T23:00:20.327Z | 2026-11-23T23:00:21.691Z | naoCompart: 16 memória(s) (o máximo testado, sem erro) | — |
| `gpu-rampa-ab256` | posted (completou) | 0 | 1 | 2026-11-23T22:59:59.641Z | 2026-11-23T23:00:01.497Z | chegou ao teto de 3072 MiB de GPU depois de 256 MiB num ArrayBuffer sem falhar — adiantada antes de `vagas-naocompart` para ganhar um processo novo | — |
| `vagas-max1g` | posted (completou) | 2 | 1 | 2026-11-23T23:00:28.862Z | 2026-11-23T23:00:30.250Z | max1g: 16 memória(s) (o máximo testado, sem erro) | — |
| `host-rampa` | posted (completou) | 0 | 1 | 2026-11-23T23:00:01.499Z | 2026-11-23T23:00:02.881Z | chegou ao teto de 2048 MiB de ArrayBuffer sem falhar — adiantada antes de `vagas-naocompart` para ganhar um processo novo | — |
| `gpu-rampa-wasm256` | posted (completou) | 3 | 1 | 2026-11-23T23:00:32.458Z | 2026-11-23T23:00:34.337Z | chegou ao teto de 3072 MiB de GPU depois de 256 MiB numa memória Wasm sem falhar | — |
| `vagas-minima` | posted (completou) | 4 | 1 | 2026-11-23T23:00:38.541Z | 2026-11-23T23:00:39.950Z | minima: 16 memória(s) (o máximo testado, sem erro) | — |
| `opfs-monolitico` | posted (completou) | 0 | 1 | 2026-11-23T23:00:02.885Z | 2026-11-23T23:00:14.753Z | sobreviveu: 512 MiB: leitura inteira 2347.5 MB/s, envio 3234.2 MB/s, ponta a ponta 1360.2 MB/s · 1024 MiB: leitura inteira 2229.5 MB/s, envio 4053.4 MB/s, ponta a ponta 1438.4 MB/s — adiantada antes de `vagas-naocompart` para ganhar um processo novo | — |
| `vagas-shim` | posted (completou) | 5 | 1 | 2026-11-23T23:00:47.737Z | 2026-11-23T23:00:49.215Z | shim: 16 memória(s) (o máximo testado, sem erro) | — |
| `opfs-streaming` | posted (completou) | 5 | 1 | 2026-11-23T23:00:49.218Z | 2026-11-23T23:01:12.586Z | 512 MiB: escrita 51.1 MB/s (FileSystemSyncAccessHandle.write); anel 3859.6/4214.1/4224 MB/s por passada; placas 3965.1 MB/s ponta a ponta · 1024 MiB: escrita 109.2 MB/s (FileSystemSyncAccessHandle.write); anel 4070.3/4118.7/4249.1 MB/s por passada; placas 3947.6 MB/s ponta a ponta | — |
| `gpu-escrita` | posted (completou) | 0 | 1 | 2026-11-23T23:00:14.770Z | 2026-11-23T23:00:16.632Z | com espera 5716 MB/s; sem espera 2048 MiB enfileirados a 6611.7 MB/s, drenados em 4 ms; sem perda do dispositivo — adiantada antes de `vagas-naocompart` para ganhar um processo novo | — |
| `ort-webgpu-q8emb32-f16-17m` | posted (completou) | 6 | 1 | 2026-11-23T23:01:16.506Z | 2026-11-23T23:01:26.493Z | — | — |
| `ort-wasm-q8emb32-f16-17m` | posted (completou) | 7 | 1 | 2026-11-23T23:01:29.006Z | 2026-11-23T23:01:47.145Z | — | — |
| `ort-webgpu-q8emb32-f16-17m-apos-wasm` | posted (completou) | 7 | 1 | 2026-11-23T23:01:47.150Z | 2026-11-23T23:01:54.731Z | — | — |
| `jh-webgpu-f32-17m` | posted (completou) | 7 | 1 | 2026-11-23T23:01:54.734Z | 2026-11-23T23:02:09.228Z | — | — |

## Página de teste

A latência é a do aparelho. Os pesos ficam em cache entre as etapas da sessão (`cache=1`), então o tempo até a primeira resposta não é o de uma primeira visita.

| Execução | Motor | Variante | Modelo | Estado | 1ª resposta (ms) | 1ª passada p50 (ms) | Quente p50 / p95 / p99 (ms) | Quente p50 / p95: ≤ 128 tokens · > 128 (ms) | 1ª visita (MB) | Heap JS máx. (MB) | Memória máx. (MB; PSS no Android, RSS no simulador iOS) | máx. \|Δp\| · top-1 | Falha |
|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| `2026-11-23-desktop-1958-ort-webgpu-q8emb32-f16-17m` | ort-webgpu | q8emb32-f16 | ts-ettin-17m | ok | 3,281 | 22.5 | 20.3 / 80.1 / 122.5 | 20.1 / 30.7 · 85.5 / 129.3 | 28.22 | 42.7 | — | 4.8e-02 · 153/156 | — |
| `2026-11-23-desktop-1958-ort-wasm-q8emb32-f16-17m` | ort-wasm | q8emb32-f16 | ts-ettin-17m | ok | 567 | 48.8 | 47.3 / 363.7 / 531.4 | 47.2 / 101.1 · 369.1 / 598.6 | 26.34 | 41.8 | — | 8.9e-03 · 155/156 | — |
| `2026-11-23-desktop-1958-ort-webgpu-q8emb32-f16-17m-apos-wasm` | ort-webgpu | q8emb32-f16 | ts-ettin-17m | ok | 597 | 23.6 | 21.3 / 79.7 / 115.7 | 20.9 / 30.9 · 90.8 / 134.4 | 28.22 | 55.8 | — | 4.8e-02 · 153/156 | — |
| `2026-11-23-desktop-1958-jh-webgpu-f32-17m` | jh-webgpu | f32 | ts-ettin-17m | ok | 11,645 | 6.2 | 5.7 / 25.0 / 35.7 | 5.6 / 9.4 · 26.5 / 40.5 | 68.11 | 57.7 | — | 1.9e-06 · 156/156 | — |

**Paridade e forma**

| Execução | Variante | Contra a referência | Tolerância da variante | Contra o nativo (mesmo arquivo) | Forma |
|---|---|---|---|---|---|
| `ort-webgpu-q8emb32-f16-17m` | q8emb32-f16 | 4.8e-02 · 153/156 | não cumpre (8 bits: Δp ≤ 0,03 e ≥ 99%) | 4.9e-02 · 154/156 | igual |
| `ort-wasm-q8emb32-f16-17m` | q8emb32-f16 | 8.9e-03 · 155/156 | cumpre (8 bits: Δp ≤ 0,03 e ≥ 99%) | 1.6e-06 · 156/156 | igual |
| `ort-webgpu-q8emb32-f16-17m-apos-wasm` | q8emb32-f16 | 4.8e-02 · 153/156 | não cumpre (8 bits: Δp ≤ 0,03 e ≥ 99%) | 4.9e-02 · 154/156 | igual |
| `jh-webgpu-f32-17m` | f32 | 1.9e-06 · 156/156 | cumpre (FP32/FP16: Δp ≤ 1e-3) | — | igual |

## Critérios do portão GT neste aparelho (17M)

| Execução | Acerta igual? | Primeira visita até 25 MB? | p95 quente até 150 ms (iPhone e Android intermediário) **[ALVO]**? | 200 decisões sem falha? |
|---|---|---|---|---|
| `ort-webgpu-q8emb32-f16-17m` | não cumpre (8 bits: Δp ≤ 0,03 e ≥ 99%) | 28.22 MB — não | 80.1 ms — sim | — |
| `ort-wasm-q8emb32-f16-17m` | cumpre (8 bits: Δp ≤ 0,03 e ≥ 99%) | 26.34 MB — não | 363.7 ms — não | — |
| `ort-webgpu-q8emb32-f16-17m-apos-wasm` | não cumpre (8 bits: Δp ≤ 0,03 e ≥ 99%) | 28.22 MB — não | 79.7 ms — sim | — |
| `jh-webgpu-f32-17m` | cumpre (FP32/FP16: Δp ≤ 1e-3) | 68.11 MB — não | 25.0 ms — sim | — |

## Memória (perfil `memoria`, C-01)

Cada número vem do arquivo citado **[MEDIDO]**, no aparelho e no navegador da sessão. “Morreu” é a aba derrubada pelo sistema (o laboratório viu a recarga, ou a etapa voltou sem resultado); o ponto de queda é o último marcador gravado **antes** do passo que a derrubou.

### Processos do navegador (épocas)

Uma época é um processo do navegador que o laboratório sabe ser novo: o início, cada queda (o Safari recarrega a aba num processo novo) e cada reinício pedido. Reinícios pedidos nesta sessão: **7**.

| Processo | Início | Motivo | Etapas, em ordem |
|---:|---|---|---|
| 0 | 2026-11-23T22:58:33.428Z | início: navegador aberto pelo executor | `sonda`, `ambiente`, `vagas-ort`, `vagas-ort-navegacao`, `gpu-rampa`, `gpu-rampa-ab256`, `host-rampa`, `opfs-monolitico`, `gpu-escrita` |
| 1 | 2026-11-23T23:00:20.311Z | reinício: o executor fechou e reabriu o navegador | `vagas-naocompart` |
| 2 | 2026-11-23T23:00:28.841Z | reinício: o executor fechou e reabriu o navegador | `vagas-max1g` |
| 3 | 2026-11-23T23:00:32.413Z | reinício: o executor fechou e reabriu o navegador | `gpu-rampa-wasm256` |
| 4 | 2026-11-23T23:00:38.461Z | reinício: o executor fechou e reabriu o navegador | `vagas-minima` |
| 5 | 2026-11-23T23:00:47.668Z | reinício: o executor fechou e reabriu o navegador | `vagas-shim`, `opfs-streaming` |
| 6 | 2026-11-23T23:01:16.477Z | reinício: o executor fechou e reabriu o navegador | `ort-webgpu-q8emb32-f16-17m` |
| 7 | 2026-11-23T23:01:28.988Z | reinício: o executor fechou e reabriu o navegador | `ort-wasm-q8emb32-f16-17m`, `ort-webgpu-q8emb32-f16-17m-apos-wasm`, `jh-webgpu-f32-17m` |

### Experimentos

| Etapa | Processo | Desfecho | Maior alocação que funcionou | Onde parou | Erro (literal) | Teto | Pico GPU · Wasm (livro-caixa) | Arquivo |
|---|---:|---|---:|---|---|---|---|---|
| `vagas-ort` | 0 | **completou** | — | — | — | — | 0.0 MiB · 256.0 MiB | `2026-11-23-desktop-1958-vagas-ort.json` |
| `vagas-ort-navegacao` | 0 | **completou** | — | — | — | — | 0.0 MiB · 256.0 MiB | `2026-11-23-desktop-1958-vagas-ort-navegacao.json` |
| `gpu-rampa` | 0 | **completou** | ≥ 3,072 MiB | — | — | 3,072 MiB | 3,072.0 MiB · 0.0 MiB | `2026-11-23-desktop-1958-gpu-rampa.json` |
| `vagas-naocompart` | 1 | **completou** | — | — | — | — | 0.0 MiB · 320.0 MiB | `2026-11-23-desktop-1958-vagas-naocompart.json` |
| `gpu-rampa-ab256` | 0 | **completou** | ≥ 3,072 MiB | — | — | 3,072 MiB | 3,072.0 MiB · 0.0 MiB | `2026-11-23-desktop-1958-gpu-rampa-ab256.json` |
| `vagas-max1g` | 2 | **completou** | — | — | — | — | 0.0 MiB · 320.0 MiB | `2026-11-23-desktop-1958-vagas-max1g.json` |
| `host-rampa` | 0 | **completou** | ≥ 2,048 MiB | — | — | 2,048 MiB | 0.0 MiB · 0.0 MiB | `2026-11-23-desktop-1958-host-rampa.json` |
| `gpu-rampa-wasm256` | 3 | **completou** | ≥ 3,072 MiB | — | — | 3,072 MiB | 3,072.0 MiB · 256.0 MiB | `2026-11-23-desktop-1958-gpu-rampa-wasm256.json` |
| `vagas-minima` | 4 | **completou** | — | — | — | — | 0.0 MiB · 65.0 MiB | `2026-11-23-desktop-1958-vagas-minima.json` |
| `opfs-monolitico` | 0 | **completou** | — | — | — | — | 1,024.0 MiB · 0.0 MiB | `2026-11-23-desktop-1958-opfs-monolitico.json` |
| `vagas-shim` | 5 | **completou** | — | — | — | — | 0.0 MiB · 64.0 MiB | `2026-11-23-desktop-1958-vagas-shim.json` |
| `opfs-streaming` | 5 | **completou** | — | — | — | — | 1,024.5 MiB · 0.0 MiB | `2026-11-23-desktop-1958-opfs-streaming.json` |
| `gpu-escrita` | 0 | **completou** | — | — | — | 2,048 MiB | 256.0 MiB · 0.0 MiB | `2026-11-23-desktop-1958-gpu-escrita.json` |

**Resumo de cada etapa** (o `resumo` que a página gravou):

- `vagas-ort` — ort: 16 memória(s) (o máximo testado, sem erro)
- `vagas-ort-navegacao` — depois da navegação: 16 memória(s) ort; 10 s e pressão depois: 16
- `gpu-rampa` — chegou ao teto de 3072 MiB de GPU sem falhar
- `vagas-naocompart` — naoCompart: 16 memória(s) (o máximo testado, sem erro)
- `gpu-rampa-ab256` — chegou ao teto de 3072 MiB de GPU depois de 256 MiB num ArrayBuffer sem falhar
- `vagas-max1g` — max1g: 16 memória(s) (o máximo testado, sem erro)
- `host-rampa` — chegou ao teto de 2048 MiB de ArrayBuffer sem falhar
- `gpu-rampa-wasm256` — chegou ao teto de 3072 MiB de GPU depois de 256 MiB numa memória Wasm sem falhar
- `vagas-minima` — minima: 16 memória(s) (o máximo testado, sem erro)
- `opfs-monolitico` — sobreviveu: 512 MiB: leitura inteira 2347.5 MB/s, envio 3234.2 MB/s, ponta a ponta 1360.2 MB/s · 1024 MiB: leitura inteira 2229.5 MB/s, envio 4053.4 MB/s, ponta a ponta 1438.4 MB/s
- `vagas-shim` — shim: 16 memória(s) (o máximo testado, sem erro)
- `opfs-streaming` — 512 MiB: escrita 51.1 MB/s (FileSystemSyncAccessHandle.write); anel 3859.6/4214.1/4224 MB/s por passada; placas 3965.1 MB/s ponta a ponta · 1024 MiB: escrita 109.2 MB/s (FileSystemSyncAccessHandle.write); anel 4070.3/4118.7/4249.1 MB/s por passada; placas 3947.6 MB/s ponta a ponta
- `gpu-escrita` — com espera 5716 MB/s; sem espera 2048 MiB enfileirados a 6611.7 MB/s, drenados em 4 ms; sem perda do dispositivo

### Vagas de memória Wasm (X1, X2)

| Etapa | Descritor | Processo (antes nele) | Memórias criadas | Erro da seguinte (literal) | `ort` com estas presas | Arquivo |
|---|---|---|---:|---|---|---|
| `vagas-ort` | `{"initial": 256, "maximum": 65536, "shared": true}` | 0 (sonda, ambiente) | 16 | — | — | `2026-11-23-desktop-1958-vagas-ort.json` |
| `vagas-ort-navegacao` | `{"initial": 256, "maximum": 65536, "shared": true}` | 0 (sonda, ambiente, vagas-ort) | 16 | — | — | `2026-11-23-desktop-1958-vagas-ort-navegacao.json` |
| `vagas-naocompart` | `{"initial": 256, "maximum": 65536}` | 1 (nada) | 16 | — | 4 | `2026-11-23-desktop-1958-vagas-naocompart.json` |
| `vagas-max1g` | `{"initial": 256, "maximum": 16384, "shared": true}` | 2 (nada) | 16 | — | 4 | `2026-11-23-desktop-1958-vagas-max1g.json` |
| `vagas-minima` | `{"initial": 1, "maximum": 1}` | 4 (nada) | 16 | — | 4 | `2026-11-23-desktop-1958-vagas-minima.json` |
| `vagas-shim` | `{"initial": 0, "maximum": 0, "shared": true}` | 5 (nada) | 16 | — | 4 | `2026-11-23-desktop-1958-vagas-shim.json` |

**Liberação depois de esgotar as vagas `ort`** (`2026-11-23-desktop-1958-vagas-ort.json`):

| Quando | Memórias `ort` criadas | Erro | Coletadas pelo GC (livro-caixa) |
|---|---:|---|---:|
| 1 s depois de soltar as referências e pressionar o coletor | 16 | — | 16 |
| 10 s depois de soltar as referências e pressionar o coletor | 16 | — | 32 |
| 60 s depois de soltar as referências e pressionar o coletor | 16 | — | 48 |
| num Worker dedicado | 16 | — | — |
| na página, 0 s depois de `terminate()` | 16 | — | 64 |
| na página, 1 s depois de `terminate()` | 16 | — | 80 |
| na página, 10 s depois de `terminate()` | 16 | — | 96 |

**Depois da navegação** (`2026-11-23-desktop-1958-vagas-ort-navegacao.json`): 16 memória(s) `ort` logo ao chegar; 16 depois de 10 s e pressão no coletor.

### Processo de GPU e `writeBuffer` em voo (`2026-11-23-desktop-1958-gpu-escrita.json`)

| Fase | Volume | Vazão | Detalhe | Perda do dispositivo |
|---|---:|---:|---|---|
| com espera a cada 64 MiB | 2,048 MiB | 5,716 MB/s | grupo de 64 MiB p50 11.2 ms | — |
| sem espera | 2,048 MiB | enfileirar 6,612 MB/s · efetiva 6,527 MB/s | drenagem 4 ms | — |

### Streaming do OPFS para a GPU (X5) (`2026-11-23-desktop-1958-opfs-streaming.json`)

`createSyncAccessHandle` no Worker: **True**; `createWritable`: True; kernel confere: True.

| Arquivo | Fase | Caminho | Leitura do OPFS | Envio à GPU | Ponta a ponta | Grupo de 64 MiB p50 · máx. |
|---|---|---|---:|---:|---:|---|
| 512MiB | escrita | FileSystemSyncAccessHandle.write (Worker) | — | — | 51 MB/s | — |
| 512MiB | anel 3 × 64 MiB, passada 1 (kernel ok) | FileSystemSyncAccessHandle.read (Worker) | 4,565 MB/s | 10,404 MB/s | 3,860 MB/s | 16.1 · 25 ms |
| 512MiB | anel 3 × 64 MiB, passada 2 (kernel ok) | FileSystemSyncAccessHandle.read (Worker) | 5,041 MB/s | 10,759 MB/s | 4,214 MB/s | 15.8 · 18 ms |
| 512MiB | anel 3 × 64 MiB, passada 3 (kernel ok) | FileSystemSyncAccessHandle.read (Worker) | 4,854 MB/s | 12,662 MB/s | 4,224 MB/s | 15.8 · 17.6 ms |
| 512MiB | 2 placa(s) de 256 MiB, residentes | FileSystemSyncAccessHandle.read (Worker) | 4,608 MB/s | 11,447 MB/s | 3,965 MB/s | 14.6 · 25.1 ms |
| 1024MiB | escrita | FileSystemSyncAccessHandle.write (Worker) | — | — | 109 MB/s | — |
| 1024MiB | anel 3 × 64 MiB, passada 1 (kernel ok) | FileSystemSyncAccessHandle.read (Worker) | 4,802 MB/s | 10,835 MB/s | 4,070 MB/s | 15.7 · 24.2 ms |
| 1024MiB | anel 3 × 64 MiB, passada 2 (kernel ok) | FileSystemSyncAccessHandle.read (Worker) | 4,728 MB/s | 11,070 MB/s | 4,119 MB/s | 16.1 · 18.4 ms |
| 1024MiB | anel 3 × 64 MiB, passada 3 (kernel ok) | FileSystemSyncAccessHandle.read (Worker) | 4,969 MB/s | 11,138 MB/s | 4,249 MB/s | 15.7 · 17.9 ms |
| 1024MiB | 4 placa(s) de 256 MiB, residentes | FileSystemSyncAccessHandle.read (Worker) | 4,630 MB/s | 10,857 MB/s | 3,948 MB/s | 14.8 · 26 ms |

### Caminho monolítico de hoje (arquivo inteiro num Uint8Array) (`2026-11-23-desktop-1958-opfs-monolitico.json`)

| Arquivo | Leitura inteira (engines/fetch.js) | Envio à GPU (placas de 256 MiB) | Ponta a ponta |
|---|---:|---:|---:|
| 512MiB | 2,348 MB/s | 3,234 MB/s | 1,360 MB/s |
| 1024MiB | 2,230 MB/s | 4,053 MB/s | 1,438 MB/s |

### Livro-caixa das páginas de teste (X4)

GPU = bytes de buffers e texturas criados e não destruídos nem coletados, por `lab/hook.js`; Wasm = bytes das memórias Wasm vivas.

| Etapa | Processo | Desfecho | Decisões | GPU vivo: 1ª → última decisão | Pico GPU | Dispositivos | Wasm vivo (pico) | `dispose()` | GPU depois do dispose | Arquivo |
|---|---:|---|---:|---|---:|---:|---|---|---:|---|
| `ort-webgpu-q8emb32-f16-17m` | 6 | completou | 189 | 23.24 → 201.75 MiB | 216.9 MiB | 3 | 96.0 MiB (96.0 MiB) | ok 4 ms | 0.0 MiB | `2026-11-23-desktop-1958-ort-webgpu-q8emb32-f16-17m.json` |
| `ort-wasm-q8emb32-f16-17m` | 7 | completou | 189 | 0 → 0 MiB | 0.0 MiB | 2 | 194.8 MiB (194.8 MiB) | ok 2 ms | 0.0 MiB | `2026-11-23-desktop-1958-ort-wasm-q8emb32-f16-17m.json` |
| `ort-webgpu-q8emb32-f16-17m-apos-wasm` | 7 | completou | 189 | 23.24 → 201.75 MiB | 216.9 MiB | 3 | 96.0 MiB (96.0 MiB) | ok 4 ms | 0.0 MiB | `2026-11-23-desktop-1958-ort-webgpu-q8emb32-f16-17m-apos-wasm.json` |
| `jh-webgpu-f32-17m` | 7 | completou | 189 | 75.45 → 189 MiB | 189.0 MiB | 3 | 0.0 MiB (0.0 MiB) | ok 0 ms | 0.0 MiB | `2026-11-23-desktop-1958-jh-webgpu-f32-17m.json` |

### Memória dos processos do navegador (`2026-11-23-desktop-1958-desktop.json`)

Chrome/158.0.8127.38; 7 reinício(s) do navegador pedidos pelo laboratório. Método: RSS (ps) of the browser process started by the runner and of every process under it, every 500 ms, bytes, keyed <kind>#<pid> (kind from Chrome's --type= switch); phys_footprint and phys_footprint_peak (footprint(1)) of the browser, GPU and renderer processes, every 1000 ms — GPU memory a process owns counts in its footprint, not in its RSS.

| Etapa | RSS GPU | RSS renderer | footprint GPU | footprint renderer |
|---|---:|---:|---:|---:|
| `sonda` | 112 MiB | 575 MiB | 76 MiB | 45 MiB |
| `vagas-ort` | 105 MiB | 758 MiB | 95 MiB | 52 MiB |
| `vagas-ort-navegacao` | 105 MiB | 348 MiB | 59 MiB | 37 MiB |
| `gpu-rampa` | 297 MiB | 677 MiB | 401 MiB | 107 MiB |
| `gpu-rampa-ab256` | 281 MiB | 2,407 MiB | 673 MiB | 364 MiB |
| `host-rampa` | 105 MiB | 2,407 MiB | 60 MiB | 2,095 MiB |
| `opfs-monolitico` | 617 MiB | 2,689 MiB | 812 MiB | 2,370 MiB |
| `gpu-escrita` | 462 MiB | 2,758 MiB | 411 MiB | 2,437 MiB |
| `vagas-naocompart` | 100 MiB | 421 MiB | 60 MiB | 46 MiB |
| `vagas-max1g` | 98 MiB | 334 MiB | 61 MiB | 47 MiB |
| `gpu-rampa-wasm256` | 236 MiB | 662 MiB | 126 MiB | 360 MiB |
| `vagas-minima` | 93 MiB | 333 MiB | 61 MiB | 46 MiB |
| `vagas-shim` | 91 MiB | 338 MiB | 59 MiB | 46 MiB |
| `opfs-streaming` | 157 MiB | 428 MiB | 609 MiB | 120 MiB |
| `ort-webgpu-q8emb32-f16-17m` | 253 MiB | 1,094 MiB | 409 MiB | 504 MiB |
| `ort-wasm-q8emb32-f16-17m` | 96 MiB | 799 MiB | 64 MiB | 348 MiB |
| `ort-webgpu-q8emb32-f16-17m-apos-wasm` | 211 MiB | 1,719 MiB | 385 MiB | 1,310 MiB |
| `jh-webgpu-f32-17m` | 237 MiB | 1,690 MiB | 341 MiB | 468 MiB |

Pico de toda a sessão: RSS GPU 617 MiB, renderer 2,758 MiB; `phys_footprint_peak` GPU 3,262 MiB, renderer 2,437 MiB.

### Faixas para a `C-08`

Aparelho: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36`; adaptador WebGPU: apple metal-3.

| Medida | Valor | Arquivo |
|---|---:|---|
| Maior total de GPU que funcionou (rampa simples) | ≥ 3,072 MiB **[MEDIDO]** | `2026-11-23-desktop-1958-gpu-rampa.json` |
| … depois de 256 MiB num ArrayBuffer | ≥ 3,072 MiB **[MEDIDO]** | `2026-11-23-desktop-1958-gpu-rampa-ab256.json` |
| … depois de 256 MiB numa memória Wasm | ≥ 3,072 MiB **[MEDIDO]** | `2026-11-23-desktop-1958-gpu-rampa-wasm256.json` |
| Maior total de ArrayBuffer que funcionou | ≥ 2,048 MiB **[MEDIDO]** | `2026-11-23-desktop-1958-host-rampa.json` |
| Streaming OPFS → GPU, anel de 3 × 64 MiB, última passada | 1024MiB: 4249.1 MB/s por passada **[MEDIDO]** | `2026-11-23-desktop-1958-opfs-streaming.json` |
| Faixa candidata de pesos + ativações residentes | 1,024 MiB **[HIPÓTESE: 50% do menor máximo medido; a regra é desta tabela, a decisão é da C-08]** | — |

Uma rampa que chegou ao teto do teste (desktop) mede só um piso: o limite real é maior.

## Logs

3312 entradas. Por tipo e nível: `trace`/info 1520; `marker`/info 1321; `lifecycle`/info 168; `console`/info 115; `webgpu`/info 75; `ledger`/info 48; `performance`/info 36; `lab`/info 18; `console`/warn 7; `console`/error 4.

**WebGPU** (eventos distintos):

- `2026-11-23-desktop-1958-sonda` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `2026-11-23-desktop-1958-sonda` — info: requestDevice → ok (device 1); features: core-features-and-limits
- `2026-11-23-desktop-1958-sonda` — info: device lost: destroyed Device was destroyed.
- `2026-11-23-desktop-1958-sonda` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `2026-11-23-desktop-1958-sonda` — info: requestDevice → ok (device 2); features: core-features-and-limits
- `lab.html` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `lab.html` — info: requestDevice → ok (device 1); features: core-features-and-limits
- `lab.html` — info: device lost: destroyed Device was destroyed.
- `lab.html` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `lab.html` — info: requestDevice → ok (device 2); features: core-features-and-limits
- `lab.html` — info: requestAdapter({}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `lab.html` — info: requestDevice → ok (device 3); features: core-features-and-limits, shader-f16
- `2026-11-23-desktop-1958-vagas-ort` — info: requestAdapter({}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `2026-11-23-desktop-1958-vagas-ort-navegacao` — info: requestAdapter({}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `2026-11-23-desktop-1958-gpu-rampa` — info: requestAdapter({}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `2026-11-23-desktop-1958-gpu-rampa` — info: requestDevice → ok (device 1); features: core-features-and-limits
- `2026-11-23-desktop-1958-gpu-rampa` — info: device lost: destroyed Device was destroyed.
- `2026-11-23-desktop-1958-gpu-rampa-ab256` — info: requestAdapter({}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `2026-11-23-desktop-1958-gpu-rampa-ab256` — info: requestDevice → ok (device 1); features: core-features-and-limits
- `2026-11-23-desktop-1958-gpu-rampa-ab256` — info: device lost: destroyed Device was destroyed.
- `2026-11-23-desktop-1958-host-rampa` — info: requestAdapter({}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `2026-11-23-desktop-1958-opfs-monolitico` — info: requestAdapter({}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `2026-11-23-desktop-1958-opfs-monolitico` — info: requestDevice → ok (device 1); features: core-features-and-limits
- `2026-11-23-desktop-1958-opfs-monolitico` — info: device lost: destroyed Device was destroyed.
- `2026-11-23-desktop-1958-gpu-escrita` — info: requestAdapter({}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `2026-11-23-desktop-1958-gpu-escrita` — info: requestDevice → ok (device 1); features: core-features-and-limits
- `2026-11-23-desktop-1958-gpu-escrita` — info: device lost: destroyed Device was destroyed.
- `2026-11-23-desktop-1958-vagas-naocompart` — info: requestAdapter({}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `2026-11-23-desktop-1958-vagas-max1g` — info: requestAdapter({}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `2026-11-23-desktop-1958-gpu-rampa-wasm256` — info: requestAdapter({}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `2026-11-23-desktop-1958-gpu-rampa-wasm256` — info: requestDevice → ok (device 1); features: core-features-and-limits
- `2026-11-23-desktop-1958-gpu-rampa-wasm256` — info: device lost: destroyed Device was destroyed.
- `2026-11-23-desktop-1958-vagas-minima` — info: requestAdapter({}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `2026-11-23-desktop-1958-vagas-shim` — info: requestAdapter({}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `2026-11-23-desktop-1958-opfs-streaming` — info: requestAdapter({}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `2026-11-23-desktop-1958-opfs-streaming` — info: requestDevice → ok (device 1); features: core-features-and-limits
- `2026-11-23-desktop-1958-opfs-streaming` — info: device lost: destroyed Device was destroyed.
- `2026-11-23-desktop-1958-ort-webgpu-q8emb32-f16-17m` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `2026-11-23-desktop-1958-ort-webgpu-q8emb32-f16-17m` — info: requestDevice → ok (device 1); features: core-features-and-limits
- `2026-11-23-desktop-1958-ort-webgpu-q8emb32-f16-17m` — info: device lost: destroyed Device was destroyed.
- `2026-11-23-desktop-1958-ort-webgpu-q8emb32-f16-17m` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `2026-11-23-desktop-1958-ort-webgpu-q8emb32-f16-17m` — info: requestDevice → ok (device 2); features: core-features-and-limits
- `2026-11-23-desktop-1958-ort-webgpu-q8emb32-f16-17m` — info: requestAdapter({}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `2026-11-23-desktop-1958-ort-webgpu-q8emb32-f16-17m` — info: requestAdapter({"powerPreference":"high-performance","forceFallbackAdapter":false}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `2026-11-23-desktop-1958-ort-webgpu-q8emb32-f16-17m` — info: requestDevice → ok (device 3); features: core-features-and-limits, shader-f16, subgroup-size-control, subgroups, timestamp-query
- `2026-11-23-desktop-1958-ort-wasm-q8emb32-f16-17m` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `2026-11-23-desktop-1958-ort-wasm-q8emb32-f16-17m` — info: requestDevice → ok (device 1); features: core-features-and-limits
- `2026-11-23-desktop-1958-ort-wasm-q8emb32-f16-17m` — info: device lost: destroyed Device was destroyed.
- `2026-11-23-desktop-1958-ort-wasm-q8emb32-f16-17m` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `2026-11-23-desktop-1958-ort-wasm-q8emb32-f16-17m` — info: requestDevice → ok (device 2); features: core-features-and-limits
- `2026-11-23-desktop-1958-ort-webgpu-q8emb32-f16-17m-apos-wasm` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `2026-11-23-desktop-1958-ort-webgpu-q8emb32-f16-17m-apos-wasm` — info: requestDevice → ok (device 1); features: core-features-and-limits
- `2026-11-23-desktop-1958-ort-webgpu-q8emb32-f16-17m-apos-wasm` — info: device lost: destroyed Device was destroyed.
- `2026-11-23-desktop-1958-ort-webgpu-q8emb32-f16-17m-apos-wasm` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `2026-11-23-desktop-1958-ort-webgpu-q8emb32-f16-17m-apos-wasm` — info: requestDevice → ok (device 2); features: core-features-and-limits
- `2026-11-23-desktop-1958-ort-webgpu-q8emb32-f16-17m-apos-wasm` — info: requestAdapter({}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `2026-11-23-desktop-1958-ort-webgpu-q8emb32-f16-17m-apos-wasm` — info: requestAdapter({"powerPreference":"high-performance","forceFallbackAdapter":false}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `2026-11-23-desktop-1958-ort-webgpu-q8emb32-f16-17m-apos-wasm` — info: requestDevice → ok (device 3); features: core-features-and-limits, shader-f16, subgroup-size-control, subgroups, timestamp-query
- `2026-11-23-desktop-1958-jh-webgpu-f32-17m` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `2026-11-23-desktop-1958-jh-webgpu-f32-17m` — info: requestDevice → ok (device 1); features: core-features-and-limits
- `2026-11-23-desktop-1958-jh-webgpu-f32-17m` — info: device lost: destroyed Device was destroyed.
- `2026-11-23-desktop-1958-jh-webgpu-f32-17m` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `2026-11-23-desktop-1958-jh-webgpu-f32-17m` — info: requestDevice → ok (device 2); features: core-features-and-limits
- `2026-11-23-desktop-1958-jh-webgpu-f32-17m` — info: requestDevice → ok (device 3); features: core-features-and-limits, subgroups

**Ciclo de vida:** a página ficou oculta 1 vez(es) — as medições dessas etapas podem ter sido estranguladas pelo navegador.
- 2026-11-23T23:01:13.434Z em `lab.html`

**Avisos** (os mais frequentes): “[W:onnxruntime:, session_state.cc:1598 VerifyEachNodeIsAssignedToAnEp] Some nodes were not assigned to the preferred execution providers which may or may not have an negative impact on performance. e.” ×2; “[W:onnxruntime:, session_state.cc:1600 VerifyEachNodeIsAssignedToAnEp] Rerunning with verbose output on a non-minimal build will show node assignments.” ×2; “[lab] browser restart requested before vagas-naocompart: precisa de um processo novo do navegador (neste já rodaram: vagas-ort, vagas-ort-navegacao, gpu-rampa, gpu-rampa-ab256, host-rampa, opfs-monoli” ×1; “[lab] browser restart requested before vagas-max1g: precisa de um processo novo do navegador (neste já rodaram: vagas-naocompart)” ×1; “[lab] browser restart requested before gpu-rampa-wasm256: precisa de um processo novo do navegador (neste já rodaram: vagas-max1g)” ×1; “[lab] browser restart requested before vagas-minima: precisa de um processo novo do navegador (neste já rodaram: gpu-rampa-wasm256)” ×1; “[lab] browser restart requested before vagas-shim: precisa de um processo novo do navegador (neste já rodaram: vagas-minima)” ×1; “[lab] browser restart requested before ort-webgpu-q8emb32-f16-17m: precisa de um processo novo do navegador (neste já rodaram: vagas-shim, opfs-streaming)” ×1

## Rede

389 requisições respondidas; 99.32 MB enviados ao aparelho. As maiores:

| Caminho | Bytes | Tempo (ms) | MB/s |
|---|---:|---:|---:|
| `/models/typestrict/TS-Ettin-17M/026af312e41d24a1126f8d927bb6314fc2d5f592/model.safetensors` | 67,484,624 | 11243 | 6.0 |
| `/models/derived/typestrict/TS-Ettin-17M/026af312e41d24a1126f8d927bb6314fc2d5f592/model_q8e` | 23,368,916 | 1785 | 13.1 |
| `/node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm` | 4,315,487 | 3 | 1438.5 |
| `/node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm` | 2,449,236 | 44 | 55.7 |
| `/models/typestrict/TS-Ettin-17M/026af312e41d24a1126f8d927bb6314fc2d5f592/tokenizer.json` | 483,304 | 2 | 241.7 |
| `/node_modules/@johnhenry/math-plus-tensor-core/dist/index.js` | 19,490 | 1 | 19.5 |
| `/node_modules/@johnhenry/backend-webgpu/dist/kernels.js` | 19,488 | 3 | 6.5 |
| `/node_modules/onnxruntime-web/dist/ort.webgpu.min.mjs` | 19,463 | 0 | — |
| `/node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs` | 16,764 | 1 | 16.8 |
| `/node_modules/onnxruntime-web/dist/ort.wasm.min.mjs` | 15,409 | 1 | 15.4 |

Estados HTTP: {200: 388, 404: 1}.

## Conclusões automáticas

- Etapas: {'posted': 18, 'ok': 1} de 19; a sessão terminou.
- WebGPU no aparelho: **disponível** (apple metal-3); computação correta.
- Rodaram: `ort-webgpu-q8emb32-f16-17m`, `ort-wasm-q8emb32-f16-17m`, `ort-webgpu-q8emb32-f16-17m-apos-wasm`, `jh-webgpu-f32-17m`.

