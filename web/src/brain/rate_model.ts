import type {SparseGraph} from '../../../brain/core/lif';
import type {RateModel} from '../../../brain/core/rate_mapping';
export interface RateModule {
 HEAPU32:Uint32Array;HEAPU8:Uint8Array;
 _rate_allocate(n:number,e:number):number;_rate_offsets():number;_rate_targets():number;_rate_weights():number;
 _rate_input():number;_rate_values():number;_rate_packed():number;_rate_initialize():number;_rate_reset():void;_rate_step():void;_rate_pack():number;
}
export class WasmRateModel implements RateModel {
 readonly count:number;
 private driveIdx=new Uint32Array(0);private driveCount=0;
 constructor(private m:RateModule,g:SparseGraph){this.count=g.offsets.length-1;
  if(!m._rate_allocate(this.count,g.targets.length))throw Error('Rate allocation failed');
  m.HEAPU32.set(g.offsets,m._rate_offsets()/4);m.HEAPU32.set(g.targets,m._rate_targets()/4);m.HEAPU32.set(g.weights,m._rate_weights()/4);
  if(!m._rate_initialize())throw Error('Invalid rate graph');
 }
 reset(){this.m._rate_reset();this.driveCount=0;}
 /** Writes only driven indices into WASM input (clears the previous sparse set). Falls back to a full copy when driven is omitted. */
 step(input:Uint32Array,driven?:Uint32Array,drivenCount?:number){
  if(input.length!==this.count)throw Error('Rate input size mismatch');
  const base=this.m._rate_input()>>>2,heap=this.m.HEAPU32;
  for(let i=0;i<this.driveCount;i++)heap[base+this.driveIdx[i]]=0;
  if(driven&&drivenCount!==undefined){
   if(drivenCount>driven.length)throw Error('Rate drive count mismatch');
   if(this.driveIdx.length<drivenCount)this.driveIdx=new Uint32Array(Math.max(drivenCount,this.driveIdx.length*2||16));
   for(let i=0;i<drivenCount;i++){const idx=driven[i];if(idx>=this.count)throw Error('Rate drive index out of range');heap[base+idx]=input[idx];this.driveIdx[i]=idx;}
   this.driveCount=drivenCount;
  }else{
   this.m.HEAPU32.set(input,base);this.driveCount=0;
  }
  this.m._rate_step();const p=this.m._rate_values()>>>2;return this.m.HEAPU32.subarray(p,p+this.count);
 }
 packActivity(out:Uint8Array){
  if(out.length!==this.count)throw Error('Rate pack size mismatch');
  const active=this.m._rate_pack(),p=this.m._rate_packed();
  out.set(this.m.HEAPU8.subarray(p,p+this.count));return active;
 }
}
