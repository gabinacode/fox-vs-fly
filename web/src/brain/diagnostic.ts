import {SparseLif,LIF_V1} from '../../../brain/core/lif';
import {buildPopulationMapping,mappedDrive} from '../../../brain/core/population_mapping';
import type {LoadedGraph} from './connectome';
export interface DiagnosticFrame {tick:number;activity:Uint8Array;spikes:number;hash:number;identity:string;}
/** Bounded 120-tick artificial mapped drive; no game controls. */
export class NeuralDiagnostic {
 private model:SparseLif;private input:Int32Array;private mapping;private hash=2166136261;
 constructor(private graph:LoadedGraph){this.mapping=buildPopulationMapping(graph);this.model=new SparseLif(graph,new Int8Array(graph.ids.length).fill(1),{...LIF_V1});this.input=new Int32Array(graph.ids.length);}
 initial():DiagnosticFrame{return {tick:0,activity:new Uint8Array(this.input.length),spikes:0,hash:this.hash,identity:this.graph.manifest.graph_identity};}
 step():DiagnosticFrame{
  if(this.model.tick>=120)throw Error('Diagnostic completed');const tick=this.model.tick;
  mappedDrive(this.mapping,tick<60?0:1,this.input,1000);const spikes=this.model.step(this.input),activity=new Uint8Array(this.input.length);
  for(const i of spikes){activity[i]=255;this.hash=Math.imul(this.hash^i,16777619)>>>0;}this.hash=Math.imul(this.hash^tick,16777619)>>>0;
  return {tick:this.model.tick,activity,spikes:spikes.length,hash:this.hash,identity:this.graph.manifest.graph_identity};
 }
}
