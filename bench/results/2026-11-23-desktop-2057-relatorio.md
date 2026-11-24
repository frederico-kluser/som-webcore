# Laboratório de aparelho — sessão `2026-11-23-desktop-2057`

> Gerado por `bench/spike-mobile/lab/analyze.py` a partir dos arquivos da sessão em `bench/results/`. Aparelho: **desktop**; perfil `memoria`; modo `local`; início —; fim 2026-11-23T23:58:03.006Z. Tudo **[MEDIDO no aparelho]**; os limites do portão GT são **[ALVO]** do roadmap.

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
| `vagas-shim` | posted (completou) | 0 | 1 | 2026-11-23T23:57:45.586Z | 2026-11-23T23:57:45.639Z | shim: 16 memória(s) (o máximo testado, sem erro) | — |
| `vagas-minima` | posted (completou) | 0 | 1 | 2026-11-23T23:57:45.642Z | 2026-11-23T23:57:45.657Z | minima: 16 memória(s) (o máximo testado, sem erro) | — |
| `vagas-naocompart` | posted (completou) | 0 | 1 | 2026-11-23T23:57:45.661Z | 2026-11-23T23:57:45.676Z | naoCompart: 16 memória(s) (o máximo testado, sem erro) | — |
| `vagas-max1g` | posted (completou) | 0 | 1 | 2026-11-23T23:57:45.679Z | 2026-11-23T23:57:45.692Z | max1g: 16 memória(s) (o máximo testado, sem erro) | — |
| `opfs-streaming` | crashed (morreu) | 0 | 1 | 2026-11-23T23:57:45.696Z | 2026-11-23T23:57:51.205Z | morreu — último marcador: OPFS: escrevendo 1024 MiB | — |
| `gpu-escrita` | posted (completou) | 1 | 1 | 2026-11-23T23:57:54.225Z | 2026-11-23T23:57:55.009Z | com espera 5685.7 MB/s; sem espera 2048 MiB enfileirados a 6658.9 MB/s, drenados em 70 ms; sem perda do dispositivo | — |
| `gpu-rampa-wasm256` | posted (completou) | 1 | 1 | 2026-11-23T23:57:55.012Z | 2026-11-23T23:57:56.062Z | chegou ao teto de 3072 MiB de GPU depois de 256 MiB numa memória Wasm sem falhar | — |
| `opfs-monolitico` | posted (completou) | 1 | 1 | 2026-11-23T23:57:56.063Z | 2026-11-23T23:58:03.005Z | sobreviveu: 512 MiB: leitura inteira 2185.1 MB/s, envio 3057.4 MB/s, ponta a ponta 1274.3 MB/s · 1024 MiB: leitura inteira 2013 MB/s, envio 2539.6 MB/s, ponta a ponta 1122.9 MB/s | — |

## Critérios do portão GT neste aparelho (17M)

| Execução | Acerta igual? | Primeira visita até 25 MB? | p95 quente até 150 ms (iPhone e Android intermediário) **[ALVO]**? | 200 decisões sem falha? |
|---|---|---|---|---|

## Memória (perfil `memoria`, C-01)

Cada número vem do arquivo citado **[MEDIDO]**, no aparelho e no navegador da sessão. “Morreu” é a aba derrubada pelo sistema (o laboratório viu a recarga, ou a etapa voltou sem resultado); o ponto de queda é o último marcador gravado **antes** do passo que a derrubou.

### Processos do navegador (épocas)

Uma época é um processo do navegador que o laboratório sabe ser novo: o início, cada queda (o Safari recarrega a aba num processo novo) e cada reinício pedido. Reinícios pedidos nesta sessão: **0**.

| Processo | Início | Motivo | Etapas, em ordem |
|---:|---|---|---|
| 0 | 2026-11-23T23:57:45.586Z | início (página única) | `vagas-shim`, `vagas-minima`, `vagas-naocompart`, `vagas-max1g`, `opfs-streaming` |
| 1 | 2026-11-23T23:57:51.205Z | queda em opfs-streaming | `gpu-escrita`, `gpu-rampa-wasm256`, `opfs-monolitico` |

### Experimentos

| Etapa | Processo | Desfecho | Maior alocação que funcionou | Onde parou | Erro (literal) | Teto | Pico GPU · Wasm (livro-caixa) | Arquivo |
|---|---:|---|---:|---|---|---|---|---|
| `vagas-shim` | 0 | **completou** | — | — | — | — | 0.0 MiB · 64.0 MiB | `2026-11-23-desktop-2057-vagas-shim.json` |
| `vagas-minima` | 0 | **completou** | — | — | — | — | 0.0 MiB · 129.0 MiB | `2026-11-23-desktop-2057-vagas-minima.json` |
| `vagas-naocompart` | 0 | **completou** | — | — | — | — | 0.0 MiB · 449.0 MiB | `2026-11-23-desktop-2057-vagas-naocompart.json` |
| `vagas-max1g` | 0 | **completou** | — | — | — | — | 0.0 MiB · 769.0 MiB | `2026-11-23-desktop-2057-vagas-max1g.json` |
| `opfs-streaming` | 0 | **morreu** | — | último marcador: OPFS: escrevendo 1024 MiB | — | — | 512.5 MiB (marcador) · 769 MiB (marcador) | `2026-11-23-desktop-2057-opfs-streaming.json` |
| `gpu-escrita` | 1 | **completou** | — | — | — | 2,048 MiB | 256.0 MiB · 0.0 MiB | `2026-11-23-desktop-2057-gpu-escrita.json` |
| `gpu-rampa-wasm256` | 1 | **completou** | ≥ 3,072 MiB | — | — | 3,072 MiB | 3,072.0 MiB · 256.0 MiB | `2026-11-23-desktop-2057-gpu-rampa-wasm256.json` |
| `opfs-monolitico` | 1 | **completou** | — | — | — | — | 3,072.0 MiB · 256.0 MiB | `2026-11-23-desktop-2057-opfs-monolitico.json` |

**Resumo de cada etapa** (o `resumo` que a página gravou):

- `vagas-shim` — shim: 16 memória(s) (o máximo testado, sem erro)
- `vagas-minima` — minima: 16 memória(s) (o máximo testado, sem erro)
- `vagas-naocompart` — naoCompart: 16 memória(s) (o máximo testado, sem erro)
- `vagas-max1g` — max1g: 16 memória(s) (o máximo testado, sem erro)
- `opfs-streaming` — morreu — último marcador: OPFS: escrevendo 1024 MiB
- `gpu-escrita` — com espera 5685.7 MB/s; sem espera 2048 MiB enfileirados a 6658.9 MB/s, drenados em 70 ms; sem perda do dispositivo
- `gpu-rampa-wasm256` — chegou ao teto de 3072 MiB de GPU depois de 256 MiB numa memória Wasm sem falhar
- `opfs-monolitico` — sobreviveu: 512 MiB: leitura inteira 2185.1 MB/s, envio 3057.4 MB/s, ponta a ponta 1274.3 MB/s · 1024 MiB: leitura inteira 2013 MB/s, envio 2539.6 MB/s, ponta a ponta 1122.9 MB/s

### Vagas de memória Wasm (X1, X2)

| Etapa | Descritor | Processo (antes nele) | Memórias criadas | Erro da seguinte (literal) | `ort` com estas presas | Arquivo |
|---|---|---|---:|---|---|---|
| `vagas-shim` | `{"initial": 0, "maximum": 0, "shared": true}` | 0 (nada) | 16 | — | 4 | `2026-11-23-desktop-2057-vagas-shim.json` |
| `vagas-minima` | `{"initial": 1, "maximum": 1}` | 0 (vagas-shim) | 16 | — | 4 | `2026-11-23-desktop-2057-vagas-minima.json` |
| `vagas-naocompart` | `{"initial": 256, "maximum": 65536}` | 0 (vagas-shim, vagas-minima) | 16 | — | 4 | `2026-11-23-desktop-2057-vagas-naocompart.json` |
| `vagas-max1g` | `{"initial": 256, "maximum": 16384, "shared": true}` | 0 (vagas-shim, vagas-minima, vagas-naocompart) | 16 | — | 4 | `2026-11-23-desktop-2057-vagas-max1g.json` |

### Processo de GPU e `writeBuffer` em voo (`2026-11-23-desktop-2057-gpu-escrita.json`)

| Fase | Volume | Vazão | Detalhe | Perda do dispositivo |
|---|---:|---:|---|---|
| com espera a cada 64 MiB | 2,048 MiB | 5,686 MB/s | grupo de 64 MiB p50 11.2 ms | — |
| sem espera | 2,048 MiB | enfileirar 6,659 MB/s · efetiva 5,471 MB/s | drenagem 70 ms | — |

### Streaming do OPFS para a GPU (X5) (`2026-11-23-desktop-2057-opfs-streaming.json`)

`createSyncAccessHandle` no Worker: **True**; `createWritable`: True; kernel confere: —.

| Arquivo | Fase | Caminho | Leitura do OPFS | Envio à GPU | Ponta a ponta | Grupo de 64 MiB p50 · máx. |
|---|---|---|---:|---:|---:|---|
| 512MiB | escrita | FileSystemSyncAccessHandle.write (Worker) | — | — | 305 MB/s | — |
| 512MiB | anel 3 × 64 MiB, passada 1 (kernel ok) | FileSystemSyncAccessHandle.read (Worker) | 4,794 MB/s | 8,859 MB/s | 3,829 MB/s | 16.1 · 26.2 ms |
| 512MiB | anel 3 × 64 MiB, passada 2 (kernel ok) | FileSystemSyncAccessHandle.read (Worker) | 4,934 MB/s | 11,138 MB/s | 4,211 MB/s | 15.9 · 17.5 ms |
| 512MiB | anel 3 × 64 MiB, passada 3 (kernel ok) | FileSystemSyncAccessHandle.read (Worker) | 4,726 MB/s | 10,016 MB/s | 3,945 MB/s | 16.6 · 18.6 ms |
| 512MiB | 2 placa(s) de 256 MiB, residentes | FileSystemSyncAccessHandle.read (Worker) | 4,593 MB/s | 8,715 MB/s | 3,637 MB/s | 15.2 · 30.5 ms |
| 1024MiB | escrita | — | — | — | — | — |

**A aba morreu** — último marcador: OPFS: escrevendo 1024 MiB.

### Caminho monolítico de hoje (arquivo inteiro num Uint8Array) (`2026-11-23-desktop-2057-opfs-monolitico.json`)

| Arquivo | Leitura inteira (engines/fetch.js) | Envio à GPU (placas de 256 MiB) | Ponta a ponta |
|---|---:|---:|---:|
| 512MiB | 2,185 MB/s | 3,057 MB/s | 1,274 MB/s |
| 1024MiB | 2,013 MB/s | 2,540 MB/s | 1,123 MB/s |

### Memória dos processos do navegador (`2026-11-23-desktop-2057-desktop.json`)

Chrome/158.0.8127.38; 0 reinício(s) do navegador pedidos pelo laboratório. Método: RSS (ps) of the browser process started by the runner and of every process under it, every 500 ms, bytes, keyed <kind>#<pid> (kind from Chrome's --type= switch); phys_footprint and phys_footprint_peak (footprint(1)) of the browser, GPU and renderer processes, every 1000 ms — GPU memory a process owns counts in its footprint, not in its RSS.

| Etapa | RSS GPU | RSS renderer | footprint GPU | footprint renderer |
|---|---:|---:|---:|---:|
| `opfs-streaming` | 158 MiB | 858 MiB | 645 MiB | 151 MiB |
| `gpu-rampa-wasm256` | 778 MiB | 1,576 MiB | 814 MiB | 433 MiB |
| `opfs-monolitico` | 989 MiB | 3,250 MiB | 3,709 MiB | 1,404 MiB |

Pico de toda a sessão: RSS GPU 989 MiB, renderer 3,250 MiB; `phys_footprint_peak` GPU 3,773 MiB, renderer 3,011 MiB.

## Logs

274 entradas. Por tipo e nível: `marker`/info 218; `console`/info 33; `webgpu`/info 15; `lifecycle`/info 5; `ledger`/info 3.

**WebGPU** (eventos distintos):

- `memoria-unica.html` — info: requestAdapter({}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `memoria-unica.html` — info: requestDevice → ok (device 1); features: core-features-and-limits
- `memoria-unica.html` — info: device lost: destroyed Device was destroyed.
- `memoria-unica.html` — info: requestDevice → ok (device 2); features: core-features-and-limits
- `memoria-unica.html` — info: requestDevice → ok (device 3); features: core-features-and-limits

**Ciclo de vida:** a página ficou oculta 0 vez(es).

## Rede

41 requisições respondidas; 0.06 MB enviados ao aparelho. As maiores:

| Caminho | Bytes | Tempo (ms) | MB/s |
|---|---:|---:|---:|
| `/lab/memoria.js` | 11,236 | 70 | 0.2 |
| `/lab/memoria.js` | 11,236 | 0 | — |
| `/lab/hook.js?v=2026-11-23-desktop-2057` | 8,925 | 82 | 0.1 |
| `/lab/hook.js?v=2026-11-23-desktop-2057` | 8,925 | 1 | 8.9 |
| `/lab/memoria-unica.js?v=2026-11-23-desktop-2057` | 3,430 | 36 | 0.1 |
| `/lab/memoria-unica.js?v=2026-11-23-desktop-2057` | 3,430 | 1 | 3.4 |
| `/lab/opfs-worker.js` | 1,974 | 0 | — |
| `/lab/opfs-worker.js` | 1,974 | 6 | 0.3 |
| `/lab/memoria-unica.html` | 1,909 | 3 | 0.6 |
| `/lab/memoria-unica.html` | 1,909 | 0 | — |

Estados HTTP: {200: 41}.

## Conclusões automáticas

- Etapas: {'posted': 7, 'crashed': 1} de 8; a sessão terminou.
- WebGPU no aparelho: indisponível.
- Rodaram: —.

