#!/usr/bin/env python3
"""The T-09 endurance runs (page with endurance=N): decisions made, failures, JS heap at the start and
at the end of the N decisions, and the criterion fixed in docs/reports/teste-mobile.md, section 1:
"no growth" = heap at the end <= heap at the start + 1 MiB (the G1 tolerance).

    python bench/spike-mobile/reference/endurance.py bench/results/<run>-resistencia-200-r1.json [...]

The heap is exact only with Chrome's --enable-precise-memory-info (otherwise Chrome rounds it); the
runner records that flag in device.chromeFlags. Markdown table; no number is typed by hand.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

MIB = 1 << 20
MB = 1_000_000


def snapshot(run: dict, label: str):
    for snap in run.get("memory", []):
        if snap.get("label") == label:
            return snap.get("jsHeapUsed")
    return None


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__, file=sys.stderr)
        return 2
    print("| Execução | Motor | Variante | Estado | Decisões ok / pedidas | Falhas | Heap JS início → fim (MB) | Diferença (MiB) | Sem crescimento (≤ 1 MiB)? | Heap preciso? | PSS máx. (MB) | p50 / p95 (ms) |")
    print("|---|---|---|---|---:|---:|---|---:|---|---|---:|---:|")
    for path in map(Path, argv):
        run = json.loads(path.read_text(encoding="utf-8"))
        cfg = run.get("config") or {}
        asked = int(cfg.get("endurance") or 0)
        end = (run.get("latency") or {}).get("endurance") or {}
        ok = len(end.get("samplesMs") or [])
        failures = end.get("failures")
        start_heap, end_heap = snapshot(run, "endurance-start"), snapshot(run, "endurance-end")
        if start_heap is not None and end_heap is not None:
            diff = (end_heap - start_heap) / MIB
            heap = f"{start_heap / MB:.2f} → {end_heap / MB:.2f}"
            verdict = "sim" if end_heap <= start_heap + MIB else "**não**"
            diff_cell = f"{diff:+.2f}"
        else:
            heap, verdict, diff_cell = "—", "não medido", "—"
        flags = ((run.get("device") or {}).get("chromeFlags") or "")
        precise = "sim" if "--enable-precise-memory-info" in flags else "não"
        samples = (run.get("androidMemory") or {}).get("samples") or []
        pss = max((sum(s["pss"].values()) for s in samples), default=None)
        status = run.get("status", "—")
        latency = f"{end['p50']:.1f} / {end['p95']:.1f}" if end.get("p50") is not None else "—"
        print(f"| `{path.stem}` | {cfg.get('engine', '—')} | {(run.get('engineInfo') or {}).get('variant') or cfg.get('variant', '—')} | {status} | "
              f"{ok} / {asked} | {failures if failures is not None else '—'} | {heap} | {diff_cell} | {verdict} | {precise} | "
              f"{f'{pss / MB:,.0f}' if pss else '—'} | {latency} |")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
