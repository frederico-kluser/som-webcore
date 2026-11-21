#!/usr/bin/env python3
"""Export an FP32 ONNX graph of a TS-Ettin checkpoint, with the inputs and outputs of the published
graphs (ids, pad_mask, opt_positions, opt_mask, qtype -> logits, conf_logit), from dinah.py's PyTorch
model. It lets the browser engine be measured without quantization error. The file is derived from
the pinned weights and stays in the local cache (never in git):

    <cache>/derived/<repo>/<revision>/model_fp32.onnx

    .venv/Scripts/python.exe -I bench/spike-mobile/reference/export_onnx.py ts-ettin-17m

After exporting, it checks the graph on the native ONNX Runtime against PyTorch on every corpus
question and prints the largest logit difference.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from run_reference import NOUL_FALSE_DEFAULT, cache_dir, compile_question, load_dinah, sha256  # noqa: E402,F401


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        print("Erro: uso inválido — Solução: export_onnx.py <model id>", file=sys.stderr)
        return 2
    manifest = json.loads((HERE.parent / "models.json").read_text(encoding="utf-8"))
    entry = next((m for m in manifest["models"] if m["id"] == argv[0]), None)
    if entry is None:
        print(f"Erro: modelo desconhecido {argv[0]} — Solução: use um id de models.json", file=sys.stderr)
        return 2
    directory = cache_dir() / entry["repo"] / entry["revision"]
    if sha256(directory / "model.safetensors") != entry["files"]["model.safetensors"]["sha256"]:
        print("Erro: pesos com hash diferente — Solução: fetch-models.py", file=sys.stderr)
        return 1

    import numpy as np
    import onnxruntime as ort
    import torch

    torch.set_num_threads(1)
    dinah = load_dinah(directory)
    model = dinah.Dinah.from_pretrained(directory, device="cpu", dtype="float32")
    net = model.net

    class Graph(torch.nn.Module):
        """dinah.Dinah._forward, as a module: same inputs, outputs and arithmetic."""

        def __init__(self):
            super().__init__()
            self.net = net

        def forward(self, ids, pad_mask, opt_positions, opt_mask, qtype):
            h = self.net.encoder(input_ids=ids, attention_mask=pad_mask).last_hidden_state
            h = h + self.net.type_embedding(qtype)[:, None, :]
            idx = opt_positions.unsqueeze(-1).expand(-1, -1, h.size(-1))
            logits = self.net.scorer(h.gather(1, idx)).squeeze(-1)
            logits = torch.where(opt_mask, logits, torch.full_like(logits, dinah.NEG))
            probs = logits.log_softmax(-1).exp() * opt_mask
            conf = self.net.confidence.net(dinah._confidence_features(probs, opt_mask, qtype)).squeeze(-1)
            return logits, conf

    corpus = json.loads((HERE.parent / "corpus.json").read_text(encoding="utf-8"))
    samples = []
    for item in corpus["items"]:
        for question in corpus["schemas"][item["schema"]]["questions"]:
            c = compile_question(question)
            ids, positions = model._encode(question["prompt"], item["input"], c["texts"])
            samples.append(model._batch([(ids, positions, c["qtype"])]))
    example = {k: torch.as_tensor(v) for k, v in samples[0].items()}
    graph = Graph().eval()
    target = cache_dir() / "derived" / entry["repo"] / entry["revision"] / "model_fp32.onnx"
    target.parent.mkdir(parents=True, exist_ok=True)
    names = ["ids", "pad_mask", "opt_positions", "opt_mask", "qtype"]
    batch, tokens, options = torch.export.Dim("lote"), torch.export.Dim("tokens"), torch.export.Dim("opcoes")
    with torch.no_grad():
        torch.onnx.export(
            graph, tuple(example[n] for n in names), str(target),
            input_names=names, output_names=["logits", "conf_logit"], opset_version=18, dynamo=True,
            dynamic_shapes=({0: batch, 1: tokens}, {0: batch, 1: tokens}, {0: batch, 1: options}, {0: batch, 1: options}, {0: batch}),
            external_data=False,
        )
    session = ort.InferenceSession(str(target), providers=["CPUExecutionProvider"])
    worst = 0.0
    for feeds in samples:
        expected, _ = model._forward(feeds)
        got, _ = session.run(["logits", "conf_logit"], feeds)
        k = int(feeds["opt_mask"].sum())
        worst = max(worst, float(np.abs(got[0, :k] - expected[0, :k]).max()))
    print(f"written {target} ({target.stat().st_size:,} bytes); max |Δlogit| ONNX Runtime vs PyTorch over {len(samples)} questions: {worst:.3e}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
