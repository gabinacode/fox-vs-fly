import type {ActivitySource} from './types';
import {CINEMATIC_SEED, mulberry32} from '../rng';
import {activityEnvelope, frameToTime, smoothstep} from '../timeline';

type Cluster = {
  phase: number;
  amp: number;
  /** 0 white-hot, 0.35 teal, 0.7 amber, 1.0 fight-red. SYNTHETIC palette. */
  hue: number;
  pulseHz: number;
  indices: Uint32Array;
  weights: Float32Array;
};

/**
 * SYNTHETIC_CINEMATIC_TIMELINE
 *
 * Artistic, deterministic activity for the LinkedIn reveal only.
 * Uses measured MaleCNS soma coordinates as a spatial substrate, but the
 * ignition clusters, envelopes, colors and pulses are authored for cinema —
 * they are NOT spikes, rates, or measured biological activity from MaleCNS.
 */
export class CinematicTimelineActivity implements ActivitySource {
  readonly provenance = 'SYNTHETIC_CINEMATIC_TIMELINE' as const;
  readonly description =
    'Synthetic cinematic timeline on measured soma positions — not biological activity';

  private readonly clusters: Cluster[];
  private readonly count: number;

  constructor(positions: Float32Array, clusterCount = 52) {
    this.count = positions.length / 3;
    const rand = mulberry32(CINEMATIC_SEED);
    this.clusters = [];
    for (let c = 0; c < clusterCount; c++) {
      const idx = Math.floor(rand() * this.count);
      const cx = positions[idx * 3];
      const cy = positions[idx * 3 + 1];
      const cz = positions[idx * 3 + 2];
      const radius = 0.06 + rand() * 0.16;
      const r2 = radius * radius;
      const ids: number[] = [];
      const ws: number[] = [];
      for (let v = 0, i = 0; v < this.count; v++, i += 3) {
        const dx = positions[i] - cx;
        const dy = positions[i + 1] - cy;
        const dz = positions[i + 2] - cz;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > r2 * 4) continue;
        const w = Math.exp(-d2 / (r2 * 0.5));
        if (w < 0.025) continue;
        ids.push(v);
        ws.push(w);
      }
      const roll = rand();
      // Mostly neutral; sparse fight-red tags only (hue > 0.9 in shader).
      const hue = roll < 0.12 ? 1.0 : 0.0;
      this.clusters.push({
        phase: rand(),
        amp: 0.65 + rand() * 0.5,
        hue,
        pulseHz: 1.6 + rand() * 2.4,
        indices: Uint32Array.from(ids),
        weights: Float32Array.from(ws),
      });
    }
  }

  /** Color-channel mix weight / hue selector per visual soma. Pure function of frame. */
  fillColorHint(frame: number, out: Float32Array) {
    if (out.length !== this.count) throw Error('Activity buffer length mismatch');
    out.fill(0);
    const strength = new Float32Array(this.count);
    const time = frameToTime(frame);
    const env = activityEnvelope(time);
    if (env <= 0) return;
    for (const cl of this.clusters) {
      const gate = clusterIntensity(time, cl.phase, cl.pulseHz) * env;
      if (gate < 0.02) continue;
      for (let k = 0; k < cl.indices.length; k++) {
        const v = gate * cl.weights[k];
        const i = cl.indices[k];
        if (v > strength[i]) {
          strength[i] = v;
          out[i] = cl.hue;
        }
      }
    }
  }

  /** @deprecated use fillColorHint — kept for call-site clarity during transition */
  fillRedHint(frame: number, out: Float32Array) {
    this.fillColorHint(frame, out);
  }

  fill(frame: number, out: Float32Array) {
    if (out.length !== this.count) throw Error('Activity buffer length mismatch');
    out.fill(0);
    const time = frameToTime(frame);
    const TRAIL = 10;
    const DECAY = 0.84;
    for (let age = 0; age <= TRAIL; age++) {
      const f = frame - age;
      if (f < 0) break;
      const t = frameToTime(f);
      const env = activityEnvelope(t);
      if (env <= 0) continue;
      const weight = Math.pow(DECAY, age);
      for (const cl of this.clusters) {
        const gate = clusterIntensity(t, cl.phase, cl.pulseHz) * env * cl.amp * weight;
        if (gate < 0.01) continue;
        for (let k = 0; k < cl.indices.length; k++) {
          const v = gate * cl.weights[k];
          const i = cl.indices[k];
          if (v > out[i]) out[i] = v;
        }
      }
    }
    for (let i = 0; i < out.length; i++) if (out[i] > 1) out[i] = 1;
  }
}

function clusterIntensity(time: number, phase: number, pulseHz: number) {
  // Staggered ignition across the full shot; long sustain so flashes never die mid-way.
  const start = 0.4 + phase * 2.6;
  const peak = start + 0.28;
  const end = Math.min(4.35, peak + 1.8 + phase * 0.6);
  const envelope = smoothstep(start, peak, time) * (1 - 0.45 * smoothstep(peak, end, time));
  const pulse = 0.5 + 0.5 * Math.sin((time - start) * Math.PI * 2 * pulseHz + phase * 6.28);
  // Ongoing shimmer so quieter clusters still breathe for the whole take.
  const shimmer =
    0.18 + 0.22 * Math.sin(time * Math.PI * 2 * (pulseHz * 0.55) + phase * 3.1);
  return Math.max(
    envelope * pulse,
    shimmer * smoothstep(0.45, 0.9, time) * (1 - 0.35 * smoothstep(4.0, 4.5, time)),
  );
}

/**
 * External activity adapter: caller supplies full-population activity or
 * already-mapped visual intensities for real model / LIF / rate injection.
 */
export class ExternalBufferActivity implements ActivitySource {
  readonly provenance: 'EXTERNAL_BUFFER' | 'MODEL_RATE' | 'MODEL_LIF';
  readonly description: string;
  private visual: Float32Array | null = null;
  private full: Uint8Array | Float32Array | null = null;
  private indices: Uint32Array | null = null;
  private normalize255 = false;

  constructor(opts: {
    provenance?: ExternalBufferActivity['provenance'];
    description?: string;
  } = {}) {
    this.provenance = opts.provenance ?? 'EXTERNAL_BUFFER';
    this.description =
      opts.description ??
      'External activity buffer — caller-provided; not generated by the cinematic timeline';
  }

  setVisualActivity(values: Float32Array | Uint8Array, asBytes = false) {
    this.visual = new Float32Array(values.length);
    for (let i = 0; i < values.length; i++) this.visual[i] = asBytes ? values[i] / 255 : Number(values[i]);
    this.full = null;
  }

  setFullPopulationActivity(
    values: Uint8Array | Float32Array,
    visualIndices: Uint32Array,
    asBytes = values instanceof Uint8Array,
  ) {
    this.full = values;
    this.indices = visualIndices;
    this.visual = null;
    this.normalize255 = asBytes;
  }

  fill(_frame: number, out: Float32Array) {
    if (this.visual) {
      if (this.visual.length !== out.length) throw Error('Visual activity length mismatch');
      out.set(this.visual);
      return;
    }
    if (!this.full || !this.indices) {
      out.fill(0);
      return;
    }
    if (this.indices.length !== out.length) throw Error('visual_indices length mismatch');
    const src = this.full;
    const scale = this.normalize255 ? 1 / 255 : 1;
    for (let i = 0; i < out.length; i++) out[i] = Number(src[this.indices[i]]) * scale;
  }
}
