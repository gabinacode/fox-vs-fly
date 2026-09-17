import {WasmRateModel} from '../brain/rate_model';
import {MaleCNSBrain} from '../../../brain/core/male_cns';
import {ratePopulationRoles} from '../../../brain/core/rate_mapping';
import {loadGraph,validateCatalog} from '../brain/connectome';
import type {Observation} from '../../../brain/include/types';
let brain:MaleCNSBrain|null=null;
/** Ping-pong outbound copies so cached worker frames stay attached while UI receives transfers. */
const activityPool:Uint8Array[]=[];const sensoryPool:Float32Array[]=[];const motorPool:Float32Array[]=[];
let poolSlot=0;
function takeActivity(src:Uint8Array){
 const i=poolSlot%4;let out=activityPool[i];
 if(!out||out.length!==src.length||out.buffer.byteLength===0)out=activityPool[i]=new Uint8Array(src.length);
 out.set(src);return out;
}
function takeF32(pool:Float32Array[],src:Float32Array){
 const i=poolSlot%4;let out=pool[i];
 if(!out||out.length!==src.length||out.buffer.byteLength===0)out=pool[i]=new Float32Array(src.length);
 out.set(src);return out;
}
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
  // Keep MaleCNSBrain's cached arrays attached for pause retries; transfer outbound copies.
  const frame=brain.step(m.observation,m.generation);
  // Activity changes only on even game ticks (30 Hz). On the held tick the UI
  // reuses its already-transferred buffer, avoiding a redundant 166,700-byte copy.
  const activity=frame.tick%2===0?takeActivity(frame.activity):undefined;
  const sensory_values=takeF32(sensoryPool,frame.sensory_values),motor_values=takeF32(motorPool,frame.motor_values);
  poolSlot++;
  const transfer:Transferable[]=[sensory_values.buffer,motor_values.buffer];if(activity)transfer.unshift(activity.buffer);
  self.postMessage({epoch:m.epoch,frame:{...frame,activity,sensory_values,motor_values}},{transfer});
 }catch(e){self.postMessage({type:'error',epoch:m.epoch,message:String(e)});}
};
