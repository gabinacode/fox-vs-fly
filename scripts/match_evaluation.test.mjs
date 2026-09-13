import {test} from 'node:test';import assert from 'node:assert/strict';
import {opponentInput,opponents,MatchMetrics} from './match_evaluation.mjs';
const fighter={x:0,y:0,vx:0,vy:0,grounded:1,damage:0,stocks:3};
const obs=(tick,fly={},fox={})=>({tick,fox:{...fighter,...fox},fly:{...fighter,...fly}});
const frame={activity:new Uint8Array([0,1,255]),active_neuron_count:2};
test('opponents produce bounded reproducible pulses and mobile policies turn inward offstage',()=>{
 for(const name of opponents){for(let tick=0;tick<360;tick++){const o=obs(tick,{x:5},{x:-5}),a=opponentInput(name,o,7);assert.deepEqual(a,opponentInput(name,o,7));assert(Number.isInteger(a.axis)&&Math.abs(a.axis)<=1000);assert.equal(a.buttons&~7,0);}
  if(name!=='stationary')assert.equal(opponentInput(name,obs(13,{x:0},{x:75,y:-5,vy:-1,grounded:0}),7).axis,-1000);
 }
 assert.deepEqual(opponentInput('stationary',obs(0),7),{axis:0,buttons:0});assert.throws(()=>opponentInput('unknown',obs(0),7));
 const attacks=Array.from({length:48},(_,tick)=>opponentInput('rushdown',obs(tick,{x:5}),7).buttons&4);assert.equal(attacks.filter(Boolean).length,2);
 for(let tick=0;tick<360;tick++)assert.equal(opponentInput('shuttle',obs(tick,{x:5}),7).buttons&4,0);
});
test('metrics retain losses, distinguish recovered/failed/open excursions, and do not count damage resets as damage',()=>{
 const m=new MatchMetrics();m.observe(obs(0,{x:70,y:-2,grounded:0,damage:80}),obs(1,{stocks:2}),frame,{axis:-1000,buttons:1});
 m.observe(obs(1,{x:70,y:-2,grounded:0,stocks:2}),obs(2,{stocks:2},{damage:8}),frame,{axis:1000,buttons:4});
 m.observe(obs(2,{x:70,y:-2,grounded:0,stocks:2},{damage:8}),obs(300,{x:71,y:-3,grounded:0,stocks:2},{damage:8}),frame,{axis:0,buttons:2});
 const r=m.result();assert.deepEqual(r.stockLosses,{fox:0,fly:1});assert.equal(r.observedDamage.fly,0);assert.equal(r.recovery.started,3);assert.equal(r.recovery.landed,1);assert.equal(r.recovery.stockLost,1);assert.equal(r.recovery.open,1);assert.equal(r.axisReversals,1);assert.equal(r.activeNodes.mean,2);assert.equal(r.activitySamples[0].saturatedPackedNodes,1);assert.deepEqual(r.requestedActionFrames,{jump:1,attack:1,fastfall:1});
 assert.equal(r.observedDamage.fox,8);assert.equal(r.stockEvents[0].lastControl.buttons,1);
});
