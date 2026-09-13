import type {CinematicBrainScene} from './scene';
import type {CinematicTuning} from './config';
import {FPS, HEIGHT, TOTAL_FRAMES, WIDTH} from './config';

export type CinematicExportApi = {
  ready: boolean;
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  neuronCount: number;
  geometryProvenance: string;
  activityProvenance: string;
  activityDescription: string;
  renderFrame(frame: number): Promise<void>;
  getFrame(): number;
  getCanvas(): HTMLCanvasElement;
  setTuning(partial: Partial<CinematicTuning>): void;
  getTuning(): CinematicTuning;
};

declare global {
  interface Window {
    __CINEMATIC__?: CinematicExportApi;
  }
}

export function installExportApi(scene: CinematicBrainScene) {
  let current = 0;
  const api: CinematicExportApi = {
    ready: true,
    width: WIDTH,
    height: HEIGHT,
    fps: FPS,
    totalFrames: TOTAL_FRAMES,
    neuronCount: scene.neuronCount,
    geometryProvenance: scene.geometryProvenance,
    activityProvenance: scene.getActivitySource().provenance,
    activityDescription: scene.getActivitySource().description,
    async renderFrame(frame: number) {
      current = Math.max(0, Math.min(TOTAL_FRAMES - 1, Math.floor(frame)));
      scene.renderFrame(current);
      // Yield so WebGL can flush before Playwright screenshots.
      await new Promise<void>(r => requestAnimationFrame(() => r()));
    },
    getFrame: () => current,
    getCanvas: () => scene.canvas,
    setTuning: partial => scene.setTuning(partial),
    getTuning: () => scene.getTuning(),
  };
  window.__CINEMATIC__ = api;
  return api;
}
