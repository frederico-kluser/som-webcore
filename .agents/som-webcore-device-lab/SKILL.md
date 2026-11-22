---
name: som-webcore-device-lab
description: "Laboratório de aparelho real do som-webcore: sobe no Mac mini um site de testes local (HTTPS na rede de casa, com uma CA própria do Mac; fechado por token), gera os QR codes para abrir no iPhone ou no Android, roda a página de teste com todos os motores, colhe todos os logs possíveis (console, erros, rede, WebGPU, ciclo de vida da página, ambiente estendido) e analisa os resultados sozinho no fim. Use quando o pedido for testar num celular ou iPhone de verdade, 'gera um QR pra eu abrir no meu iPhone', medir latência ou WebGPU em aparelho real, ou repetir a T-02."
metadata:
  project: som-webcore
  runs-on: "Mac mini (ssh macmini), clone em /Volumes/Ext2TB/Projects/som-webcore"
  code: "bench/spike-mobile/lab/ (lab.html, lab.js, hook.js, start-lab.sh, stop-lab.sh, analyze.py) e o modo laboratório do bench/spike-mobile/serve.mjs"
---

# Laboratório de aparelho — som-webcore

Uma sessão = um aparelho real abrindo, pelo QR, a página-laboratório servida pelo **Mac mini**. Ela roda a sonda do ambiente, uma verificação estendida (armazenamento, APIs, WebGL, um passe real de computação em WebGPU) e a página de teste para cada motor e variante, cada uma num iframe, e manda tudo para o servidor. No fim, `analyze.py` escreve o relatório.

**Regras:** tudo roda no Mac (regra da skill `macmini`: o Acer só desenvolve). O token da sessão nunca entra no git: fica em `/Volumes/Ext2TB/tmp/som-webcore/lab/<sessão>/`; a chave da CA local fica em `/Volumes/Ext2TB/State/som-webcore/lab-ca/` e também nunca entra no git. Pare a sessão ao terminar. Latência do aparelho é **[MEDIDO]**; os limites do portão GT são **[ALVO]**. Nunca mude um limite depois de medir.

## Por que HTTPS local (e a CA)

O dono quer o site **local** (sem Cloudflare). O Safari do iPhone só expõe WebGPU, `SharedArrayBuffer` (threads do Wasm) e o Wake Lock em **contexto seguro**, e `http://<ip-do-mac>` não é seguro. Por isso o modo padrão (`--modo local`) serve **HTTPS no endereço do Mac na rede de casa** (`https://192.168.100.84:8390` em 2026-11-22), com um certificado assinado por uma CA criada no próprio Mac. O aparelho precisa estar no mesmo Wi-Fi e confiar nessa CA **uma vez**:

1. escanear o QR da CA (`http://<ip>:8391/ca.crt`) e permitir o download do perfil;
2. **Ajustes → Perfil Transferido → Instalar** (ou **Ajustes → Geral → VPN e Gerenciamento de Dispositivos**);
3. **Ajustes → Geral → Sobre → Ajustes de Confiança de Certificados** → ligar “som-webcore device lab CA (Mac mini)”.

Depois disso, todo QR do laboratório abre direto. Toda requisição precisa do cookie da sessão, que só o link do QR (com o token aleatório) cria; sem ele, 404. Alternativas: `--modo local-http` (HTTP na rede local, nada a instalar, **sem WebGPU**) e `--modo tunel` (HTTPS por um túnel temporário do Cloudflare; público enquanto a sessão roda).

## Procedimento (o agente executa)

1. **Atualizar o Mac** (o código vem do git; os modelos já estão no cache do HD externo — `MACMINI.md`, seção 4):
   ```bash
   ssh macmini 'cd /Volumes/Ext2TB/Projects/som-webcore && git pull --ff-only'
   ```
2. **Subir a sessão** (perfil `rapido` ≈ 110 MB e 5 min; `completo` ≈ 290 MB e 20–30 min; `onnx` só as etapas do ONNX Runtime; `extra` acrescenta o JSEP e o `@johnhenry` CPU 32M):
   ```bash
   ssh macmini 'cd /Volumes/Ext2TB/Projects/som-webcore && bash bench/spike-mobile/lab/start-lab.sh --label iphone --perfil completo'
   ```
   A saída traz `SESSION=`, `URL=`, `QR_PNG=`, `CA_URL=`, `CA_QR_PNG=` e os QR codes em texto (primeiro o da CA, depois o do laboratório). Copie os PNG para o scratchpad do Acer e abra-os na tela para o dono escanear (`scp macmini:<QR_PNG> <scratchpad>/qr.png` e, no Windows, `Start-Process <scratchpad>\qr.png`); na resposta, dê também as URLs e os passos da CA (seção acima) se for a primeira vez desse aparelho.
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
- **A página recarregou** (o Safari mata abas pesadas): o laboratório repete a etapa uma vez e, se recarregar de novo, marca `interrupted` e segue.
- **A tela apagou ou o dono trocou de app:** o laboratório pede o Wake Lock no toque em “Começar”; os períodos ocultos aparecem nos logs e no relatório, e as medições dessas etapas ficam sob suspeita.
- **Etapas que travam** (ONNX Runtime WebGPU com `8bit`/`int8` travou no desktop): têm tempo limite curto e ficam no fim do perfil; se a página ficar parada, o dono toca em voltar.
- **Teto de memória do Wasm por aba (iPhone, Safari 26.6.3):** a 4ª sessão do ONNX Runtime na mesma aba falha com `RangeError: Out of memory` — em iframes e em páginas próprias, Wasm e WebGPU (os dois usam o runtime em Wasm); o `@johnhenry`, JavaScript puro, segue. Por isso cada etapa é uma navegação da aba e, a cada 3 sessões do ONNX Runtime, o laboratório pede um toque em **“Continuar numa aba nova”** (`window.open` com `noopener`, que o Safari pode pôr num processo novo). O perfil `onnx` repete só as etapas do ONNX Runtime.
- **Tela ligada:** o Safari só concede o Wake Lock com um toque; as páginas de etapa registram `NotAllowedError`, e o dono precisa manter a tela acesa.
- **Os pesos ficam em cache entre as etapas** (`cache=1`): cada arquivo cruza a rede uma vez; por isso o tempo até a primeira resposta da sessão não é de primeira visita.
