import {WasmRateModel} from '../brain/rate_model';
import {MaleCNSBrain} from '../../../brain/core/male_cns';
import {ratePopulationRoles} from '../../../brain/core/rate_mapping';
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
   self.postMessage({type:'progress',phase:'validating',received:1,total:1});
   const moduleURL=new URL('../wasm/neural.js',base).href;
   const [{default:create},calibrationResponse]=await Promise.all([import(/* @vite-ignore */ moduleURL),fetch(new URL('../neural/readout.json',base),{signal:AbortSignal.timeout(30000)})]);
   if(!calibrationResponse.ok)throw Error('Neural calibration download failed');const calibration=await calibrationResponse.json();
   if(calibration.graph_identity!==catalog.graph_identity)throw Error('Neural calibration graph mismatch');
   const module=await create({locateFile:(name:string)=>new URL(name,moduleURL).href});
   brain=new MaleCNSBrain(graph,new WasmRateModel(module,graph),calibration);
   const populations=ratePopulationRoles(graph);self.postMessage({type:'ready',populations},{transfer:[populations.buffer]});return;
  }
  if(!brain)throw Error('Neural controller is not ready');
  // Clone cached arrays: transfer would detach the frame needed for pause retries.
  self.postMessage({epoch:m.epoch,frame:brain.step(m.observation,m.generation)});
 }catch(e){self.postMessage({type:'error',epoch:m.epoch,message:String(e)});}
};
