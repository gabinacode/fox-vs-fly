#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -x .venv/bin/python ]]; then
  PREPROCESS_PYTHON=.venv/bin/python
else
  PREPROCESS_PYTHON=python3
fi
"$PREPROCESS_PYTHON" -c 'import numpy, pyarrow' || { echo 'Install brain/preprocess/requirements.txt in .venv; preprocessing tests are required.' >&2; exit 1; }
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j 4
ctest --test-dir build --output-on-failure
npm --prefix web test
node --test scripts/match_evaluation.test.mjs
"$PREPROCESS_PYTHON" -m unittest discover -s brain/tests -p "test_*.py"
./scripts/build_wasm.sh
npm --prefix web run build
node scripts/replay_wasm.mjs
node scripts/neural_replay.mjs
node scripts/controller_behavior.mjs
node scripts/activity_evidence.mjs
node scripts/long_matches.mjs --check
npm --prefix web run test:browser
./build/sim_bench
./build/batch_bench
node scripts/lif_bench.mjs
"$PREPROCESS_PYTHON" brain/preprocess/validate_artifact.py
"$PREPROCESS_PYTHON" brain/preprocess/populations.py --check
