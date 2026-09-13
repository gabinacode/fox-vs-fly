# Integer sparse LIF v1

Status: deterministic core implemented in `brain/core/lif.ts` and available as an optional browser worker benchmark. It is not connected to the activity renderer, sensory encoder or motor decoder. The visible Fly still uses DummyBrain.

## Measured data and explicit assumptions
The model borrows immutable presynaptic CSR offsets, targets and positive measured contact counts. It neither copies nor changes those weights. A separate, required per-source Int8 sign vector supplies -1, 0 or +1. Zero disables outgoing current; there is no implicit excitatory default and no automatic neurotransmitter-to-sign conversion. Caller-provided signs are copied. A single presynaptic sign is an engineering simplification, not evidence of receptor-specific effects.

Every parameter below is **MODEL_ASSUMPTION**, expressed in arbitrary integer voltage/current units and model ticks. No milliseconds, biological calibration or validated firing-rate interpretation is assigned.

| Parameter | v1 value |
|---|---:|
| Threshold | 1000 |
| Reset/rest reference | 0 |
| Voltage floor | -1000 |
| Leak retention | 19/20 per tick |
| Refractory duration | 2 complete subsequent ticks |
| Current gain per measured contact | 1 |
| Transmission delay | 1 tick for every edge, including autapses |

For each nonrefractory neuron, truncate `voltage * leakNumerator / leakDenominator` toward zero, then add the previous tick's summed synaptic current and the current tick's external integer input. Reaching threshold emits one spike, resets voltage and sets the refractory counter. Otherwise clamp only to the voltage floor. Refractory neurons stay at reset and discard incoming current, decrementing their counter each tick. After all neurons integrate, emit signed `measuredCount * gain` contributions from spiking rows into next tick's pending currents. This two-phase update prevents index-dependent same-tick cascades. Excitation and inhibition sum before clamping.

No noise, plasticity, conductance model, synaptic decay, heterogeneous delays, receptor inference or game population mapping is included. Silent zero-state networks stay silent without input. These omissions and authored parameters limit interpretation.

## Determinism, ownership and cost
Int32 voltage, Uint16 refractory counters, Float64 integer accumulators, Uint32 reusable spike indices and Int8 source signs require **19 bytes per neuron**, or **3,167,300 bytes** for 166,700 nodes. Graph arrays are borrowed; the caller must not mutate them. Configuration is copied and frozen. Diagnostics return copies; step returns a borrowed spike-list view valid only until the next step/reset.

Constructor checks CSR ordering/bounds, positive weights, signs and parameter ranges. Total contacts times gain is limited to 2^40, keeping all accumulated currents exactly representable; bounded voltage/leak multiplication is also below the exact integer limit. No Int32 wraparound is used for current accumulation. Input uses Int32 currents and must match the graph population. Reset clears voltage, pending transmission, refractory counters, spike storage and tick count.

Each tick scans all neurons and only traverses outgoing edges of spikes with nonzero signs. Thus cost is O(nodes + outgoing edges of active sources), with no dense adjacency matrix and no per-edge mutable model state.

## Tests and reproduction
Eight fixture tests cover leak/threshold/refractory semantics, directed delay, excitation/inhibition cancellation and zero signs, autapses, reset replay and unchanged measured counts, invalid inputs/CSR, an independent dense reference over 200 ticks, and accumulation beyond uint32 range without wrapping.

`node scripts/lif_bench.mjs` transpiles the same TypeScript core with the existing development compiler, checksum-verifies generated CSR files, and runs silent, sparse-drive and dense-drive workloads on the full measured topology. Signs are artificially all positive; drive is index-based and constant. This is a stress benchmark, not a biological experiment. Each workload warms up, measures 120 ticks, and verifies a repeated spike trace after reset. Missing generated data is explicitly skipped. The canonical verify script runs this benchmark.

Timings include spike counting and deterministic trace hashing. Process memory is a post-run Node snapshot including the compiler, benchmark and temporary buffers; it is not browser memory or peak RSS. See BENCHMARKS.md. A real-time browser tick budget and physical model timestep remain unselected pending worker profiling and model requirements.

## Browser experiment
After Load connectivity, Run neural benchmark executes three workloads with 120 warmup, 120 measured and 120 reset-replay ticks each (1,080 ticks total). Signs are all positive and drive is index-based, explicitly artificial. Progress and scalar results cross to the UI; graph/model arrays remain in the worker. The runner yields after at most four ticks or 8 ms of work, whichever occurs first so Stop experiment can abort between batches. A slow single tick is not preemptible; Unload network terminates the worker immediately. Stop retains the graph, clears temporary model ownership on return, and permits a fresh run. Concurrent experiments are rejected. Suite changes are disabled while running. Completion also releases model state; reported memory describes arrays used during the run, not persistent allocation or total heap.

Mean/p95 timings measure only model.step, excluding deliberate yields and trace hashing; wallMs includes those costs. Model arrays total 3,167,300 bytes and external drive 666,800 bytes. Browser tests compare all three spike counts/hashes with headless results and exercise stop, rerun and unload during execution while the match advances. No model ticks are dropped or tied to game frames. Dense drive exceeds a 16.7 ms mean tick budget in Chrome; this diagnostic mode therefore makes no real-time claim. A biological timestep and gameplay integration remain separate decisions.

## Controlled comparisons
The optional Controlled comparisons suite runs four conditions, each from a fresh model and with identical v1 parameters except the stated intervention. Each condition uses 120 warmup, 120 measurement and 120 reset-replay ticks; 1,440 total model ticks. Drive targets every 100th graph index, never anatomical/functional populations.

| Condition | Intervention relative to sparse baseline |
|---|---|
| Sparse baseline | Positive signs, gain 1, constant threshold-sized drive |
| Transmission off | Gain 0; preserves graph arrays, eliminates propagated current |
| Alternating signs | Source signs alternate +1/-1 in blocks of 100 graph indices; identical drive |
| Pulse then release | Positive signs; external drive only on ticks 0–9, zero thereafter |

Signs are an artificial sensitivity test, not neurotransmitter predictions. Disabling current is a propagation ablation, not deletion of measured edges. Total spikes and spikes during ticks 60–119 expose late activity after input removal; neither proves biological memory or stability beyond this finite horizon. Timing comparisons include different firing rates and do not isolate a single implementation cost. All conditions retain positive measured counts unchanged and verify reset replay.

The cooperative scheduling target is **8 ms or four ticks**, checked after each completed tick including hashing. This bounds additional work between yields, but cannot interrupt a single slow tick or model construction. A ~55 ms dense tick can still overshoot. Unload terminates the worker; Stop waits for a yield. This is a diagnostic scheduling budget, not a 60 Hz real-time guarantee or a biological timestep. No ticks are skipped to meet wall-clock targets.

## Long pulse sensitivity
The Long pulse sensitivity suite extends observation to **600 model ticks** per pass, with 120-tick suites unchanged. Four independently reset conditions receive threshold-sized external current at every 100th graph index on ticks 0–9 only:

- Positive-sign baseline, v1 retention 19/20, gain 1.
- Transmission off, gain 0; all other settings match baseline.
- Stronger leak, retention 10/20; positive signs and gain 1 match baseline.
- Alternating signs in 100-index blocks; retention and gain match baseline.

Each condition executes a full warmup, measurement and reset replay: 7,200 ticks total. Results include ten consecutive 60-tick spike bins, the final 60-tick count and last observed spike tick (zero-based, null if none). The histogram must sum to the total. Independent disconnected fixtures predict exactly four spikes per driven neuron, all on ticks 0, 3, 6 and 9, regardless of these interventions. The full graph baseline's first two bins must reproduce the earlier 120-tick pulse experiment.

This is a finite-horizon parameter sensitivity assay. A zero final bin does not independently prove mathematical stability; persistent activity does not establish memory or biological plausibility. The 10/20 leak retention is an authored stronger-leak control, not a calibrated time constant. No physical timestep or neural gameplay mapping is selected by this assay. Cooperative scheduling and Stop/Unload semantics are unchanged.
