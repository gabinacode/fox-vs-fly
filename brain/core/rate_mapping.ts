import type {MappingAnnotations} from './population_mapping';
export function rateMapping(graph:MappingAnnotations){
 const classes=graph.dictionaries.superclass,sc=graph.annotations.superclass;if(!classes||!sc)throw Error('Missing class annotations');
 const inputs:number[][]=Array.from({length:6},()=>[]),outputs:number[]=[];let ordinal=0;
 for(let i=0;i<sc.length;i++){const label=classes[sc[i]];
  if(label==='visual_projection')inputs[ordinal++%6].push(i);
  if(label==='descending_neuron'||label==='vnc_motor')outputs.push(i);
 }
 if(inputs.some(a=>!a.length)||!outputs.length)throw Error('Empty rate mapping');
 return {inputs:inputs.map(a=>new Uint32Array(a)),outputs:new Uint32Array(outputs)};
}
export interface RateCalibration {version:2;graph_identity:string;outputs:number[];weights:number[][];}
export interface RateModel {count:number;reset():void;step(input:Uint32Array):Uint32Array;}
