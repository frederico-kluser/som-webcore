#!/usr/bin/env bash
# Stops a device lab session started by start-lab.sh: the tunnel first, then the server.
#   bash bench/spike-mobile/lab/stop-lab.sh <session>
set -uo pipefail
SESSION="${1:?Erro: falta a sessão — Solução: bash stop-lab.sh <session> (a linha SESSION= do start-lab.sh)}"
EXT=/Volumes/Ext2TB
if [ -d "$EXT" ]; then RUN_BASE="${SOM_LAB_RUN:-$EXT/tmp/som-webcore/lab}"; else RUN_BASE="${SOM_LAB_RUN:-${TMPDIR:-/tmp}/som-webcore-lab}"; fi
RUN="$RUN_BASE/$SESSION"
[ -d "$RUN" ] || { echo "Erro: sessão $SESSION não encontrada em $RUN_BASE — Solução: confira o nome" >&2; exit 1; }
for name in tunnel serve; do
  if [ -f "$RUN/$name.pid" ]; then
    pid="$(cat "$RUN/$name.pid")"
    kill "$pid" 2>/dev/null && echo "parado: $name ($pid)" || echo "$name já estava parado"
    rm -f "$RUN/$name.pid"
  fi
done
# The token is useless once the server is down; drop it with the QR that carries it.
rm -f "$RUN/qr.png"
python3 - "$RUN/session.json" <<'PY' 2>/dev/null || true
import json, sys
p = sys.argv[1]; d = json.load(open(p)); d.pop("url", None); json.dump(d, open(p, "w"), indent=2)
PY
echo "sessão $SESSION encerrada; logs dos processos em $RUN"
