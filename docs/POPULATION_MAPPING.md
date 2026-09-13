# Experimental annotation mapping v1

This browser worker assay is **MODEL_ASSUMPTION**, not a biological controller. It establishes a tested path from annotated input populations through measured connectivity to normalized annotated readouts. Fly gameplay and the visible anatomy overlay still use DummyBrain.

## Exact predicates
Inputs select `superclass == visual_projection`, partitioned by `somaSide == L` (4,589) and `R` (4,612). Outputs select `superclass == descending_neuron`, partitioned by `somaSide == L` (656) and `R` (648). Ten midline descending entries are excluded from this readout only; no input entries have excluded sides. Unknown, missing and midline sides are never silently assigned a direction. Related `_tbc` labels do not satisfy exact equality. Positions are never required.

These fields already reside in the hash-verified graph worker package; membership uses the same graph indices as the audited IDs. The audit's candidate membership report is not downloaded again. Choosing visual-projection and descending classes is a research proxy, not evidence of visual stimulus tuning or lateral motor function. Soma side is not a game direction. Primary sensory root-side populations are not substituted because rootSide is a distinct field and is not currently in the browser graph package.

## Drive and readout
Each independently reset pass runs 120 ticks. Every selected left input neuron receives integer current 1000 on ticks 0–59; every selected right input neuron receives 1000 on ticks 60–119. All other external current is zero. Each neuron receives equal amplitude, so aggregate current differs slightly with group size. This is a sequential drive assay: the right window starts with the left window's evolved state, not a clean independent stimulus trial. It cannot establish an unbiased lateral preference.

Readouts count spikes among the left/right descending groups for each 60-tick window, divided by group size times 60. Values are spike events per neuron per tick in [0,1]; they are not Hz, game-axis commands or action probabilities. No output threshold/amplification or attack/jump mapping is applied. All-positive signs and LIF_V1 parameters remain artificial.

## Controls and reproducibility
Three conditions run warmup, measurement and reset replay:
- Annotated mapping, with v1 transmission gain 1.
- Transmission off, with identical drive/readout groups and gain 0. Disjoint input/output groups must yield exactly zero descending readout.
- Shuffled membership, applying one fixed-seed permutation to every input/output index. Fisher–Yates uses uint32 xorshift seed 20260912 and modulo selection. This is a reproducible engineering control (not a claim of statistically unbiased random sampling). Sizes and mutual disjointness are preserved; graph topology and weights are unchanged. Both input and output memberships change, so this control does not isolate their individual effects.

Each condition resets independently; within-condition spike trace replay is checked. The UI reports original annotation coverage, condition-specific readouts and scalar diagnostics. Stop/Unload and the 8 ms/four-tick cooperative scheduling target remain in effect. Mapping index arrays, temporary permutation and output membership mask add modest allocations beyond the previously reported model/input arrays; the UI does not claim total worker memory.

Tests verify exact selectors, no coordinate dependency, unknown/midline policy, current reset, normalized counts, deterministic/disjoint shuffling, malformed/empty groups and full measured graph counts. Chrome verifies zero disconnected output and different shuffled trace while gameplay runs. A nonzero connected readout alone does not establish useful control or biological validity.

## Independently reset lateral trials
The **Independent lateral trials** suite retains the same three conditions and annotation predicates. Each 60-tick left or right stimulus starts from a complete reset (voltage, pending currents, refractory counters and spike storage). Warmup and measurement run left then right; replay runs right then left, also resetting between stimuli. Readouts and trace hashes are indexed by stimulus identity, not execution order, and must match exactly before readiness. The original sequential assay remains available as a separate comparison.

Directional contrast is `(R_readout - L_readout under right input) - (R_readout - L_readout under left input)`. This descriptive value is not a trained classifier, significance test, action threshold or performance gate. Positive contrast alone does not establish useful movement control. All signs, current amplitude and model parameters remain authored. A single fixed shuffle is not a statistical null distribution.

The result includes both stimulus-specific trace hashes; the combined row hash is an order-independent diagnostic and is not substituted for comparing the two individual traces. Reported bins and last-spike tick describe the measured left-then-right execution. The disconnected condition must still have zero readout and contrast. A four-neuron same-side fixture predicts readouts [1/3,0] and [0,1/3], giving contrast 2/3, and confirms exact replay despite reversed execution order.

## Predeclared amplitude and shuffle sweep
The **Amplitude and shuffle sweep** suite tests current amplitudes 250, 500 and 1000 with unchanged positive signs, LIF parameters and exact annotation selectors. For each strength it runs the annotated mapping, transmission off and shuffled memberships with seeds 20260912, 20260913 and 20260914. All 15 conditions are reported; none are selected after inspecting outcomes. The same three permutations are reused across amplitudes, making these paired sensitivity comparisons rather than independent samples.

Each condition runs warmup, measurement and reverse-order replay over independently reset left/right 60-tick stimuli: 5,400 ticks total. Every row records amplitude, optional seed, readouts, directional contrast and stimulus-specific hashes. The earlier amplitude-1000 annotated and first-shuffle traces must reproduce. Disconnected output must remain zero at every strength. No statistical significance, calibrated stimulus unit or controller threshold is inferred from three shuffles. This finite deterministic assay does not test noise, broad population choices or biological signs.
