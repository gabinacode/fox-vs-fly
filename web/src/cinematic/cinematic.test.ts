import {it, expect} from 'vitest';
import {CinematicTimelineActivity} from './activity/cinematic_timeline';
import {FPS, TOTAL_FRAMES} from './config';
import {activityEnvelope, cameraProgress, frameToTime, somaVisibility} from './timeline';

it('cinematic timeline is absolute-frame deterministic', () => {
  expect(TOTAL_FRAMES).toBe(270);
  expect(FPS).toBe(60);
  expect(frameToTime(60)).toBe(1);
  expect(somaVisibility(0)).toBeLessThan(0.05);
  expect(somaVisibility(0.6)).toBeGreaterThan(0.55);
  expect(somaVisibility(0.6)).toBeLessThan(0.95);
  expect(activityEnvelope(0.1)).toBe(0);
  expect(activityEnvelope(1.6)).toBeGreaterThan(activityEnvelope(0.7));
  expect(cameraProgress(0)).toBe(0);
  expect(cameraProgress(4.5)).toBe(1);
  // No pause: mid-shot camera still moving.
  expect(cameraProgress(2.5)).toBeGreaterThan(0.4);
  expect(cameraProgress(2.5)).toBeLessThan(0.95);
  expect(activityEnvelope(3.0)).toBeGreaterThan(0.3);
});

it('synthetic cinematic activity is a pure function of frame', () => {
  const n = 200;
  const positions = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    positions[i * 3] = (i % 10) * 0.05 - 0.25;
    positions[i * 3 + 1] = Math.floor(i / 10) * 0.05 - 0.5;
    positions[i * 3 + 2] = (i % 7) * 0.03;
  }
  const a = new CinematicTimelineActivity(positions, 8);
  const out1 = new Float32Array(n);
  const out2 = new Float32Array(n);
  a.fill(90, out1);
  a.fill(10, out2);
  a.fill(90, out2);
  expect([...out1]).toEqual([...out2]);
  expect(out1.some(v => v > 0.05)).toBe(true);
  expect(a.provenance).toBe('SYNTHETIC_CINEMATIC_TIMELINE');
});
