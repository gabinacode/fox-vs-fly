# Measured soma display evidence — 2026-09-13

Reproduce with `node scripts/activity_evidence.mjs` after generating the checked graph and WASM. Exact samples are in `data/activity-evidence.json`. The script runs the actual V2 controller in a 600-frame stationary-Fox duel and records the first approach/attack after ticks 10 and 120, before applying inputs. No artificial activation is injected for this assay.

| Sample (game/model tick) | All active nodes | Brain active fraction | Brain mean / p95 byte | VNC active fraction | VNC mean / p95 byte |
| --- | ---: | ---: | ---: | ---: | ---: |
| Approach 10/6 | 46,804 | 36.85% | 1.513 / 4 | 3.46% | 0.037 / 0 |
| Attack 24/13 | 82,363 | 61.97% | 3.084 / 8 | 21.04% | 0.225 / 1 |
| Attack 122/62 | 129,323 | 90.76% | 2.427 / 5 | 33.85% | 0.372 / 1 |
| Approach 188/95 | 72,006 | 53.68% | 1.219 / 2 | 14.50% | 0.145 / 1 |

Fractions, means and nearest-rank p95 include **all positioned nodes in each cloud**, including zeros: 124,295 upper brain/head, 15,367 lower VNC. This is an operational geometry split at normalized y=0.34 in the gap between clouds, not an annotation-based anatomical classification. `somaNeuromere` is absent for 118,359 positioned nodes, so using only that annotation would omit most of the brain. Full-model counts include unpositioned neurons; they need not match the cloud counts. These selected snapshots are not match-wide averages.

## Diagnosis

Packing remains `min(255, round(rate/128))`. “Active” means byte > 0 (raw rate >= 64); the propagation cutoff is independently 32. A large active count can therefore consist mostly of bytes 1–10, only 0.4–3.9% of the old linear color/size mix. The old renderer also multiplied bytes by 0.9 and floored them on each render, erasing byte 1 immediately, and used peak persistence on ingestion. That is unsuitable for continuous V2 rates and makes appearance depend on rendering cadence. Canvas additionally treated bytes <= 51 as inactive color.

V2 directly drives only 9,201 visual_projection nodes (9,162 positioned), with six cyclic authored partitions. Readout consumes 1,314 descending_neuron and 708 vnc_motor nodes (1,308 and 703 positioned). Readout observes rates; it does not inject activity. Most cord nodes are neither directly driven nor read out. Weak incoming coupling, decay and the source >= 32 cutoff explain weak VNC activation; the measured nonzero VNC samples disprove a completely unused cord.

Missing positions are especially severe for selected exact sensory classes: vnc_sensory 2/6,370 positioned, cb_sensory 0/4,868, ol_sensory 28/6,098. These nodes remain in the graph. The current V2 mapping does not directly stimulate them.

## Display change and boundaries

Default V2 now holds the latest packed frame exactly, including zeros and during pause. Packing runs in WASM (`rate_pack`) on each 30 Hz model step and is reused on the held 60 Hz game frame; the held worker reply omits the unchanged 166,700-byte activity copy and the UI reuses its prior transferred buffer. The formula remains `min(255, round(rate/128))`. Display uses a fixed log scale via a 256-entry LUT of `log(1+byte)/log(256)` for color/size (linear `byte/255` remains available in the mapping helper for tests). Zero remains zero, byte 1 maps to display byte 32, byte 16 to 130, byte 255 to 255. The scale is fixed across time and populations, with no adaptive percentile boost or fabricated baseline. UI explains the formula, active-count threshold, unpositioned nodes, and V2 drive/readout limitations, and labels values as model activity, not spikes. WebGL and Canvas share the scale and continuous color interpolation. Interactive display repaint is 30 Hz on capable desktops and 15 Hz on constrained profiles without changing canvas backing resolution; dummy and LIF diagnostic temporal persistence remain separate.

The gameplay renderer adds presentation-only response without changing those values: lean follows the Fox–Fly horizontal relationship, vertical shift follows Fly velocity, point size/brightness follows the already-displayed motor maximum, and short pulses begin on attack-output or hitlag edges. A slow sub-percent breathing scale runs only while the match runs. Pause freezes the exact rendered pose; controller-population mode resets to the fixed inspection view. WebGL and Canvas use the same pose and size inputs. These effects are not neural activity, biological motion, or controller input.

Sensory input and motor output bars overlay the bottom corners of the live soma canvas (GAME → CONTROLLER on the left, CONTROLLER → FLY on the right), so the upper brain cloud stays full-width and unobstructed. Both columns use a fixed width; the APPLIED motor label ellipsizes instead of widening the panel when several channels fire. The zero / higher-activity legend is anchored at the top-right of the canvas so the motor stack cannot cover it. The stage chrome around the canvas is transparent; only `.brain-view` keeps the dark activity backdrop. The same bottom-corner placement is kept on narrow phones. Values remain the exact decoded controller channels; layout is presentation-only. On desktop, Fox keyboard guidelines live inside the match column under the scoreboard so they fill the height leftover when the anatomy panel is taller; they are not a separate lower-grid strip. On phone (≤720px) that strip is hidden—the match panel ends at the scoreboard—and stick/HIT overlays on the arena remain the input chrome.

The later controller-timing change alters which stationary-duel frames satisfy the approach/attack sampler, so this table and `data/activity-evidence.json` were regenerated. Packing, display scaling, neural populations, calibration and biological boundaries remain unchanged. Adding VNC sensory drive would be a separate authored model experiment requiring recalibration and behavior tests; it is not justified as a cosmetic remedy.

Tests cover fixed-scale endpoints/order, mapping with unpositioned nodes, exact replacement/zero clearing, the packing/count threshold, and a Chrome paused-canvas pixel comparison that verifies no fading. The evidence script is included in canonical verification.

## Optional controller population view

The unchecked-by-default “Highlight drive & readout populations” control switches from activity to static controller membership. Blue marks the exact visual_projection input population; orange marks the exact descending_neuron + vnc_motor readout. Both are selected by the existing rateMapping function, not anatomical proximity, current activation, or broader sensory/tbc annotations. Other somas remain visible as context. Selected points render after background anatomy so ordering cannot hide the highlighted subset. The caption and legend say membership, not activity. Returning to activity restores the current model frame.

Counts are derived from the full graph role array through the verified visual_indices mapping: drive 9,162 positioned / 9,201 total (39 unpositioned); readout 2,011 / 2,022 (11 unpositioned). Unpositioned members are counted but never assigned invented coordinates. Membership stays the same before play, during play, and after reset. Readout membership does not imply external drive, and these colors do not claim biological function. Dynamics and calibration remain unchanged.

The worker sends a single transferable 166,700-byte membership array after graph initialization; no graph edges or annotation dictionaries are exposed to the UI. The renderer keeps 139,662 mapped role bytes and a corresponding WebGL attribute; population membership never overwrites activity bytes. Unit fixtures check exact selection/exclusions, visual mapping and missing-position conservation. Chrome checks both WebGL and mobile Canvas for coverage counts, zero-activity highlighting, reversibility, and unchanged membership pixels across gameplay/reset.

Validation: `./scripts/verify.sh` exited 0 after the timing update (native 5, TypeScript 49, policy/metric 2, Python 17, Chrome 24). The current 563-frame full-graph replay activity/motor hash is `d02de3b336e6c1c4fd3802d254f4553b5aaa1a1525c2f5736f3ee517a72cd1ef`. Final desktop and mobile population screenshots from the display change were reviewed. The timing update is not published.
