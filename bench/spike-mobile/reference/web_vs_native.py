#!/usr/bin/env python3
"""The browser engine against the native ONNX Runtime with the same weights file.

    python bench/spike-mobile/reference/web_vs_native.py bench/results/<page-run>.json [...]

For each ONNX Runtime Web run (engine ort-*), it finds the native run of the same model and variant
(bench/results/*-nativo-onnxruntime-cpu-<model>-<variant>.json, from run_reference.py --onnx) and
separates the two errors: the artifact's (native against the PyTorch reference) and the browser
engine's (page against native, same file). Markdown table; no number is typed by hand.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from compare import compare  # noqa: E402


def as_reference(native: dict) -> dict:
    """A native run in the shape compare() expects from a reference."""
    return {
        "model": native["config"].get("model"), "revision": None, "implementation": "onnxruntime (native)",
        "items": [{"item": a["item"], "lang": a["lang"], "results": a["result"], "raw": {}} for a in native["answers"] if a.get("status") == "ok"],
    }


def cell(c: dict) -> str:
    t = c["total"]
    return f"{t['maxDp']:.1e} · {t['top1']}/{t['questions']}" if t["questions"] else "—"


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__, file=sys.stderr)
        return 2
    print("| Execução | Variante | Modelo | Web × nativo: máx. \\|Δp\\| · vencedora igual | Nativo × referência | Web × referência |")
    print("|---|---|---|---|---|---|")
    for path in map(Path, argv):
        run = json.loads(path.read_text(encoding="utf-8"))
        cfg = run.get("config") or {}
        if not str(cfg.get("engine", "")).startswith("ort-") or not run.get("answers"):
            continue
        model = cfg.get("model") or "ts-ettin-17m"
        variant = (run.get("engineInfo") or {}).get("variant") or cfg.get("variant")
        natives = sorted(path.parent.glob(f"*-nativo-onnxruntime-cpu-{model}-{str(variant).replace('-', '_')}.json"))
        reference = json.loads((HERE / f"{model}.json").read_text(encoding="utf-8"))
        if not natives:
            print(f"| `{path.stem}` | {variant} | {model} | sem execução nativa | — | {cell(compare(reference, run))} |")
            continue
        native = json.loads(natives[-1].read_text(encoding="utf-8"))
        print(f"| `{path.stem}` | {variant} | {model} | {cell(compare(as_reference(native), run))} | "
              f"{cell(compare(reference, native))} | {cell(compare(reference, run))} |")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
