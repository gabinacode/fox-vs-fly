import {it,expect} from 'vitest';
import {MaleCNSBrain} from '../core/male_cns';
import {motorDecode} from '../core/motor';
const graph={offsets:new Uint32Array([0,4,4,4,4,4,4,4]),targets:new Uint32Array([2,4,5,6]),weights:new Uint32Array(4).fill(1000),annotations:{superclass:new Uint32Array([1,1,2,2,3,3,3]),somaSide:new Uint32Array([1,2,1,2,1,1,1])},dictionaries:{superclass:[null,'visual_projection','descending_neuron','vnc_motor'],somaSide:[null,'L','R']}};
const fighter={x:0,y:0,vx:0,vy:0,damage:0,grounded:0,action:0,hitstun:0,stocks:3};
const observation=(tick:number)=>({tick,fox:{...fighter,x:-60},fly: {...fighter}});
it('observations stimulate input cells and delayed measured edges exclusively drive output cells',()=>{
 const brain=new MaleCNSBrain(graph),a=brain.step(observation(0));
 expect([...a.activity]).toEqual([255,0,0,0,0,0,0]);expect([...a.motor_values]).toEqual([0,0,0,0,0]);
 const b=brain.step(observation(1));expect([...b.activity]).toEqual([0,0,255,0,255,255,255]);
 expect([...b.motor_values]).toEqual([.75,0,.75,.75,.75]);expect(motorDecode(b.motor_values)).toEqual({axis:-750,buttons:7});
 const disconnected=new MaleCNSBrain({...graph,offsets:new Uint32Array(8),targets:new Uint32Array(),weights:new Uint32Array()});
 for(let tick=0;tick<30;tick++)expect([...disconnected.step(observation(tick)).motor_values]).toEqual([0,0,0,0,0]);
});
it('pause retry is idempotent, reset reproduces all activity and motor frames, skipped ticks fail',()=>{
 const brain=new MaleCNSBrain(graph),trace=[];
 for(let tick=0;tick<30;tick++){const frame=brain.step(observation(tick));trace.push(structuredClone(frame));expect(brain.step(observation(tick))).toBe(frame);}
 for(let tick=0;tick<30;tick++)expect(brain.step(observation(tick),1)).toEqual(trace[tick]);
 expect(()=>brain.step(observation(32),1)).toThrow('Nonconsecutive');expect(()=>brain.step(observation(1),2)).toThrow('zero');
});

it('sustained activity emits repeatable action edges rather than permanently held buttons',()=>{
 const brain=new MaleCNSBrain(graph),pressed:number[][]=[[],[]];
 for(let tick=0;tick<120;tick++){const f=brain.step(observation(tick));for(let j=0;j<2;j++)if(f.motor_values[j+2]>.5)pressed[j].push(tick);}
 expect(pressed[0]).toEqual([1,46,91]);expect(pressed[1]).toEqual([1,21,41,61,81,101]);
});
