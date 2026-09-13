import {useEffect,useRef} from 'react';
import type {BrainGeometry} from '../../../brain/include/types';
import type {DiagnosticFrame} from '../brain/diagnostic';
import {BrainRenderer} from '../render/brain';
export function NeuralDiagnosticView({geometry,frame}:{geometry:BrainGeometry;frame:DiagnosticFrame|null}){
 const canvas=useRef<HTMLCanvasElement>(null),renderer=useRef<BrainRenderer|null>(null);
 useEffect(()=>{const r=new BrainRenderer(canvas.current!,geometry);renderer.current=r;let raf=0,last=performance.now();
 const draw=(now:number)=>{r.draw(now-last);last=now;raf=requestAnimationFrame(draw);};raf=requestAnimationFrame(draw);
 return()=>{cancelAnimationFrame(raf);r.dispose();renderer.current=null;};},[geometry]);
 useEffect(()=>{if(frame&&frame.identity===geometry.measured?.graph_identity)renderer.current?.ingestActivity(frame.activity);else renderer.current?.clear();},[frame,geometry]);
 return <div data-testid="diagnostic-view" data-tick={frame?.tick??0} data-spikes={frame?.spikes??0} data-hash={frame?.hash??0}>
  <h3>Model-derived spikes · artificial stimulation</h3>
  <p>Measured somas, LIF-generated spikes. Positive signs; left then right visual-projection drive. Fly controls and the upper anatomy view remain DummyBrain.</p>
  <canvas ref={canvas} aria-label="Measured somas with model-derived diagnostic spikes" style={{width:'100%',height:320,display:'block'}}/>
  <p>Model tick {frame?.tick??0} / 120 · {frame?.spikes??0} spiking graph nodes in this tick. Unpositioned neurons remain simulated. Glow decay is display-only. Playback targets at most 30 model ticks/second; no biological time unit.</p>
 </div>;
}
