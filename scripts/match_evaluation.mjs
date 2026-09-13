// Developer-only authored opponents and measurement; never a player controller.
export const opponents=['stationary','rushdown','retreat_punish','jump_crossup','edge_bait','shuttle'];
export function opponentInput(name,o,seed){
 if(!opponents.includes(name))throw Error('Unknown opponent');
 if(name==='stationary')return {axis:0,buttons:0};
 const a=o.fox,b=o.fly,dx=b.x-a.x,phase=(o.tick+seed)%180;
 const toward=x=>Math.abs(x-a.x)<2?0:Math.sign(x-a.x)*1000;
 let axis=toward(b.x),buttons=0;
 if(name==='retreat_punish')axis=Math.abs(a.x)>48?toward(0):Math.abs(dx)<28?-Math.sign(dx||1)*1000:0;
 if(name==='jump_crossup'){axis=toward(phase<90?50:-50);if(Math.abs(dx)<28&&(o.tick+seed)%45===0)buttons|=1;}
 if(name==='shuttle')axis=toward((Math.floor((o.tick+seed)/60)%2?1:-1)*48);
 if(name==='edge_bait')axis=toward((Math.floor((o.tick+seed)/240)%2?1:-1)*56);
 // All mobile opponents recover toward center rather than intentionally walk off.
 if(Math.abs(a.x)>60||a.y<0){axis=toward(0);if(!a.grounded&&a.vy<0&&(o.tick+seed)%20===0)buttons|=1;}
 if(name!=='shuttle'&&Math.abs(dx)<18&&Math.abs(b.y-a.y)<10&&(o.tick+seed)%24===0){axis=Math.sign(dx||1)*1000;buttons|=4;}
 return {axis,buttons};
}
export class MatchMetrics {
 constructor(){this.frames=0;this.damage={fox:0,fly:0};this.stockLosses={fox:0,fly:0};this.actions={jump:0,attack:0,fastfall:0};this.active={min:Infinity,max:0,sum:0};this.recovery={started:0,landed:0,stockLost:0,open:0,maxFrames:0,actionableFrames:0,framesWithJumpAvailable:0,jumpRequestFrames:0};this.recoveryAge=0;this.recoveryOpen=false;this.noDamage=0;this.longestNoDamage=0;this.axisReversals=0;this.lastAxis=0;this.events=[];this.activitySamples=[];}
 observe(before,after,frame,input){
  this.frames++;let damageEvent=false;
  for(const player of ['fox','fly']){
   const lost=before[player].stocks-after[player].stocks,damage=Math.max(0,after[player].damage-before[player].damage);
   this.damage[player]+=damage;this.stockLosses[player]+=lost;damageEvent ||= damage>0;
   if(lost)this.events.push({tick:after.tick,player,stocks:after[player].stocks,priorDamage:before[player].damage,priorX:before[player].x,priorY:before[player].y,...(player==='fly'?{lastControl:{axis:input.axis,buttons:input.buttons,hitstun:before.fly.hitstun??0,hitlag:before.fly.hitlag??0,jumps:before.fly.jumps??0,action:before.fly.action??0,sensory:Array.from(frame.sensory_values??[]),motor:Array.from(frame.motor_values??[])}}:{})});
  }
  this.noDamage=damageEvent?0:this.noDamage+1;this.longestNoDamage=Math.max(this.longestNoDamage,this.noDamage);
  for(const [key,bit] of [['jump',1],['attack',4],['fastfall',2]])this.actions[key]+=Number(!!(input.buttons&bit));
  const sign=Math.sign(input.axis);if(sign&&this.lastAxis&&sign!==this.lastAxis)this.axisReversals++;if(sign)this.lastAxis=sign;
  const active=frame.active_neuron_count;this.active.min=Math.min(this.active.min,active);this.active.max=Math.max(this.active.max,active);this.active.sum+=active;
  const hazard=f=>!f.grounded&&(Math.abs(f.x)>68||f.y<0);
  // Evaluate the pre-step hazard first so a one-frame stock-loss transition counts.
  if(!this.recoveryOpen&&hazard(before.fly)){this.recoveryOpen=true;this.recovery.started++;this.recoveryAge=0;}
  if(this.recoveryOpen){this.recovery.actionableFrames+=Number(!(before.fly.hitstun??0)&&!(before.fly.hitlag??0)&&before.fly.action!==6);this.recovery.framesWithJumpAvailable+=Number((before.fly.jumps??0)>0);this.recovery.jumpRequestFrames+=Number(!!(input.buttons&1));this.recoveryAge++;this.recovery.maxFrames=Math.max(this.recovery.maxFrames,this.recoveryAge);
   if(after.fly.stocks<before.fly.stocks){this.recovery.stockLost++;this.recoveryOpen=false;}
   else if(after.fly.grounded&&Math.abs(after.fly.x)<=68){this.recovery.landed++;this.recoveryOpen=false;}
  }
  if(after.tick%300===0){let sum=0,saturated=0;for(const a of frame.activity){sum+=a;saturated+=Number(a===255);}this.activitySamples.push({tick:after.tick,active,meanPackedByte:sum/frame.activity.length,saturatedPackedNodes:saturated});}
 }
 result(){return {frames:this.frames,observedDamage:this.damage,stockLosses:this.stockLosses,requestedActionFrames:this.actions,axisReversals:this.axisReversals,longestNoDamageFrames:this.longestNoDamage,activeNodes:{min:this.frames?this.active.min:0,max:this.active.max,mean:this.active.sum/(this.frames||1)},recovery:{...this.recovery,open:Number(this.recoveryOpen)},stockEvents:this.events,activitySamples:this.activitySamples};}
}
