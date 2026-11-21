#!/usr/bin/env python3
"""Download the models of the T milestone from their pinned revisions and verify every file.

The pins live in models.json (repo, revision, and the SHA-256 and size of every file).
Weights never enter git: they go to a local cache, outside the repository.

    python bench/spike-mobile/fetch-models.py                # every model, every file
    python bench/spike-mobile/fetch-models.py ts-ettin-17m   # one model
    python bench/spike-mobile/fetch-models.py --only onnx/model_int8.onnx tokenizer.json
    python bench/spike-mobile/fetch-models.py --where        # print the cache directory

Cache: $SOM_MODEL_CACHE, else %LOCALAPPDATA%/som-webcore/models (Windows) or
~/.cache/som-webcore/models. Layout: <cache>/<repo>/<revision>/<file>.

Exit codes: 0 ok · 1 download or hash failure · 2 invalid usage.
Standard library only.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import tempfile
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
MANIFEST = HERE / "models.json"
CHUNK = 1 << 20


def cache_dir() -> Path:
    env = os.environ.get("SOM_MODEL_CACHE")
    if env:
        return Path(env)
    if os.name == "nt" and os.environ.get("LOCALAPPDATA"):
        return Path(os.environ["LOCALAPPDATA"]) / "som-webcore" / "models"
    return Path.home() / ".cache" / "som-webcore" / "models"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(CHUNK), b""):
            digest.update(block)
    return digest.hexdigest()


def download(url: str, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": "som-webcore-fetch/1"})
    fd, tmp = tempfile.mkstemp(dir=target.parent, prefix=".part-")
    try:
        with urllib.request.urlopen(request, timeout=120) as response, os.fdopen(fd, "wb") as out:
            for block in iter(lambda: response.read(CHUNK), b""):
                out.write(block)
        os.replace(tmp, target)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise


def fetch(model: dict, only: set[str] | None) -> list[str]:
    errors = []
    base = cache_dir() / model["repo"] / model["revision"]
    for name, pin in model["files"].items():
        if only and name not in only:
            continue
        target = base / name
        if target.exists() and target.stat().st_size == pin["size"] and sha256(target) == pin["sha256"]:
            print(f"ok      {model['id']}  {name}")
            continue
        url = f"https://huggingface.co/{model['repo']}/resolve/{model['revision']}/{name}"
        print(f"fetch   {model['id']}  {name}  ({pin['size']:,} bytes)")
        try:
            download(url, target)
        except Exception as exc:  # network errors are reported, not hidden
            errors.append(f"{model['id']} {name}: download failed ({exc})")
            continue
        size, digest = target.stat().st_size, sha256(target)
        if size != pin["size"] or digest != pin["sha256"]:
            target.unlink(missing_ok=True)
            errors.append(f"{model['id']} {name}: expected {pin['size']} bytes / {pin['sha256']}, got {size} / {digest}")
        else:
            print(f"verified {model['id']}  {name}")
    return errors


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("models", nargs="*", help="model ids from models.json (default: all)")
    parser.add_argument("--only", nargs="+", help="restrict to these file names")
    parser.add_argument("--where", action="store_true", help="print the cache directory and exit")
    args = parser.parse_args(argv)
    if args.where:
        print(cache_dir())
        return 0
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    known = {m["id"]: m for m in manifest["models"]}
    unknown = [m for m in args.models if m not in known]
    if unknown:
        print(f"Erro: modelo desconhecido {unknown} — Solução: use um de {sorted(known)}", file=sys.stderr)
        return 2
    errors = []
    for model_id in args.models or list(known):
        errors += fetch(known[model_id], set(args.only) if args.only else None)
    for error in errors:
        print(f"Erro: {error} — Solução: confira a rede e a revisão fixada em models.json", file=sys.stderr)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
