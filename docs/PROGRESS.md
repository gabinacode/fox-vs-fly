# Progress

## CURRENT MILESTONE
**Controller V2 deployed and anonymously verified.** Stable WASM rate dynamics, recovery/reach sensors and calibrated readout replace saturated LIF gameplay. Full-graph checks track both directions, reverse without reset, attack in range and recover. Stationary-opponent damage improves 0→32, jumps 13→4 and fastfall frames 581→2. `./scripts/verify.sh` exited 0 (native 5/5 including rate, TypeScript 40/40, production Chrome 22/22). The public chatgpt.site serves the V2 bundle (223 files); a fresh anonymous Chrome received the V2 WASM/calibration assets, showed the Recovery need sensor, dealt 8% damage to a stationary Fox, and paused/reset without errors.

Play: https://fox-vs-fly.hipcoo-micha-0857.chatgpt.site

## DONE
- Clarified Melee reference policy: Nintendo disc/Dolphin/decomp are developer-offline tools for fixtures only; never browser/player runtime deps. Documented in AGENTS.md, MELEE_PORT.md, ARCHITECTURE.md; gitignore covers common disc formats.
- Public static deployment with all 219 runtime assets. Anonymous Chrome reaches live neural gameplay, moves Fox, pauses/resets and reports no page errors.
- Independent scalar GameBatch API, per-frame serial equivalence at all five sizes, isolated resets and atomic shape validation. Deterministic warmup plus three-repeat benchmarks recorded in data/batch-benchmark.json.
- Source-informed sticky short hop and launch-frame physics skip, authored heights, exhaustive button-release fixtures, and serialized latch in deterministic hashes.
- Closed neural/game loop, automatic graph preparation, actual spike HUD, explicit dummy route, cached pause retries and reset generations. Connectivity-removal and pulse fixtures; 600-frame real-graph reset/native/WASM agreement. See NEURAL_GAMEPLAY.md.
- Inspected pinned Melee, DoomFly, HAL sources and official MaleCNS release/download pages before implementation.
- Persistent AGENTS.md, architecture, fidelity matrix, scientific boundaries and developer README.
- Deterministic integer C++17 simulation: two fighters, one platform, movement, walk/dash/run, jumpsquat, jump/double jump, drift, gravity/terminal/fastfall, traction, landing, attack phases, hit detection, damage, knockback, hitlag/stun, trades, stocks, respawn immunity, victory/draw.
- Native CMake tests, serialized replay and benchmark. Same core compiled with Emscripten 4.0.15.
- React/Vite/TypeScript frontend with original geometry-based fighter art, keyboard controls, HUD, pause/reset and match-end flow.
- Explicit synthetic demo: Worker DummyBrain with explicit sensory encoder and motor decoder. Displayed output values are exactly those decoded for the WASM input.
- BrainFrame interface, typed-array geometry/activity, raw WebGL2 point renderer and tested Canvas fallback. Display persistence is isolated from the controller.
- Fixed-step scheduler independent of rAF; stale-response rejection, reset epochs, blur/tab pause and worker failure handling.
- Production static bundle at web/dist includes optional ~76 MiB graph transport plus 2.2 MB geometry; WASM itself 4,544 bytes.
- Real official v1.0 annotation, NT and weighted-connectivity inputs downloaded (~1.11 GB total), SHA-256 locked in data/male-cns-v1.0.sources.json. No EM/synapse-coordinate bulk files.
- Developer-only Arrow/NumPy importer produces sorted CSR_V2, exact IDs, measured positive weights, annotation/NT dictionaries, original and normalized soma coordinates, and visual-to-graph indices.
- Explicit node/edge/contact retention accounting; missing positions and NT do not remove graph neurons. All retained weight-one edges and autapses preserved.
- Real artifact: 166,700 neurons; 25,582,938 directed edges; 139,662 soma positions; 27,038 graph nodes without soma positions. Source annotation rows: 211,577 (not a biological neuron total).
- Validated real output at data/generated, 218,702,759 bytes (~209 MiB). Raw/generated binaries and project venv are ignored. Compact data/male-cns-v1.0.report.json records evidence and output hashes.
- Six new importer tests plus six existing artifact tests: exact IDs, missing data, sparse direction, coalescing/overflow, loss accounting, source corruption and deterministic output-array hashes.
- Compact browser geometry package generated and versioned in web/public/connectome: 2,234,592 binary bytes, no full graph arrays.
- SHA-256/count/dtype/range-validated browser loader; demo-only explicit playable synthetic fallback on missing/corrupt geometry.
- Runtime-sized worker activity over all retained model nodes; visual_indices correctly maps to measured positioned subset; reset clears display persistence.
- Demo UI separates measured anatomy from synthetic activity and displays coverage/counts from package metadata. Offline edge count explicitly labeled; no biological controller claim.
- Desktop/390px mobile screenshots reviewed with measured soma geometry: brain above VNC, no horizontal overflow. No connecting fibers fabricated. Retained local preview responds HTTP 200.

- Added deterministic gzip transport, bounded hash-checked worker CSR loading, exact ID/anatomy identity checks, metadata and structural validation.
- Added on-demand progress, cancellation, failure retry and unload; no large arrays cross the UI thread.
- Real Chrome loaded/validated the graph in 0.959 seconds; 210,664,708 array bytes and 1,728,344 maximum explicit chunk staging bytes. These are not total heap/RSS measurements.

- Added browser-compatible sparse integer LIF with eight semantic/reference/overflow/replay tests and documented assumptions in NEURAL_MODEL.md.
- Full-topology headless benchmark verifies source hashes and repeated spike traces for silent/sparse/dense artificial drive. Model state adds 3,167,300 bytes.

- Browser benchmark performs 1,080 total ticks across three workloads and warmup/measurement/reset replay, yielding every four ticks.
- Tested stop with retained graph, rerun, cross-runtime spike traces and unload during execution; match continues. Results UI screenshot inspected. Model/input arrays total 3,834,100 bytes beyond graph storage; total browser heap is unmeasured.

- Added controlled comparison UI, independent model resets, late-window spike counts and suite validation. Focused fixture/Chrome tests pass; screenshot inspected.
- Transmission-off response agrees with analytical 66,680 spikes; pulse response persists under all-positive signs, documenting need for stability/sign investigation.

- Added 600-tick pulse suite with stronger-leak and sign controls, conserved 60-tick spike bins, last-spike diagnostics and independent reset replay.
- Focused Chrome results: baseline 2,318,764 spikes through tick 599; stronger leak 6,722 spikes ending at tick 11; alternating signs 9,057 spikes through tick 599. No biological interpretation claimed.

- Added verified reproducible annotation candidate report and POPULATIONS.md. Missing soma positions never remove selected sensory neurons. Related tbc labels remain separate.
- Added three fixture tests for exact IDs, missing metadata/positions, reproducibility, corrupted sources and invalid codes/mapping; canonical verification checks the real report byte-for-byte.

- Added annotation mapping core and worker suite: exact superclass/side selectors, normalized readout, fixed-seed membership permutation and excluded-side reporting.
- Chrome confirms audited population sizes and zero disconnected output; reset traces agree. Readout screenshot inspected and limitations documented in POPULATION_MAPPING.md.

- Added independent lateral suite with separate stimulus hashes, reversed-order replay equality and descriptive directional contrast. Same-side analytical fixture and real graph controls pass; screenshot inspected.

- Added 15-condition amplitude/shuffle suite with explicit seeds, per-condition metadata and reverse-order replay. All outcomes retained in data/male-cns-v1.0.mapping-sweep.json.
- Annotated contrast exceeds all three tested shuffles at 250/500/1000, but left input still favors right readout at lower strengths. Raw difference is not a validated bidirectional controller.

- Added lazy diagnostic renderer and transferred full-population activity frames from actual SparseLif spikes; no fake sensory/motor frame values.
- Focused Chrome matches mapped trace 322408360 after reset; clear removes activity/counters, unload disposes worker/view. Screenshot inspected.

## IN PROGRESS
None.

## FAILING
None. **./scripts/verify.sh exited 0** after the V2 controller change. Native rate + prior C++ tests pass; TypeScript 40/40; Python artifact validation passes; production Chrome 22/22 including approach-and-hit. All 900 native/WASM hashes match. Dummy-mode browser attack loop now approaches before attacking without weakening the damage assertion.

## KNOWN APPROXIMATIONS
Default gameplay activity is the stable rate model over measured wiring with a calibrated readout; the explicit dummy route retains synthetic activity; optional LIF diagnostics remain available. No biologically validated sensory/motor mapping. Geometry is measured somas only, not neurites or synapses; physical units not independently verified. 27,038 retained neurons have no soma position and are excluded only from display. Default graph preparation retains large typed arrays plus the WASM rate copy; graph dynamics now control default gameplay. Canvas fallback is functionally tested but has no 60-fps guarantee at the real point count.
Gameplay remains approximate with authored tuning and shared generic mechanics. No ECB fidelity, DI, shield, grab, ledges, specials, body pushboxes, audio, touch controller, online play, or online matchmaking.

## MELEE FIDELITY STATUS
Jump release/launch and gravity/fastfall structure PARTIALLY_MATCHED; other implemented systems APPROXIMATE; deferred systems NOT_IMPLEMENTED. Nothing is REFERENCE_MATCHED. Native/WASM agreement proves our core consistency, not Melee fidelity. See MELEE_PORT.md.

## FLY CONNECTOME STATUS
Official v1.0 graph processed and structurally validated. Browser renders 139,662 measured soma positions via mapping into 166,700 retained graph indices. The UI reads counts and missing-position coverage from packaged metadata. 25,582,938 connections / 124,177,617 synaptic contacts can be prepared in a separate worker. The default gameplay worker runs MaleCNSBrain V2 (stable rate WASM + calibrated readout); the explicit dummy route retains DummyBrain; historical LIF gameplay remains in male_cns_lif.ts. See FLY_CONNECTOME.md, NEURAL_GAMEPLAY.md and the source lock/report.

## BROWSER STATUS
Production Chrome tests pass for automatic neural game preparation, live model activity, neural pause/resume/reset, graph failure without silent fallback, neural Canvas/mobile, approach-and-hit against stationary Fox, measured geometry, game controls/HUD/reset, WASM failure, worker failure, WebGL2 and Canvas fallback, corrupt-geometry fallback, and 390px layout. Screenshots inspected. Calibrated neural play reported ~18 game / 60 render / 9 neural fps in the combat check (30 Hz model schedule). A fresh anonymous public Chrome session confirmed V2’s rate WASM, calibration JSON, Recovery need sensor and 8% stationary-Fox damage with no errors. Other browsers and sustained low-end performance remain untested.

## BENCHMARKS
Browser geometry binaries 2,234,592 bytes; source graph unchanged at 218,702,759 bytes. Chrome WebGL2 smoke with 139,662 points: 60/60/60 game/render/neural fps. Latest native benchmark ~9,422,190 frames/sec; dummy microbenchmark ~65,173 steps/sec at its original 7,200-sample test size (not the real population). Graph load 0.959 s, structural validation 79.4 ms, 76.0 MiB logical download, 200.9 MiB arrays. During preparation the short UI counter read 57/60/60 game/render/neural fps; headless LIF benchmark now measures 0.706/3.195/12.069 ms per tick for silent/sparse/dense artificial drive. Browser LIF now measures 0.326/4.507/18.062 ms mean per tick for silent/sparse/dense artificial drive. Dense p95 is 54.3 ms; no 60 Hz neural budget or biological performance claim. See BENCHMARKS.md.

## NEXT 5 TASKS
1. Evaluate longer neural matches and adversarial play without biological overclaims.
2. Extend sign/timestep sensitivity experiments and population mapping evidence.
3. Continue Fox fidelity beyond partial jump/gravity behavior: DI, collision and attack/knockback references.
4. Profile neural scaling before choosing shared graph batches, threads or GPU work.
