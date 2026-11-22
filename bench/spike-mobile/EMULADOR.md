# Emulador Android para o marco T

Como subir o aparelho virtual, servir a página do computador para o Chrome dele e recolher o resultado — com os comandos exatos usados em 2026-11-21 (atividade `T-07` do [roadmap](../../ROADMAP.md#mt)). Todo o resto do marco T usa este procedimento.

> **O que o emulador mede.** Se funciona no Chrome para Android, quanto baixa, quanta memória usa, e a comparação entre motores no mesmo ambiente. **Não** mede latência de celular: o processador é o do computador (x86_64) e a GPU é emulada. Toda latência medida aqui é indicativa.
>
> **No Mac mini** (arm64), o mesmo procedimento com as ferramentas do SDK, um aparelho virtual dedicado e os resultados da `T-08`: [MACMINI.md, seção 7](MACMINI.md#7-emulador-android-no-mac-t-08).

## 1. Ambiente registrado

| Item | Valor **[MEDIDO em 2026-11-21]** |
|---|---|
| Computador | Windows 11 Home 10.0.26200; aceleração WHPX |
| Emulador | Android Emulator 37.2.13.0 (build 16740729) |
| Aparelho virtual | `jev_playstore_36` (Pixel 6, `google_apis_playstore`, x86_64, 4 GB de RAM) |
| Imagem | `google/sdk_gphone64_x86_64/emu64xa:16/BE2A.250530.026.D1/13818094:user/release-keys` |
| Android | 16 (API 36) |
| Chrome | **133.0.6943.137**, o que vem na imagem |
| Núcleos e memória vistos pela página | `hardwareConcurrency` 4; `deviceMemory` 4 |

**O Chrome não foi atualizado.** A Play Store pede uma conta Google, e o aparelho virtual não tem nenhuma (`dumpsys account` → `Accounts: 0`); entrar com a conta do dono exige a credencial dele. Fica como **pendência externa**: com uma conta no emulador, atualizar o Chrome pela Play Store e repetir as medições. Até lá, os resultados valem para o Chrome 133.

## 2. Preparar (uma vez)

A imagem de sistema do Android 36 tinha sido removida do SDK; os aparelhos virtuais continuavam lá. Reinstalação, como a skill `android-agent-skill` prevê:

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.13.21-hotspot"
& "$env:LOCALAPPDATA\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat" --install "system-images;android-36;google_apis_playstore;x86_64"
```

No computador, na raiz do repositório:

```bash
python bench/spike-mobile/fetch-models.py     # modelos fixados, conferidos por SHA-256 (só para a página de teste)
cd bench/spike-mobile && npm ci --ignore-scripts && cd -
node bench/spike-mobile/serve.mjs              # http://localhost:8377 — deixe rodando
```

## 3. Subir o emulador

**GPU por software** (a configuração do aparelho, `hw.gpu.mode=swiftshader_indirect`) — é o padrão da skill quando não há janela:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$HOME\Agent-Skills\android-agent-skill\scripts\android.ps1" avd start -Name jev_playstore_36
```

A skill executa `emulator -avd jev_playstore_36 -port 5554 -no-boot-anim -no-snapshot -accel on -netfast -no-metrics -no-audio -no-window -gpu swiftshader_indirect` e espera `sys.boot_completed=1`.

**GPU do computador** (`-gpu host`), com janela:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$HOME\Agent-Skills\android-agent-skill\scripts\android.ps1" avd stop
& "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -avd jev_playstore_36 -port 5554 -no-boot-anim -no-snapshot -accel on -netfast -no-metrics -no-audio -gpu host
```

## 4. Abrir uma página e recolher o resultado

```bash
export MSYS_NO_PATHCONV=1   # só no Git Bash: impede que /data/local/tmp vire um caminho do Windows
node bench/spike-mobile/run-android.mjs --result 2026-11-21-emulador-probe-swiftshader-sem-flags \
     --path "/probe.html?name=2026-11-21-emulador-probe-swiftshader-sem-flags" --flags ""
```

O `run-android.mjs`:

1. apaga os dados do Chrome (`pm clear com.android.chrome`; `--keep-data` desliga): o Chrome do Android **restaura as abas da sessão anterior**, e em 2026-11-21 páginas de execuções antigas voltaram a rodar ao lado da execução medida, regravaram resultados antigos e se acumularam até o Android do emulador parar de responder. Com os dados apagados, cada execução é também uma primeira visita de verdade (sem cache);
2. marca o Chrome como app de depuração (`am set-debug-app --persistent com.android.chrome`), o que faz o Chrome ler `/data/local/tmp/chrome-command-line`;
3. grava nesse arquivo `--disable-fre --no-default-browser-check --no-first-run` (pula a tela de boas-vindas) e as flags pedidas em `--flags`;
4. faz `adb reverse tcp:8377 tcp:8377`: no emulador, `http://localhost:8377` é o servidor do computador — e `localhost` é **contexto seguro**, que a Decisions API e o isolamento de origem exigem (`10.0.2.2` não seria);
5. reinicia o Chrome e abre a página com `am start -a android.intent.action.VIEW`;
6. espera a página postar o JSON em `bench/results/` e acrescenta `device` (imagem, versão do Chrome, flags, linha de comando do emulador) e `androidMemory` (PSS de cada processo do Chrome, de `dumpsys meminfo --package com.android.chrome`, a cada 5 s). Se a página não postar no prazo, grava a falha com a última etapa que ela reportou.

A amostragem é só do Chrome e espaçada para pesar pouco no aparelho durante a medição.

O aviso de notificações que o Chrome mostra não impede a página de rodar. Para fechá-lo: `android.ps1 ui dump -Text` e `android.ps1 tap <x> <y>` em “No thanks”.

**Conferir as flags em uso.** Pelo protocolo de depuração do Chrome no aparelho:

```bash
adb -s emulator-5554 forward tcp:9223 localabstract:chrome_devtools_remote
# abra chrome://version numa aba nova via http://127.0.0.1:9223/json/new?chrome://version e leia "Command Line"
```

Em 2026-11-21 a linha de comando mostrou `--enable-unsafe-webgpu --enable-features=Vulkan` quando essas flags foram pedidas.

## 5. Resultados

Página [`probe.html`](probe.html), quatro configurações, uma execução cada **[MEDIDO]**:

| GPU do emulador | Flags do Chrome | `navigator.gpu` | `requestAdapter()` | Arquivo |
|---|---|---|---|---|
| `swiftshader_indirect` | nenhuma | existe | `null` (alto desempenho e baixo consumo) | [`…-swiftshader-sem-flags.json`](../results/2026-11-21-emulador-probe-swiftshader-sem-flags.json) |
| `swiftshader_indirect` | `--enable-unsafe-webgpu --enable-features=Vulkan` | existe | `null` | [`…-swiftshader-flags-webgpu.json`](../results/2026-11-21-emulador-probe-swiftshader-flags-webgpu.json) |
| `host` | nenhuma | existe | `null` | [`…-gpuhost-sem-flags.json`](../results/2026-11-21-emulador-probe-gpuhost-sem-flags.json) |
| `host` | `--enable-unsafe-webgpu --enable-features=Vulkan` | existe | `null` | [`…-gpuhost-flags-webgpu.json`](../results/2026-11-21-emulador-probe-gpuhost-flags-webgpu.json) |

**Não há WebGPU no Chrome deste emulador**, em nenhuma das quatro configurações. O caminho WebGPU só pode ser avaliado em aparelho real (ou no desktop).

WebAssembly, nas quatro: SIMD **sim**, SIMD relaxado **sim**, JSPI **não**, `Float16Array` **não**. Threads só com a página isolada (`?coi=1`, que faz o `serve.mjs` mandar COOP e COEP): [`…-swiftshader-coi.json`](../results/2026-11-21-emulador-probe-swiftshader-coi.json) mostra `crossOriginIsolated: true`, `SharedArrayBuffer` e threads.

**Confira a GPU em uso antes de medir.** O `avd start` da skill reaproveita um emulador que já esteja ligado — mesmo que tenha sido aberto com outra GPU. Desde 2026-11-21 o `run-android.mjs` grava em cada resultado a linha de comando do processo do emulador (`device.emulatorCommandLine`, com o `-gpu` usado), e a página registra o renderizador WebGL (`environment.webgl`): com GPU por software ele é “Android Emulator OpenGL ES Translator (Google SwiftShader)”.

## 6. Repetição

Seguindo só este arquivo, uma segunda execução — emulador reiniciado pela skill (linha de comando com `-no-window -gpu swiftshader_indirect`; renderizador WebGL SwiftShader) e a mesma sonda — chegou ao mesmo resultado: [`2026-11-21-emulador-probe-repeticao.json`](../results/2026-11-21-emulador-probe-repeticao.json).
