#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v emcmake >/dev/null 2>&1; then
  if [[ -n "${EMSDK:-}" && -f "$EMSDK/emsdk_env.sh" ]]; then
    source "$EMSDK/emsdk_env.sh" >/dev/null 2>&1
  elif [[ -f /tmp/melee-fly-refs/emsdk/emsdk_env.sh ]]; then
    source /tmp/melee-fly-refs/emsdk/emsdk_env.sh >/dev/null 2>&1
  else
    echo 'Emscripten missing. Install SDK 4.0.15 for development and set EMSDK or source emsdk_env.sh.' >&2
    exit 1
  fi
fi
emcmake cmake -S . -B build/wasm -DCMAKE_BUILD_TYPE=Release
cmake --build build/wasm -j 4
mkdir -p web/public/wasm
cp build/wasm/sim.js build/wasm/sim.wasm web/public/wasm/
