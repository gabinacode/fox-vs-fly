# Neural gameplay V2 — calibrated stable rate model

## Why the controller changed
The published V1 all-positive LIF baseline had sustained, correlated motor activity. In the same 600-frame stationary-opponent scenario it dealt 0 damage, requested 13 jumps and held fastfall for 581 frames. This reproduced the reported poor behavior. V2 uses stable rate dynamics, a calibrated population readout and explicit game sensors. On the same scenario it deals 32 damage, requests 4 jumps and 2 fastfall frames, and retains all three stocks. This is a regression scenario, not a general win-rate or biological validation claim. The historical implementation/tests remain in male_cns_lif.ts and NEURAL_GAMEPLAY_V1.md; optional LIF diagnostics are unchanged.

## Measured versus modeled
The full 166,700-neuron, 25,582,938-edge graph and positive synaptic counts remain measured MaleCNS data. Missing soma positions remove no model nodes. The dynamics, input partitions, sensors, weights used to decode activity and action thresholds are authored assumptions. The graph has not learned to fight. No neurotransmitter signs or biological functions are inferred. The interface is designed to make game stimuli recoverable through the network, not to simulate a biologically validated policy.

## Stable dynamics and scheduling
C++ compiled to a dedicated WASM module runs in the neural worker. For each target, incoming activation is the measured-weight average of previous source activations. A source below 32 does not propagate. The next unsigned integer activity is floor(0.25 × previous + 0.60 × incoming average + input), clamped to 0..65535. Six disjoint input groups receive at most 6000 current each. With input removed, the maximum activation contracts by at least a factor of 0.85 per step (with additional truncation), including on recurrent graphs. Activity cannot sustain itself indefinitely as in V1.

The model advances at 30 steps/s; the game remains 60 frames/s. Between model updates, displayed sensory values remain the actual last current drive, and the same neural state supplies the decoder. The footer reports actual model updates, not game/render frames mislabeled as neural updates. A full model step measured 17.46 ms in the calibration workload; running it every second game frame preserves the game budget. This is software timing, not a measured biological time constant.

The worker temporarily holds the checked JS graph and a copy in WASM during initialization. Afterwards the controller retains only WASM arrays, mapping indices and readout coefficients. Typed model arrays occupy about 200 MiB, excluding the WASM allocator, module/runtime and transient loading copies. Total browser peak heap is not measured. Raw graph arrays never reach the UI thread.

## Sensory interface
Exact visual_projection entries, in sorted graph order, are assigned cyclically to six disjoint artificial input groups. This grouping is not a biological sensory classification. `neuralSensory` exposes the actual six drives:

- Target left/right: close toward the opponent with a 7-unit stopping gap; when beyond 58 units from stage center or below the stage, target the center instead. Strength scales over 12 units.
- Opponent above: upward separation while grounded and horizontally nearby.
- Opponent in reach: horizontal separation below 17 and vertical separation below 10.
- Safe descent: falling above the opponent while on the safe part of the stage.
- Recovery need: airborne and falling while outside that stage margin or below the platform.

These are deliberate game-interface features, including an authored recovery rule. They are sent only as neural currents. No sensor directly sets a controller button or bypasses the network.

## Calibrated readout
All exact descending_neuron and vnc_motor entries (2,022 nodes) supply normalized activation features. `scripts/calibrate_readout.mjs` measures 80 model steps for each of six independent one-hot artificial stimuli. A small ridge inverse fits a linear decoder from those measured model responses back to stimulus strengths. The six coefficient vectors are packaged in web/public/neural/readout.json with graph identity, version and ordered output indices. Runtime validates identity, shape and coefficient bounds. Held-out mixtures have error below 0.08; full results are retained in data/rate-calibration.json. Calibration is developer-only; players load the result automatically.

Decoded right minus left sets the axis. Decoded upward/recovery activity requests Jump; reach requests Attack; safe descent requests Fastfall only while jump demand is low. Jump and attack pulses have minimum intervals of 30 and 24 game frames. The final five motor values are exactly what the HUD displays and motorDecode applies to the game. There is no hidden heuristic controller. Tests removing connections produce zero controls despite nonzero sensors.

## Evidence and limits
Native model tests cover delayed weighted propagation, normalization, recurrent decay and reset. Controller fixtures cover connection removal, both directions, no unrelated action, 30 Hz updates, cached pause retries and exact reset. `scripts/controller_behavior.mjs` uses the full checked graph to require left/right tracking, in-range attack, stage recovery, reversal without reset, damage against a stationary opponent and improvement over the published baseline. `scripts/neural_replay.mjs` checks exact activity/motor and game replay after reset, then native/WASM agreement on generated game inputs. Chrome checks real loading/play/reset/fallback plus approaching and hitting stationary Fox.

This is a more useful experimental opponent, not a trained fighting-game policy or evidence of biological behavior. Calibration uses artificial stimuli; generalization, adversarial play, long-match stability and biological sign/dynamics alternatives remain research tasks. The new visualization shows continuous model activity, explicitly labeled MODEL ACTIVITY, rather than calling rate values spikes.

## Soma activity display
See [ACTIVITY_DISPLAY.md](ACTIVITY_DISPLAY.md) for reproducible brain/VNC fractions and byte distributions during approach and attack. V2 now holds latest rates and offers explicit fixed log/linear contrast. Packing, active counts, model inputs and calibrated readout are unchanged.

An optional static population view identifies drive (visual_projection) and readout (descending_neuron + vnc_motor), with measured soma coverage. It is explicitly separate from model activity and adds no neural input.

## Longer-match evaluation
The local stress test in [MATCH_EVALUATION.md](MATCH_EVALUATION.md) retains 12 scripted bouts, including two complete 120-second shuttle timeouts. Rushdown beats V2 in both phase variants; shuttle pursuit requests attacks without reliably landing them despite sustained model activity. This narrows the next controller work to moving-target attack timing and recovery pulses. These are observed weaknesses, not new sensory mappings or biological conclusions.
