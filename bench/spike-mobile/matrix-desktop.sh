#!/usr/bin/env bash
# T-01 and T-03 — the test page on desktop Chrome, once per engine and variant (serve.mjs running).
# Results: bench/results/<date>-<PREFIX>-<browser><version>-<engine>-<variant>-<model>.json
# Usage: bash bench/spike-mobile/matrix-desktop.sh [configs...]   (config = "browser engine variant model")
# PREFIX tags the machine in the file names (default "desktop"; on the Mac mini, "desktop-macmini").
# The browser version comes from the installed app on macOS; elsewhere it is 157 (stable) and
# 160 (Canary), the versions of the development machine (ROADMAP, "Ambiente verificado").
set -u
HERE="$(cd "$(dirname "$0")" && (pwd -W 2>/dev/null || pwd))"
DATE="$(date +%F)"
PREFIX="${PREFIX:-desktop}"
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
browser_version() {
  if [ "$(uname)" = "Darwin" ]; then
    case "$1" in stable) app="Google Chrome" ;; canary) app="Google Chrome Canary" ;; *) app="" ;; esac
    for dir in /Volumes/Ext2TB/Applications /Applications; do
      if [ -n "$app" ] && [ -d "$dir/$app.app" ]; then
        plutil -extract CFBundleShortVersionString raw "$dir/$app.app/Contents/Info.plist" | cut -d. -f1
        return
      fi
    done
  fi
  case "$1" in stable) echo 157 ;; canary) echo 160 ;; *) echo "" ;; esac
}
for config in "${CONFIGS[@]}"; do
  set -- $config
  version="$(browser_version "$1")"
  if [ "$2" = native ]; then
    name="$DATE-$PREFIX-chrome$version-native"; query="engine=native"; api=""
  else
    name="$DATE-$PREFIX-chrome$version-$2-$3-$4"; query="engine=$2&variant=$3&model=$4"; api="--no-api"
  fi
  # --enable-precise-memory-info: performance.memory without Chrome's rounding.
  node "$HERE/run-desktop.mjs" --browser "$1" $api --console --result "$name" --timeout 300 --flags "--enable-precise-memory-info" \
    --url "http://localhost:8377/index.html?$query&name=$name" 2>&1 | tail -1
done
