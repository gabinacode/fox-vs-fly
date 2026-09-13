# Fox vs Fly

**Can you beat a fruit fly brain at Melee?**

The default game runs a neural controller over the measured MaleCNS v1.0 graph: 166,700 neurons and 25,582,938 directed connections. Actual model spikes drive Fly controls and the measured-soma activity view. **Dynamics, all-positive transmission and sensory/action mappings are authored assumptions, not validated fly behavior.** Original fighters and a deterministic C++/WASM game require no player installation. No Nintendo assets are included. See [neural gameplay](docs/NEURAL_GAMEPLAY.md).

## Play
Open the locally running [game](http://127.0.0.1:5173/) in Chrome and wait for automatic graph preparation, then click **PLAY**. The initial graph download is about 76 MiB.
- A / D: move; W: tap for a short hop, hold through takeoff for a full jump; release and press again in air to double jump.
- S: fastfall while descending. J: attack (release and press for each attack).
- R: reset. Escape: pause. Leaving the tab pauses; click Resume to continue.
- Three stocks, one stage. Knock opponents past the blast boundaries.

Players install nothing. A deployed copy requires only its static assets. This session does not publish a public URL.

## Developer setup
Requires CMake 3.20+, C++17 compiler, Node 22.12+ / npm, Python 3, Emscripten 4.0.15, and Chrome for browser tests. These are developer tools only.

```sh
npm --prefix web ci
python3 -m venv .venv
.venv/bin/python -m pip install -r brain/preprocess/requirements.txt
# Source your Emscripten SDK environment, or set EMSDK=/path/to/emsdk.
./scripts/build_wasm.sh
./scripts/verify.sh
npm --prefix web run dev -- --port 5173 --strictPort
```

The initial session SDK was installed at `/tmp/melee-fly-refs/emsdk`. It is temporary; if removed, install a persistent SDK from the official emscripten-core/emsdk repository: `./emsdk install 4.0.15`, `./emsdk activate 4.0.15`, then source `emsdk_env.sh`. No shell startup files are modified.

`PLAYWRIGHT_CHANNEL=chromium` can select an installed Playwright Chromium instead of Chrome. The canonical check uses a dedicated temporary production server at port 42873 and shuts it down afterward. The dev server is separate.

## Build / publish static assets
`./scripts/build_wasm.sh` then `npm --prefix web run build` (which packages or verifies measured geometry and connectivity) produces **web/dist**, including WASM and worker. Upload the entire directory to an ordinary static HTTP(S) host. Serve `.wasm` as `application/wasm` and JS as JavaScript. Relative asset URLs support deployment under a subpath. No server process, account, SharedArrayBuffer, WebGPU, scientific download, or external CDN is needed by the game. `file://` is unsupported. Hard-refresh clients when changing builds; do not cache index.html permanently.

## Verify
`./scripts/verify.sh` fails on any error. It builds native code, runs gameplay/replay tests, brain/controller tests and real-data importer/compact-graph validator fixture tests, builds WASM and production frontend, compares 900 native/WASM per-frame hashes, runs Chrome interaction/fallback/error/responsive tests, benchmarks native simulation and validates a real graph artifact if present. An absent real dataset is explicitly reported, never presented as scientific validation.

Native programs: `./build/batch_bench` (1/16/64/256/1024 independent scalar games, neural model excluded), `./build/sim_tests`, `./build/sim_replay sim/tests/fixtures/duel.inputs`, `./build/sim_bench`. Fixture format: `seed frame_count`, followed by `fox_axis fox_buttons fly_axis fly_buttons` per frame; axes -1000..1000; jump=1, fastfall=2, attack=4. Every exported state field is hashed in a defined little-endian order, excluding padding. The simulation uses authored integer physics and never reads wall time.

## Research and continuity
Read [architecture](docs/ARCHITECTURE.md), [Melee evidence](docs/MELEE_PORT.md), [scientific provenance](docs/FLY_CONNECTOME.md), [progress](docs/PROGRESS.md) and [benchmarks](docs/BENCHMARKS.md). Future agents must read AGENTS.md and update PROGRESS.md.

References: [Melee decomp](https://github.com/doldecomp/melee), [MaleCNS](https://male-cns.janelia.org/), [DoomFly](https://github.com/nftechie/doomfly), [HAL](https://github.com/ericyuegu/hal). Pinned source snapshots and inspected functions are recorded in the docs. No reference repository is a runtime dependency.

## Measured anatomy in the browser
The checked-in browser package under web/public/connectome contains 139,662 normalized measured soma positions and their indices into the 166,700-node retained graph. These two binary assets total 2,234,592 bytes. Their manifest carries source coverage and attribution; full connectivity is packaged separately and loaded automatically by the default neural controller. Build regenerates the package when data/generated exists, otherwise verifies and reuses it. A production build also requires data/generated or a restored web/public/connectome-graph package; see data/README.md for preprocessing. Players need no source downloads.

The browser verifies asset lengths, SHA-256 and mapping bounds before rendering. The renderer maps full-population model spikes to positioned neurons. Missing/corrupt geometry disables the default neural game; only the explicit synthetic demo may use a visibly labeled geometry fallback.

## Optional network preparation
On the explicit `?controller=dummy` research/demo route, click **Load connectivity** below the match to load all 166,700 neurons and 25,582,938 directed edges into a separate worker. The 76.0 MiB compressed transport becomes 200.9 MiB of graph arrays. Progress, cancellation, retry and unload are available; gameplay continues. This prepares measured data only: activity and Fly control remain synthetic. See [transport design](docs/GRAPH_LOADING.md).

## Neural core development
The deterministic sparse LIF core and its assumptions are documented in [NEURAL_MODEL.md](docs/NEURAL_MODEL.md). Run `node scripts/lif_bench.mjs` for checksum-verified full-topology headless stress workloads (requires data/generated). The same core drives default browser activity and Fly controls through MaleCNSBrain.

After **Load connectivity**, click **Run neural benchmark** to profile silent, sparse and dense artificial stimulation in your browser. **Stop experiment** keeps connectivity loaded; **Unload network** releases the worker. Results include reset replay, per-tick timings and model-array memory. Gameplay and the anatomy overlay still use DummyBrain.

The neural experiment now includes **Controlled comparisons**: sparse baseline, transmission disabled, artificial alternating signs, and a pulse followed by input removal. Each resets independently and reports total/late spikes with replay validation. Select the suite after loading connectivity. These are modeling controls, not biological population assignments; see [NEURAL_MODEL.md](docs/NEURAL_MODEL.md).

**Long pulse sensitivity** now follows a 10-tick artificial pulse for 600 ticks, comparing baseline, disabled transmission, stronger leak and alternating signs. It reports 60-tick bins and the last observed spike, with independent reset replay. These finite-window measurements do not establish biological memory or stability.

## Annotation candidate audit
Exact sensory, visual-projection, descending and VNC-motor memberships are now generated with source hashes, graph indices, decimal-string IDs and coverage/distribution reports. No game mapping or sign inference is assigned. See [POPULATIONS.md](docs/POPULATIONS.md).

## Experimental annotation mapping
The worker now offers **Annotation mapping**: artificial sequential left/right visual-projection drive and normalized descending-neuron readout, with transmission-off and fixed-seed shuffled-membership controls. Exact side predicates and unknown/midline exclusions are explicit. Outputs do not control the Fly. See [POPULATION_MAPPING.md](docs/POPULATION_MAPPING.md).

**Independent lateral trials** now remove stimulus carryover by resetting before each input, then repeat in reverse order and compare stimulus-specific traces/readouts. Results include descriptive directional contrast, with disconnected and shuffled controls. This does not enable model-driven gameplay or establish biological control.

**Amplitude and shuffle sweep** adds three predeclared drive strengths and three fixed membership seeds, retaining all annotated/disconnected/shuffled outcomes. Independent resets and reverse-order replay remain mandatory. This is a descriptive sensitivity assay, not calibrated gameplay control or statistical validation.

## Model-derived spike view
After loading connectivity, **Start spike diagnostic** shows actual LIF spikes over measured somas in a separate panel. Reset/Clear/Unload manage its lifecycle; the bounded run uses artificial mapped drive. The upper anatomy view and Fly controls remain DummyBrain. See [NEURAL_DIAGNOSTIC.md](docs/NEURAL_DIAGNOSTIC.md).

Default gameplay uses [MaleCNSBrain](docs/NEURAL_GAMEPLAY.md); the optional research diagnostics above are isolated from its live controller.
