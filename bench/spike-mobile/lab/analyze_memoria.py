"""The `memoria` section of the device lab report (analyze.py): the C-01 memory budget.

Reads, for one session in bench/results/: <session>-lab.json (steps, process epochs, restarts), each
<session>-<step>.json written by lab/memoria.js (or by lab.js when the tab died: outcome "morreu", with
the last marker and what the page had checkpointed), the test pages with the ledgers of lab/hook.js,
and <session>-desktop.json (memory of the browser's processes, from lab/run-lab.mjs) when there is one.
Every number is labelled [MEDIDO] with the file it came from; the margin of the tier table is a rule
of this script, labelled [HIPÓTESE]. Standard library only.
"""

from __future__ import annotations

import json
from pathlib import Path

MiB = 1 << 20


def _load(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _mib(value, digits=0):
    if value is None:
        return "—"
    return f"{value / MiB:,.{digits}f} MiB"


def _num(value, digits=1, unit=""):
    if value is None:
        return "—"
    return f"{value:,.{digits}f}{unit}"


def _cell(text) -> str:
    return str(text if text not in (None, "") else "—").replace("|", "/").replace("\n", " ")


def _largest_ok(run: dict) -> int | None:
    """The largest total that worked: what the page confirmed, or what the last marker says it had."""
    values = []
    if run.get("maiorAlocacaoOkBytes"):
        values.append(run["maiorAlocacaoOkBytes"])
    data = (run.get("lastMarker") or {}).get("data") or {}
    if isinstance(data.get("confirmadoMiB"), (int, float)):
        values.append(int(data["confirmadoMiB"] * MiB))
    return max(values) if values else None


def _where(run: dict) -> str:
    marker = run.get("lastMarker") or {}
    if run.get("outcome") == "morreu":
        return f"último marcador: {marker.get('text') or '—'}" if marker else "sem marcador"
    if run.get("outcome") == "erro":
        steps = run.get("steps") or []
        failed = [s for s in steps if s.get("erro")]
        if failed:
            return f"passo {failed[-1].get('i')} (com {_num(failed[-1].get('totalMiB'), 0)} MiB confirmados)"
    return "—"


def _ledger_peaks(run: dict) -> tuple[str, str]:
    """GPU and Wasm peaks of the page's ledger (hook.js), or of the last marker when the page died."""
    ledger = run.get("ledger") or {}
    for key in ("end", "afterDispose", "beforeDispose", "peak"):
        snap = ledger.get(key)
        if snap and snap.get("gpu"):
            return _mib(snap["gpu"].get("peakBytes"), 1), _mib((snap.get("wasm") or {}).get("peakBytes"), 1)
    summary = (run.get("lastMarker") or {}).get("ledger")
    if summary:
        return f"{summary['gpu'].get('peakMiB')} MiB (marcador)", f"{summary['wasm'].get('peakMiB')} MiB (marcador)"
    return "—", "—"


def section(session: str, state: dict, results: Path, say, margin: float = 0.5) -> None:
    steps = state.get("steps") or []
    memory_steps = [s for s in steps if str(s.get("url", "")).startswith("/lab/memoria.html")]
    if not memory_steps and not state.get("epochs"):
        return
    files = {s["id"]: f"{session}-{s['id']}.json" for s in steps}
    runs = {s["id"]: (_load(results / files[s["id"]]) or {}) for s in steps}
    desktop = _load(results / f"{session}-desktop.json")

    say("## Memória (perfil `memoria`, C-01)\n")
    say("Cada número vem do arquivo citado **[MEDIDO]**, no aparelho e no navegador da sessão. "
        "“Morreu” é a aba derrubada pelo sistema (o laboratório viu a recarga, ou a etapa voltou sem resultado); "
        "o ponto de queda é o último marcador gravado **antes** do passo que a derrubou.\n")

    # Process epochs.
    epochs = state.get("epochs") or []
    if epochs:
        say("### Processos do navegador (épocas)\n")
        say("Uma época é um processo do navegador que o laboratório sabe ser novo: o início, cada queda (o Safari recarrega a aba num processo novo) e cada reinício pedido. "
            f"Reinícios pedidos nesta sessão: **{len(state.get('restarts') or [])}**.\n")
        say("| Processo | Início | Motivo | Etapas, em ordem |\n|---:|---|---|---|")
        for e in epochs:
            say(f"| {e.get('n')} | {e.get('startedAt') or '—'} | {_cell(e.get('reason'))} | {', '.join(f'`{x}`' for x in e.get('steps') or []) or '—'} |")
        say("")

    # Every memory experiment.
    if memory_steps:
        say("### Experimentos\n")
        say("| Etapa | Processo | Desfecho | Maior alocação que funcionou | Onde parou | Erro (literal) | Teto | Pico GPU · Wasm (livro-caixa) | Arquivo |\n|---|---:|---|---:|---|---|---|---|---|")
        for s in memory_steps:
            run = runs[s["id"]]
            if not run:
                say(f"| `{s['id']}` | {s.get('epoch', '—')} | {s.get('status')} (sem resultado) | — | — | — | — | — | — |")
                continue
            largest = _largest_ok(run) if run.get("experiment") in ("gpu-rampa", "host-rampa") else None
            gpu_peak, wasm_peak = _ledger_peaks(run)
            cap = (run.get("teto") or {})
            cap_text = _mib(cap.get("bytes")) if cap.get("bytes") else ("sem teto" if cap else "—")
            say(f"| `{s['id']}` | {s.get('epoch', '—')} | **{run.get('outcome') or '—'}** | {_mib(largest) if largest else '—'} | {_cell(_where(run))[:160]} | "
                f"{_cell(run.get('erro'))[:160]} | {cap_text} | {gpu_peak} · {wasm_peak} | `{files[s['id']]}` |")
        say("")
        say("**Resumo de cada etapa** (o `resumo` que a página gravou):\n")
        for s in memory_steps:
            run = runs[s["id"]]
            if run.get("resumo"):
                say(f"- `{s['id']}` — {_cell(run['resumo'])[:400]}")
        say("")

    # Wasm slots.
    slots = [s for s in memory_steps if (runs[s["id"]].get("experiment") in ("vagas", "vagas-navegacao"))]
    if slots:
        say("### Vagas de memória Wasm (X1, X2)\n")
        say("| Etapa | Descritor | Processo (antes nele) | Memórias criadas | Erro da seguinte (literal) | `ort` com estas presas | Arquivo |\n|---|---|---|---:|---|---|---|")
        for s in slots:
            run = runs[s["id"]]
            count = run.get("contagem") or {}
            ort = run.get("ortComEstasPresas") or {}
            before = ", ".join((run.get("epoch") or {}).get("before") or s.get("before") or []) or "nada"
            ort_text = f"{ort.get('ok')}{' (' + ort['error'] + ')' if ort.get('error') else ''}" if ort else "—"
            say(f"| `{s['id']}` | `{json.dumps(run.get('descriptor') or count.get('descriptor'))}` | {s.get('epoch', '—')} ({_cell(before)[:120]}) | "
                f"{count.get('ok', '—') if run.get('outcome') != 'morreu' else 'morreu'} | {_cell(count.get('error'))[:140]} | {_cell(ort_text)[:120]} | `{files[s['id']]}` |")
        say("")
        for s in slots:
            run = runs[s["id"]]
            release = run.get("liberacao")
            if release:
                say(f"**Liberação depois de esgotar as vagas `ort`** (`{files[s['id']]}`):\n")
                say("| Quando | Memórias `ort` criadas | Erro | Coletadas pelo GC (livro-caixa) |\n|---|---:|---|---:|")
                for r in release.get("semReferencias") or []:
                    say(f"| {r.get('seconds')} s depois de soltar as referências e pressionar o coletor | {r.get('ok')} | {_cell(r.get('error'))[:140]} | {(r.get('ledger') or {}).get('collected', '—')} |")
                worker = release.get("worker") or {}
                inside = worker.get("noWorker") or {}
                say(f"| num Worker dedicado | {inside.get('ok', '—')} | {_cell(inside.get('error'))[:140]} | — |")
                for r in worker.get("paginaAposTerminate") or []:
                    say(f"| na página, {r.get('seconds')} s depois de `terminate()` | {r.get('ok')} | {_cell(r.get('error'))[:140]} | {(r.get('ledger') or {}).get('collected', '—')} |")
                say("")
            if run.get("experiment") == "vagas-navegacao":
                c, c10 = run.get("contagem") or {}, run.get("contagem10s") or {}
                say(f"**Depois da navegação** (`{files[s['id']]}`): {c.get('ok', '—')} memória(s) `ort` logo ao chegar"
                    f"{' (' + c['error'] + ')' if c.get('error') else ''}; {c10.get('ok', '—')} depois de 10 s e pressão no coletor.\n")

    # GPU process tolerance.
    writes = [s for s in memory_steps if runs[s["id"]].get("experiment") == "gpu-escrita"]
    for s in writes:
        run = runs[s["id"]]
        phases = run.get("phases") or {}
        a, b = phases.get("comEspera") or {}, phases.get("semEspera") or {}
        say(f"### Processo de GPU e `writeBuffer` em voo (`{files[s['id']]}`)\n")
        say("| Fase | Volume | Vazão | Detalhe | Perda do dispositivo |\n|---|---:|---:|---|---|")
        say(f"| com espera a cada 64 MiB | {_mib(a.get('bytes'))} | {_num(a.get('mbps'), 0, ' MB/s')} | grupo de 64 MiB p50 {((a.get('groupMs') or {}).get('p50'))} ms | {_cell((a.get('lost') or {}).get('reason'))} |")
        say(f"| sem espera | {_mib(b.get('bytes'))} | enfileirar {_num(b.get('mbpsEnfileirar'), 0, ' MB/s')} · efetiva {_num(b.get('mbpsEfetivo'), 0, ' MB/s')} | drenagem {_num(b.get('drainMs'), 0, ' ms')} | {_cell((b.get('lost') or {}).get('reason'))} |")
        if run.get("outcome") == "morreu":
            say(f"\nA aba morreu: {_cell(_where(run))}.")
        say("")

    # OPFS → GPU.
    for kind in ("opfs-streaming", "opfs-monolitico"):
        for s in [x for x in memory_steps if runs[x["id"]].get("experiment") == kind]:
            run = runs[s["id"]]
            phases = run.get("phases") or {}
            sizes = [k for k in phases if k.endswith("MiB")]
            title = "Streaming do OPFS para a GPU (X5)" if kind == "opfs-streaming" else "Caminho monolítico de hoje (arquivo inteiro num Uint8Array)"
            say(f"### {title} (`{files[s['id']]}`)\n")
            if kind == "opfs-streaming":
                caps = phases.get("capacidades") or {}
                say(f"`createSyncAccessHandle` no Worker: **{caps.get('syncAccessHandle', '—')}**; `createWritable`: {caps.get('createWritable', '—')}; kernel confere: {phases.get('kernelConfere', '—')}.\n")
                say("| Arquivo | Fase | Caminho | Leitura do OPFS | Envio à GPU | Ponta a ponta | Grupo de 64 MiB p50 · máx. |\n|---|---|---|---:|---:|---:|---|")
                for size in sizes:
                    entry = phases[size]
                    w = entry.get("escrita") or {}
                    say(f"| {size} | escrita | {_cell(w.get('path'))} | — | — | {_num(w.get('mbps'), 0, ' MB/s')} | — |")
                    for p in (entry.get("anel") or {}).get("passes") or []:
                        m = p.get("mbps") or {}
                        g = p.get("groupMs") or {}
                        ok = (p.get("kernel") or {}).get("confere")
                        say(f"| {size} | anel 3 × 64 MiB, passada {p.get('pass')}{' (kernel ' + ('ok' if ok else 'DIVERGE') + ')' if p.get('kernel') else ''} | {_cell(p.get('path'))} | {_num(m.get('leituraOPFS'), 0, ' MB/s')} | {_num(m.get('envioGPU'), 0, ' MB/s')} | {_num(m.get('pontaAPonta'), 0, ' MB/s')} | {g.get('p50')} · {g.get('max')} ms |")
                    pl = entry.get("placas")
                    if pl:
                        m = pl.get("mbps") or {}
                        g = pl.get("groupMs") or {}
                        say(f"| {size} | {pl.get('slabs')} placa(s) de {pl.get('slabMiB')} MiB, residentes | {_cell(pl.get('path'))} | {_num(m.get('leituraOPFS'), 0, ' MB/s')} | {_num(m.get('envioGPU'), 0, ' MB/s')} | {_num(m.get('pontaAPonta'), 0, ' MB/s')} | {g.get('p50')} · {g.get('max')} ms |")
            else:
                say("| Arquivo | Leitura inteira (engines/fetch.js) | Envio à GPU (placas de 256 MiB) | Ponta a ponta |\n|---|---:|---:|---:|")
                for size in sizes:
                    entry = phases[size]
                    say(f"| {size} | {_num((entry.get('leitura') or {}).get('mbps'), 0, ' MB/s')} | {_num((entry.get('envio') or {}).get('mbps'), 0, ' MB/s')} | {_num((entry.get('pontaAPonta') or {}).get('mbps'), 0, ' MB/s')} |")
            if run.get("outcome") == "morreu":
                say(f"\n**A aba morreu** — {_cell(_where(run))}.")
            elif run.get("outcome") == "erro":
                say(f"\nErro: {_cell(run.get('erro'))}")
            say("")

    # Ledgers of the test pages (X4).
    engine_steps = [s for s in steps if str(s.get("url", "")).startswith("/index.html")]
    with_ledger = [(s, runs[s["id"]]) for s in engine_steps if runs[s["id"]].get("ledgerTrace") is not None or (runs[s["id"]].get("partial") or {}).get("ledgerTrace")]
    if with_ledger:
        say("### Livro-caixa das páginas de teste (X4)\n")
        say("GPU = bytes de buffers e texturas criados e não destruídos nem coletados, por `lab/hook.js`; Wasm = bytes das memórias Wasm vivas.\n")
        say("| Etapa | Processo | Desfecho | Decisões | GPU vivo: 1ª → última decisão | Pico GPU | Dispositivos | Wasm vivo (pico) | `dispose()` | GPU depois do dispose | Arquivo |\n|---|---:|---|---:|---|---:|---:|---|---|---:|---|")
        for s, run in with_ledger:
            trace = run.get("ledgerTrace") or (run.get("partial") or {}).get("ledgerTrace") or []
            first, last = (trace[0], trace[-1]) if trace else ({}, {})
            ledger = run.get("ledger") or {}
            before, after = ledger.get("beforeDispose") or {}, ledger.get("afterDispose") or {}
            dispose = run.get("dispose") or {}
            outcome = run.get("outcome") or ("morreu" if s.get("status") == "crashed" else run.get("status"))
            say(f"| `{s['id']}` | {s.get('epoch', '—')} | {outcome} | {run.get('decisions') or (trace[-1].get('i') if trace else '—')} | "
                f"{first.get('gpuLiveMiB', '—')} → {last.get('gpuLiveMiB', '—')} MiB | {_mib((before.get('gpu') or {}).get('peakBytes'), 1) if before else (str(max((t.get('gpuPeakMiB') or 0) for t in trace)) + ' MiB' if trace else '—')} | "
                f"{(before.get('gpu') or {}).get('devicesCreated', '—')} | {_mib((before.get('wasm') or {}).get('liveBytes'), 1)} ({_mib((before.get('wasm') or {}).get('peakBytes'), 1)}) | "
                f"{'ok' if dispose.get('ok') else _cell((dispose.get('error') or {}).get('message') if dispose else '—')} {_num(dispose.get('ms'), 0, ' ms') if dispose else ''} | {_mib((after.get('gpu') or {}).get('liveBytes'), 1) if after else '—'} | `{files[s['id']]}` |")
        say("")

    # Memory of the browser's processes (desktop runner).
    if desktop and (desktop.get("desktopMemory") or {}).get("peaksByStep"):
        dm = desktop["desktopMemory"]
        say(f"### Memória dos processos do navegador (`{session}-desktop.json`)\n")
        say(f"{_cell(desktop.get('browser', {}).get('version'))}; {len(desktop.get('restarts') or [])} reinício(s) do navegador pedidos pelo laboratório. "
            "RSS amostrado a cada 500 ms; `phys_footprint` (inclui a memória de GPU que o processo possui) a cada 2 s.\n")
        say("| Etapa | RSS GPU | RSS renderer | footprint GPU | footprint renderer |\n|---|---:|---:|---:|---:|")
        for step, p in dm["peaksByStep"].items():
            say(f"| `{step}` | {_mib(p['rss'].get('gpu'))} | {_mib(p['rss'].get('renderer'))} | {_mib(p['footprint'].get('gpu'))} | {_mib(p['footprint'].get('renderer'))} |")
        total = dm.get("peaks") or {}
        say(f"\nPico de toda a sessão: RSS GPU {_mib((total.get('rss') or {}).get('gpu'))}, renderer {_mib((total.get('rss') or {}).get('renderer'))}; "
            f"`phys_footprint_peak` GPU {_mib((total.get('footprintLifetimePeak') or {}).get('gpu'))}, renderer {_mib((total.get('footprintLifetimePeak') or {}).get('renderer'))}.\n")

    # Tiers for C-08.
    by_exp = {}
    for s in memory_steps:
        run = runs[s["id"]]
        by_exp.setdefault((run.get("experiment"), run.get("variant")), (s, run))
    def best(exp, variant=None):
        hit = by_exp.get((exp, variant))
        if not hit:
            return None, None, None
        s, run = hit
        return _largest_ok(run), run, files[s["id"]]
    gpu, gpu_run, gpu_file = best("gpu-rampa", "simples")
    host, host_run, host_file = best("host-rampa")
    ab, _, ab_file = best("gpu-rampa", "ab256")
    wm, _, wm_file = best("gpu-rampa", "wasm256")
    stream = next((r for (e, _), (_, r) in by_exp.items() if e == "opfs-streaming"), None)
    stream_1g = None
    if stream:
        sizes = sorted((k for k in (stream.get("phases") or {}) if k.endswith("MiB")), key=lambda k: int(k[:-3]))
        if sizes:
            passes = ((stream["phases"][sizes[-1]].get("anel") or {}).get("passes") or [])
            if passes:
                stream_1g = f"{sizes[-1]}: {passes[-1].get('mbpsPassada')} MB/s por passada"
    if gpu or host:
        env = (gpu_run or host_run or {}).get("environment") or {}
        capped = lambda run: run and run.get("outcome") == "completou"
        say("### Faixas para a `C-08`\n")
        say(f"Aparelho: `{_cell(env.get('userAgent'))}`; adaptador {_cell(((env.get('webgpu') or {}).get('adapter') or {}).get('info'))}.\n")
        say("| Medida | Valor | Arquivo |\n|---|---:|---|")
        say(f"| Maior total de GPU que funcionou (rampa simples) | {('≥ ' if capped(gpu_run) else '') + _mib(gpu)} **[MEDIDO]** | `{gpu_file}` |")
        say(f"| … depois de 256 MiB num ArrayBuffer | {_mib(ab)} **[MEDIDO]** | `{ab_file}` |")
        say(f"| … depois de 256 MiB numa memória Wasm | {_mib(wm)} **[MEDIDO]** | `{wm_file}` |")
        say(f"| Maior total de ArrayBuffer que funcionou | {('≥ ' if capped(host_run) else '') + _mib(host)} **[MEDIDO]** | `{host_file}` |")
        say(f"| Streaming OPFS → GPU, anel de 3 × 64 MiB, última passada | {_cell(stream_1g)} **[MEDIDO]** | — |")
        base = min(v for v in (gpu, host) if v)
        say(f"| Faixa candidata de pesos + ativações residentes | {_mib(base * margin)} **[HIPÓTESE: {margin:.0%} do menor máximo medido; a regra é desta tabela, a decisão é da C-08]** | — |")
        if capped(gpu_run) or capped(host_run):
            say("\nUma rampa que chegou ao teto do teste (desktop) mede só um piso: o limite real é maior.")
        say("")
