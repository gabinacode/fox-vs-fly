import type {Observation} from '../include/types';
export const NEURAL_SENSORY_LABELS=['Target left','Target right','Opponent above','Predicted attack window','Safe descent','Recovery need'];
const clamp=(v:number)=>Math.min(1,Math.max(0,v));
// Four observed frames through the rate/readout path plus five authored startup
// frames in the local game core. This is controller timing, not biology.
export const ATTACK_LEAD_FRAMES=9;
export const RECOVERY_MARGIN=42;
/** Authored game sensor interface: stage recovery redirects the target toward center.
 * These are not claims about biological sensory functions. No direct motor bypass. */
export function neuralSensory(o:Observation){
 const a=o.fly,b=o.fox,dx=b.x-a.x,dy=b.y-a.y;
 const recovery=Math.abs(a.x)>RECOVERY_MARGIN||a.y<0;
 const target=recovery?-a.x:dx;
 const strength=clamp((Math.abs(target)-(recovery?0:7))/12);
 const direction=Math.sign(dx)||1,projectedAttack=(dx+(b.vx-a.vx)*ATTACK_LEAD_FRAMES)*direction;
 return new Float32Array([target<0?strength:0,target>0?strength:0,
  a.grounded&&dy>12&&Math.abs(dx)<24?clamp((dy-8)/12):0,
  projectedAttack>=-2.5&&projectedAttack<=15.5&&Math.abs(dy)<10?1:0,
  !recovery&&!a.grounded&&a.vy<-.1&&a.y>b.y+5?1:0,
  recovery&&!a.grounded?1:0]);
}
