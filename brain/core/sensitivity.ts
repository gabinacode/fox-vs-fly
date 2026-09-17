/** MODEL_ASSUMPTION: finite discrete sensitivity assays, never biological defaults. */
import {SparseLif,LIF_V1,type SparseGraph} from './lif';
import {mappedDrive,mappedRates,type PopulationMapping} from './population_mapping';
export const SIGN_POLICIES=['positive','alternating','inverted','zero'] as const;
export type SignPolicy=typeof SIGN_POLICIES[number];
export const TEMPORAL_POLICIES=[
 {name:'baseline',dt:1,leakNumerator:19,leakDenominator:20},
 {name:'stronger-leak',dt:1,leakNumerator:10,leakDenominator:20},
 {name:'coarse-step',dt:2,leakNumerator:361,leakDenominator:400},
] as const;
export type TemporalPolicy=typeof TEMPORAL_POLICIES[number];
export function sourceSigns(n:number,policy:SignPolicy){
 return Int8Array.from({length:n},(_,i)=>policy==='zero'?0:policy==='positive'?1:
  (Math.floor(i/100)%2===0?1:-1)*(policy==='inverted'?-1:1));
}
export function sensitivityModel(graph:SparseGraph,sign:SignPolicy,time:TemporalPolicy){
 return new SparseLif(graph,sourceSigns(graph.offsets.length-1,sign),{...LIF_V1,
  leakNumerator:time.leakNumerator,leakDenominator:time.leakDenominator,refractorySteps:2/time.dt});
}
/** Time is arbitrary reference units. Drive is an integer increment scaled by dt.
 * Edge delay remains one step (dt units); this is not a convergence experiment. */
export function sensitivityTrial(model:SparseLif,time:TemporalPolicy,mapping?:PopulationMapping,channel:0|1=0){
 model.reset();
 const duration=mapping?60:600,steps=duration/time.dt,input=new Int32Array(model.nodes);
 const bins=new Array<number>(duration/60).fill(0),counts:[number,number]=[0,0];
 const membership=new Int8Array(mapping?model.nodes:0);
 if(mapping)for(let side=0;side<2;side++)for(const i of mapping.outputs[side])membership[i]=side+1;
 let hash=2166136261,spikes=0,lastSpikeStep:number|null=null;
 for(let tick=0;tick<steps;tick++){
  if(mapping)mappedDrive(mapping,channel,input,500*time.dt);
  else {input.fill(0);if(tick*time.dt<10)for(let i=0;i<model.nodes;i+=100)input[i]=1000*time.dt;}
  const fired=model.step(input);spikes+=fired.length;bins[Math.floor(tick*time.dt/60)]+=fired.length;
  if(fired.length)lastSpikeStep=tick;
  for(const i of fired){hash=Math.imul(hash^i,16777619)>>>0;const side=membership[i];if(side)counts[side-1]++;}
  hash=Math.imul(hash^tick,16777619)>>>0;
 }
 return {steps,duration,hash,spikes,bins,lastSpikeStep,
  lastSpikeTime:lastSpikeStep===null?null:lastSpikeStep*time.dt,
  readoutCounts:counts,readoutPerTick:mapping?mappedRates(counts,mapping,steps):null,
  readoutPerReferenceUnit:mapping?counts.map((c,i)=>c/(mapping.outputs[i].length*duration)):null};
}
