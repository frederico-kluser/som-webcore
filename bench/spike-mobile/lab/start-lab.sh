#!/usr/bin/env bash
# Device lab: serves the test page to a real device (iPhone, Android) and prints the QR codes to open it.
# Runs on the Mac mini (MACMINI.md, section 9), from the repository clone on the external disk.
#
#   bash bench/spike-mobile/lab/start-lab.sh [--label iphone] [--perfil completo|rapido|onnx|extra|memoria] [--modo local|local-http|tunel] [--porta 8390]
#
# --perfil memoria (C-01): the memory budget (lab/memoria.js). Its pages fill memory until the tab dies,
#   ON PURPOSE: warn the owner before each round, never in the everyday browser profile.
#
# --modo local (default): HTTPS on the Mac's LAN address, with a certificate from a local CA kept on
#   the Mac (/Volumes/Ext2TB/State/som-webcore/lab-ca; its key never enters the repository). The
#   device must be on the same network and trust that CA once: the first QR (plain HTTP, port + 1)
#   downloads its certificate. HTTPS matters: Safari only exposes WebGPU, SharedArrayBuffer and the
#   Wake Lock in a secure context, and http://<LAN address> is not one.
# --modo local-http: plain HTTP on the LAN, nothing to install, but no WebGPU on the device.
# --modo tunel: HTTPS through a temporary Cloudflare quick tunnel; public while the session runs.
# In every mode, each request needs the lab cookie, which only the lab QR link (with the lab's random
# token) sets; anything else answers 404. The token is kept on the Mac across sessions (lab-token, next
# to the CA; --novo-token replaces it) and the cookie lasts 180 days, so a device that entered once
# opens FIXED_URL (https://<LAN address>:<port>/lab/lab.html) directly in any later session.
#
# Prints SESSION=, URL=, FIXED_URL=, QR_PNG= (and CA_URL=, CA_QR_PNG= in local mode) and the QR codes.
# --sem-token leaves out of the output everything that carries the token (URL= and the lab QR in text):
# the QR is still in QR_PNG, for an agent to show on a screen without ever printing the token.
# Stop with stop-lab.sh <session>. The token, the process ids and the logs of the processes stay
# outside the repository.
#
# Device logs by cable (optional): if libimobiledevice is on the Mac (idevice_id) and lists a device,
# idevicesyslog runs for the whole session into <run>/device-syslog.log, keeping only the lines about
# memorystatus, jetsam, WebContent, the GPU process and WebKit; stop-lab.sh then copies the crash and
# JetsamEvent reports of the session's window (idevicecrashreport). Nothing is installed here: without
# libimobiledevice the script says so in one line and goes on. These logs never go into git as they are.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SPIKE="$(cd "$HERE/.." && pwd)"
ROOT="$(cd "$SPIKE/../.." && pwd)"
LABEL=iphone; PROFILE=completo; MODE=local; PORT=8390; NEW_TOKEN=0; NO_TOKEN_OUTPUT=0
while [ $# -gt 0 ]; do
  case "$1" in
    --label) LABEL="$2"; shift 2 ;;
    --perfil) PROFILE="$2"; shift 2 ;;
    --modo) MODE="$2"; shift 2 ;;
    --porta) PORT="$2"; shift 2 ;;
    --novo-token) NEW_TOKEN=1; shift ;;
    --sem-token) NO_TOKEN_OUTPUT=1; shift ;;
    *) echo "Erro: opção desconhecida $1 — Solução: use --label, --perfil, --modo, --porta, --novo-token ou --sem-token" >&2; exit 2 ;;
  esac
done
case "$PROFILE" in rapido|completo|onnx|extra|memoria) ;; *) echo "Erro: perfil $PROFILE — Solução: rapido, completo, onnx, extra ou memoria" >&2; exit 2 ;; esac
case "$MODE" in local|local-http|tunel) ;; *) echo "Erro: modo $MODE — Solução: local, local-http ou tunel" >&2; exit 2 ;; esac
LABEL="$(echo "$LABEL" | tr 'A-Z' 'a-z' | tr -c 'a-z0-9-' '-' | sed 's/-*$//')"
SESSION="$(date +%F)-$LABEL-$(date +%H%M)"
CA_PORT=$((PORT + 1))

EXT=/Volumes/Ext2TB
if [ -d "$EXT" ]; then
  RUN_BASE="${SOM_LAB_RUN:-$EXT/tmp/som-webcore/lab}"
  CA_DIR="${SOM_LAB_CA:-$EXT/State/som-webcore/lab-ca}"
  export SOM_MODEL_CACHE="${SOM_MODEL_CACHE:-$EXT/Caches/som-webcore/models}"
  export TMPDIR="$EXT/tmp/som-webcore"
else
  RUN_BASE="${SOM_LAB_RUN:-${TMPDIR:-/tmp}/som-webcore-lab}"
  CA_DIR="${SOM_LAB_CA:-$HOME/.local/state/som-webcore/lab-ca}"
fi
RUN="$RUN_BASE/$SESSION"
mkdir -p "$RUN" "${TMPDIR:-/tmp}" "$ROOT/bench/results"
for p in "$PORT" "$CA_PORT"; do
  if lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Erro: a porta $p está ocupada — Solução: pare a sessão anterior (stop-lab.sh) ou use --porta" >&2; exit 1
  fi
done
# The lab's token, kept across sessions next to the CA (never in the repository).
TOKEN_FILE="$(dirname "$CA_DIR")/lab-token"
mkdir -p "$(dirname "$TOKEN_FILE")"
if [ "$NEW_TOKEN" = 1 ] || [ ! -s "$TOKEN_FILE" ]; then
  (umask 077; openssl rand -hex 16 > "$TOKEN_FILE")
fi
chmod 600 "$TOKEN_FILE"
TOKEN="$(cat "$TOKEN_FILE")"
LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || hostname -I 2>/dev/null | cut -d' ' -f1)"
LAN_NAME="$(scutil --get LocalHostName 2>/dev/null || hostname -s).local"

# Local CA (once) and a server certificate for the current LAN address (again when the address changes).
# iOS accepts a user-trusted CA's server certificate with SAN, serverAuth and at most 825 days of validity.
SERVER_ARGS=()
TLS_CERT=""
if [ "$MODE" = local ]; then
  OPENSSL="$(command -v /opt/homebrew/opt/openssl@3/bin/openssl || command -v openssl)"
  mkdir -p "$CA_DIR"; chmod 700 "$CA_DIR"
  if [ ! -f "$CA_DIR/ca.key" ]; then
    "$OPENSSL" req -x509 -newkey rsa:2048 -sha256 -nodes -days 3650 -keyout "$CA_DIR/ca.key" -out "$CA_DIR/ca.pem" \
      -subj "/CN=som-webcore device lab CA (Mac mini)/O=som-webcore" \
      -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign" 2>/dev/null
    "$OPENSSL" x509 -in "$CA_DIR/ca.pem" -outform der -out "$CA_DIR/ca.crt"
    chmod 600 "$CA_DIR/ca.key"
  fi
  if [ ! -f "$CA_DIR/server-$LAN_IP.crt" ]; then
    "$OPENSSL" req -newkey rsa:2048 -sha256 -nodes -keyout "$CA_DIR/server-$LAN_IP.key" -out "$CA_DIR/server-$LAN_IP.csr" \
      -subj "/CN=$LAN_IP" 2>/dev/null
    printf 'subjectAltName=IP:%s,DNS:%s,DNS:localhost,IP:127.0.0.1\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\n' "$LAN_IP" "$LAN_NAME" > "$CA_DIR/server-$LAN_IP.ext"
    "$OPENSSL" x509 -req -in "$CA_DIR/server-$LAN_IP.csr" -CA "$CA_DIR/ca.pem" -CAkey "$CA_DIR/ca.key" -CAcreateserial \
      -out "$CA_DIR/server-$LAN_IP.crt" -days 397 -sha256 -extfile "$CA_DIR/server-$LAN_IP.ext" 2>/dev/null
    chmod 600 "$CA_DIR/server-$LAN_IP.key"
  fi
  SERVER_ARGS=(--tls-cert "$CA_DIR/server-$LAN_IP.crt" --tls-key "$CA_DIR/server-$LAN_IP.key" --ca-port "$CA_PORT" --ca-file "$CA_DIR/ca.crt")
  TLS_CERT="$CA_DIR/server-$LAN_IP.crt"
fi

# Initial state, versioned with the results (no token in it).
python3 - "$ROOT/bench/results/$SESSION-lab.json" "$SESSION" "$LABEL" "$PROFILE" "$MODE" <<'PY'
import json, sys, datetime
path, session, label, profile, mode = sys.argv[1:]
json.dump({"session": session, "label": label, "profile": profile, "mode": mode,
           "createdAt": datetime.datetime.now(datetime.timezone.utc).isoformat()}, open(path, "w"), indent=2)
PY

BIND=0.0.0.0
[ "$MODE" = tunel ] && BIND=127.0.0.1
SOM_LAB_TOKEN="$TOKEN" SOM_LAB_SESSION="$SESSION" nohup node "$SPIKE/serve.mjs" --port "$PORT" --host "$BIND" ${SERVER_ARGS[@]+"${SERVER_ARGS[@]}"} \
  > "$RUN/serve.log" 2>&1 < /dev/null &
echo $! > "$RUN/serve.pid"
for _ in $(seq 1 120); do grep -q "ready on" "$RUN/serve.log" 2>/dev/null && break; sleep 1; done
grep -q "ready on" "$RUN/serve.log" || { echo "Erro: o servidor não subiu — Solução: veja $RUN/serve.log" >&2; exit 1; }

CA_URL=""
case "$MODE" in
  local) BASE="https://$LAN_IP:$PORT"; CA_URL="http://$LAN_IP:$CA_PORT/ca.crt" ;;
  local-http) BASE="http://$LAN_IP:$PORT" ;;
  tunel)
    command -v cloudflared >/dev/null || { echo "Erro: cloudflared não encontrado — Solução: use --modo local" >&2; exit 3; }
    nohup cloudflared tunnel --no-autoupdate --url "http://127.0.0.1:$PORT" > "$RUN/tunnel.log" 2>&1 < /dev/null &
    echo $! > "$RUN/tunnel.pid"
    BASE=""
    for _ in $(seq 1 90); do
      BASE="$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$RUN/tunnel.log" | head -1 || true)"
      [ -n "$BASE" ] && break; sleep 1
    done
    [ -n "$BASE" ] || { echo "Erro: o túnel não deu endereço — Solução: veja $RUN/tunnel.log, ou use --modo local" >&2; exit 1; }
    for _ in $(seq 1 90); do
      [ "$(curl -s -o /dev/null -m 5 -w '%{http_code}' "$BASE/lab/hook.js" || true)" = 404 ] && break; sleep 2
    done ;;
esac
URL="$BASE/lab/enter?t=$TOKEN"
# tlsCert is the server's public certificate (lab/run-lab.mjs trusts only its key); startedLocal is the
# start of the window for the device's crash reports (stop-lab.sh), in the Mac's local time.
python3 - "$RUN/session.json" "$SESSION" "$BASE" "$URL" "$MODE" "$PROFILE" "$PORT" "$RUN" "$CA_URL" "$TLS_CERT" "$(date +%Y-%m-%d-%H%M%S)" <<'PY'
import json, sys, datetime
path, session, base, url, mode, profile, port, run, ca_url, tls_cert, started_local = sys.argv[1:]
json.dump({"session": session, "base": base, "url": url, "mode": mode, "profile": profile, "port": int(port), "run": run,
           "caUrl": ca_url or None, "tlsCert": tls_cert or None, "startedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
           "startedLocal": started_local}, open(path, "w"), indent=2)
PY
chmod 600 "$RUN/session.json"

# Device logs by cable (optional; see the header). The device's id stays in the session folder.
if command -v idevice_id >/dev/null 2>&1 && command -v idevicesyslog >/dev/null 2>&1; then
  UDID="$(idevice_id -l 2>/dev/null | head -1 || true)"
  if [ -n "$UDID" ]; then
    (umask 077; echo "$UDID" > "$RUN/device-udid")
    nohup bash -c 'idevicesyslog -u "$1" 2>&1 | grep --line-buffered -i -E "memorystatus|jetsam|WebContent|com\.apple\.WebKit|WebKit|GPU"' _ "$UDID" \
      > "$RUN/device-syslog.log" 2>/dev/null < /dev/null &
    echo $! > "$RUN/syslog.pid"
    echo "Logs do aparelho por cabo: idevicesyslog ligado ($RUN/device-syslog.log; só memorystatus, jetsam, WebContent, GPU e WebKit)"
  else
    echo "Logs do aparelho por cabo: libimobiledevice presente, mas nenhum aparelho conectado e confiável (idevice_id -l vazio); seguindo sem eles"
  fi
else
  echo "Logs do aparelho por cabo: libimobiledevice não está instalada neste Mac (idevice_id); seguindo sem eles"
fi

echo "SESSION=$SESSION"
[ "$NO_TOKEN_OUTPUT" = 1 ] || echo "URL=$URL"
echo "FIXED_URL=$BASE/lab/lab.html"
echo "Aparelho que já entrou uma vez (o cookie dura 180 dias): abra $BASE/lab/lab.html; o QR é só para a primeira vez."
if [ "$PROFILE" = memoria ]; then
  echo "AVISO (perfil memoria): as páginas enchem a memória até o Safari derrubar a aba, DE PROPÓSITO. Avise o dono antes:"
  echo "  feche o Safari no seletor de apps antes de começar; use um perfil do Safari só do laboratório, nunca o do dia a dia;"
  echo "  iPhone na tomada; se aparecer 'ocorreu um problema repetidamente', tocar em Recarregar; até 1,5 GB de OPFS, apagados no fim."
fi
if command -v qrencode >/dev/null; then
  qrencode -o "$RUN/qr.png" -s 10 -m 3 "$URL"
  echo "QR_PNG=$RUN/qr.png"
  if [ -n "$CA_URL" ]; then
    qrencode -o "$RUN/qr-ca.png" -s 10 -m 3 "$CA_URL"
    echo "CA_URL=$CA_URL"
    echo "CA_QR_PNG=$RUN/qr-ca.png"
    echo "1) uma vez só — certificado da CA local (no iPhone: permitir o download; Ajustes > Perfil baixado > Instalar;"
    echo "   Ajustes > Geral > Sobre > Ajustes de Confiança de Certificados > ligar 'som-webcore device lab CA'):"
    qrencode -t UTF8 -m 2 "$CA_URL"
    echo "2) o laboratório:"
  fi
  if [ "$NO_TOKEN_OUTPUT" = 1 ]; then echo "(QR do laboratório só no arquivo QR_PNG: --sem-token)"; else qrencode -t UTF8 -m 2 "$URL"; fi
else
  echo "(qrencode não encontrado: abra as URLs acima no aparelho)"
fi
echo "Acompanhe: tail -f $RUN/serve.log | grep '\[lab\]'   ·   Pare: bash bench/spike-mobile/lab/stop-lab.sh $SESSION"
