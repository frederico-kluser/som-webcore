#!/usr/bin/env python3
"""Baixa um modelo do catálogo, só da revisão fixada, e confere cada arquivo pelo SHA-256.

O catálogo é models/catalog.json (repositório, revisão e o tamanho e o SHA-256 de cada
arquivo); o esquema é models/catalog.schema.json. Os pesos nunca entram no git: vão para
um cache local, fora do repositório.

    python tools/fetch_model.py ts-ettin-17m                     # todos os arquivos do modelo
    python tools/fetch_model.py ts-ettin-17m --only model.safetensors tokenizer.json
    python tools/fetch_model.py --check                          # valida o catálogo contra o esquema
    python tools/fetch_model.py --where                          # imprime o diretório do cache

Regras:
  - a URL é sempre <base>/<repo>/resolve/<revisão de 40 hex>/<arquivo>, nunca um ramo;
  - o arquivo é baixado para um temporário e só entra no cache se o tamanho e o SHA-256
    baterem com o catálogo; um arquivo diferente é apagado e o comando falha;
  - um arquivo já no cache é conferido de novo; se não bater, é baixado de novo.

Cache: $SOM_MODEL_CACHE, senão %LOCALAPPDATA%/som-webcore/models (Windows) ou
~/.cache/som-webcore/models. Layout: <cache>/<repo>/<revisão>/<arquivo>.
No Mac mini: SOM_MODEL_CACHE=/Volumes/Ext2TB/Caches/som-webcore/models.

Códigos de saída: 0 ok · 1 download, hash ou catálogo inválido · 2 uso inválido.
Só a biblioteca padrão.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import tempfile
import urllib.request
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "models" / "catalog.json"
SCHEMA = ROOT / "models" / "catalog.schema.json"
DEFAULT_BASE = "https://huggingface.co"
CHUNK = 1 << 20
REVISION = re.compile(r"^[0-9a-f]{40}$")


# ----------------------------------------------------------------- esquema
def validate(instance, schema: dict, root: dict | None = None, path: str = "$") -> list[str]:
    """Validador mínimo de JSON Schema: o subconjunto que catalog.schema.json usa."""
    root = root if root is not None else schema
    if "$ref" in schema:
        ref = schema["$ref"]
        if not ref.startswith("#/"):
            return [f"{path}: $ref não suportado {ref}"]
        target = root
        for part in ref[2:].split("/"):
            target = target[part]
        return validate(instance, target, root, path)
    errors: list[str] = []
    kind = schema.get("type")
    checks = {
        "object": lambda v: isinstance(v, dict),
        "array": lambda v: isinstance(v, list),
        "string": lambda v: isinstance(v, str),
        "integer": lambda v: isinstance(v, int) and not isinstance(v, bool),
        "number": lambda v: isinstance(v, (int, float)) and not isinstance(v, bool),
        "boolean": lambda v: isinstance(v, bool),
    }
    if kind and not checks[kind](instance):
        return [f"{path}: esperava {kind}, veio {type(instance).__name__}"]
    if "const" in schema and instance != schema["const"]:
        errors.append(f"{path}: esperava {schema['const']!r}")
    if "enum" in schema and instance not in schema["enum"]:
        errors.append(f"{path}: {instance!r} fora de {schema['enum']}")
    if isinstance(instance, str):
        if len(instance) < schema.get("minLength", 0):
            errors.append(f"{path}: texto curto demais")
        if "pattern" in schema and not re.search(schema["pattern"], instance):
            errors.append(f"{path}: {instance!r} não casa com {schema['pattern']}")
    if isinstance(instance, (int, float)) and not isinstance(instance, bool):
        if "minimum" in schema and instance < schema["minimum"]:
            errors.append(f"{path}: {instance} < {schema['minimum']}")
    if isinstance(instance, list):
        if len(instance) < schema.get("minItems", 0):
            errors.append(f"{path}: menos de {schema['minItems']} itens")
        if "items" in schema:
            for i, item in enumerate(instance):
                errors += validate(item, schema["items"], root, f"{path}[{i}]")
    if isinstance(instance, dict):
        if len(instance) < schema.get("minProperties", 0):
            errors.append(f"{path}: menos de {schema['minProperties']} propriedades")
        for key in schema.get("required", []):
            if key not in instance:
                errors.append(f"{path}: falta {key!r}")
        props = schema.get("properties", {})
        extra = schema.get("additionalProperties", True)
        for key, value in instance.items():
            if key in props:
                errors += validate(value, props[key], root, f"{path}.{key}")
            elif extra is False:
                errors.append(f"{path}: propriedade não prevista {key!r}")
            elif isinstance(extra, dict):
                errors += validate(value, extra, root, f"{path}[{key!r}]")
    return errors


def check_catalog(catalog: dict, schema: dict) -> list[str]:
    errors = validate(catalog, schema)
    seen = set()
    for model in catalog.get("models", []) if isinstance(catalog, dict) else []:
        if not isinstance(model, dict):
            continue
        if model.get("id") in seen:
            errors.append(f"modelo repetido: {model.get('id')}")
        seen.add(model.get("id"))
        for name in model.get("files", {}):
            if not safe_name(name):
                errors.append(f"{model.get('id')}: nome de arquivo inseguro {name!r}")
        if not any(f.get("role") == "weights" for f in model.get("files", {}).values() if isinstance(f, dict)):
            errors.append(f"{model.get('id')}: nenhum arquivo de pesos")
    return errors


# ----------------------------------------------------------------- download
def cache_dir() -> Path:
    env = os.environ.get("SOM_MODEL_CACHE")
    if env:
        return Path(env)
    if os.name == "nt" and os.environ.get("LOCALAPPDATA"):
        return Path(os.environ["LOCALAPPDATA"]) / "som-webcore" / "models"
    return Path.home() / ".cache" / "som-webcore" / "models"


def safe_name(name: str) -> bool:
    parts = PurePosixPath(name).parts
    return bool(parts) and not PurePosixPath(name).is_absolute() and ".." not in parts and "\\" not in name


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(CHUNK), b""):
            digest.update(block)
    return digest.hexdigest()


def download(url: str, folder: Path) -> Path:
    """Baixa para um temporário em `folder` e devolve o caminho; nada vai ao destino aqui."""
    folder.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": "som-webcore-fetch/1"})
    fd, tmp = tempfile.mkstemp(dir=folder, prefix=".part-")
    try:
        with urllib.request.urlopen(request, timeout=120) as response, os.fdopen(fd, "wb") as out:
            for block in iter(lambda: response.read(CHUNK), b""):
                out.write(block)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise
    return Path(tmp)


def fetch(model: dict, only: set[str] | None, base: str, cache: Path) -> list[str]:
    errors: list[str] = []
    revision = model["revision"]
    if not REVISION.match(revision):
        return [f"{model['id']}: revisão {revision!r} não é um commit de 40 hex"]
    folder = cache / model["repo"] / revision
    for name, pin in model["files"].items():
        if only and name not in only:
            continue
        if not safe_name(name):
            errors.append(f"{model['id']} {name}: nome de arquivo inseguro")
            continue
        target = folder / name
        if target.exists():
            if target.stat().st_size == pin["size"] and sha256(target) == pin["sha256"]:
                print(f"ok        {model['id']}  {name}")
                continue
            print(f"diferente {model['id']}  {name}  (no cache, não bate com o catálogo: baixando de novo)")
            target.unlink()
        url = f"{base.rstrip('/')}/{model['repo']}/resolve/{revision}/{name}"
        print(f"baixando  {model['id']}  {name}  ({pin['size']:,} B)")
        try:
            tmp = download(url, target.parent)
        except Exception as exc:  # erros de rede são reportados, não escondidos
            errors.append(f"{model['id']} {name}: download falhou ({exc})")
            continue
        size, digest = tmp.stat().st_size, sha256(tmp)
        if size != pin["size"] or digest != pin["sha256"]:
            tmp.unlink(missing_ok=True)
            errors.append(
                f"{model['id']} {name}: recusado — esperava {pin['size']} B / {pin['sha256']}, veio {size} B / {digest}"
            )
            continue
        os.replace(tmp, target)
        print(f"conferido {model['id']}  {name}  sha256={digest}")
    return errors


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("models", nargs="*", help="ids do catálogo (padrão: todos)")
    parser.add_argument("--only", nargs="+", help="só estes arquivos")
    parser.add_argument("--check", action="store_true", help="valida o catálogo contra o esquema e sai")
    parser.add_argument("--where", action="store_true", help="imprime o diretório do cache e sai")
    parser.add_argument("--catalog", type=Path, default=CATALOG, help=argparse.SUPPRESS)
    parser.add_argument("--base-url", default=DEFAULT_BASE, help=argparse.SUPPRESS)
    args = parser.parse_args(argv)
    if args.where:
        print(cache_dir())
        return 0
    try:
        catalog = json.loads(args.catalog.read_text(encoding="utf-8"))
        schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"Erro: catálogo ou esquema ilegível ({exc}) — Solução: confira {args.catalog} e {SCHEMA}", file=sys.stderr)
        return 1
    problems = check_catalog(catalog, schema)
    if problems:
        for problem in problems:
            print(f"Erro: catálogo inválido: {problem} — Solução: corrija {args.catalog}", file=sys.stderr)
        return 1
    if args.check:
        print(f"OK: catálogo válido ({len(catalog['models'])} modelo(s))")
        return 0
    known = {m["id"]: m for m in catalog["models"]}
    unknown = [m for m in args.models if m not in known]
    if unknown:
        print(f"Erro: modelo desconhecido {unknown} — Solução: use um de {sorted(known)}", file=sys.stderr)
        return 2
    errors: list[str] = []
    for model_id in args.models or list(known):
        errors += fetch(known[model_id], set(args.only) if args.only else None, args.base_url, cache_dir())
    for error in errors:
        print(f"Erro: {error} — Solução: confira a rede e a revisão fixada em models/catalog.json", file=sys.stderr)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
