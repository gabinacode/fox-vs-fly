# Longer matches and scripted adversaries

This developer-only assay runs the actual full MaleCNS V2 WASM rate controller against authored opponent policies in the native/WASM game. It neither changes the controller nor claims human-level, Melee-reference, or biological performance.

## Reproduction and checks

Run `node --test scripts/match_evaluation.test.mjs`, then `node scripts/long_matches.mjs` with the generated graph, built neural/game WASM, calibration and native `build/sim_replay` available. The full assay writes `data/long-matches.json` only after every bout and the reset replay pass. Progress rows printed before completion are provisional. `node scripts/long_matches.mjs --check` completely replays seed-7 rushdown and the 120-second seed-7 shuttle, plus the first 600 frames (or earlier natural end) for every other seed-7 policy. It checks recorded outcomes/metrics for the two complete cases and trace fingerprints for all cases. The canonical verify script includes these checks and the metric/policy unit tests; it does not rerun all 12 long bouts. Regenerate the full report when graph, WASM, calibration or opponent/metric source changes. Prefix passes do not certify the remainder of the other long trajectories.

## Protocol

- Five combat policies run until natural match end or 3,600 game frames (60 simulated seconds); an additional nonattacking shuttle policy gets 7,200 frames (120 seconds). Early endings are preserved, never padded or called full-length bouts.
- Each policy uses phase seeds 7 and 29. Seeds shift the opponent's attack pulses and movement waypoints only. Every match resets to simulation seed 42, Fox on the left and Fly on the right, with three stocks each. The two stationary cases are identical duplicates, not independent evidence.
- Stationary sends no controls. Rushdown approaches and attacks in reach. Retreat/punish backs away within 28 units, returns inward near the stage margin, and attacks in reach. Jump/cross-up alternates waypoints and requests jumps nearby. Edge bait alternates targets near +/-56. Shuttle alternates +/-48 every 60 frames and never attacks. Mobile policies attempt inward recovery. Policies observe game state, not Fly's current neural output or future state; their timing and recovery rules are authored evaluation assumptions.
- Game semantics run at 60 Hz and V2 integrates every other frame. No renderer, human input, frame skipping, or alternate neural path participates.
- Every input stream is replayed through native `sim_replay`; all per-frame game hashes must match WASM. One complete rushdown bout is repeated after resetting the neural model and simulator; its full metrics, activity/motor/opponent/game trace fingerprint and result must match exactly.

## Metrics and limits

The report retains every outcome, termination time, stock balance, observed positive damage increment, requested jump/attack/fastfall frames, axis reversals, longest period without a damage increment, active-model-node extrema/mean, and activity samples every 300 frames. “Active” retains the packed-byte threshold; saturation counts refer to packed byte 255, not biological spikes or raw rate saturation. Damage can omit a hit that is followed by a stock reset in the same step. Button requests are not necessarily accepted actions when the fighter is in hitlag, hitstun, attack recovery or lacks a jump.

A recovery excursion begins when Fly is airborne outside +/-68 or below y=0; it closes on stage landing or a stock loss. Excursions still open at the other player's elimination are retained. The report counts frames outside hitlag/hitstun/attack, frames with a remaining jump, and requested jump frames. These counts are descriptive and do not establish that recovery was physically possible. Stock-loss events include the preceding position/damage and last neural sensory/motor/control state to support follow-up diagnosis.

The result is a small fixed-policy stress test on one approximate stage and spawn orientation. There are no statistical confidence intervals, human win-rate estimates, biological validation, or claims of Melee fidelity. Losses and timeouts are findings, not reasons to weaken assertions or drop conditions. Production sensory mapping, calibration and dynamics remain unchanged.

## Results

Completed 12 bouts, totaling 23,834 game frames (397.23 simulated seconds), with all conditions retained. Combat bouts ended naturally in 7.05–35.73 seconds; both shuttle bouts reached their complete 120-second horizon. These are 7 Fly wins, 3 losses and 2 timeouts in the specified fixture set, not an estimated win rate. The stationary rows duplicate the same deterministic condition.

| Opponent | Seed | Seconds | Fly result | Stocks Fox / Fly | Damage dealt / received |
| --- | ---: | ---: | --- | --- | --- |
| stationary | 7 | 7.05 | fly_win | 0 / 3 | 32 / 0 |
| stationary | 29 | 7.05 | fly_win | 0 / 3 | 32 / 0 |
| rushdown | 7 | 14.60 | fly_loss | 3 / 0 | 8 / 64 |
| rushdown | 29 | 19.73 | fly_loss | 2 / 0 | 16 / 88 |
| retreat_punish | 7 | 14.20 | fly_loss | 1 / 0 | 16 / 32 |
| retreat_punish | 29 | 14.52 | fly_win | 0 / 1 | 32 / 24 |
| jump_crossup | 7 | 35.73 | fly_win | 0 / 1 | 16 / 40 |
| jump_crossup | 29 | 20.57 | fly_win | 0 / 1 | 24 / 24 |
| edge_bait | 7 | 13.25 | fly_win | 0 / 3 | 24 / 24 |
| edge_bait | 29 | 10.53 | fly_win | 0 / 2 | 24 / 16 |
| shuttle | 7 | 120.00 | timeout | 2 / 3 | 8 / 0 |
| shuttle | 29 | 120.00 | timeout | 3 / 3 | 0 / 0 |

### Actionable findings

1. **Sustained pursuit/attack timing fails against the shuttle.** Each two-minute bout requests attack on 120 frames and reverses axis 119–121 times, but produces just 8 or 0 observed damage. The longest damage-free runs are 7,152 frames (119.2 seconds) and 7,200 frames (120 seconds). Mean active-model-node counts remain 125,425 and 125,090. This is ineffective control despite continuing model activity, not a renderer explanation. Prioritize tracing relative position/facing/velocity through attack startup and testing predictive reach or pulse timing as explicit authored controller changes.
2. **Rushdown wins both phase variants.** Fly loses 0–3 and 0–2 on stocks after 14.60 and 19.73 seconds, dealing only 8/16 damage while receiving 64/88. Of seven recovery excursions, six end in stock loss and one lands. On the final seed-29 loss at tick 1,184, Fly still has one jump, no hitlag/hitstun, a recovery sensor of 1, inward axis 905, and no jump request at x=-113.121, y=3.6. This is a concrete reproduction for investigating recovery jump-pulse timing, cooldown and model latency. It does not prove that a last-frame jump could save that state; earlier counterfactuals are needed. Five of the other rushdown stock-loss events have no remaining jump.
3. **Timing matters.** Retreat/punish seed 7 beats Fly, while seed 29 loses with Fly at one stock. Both cross-up cases leave Fly with only one stock. Edge-bait wins by Fly reflect these particular authored policies, including their recovery mistakes; they do not establish robust edge play.
4. **No observed numerical failure.** Every emitted motor value remains finite and within 0..1, every decoded control stays bounded, model/game ticks advance, and sampled packed-byte saturation is zero at the 300-frame checkpoints. All per-frame native/WASM hashes agree; the complete seed-7 rushdown replay after model reset matches all metrics and its full activity/motor/opponent/game trace. These checks establish software reproducibility, not biological validity, strategic competence or universal stability.

The model and game mechanics were not tuned to these results. The full evidence is retained in `data/long-matches.json`, including stock-loss control snapshots, activity samples, recovery counts, checksums and protocol limits. Publishing remains explicitly deferred.
