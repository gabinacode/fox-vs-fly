/**
 * Deterministic capture presets searched against MaleCNSBrain V2.
 * Regenerated evidence: data/capture-sequences.json via
 * `node scripts/capture_sequence_search.mjs`.
 *
 * Music (Aphex Twin 180db_[130] ~130 BPM) is an EDITING property only.
 */
import type {CapturePreset,CaptureShot} from './types';

const pad = (tick: number) => ({
  preFrames: 30,
  postFrames: 45,
  cutInTick: Math.max(0, tick - 30),
  cutOutTick: tick + 45,
});

const m = (
  id: string,
  tick: number,
  extra: {kind?: string; label?: string} = {},
) => ({
  id,
  tick,
  t: tick / 60,
  ...extra,
  editWindow: pad(tick),
});

/** Primary LinkedIn hero: Fox feint-left then commit-right → sensory/activity → Fly attack. */
const heroSequence: CapturePreset = {
  preset: 'hero-sequence',
  id: 'feint-L-then-R',
  role: 'Primary Fox→activity→motor→Fly chain for LinkedIn gameplay reveal',
  chain: true,
  durationFrames: 168,
  inputRle: [
    [-1000, 0, 18],
    [1000, 0, 90],
    [0, 0, 60],
  ],
  markers: [
    m('fox-move', 18),
    m('fox-approach-visible',19),
    m('model-activity-delta', 19),
    m('model-activity-visible',20),
    m('sensory-change', 32),
    m('sensory-visible',33),
    m('motor-change', 36, {label: 'Left+Attack'}),
    m('fly-react', 36, {kind: 'attack'}),
    m('fly-attack-visible',37,{kind:'attack'}),
    m('hit-impact',42,{kind:'hit',label:'Fly hits Fox for 8%'}),
  ],
  suggestedCaptureWindow: {startTick: 0, endTick: 96},
};

const foxApproach: CapturePreset = {
  preset: 'fox-approach',
  id: 'close-R-d12-w48',
  role: 'BEAT B — Fox obvious movement toward Fly after a short hold',
  chain: true,
  durationFrames: 150,
  inputRle: [
    [0, 0, 12],
    [1000, 0, 48],
    [0, 0, 90],
  ],
  markers: [
    m('fox-move', 13),
    m('model-activity-delta', 14),
    m('sensory-change', 16),
    m('motor-change', 20, {label: 'Left+Attack'}),
    m('fly-react', 20, {kind: 'attack'}),
  ],
  suggestedCaptureWindow: {startTick: 0, endTick: 80},
};

const breathe: CapturePreset = {
  preset: 'breathe',
  id: 'breathe-rushdown',
  role: 'BEAT F — longer fight breathe clip with approach, attack, reverse',
  chain: true,
  durationFrames: 234,
  inputRle: [
    [1000, 0, 50],
    [1000, 4, 8],
    [-1000, 0, 40],
    [1000, 0, 40],
    [1000, 1, 6],
    [1000, 0, 30],
    [0, 0, 60],
  ],
  markers: [
    m('fox-move', 1),
    m('model-activity-delta', 2),
    m('motor-change', 4, {label: 'Left'}),
    m('fly-react', 7, {kind: 'move'}),
    m('sensory-change', 10),
  ],
  // Full scripted bout — breathe needs room after the opening exchange.
  suggestedCaptureWindow: {startTick: 0, endTick: 180},
};

export const CAPTURE_PRESETS: Record<string, CapturePreset> = {
  'hero-sequence': heroSequence,
  /** Alias — same deterministic hero chain; cut on fly-react for BEAT D. */
  'fly-attack': {...heroSequence, preset: 'fly-attack', role: 'BEAT D — Fly attack from neural motor readout'},
  'fox-approach': foxApproach,
  breathe,
};

export const CAPTURE_PRESET_NAMES = Object.keys(CAPTURE_PRESETS);

/** Edit plates. All six use an authentic replay; only presentation and cut range differ. */
export const CAPTURE_SHOTS:Record<string,CaptureShot>={
  reveal:{shot:'reveal',replay:'hero-sequence',view:'game',startTick:0,endTick:55,camera:'wide',brainCamera:'front'},
  /** Hold past the hit so Fox's knockback fall reads; Fly motor forced idle after impact. */
  approach:{shot:'approach',replay:'hero-sequence',view:'game',startTick:0,endTick:88,camera:'trailer',brainCamera:'front',freezeFlyAfterTick:42},
  'brain-response':{shot:'brain-response',replay:'hero-sequence',view:'brain',startTick:12,endTick:67,camera:'clean',brainCamera:'push'},
  'fly-response':{shot:'fly-response',replay:'hero-sequence',view:'game',startTick:18,endTick:73,camera:'close',brainCamera:'front'},
  impact:{shot:'impact',replay:'hero-sequence',view:'game',startTick:14,endTick:69,camera:'impact',brainCamera:'front'},
  split:{shot:'split',replay:'hero-sequence',view:'split',startTick:8,endTick:63,camera:'trailer',brainCamera:'orbit-subtle'},
};

export const CAPTURE_SHOT_NAMES=Object.keys(CAPTURE_SHOTS);

export function getCapturePreset(name: string): CapturePreset | null {
  return CAPTURE_PRESETS[name] ?? null;
}

export function getCaptureShot(name:string):CaptureShot|null{return CAPTURE_SHOTS[name]??null;}
