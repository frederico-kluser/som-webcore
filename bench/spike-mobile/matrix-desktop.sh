#!/usr/bin/env bash
# T-01 and T-03 — the test page on desktop Chrome, once per engine and variant (serve.mjs running).
# Results: bench/results/<date>-desktop-<browser><version>-<engine>-<variant>-<model>.json
# Usage: bash bench/spike-mobile/matrix-desktop.sh [configs...]   (config = "browser engine variant model")
set -u
HERE="$(cd "$(dirname "$0")" && (pwd -W 2>/dev/null || pwd))"
DATE="$(date +%F)"
CONFIGS=("$@")
if [ ${#CONFIGS[@]} -eq 0 ]; then
  CONFIGS=(
    "stable ort-wasm int8 ts-ettin-17m" "stable ort-wasm 8bit ts-ettin-17m" "stable ort-wasm fp32 ts-ettin-17m" "stable ort-wasm q8emb-f16 ts-ettin-17m"
    "stable ort-webgpu fp32 ts-ettin-17m" "stable ort-webgpu 8bit ts-ettin-17m" "stable ort-webgpu int8 ts-ettin-17m"
    "stable ort-webgpu-jsep fp32 ts-ettin-17m" "stable ort-webgpu-jsep 8bit ts-ettin-17m" "stable ort-webgpu-jsep int8 ts-ettin-17m"
    "stable jh-cpu f32 ts-ettin-17m" "stable jh-webgpu f32 ts-ettin-17m" "stable jh-webgpu f16 ts-ettin-17m"
    "canary native - -"
  )
fi
for config in "${CONFIGS[@]}"; do
  set -- $config
  case "$1" in stable) version=157 ;; canary) version=160 ;; *) version="" ;; esac
  if [ "$2" = native ]; then
    name="$DATE-desktop-chrome$version-native"; query="engine=native"; api=""
  else
    name="$DATE-desktop-chrome$version-$2-$3-$4"; query="engine=$2&variant=$3&model=$4"; api="--no-api"
  fi
  # --enable-precise-memory-info: performance.memory without Chrome's rounding.
  node "$HERE/run-desktop.mjs" --browser "$1" $api --console --result "$name" --timeout 300 --flags "--enable-precise-memory-info" \
    --url "http://localhost:8377/index.html?$query&name=$name" 2>&1 | tail -1
done
