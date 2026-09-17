# Architecture

## Runtime — 2026-09-13

React/Vite/TypeScript owns UI and input. Portable C++17 compiled with Emscripten owns deterministic fighter simulation. A dedicated neural worker owns measured connectivity and authored stable rate dynamics. Raw WebGL2 renders measured soma points with a Canvas fallback; the game canvas draws an authored nebula backdrop (cover-fit), stage map plate aligned to the sim platform plane, and preloaded Fox/Fly sprite sheets selected from simulation action state. Its fixed renderer-only view and sprite anchors never feed collision, blast zones, physics or controller sensors. No Nintendo data, Dolphin, HAL or DoomFly **runtime** dependencies (offline developer reference tools are allowed per AGENTS.md / MELEE_PORT.md), heavy 3D engine, WebGPU requirement or player installation.

Default boot loads WASM and hash-checked measured geometry, then automatically loads the packaged graph in `male_cns.worker.ts`. PLAY enables only after anatomy identity, graph checksums, CSR structure and model initialization succeed. Failures display an actionable error. `?controller=dummy` explicitly selects the lightweight synthetic controller and separate optional diagnostic panel. That route preserves geometry fallback, cancellation/retry/unload and bounded research runs. Default play does not allocate a second graph for diagnostics.

## Simulation and scheduling

C++ integer fixed-point game state is independent of render time. `Session` uses a fixed 60 Hz clock and at most one outstanding neural request. It posts the current observation, waits for the matching neural frame, samples human Fox input at apply time (so keys pressed during the neural wait are not frozen at request time), decodes exactly the displayed Fly motor values and advances WASM once. Render frames never advance game/model state. Excess wall-clock debt is dropped without skipping simulation frames, so an overloaded or suspended phone runs slower instead of demanding a manual resume.

Epochs invalidate stale in-flight responses. A separate generation changes on reset, clearing model activation, cached drive and action cooldowns. A cached frame makes retries of the same observation tick idempotent after pause. Skipped ticks fail. Reset clears renderer persistence. Worker errors pause the session; unloading terminates worker ownership. Page hide (`visibilitychange`) pauses safely and resumes automatically when the same page becomes visible; `window.blur` is not used because mobile browsers fire it spuriously. Wall-clock debt does not accumulate while a neural reply is pending.

Interactive narrow/coarse-pointer clients use a presentation-only phone profile: canvas backing stores are capped at 1× device pixels, game plus soma rendering is capped at 30 fps, and React HUD publication is capped at 10 Hz. The worker/controller and deterministic game clock are unchanged (60 game-frame target, 30 Hz V2 model updates). Capture/export paths retain their authored output settings.

## Neural interface and measured data

The explicit `sensoryEncode` module produces six normalized game channels. MaleCNSBrain maps them into annotation-selected visual-projection neurons, propagates the stable WASM rate model on all retained wiring and applies a calibrated descending/motor readout. Authored normalization produces the five displayed motor values; `motorDecode` converts those exact values into axis/buttons. Full details and assumptions are in [NEURAL_GAMEPLAY.md](NEURAL_GAMEPLAY.md). This is not biologically validated behavior. Normalized positive coupling is an explicit artificial policy, not an inference from transmitter labels.

BrainFrame carries full-population activity bytes, active count, sensory values, motor values and game tick. The renderer consumes this interface for either real model or dummy activity. `visual_indices` maps measured soma points to full graph indices; 27,038 unpositioned neurons remain in dynamics. V2 rendering holds the latest packed rates with a fixed log display-only scale (256-entry log LUT); it does not decay rates between model updates. WebGL re-uploads the activity attribute only when mapped visuals change. Live play keeps React match snapshot/tick live and throttles sensory/motor frame bar updates (~10 Hz) while the rAF path reads session refs directly. During live play, a renderer-only reaction layer leans the cloud toward the opponent, tracks Fly vertical motion, blooms with motor drive, and pulses on attack onset or hitlag. It freezes on pause and is disabled for the static population view; none of these transforms feed simulation, activity, or controller state. Dummy/LIF display persistence never modifies neural state. See [ACTIVITY_DISPLAY.md](ACTIVITY_DISPLAY.md). A one-time role byte array derived from the exact controller mapping supports the optional static population view and positioned/unpositioned coverage. Per-frame activity/signal arrays cross the worker boundary as transferable copies; the worker-owned cache stays attached for pause retries. The 200.9 MiB graph stays worker-owned.

The offline Arrow/NumPy pipeline verifies locked official inputs and emits sorted CSR, positive measured synapse counts, exact uint64 IDs, dictionary-coded annotations, coordinates and coverage reports. Browser packaging uses bounded hash-checked gzip chunks with opaque binary names. All required play assets are served by the site. See [FLY_CONNECTOME.md](FLY_CONNECTOME.md), [GRAPH_LOADING.md](GRAPH_LOADING.md) and data/README.md.

## Tests and delivery

Native CMake tests cover game semantics and replay, with exhaustive source-informed short-hop release fixtures. The serialized short-hop latch expands the fighter hash layout to 18 fields. Neural fixtures cover sparse propagation, bounds, removal of connectivity, output decoding, pause retry, reset and action pulse timing. Real-data replay compares all 600 neural/game frames after reset and native/WASM execution of generated inputs. Chrome tests cover real default play, synthetic demo, diagnostics, errors, input/HUD, pause/reset, WebGL2/Canvas and responsive layout. Canonical command: `./scripts/verify.sh`. Determinism establishes implementation consistency, not Melee or biological fidelity.

`web/dist` contains the static site, workers, WASM, geometry and graph chunks. Serve the complete directory via HTTP(S), preserving MIME types. No SharedArrayBuffer or cross-origin isolation requirement. Public static hosting and anonymous Chrome play are verified; see data/public-deployment.json. Further Melee fidelity improvements remain subsequent work. Research assays and the separate spike view are documented in NEURAL_MODEL.md, POPULATION_MAPPING.md and NEURAL_DIAGNOSTIC.md.

## Headless batches
`GameBatch` owns independent native GameState entries, accepts per-lane controller vectors and supports isolated resets. It validates vector shapes before stepping any lane. It uses the same scalar game_step with no rule changes or threading. `batch_tests` verifies per-frame equivalence to isolated games; `batch_bench` reports all five requested sizes with deterministic repeats. This is a game-only baseline, not 1,024 simultaneous full-connectome controllers. See BENCHMARKS.md.

V2 runs neural integration at 30 Hz and game semantics at 60 Hz. A separate WASM module accelerates full-graph propagation; actual model_tick is carried in BrainFrame for timing. See NEURAL_GAMEPLAY.md for scheduling, calibration, sensor rules and memory ownership.

## LinkedIn brain cinematic (non-gameplay)

Isolated Vite multi-page entry at `/cinematic/` renders measured MaleCNS somas with Three.js for video export. It reuses the connectome geometry package and refuses synthetic placeholder geometry. Default activity is a labeled synthetic cinematic timeline; real model activity can be injected via `ActivitySource`. Deterministic frame export and ffmpeg encoding are documented in [CINEMATIC.md](CINEMATIC.md). This path does not load the gameplay neural worker or alter the match loop.

## LinkedIn capture mode (gameplay)

Query `?capture=<preset>` on the main game page loads a chrome-free, autoplaying take driven by a deterministic Fox input timeline against the live MaleCNS V2 controller. `view=game|brain` selects the full-bleed canvas; brain capture uses a stark black clear color and the **same** live model activity that drives the Fly (not the synthetic cinematic timeline). Markers and presets are documented in [CAPTURE.md](CAPTURE.md). Music sync is an editing property only.

## Developer adversarial evaluation
`scripts/long_matches.mjs` runs the same WASM controller/game against deterministic authored policies with per-frame native replay and recorded activity/motor fingerprints. These opponent policies and measurement utilities are developer-only and do not enter browser gameplay. See [MATCH_EVALUATION.md](MATCH_EVALUATION.md) for protocol, coverage and limits.
