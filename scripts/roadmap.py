#!/usr/bin/env python3
"""DAG do roadmap do SOM WebCore — validação e geração de grafos.

A fonte da verdade são as TABELAS de atividades do ROADMAP.md. Cada linha
declara um nó do grafo:

    | `P-05` | **Rótulo curto** — descrição | `P-03`, `P-04` | entregável | aceite | M | a fazer |

Este script, sem dependências externas:

  check   valida o grafo (IDs únicos, dependências existentes, sem ciclos,
          tamanhos e estados válidos, portões encadeados) e confirma que os
          blocos gerados no ROADMAP.md estão atualizados;
  render  reescreve os blocos gerados (Mermaid, ondas e caminho crítico)
          entre os marcadores `<!-- dag:begin:X -->` … `<!-- dag:end:X -->`;
  waves   imprime as ondas de execução (o que pode andar em paralelo);
  json    exporta o grafo em JSON (para issues, quadros e automações).

Uso:
  python3 scripts/roadmap.py check
  python3 scripts/roadmap.py render

Exit codes: 0 ok · 1 grafo inválido ou blocos desatualizados · 2 uso inválido.
"""

from __future__ import annotations

import json
import re
import sys
from collections import OrderedDict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ROADMAP = ROOT / "ROADMAP.md"

ID_RE = r"(?:[A-Z]-\d{2}|G[0-9T])"
ROW_RE = re.compile(r"^\|\s*`(" + ID_RE + r")`\s*\|")
REF_RE = re.compile(r"`(" + ID_RE + r")`")
LABEL_RE = re.compile(r"\*\*(.+?)\*\*")

# Grupo (bloco gerado) de cada prefixo de ID.
GROUPS = OrderedDict(
    [
        ("M0", "Marco M0 — Fundação e auditoria"),
        ("T", "Marco T — Teste em celular e decisão do motor"),
        ("M1", "Marco M1 — Prova de conceito (v0.1.0)"),
        ("M2", "Marco M2 — Alpha"),
        ("M3", "Marco M3 — Beta"),
        ("M4", "Marco M4 — v1.0.0"),
        ("S", "Trilha S — Padronização"),
        ("M5", "Marco M5 — Pós-1.0"),
    ]
)
PREFIX_GROUP = {"F": "M0", "T": "T", "P": "M1", "A": "M2", "B": "M3", "V": "M4", "S": "S", "X": "M5"}
GATE_GROUP = {"G0": "M0", "GT": "T", "G1": "M1", "G2": "M2", "G3": "M3", "G4": "M4"}
# Ordem dos portões no tempo (GT vem entre G0 e G1; IDs nunca são renumerados).
GATE_ORDER = ["G0", "GT", "G1", "G2", "G3", "G4"]

SIZES = {"S": 1, "M": 3, "L": 8, "XL": 13, "—": 0}
STATES = {"feito", "em curso", "a fazer"}
EXPECTED_COLUMNS = 7


class Node:
    def __init__(self, nid, label, deps, size, state, line):
        self.id = nid
        self.label = label
        self.deps = deps
        self.size = size
        self.state = state
        self.line = line

    @property
    def group(self):
        if self.id in GATE_GROUP:
            return GATE_GROUP[self.id]
        return PREFIX_GROUP.get(self.id.split("-")[0], "?")

    @property
    def is_gate(self):
        return self.id in GATE_GROUP


def split_row(line):
    cells = line.strip().strip("|").split("|")
    return [c.strip() for c in cells]


def parse(text):
    nodes = OrderedDict()
    errors = []
    for number, line in enumerate(text.splitlines(), start=1):
        match = ROW_RE.match(line)
        if not match:
            continue
        nid = match.group(1)
        cells = split_row(line)
        if len(cells) != EXPECTED_COLUMNS:
            errors.append(
                f"linha {number}: `{nid}` tem {len(cells)} colunas; esperadas {EXPECTED_COLUMNS} "
                "(ID · Atividade · Depende de · Entregável · Critério de aceite · Tam. · Estado)"
            )
            continue
        label_match = LABEL_RE.search(cells[1])
        label = label_match.group(1) if label_match else cells[1][:40]
        if nid in GATE_GROUP and "—" in cells[1]:
            # Portões: o rótulo útil é a decisão, não a palavra "Portão".
            label = cells[1].split("—", 1)[1].strip()
        deps = REF_RE.findall(cells[2])
        if nid in nodes:
            errors.append(f"linha {number}: ID duplicado `{nid}` (já definido na linha {nodes[nid].line})")
            continue
        nodes[nid] = Node(nid, label, deps, cells[5], cells[6], number)
    return nodes, errors


def validate(nodes):
    errors = []
    for node in nodes.values():
        if node.group == "?":
            errors.append(f"`{node.id}`: prefixo desconhecido (use F, T, P, A, B, V, S, X, G0–G4 ou GT)")
        if node.size not in SIZES:
            errors.append(f"`{node.id}`: tamanho inválido {node.size!r} (use S, M, L, XL ou —)")
        if node.state not in STATES:
            errors.append(f"`{node.id}`: estado inválido {node.state!r} (use {', '.join(sorted(STATES))})")
        if node.id in node.deps:
            errors.append(f"`{node.id}`: depende de si próprio")
        if len(set(node.deps)) != len(node.deps):
            errors.append(f"`{node.id}`: dependência repetida")
        for dep in node.deps:
            if dep not in nodes:
                errors.append(f"`{node.id}`: dependência inexistente `{dep}`")
        if node.state == "feito":
            for dep in node.deps:
                if dep in nodes and nodes[dep].state != "feito":
                    errors.append(f"`{node.id}` está feito, mas a dependência `{dep}` não está")
    roots = [n.id for n in nodes.values() if not n.deps]
    if len(roots) != 1:
        errors.append(f"o grafo deve ter exatamente uma raiz; encontradas: {', '.join(roots) or 'nenhuma'}")
    # Portões encadeados: G(n) tem de ser alcançável a partir de G(n-1).
    gates = [g for g in GATE_ORDER if g in nodes]
    for previous, current in zip(gates, gates[1:]):
        if previous not in ancestors(nodes, current):
            errors.append(f"portão `{current}` não depende (direta ou indiretamente) de `{previous}`")
    order, cyclic = topo(nodes)
    if cyclic:
        errors.append("ciclo de dependências envolvendo: " + ", ".join(f"`{n}`" for n in cyclic))
    return errors, order


def ancestors(nodes, nid):
    seen, stack = set(), list(nodes[nid].deps) if nid in nodes else []
    while stack:
        current = stack.pop()
        if current in seen or current not in nodes:
            continue
        seen.add(current)
        stack.extend(nodes[current].deps)
    return seen


def topo(nodes):
    indegree = {nid: 0 for nid in nodes}
    children = {nid: [] for nid in nodes}
    for node in nodes.values():
        for dep in node.deps:
            if dep in nodes:
                indegree[node.id] += 1
                children[dep].append(node.id)
    queue = [nid for nid in nodes if indegree[nid] == 0]
    order = []
    while queue:
        current = queue.pop(0)
        order.append(current)
        for child in children[current]:
            indegree[child] -= 1
            if indegree[child] == 0:
                queue.append(child)
    cyclic = [nid for nid in nodes if nid not in order]
    return order, cyclic


def levels(nodes, order):
    """Nível global de cada nó = caminho mais longo (em arestas) desde a raiz."""
    level = {}
    for nid in order:
        deps = [d for d in nodes[nid].deps if d in level]
        level[nid] = 1 + max((level[d] for d in deps), default=-1)
    return level


def waves_for(nodes, order, group):
    level = levels(nodes, order)
    members = [nid for nid in order if nodes[nid].group == group]
    buckets = OrderedDict()
    for nid in sorted(members, key=lambda n: (level[n], order.index(n))):
        buckets.setdefault(level[nid], []).append(nid)
    return list(buckets.values())


def critical_path(nodes, order):
    """Caminho de maior esforço relativo (pontos de tamanho) até o último portão."""
    best = {}
    back = {}
    for nid in order:
        weight = SIZES.get(nodes[nid].size, 0)
        deps = [d for d in nodes[nid].deps if d in best]
        if deps:
            parent = max(deps, key=lambda d: best[d])
            best[nid] = best[parent] + weight
            back[nid] = parent
        else:
            best[nid] = weight
            back[nid] = None
    gates = [g for g in GATE_ORDER if g in nodes]
    if not gates:
        return [], 0
    target = gates[-1]
    path = []
    current = target
    while current is not None:
        path.append(current)
        current = back[current]
    return list(reversed(path)), best[target]


def mermaid_id(nid):
    return nid.replace("-", "")


def render_group(nodes, order, group):
    members = [nid for nid in order if nodes[nid].group == group]
    external = []
    for nid in members:
        for dep in nodes[nid].deps:
            if nodes[dep].group != group and dep not in external:
                external.append(dep)
    lines = ["```mermaid", "flowchart LR"]
    for dep in external:
        lines.append(f'    {mermaid_id(dep)}(["{dep}"]):::ext')
    for nid in members:
        node = nodes[nid]
        label = node.label.replace('"', "'")
        if node.is_gate:
            lines.append(f'    {mermaid_id(nid)}{{{{"{nid} · {label}"}}}}:::gate')
        else:
            css = {"feito": "done", "em curso": "doing"}.get(node.state, "todo")
            lines.append(f'    {mermaid_id(nid)}["{nid} · {label}"]:::{css}')
    for nid in members:
        for dep in nodes[nid].deps:
            arrow = "-.->" if nodes[dep].group != group else "-->"
            lines.append(f"    {mermaid_id(dep)} {arrow} {mermaid_id(nid)}")
    lines += [
        "    classDef done fill:#dcfce7,stroke:#16a34a,color:#14532d;",
        "    classDef doing fill:#fef9c3,stroke:#ca8a04,color:#713f12;",
        "    classDef todo fill:#eff6ff,stroke:#2563eb,color:#1e3a8a;",
        "    classDef gate fill:#fae8ff,stroke:#a21caf,color:#701a75;",
        "    classDef ext fill:#f4f4f5,stroke:#a1a1aa,color:#3f3f46,stroke-dasharray: 4 3;",
        "```",
        "",
    ]
    waves = waves_for(nodes, order, group)
    if waves:
        lines.append("**Ondas de execução** (atividades da mesma onda não dependem entre si):")
        lines.append("")
        for index, wave in enumerate(waves, start=1):
            lines.append(f"{index}. " + " · ".join(f"`{nid}`" for nid in wave))
    return "\n".join(lines)


def render_critical(nodes, order):
    path, points = critical_path(nodes, order)
    chain = " → ".join(f"`{nid}`" for nid in path)
    total = sum(SIZES.get(n.size, 0) for n in nodes.values())
    done = sum(SIZES.get(n.size, 0) for n in nodes.values() if n.state == "feito")
    count_done = sum(1 for n in nodes.values() if n.state == "feito")
    return "\n".join(
        [
            f"- **Nós:** {len(nodes)} ({count_done} feitos) · **arestas:** {sum(len(n.deps) for n in nodes.values())}.",
            f"- **Esforço relativo:** {done}/{total} pontos concluídos (S=1, M=3, L=8, XL=13; portões=0).",
            f"- **Caminho crítico até o último portão** ({points} pontos): {chain}.",
        ]
    )


BLOCK_RE = re.compile(r"(<!-- dag:begin:([A-Za-z0-9]+) -->\n)(.*?)(<!-- dag:end:\2 -->)", re.S)


def regenerate(text, nodes, order):
    missing = []

    def replace(match):
        key = match.group(2)
        if key == "critical":
            body = render_critical(nodes, order)
        elif key in GROUPS:
            body = render_group(nodes, order, key)
        else:
            missing.append(key)
            return match.group(0)
        return match.group(1) + body.rstrip("\n") + "\n" + match.group(4)

    return BLOCK_RE.sub(replace, text), missing


def read_roadmap():
    """Lê o ROADMAP.md normalizado para LF; devolve também o estilo de fim de linha em disco."""
    raw = ROADMAP.read_bytes().decode("utf-8")
    newline = "\r\n" if "\r\n" in raw else "\n"
    return raw.replace("\r\n", "\n"), newline


def write_roadmap(text, newline):
    """Grava preservando o estilo de fim de linha que o ficheiro já tinha."""
    data = text.replace("\n", newline) if newline != "\n" else text
    ROADMAP.write_bytes(data.encode("utf-8"))


def load():
    if not ROADMAP.exists():
        print("Erro: ROADMAP.md não encontrado — Solução: execute a partir de um clone completo do repositório.")
        sys.exit(1)
    text, _ = read_roadmap()
    nodes, errors = parse(text)
    if not nodes:
        errors.append("nenhuma atividade encontrada nas tabelas do ROADMAP.md")
        return text, nodes, errors, []
    more, order = validate(nodes)
    return text, nodes, errors + more, order


def cmd_check():
    text, nodes, errors, order = load()
    if not errors:
        rendered, unknown = regenerate(text, nodes, order)
        for key in unknown:
            errors.append(f"bloco gerado desconhecido: dag:begin:{key}")
        present = {match[1] for match in BLOCK_RE.findall(text)}
        for key in list(GROUPS) + ["critical"]:
            has_nodes = key == "critical" or any(n.group == key for n in nodes.values())
            if has_nodes and key not in present:
                errors.append(f"falta o bloco gerado `<!-- dag:begin:{key} -->` no ROADMAP.md")
        if rendered != text:
            errors.append(
                "blocos gerados desatualizados em relação às tabelas — "
                "Solução: python3 scripts/roadmap.py render"
            )
    for error in errors:
        print(f"ERROR roadmap: {error}")
    if errors:
        print(f"\nFALHA: {len(errors)} erro(s) no DAG do roadmap")
        return 1
    print(
        f"OK: DAG do roadmap válido ({len(nodes)} nós, "
        f"{sum(len(n.deps) for n in nodes.values())} arestas, sem ciclos, blocos atualizados)"
    )
    return 0


def cmd_render():
    text, nodes, errors, order = load()
    if errors:
        for error in errors:
            print(f"ERROR roadmap: {error}")
        print("\nErro: grafo inválido — Solução: corrija as tabelas antes de gerar os blocos.")
        return 1
    rendered, unknown = regenerate(text, nodes, order)
    for key in unknown:
        print(f"WARN  bloco desconhecido ignorado: {key}")
    if rendered != text:
        write_roadmap(rendered, read_roadmap()[1])
        print("ROADMAP.md: blocos gerados atualizados")
    else:
        print("ROADMAP.md: blocos já estavam atualizados")
    return 0


def cmd_waves():
    _, nodes, errors, order = load()
    if errors:
        for error in errors:
            print(f"ERROR roadmap: {error}")
        return 1
    for group, title in GROUPS.items():
        waves = waves_for(nodes, order, group)
        if not waves:
            continue
        print(title)
        for index, wave in enumerate(waves, start=1):
            print(f"  onda {index}: " + ", ".join(wave))
    path, points = critical_path(nodes, order)
    print(f"caminho crítico ({points} pontos): " + " -> ".join(path))
    return 0


def cmd_json():
    _, nodes, errors, order = load()
    if errors:
        for error in errors:
            print(f"ERROR roadmap: {error}", file=sys.stderr)
        return 1
    payload = [
        {
            "id": n.id,
            "label": n.label,
            "group": n.group,
            "depends_on": n.deps,
            "size": n.size,
            "state": n.state,
            "gate": n.is_gate,
        }
        for n in (nodes[nid] for nid in order)
    ]
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


COMMANDS = {"check": cmd_check, "render": cmd_render, "waves": cmd_waves, "json": cmd_json}


def main(argv):
    if len(argv) != 2 or argv[1] not in COMMANDS:
        print(__doc__)
        return 2
    return COMMANDS[argv[1]]()


if __name__ == "__main__":
    sys.exit(main(sys.argv))
