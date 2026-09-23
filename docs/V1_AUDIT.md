# Completion audit — 2026-09-13

## Controller V2 release update

The public runtime now serves Controller V2: a stable rate-model WASM core with an authored calibrated readout and explicit recovery/reach sensory signals. This replaces the saturated LIF gameplay route; it does not establish biological behavioral validity. The deployment service confirmed the V2 source revision and a fresh anonymous Chrome session loaded `wasm/neural.js`, `wasm/neural.wasm`, and `neural/readout.json`, displayed **Recovery need**, dealt 8% to a stationary Fox, and completed pause/reset without page errors. Full evidence is recorded in `data/public-deployment.json`.

The original brief, not the most recent small milestone, defines completion. This audit distinguishes verified public V1 functionality from explicitly later research. Public deployment and a fresh signed-out Chrome session now supply delivery evidence; see data/public-deployment.json.

| Requirement | Current evidence | Assessment |
|---|---|---|
| Chrome URL → page → PLAY → human Fox vs neural Fly, no player installation/account/manual scientific downloads | Production Chrome neural.spec.ts, automatic local graph loading, static web/dist | Verified locally and at the public URL without authentication |
| Original fighters, one platform, stocks, keyboard movement/jump/fastfall/attack/damage/knockback | game.cpp, native tests, browser.spec.ts | Implemented with authored mechanics |
| Deterministic portable native CMake + Emscripten core, headless/replay/benchmark | CMakeLists.txt, verify.sh, 900-frame native/WASM agreement | Verified |
| 60 Hz game semantics independent of rendering; expensive neural work off main thread | Session/FixedClock, worker ownership, input tests, pause/reset browser checks | Verified on tested Chrome; no universal device-rate guarantee |
| Real official MaleCNS annotations, NT predictions and positive sparse connectivity, documented release/source locks/filtering/coverage | source lock, generated report, importer fixtures, validate_artifact.py, population audit | Verified real processed artifact |
| Full retained graph participates; missing positions excluded only from display | CSR loader and visual_indices, loader tests, real metadata checks | Verified |
| Live measured brain/VNC point cloud, dim background plus actual bright model activity; WebGL2 and Canvas fallback | BrainRenderer, neural Chrome tests and inspected screenshots | Verified |
| Explicit sensory encoder → selected upstream neurons → deterministic model → motor decoder → same displayed/applied outputs | MaleCNSBrain, sensory.ts, motor.ts, disconnected fixture, neural_replay.mjs | Implemented and verified; arbitrary mappings and positive signs labeled |
| Scientific separation of measured wiring from authored dynamics, no biological accuracy claim | Main UI notes, NEURAL_GAMEPLAY.md, FLY_CONNECTOME.md | Documented; control quality remains weak and unvalidated |
| Melee reference inspection, per-mechanic fidelity matrix, incremental reference tests | pinned reference commit, MELEE_PORT.md, jump_reference.cpp | Improved partial jump/gravity fidelity; no full Melee equivalence claim |
| Required architecture/provenance/fidelity/progress/benchmark docs and canonical checks | docs/, AGENTS.md, scripts/verify.sh | Present; canonical verification exited 0 (79 tests plus real artifact/replay checks) |
| No Nintendo/ROM/Dolphin/decomp as player or browser runtime deps; no heavy framework, runtime HAL/DoomFly, mandatory WebGPU/SharedArrayBuffer (offline Melee reference OK per AGENTS.md) | Original canvas art, package.json, CMake and build script inspection | Scope preserved |
| Browser-deployable complete static artifacts with no scientific downloads by players | web/dist includes graph chunks, geometry, WASM and workers | 219 assets packaged; hosted neural preparation and interactive smoke test pass |
| Fifth milestone: benchmark independent 1/16/64/256/1024 environments | GameBatch, per-frame serial equivalence tests at all sizes, data/batch-benchmark.json | Verified at all five sizes; canonical check exited 0 |
| Later fidelity systems and research acceleration/plasticity | Shield/grab/DI/ledges/specials, SIMD/GPU/learning | Explicit later scope; not represented as complete |

Completion evidence: the deployment service reports success for the exact V2 runtime commit recorded in data/public-deployment.json, with public access. Fresh native Chrome, without cookies or account login, loaded the V2 rate WASM and calibration assets, showed the Recovery need sensor, dealt 8% damage to a stationary Fox, paused and reset correctly, and emitted no page errors. The canonical suite passed native 5/5, TypeScript 40/40, Python 17/17, and Chrome 22/22 checks. This proves the bounded public implementation while preserving its explicit fidelity, learning, acceleration, and scientific limitations.

Current public URL: https://fox-vs-fly.pages.dev/ (provided 2026-09-23; current availability was not verified by this audit)
