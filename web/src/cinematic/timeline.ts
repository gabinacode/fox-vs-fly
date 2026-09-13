import {FPS, TOTAL_FRAMES} from './config';

/** Absolute-frame cinematic beats. Times are seconds at 60 Hz. */
export const BEATS = {
  blackHoldEnd: 0.15,
  somaFadeEnd: 0.45,
  firstActivity: 0.4,
  activityBuild: 0.85,
  activityPeakStart: 1.15,
  activityPeakEnd: 3.4,
  /** Full shot — one continuous curve, no mid-shot seam. */
  settleEnd: TOTAL_FRAMES / FPS,
} as const;

export function frameToTime(frame: number) {
  return frame / FPS;
}

export function clamp01(x: number) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Smoothstep ease. */
export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** Single continuous camera progress over the full shot. */
export function cameraProgress(time: number) {
  return smoothstep(0.1, BEATS.settleEnd - 0.15, time);
}

/** Global soma base visibility (idle), independent of activity. */
export function somaVisibility(time: number) {
  if (time < BEATS.blackHoldEnd) return 0.03 * smoothstep(0, BEATS.blackHoldEnd, time);
  return 0.03 + 0.78 * smoothstep(BEATS.blackHoldEnd, BEATS.somaFadeEnd, time);
}

/** Envelope for synthetic cinematic activity — continuous through 4.5 s. */
export function activityEnvelope(time: number) {
  if (time < BEATS.firstActivity) return 0;
  const rise = smoothstep(BEATS.firstActivity, BEATS.activityPeakStart, time);
  const peak = smoothstep(BEATS.activityPeakStart, BEATS.activityPeakEnd, time);
  const beat = 0.55 + 0.45 * Math.sin(time * Math.PI * 2 * (130 / 60));
  // Soft settle only in the last ~0.7 s — no dead zone mid-shot.
  const settle = 1 - 0.2 * smoothstep(BEATS.settleEnd - 0.7, BEATS.settleEnd, time);
  return Math.min(1.15, (0.28 * rise + 0.72 * peak) * beat) * settle;
}
