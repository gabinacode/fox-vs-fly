# Neural gameplay — 2026-09-13

The default page automatically prepares the packaged MaleCNS graph in a dedicated worker before enabling PLAY. The full 166,700-node, 25,582,938-edge graph participates; 139,662 measured soma positions render actual spike flags from that same model. Missing positions remove no model nodes. The explicit `?controller=dummy` route retains the synthetic demo and optional research diagnostics. Graph/anatomy integrity failures disable neural PLAY; there is no silent dummy fallback.

## Authored model and interface

This is a wiring-driven computational controller, **not validated fly behavior**. All edges have artificial positive transmission, independent of NT labels; no neurotransmitter or receptor inference is made. Measured synapse counts are used as integer coupling weights. LIF_V1 supplies threshold 1000, reset 0, floor -1000, leak 19/20, gain 1, and two refractory ticks. One model tick is scheduled per 60 Hz game frame: this is a software coupling interval, not a measured neuronal time constant. All edges have one model-tick delay.

`sensoryEncode` produces six displayed channels: opponent left/right, approaching, edge proximity, damage/hitstun and ground contact. Exact visual_projection/somaSide L and R annotations select lateral inputs. Within each side, sorted graph-order index j selects one of the other four channels using j modulo 4. Input current is round(1000 × min(1, lateral + 0.25 × auxiliary)). This interleaving and stimulation formula are arbitrary game interfaces, not sensory function inferred from anatomy. No coordinates participate.

Exact descending_neuron/somaSide L and R populations provide lateral readouts. Exact vnc_motor entries in sorted graph order are divided cyclically into three arbitrary groups for Jump, Attack and Fastfall. These action names do not assert biological roles. All five groups report their fraction of cells spiking in the current tick; an exponential mean updates as (7 × previous + fraction)/8. Lateral motor value is six times the right-minus-left mean, split by sign and clamped to [0,1]. Action strengths are six times their means, clamped. Jump and Attack values above 0.5 produce pulses at minimum intervals of 45 and 20 game frames, respectively; intervening values are zero. Fastfall remains a level. The final five values—not hidden raw readouts—are displayed and passed unchanged to motorDecode for WASM input. No observation-driven heuristic bypasses neural output.

Both lateral and action mappings are exploratory. Prior controlled assays found poor bidirectional discrimination and persistent activity with all-positive transmission. This integration establishes the closed loop, not a competent opponent or biological validation. Sign sensitivity, tuning and scientific controls remain research work. Sustained recurrent activation and broadly correlated readouts remain known limitations.

## State and ownership

The worker owns graph, model, rates, pulse cooldowns and one cached frame. Main-thread messages contain only typed activity/signal arrays, never connectivity. Structured cloning preserves the cached buffers, needed when pause discards an in-flight reply and resubmits the same game tick. Session epochs reject stale replies; a separate reset generation clears model, rates and cooldowns only on match reset. Nonconsecutive ticks fail. Rendering persistence never feeds back into dynamics. Closing the page terminates worker ownership.

Graph arrays occupy 210,664,708 bytes; LIF state 3,167,300 bytes. Input current adds 666,800 bytes, with population indices and cached/transit frames beyond that. Total heap and low-end performance are not measured. Diagnostics live in the explicit dummy route, avoiding a second full graph allocation in the default game.

## Evidence

Fixture tests demonstrate delayed input-to-output propagation, silent outputs when connectivity is removed, exact displayed motor decoding, deterministic pause retry/reset, rejected skipped ticks, and repeated action pulse intervals. `scripts/neural_replay.mjs` loads hash-checked real data, runs 600 game/model frames, resets and reproduces all game hashes, spike bytes and motor bytes, then replays the exact generated controller inputs through native C++. The final game hash is 114741712; the spike/motor SHA-256 is 9818e7ae4322a184ac2dd79805ae1f72d7c6b3eba5b0a9584e750126b0a71d54. The run has 3,435,783 spikes and 599 frames with nonzero motor input. A local measurement was 4.05 ms per closed-loop frame; this is not a universal 60 Hz guarantee.

Production Chrome checks cover automatic preparation, actual model activity, pause/resume/reset, loading failure without fallback, Canvas fallback and mobile width. The original dummy/diagnostic tests remain on their explicit demo route.

These closed-loop results were refreshed after the source-informed short-hop/launch refinement and the 18-field fighter hash layout on 2026-09-13. Older neural traces depend on the previous game trajectories.
