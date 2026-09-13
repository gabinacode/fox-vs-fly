/**
 * Activity adapter for the cinematic renderer.
 *
 * Implementations write per-visual-soma intensities into `out` (length = positioned
 * neuron count). Values are in [0, 1] before display scaling.
 *
 * Real model / LIF / rate activity should implement this interface and map through
 * geometry.visual_indices. Do not silently invent biological claims.
 */
export interface ActivitySource {
  /** Stable machine-readable provenance tag shown in debug overlay. */
  readonly provenance:
    | 'SYNTHETIC_CINEMATIC_TIMELINE'
    | 'EXTERNAL_BUFFER'
    | 'MODEL_RATE'
    | 'MODEL_LIF';
  /** Human-readable honesty note. */
  readonly description: string;
  /** Fill `out[i]` for visual soma i at absolute frame `frame`. Deterministic. */
  fill(frame: number, out: Float32Array): void;
}
