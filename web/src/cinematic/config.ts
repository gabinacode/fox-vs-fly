/**
 * Production cinematic constants for the LinkedIn MaleCNS reveal.
 * Preview UI may override some of these; export mode always uses these values.
 */

export const FPS = 60;
/** 4.5 s at 60 fps — continuous motion, no mid-shot pause. */
export const TOTAL_FRAMES = 270;
export const WIDTH = 1080;
export const HEIGHT = 1350;

export const SHOW_EDGES = false;
/** Max spatial-proximity lines when SHOW_EDGES is enabled. Not biological synapses. */
export const EDGE_SAMPLE_COUNT = 3_200;
export const EDGE_OPACITY = 0.045;

export const POINT_SIZE_PX = 2.05;
export const ACTIVITY_MULTIPLIER = 1.45;
export const BLOOM_STRENGTH = 0.38;
export const BLOOM_RADIUS = 0.42;
export const BLOOM_THRESHOLD = 0.55;

/** Continuous push-in + yaw over the full 4.5 s. */
export const CAMERA_DISTANCE_START = 5.05;
export const CAMERA_DISTANCE_END = 4.15;
export const CAMERA_YAW_START_DEG = -1.5;
export const CAMERA_YAW_END_DEG = 11.5;
export const CAMERA_PITCH_START = 0.04;
export const CAMERA_PITCH_END = -0.06;
export const CAMERA_FOV = 26;
export const CAMERA_LOOK_AT = {x: 0, y: 0.0, z: 0} as const;

/**
 * Depth fog: subtle readability aid. Keeps the full cloud visible.
 * SYNTHETIC_VISUAL — not a biological depth cue.
 */
export const FOG_NEAR = 2.0;
export const FOG_FAR = 6.5;

export const BG = 0x000000;

export type CinematicTuning = {
  showEdges: boolean;
  pointSize: number;
  activityMultiplier: number;
  bloomStrength: number;
  edgeOpacity: number;
};

export const PRODUCTION_TUNING: CinematicTuning = {
  showEdges: SHOW_EDGES,
  pointSize: POINT_SIZE_PX,
  activityMultiplier: ACTIVITY_MULTIPLIER,
  bloomStrength: BLOOM_STRENGTH,
  edgeOpacity: EDGE_OPACITY,
};

export function parseQueryFlags(search = location.search) {
  const q = new URLSearchParams(search);
  return {
    exportMode: q.get('export') === '1' || q.get('mode') === 'export',
    debugOverlay: q.get('debug') === '1',
    showEdges: q.has('edges') ? q.get('edges') === '1' : SHOW_EDGES,
    frame: q.has('frame') ? Math.max(0, Math.floor(Number(q.get('frame')))) : null,
  };
}
