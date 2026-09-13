# Connectome provenance and modeling boundary

Current controller update: V2 uses normalized positive rate propagation and an artificial-stimulus-calibrated readout. It retains the measured graph but replaces the poorly selective all-positive LIF gameplay baseline. See NEURAL_GAMEPLAY.md. Older milestone sections below are historical.


## Current runtime — 2026-09-13
Default gameplay now loads measured connectivity automatically in `male_cns.worker.ts`, runs MaleCNSBrain, and shows the exact model spikes and decoded controls used by Fly. Dynamics, positive signs, stimulation, action partitions and scaling are authored assumptions. See [NEURAL_GAMEPLAY.md](NEURAL_GAMEPLAY.md) for the complete interface, state ownership and validation. The synthetic controller and optional diagnostics remain on `?controller=dummy`. Earlier milestone descriptions below record their implementation history; statements about DummyBrain apply to that explicit demo route now.


## Status — 2026-09-11
The offline MaleCNS v1.0 preprocessing step is implemented and has processed the real official files. The game now displays measured soma geometry, but still uses DummyBrain and synthetic activity. **No connectome-driven behavior is claimed.** Full worker connectivity loading is implemented; browser neural dynamics integration remains unfinished.

Official sources: [download page](https://male-cns.janelia.org/download/) and [release notes](https://male-cns.janelia.org/release/). v1.0 is the targeted current release (June 8, 2026). No female FlyWire data substituted. No EM, synapse-point, synapse-partner, or skeleton bulk downloads.

## Exact inputs and locks
Downloaded from the official `flyem-male-cns/v1.0/connectome-data/flat-connectome/` bucket:

| File | Bytes |
|---|---:|
| body-annotations-male-cns-v1.0-minconf-0.5.feather | 14,483,314 |
| body-neurotransmitters-male-cns-v1.0.feather | 43,282,834 |
| connectome-weights-male-cns-v1.0-minconf-0.5.feather | 1,051,241,946 |

Exact URLs, sizes, and SHA-256 digests are in `data/male-cns-v1.0.sources.json`. Digests were calculated from our first HTTPS acquisition; they are not publisher-signed checksums. Future downloads/imports must match this lock. Raw inputs are ignored under `data/raw/`.

## Actual processed counts
All numbers below come from the generated manifest, not estimates or values copied from another project.

| Quantity | Count |
|---|---:|
| Source annotation rows (includes non-neuronal/unresolved objects) | 211,577 |
| Retained annotated neuronal entries | 166,700 |
| Excluded explicit glia | 11,864 |
| Excluded entries without superclass (after glia exclusion) | 33,013 |
| Retained neurons with measured soma coordinates | 139,662 |
| Retained neurons without soma coordinates | 27,038 |
| Source directed edge rows | 151,856,684 |
| Retained directed edges | 25,582,938 |
| Excluded edge rows | 126,273,746 |
| Source synaptic contacts (sum of weights) | 311,833,243 |
| Retained synaptic contacts | 124,177,617 |
| Excluded synaptic contacts | 187,655,626 |
| Coalesced duplicate retained edge rows | 0 |
| Retained neurons without an NT-table match | 178 |

The retained count is a documented operational selection, not a claim about the total number of biological neurons in the animal. Explicitly retain assigned nonempty superclasses, including uncertain `tbc` annotations; exclude `status == Glia`. No restriction to `Traced`, known type, position availability, neurotransmitter availability, or selected motor/sensory classes. All released positive integer edges whose endpoints survive are retained, including autapses and weight-one edges. No additional synapse-confidence/weight threshold beyond the released minconf-0.5 files. Code supports summing duplicate pairs; the real source required no coalescing. Every excluded row/contact is counted.

## Metadata and coordinates
Preserved dictionary-coded annotations: superclass, class, subclass, type, status, statusLabel, somaSide, rootSide, somaNeuromere. Preserved NT fields: consensus_nt, predicted_nt, ground_truth. They remain distinct; unknown is code 0 and is never inferred to be excitatory from metadata. The gameplay model explicitly overrides every source sign to +1 as an artificial policy. `consensus_nt` includes 2,999 unclear entries and 178 unmatched/unknown entries. We do not infer receptor identity or signed currents from these labels.

Coordinates come solely from annotation `somaLocation`. Each rendered candidate point corresponds to a measured soma location. `tosomaLocation` is deliberately not substituted. Missing-position neurons remain in the graph and have no visual point. `visual_indices` maps point indices to graph indices and `neuron_ids` stores exact uint64 source IDs.

Original coordinates are retained alongside normalized float32 display coordinates. Native annotation physical units have not been independently verified, so there is no micrometer/nanometer scale claim. Normalization subtracts `[48068, 36877, 72342.5]`, divides all axes by `73162.94117647059`, reorders X/Z/Y and negates the vertical source-Z coordinate. Manifest stores bounds, center, scale, axis order and signs; the validator reconstructs the transform and checks the result. This is a soma point cloud, not reconstructed neurites, synapse locations, or a complete neuropil surface. Desktop/mobile browser screenshots were inspected on 2026-09-12: brain somas appear above VNC somas. This checks presentation, not anatomical registration against an independent atlas. No artificial connecting neurites are drawn.

## Artifact and pipeline
Implementation: `brain/preprocess/sources.py`, `build_connectome.py`, `validate_artifact.py`. Developer dependencies are pinned in `requirements.txt`; nothing is installed by players.

Output: `data/generated/manifest.json` plus little-endian binary arrays (format `MALECNS_CSR_V2`):
- uint64 neuron_ids, sorted and unique;
- uint32 CSR row_offsets, target_indices, positive measured weights;
- float32 source_positions and normalized positions for the positioned subset;
- uint32 visual_indices mapping those points to the full graph;
- uint32 per-neuron annotation codes with JSON string dictionaries.

Weights preserve synaptic contact counts, without normalization or excitatory/inhibitory signs. CSR is presynaptic row → postsynaptic target, sorted by target within each row. The importer streams Arrow record batches, spills retained edge columns, then sorts/coalesces retained edges; source graph rows are never all converted to Python objects. Output creation refuses to overwrite an existing artifact. Validation runs before publishing the generated output directory.

Each binary and the annotation dictionary has SHA-256 metadata. The manifest includes exact source registry, counts, exclusions, policies, coordinate transform and attribution. A compact checked-in report is at `data/male-cns-v1.0.report.json`; generated binaries are ignored. Actual output is 218,702,759 bytes (~208.6 MiB). This offline artifact is packaged into lossless gzip chunks for optional browser loading, with explicit transport and allocation budgets (GRAPH_LOADING.md).

## Reproduce
```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r brain/preprocess/requirements.txt
.venv/bin/python brain/preprocess/sources.py
.venv/bin/python brain/preprocess/build_connectome.py
.venv/bin/python brain/preprocess/validate_artifact.py
./scripts/verify.sh
```

The checked-in source lock is used by default. `--record-lock` is only for a deliberate first acquisition, never silently changing existing expected hashes. Use `--output data/generated-next` for a non-destructive rebuild; compare array hashes. The default validator checks `data/generated`. A clean checkout requires the graph download only for preprocessing; verification always runs fixture tests and validates the full artifact when present. It never downloads data automatically.

## Verification
Twelve Python tests cover the earlier V1 contract and the real V2 importer: exact IDs, missing metadata/coordinates, retention accounting, directed sparse graph construction, duplicate pair summation, overflow, empty edges, corrupt source lock, malformed arrays, and repeated-build array checksum equality on controlled fixtures. The real generated graph passed checksum, CSR ordering/range, dictionary, spatial transform and node/edge/contact loss-accounting validation. Real-graph biological correctness and neural dynamics are not established by these structural checks.

## Measured vs modeled
Measured/reconstructed: identities, soma positions, connectivity, synapse-derived weights and annotations. NT classifications are predictions/curated labels as represented in the source fields. Modeled (future): membrane dynamics, thresholds, time constants, synaptic sign/dynamics, sensory mapping, motor decoding, plasticity and rewards. A connectome is not an executable biological brain.

Current browser: rule-based DummyBrain, measured soma geometry when successfully loaded (visible synthetic fallback on error), synthetic activity. The displayed motor channels still decode to the actual Fly input. Rendering persistence never feeds back into control. Data preprocessing does not change gameplay.

No sensory or motor populations have been assigned game semantics. Annotation availability includes 1,314 `descending_neuron` and 708 `vnc_motor` entries, along with several sensory classes (full distribution in the report); these labels alone do not justify mapping them to attack, left/right, or jump. Future mappings must be labeled MODEL_ASSUMPTION and tested with controls. Deterministic sparse LIF and population selection remain milestone 3; no plasticity is implemented.

## DoomFly review
Inspected [DoomFly snapshot](https://github.com/nftechie/doomfly/tree/71ecf53d78eaffaf1a57ed7b0ccf5d458abc9f33), README, doom/connectome.py, doom/engine.py and repository validation layout. Ingestion uses exact IDs, explicit retention/exclusion accounting and source hashes. Its simulation and fixed sensory/motor interfaces add assumptions; experimental dopamine-gated plasticity is not measured learning. Its README explicitly reports failed validation gates for the current candidate. Preserve that distinction.

Useful ideas: loss-accounted preprocessing, separate measured graph/model configuration, controlled ablations and validation reports. Different choices here: compact browser artifact, worker execution, bounded transfer rate, no Python/Doom server for normal play, no initial plasticity. A game-state encoder is a speculative interface, not its retinal model. We did not copy implementation or reported neuron counts into this app.

No reference image attachment was available in this session; the brief's textual brain-above/VNC-below description guides the clearly labeled placeholder.

## Browser geometry integration — 2026-09-12
`package_geometry.py` exports only positions and visual_indices, with content-hashed filenames and a compact `MALECNS_GEOMETRY_V1` manifest. These small browser assets are versioned in web/public/connectome; the full source graph remains ignored; a separate ignored transport package supports optional worker preparation. Two arrays total 2,234,592 bytes, before HTTP compression.

The TypeScript loader checks release/format, counts, size/dtype, SHA-256, finite coordinates and sorted bounded mapping indices. Failures fall back with explicit visible provenance. The measured soma count, total graph population, missing-position count and offline connection count all originate in the package, never UI literals.

DummyBrain now produces a manifest-sized full-population activity vector (166,700 model nodes). The renderer uses visual_indices to display only the 139,662 positioned entries. The active model-node count includes unpositioned entries and is labeled accordingly. Synthetic activity assignments by index have no biological meaning; anatomical geometry must not be mistaken for neural dynamics. Motor outputs remain the same values decoded into Fly controls. Reset clears display persistence.

Tests now include measured loading, integrity failures, visual-to-graph mapping, runtime count negotiation, packaging exclusion of the graph, production geometry presence, no full graph requests at page startup, and playable corrupt-data fallback. The existing gameplay, WASM/worker failure and Canvas fallback tests still pass with the larger geometry.

## Worker connectivity preparation — 2026-09-12
The on-demand loader preserves all retained nodes, edges, measured positive synaptic counts and six annotation columns. Exact IDs tie its graph to the soma mapping. Per-chunk integrity and structural validation precede readiness. The separate worker retains 200.9 MiB of arrays and never changes DummyBrain. Cancel/unload terminate it; retry handles failed downloads. No neural activity or biological mapping is inferred from successful data loading.

## Deterministic neural core — 2026-09-12
A standalone integer sparse LIF core now runs against the retained CSR with explicit authored parameters and a separate required sign vector. Fixture tests and headless full-topology stress benchmarks are implemented. It does not yet run in the browser worker or drive activity/gameplay. Biological sign assignment, sensory/motor mapping and calibration remain unfinished. See NEURAL_MODEL.md.

### Browser neural experiment — 2026-09-12
The graph worker now supports an optional bounded LIF benchmark with artificial all-positive signs and index-based drive. Stop cooperatively cancels it while retaining connectivity; unload terminates the worker. Only scalar timings/progress/results reach the UI. Reset-replay traces match the headless core. The anatomy overlay and Fly controller still use DummyBrain. See NEURAL_MODEL.md for ownership, timing and interpretation limits.

The neural experiment now includes **Controlled comparisons**: sparse baseline, transmission disabled, artificial alternating signs, and a pulse followed by input removal. Each resets independently and reports total/late spikes with replay validation. Select the suite after loading connectivity. These are modeling controls, not biological population assignments; see [NEURAL_MODEL.md](NEURAL_MODEL.md).

**Long pulse sensitivity** now follows a 10-tick artificial pulse for 600 ticks, comparing baseline, disabled transmission, stronger leak and alternating signs. It reports 60-tick bins and the last observed spike, with independent reset replay. These finite-window measurements do not establish biological memory or stability.

## Annotation candidate audit
Exact sensory, visual-projection, descending and VNC-motor memberships are now generated with source hashes, graph indices, decimal-string IDs and coverage/distribution reports. No game mapping or sign inference is assigned. See [POPULATIONS.md](POPULATIONS.md).

## Experimental annotation mapping
The worker now offers **Annotation mapping**: artificial sequential left/right visual-projection drive and normalized descending-neuron readout, with transmission-off and fixed-seed shuffled-membership controls. Exact side predicates and unknown/midline exclusions are explicit. Outputs do not control the Fly. See [POPULATION_MAPPING.md](POPULATION_MAPPING.md).

**Independent lateral trials** now remove stimulus carryover by resetting before each input, then repeat in reverse order and compare stimulus-specific traces/readouts. Results include descriptive directional contrast, with disconnected and shuffled controls. This does not enable model-driven gameplay or establish biological control.

**Amplitude and shuffle sweep** adds three predeclared drive strengths and three fixed membership seeds, retaining all annotated/disconnected/shuffled outcomes. Independent resets and reverse-order replay remain mandatory. This is a descriptive sensitivity assay, not calibrated gameplay control or statistical validation.

## Model-derived spike view
After loading connectivity, **Start spike diagnostic** shows actual LIF spikes over measured somas in a separate panel. Reset/Clear/Unload manage its lifecycle; the bounded run uses artificial mapped drive. The upper anatomy view and Fly controls remain DummyBrain. See [NEURAL_DIAGNOSTIC.md](NEURAL_DIAGNOSTIC.md).
