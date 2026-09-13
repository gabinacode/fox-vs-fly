import {MaleCNSBrain} from '../../../brain/core/male_cns';
import {loadGraph,validateCatalog} from '../brain/connectome';
import type {Observation} from '../../../brain/include/types';
let brain:MaleCNSBrain|null=null;
self.onmessage=async(event:MessageEvent<{type?:string;base:string;identity:string;epoch:number;generation:number;observation:Observation}>)=>{
 const m=event.data;
 try{
  if(m.type==='initialize'){
   const base=new URL(m.base),response=await fetch(new URL('catalog.json',base),{signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw Error('Graph catalog download failed');const catalog=validateCatalog(await response.json());
   if(catalog.graph_identity!==m.identity)throw Error('Graph does not match anatomy');
   const {graph}=await loadGraph(catalog,base,p=>self.postMessage({type:'progress',...p}),new AbortController().signal);
   brain=new MaleCNSBrain(graph);self.postMessage({type:'ready'});return;
  }
  if(!brain)throw Error('Neural controller is not ready');
  // Clone cached arrays: transfer would detach the frame needed for pause retries.
  self.postMessage({epoch:m.epoch,frame:brain.step(m.observation,m.generation)});
 }catch(e){self.postMessage({type:'error',epoch:m.epoch,message:String(e)});}
};
