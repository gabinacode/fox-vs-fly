#!/usr/bin/env node
/**
 * Search deterministic Fox input timelines for LinkedIn capture hero sequences.
 *
 * Finds REAL causal chains from the V2 rate controller AFTER model settle:
 *   Fox action → sensory/activity change → motor change → Fly visible reaction
 *
 * Music sync is an EDITING property only — this reports reproducible ticks.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {graph, api, identity, makeModel, makeSimulation} from './neural_runtime.mjs';

const calibration = JSON.parse(fs.readFileSync(new URL('../web/public/neural/readout.json', import.meta.url)));
assert.equal(calibration.graph_identity, identity);

const FPS = 60;
const BEAT_S = 60 / 130;
const BEAT_FRAMES = BEAT_S * FPS;

const input = (axis = 0, buttons = 0) => ({axis, buttons});
const hold = (ctrl, n) => Array.from({length: n}, () => ({...ctrl}));

function candidates() {
  const out = [];
  // Immediate right approach — classic closing distance.
  for (const walk of [36, 48, 60, 72, 90]) {
    out.push({
      id: `close-R-w${walk}`,
      cueTick: 0,
      frames: [...hold(input(1000), walk), ...hold(input(0), 90)],
    });
  }
  // Brief pause then approach (still before Fly attack window).
  for (const delay of [8, 12]) {
    for (const walk of [48, 72]) {
      out.push({
        id: `close-R-d${delay}-w${walk}`,
        cueTick: delay,
        frames: [...hold(input(0), delay), ...hold(input(1000), walk), ...hold(input(0), 90)],
      });
    }
  }
  // Approach + jump.
  for (const walk of [24, 36, 48]) {
    out.push({
      id: `close-jump-w${walk}`,
      cueTick: 0,
      frames: [
        ...hold(input(1000), walk),
        ...hold(input(1000, 1), 8),
        ...hold(input(1000), 24),
        ...hold(input(0), 90),
      ],
    });
  }
  // Approach + attack when close.
  for (const walk of [30, 42, 54]) {
    out.push({
      id: `close-attack-w${walk}`,
      cueTick: 0,
      frames: [
        ...hold(input(1000), walk),
        ...hold(input(1000, 4), 10),
        ...hold(input(1000), 20),
        ...hold(input(0), 90),
      ],
    });
  }
  // Cross-up: walk past Fly then reverse.
  out.push({
    id: 'crossup-R-then-L',
    cueTick: 0,
    frames: [...hold(input(1000), 70), ...hold(input(-1000), 70), ...hold(input(0), 60)],
  });
  // Feint left first (away), then commit right.
  out.push({
    id: 'feint-L-then-R',
    cueTick: 18,
    frames: [...hold(input(-1000), 18), ...hold(input(1000), 90), ...hold(input(0), 60)],
  });
  // Long fight breathe clip.
  out.push({
    id: 'breathe-rushdown',
    cueTick: 0,
    frames: [
      ...hold(input(1000), 50),
      ...hold(input(1000, 4), 8),
      ...hold(input(-1000), 40),
      ...hold(input(1000), 40),
      ...hold(input(1000, 1), 6),
      ...hold(input(1000), 30),
      ...hold(input(0), 60),
    ],
  });
  return out;
}

function motorBits(m) {
  return Array.from(m, v => (v > 0.5 ? 1 : 0)).join('');
}
function motorLabel(m) {
  const labels = ['Left', 'Right', 'Jump', 'Attack', 'Fastfall'];
  return labels.filter((_, i) => m[i] > 0.5).join('+') || 'Neutral';
}
function sensoryKey(s) {
  // Coarse bins so tiny float noise does not count as a flip.
  return Array.from(s, v => (v > 0.5 ? 1 : v > 0.15 ? 'p' : 0)).join('');
}

/**
 * Prefer a chain AFTER Fox's scripted cue, vs settle/startup baseline.
 * Requires ordered: fox visible move → (sensory or activity) → motor → fly action.
 */
function analyze(trace, cueTick) {
  const post = trace.filter(r => r.tick >= cueTick);
  if (!post.length) return {score: 0, chain: false, markers: []};

  // Baseline: last few pre-cue frames, or first post-cue if cue=0.
  const pre = trace.filter(r => r.tick < cueTick && r.tick >= Math.max(0, cueTick - 6));
  const baselineRows = pre.length ? pre : post.slice(0, 3);
  const baseActive = baselineRows.reduce((s, r) => s + r.active, 0) / baselineRows.length;
  const baseMotor = motorBits(baselineRows[baselineRows.length - 1]?.motor ?? post[0].motor);
  const baseSensory = sensoryKey(baselineRows[baselineRows.length - 1]?.sensory ?? post[0].sensory);

  let foxMoveTick = -1;
  let sensoryTick = -1;
  let activityTick = -1;
  let motorTick = -1;
  let flyTick = -1;
  let flyKind = null;
  let peakActiveDelta = 0;
  let attackMotorTick = -1;

  for (const row of post) {
    if (foxMoveTick < 0 && Math.abs(row.foxInput.axis) >= 600 && Math.abs(row.fox.vx) > 0.35) {
      foxMoveTick = row.tick;
    }
    const dActive = Math.abs(row.active - baseActive);
    peakActiveDelta = Math.max(peakActiveDelta, dActive);
    if (activityTick < 0 && foxMoveTick >= 0 && row.tick > foxMoveTick && dActive >= 4000) {
      activityTick = row.tick;
    }
    if (sensoryTick < 0 && foxMoveTick >= 0 && row.tick > foxMoveTick && sensoryKey(row.sensory) !== baseSensory) {
      sensoryTick = row.tick;
    }
    const mb = motorBits(row.motor);
    if (motorTick < 0 && foxMoveTick >= 0 && row.tick > foxMoveTick && mb !== baseMotor) {
      motorTick = row.tick;
    }
    if (attackMotorTick < 0 && row.motor[3] > 0.5) attackMotorTick = row.tick;

    if (flyTick < 0 && foxMoveTick >= 0 && row.tick >= foxMoveTick + 6) {
      const flyAttack = row.fly.action === 6;
      const flyJump = row.fly.action === 4 || row.fly.action === 5 || (!row.fly.grounded && Math.abs(row.fly.vy) > 1.2);
      const flyTurn =
        Math.sign(row.fly.vx) !== 0 &&
        Math.sign(row.fly.vx) !== Math.sign(post.find(r => r.tick === foxMoveTick)?.fly.vx || row.fly.vx) &&
        Math.abs(row.fly.vx) > 0.5;
      // Prefer discrete actions over continuous approach velocity.
      if (flyAttack) {
        flyTick = row.tick;
        flyKind = 'attack';
      } else if (flyJump) {
        flyTick = row.tick;
        flyKind = 'jump';
      } else if (flyTurn) {
        flyTick = row.tick;
        flyKind = 'turn';
      } else if (Math.abs(row.fly.vx) > 0.8 && row.fly.action >= 1 && row.fly.action <= 3) {
        // Only count move if motor also changed (otherwise Fly was already approaching).
        if (motorTick >= 0 && row.tick >= motorTick) {
          flyTick = row.tick;
          flyKind = 'move';
        }
      }
    }
  }

  // If no discrete fly action, accept first post-motor velocity commit.
  if (flyTick < 0 && motorTick >= 0) {
    const afterMotor = post.find(
      r => r.tick >= motorTick + 2 && Math.abs(r.fly.vx) > 0.6 && (r.fly.action === 1 || r.fly.action === 2 || r.fly.action === 3),
    );
    if (afterMotor) {
      flyTick = afterMotor.tick;
      flyKind = 'move';
    }
  }

  const modelTick = sensoryTick >= 0 ? sensoryTick : activityTick;
  const ordered =
    foxMoveTick >= 0 &&
    modelTick >= 0 &&
    motorTick >= 0 &&
    flyTick >= 0 &&
    foxMoveTick <= modelTick &&
    modelTick <= motorTick + 12 &&
    motorTick <= flyTick + 8;

  const span = flyTick >= 0 && foxMoveTick >= 0 ? flyTick - foxMoveTick : 9999;
  // Useful for ~0.5 s pre + event + 0.5–1 s post at 130 BPM.
  const editable = span >= 12 && span <= 120;

  let score = 0;
  if (foxMoveTick >= 0) score += 10;
  if (sensoryTick >= 0) score += 18;
  if (activityTick >= 0) score += 12;
  if (motorTick >= 0) score += 18;
  if (flyTick >= 0) score += 20;
  if (flyKind === 'attack') score += 14;
  if (flyKind === 'jump') score += 12;
  if (flyKind === 'turn') score += 10;
  if (attackMotorTick >= 0) score += 6;
  if (ordered) score += 40;
  if (editable) score += 16;
  score += Math.min(15, peakActiveDelta / 3000);

  const markers = [
    foxMoveTick >= 0 && {id: 'fox-move', tick: foxMoveTick, t: foxMoveTick / FPS},
    sensoryTick >= 0 && {id: 'sensory-change', tick: sensoryTick, t: sensoryTick / FPS},
    activityTick >= 0 && {id: 'model-activity-delta', tick: activityTick, t: activityTick / FPS},
    motorTick >= 0 && {
      id: 'motor-change',
      tick: motorTick,
      t: motorTick / FPS,
      label: motorLabel(trace.find(r => r.tick === motorTick)?.motor ?? new Float32Array(5)),
    },
    flyTick >= 0 && {id: 'fly-react', tick: flyTick, t: flyTick / FPS, kind: flyKind},
  ].filter(Boolean);

  return {
    score,
    chain: ordered,
    foxMoveTick,
    sensoryTick,
    activityTick,
    motorTick,
    flyTick,
    flyKind,
    span,
    peakActiveDelta,
    markers,
  };
}

async function runCandidate(cand) {
  const brain = new api.MaleCNSBrain(graph, await makeModel(), calibration);
  const sim = await makeSimulation();
  const trace = [];
  for (let tick = 0; tick < cand.frames.length; tick++) {
    const o = sim.snapshot();
    if (o.winner !== -1) break;
    const foxIn = cand.frames[tick] ?? input();
    const f = brain.step(o);
    const m = api.motorDecode(f.motor_values);
    sim.step(foxIn, m);
    const after = sim.snapshot();
    trace.push({
      tick,
      fox: {
        x: after.fox.x,
        y: after.fox.y,
        vx: after.fox.vx,
        grounded: !!after.fox.grounded,
        action: after.fox.action,
        stocks: after.fox.stocks,
      },
      fly: {
        x: after.fly.x,
        y: after.fly.y,
        vx: after.fly.vx,
        vy: after.fly.vy,
        grounded: !!after.fly.grounded,
        action: after.fly.action,
        stocks: after.fly.stocks,
      },
      active: f.active_neuron_count,
      sensory: Array.from(f.sensory_values),
      motor: Array.from(f.motor_values),
      motorDecoded: m,
      foxInput: foxIn,
    });
  }
  return {id: cand.id, cueTick: cand.cueTick, frames: cand.frames, trace, analysis: analyze(trace, cand.cueTick)};
}

async function main() {
  const list = candidates();
  console.error(`Searching ${list.length} Fox timelines…`);
  const results = [];
  for (const cand of list) {
    const r = await runCandidate(cand);
    results.push({
      id: r.id,
      cueTick: r.cueTick,
      score: r.analysis.score,
      chain: r.analysis.chain,
      markers: r.analysis.markers,
      foxMoveTick: r.analysis.foxMoveTick,
      sensoryTick: r.analysis.sensoryTick,
      activityTick: r.analysis.activityTick,
      motorTick: r.analysis.motorTick,
      flyTick: r.analysis.flyTick,
      flyKind: r.analysis.flyKind,
      span: r.analysis.span,
      peakActiveDelta: r.analysis.peakActiveDelta,
      durationFrames: r.frames.length,
      input: r.frames.map(f => [f.axis, f.buttons]),
      keyframes: r.analysis.markers.map(m => {
        const row = r.trace.find(t => t.tick === m.tick);
        return row
          ? {
              ...m,
              foxX: row.fox.x,
              flyX: row.fly.x,
              foxVx: row.fox.vx,
              flyVx: row.fly.vx,
              flyAction: row.fly.action,
              active: row.active,
              motor: row.motor,
              sensory: row.sensory,
            }
          : m;
      }),
      _trace: r.trace,
      _frames: r.frames,
    });
    console.error(
      `${r.id}: score=${r.analysis.score} chain=${r.analysis.chain} fox=${r.analysis.foxMoveTick} sens=${r.analysis.sensoryTick} act=${r.analysis.activityTick} motor=${r.analysis.motorTick} fly=${r.analysis.flyTick}/${r.analysis.flyKind} span=${r.analysis.span}`,
    );
  }

  results.sort((a, b) => b.score - a.score || a.span - b.span);
  const hero = results.find(r => r.chain) ?? results[0];
  assert(hero, 'No capture candidates');

  const again = await runCandidate({id: hero.id, cueTick: hero.cueTick, frames: hero._frames});
  assert.equal(again.trace.length, hero._trace.length);
  for (let i = 0; i < again.trace.length; i++) {
    assert.equal(again.trace[i].active, hero._trace[i].active);
    assert.deepEqual(again.trace[i].motor, hero._trace[i].motor);
    assert.equal(again.trace[i].fly.action, hero._trace[i].fly.action);
    assert.equal(again.trace[i].fly.vx, hero._trace[i].fly.vx);
  }

  const pad = tick => ({
    preFrames: Math.round(0.5 * FPS),
    postFrames: Math.round(0.75 * FPS),
    cutInTick: Math.max(0, tick - Math.round(0.5 * FPS)),
    cutOutTick: tick + Math.round(0.75 * FPS),
  });

  // Supporting presets for the A/B/C/D/E/F edit rhythm (same determinism, different cuts).
  const byKind = (kind) => results.find(r => r.flyKind === kind && r.chain) ?? results.find(r => r.flyKind === kind);
  const supporting = {
    'fox-approach': results.find(r => r.id.startsWith('close-R')) ?? results[0],
    'fly-attack': byKind('attack'),
    breathe: results.find(r => r.id === 'breathe-rushdown'),
  };

  const pack = r =>
    r && {
      id: r.id,
      score: r.score,
      chain: r.chain,
      durationFrames: r.durationFrames,
      markers: r.markers.map(m => ({...m, editWindow: pad(m.tick)})),
      keyframes: r.keyframes,
      input: r.input,
      suggestedCaptureWindow: {
        startTick: Math.max(0, (r.foxMoveTick ?? 0) - Math.round(0.5 * FPS)),
        endTick: Math.min(r.durationFrames - 1, (r.flyTick ?? r.durationFrames - 1) + Math.round(1.0 * FPS)),
      },
    };

  const report = {
    graphIdentity: identity,
    controller: 'MaleCNSBrain V2 stable rate + calibrated readout',
    musicContext: {
      track: 'Aphex Twin — 180db_[130]',
      bpmApprox: 130,
      beatSecondsApprox: BEAT_S,
      beatFramesApprox: BEAT_FRAMES,
      note: 'Music is an EDITING property only. Model activity is not forced to 130 BPM.',
    },
    honesty:
      'Markers are deterministic game ticks from the real authored controller over measured wiring. They are not biological causality claims. Footage must not contain the music. No text is baked into capture frames.',
    searched: results.length,
    chainFound: Boolean(hero.chain),
    presets: {
      'hero-sequence': {
        ...pack(hero),
        preset: 'hero-sequence',
        role: 'Primary Fox→activity→motor→Fly chain for LinkedIn gameplay reveal',
      },
      'fox-approach': {
        ...pack(supporting['fox-approach']),
        preset: 'fox-approach',
        role: 'BEAT B — Fox obvious movement toward/around Fly',
      },
      'fly-attack': {
        ...pack(supporting['fly-attack']),
        preset: 'fly-attack',
        role: 'BEAT D — Fly attack from neural motor readout',
      },
      breathe: {
        ...pack(supporting.breathe),
        preset: 'breathe',
        role: 'BEAT F — longer fight breathe clip',
      },
    },
    hero: {
      ...pack(hero),
      preset: 'hero-sequence',
    },
    alternates: results
      .filter(r => r.id !== hero.id)
      .slice(0, 8)
      .map(r => ({
        id: r.id,
        score: r.score,
        chain: r.chain,
        markers: r.markers,
        flyKind: r.flyKind,
        span: r.span,
        durationFrames: r.durationFrames,
      })),
  };

  const out = new URL('../data/capture-sequences.json', import.meta.url);
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify(
      {
        hero: report.hero.id,
        chain: report.chainFound,
        markers: report.hero.markers,
        presets: Object.keys(report.presets),
      },
      null,
      2,
    ),
  );
  console.error(`Wrote ${out.pathname}`);
}

await main();
