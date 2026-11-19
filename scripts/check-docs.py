#!/usr/bin/env python3
"""Contrato de documentação do SOM WebCore.

Valida, sem dependências externas:
  - links e imagens locais (arquivos e âncoras);
  - blocos de código balanceados;
  - tabelas Markdown com número de colunas consistente;
  - âncoras e seções obrigatórias do README;
  - figuras e fontes de pesquisa presentes;
  - ausência de placeholders e de segredos óbvios.

Uso:
  python3 scripts/check-docs.py [--strict]

Exit codes: 0 ok · 1 falha de contrato · 2 uso inválido.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent.parent
README = ROOT / "README.md"

MD_FILES = [
    README,
    ROOT / "CONTRIBUTING.md",
    ROOT / "SECURITY.md",
    ROOT / "CODE_OF_CONDUCT.md",
    ROOT / "CHANGELOG.md",
]

REQUIRED_FILES = [
    "LICENSE",
    "NOTICE",
    "README.md",
    "CONTRIBUTING.md",
    "SECURITY.md",
    "CODE_OF_CONDUCT.md",
    "CODEOWNERS",
    "CHANGELOG.md",
    "docs/assets/banner.svg",
    "research/01-arquitetura-webgpu-wasm32.txt",
    "research/02-runtime-bare-metal-wgpu.txt",
    "docs/figures/fig-01-memoria-roofline.png",
    "docs/figures/fig-02-telemetria-webgpu-2026.png",
    "docs/figures/fig-03-comparativo-motores.png",
    "docs/figures/fig-04-vram-flops.png",
    "docs/figures/fig-05-latencia-d1-omni.png",
]

REQUIRED_ANCHORS = [
    "status", "tldr", "manifesto", "jev", "pilares", "nao-e",
    "arquitetura", "diagrama", "caminho", "fisica",
    "especificacao", "armazenamento", "memoria", "shaders", "calibracao",
    "ponte", "carregamento", "modelos", "matriz", "fichas", "escolher",
    "licencas-modelos", "numeros", "roofline", "vram", "latencia", "limites",
    "dispatch", "comparativo", "blueprint", "workspace", "perfis", "sombin",
    "bindgroups", "seis-shaders", "agendador", "api", "erros", "riscos",
    "roadmap", "contribuir", "faq", "glossario", "referencias", "apendices",
    "apendice-a", "apendice-b", "apendice-c", "divergencias", "apendice-e",
]

REQUIRED_PHRASES = [
    "Condicionais Abstratas",
    "JEV",
    "WebGPU",
    "Wasm32",
    "micro-readback",
    "Apache-2.0",
]

PLACEHOLDERS = [
    "<PIN_SHA>",
    "PARTE-2",
    "PARTE-3",
    "PARTE-4",
    "PARTE-5",
    "PARTE-6",
    "PARTE-7",
    "PARTE-8",
    "REFERENCIAS-COMPLETAS",
    "Example entry",
    "TODO:",
    "TBD",
]

LINK_RE = re.compile(r"!?\[[^\]]*\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")
HTML_SRC_RE = re.compile(r'(?:src|href)="([^"]+)"')
ANCHOR_RE = re.compile(r'<a\s+id="([^"]+)"\s*>')
HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*$")


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def strip_fences(text: str) -> str:
    out, in_fence = [], False
    for line in text.splitlines():
        if line.lstrip().startswith("```"):
            in_fence = not in_fence
            out.append("")
            continue
        out.append("" if in_fence else line)
    return "\n".join(out)


def heading_slug(heading: str) -> str:
    # Aproximação conservadora do slug do GitHub.
    text = re.sub(r"<[^>]+>", "", heading)
    text = re.sub(r"[`*_~]", "", text).strip().lower()
    text = text.replace(" ", "-")
    text = re.sub(r"[^\w\-À-ÿ]", "", text, flags=re.UNICODE)
    return text


def collect_anchors(text: str) -> set[str]:
    anchors = set(ANCHOR_RE.findall(text))
    for line in text.splitlines():
        m = HEADING_RE.match(line)
        if m:
            anchors.add(heading_slug(m.group(2)))
    anchors.add("som-webcore")
    return anchors


def check_fences(text: str, rel: str, errors: list[str]) -> None:
    count = sum(1 for line in text.splitlines() if line.lstrip().startswith("```"))
    if count % 2:
        errors.append(f"{rel}: blocos de código desbalanceados ({count} cercas)")


def check_tables(text: str, rel: str, errors: list[str]) -> None:
    lines = strip_fences(text).splitlines()
    block: list[str] = []

    def flush() -> None:
        if len(block) < 2:
            block.clear()
            return
        counts = [ln.count("|") for ln in block]
        if len(set(counts)) > 1:
            errors.append(
                f"{rel}: tabela com colunas inconsistentes nas linhas "
                f"{block[0]!r} … (contagens: {counts})"
            )
        block.clear()

    for line in lines:
        if line.strip().startswith("|"):
            block.append(line.strip())
        else:
            flush()
    flush()


def check_links(text: str, rel: str, anchors: set[str], errors: list[str]) -> None:
    clean = strip_fences(text)
    targets = LINK_RE.findall(clean) + HTML_SRC_RE.findall(clean)
    for raw in targets:
        if raw.startswith(("http://", "https://", "mailto:", "data:", "#")):
            if raw.startswith("#"):
                if raw[1:] and raw[1:] not in anchors:
                    errors.append(f"{rel}: âncora interna quebrada: {raw}")
            continue
        path_part = unquote(raw.split("#", 1)[0].split("?", 1)[0])
        if not path_part:
            continue
        candidate = (ROOT / path_part).resolve()
        try:
            candidate.relative_to(ROOT)
        except ValueError:
            errors.append(f"{rel}: link escapa da raiz: {raw}")
            continue
        if not candidate.exists():
            errors.append(f"{rel}: link local inexistente: {raw}")


def check_placeholders(text: str, rel: str, errors: list[str]) -> None:
    for token in PLACEHOLDERS:
        if token in text:
            errors.append(f"{rel}: placeholder proibido encontrado: {token}")


def check_secrets(text: str, rel: str, errors: list[str]) -> None:
    # Padrões óbvios; não é um scanner exaustivo.
    patterns = [
        r"ghp_[A-Za-z0-9]{20,}",
        r"github_pat_[A-Za-z0-9_]{20,}",
        r"sk-[A-Za-z0-9]{20,}",
        r"AKIA[0-9A-Z]{16}",
    ]
    for pattern in patterns:
        if re.search(pattern, text):
            errors.append(f"{rel}: possível segredo detectado (padrão {pattern})")


def check_readme(text: str, errors: list[str]) -> None:
    anchors = collect_anchors(text)
    for anchor in REQUIRED_ANCHORS:
        if anchor not in anchors:
            errors.append(f"README: âncora obrigatória ausente: #{anchor}")
    for phrase in REQUIRED_PHRASES:
        if phrase not in text:
            errors.append(f"README: frase obrigatória ausente: {phrase!r}")
    if len(text) < 80_000:
        errors.append(f"README: conteúdo suspeitamente curto ({len(text)} caracteres)")
    if text.count("docs/figures/") < 5:
        errors.append("README: menos de 5 referências às figuras")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--strict", action="store_true", help="trata avisos como erros")
    args = parser.parse_args()

    errors: list[str] = []
    warnings: list[str] = []

    for rel in REQUIRED_FILES:
        if not (ROOT / rel).exists():
            errors.append(f"arquivo obrigatório ausente: {rel}")

    for path in MD_FILES:
        if not path.exists():
            errors.append(f"documento ausente: {path.relative_to(ROOT)}")
            continue
        text = read(path)
        rel = str(path.relative_to(ROOT))
        anchors = collect_anchors(text)
        check_fences(text, rel, errors)
        check_tables(text, rel, errors)
        check_links(text, rel, anchors, errors)
        check_placeholders(text, rel, errors)
        check_secrets(text, rel, errors)

    if README.exists():
        check_readme(read(README), errors)

    # Símbolos e diagramas mínimos que o README promete.
    readme = read(README) if README.exists() else ""
    for needle in ["flowchart LR", "sequenceDiagram", "DecisionPacket", "`.sombin`"]:
        if needle not in readme:
            warnings.append(f"README: elemento esperado não encontrado: {needle!r}")

    for warning in warnings:
        print(f"WARN  {warning}")
    for error in errors:
        print(f"ERROR {error}")

    if errors or (args.strict and warnings):
        print(f"\nFALHA: {len(errors)} erro(s), {len(warnings)} aviso(s)")
        return 1
    print(f"OK: documentação válida ({len(MD_FILES)} ficheiros, {len(warnings)} aviso(s))")
    return 0


if __name__ == "__main__":
    sys.exit(main())
