#!/usr/bin/env python3
"""Check that every answer of a run has the result shape of docs/spec/decisions-api-surface.md §6.

    python bench/spike-mobile/reference/check_shape.py <run.json> [<run.json> ...]

Rules, per question of every answered item (the corpus gives the schema):
  - the result has one entry per question id, in question order, and nothing else;
  - each decision has exactly the members confidence, [expectedScore,] id, label, probabilities, in
    that (lexicographic) order; expectedScore only for "score";
  - id is the question id; probabilities are keyed by the option labels, in option order
    ("true", "false" for boolean; "1".."5" for score without options); every value is a finite
    number in [0, 1] and they sum to 1 (within 1e-4);
  - label is the first most probable option; confidence equals its probability;
  - expectedScore = sum(value * p), value = numeric label when every label is a finite number, else
    the 1-based position (within 1e-4).
Exit code 1 when any rule fails. Standard library only.
"""

from __future__ import annotations

import json
import math
import re
import sys
from pathlib import Path

SPIKE = Path(__file__).resolve().parent.parent
NUMBER = re.compile(r"^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$")
TOL = 1e-4


def expected_labels(question: dict) -> list[str]:
    if question["type"] == "boolean":
        return ["true", "false"]
    if question["type"] == "score" and not question.get("options"):
        return ["1", "2", "3", "4", "5"]
    return [o["label"] for o in question["options"]]


def check(run: dict, corpus: dict) -> list[str]:
    problems = []
    for answer in run.get("answers", []):
        if answer.get("status") != "ok":
            continue
        schema = corpus["schemas"][answer["schema"]]
        where = answer["item"]
        result = answer["result"]
        ids = [q["id"] for q in schema["questions"]]
        if list(result.keys()) != ids:
            problems.append(f"{where}: result keys {list(result.keys())} != question ids {ids}")
            continue
        for q in schema["questions"]:
            d = result[q["id"]]
            members = ["confidence", "expectedScore", "id", "label", "probabilities"] if q["type"] == "score" else ["confidence", "id", "label", "probabilities"]
            if list(d.keys()) != members:
                problems.append(f"{where}/{q['id']}: members {list(d.keys())} != {members}")
                continue
            labels = expected_labels(q)
            if d["id"] != q["id"]:
                problems.append(f"{where}/{q['id']}: id {d['id']!r}")
            if list(d["probabilities"].keys()) != labels:
                problems.append(f"{where}/{q['id']}: probability keys {list(d['probabilities'].keys())} != {labels}")
                continue
            values = list(d["probabilities"].values())
            if not all(isinstance(v, (int, float)) and math.isfinite(v) and -TOL <= v <= 1 + TOL for v in values):
                problems.append(f"{where}/{q['id']}: probability outside [0, 1]")
            if abs(sum(values) - 1) > TOL:
                problems.append(f"{where}/{q['id']}: probabilities sum to {sum(values)}")
            top = max(range(len(values)), key=lambda i: (values[i], -i))
            if d["label"] != labels[top]:
                problems.append(f"{where}/{q['id']}: label {d['label']!r} is not the first most probable option {labels[top]!r}")
            if abs(d["confidence"] - d["probabilities"][d["label"]]) > TOL:
                problems.append(f"{where}/{q['id']}: confidence {d['confidence']} != probability of the label")
            if q["type"] == "score":
                numbers = [float(l) if NUMBER.match(l) else math.nan for l in labels]
                all_numbers = all(math.isfinite(n) for n in numbers)
                expected = sum((numbers[i] if all_numbers else i + 1) * values[i] for i in range(len(values)))
                if abs(d["expectedScore"] - expected) > TOL * max(1.0, abs(expected)):
                    problems.append(f"{where}/{q['id']}: expectedScore {d['expectedScore']} != {expected}")
    return problems


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__, file=sys.stderr)
        return 2
    corpus = json.loads((SPIKE / "corpus.json").read_text(encoding="utf-8"))
    failed = 0
    for path in argv:
        run = json.loads(Path(path).read_text(encoding="utf-8"))
        answered = sum(1 for a in run.get("answers", []) if a.get("status") == "ok")
        problems = check(run, corpus)
        engine = (run.get("config") or {}).get("engine")
        print(f"{Path(path).name}: engine={engine} answered={answered} shape problems={len(problems)}")
        for p in problems[:10]:
            print(f"  - {p}")
        failed += bool(problems)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
