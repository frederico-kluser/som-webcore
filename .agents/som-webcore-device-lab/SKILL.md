---
name: som-webcore-device-lab
description: "Laboratório de aparelho real do som-webcore: sobe no Mac mini um site de testes (HTTPS por um túnel temporário do Cloudflare, fechado por token), gera um QR code para abrir no iPhone ou no Android, roda a página de teste com todos os motores, colhe todos os logs possíveis (console, erros, rede, WebGPU, ciclo de vida da página, ambiente estendido) e analisa os resultados sozinho no fim. Use quando o pedido for testar num celular ou iPhone de verdade, 'gera um QR pra eu abrir no meu iPhone', medir latência ou WebGPU em aparelho real, ou repetir a T-02."
metadata:
  project: som-webcore
  runs-on: "Mac mini (ssh macmini), clone em /Volumes/Ext2TB/Projects/som-webcore"
  code: "bench/spike-mobile/lab/ (lab.html, lab.js, hook.js, start-lab.sh, stop-lab.sh, analyze.py) e o modo laboratório do bench/spike-mobile/serve.mjs"
---

# Laboratório de aparelho — som-webcore

Uma sessão = um aparelho real abrindo, pelo QR, a página-laboratório servida pelo **Mac mini**. Ela roda a sonda do ambiente, uma verificação estendida (armazenamento, APIs, WebGL, um passe real de computação em WebGPU) e a página de teste para cada motor e variante, cada uma num iframe, e manda tudo para o servidor. No fim, `analyze.py` escreve o relatório.

**Regras:** tudo roda no Mac (regra da skill `macmini`: o Acer só desenvolve). O token da sessão nunca entra no git: fica em `/Volumes/Ext2TB/tmp/som-webcore/lab/<sessão>/`. O túnel é público enquanto a sessão roda — pare a sessão ao terminar. Latência do aparelho é **[MEDIDO]**; os limites do portão GT são **[ALVO]**. Nunca mude um limite depois de medir.

## Por que HTTPS (e o túnel)

O Safari do iPhone só expõe WebGPU, `SharedArrayBuffer` (threads do Wasm) e o Wake Lock em **contexto seguro**. `http://<ip-do-mac>` não é seguro. O modo padrão (`--modo tunel`) usa um *quick tunnel* do Cloudflare (`cloudflared`, já instalado no Mac): `https://<palavras>.trycloudflare.com`, sem nada para instalar no aparelho. Toda requisição precisa do cookie da sessão, que só o link do QR (com o token aleatório) cria; sem ele, 404. O `--modo lan` serve HTTP na rede local: funciona sem internet, mas **sem WebGPU** no aparelho.

## Procedimento (o agente executa)

1. **Atualizar o Mac** (o código vem do git; os modelos já estão no cache do HD externo — `MACMINI.md`, seção 4):
   ```bash
   ssh macmini 'cd /Volumes/Ext2TB/Projects/som-webcore && git pull --ff-only'
   ```
2. **Subir a sessão** (perfil `rapido` ≈ 110 MB e 5 min; `completo` ≈ 290 MB e 20–30 min; `extra` acrescenta o JSEP e o `@johnhenry` CPU 32M):
   ```bash
   ssh macmini 'cd /Volumes/Ext2TB/Projects/som-webcore && bash bench/spike-mobile/lab/start-lab.sh --label iphone --perfil completo'
   ```
   A saída traz `SESSION=`, `URL=`, `QR_PNG=` e o QR em texto. Copie o PNG para o scratchpad do Acer e abra-o na tela para o dono escanear (`scp macmini:<QR_PNG> <scratchpad>/qr.png` e, no Windows, `Start-Process <scratchpad>\qr.png`); na resposta, dê também a URL e cole o QR em texto num bloco de código.
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
5. **Parar** a sessão (túnel e servidor):
   ```bash
   ssh macmini 'cd /Volumes/Ext2TB/Projects/som-webcore && bash bench/spike-mobile/lab/stop-lab.sh <SESSION>'
   ```
6. **Versionar** (se a rodada vale como evidência): `scp` de `bench/results/<SESSION>-*` para o Acer, conferir que nenhum arquivo tem token ou dado pessoal, e entregar pelo fluxo do repositório (branch `test/…`, PR, squash merge), com uma linha no diário `docs/reports/execucao-autonoma.md`.

## O que a sessão grava (em `bench/results/`)

| Arquivo | Conteúdo |
|---|---|
| `<SESSION>-lab.json` | as etapas e o estado de cada uma (o laboratório retoma daqui se o Safari recarregar a página) |
| `<SESSION>-sonda.json`, `-sonda-coi.json` | a sonda do ambiente, sem e com isolamento de origem |
| `<SESSION>-ambiente.json` | a verificação estendida (`lab.js`, `extraChecks`) |
| `<SESSION>-<motor>-<variante>-<modelo>.json` | cada execução da página de teste, no formato de sempre (`summarize.py`, `compare.py`, `check_shape.py`) |
| `<SESSION>-logs.jsonl` | tudo o que as páginas registraram (`lab/hook.js`): console, erros, rejeições, falhas de rede, WebGPU, visibilidade e recargas, e o rastro da página (`trace=1`) |
| `<SESSION>-requests.jsonl` | cada requisição respondida: caminho, estado, bytes, codificação e tempo |
| `<SESSION>-relatorio.md` | o relatório do `analyze.py` |

## Problemas conhecidos

- **O túnel não sobe ou demora:** veja `tunnel.log` na pasta da sessão; tente de novo ou use `--modo lan` (sem WebGPU).
- **A página recarregou** (o Safari mata abas pesadas): o laboratório repete a etapa uma vez e, se recarregar de novo, marca `interrupted` e segue.
- **A tela apagou ou o dono trocou de app:** o laboratório pede o Wake Lock no toque em “Começar”; os períodos ocultos aparecem nos logs e no relatório, e as medições dessas etapas ficam sob suspeita.
- **Etapas que travam** (ONNX Runtime WebGPU com `8bit`/`int8` travou no desktop): têm tempo limite curto e ficam no fim do perfil; o botão “Pular a etapa atual” também serve.
- **Os pesos ficam em cache entre as etapas** (`cache=1`): cada arquivo cruza a rede uma vez; por isso o tempo até a primeira resposta da sessão não é de primeira visita.
