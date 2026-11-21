#!/usr/bin/env python3
"""Compare two surface captures (surface.html): the native DecisionModel and this project's polyfill.

    python bench/spike-mobile/reference/compare_surface.py <native.json> <polyfill.json>

Compares member names, kinds, lengths and attributes; the interface object; every validation case
(availability() and create(): value, or error name and message); and decide() on a created session
(result member types, errors for blank input, an aborted signal and a destroyed session).
"downloadable" and "available" count as the same answer: which one appears only says whether the
model was already downloaded. Prints one line per difference. Standard library only.
"""

from __future__ import annotations

import json
import sys

READY = {"downloadable", "available", "downloading"}


def norm(outcome):
    if outcome is None:
        return None
    if outcome.get("ok"):
        value = outcome.get("value")
        if value in READY:
            return ("ok", "ready")
        if isinstance(value, str) and value.startswith("[object "):
            return ("ok", "object")
        return ("ok", value)
    error = outcome.get("error") or {}
    return ("error", error.get("name"), error.get("message"))


def members(table):
    return {k: (v.get("kind"), v.get("length"), v.get("getter"), v.get("enumerable")) for k, v in (table or {}).items()}


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    native, ours = (json.load(open(p, encoding="utf-8")) for p in argv)
    diffs = []
    for part in ("static", "prototype"):
        a, b = members(native.get(part)), members(ours.get(part))
        for key in sorted(set(a) | set(b)):
            if a.get(key) != b.get(key):
                diffs.append(f"{part}.{key}: native {a.get(key)} · polyfill {b.get(key)}")
    for key in ("prototypeParent", "interfaceLength", "toStringTag"):
        if native.get(key) != ours.get(key):
            diffs.append(f"{key}: native {native.get(key)!r} · polyfill {ours.get(key)!r}")
    if norm(native.get("construct")) != norm(ours.get("construct")):
        diffs.append(f"new DecisionModel(): native {norm(native.get('construct'))} · polyfill {norm(ours.get('construct'))}")
    theirs = {c["name"]: c for c in ours.get("cases", [])}
    compared = 0
    for case in native.get("cases", []):
        other = theirs.get(case["name"])
        if other is None:
            diffs.append(f"case {case['name']}: missing in the polyfill capture")
            continue
        for op in ("availability", "create"):
            a, b = norm(case.get(op)), norm(other.get(op))
            if a is None and b is None:
                continue
            compared += 1
            if a != b:
                diffs.append(f"case {case['name']} {op}(): native {a} · polyfill {b}")
    a, b = native.get("createWithoutActivation") or {}, ours.get("createWithoutActivation") or {}
    for key in ("create", "decideEmpty", "decideAborted", "destroy", "decideAfterDestroy"):
        if norm(a.get(key)) != norm(b.get(key)):
            diffs.append(f"session {key}: native {norm(a.get(key))} · polyfill {norm(b.get(key))}")
    if a.get("resultFieldTypes") and b.get("resultFieldTypes") and a["resultFieldTypes"] != b["resultFieldTypes"]:
        diffs.append(f"decide() result member types: native {a['resultFieldTypes']} · polyfill {b['resultFieldTypes']}")
    if a.get("result") and b.get("result"):
        order_a = {k: list(v) for k, v in a["result"].items()}
        order_b = {k: list(v) for k, v in b["result"].items()}
        if order_a != order_b:
            diffs.append(f"decide() member order: native {order_a} · polyfill {order_b}")
    if a.get("instanceMembers") and b.get("instanceMembers") and members(a["instanceMembers"]) != members(b["instanceMembers"]):
        diffs.append("instance members differ")
    print(f"{compared} validation outcomes compared; {len(diffs)} difference(s)")
    for d in diffs:
        print(f"  - {d}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
