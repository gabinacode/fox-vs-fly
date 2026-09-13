import type {SparseGraph} from '../../../brain/core/lif';
import type {RateModel} from '../../../brain/core/rate_mapping';
export interface RateModule {HEAPU32:Uint32Array;_rate_allocate(n:number,e:number):number;_rate_offsets():number;_rate_targets():number;_rate_weights():number;_rate_input():number;_rate_values():number;_rate_initialize():number;_rate_reset():void;_rate_step():void;}
export class WasmRateModel implements RateModel {
 readonly count:number;
 constructor(private m:RateModule,g:SparseGraph){this.count=g.offsets.length-1;
  if(!m._rate_allocate(this.count,g.targets.length))throw Error('Rate allocation failed');
  m.HEAPU32.set(g.offsets,m._rate_offsets()/4);m.HEAPU32.set(g.targets,m._rate_targets()/4);m.HEAPU32.set(g.weights,m._rate_weights()/4);
  if(!m._rate_initialize())throw Error('Invalid rate graph');
 }
 reset(){this.m._rate_reset();}
 step(input:Uint32Array){if(input.length!==this.count)throw Error('Rate input size mismatch');
  this.m.HEAPU32.set(input,this.m._rate_input()/4);this.m._rate_step();const p=this.m._rate_values()/4;return this.m.HEAPU32.subarray(p,p+this.count);
 }
}
