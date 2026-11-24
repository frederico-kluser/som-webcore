---
name: som-webcore-device-lab
description: "Laboratório de aparelho real do som-webcore: sobe no Mac mini um site de testes local (HTTPS na rede de casa, com uma CA própria do Mac; fechado por token), gera os QR codes para abrir no iPhone ou no Android, roda a página de teste com todos os motores, colhe todos os logs possíveis (console, erros, rede, WebGPU, ciclo de vida da página, ambiente estendido, livros-caixa de GPU e de Wasm) e analisa os resultados sozinho no fim. O perfil memoria (C-01) mede o orçamento de memória do aparelho até a aba cair, de propósito. Use quando o pedido for testar num celular ou iPhone de verdade, 'gera um QR pra eu abrir no meu iPhone', medir latência, WebGPU ou memória em aparelho real, ou repetir a T-02."
metadata:
  project: som-webcore
  runs-on: "Mac mini (ssh macmini), clone em /Volumes/Ext2TB/Projects/som-webcore"
  code: "bench/spike-mobile/lab/ (lab.html, lab.js, hook.js, memoria.html, memoria.js, opfs-worker.js, wasm-worker.js, start-lab.sh, stop-lab.sh, run-lab.mjs, analyze.py, analyze_memoria.py) e o modo laboratório do bench/spike-mobile/serve.mjs"
---

# Laboratório de aparelho — som-webcore

Uma sessão = um aparelho real abrindo a página-laboratório servida pelo **Mac mini** (pelo QR na primeira vez; depois, pelo endereço fixo). Ela roda a sonda do ambiente, uma verificação estendida (armazenamento, APIs, WebGL, um passe real de computação em WebGPU) e a página de teste para cada motor e variante, cada uma como uma navegação da aba, e manda tudo para o servidor. No fim, `analyze.py` escreve o relatório.

Em toda página da sessão, o `hook.js` mantém dois **livros-caixa**: o da GPU embrulha os protótipos do WebGPU (`GPU`, `GPUAdapter`, `GPUDevice`, `GPUBuffer`, `GPUTexture`, `GPUQueue`) e vê também o dispositivo e os *buffers* do próprio ONNX Runtime (bytes vivos por dispositivo, criados, destruídos e coletados, `device.lost` de todo dispositivo); o do Wasm embrulha `WebAssembly.Memory` (inicial, máximo, compartilhada e o erro exato), `grow` e a instanciação. E dá às páginas **marcadores à prova de queda**: `mark()` grava no `localStorage` e manda por `sendBeacon` **antes** de cada passo arriscado — a página de teste marca cada decisão —, e quando o Safari derruba a aba, o resultado da etapa leva o último marcador. Cada etapa também registra a **época de processo** em que rodou (seção do perfil `memoria`). `/` é uma página neutra: não roda motor nenhum.

**Regras:** tudo roda no Mac (regra da skill `macmini`: o Acer só desenvolve). O token do laboratório nunca entra no git: fica em `/Volumes/Ext2TB/State/som-webcore/lab-token` (e na `session.json` de cada sessão, em `/Volumes/Ext2TB/tmp/som-webcore/lab/<sessão>/`); a chave da CA local fica em `/Volumes/Ext2TB/State/som-webcore/lab-ca/` e também nunca entra no git. Pare a sessão ao terminar. Latência do aparelho é **[MEDIDO]**; os limites do portão GT são **[ALVO]**. Nunca mude um limite depois de medir.

## Por que HTTPS local (e a CA)

O dono quer o site **local** (sem Cloudflare). O Safari do iPhone só expõe WebGPU, `SharedArrayBuffer` (threads do Wasm) e o Wake Lock em **contexto seguro**, e `http://<ip-do-mac>` não é seguro. Por isso o modo padrão (`--modo local`) serve **HTTPS no endereço do Mac na rede de casa** (`https://192.168.100.84:8390` em 2026-11-22), com um certificado assinado por uma CA criada no próprio Mac. O aparelho precisa estar no mesmo Wi-Fi e confiar nessa CA **uma vez**:

1. escanear o QR da CA (`http://<ip>:8391/ca.crt`) e permitir o download do perfil;
2. **Ajustes → Perfil Transferido → Instalar** (ou **Ajustes → Geral → VPN e Gerenciamento de Dispositivos**);
3. **Ajustes → Geral → Sobre → Ajustes de Confiança de Certificados** → ligar “som-webcore device lab CA (Mac mini)”.

Depois disso, o QR do laboratório abre direto. Toda requisição precisa do cookie do laboratório, que só o link do QR (com o token aleatório) cria; sem ele, 404. O token é o mesmo em todas as sessões (`lab-token`; `--novo-token` troca) e o cookie dura 180 dias: **um aparelho que entrou uma vez abre `https://192.168.100.84:8390/lab/lab.html` (o `FIXED_URL=`) direto, em qualquer sessão** — o dono pediu esse endereço fixo. Alternativas: `--modo local-http` (HTTP na rede local, nada a instalar, **sem WebGPU**) e `--modo tunel` (HTTPS por um túnel temporário do Cloudflare; público enquanto a sessão roda).

## Procedimento (o agente executa)

1. **Atualizar o Mac** (o código vem do git; os modelos já estão no cache do HD externo — `MACMINI.md`, seção 4):
   ```bash
   ssh macmini 'cd /Volumes/Ext2TB/Projects/som-webcore && git pull --ff-only'
   ```
2. **Subir a sessão** (perfil `rapido` ≈ 110 MB e 5 min; `completo` ≈ 290 MB e 20–30 min; `onnx` só as etapas do ONNX Runtime; `extra` acrescenta o JSEP e o `@johnhenry` CPU 32M; `memoria` = o orçamento de memória da `C-01`, **derruba a aba de propósito** — seção própria abaixo):
   ```bash
   ssh macmini 'cd /Volumes/Ext2TB/Projects/som-webcore && bash bench/spike-mobile/lab/start-lab.sh --label iphone --perfil completo --sem-token'
   ```
   A saída traz `SESSION=`, `FIXED_URL=`, `QR_PNG=`, `CA_URL=`, `CA_QR_PNG=` e o QR da CA em texto. Com `--sem-token` (use sempre que a saída for para um agente), nada que carrega o token sai na tela: nem `URL=`, nem o QR do laboratório em texto — ele fica só no `QR_PNG`. Sem a opção, a saída traz também `URL=` e o QR do laboratório em texto. **Aparelho que já entrou:** diga ao dono para abrir o `FIXED_URL` e tocar em Começar — sem QR. **Aparelho novo:** copie os PNG para o scratchpad do Acer e abra-os na tela para o dono escanear (`scp macmini:<QR_PNG> <scratchpad>/qr.png` e, no Windows, `Start-Process <scratchpad>\qr.png`); na resposta, dê também as URLs e os passos da CA (seção acima).
3. **Acompanhar sem esperar o dono** — um Monitor no log do servidor (eventos: aparelho entrou, cada etapa, erros, fim):
   ```bash
   ssh -o ServerAliveInterval=30 macmini 'tail -n +1 -F /Volumes/Ext2TB/tmp/som-webcore/lab/<SESSION>/serve.log' | grep --line-buffered "\[lab\]"
   ```
   Arme com o tempo máximo e rearme se expirar. A linha `[lab] <SESSION> done` encerra a rodada.
4. **Analisar sozinho** quando o `done` chegar (ou quando o dono disser que acabou):
   ```bash
   ssh macmini 'cd /Volumes/Ext2TB/Projects/som-webcore && python3 bench/spike-mobile/lab/analyze.py <SESSION>'
   ```
   O relatório vai para `bench/results/<SESSION>-relatorio.md`. Leia-o e resuma para o dono: aparelho e navegador, WebGPU (adaptador e o teste de computação), o que rodou e o que falhou (com a mensagem), latência contra o alvo de 150 ms, paridade contra a referência e contra o nativo, erros dos logs, páginas ocultas ou recarregadas.
5. **Parar** a sessão (túnel, servidor e, se houver, o log do aparelho por cabo, com a cópia dos relatórios de queda da janela da sessão):
   ```bash
   ssh macmini 'cd /Volumes/Ext2TB/Projects/som-webcore && bash bench/spike-mobile/lab/stop-lab.sh <SESSION>'
   ```
6. **Versionar** (se a rodada vale como evidência): `scp` de `bench/results/<SESSION>-*` para o Acer, conferir que nenhum arquivo tem token ou dado pessoal, e entregar pelo fluxo do repositório (branch `test/…`, PR, squash merge), com uma linha no diário `docs/reports/execucao-autonoma.md`.

## Perfil `memoria` (`C-01`): o orçamento de memória do aparelho

Mede quanto uma página aloca antes de a aba cair, como cai, quantas memórias Wasm cabem num processo e o que as devolve, e a vazão do OPFS para a GPU — os experimentos X1 a X5 da [análise forense](../../docs/reports/forense-iphone-2026-11-22.md), seção 7, em [`lab/memoria.js`](../../bench/spike-mobile/lab/memoria.js), uma etapa por experimento:

| Etapa | O que mede | Cai de propósito no celular? |
|---|---|---|
| `vagas-ort`, `vagas-naocompart`, `vagas-max1g`, `vagas-minima`, `vagas-shim` | X1: quantas `WebAssembly.Memory` de cada descritor cabem (até 16, todas presas) e o erro exato da seguinte; com as delas presas, quantas do ONNX Runtime ainda cabem. Cada variante num **processo novo** | não |
| `vagas-ort` (continuação), `vagas-ort-navegacao` | X2: soltar as referências, pressionar o coletor e contar de novo a 1, 10 e 60 s; criar num Worker, `terminate()` e contar na página; contar de novo na etapa seguinte (navegação no mesmo site) | não |
| `gpu-rampa` (`simples`, `ab256`, `wasm256`) | X3: *buffers* `STORAGE` de 64 MiB, `mappedAtCreation`, cheios de bytes aleatórios (incompressíveis), até falhar ou morrer; antes, 256 MiB num `ArrayBuffer` ou numa memória Wasm não compartilhada | **sim** |
| `host-rampa` | o mesmo com `ArrayBuffer`s de 64 MiB | **sim** |
| `gpu-escrita` | tolerância do processo de GPU: `writeBuffer` de 4 MiB em 4 *buffers* fixos, primeiro esperando a fila a cada 64 MiB, depois sem esperar, até `device.lost`, a morte ou 8 GiB | talvez |
| `opfs-streaming` | X5: arquivos de 512 MiB e 1 GiB no OPFS, lidos em blocos de 4 MiB num Worker (`createSyncAccessHandle`; sem ele, `createWritable`/`file.stream()`, e o resultado diz qual rodou) e enviados à GPU: anel de 3 × 64 MiB com 3 passadas e um kernel WGSL que soma cada placa, e placas de 256 MiB cobrindo o arquivo; vazões de leitura, `writeBuffer`, ponta a ponta e por passada | talvez (1 GiB residente) |
| `opfs-monolitico` | o caminho de hoje: o arquivo inteiro num `Uint8Array` (`engines/fetch.js`) e depois `writeBuffer` | **sim**, em 1 GiB |
| `ort-webgpu-q8emb32-f16-17m`, `ort-wasm-…`, `…-apos-wasm`, `jh-webgpu-f32-17m` | X4: o ONNX Runtime WebGPU com os dois livros-caixa, primeiro num processo novo, depois logo após uma página do ONNX Runtime Wasm; o `@johnhenry` como linha de base | o ONNX Runtime WebGPU caiu 2 de 2 vezes em 2026-11-22 |

Todo resultado grava o *user agent*, o adaptador (informações, limites, recursos e `wgslLanguageFeatures`), `navigator.storage.estimate()`, os parâmetros, os tempos de cada passo, o último marcador e o desfecho: `completou`, `erro` (com a mensagem literal) ou `morreu` (escrito pelo laboratório quando o Safari derrubou a aba, com o último marcador e o que a página tinha medido até ali). **Teto:** nenhum no celular (até falhar ou morrer); no desktop, 3 GiB de GPU, 2 GiB de host e 2 GiB de `writeBuffer`, para o Mac mini continuar saudável; `?teto=<MiB>` na URL do laboratório muda (0 = sem teto). `?apenas=vagas` roda só as vagas (e as etapas limpas).

**Épocas de processo e quantas vezes fechar o Safari.** O que importa é o processo do Safari, não a aba. O laboratório conta uma época nova no início, a cada queda (o Safari recarrega a aba num processo novo) e a cada reinício; cada etapa grava a época e o que rodou antes dela no mesmo processo. As etapas que pedem um processo novo (as vagas, o `gpu-rampa-wasm256` e o ONNX Runtime) vêm logo depois de uma etapa que cai; se a anterior não caiu, o laboratório primeiro **adianta** outra etapa que deve cair e, só se não houver nenhuma, pede para fechar o Safari (o botão “Já fechei e reabri o Safari: continuar”). Nos outros perfis, ele também pede antes da 4ª inicialização do ONNX Runtime no mesmo processo. No iPhone, com as rampas caindo como esperado, a rodada pede **1 fechamento (o do início) e mais 0 a 2** **[HIPÓTESE]**; se nada cair, até 8.

**Avisar o dono antes de cada rodada** (o `start-lab.sh` imprime o aviso): a aba vai cair de propósito, várias vezes; fechar o Safari no seletor de apps antes de começar e tocar em “Já fechei e reabri o Safari: começar”; usar, se der, um perfil do Safari só do laboratório (Ajustes → Apps → Safari → Perfis; o QR do laboratório precisa ser escaneado uma vez dentro dele), **nunca o do dia a dia**; iPhone na tomada e sem outros apps pesados; se aparecer “ocorreu um problema repetidamente”, tocar em Recarregar (o `hook.js` vê a recarga e volta ao laboratório). O OPFS chega a 1,5 GiB por alguns minutos; a etapa apaga os arquivos e, se a aba morrer antes, o laboratório apaga as sobras ao voltar.

**Página única (sem navegação).** `https://<Mac>:8390/lab/memoria-unica.html` (o mesmo cookie de 180 dias; sessão do `start-lab.sh --perfil memoria`) roda numa só página as vagas `shim`, `minima`, `naoCompart` e `max1g`, `opfs-streaming`, `gpu-escrita`, `gpu-rampa-wasm256` e `opfs-monolitico` (o ONNX Runtime e o `@johnhenry` precisam de navegação e ficam de fora). Grava o andamento no `localStorage` e no servidor antes de cada experimento; ao recarregar, o que estava rodando vira `morreu`, com o último marcador, e a página segue para o próximo, sem repetir; mais de 3 cargas em 60 s param a página. Os resultados vão para os mesmos arquivos e o `analyze.py` os lê. **Laço de queda (iPhone, 2026-11-23):** depois de um jetsam, o Safari trouxe a página de etapa de volta sem navegação do tipo `reload`, e ela repetiu a rampa ~200 vezes; agora a página de etapa conta os próprios inícios no servidor e no `localStorage`, e um segundo início é queda.

**Validar antes no desktop** (o Chrome do Mac mini, perfil dedicado no HD externo, pelo servidor real do laboratório; reabre o navegador quando o laboratório pede um processo novo e amostra a memória dos processos):
```bash
ssh macmini 'cd /Volumes/Ext2TB/Projects/som-webcore && bash bench/spike-mobile/lab/start-lab.sh --label desktop --perfil memoria --sem-token'
ssh macmini 'cd /Volumes/Ext2TB/Projects/som-webcore && TMPDIR=/Volumes/Ext2TB/tmp/som-webcore node bench/spike-mobile/lab/run-lab.mjs --session <SESSION>'
```
O executor confia só na chave do servidor do laboratório (`--ignore-certificate-errors-spki-list`, que o Chrome só aceita com `--user-data-dir`) e põe o cookie pelo DevTools: o token não aparece em URL, histórico nem saída. A memória dos processos do Chrome (RSS a cada 500 ms; `phys_footprint` a cada 2 s, que inclui a memória de GPU) vai para `bench/results/<SESSION>-desktop.json`.

**Logs do aparelho por cabo (opcional).** Com a libimobiledevice no Mac (`idevice_id`, `idevicesyslog`, `idevicecrashreport`) e o iPhone ligado por cabo e confiando no Mac, o `start-lab.sh` grava o `idevicesyslog` filtrado (memorystatus, jetsam, WebContent, GPU, WebKit) em `<pasta da sessão>/device-syslog.log`, e o `stop-lab.sh` copia os relatórios `JetsamEvent` e de queda da janela da sessão para `<pasta da sessão>/crash-reports/` (`--desde AAAA-MM-DD-HHMMSS` alarga a janela, por exemplo para 2026-11-22). Em 2026-11-23 a libimobiledevice **não está instalada** no Mac mini: os scripts dizem isso numa linha e seguem. Esses arquivos são logs do aparelho do dono: ficam fora do repositório.

## O que a sessão grava (em `bench/results/`)

| Arquivo | Conteúdo |
|---|---|
| `<SESSION>-lab.json` | as etapas e o estado de cada uma (o laboratório retoma daqui se o Safari recarregar a página) |
| `<SESSION>-sonda.json`, `-sonda-coi.json` | a sonda do ambiente, sem e com isolamento de origem |
| `<SESSION>-ambiente.json` | a verificação estendida (`lab.js`, `extraChecks`) |
| `<SESSION>-<motor>-<variante>-<modelo>.json` | cada execução da página de teste, no formato de sempre (`summarize.py`, `compare.py`, `check_shape.py`), mais o livro-caixa de cada decisão (`ledgerTrace`), os livros-caixa antes e depois do `dispose()`, a época de processo e o último marcador |
| `<SESSION>-<etapa>.json` do perfil `memoria` | cada experimento de `lab/memoria.js` (`kind: device-lab-memoria`): desfecho, parâmetros, passos, fases e vazões; se a aba morreu, escrito pelo `lab.js` com o último marcador e o resultado parcial |
| `<SESSION>-desktop.json` | só nas sessões do `run-lab.mjs`: versão do Chrome de cada abertura, reinícios e a memória dos processos (picos por etapa) |
| `<SESSION>-logs.jsonl` | tudo o que as páginas registraram (`lab/hook.js`): console, erros, rejeições, falhas de rede, WebGPU, visibilidade e recargas, o rastro da página (`trace=1`), os livros-caixa (`kind: ledger`, a cada 5 s e ao sair) e todos os marcadores (`kind: marker`) |
| `<SESSION>-requests.jsonl` | cada requisição respondida: caminho, estado, bytes, codificação e tempo |
| `<SESSION>-relatorio.md` | o relatório do `analyze.py` |

## Testar sem o aparelho (simulador de iOS no Mac)

O mesmo caminho do iPhone, de ponta a ponta: confiar na CA no simulador dedicado e abrir os links.

```bash
U=<udid do "som-webcore iPhone 18 Pro">
cp /Volumes/Ext2TB/State/som-webcore/lab-ca/ca.pem /tmp/som-lab-ca.pem      # o serviço do simulador não lê o HD externo
xcrun simctl keychain $U add-root-cert /tmp/som-lab-ca.pem && rm /tmp/som-lab-ca.pem
xcrun simctl openurl $U "<URL>"                  # repetir se a primeira navegação parar (MACMINI.md, seção 4)
xcrun simctl openurl $U "<base>/lab/lab.html?auto=1"   # roda sem o toque em “Começar”
```

## Problemas conhecidos

- **O iPhone não abre o endereço:** ele precisa estar no mesmo Wi-Fi do Mac; confira o IP na linha `URL=`.
- **“Esta conexão não é privada”:** a CA não foi instalada ou a confiança não foi ligada (passo 3 da seção da CA).
- **O túnel não sobe ou demora** (`--modo tunel`): veja `tunnel.log` na pasta da sessão; use `--modo local`.
- **A página de etapa recarregou** (o Safari recarrega a página cujo processo caiu): o `hook.js` vê a recarga, não deixa a etapa rodar de novo (cairia de novo, como o ONNX Runtime WebGPU no iPhone, que derrubou o processo duas vezes seguidas e terminou na tela “ocorreu um problema repetidamente”) e volta ao laboratório, que marca a etapa `crashed`, grava o resultado com o último marcador e começa uma época de processo nova. Uma etapa do perfil `memoria` ou que deve cair e volta sem resultado nem recarga conta como queda (inferida); as outras são repetidas uma vez e depois ficam `interrupted`.
- **A tela apagou ou o dono trocou de app:** o laboratório pede o Wake Lock no toque em “Começar”; os períodos ocultos aparecem nos logs e no relatório, e as medições dessas etapas ficam sob suspeita.
- **Etapas que travam** (ONNX Runtime WebGPU com `8bit`/`int8` travou no desktop): têm tempo limite curto e ficam no fim do perfil; se a página ficar parada, o dono toca em voltar.
- **Teto de memória do Wasm por processo (iPhone, Safari 26.6.3, 2026-11-22):** a memória do Wasm das sessões do ONNX Runtime não volta enquanto o processo web do Safari vive. Em cada processo, as 3 primeiras inicializações do ONNX Runtime passam e todas a partir da 4ª falham logo ao iniciar com `RangeError: Out of memory`, em Wasm e em WebGPU (os dois usam o runtime em Wasm); o `@johnhenry`, JavaScript puro, segue rodando. Até 2026-11-23, abrir `/` também contava, porque `/` rodava o ONNX Runtime; agora `/` é uma página neutra e a página de teste exige `?engine=` — análise em `docs/reports/forense-iphone-2026-11-22.md`. O perfil `memoria` mede se o limite é de contagem ou de bytes (as vagas).
  - Não resolveram: iframes, páginas próprias, aba aberta por `window.open` com `noopener` (continua no mesmo processo) e uma aba antiga reaberta à mão.
  - Resolveu: **fechar o Safari no seletor de apps**. As 3 etapas que tinham falhado rodaram em seguida.
  - O laboratório conta as inicializações do ONNX Runtime por época de processo e, no iPhone e no iPad, pede para fechar o Safari antes da 4ª. Uma etapa que ainda assim falha com `Out of memory` volta a pendente, até 3 vezes. O dono fecha o Safari, reabre-o no endereço fixo e toca em **“Já fechei e reabri o Safari: continuar”**. O relatório lista essas tentativas e diz que a repetição é a medição.
  - O perfil `onnx` repete só as etapas do ONNX Runtime; em todos os perfis, as do ONNX Runtime WebGPU vêm primeiro, logo depois das etapas limpas.
- **Tela ligada:** o Safari só concede o Wake Lock com um toque; as páginas de etapa registram `NotAllowedError`, e o dono precisa manter a tela acesa.
- **Os pesos ficam em cache entre as etapas** (`cache=1`): cada arquivo cruza a rede uma vez; por isso o tempo até a primeira resposta da sessão não é de primeira visita.
