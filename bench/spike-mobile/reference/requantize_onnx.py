#!/usr/bin/env python3
"""Derive a smaller graph from the exported FP32 graph (export_onnx.py), without touching the engine:

  - the token-embedding table goes to int8 with one float32 scale per row (symmetric, max|row|/127);
    the graph gathers the int8 rows of the input ids and dequantizes only those rows;
  - every other float32 matrix (2-D initializer) is stored in float16 and cast back to float32 in the
    graph, so the arithmetic stays float32.

    .venv/Scripts/python.exe -I bench/spike-mobile/reference/requantize_onnx.py ts-ettin-17m [--group 32] [--matmul8] [--scale-f16]

Options: --group G uses one scale per G consecutive values of each row (default: one per row);
--matmul8 first turns every MatMul with a constant weight into com.microsoft:MatMulNBits with 8-bit
weights in blocks of 32 (symmetric; the operator of the published "8bit" graph); --scale-f16 stores
the embedding scales in float16. Output (local only, never in git), in <cache>/derived/<repo>/<revision>/:
model_q8emb_f16.onnx, model_q8emb<G>_f16.onnx, or model_q8emb<G>[_mm8][_s16].onnx with the options.
Then checks it on the native ONNX Runtime against the reference answers of the corpus (max |Δp|, top-1).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from run_reference import cache_dir, compile_question, decode, load_dinah  # noqa: E402


def main(argv: list[str]) -> int:
    group = None
    if "--group" in argv:
        i = argv.index("--group")
        group = int(argv[i + 1])
        argv = argv[:i] + argv[i + 2:]
    matmul8 = "--matmul8" in argv
    scale_f16 = "--scale-f16" in argv
    argv = [a for a in argv if a not in ("--matmul8", "--scale-f16")]
    if len(argv) != 1:
        print("Erro: uso inválido — Solução: requantize_onnx.py <model id> [--group G]", file=sys.stderr)
        return 2
    manifest = json.loads((HERE.parent / "models.json").read_text(encoding="utf-8"))
    entry = next((m for m in manifest["models"] if m["id"] == argv[0]), None)
    if entry is None:
        print(f"Erro: modelo desconhecido {argv[0]}", file=sys.stderr)
        return 2
    derived = cache_dir() / "derived" / entry["repo"] / entry["revision"]
    source = derived / "model_fp32.onnx"
    if not source.exists():
        print(f"Erro: {source} ausente — Solução: rode export_onnx.py {entry['id']} antes", file=sys.stderr)
        return 1

    import numpy as np
    import onnx
    import onnxruntime as ort
    from onnx import TensorProto, helper, numpy_helper

    config = json.loads((cache_dir() / entry["repo"] / entry["revision"] / "config.json").read_text(encoding="utf-8"))
    vocab, hidden = config["vocab_size"], config["hidden_size"]
    model = onnx.load(str(source))
    if matmul8:
        from onnxruntime.quantization.matmul_nbits_quantizer import MatMulNBitsQuantizer
        quantizer = MatMulNBitsQuantizer(model, bits=8, block_size=32, is_symmetric=True)
        quantizer.process()
        model = quantizer.model.model
    graph = model.graph
    inits = {t.name: t for t in graph.initializer}
    table = next(t for t in graph.initializer if list(t.dims) == [vocab, hidden] and t.data_type == TensorProto.FLOAT)
    users = [n for n in graph.node if table.name in n.input]
    if len(users) != 1 or users[0].op_type != "Gather" or users[0].input[0] != table.name:
        print(f"Erro: a tabela {table.name} não é usada só por um Gather ({[n.op_type for n in users]})", file=sys.stderr)
        return 1
    gather = users[0]

    # 1. int8 embeddings, one scale per row (or per group of G values); dequantize the gathered rows only.
    w = numpy_helper.to_array(table).astype(np.float32)
    g = group or hidden
    if hidden % g:
        print(f"Erro: hidden {hidden} não é múltiplo do grupo {g}", file=sys.stderr)
        return 2
    blocks = w.reshape(vocab, hidden // g, g)
    scale = np.maximum(np.abs(blocks).max(axis=2), 1e-12) / 127.0          # [vocab, hidden/g]
    q = np.clip(np.rint(blocks / scale[:, :, None]), -127, 127).astype(np.int8).reshape(vocab, hidden)
    if group is None:
        scale = scale.reshape(vocab)  # one scale per row: [vocab]
    graph.initializer.remove(table)
    scale_name = table.name + "_scale"
    if scale_f16:  # stored as float16, cast back to float32 before use
        graph.initializer.extend([numpy_helper.from_array(q, table.name + "_q8"), numpy_helper.from_array(scale.astype(np.float16), scale_name + "_f16")])
    else:
        graph.initializer.extend([numpy_helper.from_array(q, table.name + "_q8"), numpy_helper.from_array(scale.astype(np.float32), scale_name)])
    out = gather.output[0]
    ids = gather.input[1]
    if group is None:
        new_nodes = [
            helper.make_node("Gather", [table.name + "_q8", ids], [out + "_q8"], axis=0),
            helper.make_node("Cast", [out + "_q8"], [out + "_q8f"], to=TensorProto.FLOAT),
            helper.make_node("Gather", [table.name + "_scale", ids], [out + "_s"], axis=0),
            helper.make_node("Unsqueeze", [out + "_s", "q8emb_axis"], [out + "_s1"]),
            helper.make_node("Mul", [out + "_q8f", out + "_s1"], [out]),
        ]
        graph.initializer.append(numpy_helper.from_array(np.array([-1], dtype=np.int64), "q8emb_axis"))
    else:
        # [B, L, H] -> [B, L, H/g, g] * scales [B, L, H/g, 1] -> [B, L, H]
        new_nodes = [
            helper.make_node("Gather", [table.name + "_q8", ids], [out + "_q8"], axis=0),
            helper.make_node("Cast", [out + "_q8"], [out + "_q8f"], to=TensorProto.FLOAT),
            helper.make_node("Reshape", [out + "_q8f", "q8emb_grouped"], [out + "_g"]),
            helper.make_node("Gather", [table.name + "_scale", ids], [out + "_s"], axis=0),
            helper.make_node("Unsqueeze", [out + "_s", "q8emb_axis"], [out + "_s1"]),
            helper.make_node("Mul", [out + "_g", out + "_s1"], [out + "_m"]),
            helper.make_node("Reshape", [out + "_m", "q8emb_flat"], [out]),
        ]
        graph.initializer.extend([
            numpy_helper.from_array(np.array([0, 0, hidden // g, g], dtype=np.int64), "q8emb_grouped"),
            numpy_helper.from_array(np.array([0, 0, hidden], dtype=np.int64), "q8emb_flat"),
            numpy_helper.from_array(np.array([-1], dtype=np.int64), "q8emb_axis"),
        ])
    if scale_f16:
        new_nodes.insert(0, helper.make_node("Cast", [scale_name + "_f16"], [scale_name], to=TensorProto.FLOAT))
    position = list(graph.node).index(gather)
    graph.node.remove(gather)
    for offset, node in enumerate(new_nodes):
        graph.node.insert(position + offset, node)

    # 2. Other float32 matrices stored as float16 and cast back to float32 where they are used.
    converted = 0
    nbits_inputs = {name for n in graph.node if n.op_type == "MatMulNBits" for name in n.input}
    for init in list(graph.initializer):
        if init.data_type != TensorProto.FLOAT or len(init.dims) != 2 or init.name.endswith("_scale") or init.name in nbits_inputs:
            continue
        half = numpy_helper.from_array(numpy_helper.to_array(init).astype(np.float16), init.name + "_f16")
        graph.initializer.remove(init)
        graph.initializer.append(half)
        position = next(i for i, n in enumerate(graph.node) if init.name in n.input)
        graph.node.insert(position, helper.make_node("Cast", [init.name + "_f16"], [init.name], to=TensorProto.FLOAT))
        converted += 1

    if matmul8 or scale_f16:
        target = derived / f"model_q8emb{group or ''}{'_mm8' if matmul8 else ''}{'_s16' if scale_f16 else ''}.onnx"
    else:
        target = derived / (f"model_q8emb{group}_f16.onnx" if group else "model_q8emb_f16.onnx")
    onnx.checker.check_model(model)
    onnx.save(model, str(target))
    print(f"written {target} ({target.stat().st_size:,} bytes; embeddings int8 per row; {converted} matrices in float16)")

    # Check on the native ONNX Runtime against the reference answers.
    reference = json.loads((HERE / f"{entry['id']}.json").read_text(encoding="utf-8"))
    dinah = load_dinah(cache_dir() / entry["repo"] / entry["revision"])
    codec = dinah._Base(cache_dir() / entry["repo"] / entry["revision"])
    session = ort.InferenceSession(str(target), providers=["CPUExecutionProvider"])
    corpus = json.loads((HERE.parent / "corpus.json").read_text(encoding="utf-8"))
    worst, same, n = 0.0, 0, 0
    ref_items = {i["item"]: i for i in reference["items"]}
    for item in corpus["items"]:
        for question in corpus["schemas"][item["schema"]]["questions"]:
            c = compile_question(question)
            ids_, pos = codec._encode(question["prompt"], item["input"], c["texts"])
            logits, _ = session.run(["logits", "conf_logit"], codec._batch([(ids_, pos, c["qtype"])]))
            got = decode(codec, c, logits[0, : len(c["texts"])].astype("float64"))
            exp = ref_items[item["id"]]["results"][question["id"]]
            worst = max(worst, max(abs(got["probabilities"][k] - v) for k, v in exp["probabilities"].items()))
            same += got["label"] == exp["label"]
            n += 1
    print(f"native ONNX Runtime vs reference: max |Δp| = {worst:.3e}; top-1 {same}/{n}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
