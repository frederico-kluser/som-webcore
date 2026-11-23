#!/usr/bin/env bash
# Stops a device lab session started by start-lab.sh: the tunnel first, then the server, then the
# device's log by cable (if start-lab.sh started one), and copies the device's crash and JetsamEvent
# reports of the session's window (idevicecrashreport, if libimobiledevice is on the Mac).
#   bash bench/spike-mobile/lab/stop-lab.sh <session> [--desde AAAA-MM-DD-HHMMSS]
# --desde widens the window of the reports (default: 10 minutes before the session started, Mac local
# time); the reports stay in <run>/crash-reports, outside the repository: they are the owner's device
# logs, never versioned as they are.
set -uo pipefail
SESSION="${1:?Erro: falta a sessão — Solução: bash stop-lab.sh <session> (a linha SESSION= do start-lab.sh)}"
shift
SINCE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --desde) SINCE="$2"; shift 2 ;;
    *) echo "Erro: opção desconhecida $1 — Solução: use --desde AAAA-MM-DD-HHMMSS" >&2; exit 2 ;;
  esac
done
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

# The device's log by cable: the wrapper shell and its pipeline (idevicesyslog | grep).
if [ -f "$RUN/syslog.pid" ]; then
  pid="$(cat "$RUN/syslog.pid")"
  pkill -P "$pid" 2>/dev/null
  kill "$pid" 2>/dev/null
  rm -f "$RUN/syslog.pid"
  echo "parado: idevicesyslog; $(wc -l < "$RUN/device-syslog.log" 2>/dev/null | tr -d ' ') linha(s) em $RUN/device-syslog.log"
fi

# Crash and JetsamEvent reports of the session's window.
if [ -s "$RUN/device-udid" ]; then
  if command -v idevicecrashreport >/dev/null 2>&1; then
    START="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("startedLocal") or "")' "$RUN/session.json" 2>/dev/null)"
    if [ -z "$SINCE" ] && [ -n "$START" ]; then
      SINCE="$(python3 -c 'import datetime,sys; t=datetime.datetime.strptime(sys.argv[1], "%Y-%m-%d-%H%M%S")-datetime.timedelta(minutes=10); print(t.strftime("%Y-%m-%d-%H%M%S"))' "$START")"
    fi
    TMPD="$RUN/crash-all"
    rm -rf "$TMPD"; mkdir -p "$TMPD"
    if idevicecrashreport -u "$(cat "$RUN/device-udid")" -k -e "$TMPD" >/dev/null 2>&1; then
      python3 - "$TMPD" "$RUN/crash-reports" "$SINCE" "$(date +%Y-%m-%d-%H%M%S)" <<'PY'
import re, shutil, sys
from pathlib import Path
src, dst, since, until = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3], sys.argv[4]
wanted = re.compile(r"JetsamEvent|WebContent|com\.apple\.WebKit|MobileSafari|Safari|GPU", re.I)
kept = []
for path in src.rglob("*"):
    if not path.is_file():
        continue
    stamp = re.search(r"(\d{4}-\d{2}-\d{2}-\d{6})", path.name)
    if not stamp or not wanted.search(path.name):
        continue
    if since and stamp.group(1) < since or stamp.group(1) > until:
        continue
    dst.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, dst / path.name)
    kept.append(path.name)
print(f"relatórios do aparelho na janela {since or '(sem início)'} → {until}: {len(kept)}" + (f" ({', '.join(sorted(kept)[:12])}{' …' if len(kept) > 12 else ''})" if kept else ""))
PY
    else
      echo "idevicecrashreport falhou (aparelho desconectado, bloqueado ou sem confiança neste Mac); sem relatórios do aparelho"
    fi
    rm -rf "$TMPD"
  else
    echo "Relatórios do aparelho: idevicecrashreport não está instalado neste Mac; sem eles"
  fi
fi

# The token is useless once the server is down; drop it with the QR that carries it.
rm -f "$RUN/qr.png"
python3 - "$RUN/session.json" <<'PY' 2>/dev/null || true
import json, sys
p = sys.argv[1]; d = json.load(open(p)); d.pop("url", None); json.dump(d, open(p, "w"), indent=2)
PY
echo "sessão $SESSION encerrada; logs dos processos em $RUN"
