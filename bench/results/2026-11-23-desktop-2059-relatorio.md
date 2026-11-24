# Laboratório de aparelho — sessão `2026-11-23-desktop-2059`

> Gerado por `bench/spike-mobile/lab/analyze.py` a partir dos arquivos da sessão em `bench/results/`. Aparelho: **desktop**; perfil `memoria`; modo `local`; início 2026-11-23T23:59:16.211Z; fim 2026-11-23T23:59:35.110Z. Tudo **[MEDIDO no aparelho]**; os limites do portão GT são **[ALVO]** do roadmap.

## Aparelho e navegador

| Item | Valor |
|---|---|
| Navegador | `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36` |
| Tela | 1680×1050 @1x; núcleos lógicos 8; `deviceMemory` 16 |
| Contexto seguro | True; isolado (sonda com COOP/COEP): — |
| WebAssembly | SIMD True; SIMD relaxado True; JSPI True; threads False (isolado: —) |
| WebGPU | `navigator.gpu` True; adaptador True {"vendor": "apple", "architecture": "metal-3", "device": "", "description": "", "isFallbackAdapter": false, "subgroupMinSize": 32, "subgroupMaxSize": 32}; dispositivo True  |
| Teste de computação WebGPU | 1048576 floats, 3.9 ms, 0 divergências; `shader-f16`: True (compilação: []) |
| WebGL | ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version) (WebGL 1.0 (OpenGL ES 2.0 Chromium)) |
| Armazenamento | quota 10,737 MB; OPFS True; IndexedDB True |
| APIs presentes | LanguageModel, Summarizer, Translator, LanguageDetector, navigator.gpu, wakeLock, caches, serviceWorker, Worker, OffscreenCanvas, Atomics.waitAsync, Float16Array, CompressionStream, WebTransport, VideoDecoder (WebCodecs), requestIdleCallback, scheduler.postTask, performance.memory |
| Resolução de `performance.now()` | 0.09999996423721313 ms |

## Etapas

| Etapa | Estado | Processo | Tentativas | Início | Fim | Nota | Tentativas anteriores |
|---|---|---:|---:|---|---|---|---|
| `sonda` | posted (environment-probe) | 0 | 1 | 2026-11-23T23:59:16.211Z | 2026-11-23T23:59:17.593Z | — | — |
| `ambiente` | ok | 0 | 1 | 2026-11-23T23:59:17.597Z | 2026-11-23T23:59:17.749Z | — | — |
| `vagas-ort` | crashed (morreu) | 0 | 1 | 2026-11-23T23:59:17.751Z | 2026-11-23T23:59:24.604Z | o processo do Safari caiu; não repetida — último marcador: liberacao-1s: memória 16 de até 16 (15 criadas) | — |
| `vagas-ort-navegacao` | skipped | — | 0 | — | — | pulada: precisa rodar logo depois de vagas-ort, no mesmo processo (crashed) | — |
| `vagas-naocompart` | posted (completou) | 1 | 1 | 2026-11-23T23:59:24.619Z | 2026-11-23T23:59:26.012Z | naoCompart: 16 memória(s) (o máximo testado, sem erro) | — |
| `vagas-max1g` | posted (completou) | 2 | 1 | 2026-11-23T23:59:27.699Z | 2026-11-23T23:59:29.092Z | max1g: 16 memória(s) (o máximo testado, sem erro) | — |
| `vagas-minima` | posted (completou) | 3 | 1 | 2026-11-23T23:59:30.706Z | 2026-11-23T23:59:32.100Z | minima: 16 memória(s) (o máximo testado, sem erro) | — |
| `vagas-shim` | posted (completou) | 4 | 1 | 2026-11-23T23:59:33.715Z | 2026-11-23T23:59:35.106Z | shim: 16 memória(s) (o máximo testado, sem erro) | — |

## Critérios do portão GT neste aparelho (17M)

| Execução | Acerta igual? | Primeira visita até 25 MB? | p95 quente até 150 ms (iPhone e Android intermediário) **[ALVO]**? | 200 decisões sem falha? |
|---|---|---|---|---|

## Memória (perfil `memoria`, C-01)

Cada número vem do arquivo citado **[MEDIDO]**, no aparelho e no navegador da sessão. “Morreu” é a aba derrubada pelo sistema (o laboratório viu a recarga, ou a etapa voltou sem resultado); o ponto de queda é o último marcador gravado **antes** do passo que a derrubou.

### Processos do navegador (épocas)

Uma época é um processo do navegador que o laboratório sabe ser novo: o início, cada queda (o Safari recarrega a aba num processo novo) e cada reinício pedido. Reinícios pedidos nesta sessão: **3**.

| Processo | Início | Motivo | Etapas, em ordem |
|---:|---|---|---|
| 0 | 2026-11-23T23:59:16.211Z | início: navegador aberto pelo executor | `sonda`, `ambiente`, `vagas-ort` |
| 1 | 2026-11-23T23:59:24.613Z | queda em vagas-ort | `vagas-naocompart` |
| 2 | 2026-11-23T23:59:27.669Z | reinício: o executor fechou e reabriu o navegador | `vagas-max1g` |
| 3 | 2026-11-23T23:59:30.691Z | reinício: o executor fechou e reabriu o navegador | `vagas-minima` |
| 4 | 2026-11-23T23:59:33.704Z | reinício: o executor fechou e reabriu o navegador | `vagas-shim` |

### Experimentos

| Etapa | Processo | Desfecho | Maior alocação que funcionou | Onde parou | Erro (literal) | Teto | Pico GPU · Wasm (livro-caixa) | Arquivo |
|---|---:|---|---:|---|---|---|---|---|
| `vagas-ort` | 0 | **morreu** | — | último marcador: liberacao-1s: memória 16 de até 16 (15 criadas) | — | — | — · — | `2026-11-23-desktop-2059-vagas-ort.json` |
| `vagas-ort-navegacao` | — | skipped (sem resultado) | — | — | — | — | — | — |
| `vagas-naocompart` | 1 | **completou** | — | — | — | — | 0.0 MiB · 320.0 MiB | `2026-11-23-desktop-2059-vagas-naocompart.json` |
| `vagas-max1g` | 2 | **completou** | — | — | — | — | 0.0 MiB · 320.0 MiB | `2026-11-23-desktop-2059-vagas-max1g.json` |
| `vagas-minima` | 3 | **completou** | — | — | — | — | 0.0 MiB · 65.0 MiB | `2026-11-23-desktop-2059-vagas-minima.json` |
| `vagas-shim` | 4 | **completou** | — | — | — | — | 0.0 MiB · 64.0 MiB | `2026-11-23-desktop-2059-vagas-shim.json` |

**Resumo de cada etapa** (o `resumo` que a página gravou):

- `vagas-ort` — morreu — último marcador: liberacao-1s: memória 16 de até 16 (15 criadas)
- `vagas-naocompart` — naoCompart: 16 memória(s) (o máximo testado, sem erro)
- `vagas-max1g` — max1g: 16 memória(s) (o máximo testado, sem erro)
- `vagas-minima` — minima: 16 memória(s) (o máximo testado, sem erro)
- `vagas-shim` — shim: 16 memória(s) (o máximo testado, sem erro)

### Vagas de memória Wasm (X1, X2)

| Etapa | Descritor | Processo (antes nele) | Memórias criadas | Erro da seguinte (literal) | `ort` com estas presas | Arquivo |
|---|---|---|---:|---|---|---|
| `vagas-ort` | `{"initial": 256, "maximum": 65536, "shared": true}` | 0 (sonda, ambiente) | morreu | — | — | `2026-11-23-desktop-2059-vagas-ort.json` |
| `vagas-naocompart` | `{"initial": 256, "maximum": 65536}` | 1 (nada) | 16 | — | 4 | `2026-11-23-desktop-2059-vagas-naocompart.json` |
| `vagas-max1g` | `{"initial": 256, "maximum": 16384, "shared": true}` | 2 (nada) | 16 | — | 4 | `2026-11-23-desktop-2059-vagas-max1g.json` |
| `vagas-minima` | `{"initial": 1, "maximum": 1}` | 3 (nada) | 16 | — | 4 | `2026-11-23-desktop-2059-vagas-minima.json` |
| `vagas-shim` | `{"initial": 0, "maximum": 0, "shared": true}` | 4 (nada) | 16 | — | 4 | `2026-11-23-desktop-2059-vagas-shim.json` |

**Liberação depois de esgotar as vagas `ort`** (`2026-11-23-desktop-2059-vagas-ort.json`):

| Quando | Memórias `ort` criadas | Erro | Coletadas pelo GC (livro-caixa) |
|---|---:|---|---:|
| 1 s depois de soltar as referências e pressionar o coletor | 16 | — | 16 |
| num Worker dedicado | — | — | — |

### Memória dos processos do navegador (`2026-11-23-desktop-2059-desktop.json`)

Chrome/158.0.8127.38; 3 reinício(s) do navegador pedidos pelo laboratório. Método: RSS (ps) of the browser process started by the runner and of every process under it, every 500 ms, bytes, keyed <kind>#<pid> (kind from Chrome's --type= switch); phys_footprint and phys_footprint_peak (footprint(1)) of the browser, GPU and renderer processes, every 1000 ms — GPU memory a process owns counts in its footprint, not in its RSS.

| Etapa | RSS GPU | RSS renderer | footprint GPU | footprint renderer |
|---|---:|---:|---:|---:|
| `sonda` | 102 MiB | 546 MiB | 72 MiB | 44 MiB |
| `vagas-ort` | 113 MiB | 753 MiB | 74 MiB | 46 MiB |
| `vagas-naocompart` | 105 MiB | 740 MiB | 65 MiB | 47 MiB |
| `vagas-max1g` | 98 MiB | 420 MiB | 57 MiB | 47 MiB |
| `vagas-minima` | 96 MiB | 333 MiB | 57 MiB | 46 MiB |
| `vagas-shim` | 92 MiB | 334 MiB | 56 MiB | 47 MiB |

Pico de toda a sessão: RSS GPU 113 MiB, renderer 753 MiB; `phys_footprint_peak` GPU 97 MiB, renderer 52 MiB.

## Logs

281 entradas. Por tipo e nível: `marker`/info 118; `lifecycle`/info 61; `console`/info 47; `webgpu`/info 20; `performance`/info 12; `ledger`/info 12; `lab`/info 6; `console`/warn 3; `lab`/warn 1; `fetch`/warn 1.

**WebGPU** (eventos distintos):

- `2026-11-23-desktop-2059-sonda` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `2026-11-23-desktop-2059-sonda` — info: requestDevice → ok (device 1); features: core-features-and-limits
- `2026-11-23-desktop-2059-sonda` — info: device lost: destroyed Device was destroyed.
- `2026-11-23-desktop-2059-sonda` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `2026-11-23-desktop-2059-sonda` — info: requestDevice → ok (device 2); features: core-features-and-limits
- `lab.html` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `lab.html` — info: requestDevice → ok (device 1); features: core-features-and-limits
- `lab.html` — info: device lost: destroyed Device was destroyed.
- `lab.html` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `lab.html` — info: requestDevice → ok (device 2); features: core-features-and-limits
- `lab.html` — info: requestAdapter({}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `lab.html` — info: requestDevice → ok (device 3); features: core-features-and-limits, shader-f16
- `2026-11-23-desktop-2059-vagas-ort` — info: requestAdapter({}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `2026-11-23-desktop-2059-vagas-naocompart` — info: requestAdapter({}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `2026-11-23-desktop-2059-vagas-max1g` — info: requestAdapter({}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `2026-11-23-desktop-2059-vagas-minima` — info: requestAdapter({}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}
- `2026-11-23-desktop-2059-vagas-shim` — info: requestAdapter({}) → {"vendor":"apple","architecture":"metal-3","device":"","description":""}

**Ciclo de vida:** a página ficou oculta 0 vez(es).

**Avisos** (os mais frequentes): “step vagas-ort: the page came back (navigate; started before: true) (the web process crashed); back to the lab without running it again; last marker: liberacao-1s: memória 16 de até 16 (15 criadas)” ×1; “404 /api/progress?name=2026-11-23-desktop-2059-vagas-ort” ×1; “[lab] browser restart requested before vagas-max1g: precisa de um processo novo do navegador (neste já rodaram: vagas-naocompart)” ×1; “[lab] browser restart requested before vagas-minima: precisa de um processo novo do navegador (neste já rodaram: vagas-max1g)” ×1; “[lab] browser restart requested before vagas-shim: precisa de um processo novo do navegador (neste já rodaram: vagas-minima)” ×1

## Rede

129 requisições respondidas; 0.38 MB enviados ao aparelho. As maiores:

| Caminho | Bytes | Tempo (ms) | MB/s |
|---|---:|---:|---:|
| `/lab/memoria.js?v=2026-11-23-desktop-2059` | 11,236 | 6 | 1.9 |
| `/lab/memoria.js?v=2026-11-23-desktop-2059` | 11,236 | 0 | — |
| `/lab/memoria.js?v=2026-11-23-desktop-2059` | 11,236 | 2 | 5.6 |
| `/lab/memoria.js?v=2026-11-23-desktop-2059` | 11,236 | 3 | 3.7 |
| `/lab/memoria.js?v=2026-11-23-desktop-2059` | 11,236 | 4 | 2.8 |
| `/lab/memoria.js?v=2026-11-23-desktop-2059` | 11,236 | 3 | 3.7 |
| `/lab/lab.js?v=2026-11-23-desktop-2059` | 10,989 | 5 | 2.2 |
| `/lab/lab.js?v=2026-11-23-desktop-2059` | 10,989 | 3 | 3.7 |
| `/lab/lab.js?v=2026-11-23-desktop-2059` | 10,989 | 1 | 11.0 |
| `/lab/lab.js?v=2026-11-23-desktop-2059` | 10,989 | 1 | 11.0 |

Estados HTTP: {200: 128, 404: 1}.

## Conclusões automáticas

- Etapas: {'posted': 5, 'ok': 1, 'crashed': 1, 'skipped': 1} de 8; a sessão terminou.
- WebGPU no aparelho: **disponível** (apple metal-3); computação correta.
- Rodaram: —.

