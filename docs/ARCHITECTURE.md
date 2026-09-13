# Architecture

## Runtime — 2026-09-13

React/Vite/TypeScript owns UI and input. Portable C++17 compiled with Emscripten owns deterministic fighter simulation. A dedicated neural worker owns measured connectivity and authored LIF dynamics. Raw WebGL2 renders measured soma points with a Canvas fallback; canvas game art uses original geometry. No Nintendo data, Dolphin, HAL or DoomFly runtime dependencies, heavy 3D engine, WebGPU requirement or player installation.

Default boot loads WASM and hash-checked measured geometry, then automatically loads the packaged graph in `male_cns.worker.ts`. PLAY enables only after anatomy identity, graph checksums, CSR structure and model initialization succeed. Failures display an actionable error. `?controller=dummy` explicitly selects the lightweight synthetic controller and separate optional diagnostic panel. That route preserves geometry fallback, cancellation/retry/unload and bounded research runs. Default play does not allocate a second graph for diagnostics.

## Simulation and scheduling

C++ integer fixed-point game state is independent of render time. `Session` uses a fixed 60 Hz clock and at most one outstanding neural request. It samples the human input and observation, waits for the matching neural frame, decodes exactly its displayed motor values and advances WASM once. Render frames never advance game/model state. Excess accumulated time pauses with an explanation. Blur and tab hiding pause play.

Epochs invalidate stale in-flight responses. A separate generation changes on reset, clearing model voltage, pending currents, refractory state, readout means and action cooldowns. A cached frame makes retries of the same observation tick idempotent after pause. Skipped ticks fail. Reset clears renderer persistence. Worker errors pause the session; unloading terminates worker ownership.

## Neural interface and measured data

The explicit `sensoryEncode` module produces six normalized game channels. MaleCNSBrain maps them into annotation-selected visual-projection neurons, propagates SparseLif on all retained wiring and reads descending/motor populations. Authored normalization produces the five displayed motor values; `motorDecode` converts those exact values into axis/buttons. Full details and assumptions are in [NEURAL_GAMEPLAY.md](NEURAL_GAMEPLAY.md). This is not biologically validated behavior. All-positive signs are an explicit artificial policy, not an inference from transmitter labels.

BrainFrame carries full-population spike bytes, active count, sensory values, motor values and game tick. The renderer consumes this interface for either real model or dummy activity. `visual_indices` maps measured soma points to full graph indices; 27,038 unpositioned neurons remain in dynamics. Display decay never modifies neural state. Only activity/signal arrays cross the worker boundary; the 200.9 MiB graph stays worker-owned.

The offline Arrow/NumPy pipeline verifies locked official inputs and emits sorted CSR, positive measured synapse counts, exact uint64 IDs, dictionary-coded annotations, coordinates and coverage reports. Browser packaging uses bounded hash-checked gzip chunks with opaque binary names. All required play assets are served by the site. See [FLY_CONNECTOME.md](FLY_CONNECTOME.md), [GRAPH_LOADING.md](GRAPH_LOADING.md) and data/README.md.

## Tests and delivery

Native CMake tests cover game semantics and replay, with exhaustive source-informed short-hop release fixtures. The serialized short-hop latch expands the fighter hash layout to 18 fields. Neural fixtures cover sparse propagation, bounds, removal of connectivity, output decoding, pause retry, reset and action pulse timing. Real-data replay compares all 600 neural/game frames after reset and native/WASM execution of generated inputs. Chrome tests cover real default play, synthetic demo, diagnostics, errors, input/HUD, pause/reset, WebGL2/Canvas and responsive layout. Canonical command: `./scripts/verify.sh`. Determinism establishes implementation consistency, not Melee or biological fidelity.

`web/dist` contains the static site, workers, WASM, geometry and graph chunks. Serve the complete directory via HTTP(S), preserving MIME types. No SharedArrayBuffer or cross-origin isolation requirement. Local preview is available; public hosting remains unfinished. Further Melee fidelity improvements remain subsequent work. Research assays and the separate spike view are documented in NEURAL_MODEL.md, POPULATION_MAPPING.md and NEURAL_DIAGNOSTIC.md.

## Headless batches
`GameBatch` owns independent native GameState entries, accepts per-lane controller vectors and supports isolated resets. It validates vector shapes before stepping any lane. It uses the same scalar game_step with no rule changes or threading. `batch_tests` verifies per-frame equivalence to isolated games; `batch_bench` reports all five requested sizes with deterministic repeats. This is a game-only baseline, not 1,024 simultaneous full-connectome controllers. See BENCHMARKS.md.
