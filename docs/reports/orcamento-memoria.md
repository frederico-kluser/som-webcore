# Orçamento de memória por aparelho (`C-01`)

Medido em 2026-11-23 pelo laboratório de aparelho (perfil `memoria`, [`bench/spike-mobile/lab/memoria.js`](../../bench/spike-mobile/lab/memoria.js)) num iPhone real e no Chrome do Mac mini. Os experimentos são os X1 a X5 da [análise forense](forense-iphone-2026-11-22.md), seção 7.

**Rótulos.** **[MEDIDO: arquivo]** está no arquivo citado, em `bench/results/`; **[HIPÓTESE]** é inferência. MiB = 2²⁰ B; MB/s = 10⁶ B/s.

**Sessões.**

| Sessão | Aparelho e navegador | O que rodou |
|---|---|---|
| `2026-11-23-iphone-2011` | iPhone; *user agent* `… iPhone OS 18_7 … Version/26.7.2 Mobile/15E148 Safari/604.1 Brave` — o navegador **Brave** (WebKit do iOS), não o Safari **[MEDIDO: `…-2011-logs.jsonl`]** | fluxo antigo, uma página por etapa: vagas `ort`, rampas de GPU e de host. Caiu num **laço de quedas** (seção 8) |
| `2026-11-23-iphone-2124` | o mesmo iPhone; `… Version/26.6.3 Mobile/15E148 Safari/604.1` (Safari) **[MEDIDO: `…-2124-logs.jsonl`]** | página única ([`memoria-unica.html`](../../bench/spike-mobile/lab/memoria-unica.html)): vagas restantes, OPFS, `writeBuffer`, rampa com Wasm, caminho monolítico |
| `2026-11-23-desktop-1920`, `-1958` | Mac mini M1 16 GB, Chrome 157/158, perfil dedicado | perfil `memoria` inteiro, com tetos de desktop |
| `2026-11-23-desktop-2057`, `-2059` | idem | validação da correção do laço (queda simulada) |

O modelo e a RAM do iPhone não estão registrados (o navegador não os expõe): os números valem para **este** aparelho.

## 1. O teto da aba no iPhone: um orçamento só, de ~1,7 a 2,0 GiB

A página não vê nenhuma medida de memória; o teto sai do último marcador gravado **antes** do passo de 64 MiB que derrubou a aba.

| Rampa | Último total confirmado → passo em que morreu | Mortes | Arquivo |
|---|---|---:|---|
| GPU, *buffers* `STORAGE` de 64 MiB cheios | 1.664 a 1.792 MiB → morreu ao pedir 1.728 a 1.856 MiB | 4 | **[MEDIDO: `2026-11-23-iphone-2011-logs.jsonl`, marcadores de `gpu-rampa`]** |
| GPU depois de 256 MiB num `ArrayBuffer` | até 1.536 MiB de GPU (+ 256 MiB de host) → morreu ao pedir 1.600 MiB | 5 (numa delas, com só 384 MiB confirmados) | **[MEDIDO: idem, `gpu-rampa-ab256`]** |
| GPU depois de 256 MiB numa memória Wasm não compartilhada | 1.472 MiB de GPU (+ 256 MiB de Wasm) → morreu ao pedir 1.536 MiB | 1 | **[MEDIDO: `2026-11-23-iphone-2124-gpu-rampa-wasm256.json`]** |
| Host, `ArrayBuffer`s de 64 MiB | 1.856 a 1.984 MiB → morreu ao pedir 1.920 a 2.048 MiB | 160 (o laço) | **[MEDIDO: `2026-11-23-iphone-2011-logs.jsonl`, marcadores de `host-rampa`]** |

- **GPU, `ArrayBuffer` e Wasm somam no mesmo limite.** Sozinha, a GPU chega a ~1,7–1,8 GiB; com 256 MiB de host antes, a GPU para ~256 MiB mais cedo e o total fica no mesmo ~1,8 GiB; o host sozinho chega a ~1,9–2,0 GiB **[MEDIDO: as linhas acima]**. É uma conta só, a do processo da aba, coerente com o “ActiveHard 2048 MB” relatado para o iOS 26 **[HIPÓTESE: a confirmar pelo `JetsamEvent`]**.
- Nenhuma rampa recebeu `GPUOutOfMemoryError`, `RangeError` nem `device.lost`: a aba simplesmente morreu **[MEDIDO: nenhuma etapa de rampa terminou em `erro` no iPhone]**.
- A morte com só 384 MiB numa das cargas da `gpu-rampa-ab256` veio numa sequência de quedas seguidas; memória ainda não devolvida do processo anterior é a explicação provável **[HIPÓTESE]**.
- O adaptador aceita *buffers* de 1 GiB (`maxBufferSize` 1.073.741.824) **[MEDIDO: `2026-11-23-iphone-2011-sonda.json`]**, mas isso é só validação: o teto é a aba.

## 2. Vagas de memória Wasm: contagem de 3, só para as compartilhadas com máximo grande

| Descritor | Resultado | Arquivo |
|---|---|---|
| `ort` `{initial:256, maximum:65536, shared:true}` | 3 criadas; a 4ª: `RangeError: Out of memory` | **[MEDIDO: `2026-11-23-iphone-2011-vagas-ort.json`]** |
| `max1g` `{initial:256, maximum:16384, shared:true}` | 3; a 4ª: `RangeError: Out of memory` | **[MEDIDO: `2026-11-23-iphone-2124-vagas-max1g.json`]** |
| `shim` `{initial:0, maximum:0, shared:true}` | 16 de 16; com elas presas, ainda 3 `ort` | **[MEDIDO: `…-2124-vagas-shim.json`]** |
| `minima` `{initial:1, maximum:1}` | 16 de 16 | **[MEDIDO: `…-2124-vagas-minima.json`]** |
| `naoCompart` `{initial:256, maximum:65536}` | 16 de 16, mesmo sem nenhuma vaga `ort` livre naquele momento | **[MEDIDO: `…-2124-vagas-naocompart.json`, `ortComEstasPresas`: 0]** |

- **É contagem, não bytes.** O teto de 3 vale igual para máximo de 4 GiB e de 1 GiB **[MEDIDO]**; 3 × 1 GiB está longe do Gigacage de 16 GiB, então não é falta de espaço **[HIPÓTESE forte]**.
- **As não compartilhadas escapam.** `naoCompart` (o descritor do ONNX Runtime sem `shared`) criou 16 com as vagas tomadas **[MEDIDO]**: o motor cai para outro modo de memória **[HIPÓTESE]**. Um build sem threads, de memória não compartilhada, não esbarraria no teto de 3.
- **As vagas voltam pela coleta.** Soltas as referências e pressionado o coletor, a contagem volta a 3 a 1, 10 e 60 s, e o livro-caixa vê as memórias coletadas (3, 6, 9) **[MEDIDO: `…-2011-vagas-ort.json`, `liberacao`]**. Num Worker também cabem 3, e depois do `terminate()` a página volta a ter 3; depois da navegação, 3 **[MEDIDO: idem e `…-2011-vagas-ort-navegacao.json`]**. Em 2026-11-22 as vagas não voltavam porque o ONNX Runtime mantém as referências **[HIPÓTESE]**.
- **O que não se separa:** se memórias não compartilhadas presas ocupam vagas. Depois do `shim`, as 3 `ort` de prova foram soltas mas ainda não coletadas, e a contagem seguinte (`minima`, `naoCompart`) achou 0 `ort` livres; os dados não separam essas duas causas **[MEDIDO: `ortComEstasPresas` = 0; a causa é HIPÓTESE]**.

## 3. OPFS → GPU: o número da execução fora do núcleo (`C-07`)

Arquivo de 1 GiB no OPFS, lido em blocos de 4 MiB num Worker por `FileSystemSyncAccessHandle` (disponível no Safari do iPhone **[MEDIDO]**), enviado por `writeBuffer` a um anel de 3 placas de 64 MiB, com um kernel WGSL que soma cada placa (soma conferida em todas as passadas) e espera da fila a cada 64 MiB:

| | Passada 1 | Passada 2 | Passada 3 | Placas de 256 MiB cobrindo 1 GiB (residente) | Arquivo |
|---|---:|---:|---:|---:|---|
| iPhone | 2.022 MB/s (531 ms) | 2.926 MB/s (367 ms) | 2.983 MB/s (360 ms) | 2.718 MB/s (395 ms) | **[MEDIDO: `2026-11-23-iphone-2124-opfs-streaming.json`]** |
| Mac mini, Chrome | 4.070 MB/s (264 ms) | 4.119 MB/s (261 ms) | 4.249 MB/s (253 ms) | 3.948 MB/s (272 ms) | **[MEDIDO: `2026-11-23-desktop-1958-opfs-streaming.json`]** |

- **Por passada fora do núcleo: ~0,36 s por GiB no iPhone, ~0,25 s no desktop**, depois da primeira (0,53 s no iPhone) **[MEDIDO: tempos acima]**. Um modelo de 1 GiB lido inteiro a cada passada custaria ~0,4 s por lote de decisões no iPhone **[HIPÓTESE: sem contar o cálculo]**.
- Leitura do OPFS sozinha no iPhone: 2.260 a 4.130 MB/s; escrita do arquivo de 1 GiB: 259 MB/s **[MEDIDO: idem]**.
- 1 GiB residente na GPU, em 4 placas, **não derrubou a aba** nesse processo **[MEDIDO: idem, fase `placas`]**.

## 4. `writeBuffer` e o processo de GPU

| | Com espera a cada 64 MiB | Sem espera | Arquivo |
|---|---|---|---|
| iPhone, 8 GiB | 4.601 MB/s | 8 GiB enfileirados a 3.452 MB/s, fila drenada em 0 ms; **nenhuma perda do dispositivo** | **[MEDIDO: `2026-11-23-iphone-2124-gpu-escrita.json`]** |
| Mac mini, 2 GiB | 4.954 MB/s | 6.517 MB/s, drenada em 7 ms; sem perda | **[MEDIDO: `2026-11-23-desktop-1920-gpu-escrita.json`]** |

O processo de GPU do iPhone tolerou 8 GiB de `writeBuffer` sem esperar a fila: as chamadas é que demoram (o enfileiramento já anda no ritmo da GPU) **[MEDIDO e HIPÓTESE sobre o mecanismo]**. Blocos de 4 MiB com espera a cada 64 MiB, como no `K-03`, são seguros.

## 5. A carga monolítica de hoje derruba a aba a partir de 1 GiB

O caminho de hoje (`engines/fetch.js`: o arquivo inteiro em pedaços e depois numa cópia concatenada, e então `writeBuffer`):

- **512 MiB: sobreviveu**, 954 MB/s ponta a ponta **[MEDIDO: `2026-11-23-iphone-2124-opfs-monolitico.json`]**;
- **1 GiB: a aba morreu** ao montar o arquivo inteiro num `Uint8Array` (último marcador: “o arquivo inteiro de 1024 MiB num Uint8Array”) **[MEDIDO: idem]**. Pedaços + cópia somam ~2 GiB de host, acima do teto da seção 1 **[HIPÓTESE]**.
- No desktop, o mesmo caminho passa com 1 GiB (1.438 MB/s ponta a ponta) **[MEDIDO: `2026-11-23-desktop-1958-opfs-monolitico.json`]**.

O streaming em blocos (seção 3) carrega o mesmo 1 GiB residente sem matar a aba.

## 6. Faixas para a `C-08`

Regra desta tabela **[HIPÓTESE]**: faixa de pesos + ativações residentes = **50%** do menor teto medido do aparelho, porque a aba ainda precisa de heap de JavaScript, do *staging*, do runtime e de folga para picos.

| Classe | Teto medido (menor, a conta toda) | Faixa residente candidata | Acima da faixa |
|---|---|---|---|
| Este iPhone (Safari 26.6.3 / WebKit do iOS 26.7.2) | ~1,66 GiB de GPU sozinha; ~1,72 GiB GPU + Wasm **[MEDIDO: seção 1]** | **~800 MiB** | fora do núcleo, a ~0,36 s/GiB por passada (`C-07`) |
| Mac mini M1, Chrome 158 | ≥ 3 GiB de GPU e ≥ 2 GiB de host (só um piso: as rampas pararam no teto do teste) **[MEDIDO: `2026-11-23-desktop-1958-*`]** | ≥ 1,5 GiB | — |
| Android | não medido | — | — |

A faixa de partida do roadmap (“até ~400 MB em qualquer iPhone; ~1 GB só nos recentes”) fica dentro desta medição; os ~800 MiB valem para este aparelho e para os de RAM igual ou maior **[HIPÓTESE]**.

## 7. Horários das quedas (hora local, America/Sao_Paulo) — para casar com os `JetsamEvent`

Hora do último marcador; a queda veio logo depois **[MEDIDO: `…-logs.jsonl`, convertido de UTC para UTC−3]**:

- **2026-11-23, Brave (sessão 2011):** `gpu-rampa` 4 quedas entre **20:13:29 e 20:13:34**; `gpu-rampa-ab256` 5 quedas entre **20:18:34 e 20:18:39**; `host-rampa` 160 quedas entre **20:23:40 e 20:53:46** (o laço).
- **2026-11-23, Safari (sessão 2124):** `gpu-rampa-wasm256` às **21:25:41**; `opfs-monolitico` às **21:25:46**.
- **2026-11-22** (as mortes do ONNX Runtime WebGPU da análise forense): entre **02:46 e 02:48**.

No iPhone: **Ajustes → Privacidade e Segurança → Análise e Melhorias → Dados de Análise**, arquivos `JetsamEvent-2026-11-23-…`.

## 8. Defeito do laboratório achado e corrigido: o laço de quedas

Na sessão 2011, depois de cada morte por jetsam o navegador trouxe a página de etapa de volta **sem** navegação do tipo `reload`. A detecção de recarga do `hook.js` não viu nada, e a página rodou a rampa de novo: 160 vezes a `host-rampa` em 30 minutos; a `gpu-rampa` e a `gpu-rampa-ab256` terminaram por tempo esgotado depois de várias cargas **[MEDIDO: `2026-11-23-iphone-2011-lab.json`, `-logs.jsonl`]**.

A correção ([`hook.js`](../../bench/spike-mobile/lab/hook.js), [`memoria-unica.js`](../../bench/spike-mobile/lab/memoria-unica.js)): a página de etapa conta os próprios inícios no servidor, num pedido síncrono antes de qualquer outro script, e no `localStorage`. Um segundo início da mesma etapa é queda: volta ao laboratório e nunca roda de novo. A página única grava o andamento antes de cada experimento, registra o que estava rodando como `morreu` e segue para o próximo; mais de 3 cargas em 60 s param a página. Validado no desktop com uma queda simulada que volta como navegação comum (`Page.crash` e nova navegação à mesma URL): `vagas-ort` ficou `crashed`, sem repetir, e o servidor registrou “started 2 times (navigation navigate)” **[MEDIDO: `2026-11-23-desktop-2059-lab.json`]**; na página única, `opfs-streaming` ficou `morreu` e os 3 seguintes rodaram **[MEDIDO: `2026-11-23-desktop-2057-lab.json`]**.

## 9. Desktop, como referência

No Chrome do Mac mini **[MEDIDO: `2026-11-23-desktop-1920-*`, `-1958-*`]**:

- as rampas chegaram aos tetos do teste (3 GiB de GPU, 2 GiB de host), também depois de 256 MiB de host ou de Wasm;
- todas as variantes de vaga Wasm deram 16 de 16;
- o livro-caixa vê agora o dispositivo do ONNX Runtime: na WebGPU, `q8emb32-f16` vai de 23,24 a 201,75 MiB de GPU durante a primeira passada e fica estável no resto das 189 decisões; o `@johnhenry` `f32` vai de 75,45 a 189 MiB; o `dispose()` devolve tudo **[MEDIDO: `2026-11-23-desktop-1920-ort-webgpu-q8emb32-f16-17m.json`, `…-jh-webgpu-f32-17m.json`]**.

## 10. O que continua aberto

- **A causa das quedas** de 2026-11-22 e de hoje pelo `JetsamEvent` (os horários estão na seção 7): falta o dono ler os Dados de Análise.
- **Android:** não medido; não há aparelho.
- **ONNX Runtime WebGPU no iPhone com o livro-caixa (X4):** não refeito; só há o desktop (seção 9).
- **Vagas:** se memórias não compartilhadas presas ocupam vagas (seção 2).
- **Brave e Safari:** a sessão 2011 rodou no Brave; as duas usam o WebKit do iOS, mas a versão declarada difere (26.7.2 e 26.6.3) **[MEDIDO]**. A comparação entre as rampas das duas sessões vale com essa ressalva.
