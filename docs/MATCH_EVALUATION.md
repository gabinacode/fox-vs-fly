# Longer matches and scripted adversaries

This developer-only assay runs the full MaleCNS V2 WASM rate controller against authored opponent policies in the native/WASM game. It does not claim human-level, Melee-reference, or biological performance.

## Reproduction and checks

Run `node --test scripts/match_evaluation.test.mjs`, then `node scripts/long_matches.mjs --output data/long-matches-after-timing.json` with the generated graph, built neural/game WASM, calibration and native `build/sim_replay` available. The assay writes only after every bout and the reset replay pass. The original V2 baseline remains in `data/long-matches.json`.

`node scripts/long_matches.mjs --check --output data/long-matches-after-timing.json --baseline data/long-matches.json` completely replays seed-7 rushdown and shuttle, plus the first 600 frames or natural end for every other seed-7 policy. It checks trace fingerprints, exact complete-match results, targeted before/after improvements and the stationary/cross-up/edge regression floors. Controller source participates in the report provenance hash. The canonical verify script runs this check; it does not rerun all 12 bouts.

## Protocol

- Five combat policies run until natural match end or 3,600 game frames. A nonattacking shuttle gets 7,200 frames. Early endings are preserved.
- Each policy uses phase seeds 7 and 29. Seeds shift opponent attack pulses and movement waypoints only. Every match resets to simulation seed 42, Fox on the left and Fly on the right, with three stocks each. The stationary cases are identical deterministic duplicates.
- Stationary sends no controls. Rushdown approaches and attacks in reach. Retreat/punish backs away within 28 units, returns inward near the stage margin, and attacks in reach. Jump/cross-up alternates waypoints and requests jumps nearby. Edge bait alternates targets near +/-56. Shuttle alternates +/-48 every 60 frames and never attacks. Mobile policies attempt inward recovery. These are authored evaluation assumptions.
- Game semantics run at 60 Hz and V2 integrates every other frame. No renderer, human input, frame skipping, or alternate neural path participates.
- Every input stream is replayed through native `sim_replay`; all per-frame game hashes must match WASM. One complete rushdown bout is repeated after resetting the neural model and simulator, and its full result and trace must match.

## Metrics and limits

The report retains every outcome, termination time, stock balance, observed positive damage increment, requested jump/attack/fastfall frames, axis reversals, longest period without a damage increment, active-model-node extrema/mean, activity samples, recovery excursions and stock-loss state. “Active” retains the packed-byte threshold; it does not mean biological spikes. Damage can omit a hit followed by a stock reset in the same step. A recovery excursion begins when Fly is airborne outside +/-68 or below y=0 and closes on landing or stock loss; these descriptive counts do not establish recoverability.

The timing trace associates a damage increase with the newest unresolved attack request in the preceding 12 frames. This is a diagnostic attribution window, not a game rule. The assay uses a small fixed policy set, one approximate stage and one spawn orientation. It provides no confidence interval, human win-rate estimate, biological validation, or claim of Melee fidelity.

## Results after the timing fix

The timing-corrected controller completes all 12 bouts in 7,763 game frames (129.38 simulated seconds). All 12 are Fly wins in this fixture set; this is not an estimated win rate.

| Opponent | Seed | Seconds | Fly result | Stocks Fox / Fly | Damage dealt / received |
| --- | ---: | ---: | --- | --- | --- |
| stationary | 7 | 6.75 | fly_win | 0 / 3 | 32 / 0 |
| stationary | 29 | 6.75 | fly_win | 0 / 3 | 32 / 0 |
| rushdown | 7 | 15.95 | fly_win | 0 / 2 | 64 / 24 |
| rushdown | 29 | 10.73 | fly_win | 0 / 3 | 40 / 16 |
| retreat_punish | 7 | 8.82 | fly_win | 0 / 3 | 24 / 0 |
| retreat_punish | 29 | 8.82 | fly_win | 0 / 3 | 24 / 0 |
| jump_crossup | 7 | 15.53 | fly_win | 0 / 1 | 40 / 24 |
| jump_crossup | 29 | 14.22 | fly_win | 0 / 2 | 48 / 16 |
| edge_bait | 7 | 9.60 | fly_win | 0 / 3 | 32 / 8 |
| edge_bait | 29 | 11.23 | fly_win | 0 / 2 | 24 / 16 |
| shuttle | 7 | 8.25 | fly_win | 0 / 3 | 24 / 0 |
| shuttle | 29 | 12.73 | fly_win | 0 / 3 | 48 / 0 |

## Timing diagnosis and controller change

The baseline trace shows four game frames from attack-sensor onset to the first decoded attack request. The local attack has five startup frames, so the sensor must describe the expected target position nine frames ahead. The old current-distance condition fired when Fly was already almost coincident with a moving target: shuttle requests averaged only 0.66/0.48 units of current horizontal separation, while absolute projected separation at the active frame averaged 15.12/15.35. The new sensor projects relative horizontal velocity across the measured four-frame path plus five-frame startup and tests the authored hitbox interval, while retaining the current vertical limit.

| Policy / seed | Baseline attributed hits / requests | After attributed hits / requests | Baseline result | After result |
| --- | ---: | ---: | --- | --- |
| shuttle / 7 | 1 / 120 | 3 / 4 | timeout | win, 3 stocks |
| shuttle / 29 | 0 / 120 | 6 / 9 | timeout | win, 3 stocks |
| rushdown / 7 | 1 / 17 | 8 / 12 | loss, 0 stocks | win, 2 stocks |
| rushdown / 29 | 2 / 25 | 5 / 8 | loss, 0 stocks | win, 3 stocks |

The baseline rushdown seed-29 trace also exposes a rejected recovery pulse. At tick 1,176 the decoder emits Jump 0.736 while Fly is in Hurt with two hitstun frames remaining. The game rejects the input, but the old controller starts its 30-frame jump cooldown. Fly dies at tick 1,184 with one jump still available. The controller now withholds jump/attack pulses during local action locks and does not consume their cooldowns. Recovery drive begins throughout an airborne excursion rather than only while falling, so decoder delay can elapse during hitstun.

Attacks are withheld during recovery because the local Attack state freezes air steering. A traced edge loss crossed platform height at x=-72.878 while attack-locked. The common 42-unit steering and attack-suppression margin leaves 26 units before the authored platform edge.

The protected conditions meet explicit before/after floors. Stationary stays at three stocks with 32 damage dealt in both seeds. Cross-up stays at one or more stocks and increases the second seed from one to two. Edge-bait remains at three/two stocks and deals at least the baseline damage. Retreat/punish also changes from one loss/one win to two three-stock wins, though it was not a tuning target.

Every motor value remains finite and bounded, all native/WASM per-frame hashes agree, and the complete seed-7 rushdown reset replay matches all metrics and its full activity/motor/opponent/game trace. These checks establish deterministic behavior in these authored policies. They do not establish biological validity, Melee fidelity, human-level play or performance beyond this fixed assay.

Baseline evidence remains in `data/long-matches.json` and `data/controller-timing-v2-baseline.json`; corrected evidence is in `data/long-matches-after-timing.json` and `data/controller-timing-after.json`. Publishing is explicitly deferred.
