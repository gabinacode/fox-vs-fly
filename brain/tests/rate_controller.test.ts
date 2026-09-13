import {it,expect} from 'vitest';
import {MaleCNSBrain} from '../core/male_cns';
import {neuralSensory} from '../core/neural_sensory';
const graph={annotations:{superclass:new Uint32Array([1,1,1,1,1,1,2,2,2,2,2,2])},dictionaries:{superclass:[null,'visual_projection','descending_neuron']}};
const calibration={version:2 as const,graph_identity:'fixture',outputs:[6,7,8,9,10,11],weights:Array.from({length:6},(_,i)=>Array.from({length:6},(_,j)=>i===j?65535/6400:0))};
class ChainModel {count=12;values=new Uint32Array(12);calls=0;constructor(private connected=true){}reset(){this.values.fill(0);this.calls=0;}step(input:Uint32Array){const next=Uint32Array.from(this.values,(v,i)=>Math.floor(.25*v+input[i]+(i>=6&&this.connected ? .6*this.values[i-6] : 0)));this.values=next;this.calls++;return next;}}
const fighter={x:0,y:0,vx:0,vy:0,damage:0,grounded:1,action:0,hitstun:0,stocks:3};
const obs=(tick:number,x=-40)=>({tick,fox:{...fighter,x},fly:{...fighter}});
it('neural readout tracks either side without unrelated actions; disconnecting edges removes controls',()=>{
 for(const x of [-40,40]){const model=new ChainModel(),brain=new MaleCNSBrain(graph,model,calibration);let frame;
  for(let tick=0;tick<60;tick++)frame=brain.step(obs(tick,x));expect(frame!.motor_values[x<0?0:1]).toBeGreaterThan(.95);expect([...frame!.motor_values.slice(2)]).toEqual([0,0,0]);expect(model.calls).toBe(30);
 }
 const brain=new MaleCNSBrain(graph,new ChainModel(false),calibration);for(let tick=0;tick<60;tick++)expect([...brain.step(obs(tick)).motor_values]).toEqual([0,0,0,0,0]);
});
it('retains actual drive between model updates, caches retries and exactly resets model/readout state',()=>{
 const model=new ChainModel(),brain=new MaleCNSBrain(graph,model,calibration),first=brain.step(obs(0));expect(brain.step(obs(0))).toBe(first);
 const held=brain.step(obs(1,40));expect(held.sensory_values).toEqual(first.sensory_values);expect(model.calls).toBe(1);
 const trace=[];for(let tick=2;tick<50;tick++)trace.push(structuredClone(brain.step(obs(tick))));
 expect(brain.step(obs(0),1)).toEqual(first);brain.step(obs(1,40),1);for(let tick=2;tick<50;tick++)expect(brain.step(obs(tick),1)).toEqual(trace[tick-2]);
});
it('sensors identify reach and stage recovery and suppress unsafe fastfall',()=>{
 expect(neuralSensory({...obs(0),fox:{...fighter,x:10}})[3]).toBe(1);
 const s=neuralSensory({...obs(0),fly:{...fighter,x:72,y:-5,vy:-1,grounded:0}});expect(s[0]).toBe(1);expect(s[5]).toBe(1);expect(s[4]).toBe(0);
});
