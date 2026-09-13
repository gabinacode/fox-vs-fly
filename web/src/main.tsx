import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {loadSimulation,type Snapshot} from './wasm/sim';
import {ConnectomeLoader} from './components/ConnectomeLoader';
import {Session} from './game/session';
import {BrainRenderer} from './render/brain';
import {drawGame} from './render/game';
import {loadGeometry} from './brain/geometry';
import type {BrainGeometry} from '../../brain/include/types';
import {SENSORY_LABELS,MOTOR_LABELS,type BrainFrame} from '../../brain/include/types';
import './style.css';

const dummy=new URLSearchParams(location.search).get('controller')==='dummy';
const format=(n:number)=>n.toLocaleString('en-US');
function App(){
 const [geometry,setGeometry]=useState<BrainGeometry|null>(null),[geometryWarning,setGeometryWarning]=useState('');
 const gameCanvas=useRef<HTMLCanvasElement>(null),brainCanvas=useRef<HTMLCanvasElement>(null),session=useRef<Session|null>(null);
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[frame,setFrame]=useState<BrainFrame|null>(null),[running,setRunning]=useState(false),[error,setError]=useState(''),[mode,setMode]=useState('Loading'),[fps,setFps]=useState({game:0,render:0,brain:0}),[science,setScience]=useState(false),[preparation,setPreparation]=useState('Loading simulation and anatomy…');
 useEffect(()=>{
  let worker:Worker|null=null;let disposed=false,raf=0,renderer:BrainRenderer|null=null,last=performance.now(),statTime=last,draws=0,lastTick=0,lastFrame:BrainFrame|null=null;
  const change=()=>{const s=session.current;if(s&&!disposed){setSnapshot(s.state);setFrame(s.frame);setRunning(s.running);}};
  const init=async()=>{try{
   const [sim,loaded]=await Promise.all([loadSimulation(),loadGeometry()]);if(disposed)return;
   const geometry=loaded.geometry;setGeometry(geometry);setGeometryWarning(loaded.warning);
   renderer=new BrainRenderer(brainCanvas.current!,geometry);setMode(renderer.mode);
   worker=dummy?new Worker(new URL('./workers/brain.worker.ts',import.meta.url),{type:'module'}):new Worker(new URL('./workers/male_cns.worker.ts',import.meta.url),{type:'module'});
   if(!dummy){
    if(!geometry.measured?.graph_identity)throw Error('Measured anatomy is required for the neural controller. Reload to retry.');
    setPreparation('Preparing measured neural graph (76 MiB)…');
    await new Promise<void>((resolve,reject)=>{
     worker!.onerror=()=>reject(Error('Neural controller worker failed. Reload to retry.'));
     worker!.onmessage=e=>{if(disposed)return;const m=e.data;
      if(m.type==='ready')resolve();else if(m.type==='error')reject(Error(m.message));
      else if(m.type==='progress')setPreparation(m.phase==='validating'?'Validating neural graph…':`Preparing neural graph · ${Math.floor(100*m.received/m.total)}%`);
     };
     worker!.postMessage({type:'initialize',base:new URL(`${import.meta.env.BASE_URL}connectome-graph/`,location.href).href,identity:geometry.measured!.graph_identity});
    });
    if(disposed)return;
   }
   setPreparation('Ready to meet your opponent?');
   session.current=new Session(sim,worker,change,setError,geometry.neuron_count??geometry.positions.length/3);change();
   const render=(now:number)=>{const s=session.current;if(!s||disposed)return;
    if(!s.frame&&lastFrame){renderer!.clear();lastFrame=null;}
    if(s.frame&&s.frame!==lastFrame){renderer!.ingest(s.frame);lastFrame=s.frame;}
    drawGame(gameCanvas.current!,s.state);renderer!.draw(now-last);last=now;draws++;
    if(now-statTime>=1000){const dt=(now-statTime)/1000;setFps({game:Math.max(0,Math.round((s.state.tick-lastTick)/dt)),render:Math.round(draws/dt),brain:Math.max(0,Math.round((s.state.tick-lastTick)/dt))});lastTick=s.state.tick;statTime=now;draws=0;}
    raf=requestAnimationFrame(render);
   };raf=requestAnimationFrame(render);
  }catch(e){worker?.terminate();if(!disposed)setError(`Unable to start the game: ${String(e)}`);}};void init();
  const down=(e:KeyboardEvent)=>{if((e.target as HTMLElement)?.closest('button,a,summary')&&e.code==='Space')return;
   if(['KeyA','KeyD','KeyW','KeyS','KeyJ','KeyR','Escape'].includes(e.code)){e.preventDefault();const s=session.current;if(!s)return;if(e.code==='KeyR'&&!e.repeat){s.reset();setError('');}else if(e.code==='Escape'){s.pause();}else if(s.running)s.input.down(e.code);}
  };
  const up=(e:KeyboardEvent)=>session.current?.input.up(e.code);const pause=()=>{if(session.current?.running)session.current.pause();};const hide=()=>{if(document.hidden)pause();};
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',pause);document.addEventListener('visibilitychange',hide);
  return()=>{disposed=true;cancelAnimationFrame(raf);session.current?.dispose();worker?.terminate();renderer?.dispose();window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',pause);document.removeEventListener('visibilitychange',hide);};
 },[]);
 const play=()=>{setError('');session.current?.play();};
 const status=snapshot?.winner!==-1&&snapshot? snapshot.winner===0?'You win.':snapshot.winner===1?'The Fly wins.':'Draw.':snapshot?.tick?'Match paused':preparation;
 const action=frame?MOTOR_LABELS.filter((_,i)=>frame.motor_values[i]>.5).join(' + ')||'Neutral':'Neutral';
 const bars=(labels:readonly string[],values:Float32Array|undefined)=>labels.map((label,i)=><div className="signal" key={label}><span>{label}</span><div className="track"><i style={{width:`${(values?.[i]||0)*100}%`}}/></div><small>{Math.round((values?.[i]||0)*100)}<span>%</span></small></div>);
 return <div className="page">
  <header><a className="brand" href="#"><span className="brandmark">f.</span> FOX <span className="muted">/</span> FLY</a><div className="header-note">A CONNECTOME EXPERIMENT</div><button className="text-button" onClick={()=>setScience(!science)}>{science?'Close notes':'About the experiment'} <span>↗</span></button></header>
  <main>
   <div className="intro"><div><div className="eyebrow"><span className="dot"/> EXPERIMENT 001 <span className="slash">/</span> PLAYABLE PROTOTYPE</div><h1>Can you beat a<br/><em>fruit fly brain</em> at Melee?</h1></div><div className="intro-copy"><p>You bring the reflexes.<br/>The Fly brings a different kind of wiring.</p><div className="demo-label">{dummy?'SYNTHETIC CONTROLLER · LIVE DEMO':'MEASURED WIRING · AUTHORED NEURAL MODEL'}</div><p className="honesty">{dummy?'The anatomy can be measured. The activity is still a dummy-controller demonstration, not a biological simulation.':'The Fly is driven by model spikes over measured MaleCNS wiring. Dynamics and game mappings are authored assumptions, not biological behavior.'}</p></div></div>
   {science&&<section className="notes"><strong>A wiring diagram is only the beginning.</strong><p>{dummy?'This demo uses a deterministic rule-based controller and synthetic activity.':'Game observations stimulate selected visual-projection neurons. Measured weighted connections propagate authored LIF spikes; descending and arbitrarily partitioned motor populations produce the exact controls shown below. All-positive transmission, one model tick per game frame, sensory assignments and action scaling are modeling assumptions. This is not a validated model of fly behavior.'} Measured soma positions omit only neurons without positions; those neurons remain in the model. Movement and combat are approximate, with original artwork.</p><a href="https://male-cns.janelia.org/" target="_blank" rel="noreferrer">Explore the MaleCNS project ↗</a></section>}
   <div className="experiment">
    <section className="arena-panel" aria-label="Fox versus Fly game">
     <div className="panel-title"><span><b className="index">01</b> THE MATCH</span><span className="live"><i className={running?'on':''}/>{running?'LIVE':snapshot?'READY':'LOADING WASM'}</span></div>
     <div className="arena"><canvas ref={gameCanvas} aria-label="Original Fox and Fly fighters on a floating platform"/>
      {!running&&<div className="play-overlay"><div className="vs"><span>FOX</span><i>vs</i><span>FLY</span></div><p>{status}</p><button className="play-button" onClick={play} disabled={!snapshot}>{snapshot?.tick&&snapshot.winner===-1?'RESUME MATCH':snapshot?.winner!==-1&&snapshot?'PLAY AGAIN':'PLAY'} <span aria-hidden="true">↗</span></button><small>Tap W: short hop · Hold W: full jump</small></div>}
     </div>
     <div className="scoreboard" data-testid="hud" data-tick={snapshot?.tick||0} data-hash={snapshot?.hash||0} data-fox-x={snapshot?.fox.x||0} data-fox-y={snapshot?.fox.y||0} data-running={running}>
      {[snapshot?.fox,snapshot?.fly].map((f,i)=><div className={`score score-${i}`} key={i}><div><span className="fighter-name">{i?'FLY':'FOX'} <small>{i?(dummy?'DUMMY CPU':'NEURAL CPU'):'YOU'}</small></span><div className="stocks" aria-label={`${i?'Fly':'Fox'} stocks: ${f?.stocks??3}`}>{Array.from({length:3},(_,j)=><i className={j<(f?.stocks??3)?'remaining':''} key={j}/>)}</div></div><strong data-testid={i?'fly-damage':'fox-damage'}>{f?.damage||0}<span>%</span></strong></div>)}
     </div>
    </section>
    <section className="brain-panel" aria-label={dummy?'Anatomy with synthetic controller activity':'Measured anatomy with neural model activity'}>
     <div className="panel-title"><span><b className="index">02</b> ANATOMY & ACTIVITY</span><span className="synthetic">{dummy?'SYNTHETIC ACTIVITY':'MODEL SPIKES'}</span></div>
     <div className="brain-view"><canvas ref={brainCanvas} aria-label={geometry?.provenance==='MALECNS'?(dummy?'Measured MaleCNS soma positions with synthetic activity':'Measured MaleCNS soma positions with model spikes'):'Synthetic placeholder geometry'}/><div className="brain-caption">{geometry?.provenance==='MALECNS'?'MALECNS v1.0 · MEASURED SOMAS':'SYNTHETIC GEOMETRY'}<span>{dummy?'Synthetic activity overlay · Dummy controller':'Actual model spikes · Authored dynamics'}</span></div><div className="brain-axis">Y ↑<br/>└→ X</div><div className="activity-key"><i/> inactive <i/> active</div></div>
     <div className="brain-stats"><div><strong>{format((geometry?.positions.length??0)/3)}</strong><span>{geometry?.measured?'MEASURED SOMA POSITIONS':'SYNTHETIC SAMPLES'}</span></div><div><strong data-testid="active-count">{format(frame?.active_neuron_count||0)}</strong><span>ACTIVE MODEL NODES</span></div><div><strong>{geometry?.measured?format(geometry.measured.missing):'—'}</strong><span>UNPOSITIONED NEURONS</span></div></div>
     <div className="geometry-note" data-testid="geometry-status">{geometry?.measured?<>{format(geometry.neuron_count!)} retained neurons · {format(geometry.measured.edges)} connections in the measured graph. {dummy?'Prepare data and run an artificial neural experiment below. This display uses dummy activity.':'Live model spikes drive both this display and Fly controls. Unpositioned neurons participate in dynamics.'}</>:'Generated geometry; no measured anatomy loaded.'}</div>
    </section>
   </div>
   {geometryWarning&&<div className="geometry-warning" role="status">{geometryWarning}</div>}
   <div className="lower-grid">
    <section className="controls"><div className="eyebrow">YOUR SIDE OF THE EXPERIMENT</div><h2>Three stocks.<br/>One tiny rival.</h2><div className="keys"><div><kbd>A</kbd><kbd>D</kbd><span>Move</span></div><div><kbd>W</kbd><span>Jump / double jump</span></div><div><kbd>S</kbd><span>Fastfall</span></div><div><kbd>J</kbd><span>Attack</span></div></div><div className="control-bottom"><button className="text-button" onClick={()=>{session.current?.reset();setError('');}}>↻ Reset match <kbd>R</kbd></button><button className="text-button" disabled={!running} onClick={()=>session.current?.pause()}>Pause <kbd>esc</kbd></button></div></section>
    <section className="signals"><div className="signal-heading"><h3>Sensory input</h3><span>GAME → CONTROLLER</span></div>{bars(SENSORY_LABELS,frame?.sensory_values)}</section>
    <section className="signals motor"><div className="signal-heading"><h3>Motor output</h3><span>CONTROLLER → FLY</span></div>{bars(MOTOR_LABELS,frame?.motor_values)}<div className="current"><span>APPLIED</span><strong data-testid="motor-action">{action}</strong><small data-testid="brain-tick">f {frame?.tick??'—'}</small></div></section>
   </div>
   {dummy?<ConnectomeLoader geometry={geometry}/>:<p className="geometry-note">Neural graph loads automatically before PLAY. <a href="?controller=dummy">Open the synthetic demo and optional research diagnostics</a>.</p>}
   {error&&<div className="error" role="alert">{error}</div>}
  </main>
  <footer><span><i className="dot"/> DETERMINISTIC · 60 HZ TARGET</span><span data-testid="performance">{fps.game} game fps <b>/</b> {fps.render} render fps <b>/</b> {fps.brain} neural fps <b>/</b> {mode}</span><span>Original graphics. Approximate mechanics.</span></footer>
 </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
