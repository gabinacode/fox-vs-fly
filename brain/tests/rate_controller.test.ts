import {it,expect} from 'vitest';
import {MaleCNSBrain} from '../core/male_cns';
import {ATTACK_LEAD_FRAMES,neuralSensory,RECOVERY_MARGIN} from '../core/neural_sensory';
const graph={annotations:{superclass:new Uint32Array([1,1,1,1,1,1,2,2,2,2,2,2])},dictionaries:{superclass:[null,'visual_projection','descending_neuron']}};
const calibration={version:2 as const,graph_identity:'fixture',outputs:[6,7,8,9,10,11],weights:Array.from({length:6},(_,i)=>Array.from({length:6},(_,j)=>i===j?65535/6400:0))};
class ChainModel {count=12;values=new Uint32Array(12);calls=0;constructor(private connected=true){}reset(){this.values.fill(0);this.calls=0;}step(input:Uint32Array){const next=Uint32Array.from(this.values,(v,i)=>Math.floor(.25*v+input[i]+(i>=6&&this.connected ? .6*this.values[i-6] : 0)));this.values=next;this.calls++;return next;}}
const fighter={x:0,y:0,vx:0,vy:0,damage:0,grounded:1,action:0,hitstun:0,stocks:3};
const obs=(tick:number,x=-40)=>({tick,fox:{...fighter,x},fly:{...fighter}});
it('counts nonzero packed rates rather than spikes or propagation-threshold crossings',()=>{
 const values=new Uint32Array([0,31,32,63,64,128,192,32704,65535,0,0,0]);
 const brain=new MaleCNSBrain(graph,{count:12,reset(){},step(){return values;}},calibration);
 const frame=brain.step(obs(0));
 expect([...frame.activity]).toEqual([0,0,0,0,1,1,2,255,255,0,0,0]);
 expect(frame.active_neuron_count).toBe(5);
});
it('packs activity only on model steps and reuses the buffer on the held game frame',()=>{
 const values=new Uint32Array(12);values[4]=128;
 let packs=0;const model={count:12,reset(){},step(input:Uint32Array){return values;},packActivity(out:Uint8Array){packs++;out.set([0,0,0,0,1,0,0,0,0,0,0,0]);return 1;}};
 const brain=new MaleCNSBrain(graph,model,calibration),a=brain.step(obs(0)),b=brain.step(obs(1));
 expect(packs).toBe(1);expect(a.activity).toBe(b.activity);expect([...b.activity]).toEqual([0,0,0,0,1,0,0,0,0,0,0,0]);
 brain.step(obs(2));expect(packs).toBe(2);
});
it('clears only prior drive indices before writing sparse sensory currents',()=>{
 const seen:Uint32Array[]=[];
 const model={count:12,reset(){},step(input:Uint32Array,driven?:Uint32Array,drivenCount?:number){
  seen.push(Uint32Array.from(input));expect(drivenCount).toBeGreaterThan(0);expect(driven!.length).toBeGreaterThanOrEqual(drivenCount!);
  return new Uint32Array(12);
 }};
 const brain=new MaleCNSBrain(graph,model,calibration);brain.step(obs(0,-40));brain.step(obs(1,40));brain.step(obs(2,40));
 expect(seen).toHaveLength(2);
 expect(seen[0].some(Boolean)).toBe(true);expect(seen[1].some(Boolean)).toBe(true);
});
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
 expect(ATTACK_LEAD_FRAMES).toBe(9);
 expect(RECOVERY_MARGIN).toBe(42);
 expect(neuralSensory({...obs(0),fox:{...fighter,x:28,vx:-1.5},fly:{...fighter,vx:1.5}})[3]).toBe(1);
 expect(neuralSensory({...obs(0),fox:{...fighter,x:2,vx:-1.5},fly:{...fighter,vx:1.5}})[3]).toBe(0);
 expect(neuralSensory({...obs(0),fox:{...fighter,x:-28,vx:1.5},fly:{...fighter,vx:-1.5}})[3]).toBe(1);
 expect(neuralSensory({...obs(0),fox:{...fighter,x:-2,vx:1.5},fly:{...fighter,vx:-1.5}})[3]).toBe(0);
 const s=neuralSensory({...obs(0),fly:{...fighter,x:72,y:-5,vy:-1,grounded:0}});expect(s[0]).toBe(1);expect(s[5]).toBe(1);expect(s[4]).toBe(0);
 expect(neuralSensory({...obs(0),fly:{...fighter,x:72,y:8,vy:2,grounded:0,action:7,hitstun:8}})[5]).toBe(1);
});
it('does not consume jump cooldown while the game rejects the pulse',()=>{
 const brain=new MaleCNSBrain(graph,new ChainModel(),calibration),fly={...fighter,x:72,y:-5,vy:-1,grounded:0,jumps:1,action:7,hitstun:2,hitlag:0};
 brain.step({...obs(0),fly});brain.step({...obs(1),fly});
 expect(brain.step({...obs(2),fly}).motor_values[2]).toBe(0);
 const accepted=brain.step({...obs(3),fly:{...fly,action:5,hitstun:0}});expect(accepted.motor_values[2]).toBeGreaterThan(.5);
 expect(brain.step({...obs(4),fly:{...fly,action:5,hitstun:0}}).motor_values[2]).toBe(0);
});
it('does not attack during recovery or consume that attack cooldown',()=>{
 const brain=new MaleCNSBrain(graph,new ChainModel(),calibration),offstage={...fighter,x:72,y:1,grounded:0,action:5};
 brain.step({...obs(0),fox:{...fighter,x:82},fly:offstage});brain.step({...obs(1),fox:{...fighter,x:82},fly:offstage});
 expect(brain.step({...obs(2),fox:{...fighter,x:82},fly:offstage}).motor_values[3]).toBe(0);
 expect(brain.step({...obs(3),fox:{...fighter,x:10},fly:{...fighter,grounded:0,action:5}}).motor_values[3]).toBeGreaterThan(.5);
});
