import {buildPopulationMapping,shufflePopulationMapping,mappedDrive,mappedRates,type MappingAnnotations} from '../../../brain/core/population_mapping';
import {SparseLif,LIF_V1,type SparseGraph} from '../../../brain/core/lif';
export type ExperimentSuite='throughput'|'controls'|'stability'|'mapped'|'independent'|'robustness';
export const EXPERIMENT_SCHEDULING={sliceMs:8,maxTicks:4} as const;
export interface ExperimentRow {name:string;amplitude?:number;shuffleSeed?:number;trialHashes?:number[];directionalContrast?:number;readout?:number[][];spikeBins:number[];lastSpikeTick:number|null;lateSpikes:number;ticks:number;spikes:number;hash:number;stepMs:number;p95Ms:number;wallMs:number;}
export interface ExperimentResult {suite:ExperimentSuite;mappingCoverage?:{inputs:number[];outputs:number[];excludedInput:number;excludedOutput:number};rows:ExperimentRow[];modelBytes:number;inputBytes:number;}
/** Bounded artificial workload, never game input or biological sign inference. */
export async function runExperiment(graph:SparseGraph,signal:AbortSignal,
 progress:(phase:string,completed:number,total:number)=>void,suite:ExperimentSuite='throughput',annotations?:MappingAnnotations):Promise<ExperimentResult>{
 if(suite!=='throughput'&&suite!=='controls'&&suite!=='stability'&&suite!=='mapped'&&suite!=='independent'&&suite!=='robustness')throw Error('Unknown experiment suite');
 signal.throwIfAborted();
 const n=graph.offsets.length-1,input=new Int32Array(n),rows:ExperimentRow[]=[];let completed=0,modelBytes=0;
 const independent=suite==='independent'||suite==='robustness';
 const baseMapping=(suite==='mapped'||independent)?buildPopulationMapping(annotations??{annotations:{},dictionaries:{}}):undefined;
 const ticks=suite==='stability'?600:120;
 const sweep=[250,500,1000].flatMap(amplitude=>[
  {name:`Annotated · ${amplitude}`,stride:0,amplitude},
  {name:`Transmission off · ${amplitude}`,stride:0,amplitude},
  ...[20260912,20260913,20260914].map(shuffleSeed=>({name:`Shuffled ${shuffleSeed} · ${amplitude}`,stride:0,amplitude,shuffleSeed}))]);
 const scenarios:{name:string;stride:number;amplitude?:number;shuffleSeed?:number}[]=suite==='robustness'?sweep:(suite==='mapped'||independent)?[{name:'Annotated mapping',stride:0},{name:'Mapped transmission off',stride:0},{name:'Shuffled membership',stride:0}]:suite==='stability'?[{name:'Long pulse baseline',stride:100},{name:'Long pulse transmission off',stride:100},{name:'Long pulse stronger leak',stride:100},{name:'Long pulse alternating signs',stride:100}]:suite==='throughput'?[{name:'Silent',stride:0},{name:'Sparse drive',stride:100},{name:'Dense drive',stride:1}]:[
  {name:'Sparse baseline',stride:100},{name:'Transmission off',stride:100},{name:'Alternating signs',stride:100},{name:'Pulse then release',stride:100}];
 const total=scenarios.length*3*ticks;
 for(const {name,stride,amplitude=1000,shuffleSeed} of scenarios){
  signal.throwIfAborted();
  const signs=new Int8Array(n);for(let i=0;i<n;i++)signs[i]=name.toLowerCase().includes('alternating signs')&&(Math.floor(i/100)%2===1)?-1:1;
  const model=new SparseLif(graph,signs,{...LIF_V1,gain:name.toLowerCase().includes('transmission off')?0:LIF_V1.gain,leakNumerator:name.includes('stronger leak')?10:LIF_V1.leakNumerator});modelBytes=model.stateBytes;
  input.fill(0);if(stride)for(let i=0;i<input.length;i+=stride)input[i]=LIF_V1.threshold;
  const mapping=baseMapping?((name==='Shuffled membership'||shuffleSeed!==undefined)?shufflePopulationMapping(baseMapping,n,shuffleSeed):baseMapping):undefined;
  const membership=new Int8Array(mapping?n:0);if(mapping)for(let side=0;side<2;side++)for(const i of mapping.outputs[side])membership[i]=side+1;
  let measured:ExperimentRow|undefined;
  for(let pass=0;pass<3;pass++){
   model.reset();input.fill(0);if(stride)for(let i=0;i<n;i+=stride)input[i]=LIF_V1.threshold;
   let sliceStart=performance.now(),sliceTicks=0;
   const trialHashes=[2166136261,2166136261];
   const readoutCounts:[[number,number],[number,number]]=[[0,0],[0,0]];
   const spikeBins=new Array<number>(ticks/60).fill(0);let lastSpikeTick:number|null=null;
   let spikes=0,lateSpikes=0,hash=2166136261;const times:number[]=[],start=performance.now();
   for(let tick=0;tick<ticks;tick++){
    signal.throwIfAborted();if(independent&&tick===60)model.reset();
    const channel=(independent&&pass===2?(tick<60?1:0):(tick<60?0:1)) as 0|1;
    if(mapping)mappedDrive(mapping,channel,input,amplitude);if((name==='Pulse then release'||suite==='stability')&&tick===10)input.fill(0);const before=performance.now(),fired=model.step(input);times.push(performance.now()-before);
    if(mapping)for(const i of fired){const side=membership[i];if(side)readoutCounts[channel][side-1]++;}
    spikes+=fired.length;spikeBins[Math.floor(tick/60)]+=fired.length;if(fired.length)lastSpikeTick=tick;if(tick>=ticks-60)lateSpikes+=fired.length;for(const i of fired)hash=Math.imul(hash^i,16777619)>>>0;
    if(independent){for(const i of fired)trialHashes[channel]=Math.imul(trialHashes[channel]^i,16777619)>>>0;
     trialHashes[channel]=Math.imul(trialHashes[channel]^(tick%60),16777619)>>>0;}
    hash=Math.imul(hash^tick,16777619)>>>0;completed++;
    sliceTicks++;if(sliceTicks>=EXPERIMENT_SCHEDULING.maxTicks||performance.now()-sliceStart>=EXPERIMENT_SCHEDULING.sliceMs||tick===ticks-1){progress(`${name} · ${['warmup','measurement','reset replay'][pass]}`,completed,total);
     await new Promise(resolve=>setTimeout(resolve,0));signal.throwIfAborted();sliceStart=performance.now();sliceTicks=0;}
   }
   const readout=mapping?readoutCounts.map(c=>mappedRates(c,mapping,60)):undefined;
   if(independent)hash=Math.imul(trialHashes[0]^trialHashes[1],16777619)>>>0;
   const row={name,amplitude:suite==='robustness'?amplitude:undefined,shuffleSeed,trialHashes:independent?trialHashes:undefined,directionalContrast:independent&&readout?(readout[1][1]-readout[1][0])-(readout[0][1]-readout[0][0]):undefined,readout,ticks,spikeBins,lastSpikeTick,spikes,lateSpikes,hash,stepMs:times.reduce((a,b)=>a+b,0)/ticks,
    p95Ms:times.sort((a,b)=>a-b)[Math.ceil(ticks*0.95)-1],wallMs:performance.now()-start};
   if(pass===1)measured=row;
   if(pass===2){if(!measured||row.hash!==measured.hash||row.spikes!==measured.spikes||JSON.stringify(row.readout)!==JSON.stringify(measured.readout)||JSON.stringify(row.trialHashes)!==JSON.stringify(measured.trialHashes))throw Error('Neural reset replay mismatch');rows.push(measured);}
  }
 }
 return {suite,mappingCoverage:baseMapping?{inputs:baseMapping.inputs.map(g=>g.length),outputs:baseMapping.outputs.map(g=>g.length),excludedInput:baseMapping.excludedInput,excludedOutput:baseMapping.excludedOutput}:undefined,rows,modelBytes,inputBytes:input.byteLength};
}
