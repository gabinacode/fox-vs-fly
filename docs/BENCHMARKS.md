# Measurements

2026-09-11, local macOS arm64, AppleClang 21.0.0.21000101, CMake Release, Node 22.18.0, Emscripten 4.0.15. Chrome 152.0.7977.84. These are short smoke measurements on one machine, not performance guarantees.

| Measurement | Result | Method / limits |
|---|---:|---|
| Native gameplay | 8,631,650 frames/sec | ./build/sim_bench, 1M steps; includes stable field hashing, periodically resets; checksum 1599661804 |
| Native speed vs 60 Hz | 143,861× | Simple authored 2-fighter core, no neural simulation or rendering |
| DummyBrain | ~60,950 steps/sec | Node/Vitest, 1,000 calls, 7,200 generated activity samples; allocation included; not LIF or MaleCNS |
| Browser gameplay | 60 fps | Production Chrome smoke, 1-second UI counter during a short match |
| Game rendering | 60 fps | Same smoke; requestAnimationFrame |
| Neural rendering | 60 fps | Same smoke; 7,200 GL_POINTS, static positions / changing bytes |
| WASM payload | 4,544 bytes | Uncompressed; generated loader 22,505 bytes |
| Production directory | ~260 KB disk | Includes React JS, CSS, worker, WASM, HTML and favicon; no external assets |

The preliminary native run was 8.20M fps; variation is expected. The brain test measured ~61.6k steps/sec in an earlier run. Report real-graph costs only after its implementation. Rendering counters measure frames submitted, not GPU timing or interaction latency. No 16/64/256/1024-environment or sustained mobile benchmark yet.

Reproduce with ./scripts/verify.sh. Production browser screenshots are generated under web/test-results/ (ignored); benchmark output prints to the terminal. No thresholds are imposed on environment-dependent FPS measurements; deterministic checks and functional assertions remain mandatory.

## M2 preprocessing run
2026-09-11: official graph import reached manifest creation in 26.789 seconds (source lock verification, batched filtering, sorting/coalescing, binary emission and checksums included; final artifact validation/copy excluded from timer). Input totals 1,109,008,094 bytes. Output totals 218,702,759 bytes (~208.6 MiB). Source edge rows 151,856,684; retained edges 25,582,938. Peak memory not measured. Full graph not yet loaded or simulated in browser.

Canonical verification after this change: native 9,260,170 game frames/sec; dummy steps ~64,306/sec; Chrome 60/60/60 game/render/neural fps. These remain simple-core/dummy measurements, not MaleCNS dynamics performance.

## M2 measured browser anatomy — 2026-09-12
Geometry payload: 2,234,592 bytes (positions + visual_indices), plus a small manifest. Full CSR is not requested. Production Chrome with 139,662 points and 166,700 dummy activity nodes measured 60 game / 60 render / 60 neural fps in the short interaction smoke. Canvas fallback passed gameplay tests; no sustained fallback-FPS claim. These remain synthetic activity, not LIF, measurements. Native core measured 9.33M frames/sec in this verification.

## M2 full graph preparation — 2026-09-12
Canonical verification passes: native 2, TypeScript 16, Python 14, production Chrome 10 tests; native/WASM 900-frame replay agrees and real artifact validation passes. Native core ~9.422M frames/sec; dummy ~65,264 steps/sec at the 7,200-sample microbenchmark size.

Full graph Chrome localhost preparation: **958.9 ms**, including **79.4 ms** final structural validation; prior focused run 1009.1 ms. Logical compressed requests total **79,731,456 bytes** (~76.0 MiB); graph arrays **210,664,708 bytes** (~200.9 MiB). Maximum explicit compressed + raw chunk staging **1,728,344 bytes** (~1.65 MiB). This excludes browser/internal decoder/WebCrypto allocations, metadata and GC delays; total peak heap/RSS is unmeasured. Localhost/cache results do not predict internet download time.

The match advanced during preparation; the short counter spanning preparation read **57 game / 60 render / 60 neural fps**. The ordinary interaction smoke read 60/60/60. Neither proves sustained mobile performance. Activity remains DummyBrain, not a simulation of the loaded network. Retry, cancel and unload passed real worker lifecycle checks. Ready-state screenshot inspected. See GRAPH_LOADING.md for budgets and reproduction.

## M3 headless integer LIF — 2026-09-12
Same measured topology: 166,700 nodes / 25,582,938 edges. All-positive source signs and constant index-based drive are artificial stress assumptions, not biological mappings. 120 timed ticks after warmup per workload; timings include trace hashing/counting. Reset replay agrees in each case.

| Workload | ms/tick | Spikes over 120 ticks | Traversed edges | Spike trace hash |
|---|---:|---:|---:|---:|
| Silent | 0.706 | 0 | 0 | 1552838989 |
| Drive every 100th neuron | 3.195 | 488,482 | 181,793,158 | 3852583875 |
| Drive every neuron | 12.069 | 6,668,000 | 1,023,317,520 | 88130405 |

Model-owned state: 3,167,300 bytes (19 bytes/neuron), in addition to borrowed CSR arrays. Post-run Node process RSS: 566,673,408 bytes; heapUsed: 40,621,208 bytes; arrayBuffers: 311,679,479 bytes. This snapshot includes the development TypeScript compiler, benchmark input and temporary file buffers; it is neither peak memory nor a browser measurement. Model ticks have no selected biological time unit. These timings do not establish a real-time neural budget.

Canonical verification exited 0: native 2/2, TypeScript 24/24, Python 14/14, production Chrome 10/10; 900-frame native/WASM replay and full artifact validation pass. Browser still uses DummyBrain. Reproduce via `node scripts/lif_bench.mjs` or `./scripts/verify.sh`.

## M3 browser worker LIF — 2026-09-12
Production Chrome, measured full graph, artificial all-positive signs. Three workloads each run 120 warmup, 120 measured and 120 reset-replay ticks. Timing surrounds model.step only; yields every four ticks and trace hashing are excluded from step timings.

| Drive | Mean ms/tick | p95 ms/tick | Spikes / 120 ticks | Trace hash |
|---|---:|---:|---:|---:|
| Silent | 0.326 | 0.4 | 0 | 1552838989 |
| Sparse | 4.507 | 5.9 | 488,482 | 3852583875 |
| Dense | 18.062 | 54.3 | 6,668,000 | 88130405 |

All traces equal the headless results. Match counter reported 60 game / 60 render / 60 neural-display fps during the experiment; the display still uses DummyBrain. This short observation does not establish sustained performance. Dense stepping exceeds a 16.7 ms budget and currently runs only as a bounded diagnostic, with no dropped model ticks or biological timestep assigned.

Model storage 3,167,300 bytes plus drive 666,800 bytes, beyond the loaded graph. These exact array counts exclude temporary signs, metadata, runtime and GC overhead; total browser heap/RSS remains unmeasured. Stop/rerun and unload during execution pass. UI screenshot inspected. Reproduce by loading connectivity then clicking Run neural benchmark, or via the production Chrome suite.

Final canonical rerun after UI copy updates exited 0 (51 tests total plus replay, full neural benchmark and artifact validation). Browser mean timings were 0.607/4.240/18.459 ms per tick; dense p95 55.4 ms, with identical trace hashes/counts. This run showed 60 game / 30 render / 30 neural-display fps during LIF, versus 60/60/60 previously; rendering varies and no sustained-FPS guarantee is made.

## M3 controlled comparisons — 2026-09-12
Full measured topology in production Chrome; 120 measured ticks per condition after reset, with independent warmup and reset replay. Artificial sparse drive targets 1,667 graph indices. All measured arrays remain unchanged.

| Condition | Total spikes | Spikes in ticks 60–119 | Hash | Mean ms/tick (focused run) |
|---|---:|---:|---:|---:|
| Sparse baseline | 488,482 | 288,677 | 3852583875 | 4.367 |
| Transmission off | 66,680 | 33,340 | 1323670589 | 0.634 |
| Alternating signs | 67,988 | 34,030 | 57726882 | 1.373 |
| Pulse then release | 394,003 | 240,944 | 2882626185 | 3.898 |

Transmission-off counts agree with the independent expectation: 1,667 driven cells firing 40 times in 120 ticks, with 20 spikes each in the last 60 ticks. Alternating index-block signs materially change the response. Positive-sign pulse activity persists after drive removal; this exposes sensitivity to the all-excitatory assumption, not biological memory or validated stability. A finite 120-tick window cannot establish long-term behavior.

Scheduling now yields after 8 ms or four ticks, checked after each tick; a single slow tick can exceed the budget. Prior throughput spike traces remain unchanged. Stop/restart, suite switching, analytical disconnected controls, invalid suite rejection and full-graph comparison tests pass in focused verification. Screenshot inspected.

Canonical verification completed with exit 0: 54 tests (native 2, TypeScript 26, Python 14, Chrome 12), native/WASM replay agreement, headless neural benchmark and full artifact validation. Controlled-condition spike counts and hashes reproduced.

## M3 long pulse sensitivity — 2026-09-12
Production Chrome full measured graph; 600 ticks per pass, ten-tick sparse pulse. Warmup, measurement and reset replay each restart at zero. Focused run results:

| Condition | Total spikes | Final 60 ticks | Last spike tick | Trace hash | Mean ms/tick |
|---|---:|---:|---:|---:|---:|
| Positive baseline | 2,318,764 | 240,591 | 599 | 3219849679 | 4.491 |
| Transmission off | 6,668 | 0 | 9 | 2815718209 | 0.575 |
| Stronger leak | 6,722 | 0 | 11 | 2978848227 | 0.606 |
| Alternating signs | 9,057 | 236 | 599 | 3652834096 | 0.746 |

Baseline consecutive 60-tick counts: 153059, 240944, 240443, 240136, 240998, 240089, 240835, 240673, 240996, 240591. Alternating-sign counts: 6923, 237, 236, 243, 236, 240, 233, 232, 241, 236. Transmission off and stronger leak have only their first bin nonzero. Baseline first 120 ticks reproduce the earlier pulse result exactly. All conditions reproduce their full trace after reset.

The positive-sign response persists throughout this window; halving voltage retention to 10/20 suppresses it after tick 11. Artificial alternating signs leave a much smaller persistent response. These show sensitivity to authored dynamics/signs. They do not validate a biological time constant, memory, or asymptotic stability, and no parameter is promoted to a biological default on this evidence.

Owned graph/model arrays and cancellation budget remain unchanged; bins add only small scalar diagnostics. Screenshot inspected; game continues while the worker runs.

Final canonical verification exited 0: 56 tests (native 2, TypeScript 27, Python 14, Chrome 13), 900-frame native/WASM replay agreement, full headless benchmark and artifact validation. Long-suite counts, bins and hashes reproduced exactly.

## M3 annotation mapping assay — 2026-09-12
Production Chrome, full graph, positive artificial signs, sequential 60 left-drive then 60 right-drive ticks. Input groups 4,589 / 4,612; output groups 656 / 648; ten midline outputs excluded. Readout pairs below are L/R spikes per neuron per tick, not biological Hz.

| Condition | Left-drive readout | Right-drive readout | Total spikes | Trace hash | Mean ms/tick |
|---|---|---|---:|---:|---:|
| Annotated | 0.139405 / 0.139403 | 0.154675 / 0.167618 | 661,883 | 322408360 | 5.147 |
| Transmission off | 0 / 0 | 0 / 0 | 184,020 | 388022309 | 0.472 |
| Shuffled membership | 0.022231 / 0.022042 | 0.027871 / 0.027675 | 689,193 | 630252901 | 5.358 |

Reset spike traces reproduce. The disconnected output is analytically zero because driven/readout groups are disjoint; its total spikes come from directly driven inputs. Shuffling changes both input and output membership while preserving sizes/disjointness. Similar left/right readouts during left drive do not show useful direction discrimination. Right drive starts from an evolved state, so stimulus order/carryover confounds preference. Independent-reset and counterbalanced trials are needed before any directional controller choice. Full-game control and anatomical activity overlay remain DummyBrain. Screenshot inspected.

Canonical annotation mapping verification exited 0: 63 tests (native 2, TypeScript 30, Python 17, Chrome 14), native/WASM replay, headless neural benchmark, full artifact validation and population report regeneration. Existing experimental traces remain unchanged.

## M3 independent lateral trials — 2026-09-12
Both stimuli start from reset; reverse-order replay reproduces each stimulus trace and normalized readout exactly. Same positive signs, populations and current amplitude as the sequential assay.

| Condition | Left-input L/R readout | Right-input L/R readout | Contrast | Left/right trace hashes |
|---|---|---|---:|---|
| Annotated | 0.139405 / 0.139403 | 0.132952 / 0.148277 | 0.015326709 | 1348478627 / 3786965343 |
| Transmission off | 0 / 0 | 0 / 0 | 0 | 601952421 / 3826655813 |
| Fixed shuffle | 0.022231 / 0.022042 | 0.022561 / 0.022325 | -0.000047363 | 2992661511 / 1233460176 |

Contrast is the change in right-minus-left readout between stimuli. The annotated left-input response is nearly equal on both output sides, so these data do not establish a robust bidirectional controller. One shuffle and one drive amplitude do not form a statistical null or validate generalization. Readout values are per-neuron/per-tick fractions, not biological Hz. All gameplay remains DummyBrain. Screenshot inspected; disconnected and analytical same-side fixture expectations pass.

Canonical independent-trial verification exited 0: 65 tests (native 2, TypeScript 31, Python 17, Chrome 15), native/WASM replay, headless neural benchmark, full artifact validation and population regeneration. A final display-only precision update shows contrast to six decimals; production TypeScript/build rechecked.

## M3 predeclared amplitude/shuffle sweep — 2026-09-12
All 15 conditions completed with reverse-order replay equality. Complete rows, metadata and local timing measurements are preserved in `data/male-cns-v1.0.mapping-sweep.json`.

| Current amplitude | Annotated contrast | Minimum shuffled contrast | Maximum shuffled contrast |
|---|---:|---:|---:|
| 250 | 0.009116230 | -0.000462649 | 0.000160281 |
| 500 | 0.011116130 | 0.000002823 | 0.000431283 |
| 1000 | 0.015326709 | -0.000047363 | 0.000659942 |

Seeds 20260912, 20260913 and 20260914 were fixed before running and reused at every amplitude. Disconnected readouts are zero at every amplitude; earlier amplitude-1000 stimulus hashes reproduce. These three shuffles provide descriptive controls only, not significance or independent biological trials.

Annotated right-minus-left readout under left input is +0.002107485 at 250, +0.000951332 at 500 and approximately -0.000002196 at 1000. Thus the positive contrast does not imply reliable bidirectional movement via a simple raw difference decoder. No controller calibration or biological parameter selection is made. A live diagnostic view can expose model-derived activity next while gameplay remains explicitly dummy-controlled. Screenshot inspected.

Canonical sweep verification exited 0: 68 tests (native 2, TypeScript 33, Python 17, Chrome 16), native/WASM replay, headless benchmark, full graph validation and population regeneration. All 15 saved trace hashes, readouts, counts and contrasts match the canonical rerun exactly; timing values remain machine/run-specific.

## M3 model-derived diagnostic view — 2026-09-12
A lazy second renderer displays measured somas driven by actual full-population LIF spike bytes. Bounded 120-tick sequential mapped stimulus reproduces trace **322408360**, matching the existing mapped assay; no rendering values feed back into the model. Focused Chrome reset/clear/unload checks pass and screenshot is inspected.

Each transferred activity frame contains 166,700 bytes plus scalar metadata. UI requests the next frame only after response and a 34 ms delay; at most one request is outstanding. Thus playback is at most 30 model ticks/sec and slows under load, with no skipped model ticks. This is a visualization pace, not a biological time unit. Final model tick has 4,537 spiking graph nodes in the inspected run; display includes only positioned neurons. Glow decay is presentation-only. The graph remains worker-owned; model is released after completion, and the explicit final tick remains displayed until reset/clear/unload. Additional rendering and activity-buffer memory are outside the earlier model/input memory counts.

## Neural game closed loop — 2026-09-13
`node scripts/neural_replay.mjs` now runs the full verified graph with WASM game observations and exact neural motor outputs for 600 frames. Reset reproduces every game hash and spike/motor byte; native replay matches all generated game hashes. Final game hash 114741712, 3,435,783 spikes, 599 frames with motor input. Local combined model/game time: 4.05 ms/frame (single measurement; no cross-device guarantee). See NEURAL_GAMEPLAY.md for trace digest and authored assumptions. No control-quality or biological validity claim follows from determinism.

These closed-loop results were refreshed after the source-informed short-hop/launch refinement and the 18-field fighter hash layout on 2026-09-13. Older neural traces depend on the previous game trajectories.

## Independent scalar batches — 2026-09-13
`./build/batch_bench` measures 1,048,576 aggregate game frames at each requested batch size. Each size has one warmup and three timed repeats, checking identical full-run checksums and episode reset counts. Timings include scripted inputs, independent episode resets, game steps and per-frame hashes; construction is excluded. This is a single CPU thread and excludes neural models, rendering, scheduling and training. It establishes a scalar baseline, not parallel neural throughput. Raw results and platform metadata: data/batch-benchmark.json.

| Independent games | Aggregate frames/s | Frames/s per game | 60 Hz multiple per game |
|---:|---:|---:|---:|
| 1 | 8,205,730 | 8,205,730 | 136,762 |
| 16 | 7,928,510 | 495,532 | 8,259 |
| 64 | 7,908,380 | 123,568 | 2,059 |
| 256 | 7,951,580 | 31,061 | 518 |
| 1,024 | 7,878,380 | 7,694 | 128 |

The 1,024-game state storage is 159,744 bytes, plus 16,384 bytes of controller inputs; this excludes allocator/runtime overhead and any neural model. Local values are descriptive measurements, not performance gates or cross-device promises. The scalar game core is already much faster than the full-connectome controller; these measurements do not justify adding SIMD, threads, Metal or WebGPU yet.

`batch_tests` compares every frame of every lane to separately stepped scalar games for 240 ticks at all five sizes, including reverse iteration and isolated reset. Wrong input sizes fail before any game advances. The API preserves terminal-state behavior from game_step. No game rules change for batching.

## Controller V2 behavior and cost
The full-graph stable rate model measured 17.46 ms per integration in six-stimulus calibration. Production integrates at 30 Hz with 60 Hz game frames. The timing-corrected stationary-opponent regression improves damage from the V1 value of 0 to 32, reduces jump requests from 13 to 0 and fastfall frames from 581 to 0, and preserves all Fly stocks. Reversal without reset ends at axis 999.9/1000. Full raw evidence: data/controller-behavior.json and data/rate-calibration.json. This is an authored sensor/calibrated readout improvement, not learned Melee skill or biological validation. Earlier LIF and neural-game timings describe V1 and remain historical baselines.

## Neural scaling profile — 2026-09-14
`node scripts/neural_scaling.mjs` measures induced CSR-prefix LIF cost at 1/64, 1/16, 1/4, 1/2 and full retained nodes, plus 1/2/4 sequential SparseLif replicas sharing one ~50% prefix, and one full-graph WASM rate sparse-drive probe. Warmup 8 + measure 40 ticks; all-positive signs and index-strided drive remain MODEL_ASSUMPTION. Deterministic spike/edge hashes and memory accounting are retained in `data/neural-scaling.json`; `./scripts/verify.sh` runs `--check` on that section only. Wall times below are one local host snapshot, not gates.

| Prefix nodes | Silent ms/tick | Sparse ms/tick | Dense ms/tick |
|---:|---:|---:|---:|
| 2,604 | 0.056 | 0.069 | 0.153 |
| 10,418 | 0.022 | 0.085 | 0.593 |
| 41,675 | 0.087 | 0.400 | 2.708 |
| 83,350 | 0.169 | 0.725 | 5.942 |
| 166,700 | 0.363 | 2.306 | 13.224 |

| Shared-CSR LIF replicas (~50% prefix, sparse) | Wall ms / tick (all replicas) |
|---:|---:|
| 1 | 0.726 |
| 2 | 1.387 |
| 4 | 2.717 |

Full-graph WASM rate sparse drive measured 5.887 ms/tick in the same run. Four replicas on a shared ~50% CSR need ~98.7 MiB accounted bytes versus ~375.7 MiB if each copy owned the CSR. Sequential wall time still scales roughly with replica count, so graph sharing saves memory, not CPU work.

**Decision:** do not add shared-graph batches, worker threads, SIMD or GPU for the shipped single-match browser path. Neural integration—not `GameBatch`—is the limiter; one Fly controller does not justify SharedArrayBuffer / WebGPU complexity. Shared-graph batches remain relevant only for multi-environment research/training. Prefix slices are engineering cuts, not biological modules. Implementation-only browser cuts (transferable worker frames, pack-once-per-model-step, sparse WASM input writes, log LUT / dirty GL upload, throttled motor/sensory React bars) leave dynamics and packing semantics unchanged.

## Interactive presentation and scheduler budget — 2026-09-18
All interactive profiles retain the 2× canvas backing-store cap. Desktop game drawing follows rAF; narrow (≤720 CSS px) or coarse-pointer clients cap the game canvas at 30 draws/sec. The independent 139,662-soma canvas draws at 30 Hz on capable desktops and 15 Hz on phones or ≤4-core clients; React HUD/signals publish at 10 Hz. The game still targets deterministic 60 Hz frames and V2 still integrates at 30 Hz; presentation does not change either state. A 390×844 Chrome regression confirms profile selection, layout, spurious-blur immunity and automatic resume after a visibility pause. This is not a physical-phone throughput measurement.

The former scheduler discarded all time spent awaiting the worker and then required another complete 16.7 ms pacing interval. It now counts worker latency toward the current frame while capping retained debt at one frame, eliminating that artificial idle period without catch-up bursts or skipped frames. Activity transfers also omit the unchanged 166,700-byte array on held model frames. In an isolated production-Chrome stationary-combat run on this host, the prior code reported 37–38 game fps; the corrected scheduler passed the same gate at **50 game / 60 render / 25 neural fps**. The final 29/29 production-Chrome suite recorded **53 / 60 / 27** in its combat case. These are run-specific host results, not a sustained low-end or physical-phone guarantee.
