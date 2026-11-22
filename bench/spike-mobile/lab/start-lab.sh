#!/usr/bin/env bash
# Device lab: serves the test page to a real device (iPhone, Android) and prints a QR code to open it.
# Runs on the Mac mini (MACMINI.md, section 9), from the repository clone on the external disk.
#
#   bash bench/spike-mobile/lab/start-lab.sh [--label iphone] [--perfil completo|rapido|extra] [--modo tunel|lan] [--porta 8390]
#
# --modo tunel (default): HTTPS through a temporary Cloudflare quick tunnel (cloudflared), so the
#   device gets a secure context — WebGPU, SharedArrayBuffer and the Wake Lock need one — with
#   nothing to install on it. The URL is public while the session runs; every request needs the
#   session cookie, which only the QR link (with its random token) sets.
# --modo lan: plain HTTP on the Mac's LAN address. Not a secure context: no WebGPU on the device.
#
# Prints SESSION=, URL= and QR_PNG= lines and the QR code itself. Stop with stop-lab.sh <session>.
# The token, the process ids and the logs of the processes stay outside the repository.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SPIKE="$(cd "$HERE/.." && pwd)"
ROOT="$(cd "$SPIKE/../.." && pwd)"
LABEL=iphone; PROFILE=completo; MODE=tunel; PORT=8390
while [ $# -gt 0 ]; do
  case "$1" in
    --label) LABEL="$2"; shift 2 ;;
    --perfil) PROFILE="$2"; shift 2 ;;
    --modo) MODE="$2"; shift 2 ;;
    --porta) PORT="$2"; shift 2 ;;
    *) echo "Erro: opção desconhecida $1 — Solução: use --label, --perfil, --modo ou --porta" >&2; exit 2 ;;
  esac
done
case "$PROFILE" in rapido|completo|extra) ;; *) echo "Erro: perfil $PROFILE — Solução: rapido, completo ou extra" >&2; exit 2 ;; esac
case "$MODE" in tunel|lan) ;; *) echo "Erro: modo $MODE — Solução: tunel ou lan" >&2; exit 2 ;; esac
LABEL="$(echo "$LABEL" | tr 'A-Z' 'a-z' | tr -c 'a-z0-9-' '-' | sed 's/-*$//')"
SESSION="$(date +%F)-$LABEL-$(date +%H%M)"

EXT=/Volumes/Ext2TB
if [ -d "$EXT" ]; then
  RUN_BASE="${SOM_LAB_RUN:-$EXT/tmp/som-webcore/lab}"
  export SOM_MODEL_CACHE="${SOM_MODEL_CACHE:-$EXT/Caches/som-webcore/models}"
  export TMPDIR="$EXT/tmp/som-webcore"
else
  RUN_BASE="${SOM_LAB_RUN:-${TMPDIR:-/tmp}/som-webcore-lab}"
fi
RUN="$RUN_BASE/$SESSION"
mkdir -p "$RUN" "${TMPDIR:-/tmp}" "$ROOT/bench/results"
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Erro: a porta $PORT está ocupada — Solução: pare a sessão anterior (stop-lab.sh) ou use --porta" >&2; exit 1
fi
TOKEN="$(openssl rand -hex 16)"

# Initial state, versioned with the results (no token in it).
python3 - "$ROOT/bench/results/$SESSION-lab.json" "$SESSION" "$LABEL" "$PROFILE" "$MODE" <<'PY'
import json, sys, datetime
path, session, label, profile, mode = sys.argv[1:]
json.dump({"session": session, "label": label, "profile": profile, "mode": mode,
           "createdAt": datetime.datetime.now(datetime.timezone.utc).isoformat()}, open(path, "w"), indent=2)
PY

BIND=127.0.0.1
[ "$MODE" = lan ] && BIND=0.0.0.0
SOM_LAB_TOKEN="$TOKEN" SOM_LAB_SESSION="$SESSION" nohup node "$SPIKE/serve.mjs" --port "$PORT" --host "$BIND" \
  > "$RUN/serve.log" 2>&1 < /dev/null &
echo $! > "$RUN/serve.pid"
for _ in $(seq 1 120); do grep -q "ready on" "$RUN/serve.log" 2>/dev/null && break; sleep 1; done
grep -q "ready on" "$RUN/serve.log" || { echo "Erro: o servidor não subiu — Solução: veja $RUN/serve.log" >&2; exit 1; }

if [ "$MODE" = tunel ]; then
  command -v cloudflared >/dev/null || { echo "Erro: cloudflared não encontrado — Solução: brew install cloudflared, ou --modo lan" >&2; exit 3; }
  nohup cloudflared tunnel --no-autoupdate --url "http://127.0.0.1:$PORT" > "$RUN/tunnel.log" 2>&1 < /dev/null &
  echo $! > "$RUN/tunnel.pid"
  BASE=""
  for _ in $(seq 1 90); do
    BASE="$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$RUN/tunnel.log" | head -1 || true)"
    [ -n "$BASE" ] && break; sleep 1
  done
  [ -n "$BASE" ] || { echo "Erro: o túnel não deu endereço — Solução: veja $RUN/tunnel.log, ou use --modo lan" >&2; exit 1; }
  # The tunnel answers once the name resolves; our gate answers 404 without the cookie.
  for _ in $(seq 1 90); do
    [ "$(curl -s -o /dev/null -m 5 -w '%{http_code}' "$BASE/lab/hook.js" || true)" = 404 ] && break; sleep 2
  done
else
  IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || hostname -I 2>/dev/null | cut -d' ' -f1)"
  BASE="http://$IP:$PORT"
fi
URL="$BASE/lab/enter?t=$TOKEN"
python3 - "$RUN/session.json" <<PY
import json
json.dump({"session": "$SESSION", "base": "$BASE", "url": "$URL", "mode": "$MODE", "profile": "$PROFILE", "port": $PORT,
           "run": "$RUN"}, open("$RUN/session.json", "w"), indent=2)
PY

echo "SESSION=$SESSION"
echo "URL=$URL"
if command -v qrencode >/dev/null; then
  qrencode -o "$RUN/qr.png" -s 10 -m 3 "$URL"
  echo "QR_PNG=$RUN/qr.png"
  qrencode -t UTF8 -m 2 "$URL"
else
  echo "(qrencode não encontrado: abra a URL acima no aparelho)"
fi
echo "Acompanhe: tail -f $RUN/serve.log | grep '\[lab\]'   ·   Pare: bash bench/spike-mobile/lab/stop-lab.sh $SESSION"
