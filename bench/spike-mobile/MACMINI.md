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
| Projeto | ainda não clonado em `/Volumes/Ext2TB/Projects/som-webcore` |

**Safari 26 ou 27.** O pedido falava em Safari 26. O runtime instalado é o do iOS 27.0, cujo Safari é da linha 27; o WebGPU vem ativo por padrão desde o Safari 26 em macOS, iOS, iPadOS e visionOS **[REPORTADO: [web.dev, “WebGPU is now supported in major browsers”](https://web.dev/blog/webgpu-supported-major-browsers); errata `E-20`]**. Instalar o runtime do iOS 26 custaria vários GB no disco **interno** (o CoreSimulator não funciona no HD externo, segundo a skill), então só se o dono pedir.

**WebGPU no simulador: não se sabe.** O WebKit teve problemas para compilar o WebGPU no SDK do simulador; o bug [308753, “Enable WebGPU Swift on iPhone simulator”](https://bugs.webkit.org/show_bug.cgi?id=308753) foi fechado como corrigido em 2026-03-03 **[REPORTADO]**. Se o Safari do simulador iOS 27.0 expõe um adaptador é a primeira coisa a medir.

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
8. **Depois:** Safari 27.2 e Chrome no macOS (WebGPU sobre Metal), que também servem à `P-14` (uma das três máquinas reais).
9. **Resultados:** copiados do Mac para o Acer por `scp` e versionados aqui, pelo fluxo do repositório.

Os comandos exatos entram neste arquivo à medida que cada passo for executado.
