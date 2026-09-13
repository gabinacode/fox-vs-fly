import {NeuralDiagnosticView} from './NeuralDiagnosticView';
import type {DiagnosticFrame} from '../brain/diagnostic';
import {useEffect,useRef,useState} from 'react';
import type {BrainGeometry} from '../../../brain/include/types';
import {validateCatalog,type GraphCatalog,type GraphMetrics,type GraphProgress} from '../brain/connectome';
import type {ExperimentResult,ExperimentSuite} from '../brain/experiment';
const mib=(n:number)=>(n/1024**2).toFixed(1);
export function ConnectomeLoader({geometry}:{geometry:BrainGeometry|null}){
 const [catalog,setCatalog]=useState<GraphCatalog|null>(null),[status,setStatus]=useState('checking');
 const [error,setError]=useState(''),[progress,setProgress]=useState<GraphProgress|null>(null),[metrics,setMetrics]=useState<GraphMetrics|null>(null);
 const [suite,setSuite]=useState<ExperimentSuite>('throughput');
 const [experiment,setExperiment]=useState('idle'),[phase,setPhase]=useState(''),[fraction,setFraction]=useState(0),[result,setResult]=useState<ExperimentResult|null>(null);
 const [diagnosticOpened,setDiagnosticOpened]=useState(false);
 const [diagnosticFrame,setDiagnosticFrame]=useState<DiagnosticFrame|null>(null),[diagnosticActive,setDiagnosticActive]=useState(false);
 const diagnosticId=useRef(0),diagnosticTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const worker=useRef<Worker|null>(null);
 const base=new URL(`${import.meta.env.BASE_URL}connectome-graph/`,location.href).href;
 useEffect(()=>{
  const controller=new AbortController();
  void (async()=>{try{
   const r=await fetch(new URL('catalog.json',base),{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])});
   if(!r.ok)throw Error('Network package unavailable');const c=validateCatalog(await r.json());
   if(!controller.signal.aborted){setCatalog(c);setStatus('idle');}
  }catch(e){if(!controller.signal.aborted){setStatus('unavailable');setError(String(e));}}})();
  return()=>{clearTimeout(diagnosticTimer.current);diagnosticId.current++;controller.abort();worker.current?.terminate();worker.current=null;};
 },[base]);
 const stopDiagnostic=()=>{clearTimeout(diagnosticTimer.current);diagnosticId.current++;setDiagnosticFrame(null);setDiagnosticActive(false);worker.current?.postMessage({type:'diagnostic-stop',id:diagnosticId.current});};
 const startDiagnostic=()=>{stopDiagnostic();setDiagnosticOpened(true);setDiagnosticActive(true);worker.current?.postMessage({type:'diagnostic-start',id:diagnosticId.current});};
 const release=()=>{stopDiagnostic();setDiagnosticOpened(false);worker.current?.terminate();worker.current=null;setMetrics(null);setProgress(null);setStatus('idle');setError('');setExperiment('idle');setResult(null);setPhase('');setFraction(0);};
 const load=()=>{
  if(!catalog||!geometry?.measured?.graph_identity)return;
  release();setStatus('loading');
  try{
   const w=new Worker(new URL('../workers/connectome.worker.ts',import.meta.url),{type:'module'});worker.current=w;
   w.onmessage=e=>{if(worker.current!==w)return;const m=e.data;
    if(m.type==='diagnostic-frame'&&m.id===diagnosticId.current){
     if(m.frame.identity!==geometry?.measured?.graph_identity){stopDiagnostic();setError('Diagnostic anatomy identity mismatch');return;}
     setDiagnosticFrame(m.frame);if(m.frame.tick<120)diagnosticTimer.current=setTimeout(()=>{if(worker.current===w)w.postMessage({type:'diagnostic-step',id:m.id});},34);else setDiagnosticActive(false);
    }
    if(m.type==='diagnostic-error'&&m.id===diagnosticId.current){stopDiagnostic();setError(m.message);}
    if(m.type==='experiment-progress'){setPhase(m.phase);setFraction(m.completed/m.total);}
    if(m.type==='experiment-done'){setResult(m.result);setExperiment('done');}
    if(m.type==='experiment-cancelled'){setExperiment('idle');setPhase('Cancelled. Network remains ready.');}
    if(m.type==='experiment-error'){setExperiment('error');setPhase(m.message);}
    if(m.type==='progress'){setProgress(m);setStatus(m.phase);}
    if(m.type==='ready'){setMetrics(m.metrics);setStatus('ready');}
    if(m.type==='error'){stopDiagnostic();w.terminate();worker.current=null;setStatus('error');setError(m.message);}
   };
   w.onerror=()=>{if(worker.current!==w)return;stopDiagnostic();w.terminate();worker.current=null;setStatus('error');setError('Network preparation stopped. You can retry.');};
   w.postMessage({type:'load',catalog,base,identity:geometry.measured.graph_identity});
  }catch(e){setStatus('error');setError(String(e));}
 };
 const busy=status==='loading'||status==='validating';
 return <section className="network-loader" aria-label="Measured network preparation">
  <div><h3>Prepare the measured network</h3><p>Load connectivity in a separate worker. The match keeps its dummy controller; the optional neural experiment uses artificial stimulation.</p></div>
  <div className="network-actions">
   {catalog&&<small>{mib(catalog.download_bytes)} MiB download · {mib(catalog.array_bytes)} MiB graph arrays</small>}
   {busy?<button onClick={release}>Cancel preparation</button>:status==='ready'?<button onClick={release}>Unload network</button>:<button onClick={load} disabled={!catalog||!geometry?.measured?.graph_identity}>{status==='error'?'Retry network':'Load connectivity'}</button>}
  </div>
  <div className="network-status" data-testid="network-status" data-state={status} data-metrics={metrics?JSON.stringify(metrics):''}>
   {busy&&<><progress value={progress?.received??0} max={catalog?.download_bytes??1}/><span>{status==='validating'?'Checking graph structure…':`Loading ${mib(progress?.received??0)} / ${mib(catalog?.download_bytes??0)} MiB`}</span></>}
   {status==='ready'&&metrics&&<span>Network data ready · {metrics.nodes.toLocaleString('en-US')} neurons · {metrics.edges.toLocaleString('en-US')} connections · {(metrics.elapsedMs/1000).toFixed(2)} s. Activity remains synthetic.</span>}
   {status==='idle'&&<span>Not loaded. Preparation is optional for this demo.</span>}
   {status==='checking'&&<span>Checking network availability…</span>}
   {(status==='error'||status==='unavailable')&&<span role="alert">{error} The match remains playable.</span>}
  </div>
  {status==='ready'&&<div className="network-experiment" data-testid="neural-experiment" data-state={experiment} data-result={result?JSON.stringify(result):''}>
   <h3>Artificial neural experiment</h3>
   <p>Measured wiring · authored LIF dynamics · artificial signs and drive; no biological mapping. The anatomy display and Fly controls still use DummyBrain.</p>
   <label>Experiment suite <select aria-label="Experiment suite" value={suite} disabled={diagnosticActive||experiment==='running'||experiment==='cancelling'} onChange={e=>{setSuite(e.target.value as ExperimentSuite);setResult(null);setPhase('');setExperiment('idle');}}><option value="throughput">Throughput</option><option value="controls">Controlled comparisons</option><option value="stability">Long pulse sensitivity</option><option value="mapped">Annotation mapping</option><option value="independent">Independent lateral trials</option><option value="robustness">Amplitude and shuffle sweep</option></select></label>
   {suite==='robustness'&&<p>Predeclared input strengths 250, 500 and 1000; annotated mapping, transmission-off, and seeds 20260912–20260914 at each strength. Each stimulus starts from reset, with reverse-order replay. This small descriptive sweep is not a significance test or a controller calibration.</p>}
   {suite==='independent'&&<p>Left and right inputs each start from reset for 60 ticks. Replay reverses their order and must reproduce both traces and readouts exactly. Directional contrast compares the right-minus-left readout under the two inputs; positive values alone do not establish useful control.</p>}
   {suite==='mapped'&&<p>Artificial left then right drive to visual-projection neurons by soma side; descending-neuron readout. Unknown/midline sides are excluded from this mapping only. Compare annotated, transmission-off and fixed-seed shuffled membership. Positive signs remain artificial; outputs do not control the Fly.</p>}
   {suite==='stability'&&<p>600 ticks per condition; the same 10-tick pulse, then no external drive. Compare positive signs, transmission off, stronger leak (10/20 retention), and alternating signs. Finite-window persistence is not biological memory or proof of stability.</p>}
   {suite==='controls'&&<p>Same sparse drive: positive-sign baseline, transmission disabled, alternating signs by index block, and drive removed after tick 10. Each condition resets independently. These signs are artificial, not inferred from neurotransmitters.</p>}
   {experiment==='running'||experiment==='cancelling'?<button disabled={experiment==='cancelling'} onClick={()=>{setExperiment('cancelling');worker.current?.postMessage({type:'cancel-experiment'});}}>Stop experiment</button>:<button disabled={diagnosticActive} onClick={()=>{stopDiagnostic();setResult(null);setPhase('Initializing model…');setFraction(0);setExperiment('running');worker.current?.postMessage({type:'experiment',suite});}}>Run neural benchmark</button>}
   {(experiment==='running'||experiment==='cancelling')&&<p><progress value={fraction} max={1}/> {phase}</p>}
   {experiment==='idle'&&phase&&<p>{phase}</p>}
   {experiment==='error'&&<p role="alert">{phase}</p>}
   {result&&<><p>Reset replay verified · {mib(result.modelBytes)} MiB model state + {mib(result.inputBytes)} MiB input. Model ticks have no assigned biological duration.</p>
    <table><thead><tr><th>Artificial drive</th><th>Mean ms/tick</th><th>p95 ms/tick</th><th>Total spikes</th><th>Spikes / last 60</th></tr></thead><tbody>{result.rows.map(row=><tr key={row.name}><td>{row.name}</td><td>{row.stepMs.toFixed(2)}</td><td>{row.p95Ms.toFixed(2)}</td><td>{row.spikes.toLocaleString('en-US')}</td><td>{row.lateSpikes.toLocaleString('en-US')}</td></tr>)}</tbody></table>
    {result.mappingCoverage&&<div><h3>Normalized descending readout</h3><p>Input L/R: {result.mappingCoverage.inputs.join(' / ')} · output L/R: {result.mappingCoverage.outputs.join(' / ')} · excluded side labels: {result.mappingCoverage.excludedInput} input, {result.mappingCoverage.excludedOutput} output.</p><p>Each pair is left/right spikes per neuron per tick, for left input then right input.</p>{result.rows.map(row=><p key={row.name}><strong>{row.name}</strong>: {row.readout?.map(pair=>pair.map(n=>n.toFixed(4)).join(' / ')).join(' → ')}{row.directionalContrast!==undefined&&<> · contrast: {row.directionalContrast.toFixed(6)}</>}</p>)}</div>}
    {result.suite==='stability' &&<div><h3>Activity after the pulse</h3><p>Spike counts in consecutive 60-tick windows, starting at tick 0. Last spike uses a zero-based model tick.</p>{result.rows.map(row=><p key={row.name}><strong>{row.name}</strong>: {row.spikeBins.join(' → ')} · last spike: {row.lastSpikeTick??'none'}</p>)}</div>}
    <p>Worker step timings exclude deliberate yields. Memory counts cover owned arrays, not total browser memory.</p></>}
  </div>}
  {status==='ready'&&geometry&&<div className="network-experiment">
   <button disabled={experiment==='running'||experiment==='cancelling'} onClick={startDiagnostic}>{diagnosticActive?'Reset diagnostic':'Start spike diagnostic'}</button>
   <button onClick={stopDiagnostic} disabled={!diagnosticFrame&&!diagnosticActive}>Clear diagnostic</button>
   <span>{diagnosticActive?'Running':diagnosticFrame?.tick===120?'Completed — last tick':'Stopped'}</span>
   {diagnosticOpened&&<NeuralDiagnosticView geometry={geometry} frame={diagnosticFrame}/>}
   {error&&<p role="alert">{error}</p>}
  </div>}
 </section>;
}
