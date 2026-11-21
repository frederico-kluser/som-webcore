---
name: Benchmark report
about: Share measurements from your device (available once the benchmark harness exists — roadmap activity P-11)
title: '[bench] '
labels: benchmark, triage
assignees: ''
---

<!-- Numbers are only comparable when they follow the protocol in docs/METHODOLOGY.md
     ("Medição de desempenho"). Attach the JSON produced by the harness; do not paste screenshots.
     Reports identify the machine, never the person. -->

## Environment

- **Device / CPU / GPU:**
- **GPU adapter info reported by the browser** (vendor, architecture):
- **Operating system and version:**
- **Browser and version:**
- **Power:** <!-- battery or plugged in -->
- **Thermal state:** <!-- cold start, after N minutes of use… -->

## What was measured

- **Commit SHA:**
- **Model and variant:** <!-- e.g. ts-ettin-17m, FP16 -->
- **Model file hash:**
- **Backend:** <!-- WebGPU, Wasm SIMD (threads?), baseline ONNX Runtime Web -->
- **Baseline measured in the same session?** <!-- yes / no -->

## Results

<!-- Attach the harness JSON. Summarize p50 / p95 / p99 of warm latency, cold start,
     and anything surprising. -->

## Notes

<!-- Errors, device lost, visible jank, anything the numbers do not show. -->

- [ ] The report validates against `bench/schema/report.schema.json`.
- [ ] I ran the measurement twice and the p50 varied by less than 10%.
