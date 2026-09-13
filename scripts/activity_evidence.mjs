// Reproducible full-graph samples; packed bytes before any renderer transform.
import {graph,api,array,identity,makeModel,makeSimulation} from './neural_runtime.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const calibration=JSON.parse(fs.readFileSync(new URL('../web/public/neural/readout.json',import.meta.url)));
assert.equal(calibration.graph_identity,identity);
const visual=array('visual_indices'),positions=array('positions',Float32Array);
// Display-cloud split, not a biological classifier: the normalized geometry has
// a gap at y=.34 between upper head/brain and lower cord; keep annotations separate.
const groups={brain:[],vnc:[]};
for(let j=0;j<visual.length;j++)groups[positions[j*3+1]>.34?'brain':'vnc'].push(visual[j]);
function stats(indices,activity){const values=indices.map(i=>activity[i]).sort((a,b)=>a-b),active=values.filter(x=>x>0).length;
 return {positioned:values.length,active,activeFraction:values.length?active/values.length:0,meanByte:values.reduce((a,b)=>a+b,0)/(values.length||1),p95Byte:values[Math.max(0,Math.ceil(values.length*.95)-1)]??0};}
const positioned=new Set(visual),mapping=api.rateMapping(graph);
const populations={};for(const label of ['visual_projection','descending_neuron','vnc_motor','vnc_sensory','cb_sensory','ol_sensory']){
 const indices=Array.from(graph.annotations.superclass.keys()).filter(i=>graph.dictionaries.superclass[graph.annotations.superclass[i]]===label);
 populations[label]={total:indices.length,positioned:indices.filter(i=>positioned.has(i)).length};
}
const brain=new api.MaleCNSBrain(graph,await makeModel(),calibration),sim=await makeSimulation(),samples=[];
for(let tick=0;tick<600;tick++){
 const o=sim.snapshot();if(o.winner!==-1)break;
 const f=brain.step(o),m=api.motorDecode(f.motor_values),phase=m.buttons&4?'attack':Math.abs(o.fox.x-o.fly.x)>17&&m.axis?'approach':null;
 if(phase&&!samples.some(s=>s.phase===phase&&s.window===(tick<120?'early':'later'))&&tick>=10){
  const regions=Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,stats(v,f.activity)]));
  assert.equal(Object.values(regions).reduce((s,r)=>s+r.positioned,0),visual.length);
  samples.push({phase,window:tick<120?'early':'later',gameTick:tick,modelTick:f.model_tick,distance:Math.abs(o.fox.x-o.fly.x),activeModelNodes:f.active_neuron_count,regions});
 }
 sim.step({axis:0,buttons:0},m);
}
assert(samples.some(s=>s.phase==='approach')&&samples.some(s=>s.phase==='attack'),'Require both approach and attack samples');
const report={graphIdentity:identity,activity:'min(255, round(rate/128)); active means byte > 0 (rate >= 64), not spikes',regionDefinition:'Display-cloud spatial partition: normalized soma y > 0.34 = upper brain/head, y <= 0.34 = lower VNC. Operational geometry split, not annotation-based anatomy; somaNeuromere is missing for 118359 positioned nodes.',inputNodes:mapping.inputs.reduce((n,a)=>n+a.length,0),readoutNodes:mapping.outputs.length,populations,samples};
fs.writeFileSync(new URL('../data/activity-evidence.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
