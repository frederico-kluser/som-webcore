#!/usr/bin/env python3
"""Compare a test-page run (bench/results/*.json) with the reference answers.

    python bench/spike-mobile/reference/compare.py <reference.json> <run.json> [--json]

Reports, over every question of every answered item:
  - tokenizer identity (only when the run was made with debug=1, which records token ids);
  - max |Δp|: the largest absolute difference of an option probability against the reference;
  - top-1 agreement, overall and where the reference margin (top1 - top2) is >= 0.01;
  - max |Δ expectedScore| (score questions) and max |Δ confidence|;
  - the same, per language, and the worst questions.
Standard library only.
"""

from __future__ import annotations

import json
import sys


def margin(probabilities: dict) -> float:
    values = sorted(probabilities.values(), reverse=True)
    return values[0] - values[1] if len(values) > 1 else 1.0


def compare(reference: dict, run: dict) -> dict:
    ref_items = {i["item"]: i for i in reference["items"]}
    per_lang: dict[str, dict] = {}
    worst = []
    tokens_checked = tokens_equal = 0
    missing = []
    for answer in run["answers"]:
        ref = ref_items.get(answer["item"])
        if ref is None:
            continue
        if answer.get("status") != "ok":
            missing.append({"item": answer["item"], "status": answer.get("status"), "error": answer.get("error")})
            continue
        bucket = per_lang.setdefault(answer["lang"], {"questions": 0, "maxDp": 0.0, "top1": 0, "marginQuestions": 0, "marginTop1": 0, "maxDScore": 0.0, "maxDConfidence": 0.0})
        for qid, expected in ref["results"].items():
            got = answer["result"].get(qid)
            if got is None:
                missing.append({"item": answer["item"], "question": qid, "status": "absent"})
                continue
            dp = max(abs(got["probabilities"][label] - p) for label, p in expected["probabilities"].items())
            same = got["label"] == expected["label"]
            m = margin(expected["probabilities"])
            bucket["questions"] += 1
            bucket["maxDp"] = max(bucket["maxDp"], dp)
            bucket["top1"] += same
            if m >= 0.01:
                bucket["marginQuestions"] += 1
                bucket["marginTop1"] += same
            if "expectedScore" in expected:
                bucket["maxDScore"] = max(bucket["maxDScore"], abs(got["expectedScore"] - expected["expectedScore"]))
            bucket["maxDConfidence"] = max(bucket["maxDConfidence"], abs(got["confidence"] - expected["confidence"]))
            worst.append({"item": answer["item"], "question": qid, "dp": dp, "sameTop1": same, "referenceMargin": m})
            if "tokens" in answer and answer["tokens"].get(qid):
                tokens_checked += 1
                tokens_equal += answer["tokens"][qid]["ids"] == ref["raw"][qid]["ids"] and answer["tokens"][qid]["positions"] == ref["raw"][qid]["positions"]
    total = {"questions": 0, "maxDp": 0.0, "top1": 0, "marginQuestions": 0, "marginTop1": 0, "maxDScore": 0.0, "maxDConfidence": 0.0}
    for b in per_lang.values():
        for key in ("questions", "top1", "marginQuestions", "marginTop1"):
            total[key] += b[key]
        for key in ("maxDp", "maxDScore", "maxDConfidence"):
            total[key] = max(total[key], b[key])
    for b in [total, *per_lang.values()]:
        b["top1Rate"] = b["top1"] / b["questions"] if b["questions"] else None
        b["marginTop1Rate"] = b["marginTop1"] / b["marginQuestions"] if b["marginQuestions"] else None
    worst.sort(key=lambda w: -w["dp"])
    return {
        "reference": {"model": reference["model"], "revision": reference["revision"], "implementation": reference["implementation"]},
        "run": {"engine": run["config"]["engine"], "variant": (run.get("engineInfo") or {}).get("variant"), "status": run["status"]},
        "tokenizer": {"checked": tokens_checked, "identical": tokens_equal},
        "total": total, "byLanguage": per_lang, "worst": worst[:8], "notAnswered": missing,
    }


def main(argv: list[str]) -> int:
    args = [a for a in argv if not a.startswith("--")]
    if len(args) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    reference = json.load(open(args[0], encoding="utf-8"))
    run = json.load(open(args[1], encoding="utf-8"))
    result = compare(reference, run)
    if "--json" in argv:
        print(json.dumps(result, indent=1))
        return 0
    t = result["total"]
    print(f"{result['run']['engine']} {result['run']['variant']} vs {result['reference']['model']}: "
          f"questions={t['questions']} max|Δp|={t['maxDp']:.3e} top1={t['top1']}/{t['questions']} "
          f"top1(margin>=0.01)={t['marginTop1']}/{t['marginQuestions']} max|ΔexpectedScore|={t['maxDScore']:.3e} "
          f"max|Δconfidence|={t['maxDConfidence']:.3e} tokens={result['tokenizer']['identical']}/{result['tokenizer']['checked']} "
          f"not answered={len(result['notAnswered'])}")
    for lang, b in result["byLanguage"].items():
        print(f"  {lang}: questions={b['questions']} max|Δp|={b['maxDp']:.3e} top1={b['top1']}/{b['questions']}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
