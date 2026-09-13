import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {
  FPS,
  HEIGHT,
  PRODUCTION_TUNING,
  TOTAL_FRAMES,
  WIDTH,
  parseQueryFlags,
} from './config';
import {installExportApi} from './export_api';
import {loadMeasuredGeometry} from './load_geometry';
import {CinematicBrainScene} from './scene';
import {frameToTime} from './timeline';
import './style.css';

type Status = 'loading' | 'ready' | 'error';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<CinematicBrainScene | null>(null);
  const playingRef = useRef(false);
  const rafRef = useRef(0);
  const flags = parseQueryFlags();
  const exportMode = flags.exportMode;

  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState('');
  const [frame, setFrame] = useState(flags.frame ?? (exportMode ? 0 : 90));
  const frameRef = useRef(flags.frame ?? (exportMode ? 0 : 90));
  const [playing, setPlaying] = useState(false);
  const [meta, setMeta] = useState({neurons: 0, provenance: '', activity: ''});
  const [debug, setDebug] = useState(flags.debugOverlay && !exportMode);
  const [showEdges, setShowEdges] = useState(exportMode ? PRODUCTION_TUNING.showEdges : flags.showEdges);
  const [pointSize, setPointSize] = useState(PRODUCTION_TUNING.pointSize);
  const [activityMult, setActivityMult] = useState(PRODUCTION_TUNING.activityMultiplier);
  const [bloom, setBloom] = useState(PRODUCTION_TUNING.bloomStrength);
  const [cam, setCam] = useState({distance: 0, yawDeg: 0});

  useEffect(() => {
    let disposed = false;
    const boot = async () => {
      try {
        const canvas = canvasRef.current!;
        const geometry = await loadMeasuredGeometry();
        if (disposed) return;
        const scene = new CinematicBrainScene(
          canvas,
          geometry,
          exportMode
            ? PRODUCTION_TUNING
            : {...PRODUCTION_TUNING, showEdges},
        );
        sceneRef.current = scene;
        installExportApi(scene);
        setMeta({
          neurons: scene.neuronCount,
          provenance: scene.geometryProvenance,
          activity: scene.getActivitySource().provenance,
        });
        const start = frameRef.current;
        scene.renderFrame(start);
        setFrame(start);
        setCam(scene.getCameraState());
        setStatus('ready');
        // Re-draw after React commits the ready UI — setting canvas width/height as
        // React props used to wipe the WebGL buffer on that commit.
        requestAnimationFrame(() => {
          if (!disposed && sceneRef.current) sceneRef.current.renderFrame(start);
        });
      } catch (e) {
        if (!disposed) {
          setStatus('error');
          setError(String(e));
        }
      }
    };
    void boot();
    return () => {
      disposed = true;
      playingRef.current = false;
      cancelAnimationFrame(rafRef.current);
      sceneRef.current?.dispose();
      sceneRef.current = null;
      delete window.__CINEMATIC__;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once from query flags
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || exportMode || status !== 'ready') return;
    scene.setTuning({
      showEdges,
      pointSize,
      activityMultiplier: activityMult,
      bloomStrength: bloom,
    });
    scene.renderFrame(frameRef.current);
    setCam(scene.getCameraState());
  }, [showEdges, pointSize, activityMult, bloom, exportMode, status]);

  const goTo = (f: number) => {
    const scene = sceneRef.current;
    if (!scene) return;
    const next = Math.max(0, Math.min(TOTAL_FRAMES - 1, Math.floor(f)));
    frameRef.current = next;
    scene.renderFrame(next);
    setFrame(next);
    setCam(scene.getCameraState());
  };

  const play = () => {
    if (playingRef.current || !sceneRef.current) return;
    playingRef.current = true;
    setPlaying(true);
    let last = performance.now();
    let acc = 0;
    const tick = (now: number) => {
      if (!playingRef.current || !sceneRef.current) return;
      acc += now - last;
      last = now;
      const step = 1000 / FPS;
      let advanced = false;
      while (acc >= step) {
        acc -= step;
        const scene = sceneRef.current;
        let next = frameRef.current + 1;
        if (next >= TOTAL_FRAMES) {
          playingRef.current = false;
          setPlaying(false);
          goTo(TOTAL_FRAMES - 1);
          return;
        }
        frameRef.current = next;
        scene.renderFrame(next);
        advanced = true;
      }
      if (advanced) {
        setFrame(frameRef.current);
        setCam(sceneRef.current.getCameraState());
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const pause = () => {
    playingRef.current = false;
    setPlaying(false);
    cancelAnimationFrame(rafRef.current);
  };

  const restart = () => {
    pause();
    goTo(0);
  };

  const time = frameToTime(frame);

  return (
    <div className={`cine ${exportMode ? 'export' : 'preview'}`} data-status={status}>
      <div className="stage">
        <canvas
          ref={canvasRef}
          data-testid="cinematic-canvas"
          aria-label="MaleCNS measured soma cinematic"
        />
        {status === 'loading' && !exportMode && <div className="boot">Loading measured MaleCNS geometry…</div>}
        {status === 'error' && <div className="boot error" role="alert">{error}</div>}
      </div>

      {!exportMode && status === 'ready' && (
        <aside className="panel" aria-label="Cinematic preview controls">
          <header>
            <strong>Brain cinematic</strong>
            <span>preview · not export</span>
          </header>
          <p className="honesty">
            Geometry: measured MaleCNS somas ({meta.neurons.toLocaleString('en-US')} points). Activity:{' '}
            <code>{meta.activity}</code> — synthetic cinematic timeline on real coordinates, not biological
            ground truth.
          </p>
          <div className="transport">
            <button type="button" onClick={() => (playing ? pause() : play())}>
              {playing ? 'Pause' : 'Play'}
            </button>
            <button type="button" onClick={restart}>
              Restart
            </button>
            <label className="frame-readout">
              f {frame} / {TOTAL_FRAMES - 1}
              <span>{time.toFixed(3)}s</span>
            </label>
          </div>
          <label className="slider">
            Frame
            <input
              type="range"
              min={0}
              max={TOTAL_FRAMES - 1}
              value={frame}
              onChange={e => {
                pause();
                goTo(Number(e.target.value));
              }}
            />
          </label>
          <div className="toggles">
            <label>
              <input type="checkbox" checked={showEdges} onChange={e => setShowEdges(e.target.checked)} />
              SHOW_EDGES (spatial proximity sample — not synapses)
            </label>
            <label>
              <input type="checkbox" checked={debug} onChange={e => setDebug(e.target.checked)} />
              Debug overlay
            </label>
          </div>
          <label className="slider">
            Point size {pointSize.toFixed(2)}
            <input
              type="range"
              min={0.5}
              max={4}
              step={0.05}
              value={pointSize}
              onChange={e => setPointSize(Number(e.target.value))}
            />
          </label>
          <label className="slider">
            Activity ×{activityMult.toFixed(2)}
            <input
              type="range"
              min={0}
              max={2.5}
              step={0.05}
              value={activityMult}
              onChange={e => setActivityMult(Number(e.target.value))}
            />
          </label>
          <label className="slider">
            Bloom {bloom.toFixed(2)}
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={bloom}
              onChange={e => setBloom(Number(e.target.value))}
            />
          </label>
          <p className="hint">
            Export: <code>?export=1</code> · {WIDTH}×{HEIGHT} · {FPS} fps · {TOTAL_FRAMES} frames
          </p>
        </aside>
      )}

      {debug && status === 'ready' && (
        <div className="debug" data-testid="cinematic-debug">
          <div>frame {frame}</div>
          <div>time {time.toFixed(4)}s</div>
          <div>fps target {FPS}</div>
          <div>
            cam d={cam.distance.toFixed(3)} yaw={cam.yawDeg.toFixed(2)}°
          </div>
          <div>{meta.provenance}</div>
          <div>{meta.activity}</div>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
