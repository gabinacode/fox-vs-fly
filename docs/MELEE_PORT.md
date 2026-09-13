# Melee behavior evidence

Reference: [doldecomp/melee](https://github.com/doldecomp/melee/tree/114e34ac5024211729b673baff28562143f910a0), US 1.02 decomp, inspected 2026-09-11. Code is a reference, not linked or copied wholesale. Paths below relative to src/melee. All numeric gameplay parameters in this prototype are authored tuning values, NOT verified Fox constants. No mechanic is REFERENCE_MATCHED yet.

## Reference acquisition (developer-only)

The **shipped browser game** never loads Nintendo disc images, Dolphin, or decomp. Players install nothing Nintendo-related.

Developers **may** use a personally owned Melee disc image (e.g. `.rvz`) and Dolphin, and/or a local checkout of the pinned decomp, **outside the shipped tree** to observe frame-level behavior and produce fixtures the C++/WASM sim must match. Commit only derived fixtures/tests and documentation—not the disc image, dumps of art/audio/character files, or Dolphin itself. Keep source media gitignored (see root `.gitignore`). Document commit hashes, fixture provenance (decomp-derived vs ROM-observed), and remaining approximations here before upgrading any fidelity status.

| Mechanic | Decomp files / functions | Constants / behavior | Status / differences | Test coverage |
|---|---|---|---|---|
| State / action frames | ft/fighter.c; Fighter_ChangeMotionState (called by inspected Jump/KneeBend) | action transitions and animation clock | APPROXIMATE; small enum with integer frame clock | attack phases, jump, replay |
| Gravity / terminal velocity | ft/ftcommon.c: ftCommon_Fall, ftCommon_FallBasic; ft/ft_081B.c: ft_80084DB0 | subtract gravity, clamp downward terminal; co_attrs.gravity, terminal_velocity | PARTIALLY_MATCHED formula; authored gravity 0.18 and terminal 3.1, integer arithmetic | gravity, terminal |
| Fastfall | ft/ftcommon.c: ftCommon_FallFast, ftCommon_CheckFallFast; ft_80084DB0 | separate fastfall flag and speed; fast_fall_velocity | PARTIALLY_MATCHED; 4.5 authored; downward hold rather than analog tap window | fastfall persistence, landing reset |
| Jump / jumpsquat | ft/kinds/ftCommon/ftCo_KneeBend.c: ftCo_KneeBend_Anim; ftCo_Jump.c: ftCo_800CB110, ftCo_Jump_Enter | jump_startup_time; initial vertical and clamped horizontal velocity | PARTIALLY_MATCHED; sticky button-release short hop and first-launch physics skip. Authored 3 squat frames, 3.8 full / 2.2 short impulse; no inherited jump multiplier | exhaustive release-window semantic fixtures, launch physics, apex, reset/hash; existing jump timing |
| Double jump | ft/kinds/ftCommon/ftCo_JumpAerial.c (location identified, detailed validation pending) | character-dependent aerial jump data | APPROXIMATE; one extra jump, 3.5 impulse | double jump limit, edge trigger |
| Walk / dash / run / traction | ft/kinds/ftCommon/ftCo_Dash.c; ft/ftcommon.c grounded movement helpers | analog inputs, acceleration, friction | APPROXIMATE; 0.18 accel, 1.75 ground cap, 0.12 traction; walk for partial axis, dash first 10 frames | motion, traction |
| Aerial drift | ft/ftcommon.c: ftCommon_CalcSelfAccel_Drift; ft_80084DB0 | co_attrs air acceleration / speed | APPROXIMATE; 0.075 accel and 1.4 cap; no input air drag | drift/replay |
| ECB / stage / landing | mp/mpcoll.c (target for later inspection); ftCo_Jump_Coll calls ft_800835B0 | environment collision box and stage lines | APPROXIMATE; swept feet crossing one plane with interpolated crossing x, half-width 68 | landing, off-edge, swept crossing |
| Hit/hurtboxes, damage, knockback, hitlag, hitstun | ft/kinds/ftCommon/ftCo_Damage.c and ftCo_Attack1.c (targets for detailed inspection) | animation-driven hitboxes, damage formulas | APPROXIMATE; one forward box, 8 damage, linear knockback, 5 hitlag, authored stun; simultaneous trades | startup/active/recovery, hit once, range, facing, trade, damage/lag/stun |
| Death / stocks / respawn / blast zones | ft/kinds/ftCommon (Dead/Rebirth target discovery pending) | stage blast boundaries and stock rules | APPROXIMATE; 3 stocks, x ±115, y -65/+95, 75-frame respawn immunity | stock loss, respawn, match end |
| Shield / grab / DI / ledges / specials | not inspected yet | no constants imported | NOT_IMPLEMENTED | none |

Implementation constants: sim/include/game.h and sim/core/game.cpp. Tests: sim/tests/game_tests.cpp. Replay compares native and WASM hashes on every serialized fixture frame. That proves implementation consistency only. Next fidelity work must pin source functions and/or document ROM-observed numeric fixtures, then add differential tests before upgrading any status.

## Jump refinement — 2026-09-13
Re-inspected the same pinned commit (local HEAD verified). `ftCo_KneeBend_Enter` clears the short-hop flag; `ftCo_KneeBend_Check_ShortHop` latches it when XY is released. `ftCo_KneeBend_Anim` enters Jump at the startup threshold. `ftCo_800CB110` selects hop versus full vertical attributes; `ftCo_Jump_Phys_Inner` returns without normal aerial physics on its first call. Fighter setup schedules animation (`Fighter_8006A360`, priority 1) before input (`Fighter_Spaghetti_8006AD10`, priority 3). Our button-only interface reproduces the release latch before the launch boundary and skips gravity/drift on the takeoff step. Subsequent frames resume authored gravity/drift.

`sim/tests/jump_reference.cpp` independently enumerates all eight release masks across the two remaining squat frames and the launch frame: release before launch selects short hop even if re-pressed, release on launch is too late. Fixtures also check full/short takeoff velocity, following-frame gravity, lower short-hop apex, next-jump latch reset and hash coverage. These are decomp-derived semantic fixtures using our authored attributes, **not yet ROM-observed trajectories or full-game differential validation** (ROM-observed fixtures are allowed when labeled and committed without shipping the disc). Analog tap jump, IASA cancels, animation fallback, character attributes, horizontal jump momentum and exact input pipeline remain unmatched. Short hop is shared with the original Fly fighter.

The additional short-hop latch is serialized in fighter_field index 17 and included in game_hash. State hash layout now covers 18 fighter fields. Historical replay hashes from the earlier layout are not comparable; native/WASM checks still compare every state of the same build.
