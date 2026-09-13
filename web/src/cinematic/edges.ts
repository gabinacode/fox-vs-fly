/**
 * Spatial-proximity line sample for optional edge overlay.
 *
 * SYNTHETIC_SPATIAL_PROXIMITY — these are NOT MaleCNS synapses or graph edges.
 * The full measured graph has ~25.6M directed edges and must not be drawn wholesale.
 * When a real sparse edge subset is available, pass it through setEdges().
 */
import {CINEMATIC_SEED, mulberry32} from './rng';

export function buildSpatialProximityEdges(
  positions: Float32Array,
  count: number,
): Float32Array {
  const n = positions.length / 3;
  const rand = mulberry32(CINEMATIC_SEED ^ 0x45444745); // 'EDGE'
  const out = new Float32Array(count * 6);
  let written = 0;
  // Sample random somas and connect to a nearby random neighbor in a coarse grid hash.
  const cell = 0.08;
  const buckets = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    const key = `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
    let arr = buckets.get(key);
    if (!arr) {
      arr = [];
      buckets.set(key, arr);
    }
    if (arr.length < 24) arr.push(i);
  }
  const keys = [...buckets.keys()];
  let guard = 0;
  while (written < count && guard < count * 20) {
    guard++;
    const key = keys[Math.floor(rand() * keys.length)];
    const arr = buckets.get(key)!;
    if (arr.length < 2) continue;
    const a = arr[Math.floor(rand() * arr.length)];
    const b = arr[Math.floor(rand() * arr.length)];
    if (a === b) continue;
    const o = written * 6;
    out[o] = positions[a * 3];
    out[o + 1] = positions[a * 3 + 1];
    out[o + 2] = positions[a * 3 + 2];
    out[o + 3] = positions[b * 3];
    out[o + 4] = positions[b * 3 + 1];
    out[o + 5] = positions[b * 3 + 2];
    written++;
  }
  return out.subarray(0, written * 6);
}
