# Measured soma display evidence — 2026-09-13

Reproduce with `node scripts/activity_evidence.mjs` after generating the checked graph and WASM. Exact samples are in `data/activity-evidence.json`. The script runs the actual V2 controller in a 600-frame stationary-Fox duel and records the first approach/attack after ticks 10 and 120, before applying inputs. No artificial activation is injected for this assay.

| Sample (game/model tick) | All active nodes | Brain active fraction | Brain mean / p95 byte | VNC active fraction | VNC mean / p95 byte |
| --- | ---: | ---: | ---: | ---: | ---: |
| Approach 10/6 | 46,804 | 36.85% | 1.513 / 4 | 3.46% | 0.037 / 0 |
| Attack 32/17 | 90,067 | 67.02% | 2.321 / 7 | 25.21% | 0.268 / 1 |
| Approach 120/61 | 132,211 | 92.18% | 3.837 / 10 | 34.58% | 0.397 / 1 |
| Attack 140/71 | 140,747 | 93.91% | 3.332 / 9 | 53.08% | 0.654 / 2 |

Fractions, means and nearest-rank p95 include **all positioned nodes in each cloud**, including zeros: 124,295 upper brain/head, 15,367 lower VNC. This is an operational geometry split at normalized y=0.34 in the gap between clouds, not an annotation-based anatomical classification. `somaNeuromere` is absent for 118,359 positioned nodes, so using only that annotation would omit most of the brain. Full-model counts include unpositioned neurons; they need not match the cloud counts. These selected snapshots are not match-wide averages.

## Diagnosis

Packing remains `min(255, round(rate/128))`. “Active” means byte > 0 (raw rate >= 64); the propagation cutoff is independently 32. A large active count can therefore consist mostly of bytes 1–10, only 0.4–3.9% of the old linear color/size mix. The old renderer also multiplied bytes by 0.9 and floored them on each render, erasing byte 1 immediately, and used peak persistence on ingestion. That is unsuitable for continuous V2 rates and makes appearance depend on rendering cadence. Canvas additionally treated bytes <= 51 as inactive color.

V2 directly drives only 9,201 visual_projection nodes (9,162 positioned), with six cyclic authored partitions. Readout consumes 1,314 descending_neuron and 708 vnc_motor nodes (1,308 and 703 positioned). Readout observes rates; it does not inject activity. Most cord nodes are neither directly driven nor read out. Weak incoming coupling, decay and the source >= 32 cutoff explain weak VNC activation; the measured nonzero VNC samples disprove a completely unused cord.

Missing positions are especially severe for selected exact sensory classes: vnc_sensory 2/6,370 positioned, cb_sensory 0/4,868, ol_sensory 28/6,098. These nodes remain in the graph. The current V2 mapping does not directly stimulate them.

## Display change and boundaries

Default V2 now holds the latest packed frame exactly, including zeros and during pause. A fixed log display uses `log(1+byte)/log(256)` for color/size; an explicit linear option uses `byte/255`. Zero remains zero, byte 1 maps to display byte 32, byte 16 to 130, byte 255 to 255. The scale is fixed across time and populations, with no adaptive percentile boost or fabricated baseline. UI explains the formula, active-count threshold, unpositioned nodes, and V2 drive/readout limitations, and labels values as model activity, not spikes. WebGL and Canvas share the scale and continuous color interpolation. Dummy and LIF diagnostic temporal persistence remain separate.

No controller equations, sensory populations, calibration, game behavior or biological claims changed. Adding VNC sensory drive would be a separate authored model experiment requiring recalibration and behavior tests; it is not justified as a cosmetic remedy.

Tests cover fixed-scale endpoints/order, mapping with unpositioned nodes, exact replacement/zero clearing, the packing/count threshold, and a Chrome paused-canvas pixel comparison that verifies no fading and reversible log/linear selection. The evidence script is included in canonical verification.

## Optional controller population view

The unchecked-by-default “Highlight drive & readout populations” control switches from activity to static controller membership. Blue marks the exact visual_projection input population; orange marks the exact descending_neuron + vnc_motor readout. Both are selected by the existing rateMapping function, not anatomical proximity, current activation, or broader sensory/tbc annotations. Other somas remain visible as context. Selected points render after background anatomy so ordering cannot hide the highlighted subset. The caption and legend say membership, not activity; the activity-scale selector is disabled in this view. Returning to activity restores the current model frame.

Counts are derived from the full graph role array through the verified visual_indices mapping: drive 9,162 positioned / 9,201 total (39 unpositioned); readout 2,011 / 2,022 (11 unpositioned). Unpositioned members are counted but never assigned invented coordinates. Membership stays the same before play, during play, and after reset. Readout membership does not imply external drive, and these colors do not claim biological function. Dynamics and calibration remain unchanged.

The worker sends a single transferable 166,700-byte membership array after graph initialization; no graph edges or annotation dictionaries are exposed to the UI. The renderer keeps 139,662 mapped role bytes and a corresponding WebGL attribute; population membership never overwrites activity bytes. Unit fixtures check exact selection/exclusions, visual mapping and missing-position conservation. Chrome checks both WebGL and mobile Canvas for coverage counts, zero-activity highlighting, reversibility, and unchanged membership pixels across gameplay/reset.

Validation: `./scripts/verify.sh` exited 0 after this local change (native 5, TypeScript 45, Python 17, Chrome 24). Full-graph 600-frame activity/motor hash remains `183646e75b67bac3239615fbd9ee7c9233bb4d08fad5e201678c8eebf0049198`. Final desktop and mobile population screenshots reviewed. Not published.
