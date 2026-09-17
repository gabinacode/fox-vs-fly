import type {ControllerInput} from '../../../brain/include/types';

/** LinkedIn capture beat markers — editing aids, not biological claims. */
export type CaptureMarker = {
  id: string;
  tick: number;
  /** Seconds at 60 Hz game clock. */
  t: number;
  kind?: string;
  label?: string;
  editWindow: {
    preFrames: number;
    postFrames: number;
    cutInTick: number;
    cutOutTick: number;
  };
};

export type CapturePreset = {
  /** URL name, e.g. hero-sequence */
  preset: string;
  /** Search id from scripts/capture_sequence_search.mjs */
  id: string;
  role: string;
  chain: boolean;
  durationFrames: number;
  /** Run-length [axis, buttons, frames] — expands to per-tick Fox input. */
  inputRle: Array<[number, number, number]>;
  markers: CaptureMarker[];
  suggestedCaptureWindow: {startTick: number; endTick: number};
};

export type CaptureView = 'game' | 'brain' | 'split';
export type GameCameraPreset = 'clean' | 'trailer' | 'close' | 'impact' | 'wide' | 'still';
export type BrainCameraPreset = 'front' | 'push' | 'orbit-subtle' | 'close';

export type CaptureShot = {
  shot: string;
  replay: string;
  view: CaptureView;
  startTick: number;
  endTick: number;
  camera: GameCameraPreset;
  brainCamera: BrainCameraPreset;
  /**
   * Presentation override: from this observation tick inclusive, Fly sim input is forced idle
   * (axis/buttons 0). Live motor readout is still decoded for display; only gameplay input is held.
   */
  freezeFlyAfterTick?: number;
};

export type CaptureFlags = {
  preset: string | null;
  shot: string | null;
  view: CaptureView;
  camera: GameCameraPreset;
  brainCamera: BrainCameraPreset;
  debug: boolean;
  loop: boolean;
  exportMode: boolean;
};

/** Fixed LinkedIn export plate — matches brain cinematic. */
export const CAPTURE_EXPORT_WIDTH = 1080;
export const CAPTURE_EXPORT_HEIGHT = 1350;
export const CAPTURE_EXPORT_FPS = 60;

export type CaptureExportApi = {
  ready: boolean;
  preset: string;
  shot: string;
  view: CaptureView;
  camera: GameCameraPreset;
  brainCamera: BrainCameraPreset;
  fps: number;
  width: number;
  height: number;
  totalFrames: number;
  durationFrames: number;
  markers: CaptureMarker[];
  suggestedCaptureWindow: {startTick: number; endTick: number};
  musicNote: string;
  exportMode: boolean;
  getTick(): number;
  getFrame(): number;
  getCanvas(): HTMLCanvasElement | null;
  /** Absolute-frame seek + draw for deterministic PNG export. */
  renderFrame(frame: number): Promise<void>;
  replay(): void;
  pause(): void;
};

export function expandInputRle(rle: Array<[number, number, number]>): ControllerInput[] {
  const out: ControllerInput[] = [];
  for (const [axis, buttons, frames] of rle) {
    if (!Number.isInteger(frames) || frames < 1) throw Error('Invalid capture RLE length');
    for (let i = 0; i < frames; i++) out.push({axis, buttons});
  }
  return out;
}

declare global {
  interface Window {
    __CAPTURE__?: CaptureExportApi;
  }
}
