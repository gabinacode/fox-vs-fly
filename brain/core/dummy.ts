import type {BrainFrame,Observation} from '../include/types';
import {sensoryEncode} from './sensory';
/** Rule controller and synthetic activity only. Not a connectome or LIF model. */
export class DummyBrain {
 constructor(readonly count:number,readonly seed=42){if(count<1||!Number.isInteger(count))throw Error('Invalid sample count');}
 step(o:Observation):BrainFrame {
  const sensory_values=sensoryEncode(o),motor_values=new Float32Array(5);
  const dx=o.fox.x-o.fly.x,dy=o.fox.y-o.fly.y;
  const offstage=Math.abs(o.fly.x)>62;
  const dir=offstage?-Math.sign(o.fly.x):Math.abs(dx)>9?Math.sign(dx):0;
  motor_values[dir<0?0:1]=dir?1:0;
  motor_values[2]=(offstage&&o.fly.vy<0&&o.tick%12===0)||(dy>12&&o.tick%48===0)?1:0;
  motor_values[3]=Math.abs(dx)<18&&Math.abs(dy)<12&&o.tick%26===0?1:0;
  motor_values[4]=!offstage&&o.fly.y>o.fox.y+12&&o.fly.vy<0?1:0;
  if(!o.fly.stocks||!o.fox.stocks)motor_values.fill(0);
  const activity=new Uint8Array(this.count);let active_neuron_count=0;
  for(let i=0;i<this.count;i++){
   const channel=Math.floor(i*11/this.count),signal=channel<6?sensory_values[channel]:motor_values[channel-6];
   const phase=(o.tick+Math.floor(i/37)+this.seed)%24;
   activity[i]=signal>.05&&phase<7?Math.round(signal*(200+((i*17)%56))):0;
   if(activity[i]>0)active_neuron_count++;
  }
  return {version:1,tick:o.tick,activity,active_neuron_count,sensory_values,motor_values};
 }
}
