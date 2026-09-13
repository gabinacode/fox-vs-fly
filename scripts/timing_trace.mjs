// Developer-only trace of authored controller timing against selected policies.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {graph,api,makeModel,makeSimulation,identity} from './neural_runtime.mjs';
import {opponentInput} from './match_evaluation.mjs';
const root=new URL('../',import.meta.url),calibration=JSON.parse(fs.readFileSync(new URL('web/public/neural/readout.json',root)));assert.equal(calibration.graph_identity,identity);
const args=process.argv.slice(2),quick=args.includes('--short'),verbose=args.includes('--verbose'),output=args.find((x,i)=>!x.startsWith('--')&&!['--opponent','--seed'].includes(args[i-1]))??new URL('data/controller-timing.json',root).pathname;
const arg=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];},onlyOpponent=arg('--opponent'),onlySeed=arg('--seed');
const allConditions=[['shuttle',7,quick?300:7200],['shuttle',29,quick?300:7200],['rushdown',7,quick?300:3600],['rushdown',29,quick?300:3600],['edge_bait',7,quick?300:3600],['edge_bait',29,quick?300:3600]];
const conditions=allConditions.filter(([opponent,seed])=>(!onlyOpponent||opponent===onlyOpponent)&&(!onlySeed||seed===Number(onlySeed)));assert(conditions.length,'No timing-trace condition matched');
const sim=await makeSimulation(),brain=new api.MaleCNSBrain(graph,await makeModel(),calibration);let generation=0;
const traces=[];
for(const [opponent,phaseSeed,limit] of conditions){
 sim.reset();const attacks=[],recoveryJumps=[],recoveryFrames=[],stockLosses=[];let lastFoxDamage=0,lastReachOnset=null,reach=false;
 for(let tick=0;tick<limit;tick++){
  const before=sim.snapshot();if(before.winner!==-1)break;
  const frame=brain.step(before,generation),fly=api.motorDecode(frame.motor_values),fox=opponentInput(opponent,before,phaseSeed);
  if(verbose&&!before.fly.grounded&&(Math.abs(before.fly.x)>55||before.fly.y<5))recoveryFrames.push({tick,x:before.fly.x,y:before.fly.y,vx:before.fly.vx,vy:before.fly.vy,jumps:before.fly.jumps,action:before.fly.action,hitstun:before.fly.hitstun,hitlag:before.fly.hitlag,sensory:frame.sensory_values[5],jumpMotor:frame.motor_values[2],buttons:fly.buttons,axis:fly.axis});
  const nowReach=frame.sensory_values[3]>.5;if(nowReach&&!reach)lastReachOnset=tick;reach=nowReach;
  if(fly.buttons&4)attacks.push({tick,hit:false,reachOnset:lastReachOnset,decodeDelay:lastReachOnset===null?null:tick-lastReachOnset,sensoryReach:frame.sensory_values[3],dx:before.fox.x-before.fly.x,dy:before.fox.y-before.fly.y,relativeVx:before.fox.vx-before.fly.vx,flyVx:before.fly.vx,foxVx:before.fox.vx,facing:before.fly.facing,axis:fly.axis,flyAction:before.fly.action,flyGrounded:before.fly.grounded});
  const hazard=!before.fly.grounded&&(Math.abs(before.fly.x)>68||before.fly.y<0);
  if(hazard&&(fly.buttons&1))recoveryJumps.push({tick,x:before.fly.x,y:before.fly.y,vx:before.fly.vx,vy:before.fly.vy,jumps:before.fly.jumps,action:before.fly.action,hitstun:before.fly.hitstun,hitlag:before.fly.hitlag,sensory:frame.sensory_values[5],motor:frame.motor_values[2]});
  sim.step(fox,fly);const after=sim.snapshot();
  if(after.fox.damage>lastFoxDamage){const attempt=attacks.findLast(a=>!a.hit&&tick-a.tick<=12);if(attempt){attempt.hit=true;attempt.hitTick=after.tick;attempt.delay=after.tick-attempt.tick;}lastFoxDamage=after.fox.damage;}
  if(after.fox.stocks<before.fox.stocks)lastFoxDamage=0;
  if(after.fly.stocks<before.fly.stocks)stockLosses.push({tick:after.tick,x:before.fly.x,y:before.fly.y,vx:before.fly.vx,vy:before.fly.vy,jumps:before.fly.jumps,action:before.fly.action,hitstun:before.fly.hitstun,hitlag:before.fly.hitlag,lastRecoveryJump:recoveryJumps.at(-1)??null,framesSinceRecoveryJump:recoveryJumps.length?tick-recoveryJumps.at(-1).tick:null,sensory:Array.from(frame.sensory_values),motor:Array.from(frame.motor_values)});
 }
 const final=sim.snapshot(),misses=attacks.filter(a=>!a.hit);
 traces.push({opponent,phaseSeed,frames:final.tick,outcome:final.winner===-1?'timeout':final.winner===1?'fly_win':'fly_loss',attackSummary:{requests:attacks.length,hits:attacks.length-misses.length,misses:misses.length,meanAbsoluteDx:attacks.reduce((s,a)=>s+Math.abs(a.dx),0)/(attacks.length||1),meanProjectedAbsoluteDx:attacks.reduce((s,a)=>s+Math.abs(a.dx+5*a.relativeVx),0)/(attacks.length||1)},attacks,recoveryJumps,...(verbose?{recoveryFrames}:{}),stockLosses});generation++;
}
fs.writeFileSync(output,JSON.stringify({schema:2,controller:'V2 authored timing trace',interpretation:'Game-state timing trace for authored regression policies; no biological claim',traces},null,2)+'\n');
console.log(JSON.stringify(traces.map(t=>({opponent:t.opponent,seed:t.phaseSeed,frames:t.frames,outcome:t.outcome,attack:t.attackSummary,recoveryJumps:t.recoveryJumps.length,stockLosses:t.stockLosses.length})),null,2));
