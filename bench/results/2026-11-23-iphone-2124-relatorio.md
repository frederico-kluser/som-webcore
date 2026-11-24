# Laboratório de aparelho — sessão `2026-11-23-iphone-2124`

> Gerado por `bench/spike-mobile/lab/analyze.py` a partir dos arquivos da sessão em `bench/results/`. Aparelho: **iphone**; perfil `memoria`; modo `local`; início —; fim 2026-11-24T00:45:33.371Z. Tudo **[MEDIDO no aparelho]**; os limites do portão GT são **[ALVO]** do roadmap.

## Aparelho e navegador

| Item | Valor |
|---|---|
| Navegador | `—` |
| Tela | None×None @Nonex; núcleos lógicos None; `deviceMemory` None |
| Contexto seguro | None; isolado (sonda com COOP/COEP): — |
| WebAssembly | SIMD None; SIMD relaxado None; JSPI None; threads None (isolado: —) |
| WebGPU | `navigator.gpu` None; adaptador None {}; dispositivo —  |
| WebGL | — (—) |
| Armazenamento | quota 0 MB; OPFS None; IndexedDB None |
| APIs presentes | — |
| Resolução de `performance.now()` | None ms |

## Etapas

| Etapa | Estado | Processo | Tentativas | Início | Fim | Nota | Tentativas anteriores |
|---|---|---:|---:|---|---|---|---|
| `vagas-shim` | posted (completou) | 0 | 1 | 2026-11-24T00:25:27.355Z | 2026-11-24T00:25:27.676Z | shim: 16 memória(s) (o máximo testado, sem erro) | — |
| `vagas-minima` | posted (completou) | 0 | 1 | 2026-11-24T00:25:27.688Z | 2026-11-24T00:25:27.752Z | minima: 16 memória(s) (o máximo testado, sem erro) | — |
| `vagas-naocompart` | posted (completou) | 0 | 1 | 2026-11-24T00:25:27.761Z | 2026-11-24T00:25:27.823Z | naoCompart: 16 memória(s) (o máximo testado, sem erro) | — |
| `vagas-max1g` | posted (erro) | 0 | 1 | 2026-11-24T00:25:27.834Z | 2026-11-24T00:25:27.875Z | max1g: 3 memória(s); a 4ª deu RangeError: Out of memory | — |
| `opfs-streaming` | posted (completou) | 0 | 1 | 2026-11-24T00:25:27.887Z | 2026-11-24T00:25:35.803Z | 512 MiB: escrita 511.8 MB/s (FileSystemSyncAccessHandle.write); anel 1819.9/3728.3/3214.8 MB/s por passada; placas 2753.2 MB/s ponta a ponta · 1024 MiB: escrita 259.2 MB/s (FileSystemSyncAccessHandle.write); anel 2022.1/2925.7/2982.6 MB/s por passada; placas 2718.3 MB/s ponta a ponta | — |
| `gpu-escrita` | posted (completou) | 0 | 1 | 2026-11-24T00:25:35.822Z | 2026-11-24T00:25:40.255Z | com espera 4600.9 MB/s; sem espera 8192 MiB enfileirados a 3452.5 MB/s, drenados em 0 ms; sem perda do dispositivo | — |
| `gpu-rampa-wasm256` | crashed (morreu) | 0 | 1 | 2026-11-24T00:25:40.266Z | 2026-11-24T00:25:41.251Z | morreu — último marcador: GPU passo 23: 1472 → 1536 MiB | — |
| `opfs-monolitico` | crashed (morreu) | 1 | 1 | 2026-11-24T00:25:44.273Z | 2026-11-24T00:45:30.202Z | morreu — último marcador: monolítico: o arquivo inteiro de 1024 MiB num Uint8Array (engines/fetch.js) | — |

## Critérios do portão GT neste aparelho (17M)

| Execução | Acerta igual? | Primeira visita até 25 MB? | p95 quente até 150 ms (iPhone e Android intermediário) **[ALVO]**? | 200 decisões sem falha? |
|---|---|---|---|---|

## Memória (perfil `memoria`, C-01)

Cada número vem do arquivo citado **[MEDIDO]**, no aparelho e no navegador da sessão. “Morreu” é a aba derrubada pelo sistema (o laboratório viu a recarga, ou a etapa voltou sem resultado); o ponto de queda é o último marcador gravado **antes** do passo que a derrubou.

### Processos do navegador (épocas)

Uma época é um processo do navegador que o laboratório sabe ser novo: o início, cada queda (o Safari recarrega a aba num processo novo) e cada reinício pedido. Reinícios pedidos nesta sessão: **0**.

| Processo | Início | Motivo | Etapas, em ordem |
|---:|---|---|---|
| 0 | 2026-11-24T00:25:27.355Z | início (página única) | `vagas-shim`, `vagas-minima`, `vagas-naocompart`, `vagas-max1g`, `opfs-streaming`, `gpu-escrita`, `gpu-rampa-wasm256` |
| 1 | 2026-11-24T00:25:41.251Z | queda em gpu-rampa-wasm256 | `opfs-monolitico` |
| 2 | 2026-11-24T00:45:30.202Z | queda em opfs-monolitico | — |

### Experimentos

| Etapa | Processo | Desfecho | Maior alocação que funcionou | Onde parou | Erro (literal) | Teto | Pico GPU · Wasm (livro-caixa) | Arquivo |
|---|---:|---|---:|---|---|---|---|---|
| `vagas-shim` | 0 | **completou** | — | — | — | — | 0.0 MiB · 48.0 MiB | `2026-11-23-iphone-2124-vagas-shim.json` |
| `vagas-minima` | 0 | **completou** | — | — | — | — | 0.0 MiB · 49.0 MiB | `2026-11-23-iphone-2124-vagas-minima.json` |
| `vagas-naocompart` | 0 | **completou** | — | — | — | — | 0.0 MiB · 305.0 MiB | `2026-11-23-iphone-2124-vagas-naocompart.json` |
| `vagas-max1g` | 0 | **erro** | — | — | RangeError: Out of memory | — | 0.0 MiB · 353.0 MiB | `2026-11-23-iphone-2124-vagas-max1g.json` |
| `opfs-streaming` | 0 | **completou** | — | — | — | — | 1,024.5 MiB · 353.0 MiB | `2026-11-23-iphone-2124-opfs-streaming.json` |
| `gpu-escrita` | 0 | **completou** | — | — | — | 8,192 MiB | 1,024.5 MiB · 353.0 MiB | `2026-11-23-iphone-2124-gpu-escrita.json` |
| `gpu-rampa-wasm256` | 0 | **morreu** | 1,472 MiB | último marcador: GPU passo 23: 1472 → 1536 MiB | — | sem teto | 1472 MiB (marcador) · 353 MiB (marcador) | `2026-11-23-iphone-2124-gpu-rampa-wasm256.json` |
| `opfs-monolitico` | 1 | **morreu** | — | último marcador: monolítico: o arquivo inteiro de 1024 MiB num Uint8Array (engines/fetch.js) | — | — | 512 MiB (marcador) · 0 MiB (marcador) | `2026-11-23-iphone-2124-opfs-monolitico.json` |

**Resumo de cada etapa** (o `resumo` que a página gravou):

- `vagas-shim` — shim: 16 memória(s) (o máximo testado, sem erro)
- `vagas-minima` — minima: 16 memória(s) (o máximo testado, sem erro)
- `vagas-naocompart` — naoCompart: 16 memória(s) (o máximo testado, sem erro)
- `vagas-max1g` — max1g: 3 memória(s); a 4ª deu RangeError: Out of memory
- `opfs-streaming` — 512 MiB: escrita 511.8 MB/s (FileSystemSyncAccessHandle.write); anel 1819.9/3728.3/3214.8 MB/s por passada; placas 2753.2 MB/s ponta a ponta · 1024 MiB: escrita 259.2 MB/s (FileSystemSyncAccessHandle.write); anel 2022.1/2925.7/2982.6 MB/s por passada; placas 2718.3 MB/s ponta a ponta
- `gpu-escrita` — com espera 4600.9 MB/s; sem espera 8192 MiB enfileirados a 3452.5 MB/s, drenados em 0 ms; sem perda do dispositivo
- `gpu-rampa-wasm256` — morreu — último marcador: GPU passo 23: 1472 → 1536 MiB
- `opfs-monolitico` — morreu — último marcador: monolítico: o arquivo inteiro de 1024 MiB num Uint8Array (engines/fetch.js)

### Vagas de memória Wasm (X1, X2)

| Etapa | Descritor | Processo (antes nele) | Memórias criadas | Erro da seguinte (literal) | `ort` com estas presas | Arquivo |
|---|---|---|---:|---|---|---|
| `vagas-shim` | `{"initial": 0, "maximum": 0, "shared": true}` | 0 (nada) | 16 | — | 3 (RangeError: Out of memory) | `2026-11-23-iphone-2124-vagas-shim.json` |
| `vagas-minima` | `{"initial": 1, "maximum": 1}` | 0 (vagas-shim) | 16 | — | 0 (RangeError: Out of memory) | `2026-11-23-iphone-2124-vagas-minima.json` |
| `vagas-naocompart` | `{"initial": 256, "maximum": 65536}` | 0 (vagas-shim, vagas-minima) | 16 | — | 0 (RangeError: Out of memory) | `2026-11-23-iphone-2124-vagas-naocompart.json` |
| `vagas-max1g` | `{"initial": 256, "maximum": 16384, "shared": true}` | 0 (vagas-shim, vagas-minima, vagas-naocompart) | 3 | RangeError: Out of memory | 0 (RangeError: Out of memory) | `2026-11-23-iphone-2124-vagas-max1g.json` |

### Processo de GPU e `writeBuffer` em voo (`2026-11-23-iphone-2124-gpu-escrita.json`)

| Fase | Volume | Vazão | Detalhe | Perda do dispositivo |
|---|---:|---:|---|---|
| com espera a cada 64 MiB | 8,192 MiB | 4,601 MB/s | grupo de 64 MiB p50 15 ms | — |
| sem espera | 8,192 MiB | enfileirar 3,452 MB/s · efetiva 3,452 MB/s | drenagem 0 ms | — |

### Streaming do OPFS para a GPU (X5) (`2026-11-23-iphone-2124-opfs-streaming.json`)

`createSyncAccessHandle` no Worker: **True**; `createWritable`: True; kernel confere: True.

| Arquivo | Fase | Caminho | Leitura do OPFS | Envio à GPU | Ponta a ponta | Grupo de 64 MiB p50 · máx. |
|---|---|---|---:|---:|---:|---|
| 512MiB | escrita | FileSystemSyncAccessHandle.write (Worker) | — | — | 512 MB/s | — |
| 512MiB | anel 3 × 64 MiB, passada 1 (kernel ok) | FileSystemSyncAccessHandle.read (Worker) | 2,130 MB/s | 5,592 MB/s | 1,820 MB/s | 38 · 63 ms |
| 512MiB | anel 3 × 64 MiB, passada 2 (kernel ok) | FileSystemSyncAccessHandle.read (Worker) | 5,162 MB/s | 5,162 MB/s | 3,728 MB/s | 18 · 20 ms |
| 512MiB | anel 3 × 64 MiB, passada 3 (kernel ok) | FileSystemSyncAccessHandle.read (Worker) | 4,227 MB/s | 4,709 MB/s | 3,215 MB/s | 22 · 23 ms |
| 512MiB | 2 placa(s) de 256 MiB, residentes | FileSystemSyncAccessHandle.read (Worker) | 3,703 MB/s | 4,589 MB/s | 2,753 MB/s | 24 · 30 ms |
| 1024MiB | escrita | FileSystemSyncAccessHandle.write (Worker) | — | — | 259 MB/s | — |
| 1024MiB | anel 3 × 64 MiB, passada 1 (kernel ok) | FileSystemSyncAccessHandle.read (Worker) | 2,260 MB/s | 6,628 MB/s | 2,022 MB/s | 38 · 42 ms |
| 1024MiB | anel 3 × 64 MiB, passada 2 (kernel ok) | FileSystemSyncAccessHandle.read (Worker) | 3,904 MB/s | 4,589 MB/s | 2,926 MB/s | 22 · 43 ms |
| 1024MiB | anel 3 × 64 MiB, passada 3 (kernel ok) | FileSystemSyncAccessHandle.read (Worker) | 4,130 MB/s | 4,098 MB/s | 2,983 MB/s | 22 · 26 ms |
| 1024MiB | 4 placa(s) de 256 MiB, residentes | FileSystemSyncAccessHandle.read (Worker) | 3,567 MB/s | 4,330 MB/s | 2,718 MB/s | 25 · 30 ms |

### Caminho monolítico de hoje (arquivo inteiro num Uint8Array) (`2026-11-23-iphone-2124-opfs-monolitico.json`)

| Arquivo | Leitura inteira (engines/fetch.js) | Envio à GPU (placas de 256 MiB) | Ponta a ponta |
|---|---:|---:|---:|
| 512MiB | 1,500 MB/s | 2,619 MB/s | 954 MB/s |
| 1024MiB | — | — | — |

**A aba morreu** — último marcador: monolítico: o arquivo inteiro de 1024 MiB num Uint8Array (engines/fetch.js).

## Logs

403 entradas. Por tipo e nível: `marker`/info 339; `console`/info 34; `webgpu`/info 14; `lifecycle`/info 6; `wasm`/warn 5; `ledger`/info 5.

**WebGPU** (eventos distintos):

- `memoria-unica.html` — info: requestAdapter({}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `memoria-unica.html` — info: requestDevice → ok (device 1); features: core-features-and-limits
- `memoria-unica.html` — info: device lost: destroyed
- `memoria-unica.html` — info: requestDevice → ok (device 2); features: core-features-and-limits
- `memoria-unica.html` — info: requestDevice → ok (device 3); features: core-features-and-limits

**Ciclo de vida:** a página ficou oculta 0 vez(es).

**Avisos** (os mais frequentes): “new WebAssembly.Memory({"initial":256,"maximum":65536,"shared":true}) threw RangeError: Out of memory” ×4; “new WebAssembly.Memory({"initial":256,"maximum":16384,"shared":true}) threw RangeError: Out of memory” ×1

## Rede

49 requisições respondidas; 0.08 MB enviados ao aparelho. As maiores:

| Caminho | Bytes | Tempo (ms) | MB/s |
|---|---:|---:|---:|
| `/lab/memoria.js` | 11,236 | 2 | 5.6 |
| `/lab/memoria.js` | 11,236 | 0 | — |
| `/lab/memoria.js` | 11,236 | 3 | 3.7 |
| `/lab/hook.js?v=2026-11-23-iphone-2124` | 8,925 | 1 | 8.9 |
| `/lab/hook.js?v=2026-11-23-iphone-2124` | 8,925 | 1 | 8.9 |
| `/lab/hook.js?v=2026-11-23-iphone-2124` | 8,925 | 5 | 1.8 |
| `/lab/memoria-unica.js?v=2026-11-23-iphone-2124` | 3,430 | 3 | 1.1 |
| `/lab/memoria-unica.js?v=2026-11-23-iphone-2124` | 3,430 | 0 | — |
| `/lab/memoria-unica.js?v=2026-11-23-iphone-2124` | 3,430 | 3 | 1.1 |
| `/lab/opfs-worker.js` | 1,974 | 1 | 2.0 |

Estados HTTP: {200: 49}.

## Conclusões automáticas

- Etapas: {'posted': 6, 'crashed': 2} de 8; a sessão terminou.
- WebGPU no aparelho: indisponível.
- Rodaram: —.

