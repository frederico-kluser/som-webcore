# Laboratório de aparelho — sessão `2026-11-23-iphone-2011`

> Gerado por `bench/spike-mobile/lab/analyze.py` a partir dos arquivos da sessão em `bench/results/`. Aparelho: **iphone**; perfil `memoria`; modo `local`; início 2026-11-23T23:12:03.225Z; fim — (não terminou). Tudo **[MEDIDO no aparelho]**; os limites do portão GT são **[ALVO]** do roadmap.

## Aparelho e navegador

| Item | Valor |
|---|---|
| Navegador | `Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.7.2 Mobile/15E148 Safari/604.1 Brave` |
| Tela | 390×844 @3x; núcleos lógicos 4; `deviceMemory` None |
| Contexto seguro | True; isolado (sonda com COOP/COEP): — |
| WebAssembly | SIMD True; SIMD relaxado False; JSPI False; threads False (isolado: —) |
| WebGPU | `navigator.gpu` True; adaptador True {"vendor": "apple", "architecture": "apple", "device": "apple", "description": "apple", "isFallbackAdapter": false}; dispositivo True  |
| Teste de computação WebGPU | 1048576 floats, 161 ms, 0 divergências; `shader-f16`: True (compilação: []) |
| WebGL | Apple GPU (WebGL 1.0) |
| Armazenamento | quota 41,232 MB; OPFS True; IndexedDB True |
| APIs presentes | navigator.gpu, wakeLock, caches, serviceWorker, Worker, OffscreenCanvas, Atomics.waitAsync, Float16Array, CompressionStream, WebTransport, VideoDecoder (WebCodecs) |
| Resolução de `performance.now()` | 0.9999999999999716 ms |

## Etapas

| Etapa | Estado | Processo | Tentativas | Início | Fim | Nota | Tentativas anteriores |
|---|---|---:|---:|---|---|---|---|
| `sonda` | posted (environment-probe) | 0 | 1 | 2026-11-23T23:12:03.226Z | 2026-11-23T23:12:04.858Z | — | — |
| `ambiente` | ok | 0 | 1 | 2026-11-23T23:12:04.883Z | 2026-11-23T23:12:05.140Z | — | — |
| `vagas-ort` | posted (erro) | 0 | 1 | 2026-11-23T23:12:05.152Z | 2026-11-23T23:13:16.669Z | ort: 3 memória(s); a 4ª deu RangeError: Out of memory | — |
| `vagas-ort-navegacao` | posted (completou) | 0 | 1 | 2026-11-23T23:13:16.691Z | 2026-11-23T23:13:28.269Z | depois da navegação: 3 memória(s) ort (RangeError: Out of memory); 10 s e pressão depois: 3 | — |
| `gpu-rampa` | timeout | 0 | 1 | 2026-11-23T23:13:28.293Z | 2026-11-23T23:18:33.061Z | sem resultado em 300 s | — |
| `vagas-naocompart` | pending | — | 0 | — | — | — | — |
| `gpu-rampa-ab256` | timeout | 0 | 1 | 2026-11-23T23:18:33.132Z | 2026-11-23T23:23:39.806Z | sem resultado em 300 s — adiantada antes de `vagas-naocompart` para ganhar um processo novo | — |
| `vagas-max1g` | pending | — | 0 | — | — | — | — |
| `host-rampa` | running | 0 | 1 | 2026-11-23T23:23:39.876Z | — | — — adiantada antes de `vagas-naocompart` para ganhar um processo novo | — |
| `gpu-rampa-wasm256` | pending | — | 0 | — | — | — | — |
| `vagas-minima` | pending | — | 0 | — | — | — | — |
| `opfs-monolitico` | pending | — | 0 | — | — | — | — |
| `vagas-shim` | pending | — | 0 | — | — | — | — |
| `opfs-streaming` | pending | — | 0 | — | — | — | — |
| `gpu-escrita` | pending | — | 0 | — | — | — | — |
| `ort-webgpu-q8emb32-f16-17m` | pending | — | 0 | — | — | — | — |
| `ort-wasm-q8emb32-f16-17m` | pending | — | 0 | — | — | — | — |
| `ort-webgpu-q8emb32-f16-17m-apos-wasm` | pending | — | 0 | — | — | — | — |
| `jh-webgpu-f32-17m` | pending | — | 0 | — | — | — | — |

## Critérios do portão GT neste aparelho (17M)

| Execução | Acerta igual? | Primeira visita até 25 MB? | p95 quente até 150 ms (iPhone e Android intermediário) **[ALVO]**? | 200 decisões sem falha? |
|---|---|---|---|---|

## Memória (perfil `memoria`, C-01)

Cada número vem do arquivo citado **[MEDIDO]**, no aparelho e no navegador da sessão. “Morreu” é a aba derrubada pelo sistema (o laboratório viu a recarga, ou a etapa voltou sem resultado); o ponto de queda é o último marcador gravado **antes** do passo que a derrubou.

### Processos do navegador (épocas)

Uma época é um processo do navegador que o laboratório sabe ser novo: o início, cada queda (o Safari recarrega a aba num processo novo) e cada reinício pedido. Reinícios pedidos nesta sessão: **0**.

| Processo | Início | Motivo | Etapas, em ordem |
|---:|---|---|---|
| 0 | 2026-11-23T23:12:03.225Z | início: o dono fechou e reabriu o Safari | `sonda`, `ambiente`, `vagas-ort`, `vagas-ort-navegacao`, `gpu-rampa`, `gpu-rampa-ab256`, `host-rampa` |

### Experimentos

| Etapa | Processo | Desfecho | Maior alocação que funcionou | Onde parou | Erro (literal) | Teto | Pico GPU · Wasm (livro-caixa) | Arquivo |
|---|---:|---|---:|---|---|---|---|---|
| `vagas-ort` | 0 | **erro** | — | — | RangeError: Out of memory | — | 0.0 MiB · 48.0 MiB | `2026-11-23-iphone-2011-vagas-ort.json` |
| `vagas-ort-navegacao` | 0 | **completou** | — | — | — | — | 0.0 MiB · 48.0 MiB | `2026-11-23-iphone-2011-vagas-ort-navegacao.json` |
| `gpu-rampa` | 0 | **erro** | 1,664 MiB | — | the page did not post a result within 300 s (device lab) | sem teto | 1664 MiB (marcador) · 0 MiB (marcador) | `2026-11-23-iphone-2011-gpu-rampa.json` |
| `vagas-naocompart` | — | pending (sem resultado) | — | — | — | — | — | — |
| `gpu-rampa-ab256` | 0 | **erro** | 384 MiB | — | the page did not post a result within 300 s (device lab) | sem teto | 384 MiB (marcador) · 0 MiB (marcador) | `2026-11-23-iphone-2011-gpu-rampa-ab256.json` |
| `vagas-max1g` | — | pending (sem resultado) | — | — | — | — | — | — |
| `host-rampa` | 0 | running (sem resultado) | — | — | — | — | — | — |
| `gpu-rampa-wasm256` | — | pending (sem resultado) | — | — | — | — | — | — |
| `vagas-minima` | — | pending (sem resultado) | — | — | — | — | — | — |
| `opfs-monolitico` | — | pending (sem resultado) | — | — | — | — | — | — |
| `vagas-shim` | — | pending (sem resultado) | — | — | — | — | — | — |
| `opfs-streaming` | — | pending (sem resultado) | — | — | — | — | — | — |
| `gpu-escrita` | — | pending (sem resultado) | — | — | — | — | — | — |

**Resumo de cada etapa** (o `resumo` que a página gravou):

- `vagas-ort` — ort: 3 memória(s); a 4ª deu RangeError: Out of memory
- `vagas-ort-navegacao` — depois da navegação: 3 memória(s) ort (RangeError: Out of memory); 10 s e pressão depois: 3
- `gpu-rampa` — the page did not post a result within 300 s (device lab)
- `gpu-rampa-ab256` — the page did not post a result within 300 s (device lab)

### Vagas de memória Wasm (X1, X2)

| Etapa | Descritor | Processo (antes nele) | Memórias criadas | Erro da seguinte (literal) | `ort` com estas presas | Arquivo |
|---|---|---|---:|---|---|---|
| `vagas-ort` | `{"initial": 256, "maximum": 65536, "shared": true}` | 0 (sonda, ambiente) | 3 | RangeError: Out of memory | — | `2026-11-23-iphone-2011-vagas-ort.json` |
| `vagas-ort-navegacao` | `{"initial": 256, "maximum": 65536, "shared": true}` | 0 (sonda, ambiente, vagas-ort) | 3 | RangeError: Out of memory | — | `2026-11-23-iphone-2011-vagas-ort-navegacao.json` |

**Liberação depois de esgotar as vagas `ort`** (`2026-11-23-iphone-2011-vagas-ort.json`):

| Quando | Memórias `ort` criadas | Erro | Coletadas pelo GC (livro-caixa) |
|---|---:|---|---:|
| 1 s depois de soltar as referências e pressionar o coletor | 3 | RangeError: Out of memory | 3 |
| 10 s depois de soltar as referências e pressionar o coletor | 3 | RangeError: Out of memory | 6 |
| 60 s depois de soltar as referências e pressionar o coletor | 3 | RangeError: Out of memory | 9 |
| num Worker dedicado | 3 | RangeError: Out of memory | — |
| na página, 0 s depois de `terminate()` | 3 | RangeError: Out of memory | 12 |
| na página, 1 s depois de `terminate()` | 3 | RangeError: Out of memory | 15 |
| na página, 10 s depois de `terminate()` | 3 | RangeError: Out of memory | 18 |

**Depois da navegação** (`2026-11-23-iphone-2011-vagas-ort-navegacao.json`): 3 memória(s) `ort` logo ao chegar (RangeError: Out of memory); 3 depois de 10 s e pressão no coletor.

### Faixas para a `C-08`

Aparelho: `Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.7.2 Mobile/15E148 Safari/604.1 Brave`; adaptador WebGPU: apple apple apple apple.

| Medida | Valor | Arquivo |
|---|---:|---|
| Maior total de GPU que funcionou (rampa simples) | 1,664 MiB **[MEDIDO]** | `2026-11-23-iphone-2011-gpu-rampa.json` |
| … depois de 256 MiB num ArrayBuffer | 384 MiB **[MEDIDO]** | `2026-11-23-iphone-2011-gpu-rampa-ab256.json` |
| … depois de 256 MiB numa memória Wasm | — **[MEDIDO]** | `None` |
| Maior total de ArrayBuffer que funcionou | — **[MEDIDO]** | `None` |
| Streaming OPFS → GPU, anel de 3 × 64 MiB, última passada | — **[MEDIDO]** | `—` |
| Faixa candidata de pesos + ativações residentes | 832 MiB **[HIPÓTESE: 50% do menor máximo medido; a regra é desta tabela, a decisão é da C-08]** | — |

## Logs

6218 entradas. Por tipo e nível: `marker`/info 5266; `error`/error 553; `lifecycle`/info 144; `console`/info 82; `webgpu`/info 76; `lab`/info 32; `lab`/warn 24; `ledger`/info 19; `performance`/info 11; `wasm`/warn 9; `fetch`/warn 2.

**Erros** (os mais frequentes):

| Origem | Mensagem | Vezes |
|---|---|---:|
| `2026-11-23-iphone-2011-host-rampa` | Script error. @ :0:0 | 318 |
| `2026-11-23-iphone-2011-host-rampa` | TypeError: undefined is not an object (evaluating 'window.ethereum.selectedAddress = undefined') @ https://192.168.100.84:8390/lab/memoria.html?exp=host-rampa&name=2026-11-23-iphone-2011-host-rampa&trace=1&cache=1&labste | 90 |
| `lab.html` | Script error. @ :0:0 | 46 |
| `2026-11-23-iphone-2011-gpu-rampa-ab256` | Script error. @ :0:0 | 24 |
| `2026-11-23-iphone-2011-gpu-rampa` | Script error. @ :0:0 | 22 |
| `2026-11-23-iphone-2011-vagas-ort` | Script error. @ :0:0 | 8 |
| `2026-11-23-iphone-2011-vagas-ort-navegacao` | Script error. @ :0:0 | 8 |
| `2026-11-23-iphone-2011-sonda` | Script error. @ :0:0 | 7 |
| `lab.html` | TypeError: undefined is not an object (evaluating 'window.ethereum.selectedAddress = undefined') @ https://192.168.100.84:8390/lab/lab.html?continue=1:1:16 | 6 |
| `2026-11-23-iphone-2011-gpu-rampa` | TypeError: undefined is not an object (evaluating 'window.ethereum.selectedAddress = undefined') @ https://192.168.100.84:8390/lab/memoria.html?exp=gpu-rampa&variante=simples&name=2026-11-23-iphone-2011-gpu-rampa&trace=1 | 6 |
| `2026-11-23-iphone-2011-gpu-rampa-ab256` | TypeError: undefined is not an object (evaluating 'window.ethereum.selectedAddress = undefined') @ https://192.168.100.84:8390/lab/memoria.html?exp=gpu-rampa&variante=ab256&name=2026-11-23-iphone-2011-gpu-rampa-ab256&tra | 6 |
| `lab.html` | TypeError: undefined is not an object (evaluating 'window.ethereum.selectedAddress = undefined') @ https://192.168.100.84:8390/lab/lab.html:1:16 | 2 |
| `2026-11-23-iphone-2011-sonda` | TypeError: undefined is not an object (evaluating 'window.ethereum.selectedAddress = undefined') @ https://192.168.100.84:8390/probe.html?name=2026-11-23-iphone-2011-sonda&trace=1&cache=1&labstep=sonda&labtimeout=90&laba | 2 |
| `2026-11-23-iphone-2011-vagas-ort` | TypeError: undefined is not an object (evaluating 'window.ethereum.selectedAddress = undefined') @ https://192.168.100.84:8390/lab/memoria.html?exp=vagas&variante=ort&name=2026-11-23-iphone-2011-vagas-ort&trace=1&cache=1 | 2 |
| `2026-11-23-iphone-2011-vagas-ort-navegacao` | TypeError: undefined is not an object (evaluating 'window.ethereum.selectedAddress = undefined') @ https://192.168.100.84:8390/lab/memoria.html?exp=vagas-navegacao&variante=ort&name=2026-11-23-iphone-2011-vagas-ort-naveg | 2 |
| `lab.html` | TypeError: undefined is not an object (evaluating 'window.ethereum.selectedAddress = undefined') @ https://192.168.100.84:8390/lab/lab.html?continue=1&labtimedout=gpu-rampa:1:16 | 2 |
| `lab.html` | TypeError: undefined is not an object (evaluating 'window.ethereum.selectedAddress = undefined') @ https://192.168.100.84:8390/lab/lab.html?continue=1&labtimedout=gpu-rampa-ab256:1:16 | 2 |

**WebGPU** (eventos distintos):

- `2026-11-23-iphone-2011-sonda` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-23-iphone-2011-sonda` — info: requestDevice → ok (device 1); features: core-features-and-limits
- `2026-11-23-iphone-2011-sonda` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-23-iphone-2011-sonda` — info: requestDevice → ok (device 2); features: core-features-and-limits
- `2026-11-23-iphone-2011-sonda` — info: device lost: destroyed
- `lab.html` — info: requestAdapter({"powerPreference":"high-performance"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `lab.html` — info: requestDevice → ok (device 1); features: core-features-and-limits
- `lab.html` — info: requestAdapter({"powerPreference":"low-power"}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `lab.html` — info: requestDevice → ok (device 2); features: core-features-and-limits
- `lab.html` — info: device lost: destroyed
- `lab.html` — info: requestAdapter({}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `lab.html` — info: requestDevice → ok (device 3); features: core-features-and-limits, shader-f16
- `2026-11-23-iphone-2011-vagas-ort` — info: requestAdapter({}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-23-iphone-2011-vagas-ort-navegacao` — info: requestAdapter({}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-23-iphone-2011-gpu-rampa` — info: requestAdapter({}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-23-iphone-2011-gpu-rampa` — info: requestDevice → ok (device 1); features: core-features-and-limits
- `2026-11-23-iphone-2011-gpu-rampa` — info: device lost: destroyed
- `2026-11-23-iphone-2011-gpu-rampa-ab256` — info: requestAdapter({}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}
- `2026-11-23-iphone-2011-gpu-rampa-ab256` — info: requestDevice → ok (device 1); features: core-features-and-limits
- `2026-11-23-iphone-2011-gpu-rampa-ab256` — info: device lost: destroyed
- `2026-11-23-iphone-2011-host-rampa` — info: requestAdapter({}) → {"vendor":"apple","architecture":"apple","device":"apple","description":"apple"}

**Ciclo de vida:** a página ficou oculta 0 vez(es).

**Avisos** (os mais frequentes): “wake lock: NotAllowedError” ×22; “new WebAssembly.Memory({"initial":256,"maximum":65536,"shared":true}) threw RangeError: Out of memory” ×9; “step gpu-rampa reached its time limit (300 s)” ×1; “404 /api/progress?name=2026-11-23-iphone-2011-gpu-rampa” ×1; “step gpu-rampa-ab256 reached its time limit (300 s)” ×1; “404 /api/progress?name=2026-11-23-iphone-2011-gpu-rampa-ab256” ×1

## Rede

750 requisições respondidas; 3.77 MB enviados ao aparelho. As maiores:

| Caminho | Bytes | Tempo (ms) | MB/s |
|---|---:|---:|---:|
| `/lab/lab.js?v=2026-11-23-iphone-2011` | 10,989 | 1 | 11.0 |
| `/lab/lab.js?v=2026-11-23-iphone-2011` | 10,989 | 1 | 11.0 |
| `/lab/lab.js?v=2026-11-23-iphone-2011` | 10,989 | 1 | 11.0 |
| `/lab/lab.js?v=2026-11-23-iphone-2011` | 10,989 | 1 | 11.0 |
| `/lab/lab.js?v=2026-11-23-iphone-2011` | 10,989 | 1 | 11.0 |
| `/lab/lab.js?v=2026-11-23-iphone-2011` | 10,989 | 1 | 11.0 |
| `/lab/memoria.js?v=2026-11-23-iphone-2011` | 10,942 | 1 | 10.9 |
| `/lab/memoria.js?v=2026-11-23-iphone-2011` | 10,942 | 1 | 10.9 |
| `/lab/memoria.js?v=2026-11-23-iphone-2011` | 10,942 | 1 | 10.9 |
| `/lab/memoria.js?v=2026-11-23-iphone-2011` | 10,942 | 1 | 10.9 |

Estados HTTP: {200: 750}.

## Conclusões automáticas

- Etapas: {'posted': 3, 'ok': 1, 'timeout': 2, 'pending': 12, 'running': 1} de 19; a sessão **não terminou**.
- WebGPU no aparelho: **disponível** (apple apple); computação correta.
- Rodaram: —.
- Sem resultado (etapa não executada): `ort-webgpu-q8emb32-f16-17m`, `ort-wasm-q8emb32-f16-17m`, `ort-webgpu-q8emb32-f16-17m-apos-wasm`, `jh-webgpu-f32-17m`.

