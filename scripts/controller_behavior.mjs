import {graph,api,makeModel,makeSimulation,identity} from './neural_runtime.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';
const calibration=JSON.parse(fs.readFileSync(new URL('../web/public/neural/readout.json',import.meta.url)));assert.equal(calibration.graph_identity,identity);
const brain=new api.MaleCNSBrain(graph,await makeModel(),calibration);let generation=0;
const fighter={x:0,y:0,vx:0,vy:0,damage:0,grounded:1,action:0,hitstun:0,stocks:3};
const probes=[];
for(const [name,fox,fly] of [['left',{...fighter,x:-40},fighter],['right',{...fighter,x:40},fighter],['near',{...fighter,x:10},fighter],['recovery',fighter,{...fighter,x:72,y:-5,vy:-1,grounded:0}]]){
 let axes=0,jumps=0,attacks=0,fastfalls=0;
 for(let tick=0;tick<80;tick++){const f=brain.step({tick,fox,fly},generation),m=api.motorDecode(f.motor_values);if(tick>=40){axes+=m.axis;jumps+=Number(!!(m.buttons&1));attacks+=Number(!!(m.buttons&4));fastfalls+=Number(!!(m.buttons&2));}}
 const row={name,axis:axes/40,jumps,attacks,fastfalls};probes.push(row);generation++;
}
assert(probes[0].axis< -800&&probes[1].axis>800,'Must track both directions');assert(probes[0].jumps===0&&probes[1].jumps===0&&probes[0].fastfalls===0&&probes[1].fastfalls===0,'No unrelated jump/fastfall');assert(probes[2].attacks>0,'Attack in reach');assert(probes[3].axis< -800&&probes[3].jumps>0,'Recover toward stage');
let reversal=0;for(let tick=0;tick<160;tick++){const f=brain.step({tick,fox:{...fighter,x:tick<80?-40:40},fly:fighter},generation);if(tick>=120)reversal+=api.motorDecode(f.motor_values).axis;}generation++;
assert(reversal/40>800,'Must reverse direction without resetting model');
const sim=await makeSimulation();let jumps=0,fastfalls=0,attacks=0,minDistance=Infinity,damageDealt=0,lastDamage=0;const start=performance.now();
for(let tick=0;tick<600;tick++){const o=sim.snapshot();if(o.winner!==-1)break;const m=api.motorDecode(brain.step(o,generation).motor_values);jumps+=Number(!!(m.buttons&1));fastfalls+=Number(!!(m.buttons&2));attacks+=Number(!!(m.buttons&4));sim.step({axis:0,buttons:0},m);const now=sim.snapshot();if(now.fox.damage>lastDamage)damageDealt+=now.fox.damage-lastDamage;lastDamage=now.fox.damage;minDistance=Math.min(minDistance,Math.abs(now.fox.x-now.fly.x));}
const duel={damageDealt,jumps,fastfalls,attacks,minDistance,flyStocks:sim.snapshot().fly.stocks,meanMs:(performance.now()-start)/sim.snapshot().tick};assert(damageDealt>=16,'Must approach and damage a stationary opponent');assert(duel.flyStocks===3,'Must not lose stocks chasing stationary opponent');
const baselineBrain=new api.LegacyLifBrain(graph);sim.reset();let baselineDamage=0,baselineLast=0,baselineJumps=0,baselineFastfalls=0;
for(let tick=0;tick<600;tick++){const o=sim.snapshot();if(o.winner!==-1)break;const m=api.motorDecode(baselineBrain.step(o).motor_values);baselineJumps+=Number(!!(m.buttons&1));baselineFastfalls+=Number(!!(m.buttons&2));sim.step({axis:0,buttons:0},m);const d=sim.snapshot().fox.damage;if(d>baselineLast)baselineDamage+=d-baselineLast;baselineLast=d;}
assert(duel.damageDealt>baselineDamage,'Must improve on published controller');
const report={version:2,probes,reversalAxis:reversal/40,stationaryDuel:duel,publishedBaseline:{damageDealt:baselineDamage,jumps:baselineJumps,fastfalls:baselineFastfalls}};console.log(JSON.stringify(report,null,2));fs.writeFileSync(new URL('../data/controller-behavior.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
