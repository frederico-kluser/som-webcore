# Mac mini: Safari no simulador de iPhone (e no macOS)

> Pedido do dono em 2026-11-21: continuar o marco T testando pelo Mac mini — o Safari do simulador de iPhone. Regras da skill `macmini`: **desenvolver no Acer** (aqui: código, commits, PRs) e **rodar e testar no Mac**, com tudo no HD externo `/Volumes/Ext2TB`; o disco interno do Mac precisa de pelo menos 50 GiB livres.

## 1. O que o Mac mini tem

Verificado em 2026-11-21 por SSH **[MEDIDO]**:

| Item | Valor |
|---|---|
| Máquina | Mac mini M1 (`minim1`), 16 GB, macOS 27.2 |
| Doctor da skill | G1–G3 e G5–G9 verdes; G4 (login direto como root por chave) vermelho, desnecessário aqui (o `sudo -n` funciona) |
| Disco | interno com 61 GiB livres (mínimo 50); `/Volumes/Ext2TB` com 1,1 TiB livres |
| Xcode | 27.1 (27A9269) |
| Simulador | um runtime: **iOS 27.0** (24A434). Aparelhos: `iPhone 18 Pro`, `Folio iPhone 18 Pro Max` e `UltraWatch iPhone` — este último **ligado por outro projeto**, não se mexe nele |
| Navegadores | Safari 27.2 (macOS) e Google Chrome |
| Ferramentas | Node 24.19.0, Python 3.14.7, git |
| Projeto | não clonado na verificação; depois, em `/Volumes/Ext2TB/Projects/som-webcore` (§4) |
| Android | SDK em `/Volumes/Ext2TB/Android/sdk` (emulador 37.2.12, imagem Android 36 `google_apis` arm64-v8a); o aparelho virtual `jev_pixel` é de outro projeto |

**Safari 26 ou 27.** O pedido falava em Safari 26. O runtime instalado é o do iOS 27.0, cujo Safari é da linha 27; o WebGPU vem ativo por padrão desde o Safari 26 em macOS, iOS, iPadOS e visionOS **[REPORTADO: [web.dev, “WebGPU is now supported in major browsers”](https://web.dev/blog/webgpu-supported-major-browsers); errata `E-20`]**. Instalar o runtime do iOS 26 custaria vários GB no disco **interno** (o CoreSimulator não funciona no HD externo, segundo a skill), então só se o dono pedir.

**WebGPU no simulador: não há adaptador** (medido, §5). O WebKit teve problemas para compilar o WebGPU no SDK do simulador; o bug [308753, “Enable WebGPU Swift on iPhone simulator”](https://bugs.webkit.org/show_bug.cgi?id=308753) foi fechado como corrigido em 2026-03-03 **[REPORTADO]**. No iOS 27.0 do simulador o `navigator.gpu` existe, mas `requestAdapter()` devolve `null`.

## 2. O que o simulador mede — e o que não mede

O simulador roda no processador e na GPU do Mac (Apple M1), não no hardware de um iPhone. Como no emulador Android, ele serve para saber **se funciona** no Safari do iOS (WebKit), quanto baixa, quanta memória usa e para **comparar motores**; **não** serve como latência de iPhone. Toda latência medida aqui é indicativa. Complementa a `T-08` (o emulador Android) com o motor WebKit; não substitui a `T-02` (iPhone real).

## 3. Plano, em ordem

1. **Clonar** o repositório em `/Volumes/Ext2TB/Projects/som-webcore` e instalar as dependências da página (`npm ci --ignore-scripts` em `bench/spike-mobile/`; o cache do npm já aponta para o HD externo).
2. **Modelos:** `SOM_MODEL_CACHE=/Volumes/Ext2TB/Caches/som-webcore/models python3 bench/spike-mobile/fetch-models.py` (revisões fixadas, SHA-256 conferido). Os arquivos derivados (`fp32` e `q8emb*`) vão do Acer por `scp`, conferidos pelo SHA-256 gravado nas execuções do ONNX Runtime nativo (`bench/results/2026-11-21-nativo-onnxruntime-cpu-*.json`, campo `engineInfo.fileSha256`).
3. **Servidor** `serve.mjs` no Mac, porta 8377, em segundo plano, com log em `/Volumes/Ext2TB/tmp`. O simulador usa a rede do Mac: `http://localhost:8377` é contexto seguro, sem `adb reverse`.
4. **Simulador dedicado:** criar um aparelho só do projeto (`som-webcore iPhone 18 Pro`, iOS 27.0), para poder apagá-lo à vontade sem tocar nos simuladores do dono.
5. **Executor `run-ios.mjs`:** antes de cada execução, apagar e religar o aparelho dedicado (o Safari também restaura abas, como o Chrome do Android); abrir a página com `xcrun simctl openurl`; esperar o resultado; gravar o aparelho, o runtime e a memória dos processos WebContent do aparelho (RSS no Mac).
6. **Sonda** (`probe.html`): WebGPU, WebAssembly, isolamento de origem — o equivalente da `T-07` para o iOS.
7. **Página de teste:** a mesma matriz do emulador Android — ONNX Runtime Web em Wasm (`int8`, `8bit`, `fp32`, `q8emb-f16` no 17M; `int8` e `8bit` no 32M) e motor `@johnhenry` em CPU; e, se houver WebGPU, `ort-webgpu`, `ort-webgpu-jsep` e `jh-webgpu`. Duas repetições por configuração. O `native` fica registrado como ausente (o Safari não tem `DecisionModel`).
8. **Depois, no mesmo Mac** (acrescentado em 2026-11-21, quando se viu que o Mac tem o SDK Android no HD externo): (a) o **emulador Android**, com um aparelho virtual só do projeto (`som-webcore-android36`: Android 36 `google_apis` arm64-v8a, Pixel 6, 4 GB, GPU por software — como o do Acer, mas arm64), para a `T-08` e as 200 decisões da `T-09`, paradas no Acer; (b) o **Chrome 157 do macOS** (WebGPU sobre Metal), para a validação da `T-01` no Chrome de desktop; (c) o **Chrome Canary** instalado no HD externo, para a página sobre o `DecisionModel` nativo (`T-03`). O Safari 27.2 do macOS fica para depois: serve à `A-05`, não ao marco T.
9. **Resultados:** copiados do Mac para o Acer por `scp` e versionados aqui, pelo fluxo do repositório.

## 4. Como foi feito (2026-11-21)

No Mac, por SSH a partir do Acer (`ssh macmini '…'`):

```bash
cd /Volumes/Ext2TB/Projects && git clone https://github.com/frederico-kluser/som-webcore.git
cd som-webcore/bench/spike-mobile && npm ci --ignore-scripts
export SOM_MODEL_CACHE=/Volumes/Ext2TB/Caches/som-webcore/models
python3 fetch-models.py                      # 20 arquivos conferidos por SHA-256 (299 MB)
# derivados: scp do Acer para $SOM_MODEL_CACHE/derived/…; SHA-256 igual ao de engineInfo.fileSha256
mkdir -p /Volumes/Ext2TB/tmp/som-webcore
SOM_MODEL_CACHE=$SOM_MODEL_CACHE TMPDIR=/Volumes/Ext2TB/tmp/som-webcore \
  nohup node serve.mjs > /Volumes/Ext2TB/tmp/som-webcore/serve.log 2>&1 &
cd /Volumes/Ext2TB/Projects/som-webcore
node bench/spike-mobile/run-ios.mjs --result <nome> --path "/probe.html?name=<nome>"
bash bench/spike-mobile/matrix-ios.sh "1 2"  # a matriz; não dar git pull enquanto roda
```

O `TMPDIR` no HD externo leva para lá o cache de compressão do servidor. O aparelho dedicado é `som-webcore iPhone 18 Pro` (UDID `4890F8D2-CE61-44D4-8758-F50E213389B3`), criado pelo `run-ios.mjs`.

**Armadilhas encontradas** (o executor e o servidor já tratam todas):

- Logo depois de apagar e religar o aparelho, o `simctl openurl` pode estourar o tempo (`NSPOSIXErrorDomain 60`), e a navegação do Safari às vezes fica parada na página inicial, com “localhost” carregando, sem nunca conectar no servidor (um segundo `openurl` carrega na hora). Uma espera fixa não bastou: uma execução da matriz ficou parada assim. Por isso o `run-ios.mjs` abre [`ready.html`](ready.html) até ela avisar o servidor, só então abre a página medida, espera o primeiro aviso dela (60 s) e, se não vier, apaga o aparelho e recomeça (até 3 tentativas). Quantas aberturas cada execução precisou fica em `device.attempts`.
- O servidor guarda o último progresso de cada nome de execução na memória: ao repetir um nome, o progresso antigo continua lá. O executor grava um marcador antes de abrir a página e só aceita um progresso diferente dele.
- Os processos WebKit do aparelho não aparecem no `launchctl` dele: são processos do Mac com `SIMULATOR_UDID=<udid>` no ambiente, e é por aí que o executor mede a memória (RSS).
- Os serviços do simulador não gravam no HD externo (TCC de volume removível): um `simctl io … screenshot` precisa ir para `/tmp`.
- O Safari só anuncia brotli em HTTPS: em `http://localhost` o servidor manda gzip.
- O disco interno do Mac guarda o swap e os dados do simulador; com o outro projeto ligado, o swap passou de 8 GB e o espaço livre caiu de 61 para 53 GiB durante o trabalho. As matrizes param sozinhas abaixo de 51 GiB (`MIN_FREE_GIB`).

## 5. Sonda do Safari no simulador

Duas execuções da [`probe.html`](probe.html) **[MEDIDO]** — iOS 27.0 (24A434), Mobile Safari 27.0 (8625.1.29.10.29), aparelho apagado antes:

| | Sem isolamento | Com `?coi=1` |
|---|---|---|
| `navigator.gpu` | existe | existe |
| `requestAdapter()` | `null` (alto desempenho e baixo consumo) | `null` |
| WebAssembly | SIMD sim; SIMD relaxado não; JSPI sim; threads não | SIMD sim; SIMD relaxado não; JSPI sim; **threads sim** |
| Outros | `Float16Array` sim; sem `performance.memory`; WebGL “Apple GPU”; `hardwareConcurrency` 8 | `crossOriginIsolated` verdadeiro |
| Arquivo | [`…-ios-simulador-probe.json`](../results/2026-11-21-ios-simulador-probe.json) | [`…-ios-simulador-probe-coi.json`](../results/2026-11-21-ios-simulador-probe-coi.json) |

**Não há WebGPU no Safari do simulador** (o objeto existe, o adaptador não), como no emulador Android: o caminho WebGPU no iOS só pode ser medido num iPhone real.

As duas sondas acima foram refeitas com o executor final (as primeiras gravavam uma descrição antiga do método de memória); o resultado não mudou.

## 6. Página de teste no simulador

A matriz (`bash bench/spike-mobile/matrix-ios.sh "1 2"`) rodou as dez configurações duas vezes; o primeiro resultado foi gravado às 21:13 e o último às 22:06 de 2026-11-21 no horário do Mac (00:13 e 01:06 UTC de 2026-11-22). Resultados, tabelas e conclusões: [relatório do marco T, seção 5](../../docs/reports/teste-mobile.md#5-safari-do-ios-no-simulador-complemento-da-t-08). Em resumo: o ONNX Runtime Web em Wasm e o `@johnhenry` em CPU rodam no Safari do iOS; os caminhos WebGPU falham por falta de adaptador; com o mesmo arquivo, o motor do navegador reproduz o ONNX Runtime nativo (menos no `int8`).

**A primeira navegação depois de religar não carregou em nenhuma das 22 execuções** (20 da matriz e as 2 sondas): a página de prontidão precisou de 2 aberturas em 17, de 3 em 4 e de 4 em 1 (`device.attempts`); nenhuma execução precisou recomeçar do zero.
