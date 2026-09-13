import type {Observation} from '../include/types';
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
/** MODEL_ASSUMPTION: game-state channels, no claimed biological mapping. */
export function sensoryEncode(o:Observation):Float32Array {
 const dx=o.fox.x-o.fly.x;
 return new Float32Array([clamp(-dx/60),clamp(dx/60),clamp(-Math.sign(dx)*(o.fox.vx-o.fly.vx)/3),clamp((Math.abs(o.fly.x)-48)/20),clamp(o.fly.hitstun/25),o.fly.grounded?1:0]);
}
