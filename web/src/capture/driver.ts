import type {Session} from '../game/session';
import type {BrainCameraPreset,CaptureExportApi,CapturePreset,CaptureShot,CaptureView,GameCameraPreset} from './types';
import {CAPTURE_EXPORT_FPS, CAPTURE_EXPORT_HEIGHT, CAPTURE_EXPORT_WIDTH, expandInputRle} from './types';
import {ScriptedInput} from './scripted_input';

export function installCaptureDriver(opts: {
  session: Session;
  preset: CapturePreset;
  shot: CaptureShot|null;
  view: CaptureView;
  camera:GameCameraPreset;
  brainCamera:BrainCameraPreset;
  loop: boolean;
  exportMode: boolean;
  getGameCanvas: () => HTMLCanvasElement | null;
  getBrainCanvas: () => HTMLCanvasElement | null;
  getCompositeCanvas:()=>HTMLCanvasElement|null;
  /** Draw current session state to canvases (ingest brain + drawGame). */
  drawNow: (localFrame:number,totalFrames:number) => void;
  onStatus?: (message: string) => void;
}): {api: CaptureExportApi; dispose: () => void; tryStart: () => void} {
  const timeline = expandInputRle(opts.preset.inputRle);
  const scripted = new ScriptedInput(timeline);
  opts.session.input = scripted as unknown as Session['input'];
  if (opts.exportMode) opts.session.exportDrive = true;
  opts.session.flyIdleAfterTick = opts.shot?.freezeFlyAfterTick ?? null;

  const startTick=opts.shot?.startTick??opts.preset.suggestedCaptureWindow.startTick;
  const endTick = opts.shot?.endTick??opts.preset.suggestedCaptureWindow.endTick;
  const totalFrames = endTick-startTick+1;
  let disposed = false;
  let autoStarted = false;
  let exportFrame = 0;
  let stepping = false;

  const rewindSim = () => {
    scripted.rewind();
    opts.session.reset();
    exportFrame = 0;
  };

  const advanceTo=async(target:number)=>{while(opts.session.state.tick<target)await opts.session.stepOnce();};

  const replay = () => {
    void (async()=>{
      rewindSim();await advanceTo(startTick);exportFrame=0;
      opts.drawNow(0,totalFrames);
      if (!opts.exportMode) {
        opts.session.play();
        opts.onStatus?.(`Capture ${opts.shot?.shot??opts.preset.preset} · replaying`);
      } else opts.onStatus?.(`Capture ${opts.shot?.shot??opts.preset.preset} · export reset`);
    })().catch(e=>opts.onStatus?.(`Capture error: ${String(e)}`));
  };

  const renderFrame = async (frame: number) => {
    if (stepping) throw Error('Capture renderFrame already in progress');
    const local = Math.max(0, Math.min(totalFrames - 1, Math.floor(frame)));
    const target=startTick+local;
    stepping = true;
    try {
      if (opts.session.state.tick > target || exportFrame > local) {
        rewindSim();
      }
      await advanceTo(target);
      exportFrame = local;
      opts.drawNow(local,totalFrames);
      // Flush paint before Playwright reads the canvas.
      await new Promise<void>(r => requestAnimationFrame(() => r()));
    } finally {
      stepping = false;
    }
  };

  const api: CaptureExportApi = {
    ready: false,
    preset: opts.preset.preset,
    shot:opts.shot?.shot??opts.preset.preset,
    view: opts.view,
    camera:opts.camera,
    brainCamera:opts.brainCamera,
    fps: CAPTURE_EXPORT_FPS,
    width: CAPTURE_EXPORT_WIDTH,
    height: CAPTURE_EXPORT_HEIGHT,
    totalFrames,
    durationFrames: opts.preset.durationFrames,
    markers: opts.preset.markers,
    suggestedCaptureWindow: {startTick,endTick},
    musicNote:
      'Edit to Aphex Twin 180db_[130] (~130 BPM) in Premiere. Footage contains no music; model is not paced to the beat.',
    exportMode: opts.exportMode,
    getTick: () => opts.session.state.tick,
    getFrame: () => exportFrame,
    getCanvas: () => opts.view==='split'?opts.getCompositeCanvas():(opts.view === 'brain' ? opts.getBrainCanvas() : opts.getGameCanvas()),
    renderFrame,
    replay,
    pause: () => opts.session.pause(),
  };
  window.__CAPTURE__ = api;

  const watch = window.setInterval(() => {
    if (disposed || opts.exportMode) return;
    const tick = opts.session.state.tick;
    if (opts.session.running && tick >= endTick) {
      if (opts.loop) {
        replay();
      } else {
        opts.session.pause();
        opts.onStatus?.(`Capture complete at tick ${tick}`);
      }
    }
  }, 16);

  const tryStart = () => {
    if (disposed || autoStarted) return;
    if (!opts.session.state) return;
    autoStarted = true;
    void (async()=>{
      rewindSim();await advanceTo(startTick);if(disposed)return;exportFrame=0;opts.drawNow(0,totalFrames);api.ready = true;
      if (opts.exportMode) {opts.onStatus?.(`Capture ${api.shot} · export ready · view=${opts.view}`);return;}
      opts.onStatus?.(`Capture ${api.shot} · view=${opts.view} · autoplay`);
      requestAnimationFrame(() => {if (!disposed) opts.session.play();});
    })().catch(e=>opts.onStatus?.(`Capture error: ${String(e)}`));
  };

  return {
    api,
    tryStart,
    dispose: () => {
      disposed = true;
      opts.session.flyIdleAfterTick = null;
      window.clearInterval(watch);
      if (window.__CAPTURE__ === api) delete window.__CAPTURE__;
    },
  };
}
