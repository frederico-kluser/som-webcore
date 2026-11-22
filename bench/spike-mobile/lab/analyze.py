#!/usr/bin/env python3
"""Device lab report: reads one session's files in bench/results/ and writes a Markdown report.

    python3 bench/spike-mobile/lab/analyze.py <session> [--out <file>]

Inputs, all written during the session: <session>-lab.json (the steps and their status),
<session>-<step>.json (the probe, the environment check and each page run), <session>-logs.jsonl
(everything the pages logged, through lab/hook.js) and <session>-requests.jsonl (every request the
server answered). Default output: bench/results/<session>-relatorio.md. Latencies are the device's
own, but the GT thresholds are targets of the roadmap: the report labels them. No number is typed
by hand. Standard library only.
"""

from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
SPIKE = HERE.parent
RESULTS = SPIKE.parent / "results"
sys.path.insert(0, str(SPIKE / "reference"))
from check_shape import check as check_shape  # noqa: E402
from compare import compare  # noqa: E402
from summarize import row as summary_row  # noqa: E402
from web_vs_native import as_reference, cell  # noqa: E402

MB = 1_000_000
Q8 = {"int8", "8bit", "q8emb-f16", "q8emb32-f16"}
SUMMARY_HEADER = (
    "| Execução | Motor | Variante | Modelo | Estado | 1ª resposta (ms) | 1ª passada p50 (ms) | Quente p50 / p95 / p99 (ms) "
    "| Quente p50 / p95: ≤ 128 tokens · > 128 (ms) | 1ª visita (MB) | Heap JS máx. (MB) | Memória máx. (MB; PSS no Android, RSS no simulador iOS) "
    "| máx. \\|Δp\\| · top-1 | Falha |\n|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|"
)


def load(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    out = []
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            out.append(json.loads(line))
        except ValueError:
            pass
    return out


def when(entry: dict):
    """The entry's timestamp (ISO 8601, as hook.js writes it), or None."""
    try:
        return datetime.fromisoformat(str(entry.get("at")).replace("Z", "+00:00"))
    except ValueError:
        return None


def tolerance(variant: str, comparison: dict) -> str:
    """The tolerance of the variant (docs/reports/teste-mobile.md, section 1): met or not."""
    t = comparison["total"]
    if not t["questions"]:
        return "—"
    if variant in Q8:
        ok = t["maxDp"] <= 0.03 and (t["top1Rate"] or 0) >= 0.99
        return f"{'cumpre' if ok else 'não cumpre'} (8 bits: Δp ≤ 0,03 e ≥ 99%)"
    ok = t["maxDp"] <= 1e-3 and t["marginTop1"] == t["marginQuestions"]
    return f"{'cumpre' if ok else 'não cumpre'} (FP32/FP16: Δp ≤ 1e-3)"


def main(argv: list[str]) -> int:
    args = [a for a in argv if not a.startswith("--")]
    if not args:
        print(__doc__, file=sys.stderr)
        return 2
    session = args[0]
    out_path = Path(argv[argv.index("--out") + 1]) if "--out" in argv else RESULTS / f"{session}-relatorio.md"
    state = load(RESULTS / f"{session}-lab.json")
    if state is None:
        print(f"Erro: {session}-lab.json não existe em {RESULTS} — Solução: confira o nome da sessão", file=sys.stderr)
        return 1
    steps = state.get("steps") or []
    runs = {s["id"]: load(RESULTS / f"{session}-{s['id']}.json") for s in steps}
    logs = load_jsonl(RESULTS / f"{session}-logs.jsonl")
    requests = load_jsonl(RESULTS / f"{session}-requests.jsonl")
    corpus = load(SPIKE / "corpus.json")
    lines: list[str] = []
    say = lines.append

    say(f"# Laboratório de aparelho — sessão `{session}`\n")
    say(f"> Gerado por `bench/spike-mobile/lab/analyze.py` a partir dos arquivos da sessão em `bench/results/`. "
        f"Aparelho: **{state.get('label')}**; perfil `{state.get('profile')}`; modo `{state.get('mode')}`; "
        f"início {state.get('startedAt') or '—'}; fim {state.get('finishedAt') or '— (não terminou)'}. "
        "Tudo **[MEDIDO no aparelho]**; os limites do portão GT são **[ALVO]** do roadmap.\n")

    # Device and browser.
    probe = (runs.get("sonda") or {}).get("environment") or {}
    env = runs.get("ambiente") or {}
    checks = env.get("checks") or {}
    coi_probe = (runs.get("sonda-coi") or {}).get("environment") or {}
    gpu = probe.get("webgpu") or {}
    hp = gpu.get("high-performance") or {}
    compute = checks.get("webgpuCompute") or {}
    say("## Aparelho e navegador\n")
    say("| Item | Valor |\n|---|---|")
    say(f"| Navegador | `{probe.get('userAgent', '—')}` |")
    nav = checks.get("navigator") or {}
    scr = checks.get("screen") or {}
    say(f"| Tela | {scr.get('width')}×{scr.get('height')} @{scr.get('devicePixelRatio')}x; núcleos lógicos {nav.get('hardwareConcurrency')}; `deviceMemory` {nav.get('deviceMemory')} |")
    ctx = checks.get("context") or {}
    say(f"| Contexto seguro | {ctx.get('isSecureContext')}; isolado (sonda com COOP/COEP): {coi_probe.get('crossOriginIsolated', '—')} |")
    wasm, wasm_coi = probe.get("wasm") or {}, coi_probe.get("wasm") or {}
    say(f"| WebAssembly | SIMD {wasm.get('simd')}; SIMD relaxado {wasm.get('relaxedSimd')}; JSPI {wasm.get('jspi')}; threads {wasm.get('threads')} (isolado: {wasm_coi.get('threads', '—')}) |")
    say(f"| WebGPU | `navigator.gpu` {gpu.get('hasNavigatorGpu')}; adaptador {hp.get('adapter')} {json.dumps(hp.get('info') or {}, ensure_ascii=False)}; dispositivo {hp.get('device', '—')} {hp.get('deviceError') or ''} |")
    if compute.get("compute"):
        c = compute["compute"]
        say(f"| Teste de computação WebGPU | {c.get('n')} floats, {c.get('ms')} ms, {c.get('mismatches')} divergências; `shader-f16`: {'shader-f16' in (compute.get('features') or [])} (compilação: {compute.get('f16Shader')}) |")
    elif compute:
        say(f"| Teste de computação WebGPU | {json.dumps(compute, ensure_ascii=False)[:300]} |")
    webgl = checks.get("webgl") or {}
    say(f"| WebGL | {webgl.get('renderer', '—')} ({webgl.get('version', '—')}) |")
    storage = checks.get("storage") or {}
    say(f"| Armazenamento | quota {((storage.get('estimate') or {}).get('quota') or 0) / MB:,.0f} MB; OPFS {(checks.get('opfs') or {}).get('ok', checks.get('opfs'))}; IndexedDB {(checks.get('indexedDB') or {}).get('ok', checks.get('indexedDB'))} |")
    apis = checks.get("apis") or {}
    present = [k for k, v in apis.items() if v is True]
    say(f"| APIs presentes | {', '.join(present) or '—'} |")
    timer = (checks.get("timerResolution") or {}).get("minDeltaMs")
    say(f"| Resolução de `performance.now()` | {timer} ms |\n")

    # Steps.
    say("## Etapas\n")
    say("| Etapa | Estado | Tentativas | Início | Fim | Nota | Tentativas anteriores |\n|---|---|---:|---|---|---|---|")
    for s in steps:
        status = s.get("status") + (f" ({s['outcome']})" if s.get("outcome") else "")
        before = "; ".join(f"{p.get('outcome') or '—'}: {str(p.get('note') or '')[:90]}" + (f" ({p['where']})" if p.get("where") else "")
                           for p in s.get("previous") or []) or "—"
        say(f"| `{s['id']}` | {status} | {s.get('attempts', 0)} | {s.get('startedAt') or '—'} | {s.get('endedAt') or '—'} | {s.get('note') or '—'} | {before.replace('|', '/')} |")
    say("")

    # Page runs.
    page_steps = [s for s in steps if s.get("url", "").startswith("/index.html")]
    present_runs = [(s, RESULTS / f"{session}-{s['id']}.json") for s in page_steps if (RESULTS / f"{session}-{s['id']}.json").exists()]
    if present_runs:
        say("## Página de teste\n")
        say("A latência é a do aparelho. Os pesos ficam em cache entre as etapas da sessão (`cache=1`), então o tempo até a primeira resposta não é o de uma primeira visita.\n")
        say(SUMMARY_HEADER)
        for _, path in present_runs:
            say("| " + summary_row(path) + " |")
        say("")
        say("**Paridade e forma**\n")
        say("| Execução | Variante | Contra a referência | Tolerância da variante | Contra o nativo (mesmo arquivo) | Forma |\n|---|---|---|---|---|---|")
        for s, path in present_runs:
            run = load(path) or {}
            cfg = run.get("config") or {}
            variant = (run.get("engineInfo") or {}).get("variant") or cfg.get("variant") or "—"
            model = cfg.get("model") or "ts-ettin-17m"
            reference = load(SPIKE / "reference" / f"{model}.json")
            ref_cell = tol = native_cell = "—"
            if run.get("answers") and reference:
                comparison = compare(reference, run)
                ref_cell, tol = cell(comparison), tolerance(variant, comparison)
                natives = sorted(RESULTS.glob(f"*-nativo-onnxruntime-cpu-{model}-{str(variant).replace('-', '_')}.json"))
                if str(cfg.get("engine", "")).startswith("ort-") and natives:
                    native_cell = cell(compare(as_reference(load(natives[-1])), run))
            shape = "—"
            if run.get("answers") and corpus:
                problems = check_shape(run, corpus)
                shape = "igual" if not problems else f"{len(problems)} problema(s)"
            say(f"| `{s['id']}` | {variant} | {ref_cell} | {tol} | {native_cell} | {shape} |")
        say("")

    # GT criteria on this device (17M).
    say("## Critérios do portão GT neste aparelho (17M)\n")
    say("| Execução | Acerta igual? | Primeira visita até 25 MB? | p95 quente até 150 ms (iPhone e Android intermediário) **[ALVO]**? | 200 decisões sem falha? |\n|---|---|---|---|---|")
    for s, path in present_runs:
        run = load(path) or {}
        cfg = run.get("config") or {}
        if (cfg.get("model") or "ts-ettin-17m") != "ts-ettin-17m" or run.get("status") != "ok":
            continue
        variant = (run.get("engineInfo") or {}).get("variant") or cfg.get("variant") or "—"
        reference = load(SPIKE / "reference" / "ts-ettin-17m.json")
        acerta = tolerance(variant, compare(reference, run)) if reference and run.get("answers") else "—"
        first = (run.get("bytes") or {}).get("firstVisitEncoded")
        size = f"{first / MB:.2f} MB — {'sim' if first <= 25 * MB else 'não'}" if first else "—"
        warm = (run.get("latency") or {}).get("warm") or {}
        p95 = warm.get("p95")
        fast = f"{p95:.1f} ms — {'sim' if p95 <= 150 else 'não'}" if p95 is not None else "—"
        endurance = (run.get("latency") or {}).get("endurance")
        holds = "—"
        if endurance:
            asked = int(cfg.get("endurance") or 0)
            n = len(endurance.get("samplesMs") or [])
            holds = f"{n}/{asked}, falhas {endurance.get('failures')} — {'sim' if n == asked and not endurance.get('failures') else 'não'}"
        say(f"| `{s['id']}` | {acerta} | {size} | {fast} | {holds} |")
    say("")

    # Logs.
    say("## Logs\n")
    if not logs:
        say("Nenhum log recebido.\n")
    else:
        by_kind = Counter((e.get("kind"), e.get("level")) for e in logs)
        say(f"{len(logs)} entradas. Por tipo e nível: " + "; ".join(f"`{k}`/{lvl} {n}" for (k, lvl), n in sorted(by_kind.items(), key=lambda x: -x[1])) + ".\n")
        # "device lost: destroyed" is a device the page destroyed itself (the probe does): not an error.
        # ONNX Runtime prints its warnings ([W:onnxruntime ...], in terminal colours) through console.error.
        def ort_warning(e: dict) -> bool:
            return "[W:onnxruntime" in str(e.get("text", ""))
        errors = Counter((e.get("source"), str(e.get("text", "")).split("\n")[0][:220]) for e in logs
                         if e.get("level") == "error" and not str(e.get("text", "")).startswith("device lost: destroyed") and not ort_warning(e))
        if errors:
            say("**Erros** (os mais frequentes):\n")
            say("| Origem | Mensagem | Vezes |\n|---|---|---:|")
            for (source, text), n in errors.most_common(25):
                say(f"| `{source}` | {text.replace('|', '/')} | {n} |")
            say("")
        webgpu = [e for e in logs if e.get("kind") == "webgpu"]
        if webgpu:
            say("**WebGPU** (eventos distintos):\n")
            seen = set()
            for e in webgpu:
                key = (e.get("source"), e.get("text"))
                if key in seen:
                    continue
                seen.add(key)
                say(f"- `{e.get('source')}` — {e.get('level')}: {str(e.get('text'))[:300]}")
            say("")
        # The lab page itself hidden during the run; removed iframes also report "hidden", and do not count.
        start, end = state.get("startedAt") or "", state.get("finishedAt") or "9999"
        hidden = [e for e in logs if e.get("kind") == "lifecycle" and "visibility hidden" in str(e.get("text"))
                  and "(iframe)" not in str(e.get("source")) and start <= str(e.get("at")) <= end]
        # The lab reopening itself cross-origin isolated also hides the page for a moment: not the user.
        reopen = [when(e) for e in logs if e.get("kind") == "console" and "isolamento de origem" in str(e.get("text"))]
        hidden = [e for e in hidden if not any(r and when(e) and 0 <= (when(e) - r).total_seconds() <= 10 for r in reopen)]
        # Each step is a navigation: a page that goes away is hidden first. Hidden followed by the
        # page's own pagehide within 3 s is the lab moving on, not the screen going off.
        leaving = defaultdict(list)
        for e in logs:
            if e.get("kind") == "lifecycle" and e.get("text") == "pagehide" and when(e):
                leaving[e.get("source")].append(when(e))
        hidden = [e for e in hidden if not any(when(e) and -3 <= (t - when(e)).total_seconds() <= 3 for t in leaving[e.get("source")])]
        say(f"**Ciclo de vida:** a página ficou oculta {len(hidden)} vez(es)" + (" — as medições dessas etapas podem ter sido estranguladas pelo navegador" if hidden else "") + ".")
        for e in hidden[:10]:
            say(f"- {e.get('at')} em `{e.get('source')}`")
        warns = Counter(re.sub(r"\x1b?\[[0-9;]*m|^\d{4}-\d\d-\d\d [\d:.]+ ", "", str(e.get("text", "")).split("\n")[0])[:200]
                        for e in logs if e.get("level") == "warn" or ort_warning(e))
        if warns:
            say("\n**Avisos** (os mais frequentes): " + "; ".join(f"“{t}” ×{n}" for t, n in warns.most_common(8)))
        say("")

    # Network.
    if requests:
        ok = [r for r in requests if r.get("status") == 200]
        total = sum(r.get("bytes") or 0 for r in ok)
        say("## Rede\n")
        say(f"{len(requests)} requisições respondidas; {total / MB:,.2f} MB enviados ao aparelho. As maiores:\n")
        say("| Caminho | Bytes | Tempo (ms) | MB/s |\n|---|---:|---:|---:|")
        for r in sorted(ok, key=lambda r: -(r.get("bytes") or 0))[:10]:
            rate = (r["bytes"] / MB) / (r["ms"] / 1000) if r.get("bytes") and r.get("ms") else None
            say(f"| `{r['path'][:90]}` | {r.get('bytes') or 0:,} | {r.get('ms')} | {f'{rate:.1f}' if rate else '—'} |")
        statuses = Counter(r.get("status") for r in requests)
        say(f"\nEstados HTTP: {dict(statuses)}.\n")

    # Automatic conclusions.
    say("## Conclusões automáticas\n")
    done = Counter(s.get("status") for s in steps)
    say(f"- Etapas: {dict(done)} de {len(steps)}; a sessão {'terminou' if state.get('done') else '**não terminou**'}.")
    say(f"- WebGPU no aparelho: {'**disponível**' if hp.get('adapter') and hp.get('device') else 'indisponível'}"
        + (f" ({(hp.get('info') or {}).get('vendor')} {(hp.get('info') or {}).get('architecture')}); computação {'correta' if (compute.get('compute') or {}).get('mismatches') == 0 else 'com divergências ou não testada'}" if hp.get("adapter") else "") + ".")
    ran = [s["id"] for s, p in present_runs if (load(p) or {}).get("status") == "ok"]
    failed = [(s["id"], ((load(p) or {}).get("fatal") or {}).get("message") or (((load(p) or {}).get("failures") or [{}])[0].get("error") or {}).get("message")) for s, p in present_runs if (load(p) or {}).get("status") != "ok"]
    say(f"- Rodaram: {', '.join(f'`{r}`' for r in ran) or '—'}.")
    for step_id, message in failed:
        say(f"- Não rodou `{step_id}`: {str(message)[:200]}")
    missing = [s["id"] for s in page_steps if not (RESULTS / f"{session}-{s['id']}.json").exists()]
    if missing:
        say(f"- Sem resultado (etapa não executada): {', '.join(f'`{m}`' for m in missing)}.")
    oom = [(s["id"], p) for s in steps for p in s.get("previous") or [] if "out of memory" in str(p.get("note")).lower()]
    if oom:
        say(f"- Tentativas que pararam em `Out of memory` e foram repetidas: {len(oom)}, em "
            + ", ".join(sorted({f'`{i}`' for i, _ in oom})) + ". É memória do Wasm presa no processo do Safari, não o motor: a repetição depois de reabrir o Safari é a medição.")
    say("")

    text = "\n".join(lines) + "\n"
    out_path.write_text(text, encoding="utf-8")
    print(text)
    print(f"(relatório gravado em {out_path})", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
