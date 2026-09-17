import type {BrainCameraPreset,CaptureFlags,CaptureView,GameCameraPreset} from './types';
import {CAPTURE_PRESETS,CAPTURE_SHOTS} from './presets';

const gameCameras=new Set<GameCameraPreset>(['clean','trailer','close','impact','wide','still']);
const brainCameras=new Set<BrainCameraPreset>(['front','push','orbit-subtle','close']);

export function parseCaptureFlags(search = typeof location !== 'undefined' ? location.search : ''): CaptureFlags {
  const q = new URLSearchParams(search);
  const shotRaw=q.get('shot');
  const shot=shotRaw?CAPTURE_SHOTS[shotRaw]:null;
  const raw = q.get('capture')??shot?.replay??null;
  const viewRaw = q.get('view');
  const view: CaptureView = viewRaw === 'brain'||viewRaw==='split' ? viewRaw : shot?.view??'game';
  const cameraRaw=q.get('camera') as GameCameraPreset|null;
  const brainRaw=q.get('brainCamera') as BrainCameraPreset|null;
  return {
    preset: raw && CAPTURE_PRESETS[raw] ? raw : null,
    shot:shot?.shot??null,
    view,
    camera:cameraRaw&&gameCameras.has(cameraRaw)?cameraRaw:shot?.camera??'clean',
    brainCamera:brainRaw&&brainCameras.has(brainRaw)?brainRaw:shot?.brainCamera??'front',
    debug: q.get('debug') === '1',
    loop: q.get('loop') === '1',
    exportMode: q.get('export') === '1' || q.get('mode') === 'export',
  };
}

export function isCaptureMode(flags: CaptureFlags): boolean {
  return Boolean(flags.preset && CAPTURE_PRESETS[flags.preset]);
}
