"""Testes do tools/fetch_model.py: o catálogo valida, o download confere o SHA-256 e recusa arquivo alterado.

    python -m unittest discover -s tests/tools -v

Sem rede: um "hub" falso em file:// serve os arquivos.
"""

from __future__ import annotations

import copy
import hashlib
import importlib.util
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("fetch_model", ROOT / "tools" / "fetch_model.py")
fm = importlib.util.module_from_spec(spec)
sys.modules["fetch_model"] = fm
spec.loader.exec_module(fm)

REVISION = "0" * 39 + "1"
GOOD = b"pesos de teste\n"
TOKENIZER = b'{"vocab": {}}\n'


def pin(data: bytes, role: str) -> dict:
    return {"size": len(data), "sha256": hashlib.sha256(data).hexdigest(), "role": role}


class FetchModelTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        base = Path(self.tmp.name)
        self.hub = base / "hub"
        self.cache = base / "cache"
        self.folder = self.hub / "dono" / "modelo" / "resolve" / REVISION
        self.folder.mkdir(parents=True)
        (self.folder / "model.safetensors").write_bytes(GOOD)
        (self.folder / "tokenizer.json").write_bytes(TOKENIZER)
        real = json.loads(fm.CATALOG.read_text(encoding="utf-8"))
        model = copy.deepcopy(real["models"][0])
        model.update(id="teste", repo="dono/modelo", revision=REVISION)
        model["files"] = {"model.safetensors": pin(GOOD, "weights"), "tokenizer.json": pin(TOKENIZER, "tokenizer")}
        self.model = model
        self.base_url = self.hub.as_uri()
        os.environ["SOM_MODEL_CACHE"] = str(self.cache)

    def tearDown(self) -> None:
        os.environ.pop("SOM_MODEL_CACHE", None)
        self.tmp.cleanup()

    def fetch(self) -> list[str]:
        return fm.fetch(self.model, None, self.base_url, self.cache)

    def cached(self, name: str) -> Path:
        return self.cache / "dono" / "modelo" / REVISION / name

    def test_real_catalog_is_valid(self) -> None:
        catalog = json.loads(fm.CATALOG.read_text(encoding="utf-8"))
        schema = json.loads(fm.SCHEMA.read_text(encoding="utf-8"))
        self.assertEqual(fm.check_catalog(catalog, schema), [])

    def test_schema_rejects_bad_entries(self) -> None:
        schema = json.loads(fm.SCHEMA.read_text(encoding="utf-8"))
        catalog = json.loads(fm.CATALOG.read_text(encoding="utf-8"))
        for mutate in (
            lambda m: m["license"].update(category="livre"),
            lambda m: m.update(revision="main"),
            lambda m: m["files"]["model.safetensors"].update(sha256="xyz"),
            lambda m: m.pop("calibration"),
            lambda m: m["languages"].update(declared=[]),
            lambda m: m["quality"][0].update(label="ALVO"),
            lambda m: m["files"].update({"../fora": pin(GOOD, "weights")}),
        ):
            bad = copy.deepcopy(catalog)
            mutate(bad["models"][0])
            self.assertNotEqual(fm.check_catalog(bad, schema), [], mutate)

    def test_download_is_verified(self) -> None:
        self.assertEqual(self.fetch(), [])
        self.assertEqual(self.cached("model.safetensors").read_bytes(), GOOD)

    def test_altered_file_is_refused(self) -> None:
        (self.folder / "model.safetensors").write_bytes(GOOD.replace(b"t", b"T", 1))
        errors = self.fetch()
        self.assertEqual(len(errors), 1)
        self.assertIn("recusado", errors[0])
        self.assertFalse(self.cached("model.safetensors").exists())
        self.assertEqual(list(self.cached("model.safetensors").parent.glob(".part-*")), [])
        self.assertTrue(self.cached("tokenizer.json").exists())

    def test_truncated_file_is_refused(self) -> None:
        (self.folder / "model.safetensors").write_bytes(GOOD[:-1])
        self.assertEqual(len(self.fetch()), 1)
        self.assertFalse(self.cached("model.safetensors").exists())

    def test_tampered_cache_is_replaced(self) -> None:
        self.assertEqual(self.fetch(), [])
        self.cached("model.safetensors").write_bytes(b"adulterado")
        self.assertEqual(self.fetch(), [])
        self.assertEqual(self.cached("model.safetensors").read_bytes(), GOOD)

    def test_branch_revision_is_refused(self) -> None:
        self.model["revision"] = "main"
        self.assertIn("40 hex", self.fetch()[0])


if __name__ == "__main__":
    unittest.main()
