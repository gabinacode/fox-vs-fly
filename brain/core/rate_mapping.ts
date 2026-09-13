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
/** Static authored controller membership, never an activity or spike signal. */
export function ratePopulationRoles(graph:MappingAnnotations){
 const mapping=rateMapping(graph),roles=new Uint8Array(graph.annotations.superclass.length);
 for(const group of mapping.inputs)for(const i of group)roles[i]=1;
 for(const i of mapping.outputs)roles[i]=2;
 return roles;
}
export interface RateCalibration {version:2;graph_identity:string;outputs:number[];weights:number[][];}
export interface RateModel {count:number;reset():void;step(input:Uint32Array):Uint32Array;}
