import {SparseLif,LIF_V1,type SparseGraph} from './lif';
import {buildPopulationMapping,type MappingAnnotations} from './population_mapping';
import {sensoryEncode} from './sensory';
import type {Observation,BrainFrame} from '../include/types';
/** Authored interface, not a claim about neuron function. One model tick/game frame.
 * All-positive transmission deliberately matches the audited diagnostic baseline.
 * Remaining sensory channels address interleaved visual-projection subsets;
 * vnc_motor graph-order thirds are arbitrary action readouts. */
export class MaleCNSBrain {
 private model:SparseLif;private mapping;private input:Int32Array;private groups:Uint32Array[];
 private rates=new Float64Array(5);private cooldown=new Uint8Array(2);private cached:BrainFrame|null=null;private generation=-1;
 constructor(graph:SparseGraph & MappingAnnotations){
  this.mapping=buildPopulationMapping(graph);const n=graph.offsets.length-1;
  this.model=new SparseLif(graph,new Int8Array(n).fill(1),{...LIF_V1});this.input=new Int32Array(n);
  const motors:number[][]=[[],[],[]];const sc=graph.annotations.superclass,labels=graph.dictionaries.superclass;
  let ordinal=0;for(let i=0;i<n;i++)if(labels[sc[i]]==='vnc_motor')motors[ordinal++%3].push(i);
  if(motors.some(g=>!g.length))throw Error('Empty action readout population');
  this.groups=[...this.mapping.outputs,...motors.map(g=>new Uint32Array(g))];
 }
 step(o:Observation,generation=0):BrainFrame{
  if(!Number.isSafeInteger(generation)||generation<0||!Number.isSafeInteger(o.tick)||o.tick<0)throw Error('Invalid controller sequence');
  if(generation!==this.generation){if(o.tick!==0)throw Error('New controller generation must start at zero');this.model.reset();this.rates.fill(0);this.cooldown.fill(0);this.cached=null;this.generation=generation;}
  // A paused, in-flight game request may be retried without advancing the model.
  if(this.cached?.tick===o.tick)return this.cached;
  if(o.tick!==this.model.tick)throw Error('Nonconsecutive neural observation');
  const sensory=sensoryEncode(o);this.input.fill(0);
  for(let side=0;side<2;side++)for(let j=0;j<this.mapping.inputs[side].length;j++){
   const i=this.mapping.inputs[side][j];this.input[i]=Math.round(1000*Math.min(1,sensory[side]+0.25*sensory[2+j%4]));
  }
  const spikes=this.model.step(this.input),activity=new Uint8Array(this.input.length);
  for(const i of spikes)activity[i]=255;
  const motor=new Float32Array(5);
  for(let g=0;g<5;g++){
   let count=0;for(const i of this.groups[g])if(activity[i])count++;
   this.rates[g]=(7*this.rates[g]+count/this.groups[g].length)/8;
   motor[g]=Math.min(1,6*this.rates[g]);
  }
  // Opposed readouts cancel before clamping, preserving small lateral differences.
  const lateral=6*(this.rates[1]-this.rates[0]);motor[0]=Math.min(1,Math.max(0,-lateral));motor[1]=Math.min(1,Math.max(0,lateral));
  // Game actions are edge-triggered. Convert sustained neural readout into pulses.
  for(let j=0;j<2;j++){if(this.cooldown[j]>0){this.cooldown[j]--;motor[j+2]=0;}else if(motor[j+2]>.5)this.cooldown[j]=j===0?44:19;}
  return this.cached={version:1,tick:o.tick,activity,active_neuron_count:spikes.length,sensory_values:sensory,motor_values:motor};
 }
}
