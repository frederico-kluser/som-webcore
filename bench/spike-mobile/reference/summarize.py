#!/usr/bin/env python3
"""Markdown table of test-page runs, straight from the JSON files (no number is typed by hand).

    python bench/spike-mobile/reference/summarize.py bench/results/<run>.json [...]

Columns: run, engine, variant, model, status, time to the first answer (ms since navigation),
first-pass p50, warm p50/p95/p99 (ms), first-visit bytes on the wire (MB, runtime + adapter +
weights + tokenizer + config), peak JS heap (MB), peak memory (MB: PSS of all Chrome processes on Android,
RSS of the device's WebKit processes on the iOS Simulator), max |Δp| and top-1 against the reference, and the failure.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from compare import compare  # noqa: E402

MB = 1_000_000
SHORT = 128  # tokens: the local attention window of the TS-Ettin checkpoints


def fmt(value, digits=1):
    return "—" if value is None else f"{value:,.{digits}f}"


def quantile(sorted_values, q):
    if not sorted_values:
        return None
    pos = (len(sorted_values) - 1) * q
    lo, hi = int(pos), min(int(pos) + 1, len(sorted_values) - 1)
    return sorted_values[lo] + (sorted_values[hi] - sorted_values[lo]) * (pos - lo)


def warm_by_length(run: dict, model: str):
    """Warm samples split by the longest sequence of the item (reference token counts).
    The page runs the warm decisions round-robin over the answered items, in corpus order."""
    reference = HERE / f"{model}.json"
    samples = ((run.get("latency") or {}).get("warm") or {}).get("samplesMs")
    if not samples or not reference.exists():
        return None, None
    ref = {i["item"]: max(len(r["ids"]) for r in i["raw"].values()) for i in json.loads(reference.read_text(encoding="utf-8"))["items"]}
    order = [a["item"] for a in run.get("answers", []) if a.get("status") == "ok"]
    if not order:
        return None, None
    short = sorted(s for i, s in enumerate(samples) if ref.get(order[i % len(order)], 0) <= SHORT)
    long_ = sorted(s for i, s in enumerate(samples) if ref.get(order[i % len(order)], 0) > SHORT)
    return short, long_


def row(path: Path) -> str:
    run = json.loads(path.read_text(encoding="utf-8"))
    cfg = run.get("config") or {}
    model = cfg.get("model") or "ts-ettin-17m"
    info = run.get("engineInfo") or {}
    variant = info.get("variant") or cfg.get("variant") or "—"
    lat = run.get("latency") or {}
    warm = lat.get("warm") or {}
    first = lat.get("firstPass") or {}
    heap = max((m.get("jsHeapUsed") or 0 for m in run.get("memory", [])), default=0) or None
    pss = None  # Android: PSS of every Chrome process; iOS Simulator: RSS (on the Mac) of the device's WebKit processes
    samples = (run.get("androidMemory") or {}).get("samples") or []
    if samples:
        pss = max(sum(s["pss"].values()) for s in samples)
    ios = (run.get("iosMemory") or {}).get("samples") or []
    if ios and any(s["rss"] for s in ios):
        pss = max(sum(s["rss"].values()) for s in ios)
    parity = "—"
    reference = HERE / f"{model}.json"
    if run.get("answers") and reference.exists() and cfg.get("engine") != "native":
        c = compare(json.loads(reference.read_text(encoding="utf-8")), run)
        t = c["total"]
        if t["questions"]:
            parity = f"{t['maxDp']:.1e} · {t['top1']}/{t['questions']}"
    failure = ""
    if run.get("status") != "ok":
        failure = (run.get("fatal") or {}).get("message") or ((run.get("failures") or [{}])[0].get("error") or {}).get("message", "")
        failure = failure.replace("|", "/")[:140]
    bytes_ = (run.get("bytes") or {}).get("firstVisitEncoded")
    short, long_ = warm_by_length(run, model)
    split = "—"
    if short:
        split = f"{fmt(quantile(short, 0.5))} / {fmt(quantile(short, 0.95))}"
        if long_:
            split += f" · {fmt(quantile(long_, 0.5))} / {fmt(quantile(long_, 0.95))}"
    return " | ".join([
        f"`{path.stem}`", cfg.get("engine", "—"), str(variant), model, run.get("status", "—"),
        fmt((run.get("timings") or {}).get("firstAnswerMs"), 0), fmt(first.get("p50")),
        f"{fmt(warm.get('p50'))} / {fmt(warm.get('p95'))} / {fmt(warm.get('p99'))}", split,
        fmt(bytes_ / MB if bytes_ else None, 2), fmt(heap / MB if heap else None), fmt(pss / MB if pss else None, 0),
        parity, failure or "—",
    ])


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__, file=sys.stderr)
        return 2
    print("| Execução | Motor | Variante | Modelo | Estado | 1ª resposta (ms) | 1ª passada p50 (ms) | Quente p50 / p95 / p99 (ms) | Quente p50 / p95: ≤ 128 tokens · > 128 (ms) | 1ª visita (MB) | Heap JS máx. (MB) | Memória máx. (MB; PSS no Android, RSS no simulador iOS) | máx. \\|Δp\\| · top-1 | Falha |")
    print("|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|")
    for p in argv:
        print("| " + row(Path(p)) + " |")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
