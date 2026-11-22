#!/usr/bin/env python3
"""Warm p50 of each configuration across its repetitions (result files that differ only in the
"-r<k>" suffix) and the largest relative difference between them, (max - min) / min. The T-08 rule:
when the p50 varies more than 10%, the measurement is repeated again.

    python bench/spike-mobile/reference/repeatability.py bench/results/<prefix>-*-r*.json

No number is typed by hand: everything comes from the JSON files.
"""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

LIMIT = 0.10


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__, file=sys.stderr)
        return 2
    groups: dict[str, list[tuple[int, str, float | None]]] = defaultdict(list)
    for path in map(Path, argv):
        match = re.match(r"(.*)-r(\d+)$", path.stem)
        if not match:
            continue
        run = json.loads(path.read_text(encoding="utf-8"))
        p50 = ((run.get("latency") or {}).get("warm") or {}).get("p50")
        groups[match.group(1)].append((int(match.group(2)), run.get("status") or "—", p50))
    print("| Configuração | Repetições | Estado | Quente p50 por repetição (ms) | Maior diferença | Acima de 10%? |")
    print("|---|---:|---|---|---:|---|")
    for key in sorted(groups):
        reps = sorted(groups[key])
        values = [p50 for _, _, p50 in reps if p50 is not None]
        statuses = " · ".join(status for _, status, _ in reps)
        if len(values) >= 2 and min(values) > 0:
            diff = (max(values) - min(values)) / min(values)
            cell, above = f"{diff:.1%}", ("**sim**" if diff > LIMIT else "não")
        else:
            cell, above = "—", "—"
        shown = " / ".join(f"{v:.1f}" for v in values) or "—"
        print(f"| `{key}` | {len(reps)} | {statuses} | {shown} | {cell} | {above} |")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
