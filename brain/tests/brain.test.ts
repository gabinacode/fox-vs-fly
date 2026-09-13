import {describe,it,expect} from 'vitest';
import {DummyBrain} from '../core/dummy';
import {placeholderGeometry,validateGeometry} from '../core/geometry';
import {sensoryEncode} from '../core/sensory';
import {motorDecode} from '../core/motor';
import type {Observation} from '../include/types';
const fighter={x:0,y:0,vx:0,vy:0,damage:0,grounded:1,action:0,hitstun:0,stocks:3};
const observation:Observation={tick:26,fox:{...fighter,x:10},fly:{...fighter}};
describe('synthetic controller contract',()=>{
 it('repeats deterministically and uses genuine decoded outputs',()=>{const a=new DummyBrain(7200),b=new DummyBrain(7200);for(let tick=0;tick<200;tick++){const f=a.step({...observation,tick});expect(f).toEqual(b.step({...observation,tick}));expect(f.active_neuron_count).toBe(f.activity.filter(x=>x>0).length);expect([...f.sensory_values,...f.motor_values].every(x=>x>=0&&x<=1)).toBe(true);}expect(motorDecode(a.step(observation).motor_values)).toEqual({axis:1000,buttons:4});});
 it('encodes side, approach, damage and edges explicitly',()=>{const s=sensoryEncode({tick:0,fox:{...fighter,x:-10,vx:2},fly:{...fighter,x:67,hitstun:30}});expect(s[0]).toBe(1);expect(s[1]).toBe(0);expect(s[2]).toBeGreaterThan(0);expect(s[3]).toBeGreaterThan(.9);expect(s[4]).toBe(1);});
 it('recovers inward, jumps on falling offstage and stops after elimination',()=>{const brain=new DummyBrain(40);const o={...observation,tick:12,fly:{...fighter,x:70,y:-5,vy:-1}};expect(motorDecode(brain.step(o).motor_values)).toEqual({axis:-1000,buttons:1});expect(motorDecode(brain.step({...o,fly:{...o.fly,stocks:0}}).motor_values)).toEqual({axis:0,buttons:0});});
 it('validates motor data',()=>{expect(()=>motorDecode(new Float32Array([0,0,NaN,0,0]))).toThrow();expect(()=>motorDecode(new Float32Array(4))).toThrow();});
 it('loads deterministic labeled geometry and rejects malformed data',()=>{const g=placeholderGeometry();validateGeometry(g);expect(g.provenance).toBe('SYNTHETIC_DEMO');expect(g.positions.length/3).toBe(7200);expect(g).toEqual(placeholderGeometry());expect(()=>validateGeometry({...g,positions:new Float32Array([NaN,1,1])})).toThrow();expect(()=>validateGeometry({...g,positions:new Float32Array(4)})).toThrow();});
 it('reports dummy steps/sec, without a biological performance claim',()=>{const brain=new DummyBrain(7200);const start=performance.now();for(let i=0;i<1000;i++)brain.step({...observation,tick:i});console.log(`dummy_steps_per_second=${Math.round(1000000/(performance.now()-start))}, samples=7200`);});
});
