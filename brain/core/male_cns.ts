import type {MappingAnnotations} from './population_mapping';
import {rateMapping,type RateModel,type RateCalibration} from './rate_mapping';
import {neuralSensory,RECOVERY_MARGIN} from './neural_sensory';
import type {Observation,BrainFrame} from '../include/types';
/** Pack rates with the same formula as RateNetwork::pack_activity / WASM rate_pack. */
export function packRateActivity(rates:Uint32Array,out:Uint8Array){
 if(out.length!==rates.length)throw Error('Rate pack size mismatch');
 let active=0;for(let i=0;i<rates.length;i++){out[i]=Math.min(255,Math.round(rates[i]/128));if(out[i])active++;}
 return active;
}
/** Stable measured-wiring rate reservoir plus calibrated linear readout.
 * Dynamics, sensor interface and decoder training are explicit model assumptions. */
export class MaleCNSBrain {
 private mapping;private input:Uint32Array;private driven=new Uint32Array(0);private drivenCount=0;
 private cooldown=new Uint8Array(2);private cached:BrainFrame|null=null;private generation=-1;private tick=0;
 private rates:Uint32Array|null=null;private sensory=new Float32Array(6);private packed:Uint8Array|null=null;private packedActive=0;
 constructor(graph:MappingAnnotations,private model:RateModel,private calibration:RateCalibration){
  this.mapping=rateMapping(graph);this.input=new Uint32Array(model.count);
  const driveSlots=this.mapping.inputs.reduce((n,g)=>n+g.length,0);
  this.driven=new Uint32Array(driveSlots);
  if(calibration.version!==2||calibration.outputs.length!==this.mapping.outputs.length||calibration.outputs.some((n,i)=>n!==this.mapping.outputs[i])||calibration.weights.length!==6||calibration.weights.some(row=>row.length!==calibration.outputs.length||row.some(x=>!Number.isFinite(x)||Math.abs(x)>1e5)))throw Error('Invalid neural readout calibration');
 }
 step(o:Observation,generation=0):BrainFrame{
  if(!Number.isSafeInteger(generation)||generation<0||!Number.isSafeInteger(o.tick)||o.tick<0)throw Error('Invalid controller sequence');
  if(generation!==this.generation){if(o.tick!==0)throw Error('New controller generation must start at zero');this.model.reset();this.cooldown.fill(0);this.cached=null;this.generation=generation;this.tick=0;this.rates=null;this.packed=null;this.packedActive=0;this.drivenCount=0;this.input.fill(0);}
  if(this.cached?.tick===o.tick)return this.cached;
  if(o.tick!==this.tick)throw Error('Nonconsecutive neural observation');
  // 30 Hz neural integration, 60 Hz game semantics. Display the actual last drive.
  if(this.tick%2===0){
   this.sensory=neuralSensory(o);
   for(let i=0;i<this.drivenCount;i++)this.input[this.driven[i]]=0;
   let n=0;
   for(let c=0;c<6;c++){
    const value=Math.round(6000*this.sensory[c]);if(!value)continue;
    for(const i of this.mapping.inputs[c]){this.input[i]=value;this.driven[n++]=i;}
   }
   this.drivenCount=n;
   this.rates=this.model.step(this.input,this.driven,this.drivenCount);
   // Fresh buffer each model step so prior BrainFrame activity bytes stay stable.
   this.packed=new Uint8Array(this.rates.length);
   this.packedActive=this.model.packActivity?this.model.packActivity(this.packed):packRateActivity(this.rates,this.packed);
  }
  const sensory=this.sensory,rates=this.rates!,activity=this.packed!,active=this.packedActive;
  const decoded=new Float64Array(6);
  for(let c=0;c<6;c++){let value=0;const weights=this.calibration.weights[c];for(let j=0;j<this.mapping.outputs.length;j++)value+=weights[j]*rates[this.mapping.outputs[j]]/65535;decoded[c]=Math.max(0,Math.min(1,value));}
  const motor=new Float32Array(5),axis=decoded[1]-decoded[0];motor[0]=Math.max(0,-axis);motor[1]=Math.max(0,axis);
  motor[2]=Math.max(decoded[2],decoded[5]);motor[3]=decoded[3];motor[4]=decoded[4]>.5&&motor[2]<.3?decoded[4]:0;
  // The local game rejects buttons during these authored action locks. Do not
  // consume a pulse cooldown for an input the game cannot execute.
  const locked=!!o.fly.hitlag||!!o.fly.hitstun||o.fly.action===4||o.fly.action===6||o.fly.action===7;
  const recovering=Math.abs(o.fly.x)>RECOVERY_MARGIN||o.fly.y<0;
  const eligible=[!locked&&(o.fly.jumps??2)>0,!locked&&!recovering];
  for(let j=0;j<2;j++){if(this.cooldown[j]>0){this.cooldown[j]--;motor[j+2]=0;}else if(!eligible[j])motor[j+2]=0;else if(motor[j+2]>.5)this.cooldown[j]=j===0?29:23;}
  this.tick++;return this.cached={version:1,tick:o.tick,model_tick:Math.ceil(this.tick/2),activity,active_neuron_count:active,sensory_values:sensory,motor_values:motor};
 }
}
