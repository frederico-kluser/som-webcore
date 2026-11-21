#!/usr/bin/env python3
"""Reference answers for the T milestone corpus, from the model's own implementation.

Runs dinah.py (PyTorch, FP32, CPU) from the pinned checkpoint in the local model cache and applies
the same Decisions API translation as engines/ts-ettin.js:

  boolean -> dinah "noul": options ["The statement above is false.", prompt]; labels "true", "false"
  choice  -> option text = description, or the label when there is no description
  score   -> options default to "1".."5"; option text = description or label
  probabilities = softmax(logits / temperature[qtype][k]); label = first most probable option;
  confidence = its probability; expectedScore = sum(value * p) (numeric labels, else 1-based positions)

Each question runs alone (batch of one). Output: probabilities in float64, plus the token ids,
[OPT] positions and raw logits of every question, so a difference can be traced to the tokenizer
or to the engine.

    .venv/Scripts/python.exe -I bench/spike-mobile/reference/run_reference.py ts-ettin-17m
    .venv/Scripts/python.exe -I bench/spike-mobile/reference/run_reference.py ts-ettin-32m

Writes bench/spike-mobile/reference/<model>.json. Deterministic: one CPU thread, deterministic
algorithms; two runs produce the same file.

Diagnostic mode (not the reference): run one of the published ONNX graphs on the native ONNX Runtime
(Python, CPU, one thread) with the same inputs, and write a page-shaped run to bench/results/, so
quantization error can be told apart from the browser engine's error:

    .venv/Scripts/python.exe -I bench/spike-mobile/reference/run_reference.py ts-ettin-17m --onnx onnx/model_int8.onnx
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
import math
import os
import platform
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SPIKE = HERE.parent
NOUL_FALSE_DEFAULT = "The statement above is false."
DEFAULT_SCORE_LABELS = ["1", "2", "3", "4", "5"]
QTYPE = {"boolean": 0, "choice": 1, "score": 2}
NUMBER = re.compile(r"^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$")


def cache_dir() -> Path:
    if os.environ.get("SOM_MODEL_CACHE"):
        return Path(os.environ["SOM_MODEL_CACHE"])
    if os.name == "nt" and os.environ.get("LOCALAPPDATA"):
        return Path(os.environ["LOCALAPPDATA"]) / "som-webcore" / "models"
    return Path.home() / ".cache" / "som-webcore" / "models"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def blank(text) -> bool:
    return not isinstance(text, str) or not text.strip()


def compile_question(question: dict) -> dict:
    kind = question["type"]
    if kind == "boolean":
        labels, texts, to_model = ["true", "false"], [NOUL_FALSE_DEFAULT, question["prompt"]], [1, 0]
    else:
        options = question.get("options") or []
        if kind == "score" and not options:
            options = [{"label": label} for label in DEFAULT_SCORE_LABELS]
        labels = [o["label"] for o in options]
        texts = [o["label"] if blank(o.get("description")) else o["description"] for o in options]
        to_model = list(range(len(labels)))
    values = None
    if kind == "score":
        numbers = [float(label) if NUMBER.match(label) else math.nan for label in labels]
        all_numbers = all(math.isfinite(n) for n in numbers)
        values = [numbers[i] if all_numbers else float(i + 1) for i in range(len(labels))]
    return {"id": question["id"], "type": kind, "qtype": QTYPE[kind], "labels": labels, "texts": texts, "to_model": to_model, "values": values}


def decode(model, compiled: dict, logits) -> dict:
    k = len(compiled["labels"])
    t = 1.0
    if model.temperature is not None:
        t = float(model.temperature[compiled["qtype"], min(max(k, 2), 9) - 2])
    z = [float(logits[m]) / t for m in compiled["to_model"]]
    top_z = max(z)
    e = [math.exp(v - top_z) for v in z]
    total = sum(e)
    p = [v / total for v in e]
    top = 0
    for i in range(1, k):
        if p[i] > p[top]:
            top = i
    decision = {"confidence": p[top]}
    if compiled["type"] == "score":
        decision["expectedScore"] = sum(v * pi for v, pi in zip(compiled["values"], p))
    decision["id"] = compiled["id"]
    decision["label"] = compiled["labels"][top]
    decision["probabilities"] = dict(zip(compiled["labels"], p))
    return decision


def load_dinah(directory: Path):
    spec = importlib.util.spec_from_file_location("dinah", directory / "dinah.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main(argv: list[str]) -> int:
    onnx_file = None
    if "--onnx" in argv:
        i = argv.index("--onnx")
        onnx_file = argv[i + 1] if i + 1 < len(argv) else None
        argv = argv[:i] + argv[i + 2:]
        if not onnx_file:
            print("Erro: --onnx sem arquivo — Solução: --onnx onnx/model_int8.onnx", file=sys.stderr)
            return 2
    if len(argv) != 1:
        print("Erro: uso inválido — Solução: run_reference.py <model id de models.json> [--onnx <arquivo>]", file=sys.stderr)
        return 2
    manifest = json.loads((SPIKE / "models.json").read_text(encoding="utf-8"))
    entry = next((m for m in manifest["models"] if m["id"] == argv[0]), None)
    if entry is None:
        print(f"Erro: modelo desconhecido {argv[0]} — Solução: use um id de models.json", file=sys.stderr)
        return 2
    directory = cache_dir() / entry["repo"] / entry["revision"]
    for name in ("config.json", "model.safetensors", "tokenizer.json", "dinah.py"):
        pin = entry["files"][name]
        if not (directory / name).exists() or sha256(directory / name) != pin["sha256"]:
            print(f"Erro: {name} ausente ou com hash diferente em {directory} — Solução: python bench/spike-mobile/fetch-models.py {entry['id']}", file=sys.stderr)
            return 1

    import numpy as np
    import torch
    import transformers

    torch.set_num_threads(1)
    torch.use_deterministic_algorithms(True)
    dinah = load_dinah(directory)
    if onnx_file:
        return run_native_onnx(dinah, directory, entry, onnx_file)
    model = dinah.Dinah.from_pretrained(directory, device="cpu", dtype="float32")

    corpus = json.loads((SPIKE / "corpus.json").read_text(encoding="utf-8"))
    out_items = []
    for item in corpus["items"]:
        schema = corpus["schemas"][item["schema"]]
        results, raw = {}, {}
        for question in schema["questions"]:
            compiled = compile_question(question)
            ids, positions = model._encode(question["prompt"], item["input"], compiled["texts"])
            batch = model._batch([(ids, positions, compiled["qtype"])])
            logits, conf = model._forward(batch)
            row = logits[0, : len(compiled["texts"])].astype(np.float64)
            results[question["id"]] = decode(model, compiled, row)
            raw[question["id"]] = {"ids": ids, "positions": positions, "logits": [float(x) for x in row], "confLogit": float(conf[0])}
        out_items.append({"item": item["id"], "lang": item["lang"], "schema": item["schema"], "results": results, "raw": raw})

    report = {
        "kind": "spike-mobile-reference",
        "model": entry["id"], "repo": entry["repo"], "revision": entry["revision"],
        "weightsSha256": entry["files"]["model.safetensors"]["sha256"],
        "implementation": "dinah.py Dinah (PyTorch, FP32, CPU, batch of one)",
        "versions": {"python": platform.python_version(), "torch": torch.__version__, "transformers": transformers.__version__, "numpy": np.__version__},
        "corpusVersion": corpus["version"],
        "items": out_items,
    }
    target = HERE / f"{entry['id']}.json"
    target.write_text(json.dumps(report, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"written {target} ({len(out_items)} items)")
    return 0


def run_native_onnx(dinah, directory: Path, entry: dict, onnx_file: str) -> int:
    """Diagnostic: the same questions on the native ONNX Runtime (CPU, one thread), page-shaped output."""
    import onnxruntime as ort

    if onnx_file.startswith("derived/"):
        # A graph derived locally from the pinned weights (export_onnx.py, requantize_onnx.py): no pin;
        # its SHA-256 goes into the output instead.
        path = cache_dir() / "derived" / entry["repo"] / entry["revision"] / onnx_file[len("derived/"):]
        if not path.exists():
            print(f"Erro: {path} ausente — Solução: gere-o com export_onnx.py ou requantize_onnx.py", file=sys.stderr)
            return 1
    else:
        path = directory / onnx_file
        pin = entry["files"].get(onnx_file)
        if pin is None or sha256(path) != pin["sha256"]:
            print(f"Erro: {onnx_file} ausente ou com hash diferente — Solução: fetch-models.py {entry['id']}", file=sys.stderr)
            return 1
    codec = dinah._Base(directory)  # tokenizer, calibration and batching only
    options = ort.SessionOptions()
    options.intra_op_num_threads = 1
    session = ort.InferenceSession(str(path), options, providers=["CPUExecutionProvider"])
    corpus = json.loads((SPIKE / "corpus.json").read_text(encoding="utf-8"))
    answers = []
    for item in corpus["items"]:
        schema = corpus["schemas"][item["schema"]]
        result = {}
        for question in schema["questions"]:
            compiled = compile_question(question)
            ids, positions = codec._encode(question["prompt"], item["input"], compiled["texts"])
            logits, _ = session.run(["logits", "conf_logit"], codec._batch([(ids, positions, compiled["qtype"])]))
            result[question["id"]] = decode(codec, compiled, logits[0, : len(compiled["texts"])].astype("float64"))
        answers.append({"item": item["id"], "lang": item["lang"], "schema": item["schema"], "status": "ok", "result": result})
    variant = Path(onnx_file).stem.replace("model_", "")
    report = {
        "kind": "native-onnxruntime-run", "status": "ok",
        "config": {"engine": "onnxruntime-python-cpu", "model": entry["id"], "variant": variant},
        "engineInfo": {"runtime": "onnxruntime (Python)", "version": ort.__version__, "variant": variant, "threads": 1,
                       "file": onnx_file, "fileBytes": path.stat().st_size, "fileSha256": sha256(path)},
        "answers": answers,
    }
    target = SPIKE.parent / "results" / f"2026-11-21-nativo-onnxruntime-cpu-{entry['id']}-{variant}.json"
    target.write_text(json.dumps(report, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"written {target}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
