import type {Observation} from '../include/types';
export const NEURAL_SENSORY_LABELS=['Target left','Target right','Opponent above','Opponent in reach','Safe descent','Recovery need'];
const clamp=(v:number)=>Math.min(1,Math.max(0,v));
/** Authored game sensor interface: stage recovery redirects the target toward center.
 * These are not claims about biological sensory functions. No direct motor bypass. */
export function neuralSensory(o:Observation){
 const a=o.fly,b=o.fox,dx=b.x-a.x,dy=b.y-a.y;
 const recovery=Math.abs(a.x)>58||a.y<0;
 const target=recovery?-a.x:dx;
 const strength=clamp((Math.abs(target)-(recovery?0:7))/12);
 return new Float32Array([target<0?strength:0,target>0?strength:0,
  a.grounded&&dy>12&&Math.abs(dx)<24?clamp((dy-8)/12):0,
  Math.abs(dx)<17&&Math.abs(dy)<10?1:0,
  !recovery&&!a.grounded&&a.vy<-.1&&a.y>b.y+5?1:0,
  recovery&&!a.grounded&&a.vy<0?1:0]);
}
