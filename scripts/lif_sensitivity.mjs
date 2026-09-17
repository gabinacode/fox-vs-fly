// Developer-only retained MODEL_ASSUMPTION assays. --check never rewrites evidence.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import ts from '../web/node_modules/typescript/lib/typescript.js';
const root=new URL('../',import.meta.url),digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const sources={},modules={};
for(const name of ['lif','population_mapping','sensitivity']){
 const path=`brain/core/${name}.ts`,source=fs.readFileSync(new URL(path,root),'utf8');sources[path]=digest(source);
 let js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 for(const [dep,url] of Object.entries(modules))js=js.replaceAll(`'./${dep}'`,JSON.stringify(url));
 modules[name]='data:text/javascript;base64,'+Buffer.from(js).toString('base64');
}
sources['scripts/lif_sensitivity.mjs']=digest(fs.readFileSync(new URL(import.meta.url)));
const {buildPopulationMapping,shufflePopulationMapping}=await import(modules.population_mapping);
const {SIGN_POLICIES,TEMPORAL_POLICIES,sensitivityModel,sensitivityTrial}=await import(modules.sensitivity);
const base=new URL('data/generated/',root),manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',base)));
const hashes={};
function checked(info){const bytes=fs.readFileSync(new URL(info.file,base));assert.equal(digest(bytes),info.sha256);hashes[info.file]=info.sha256;return bytes;}
function array(name){const info=manifest.arrays[name],b=checked(info);assert.equal(b.length,info.bytes);assert.equal(info.dtype,'<u4');return new Uint32Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.length));}
const graph={offsets:array('row_offsets'),targets:array('target_indices'),weights:array('weights')};
checked(manifest.arrays.neuron_ids);
const mapping=buildPopulationMapping({annotations:{superclass:array('annotation_superclass'),somaSide:array('annotation_somaSide')},dictionaries:JSON.parse(checked(manifest.annotations))});
const memberships=[{name:'annotated',mapping},...[20260912,20260913,20260914].map(seed=>({name:`shuffle-${seed}`,seed,mapping:shufflePopulationMapping(mapping,manifest.retained_neurons,seed)}))];
const oldBytes=fs.readFileSync(new URL('data/male-cns-v1.0.mapping-sweep.json',root)),old=JSON.parse(oldBytes);
assert.equal(old.graph_identity,manifest.arrays.neuron_ids.sha256);
const conditions=TEMPORAL_POLICIES.flatMap(time=>SIGN_POLICIES.map(sign=>({time,sign}))),rows=[];
function run({time,sign},reverse=false){
 const model=sensitivityModel(graph,sign,time),pulse=sensitivityTrial(model,time),mapped={};
 for(const m of reverse?[...memberships].reverse():memberships){
  const trials=[];for(const channel of reverse?[1,0]:[0,1])trials[channel]=sensitivityTrial(model,time,m.mapping,channel);
  const r=trials.map(t=>t.readoutPerReferenceUnit);
  mapped[m.name]={seed:m.seed??null,trials,directionalContrast:(r[1][1]-r[1][0])-(r[0][1]-r[0][0])};
  if(sign==='zero')assert.deepEqual(trials.map(t=>t.readoutCounts),[[0,0],[0,0]]);
  if(time.name==='baseline'&&sign==='positive'){
   const prior=old.result.rows.find(r=>r.amplitude===500&&(m.seed?r.shuffleSeed===m.seed:r.name.startsWith('Annotated')));
   assert.deepEqual(trials.map(t=>t.hash),prior.trialHashes);assert.deepEqual(trials.map(t=>t.readoutPerTick),prior.readout);
  }
 }
 assert.equal(pulse.bins.reduce((a,b)=>a+b,0),pulse.spikes);
 if(time.name==='baseline'&&sign==='positive')assert.equal(pulse.spikes,2318764);
 if(time.name==='stronger-leak'&&sign==='positive')assert.equal(pulse.spikes,6722);
 if(time.name==='baseline'&&sign==='alternating')assert.equal(pulse.spikes,9057);
 return {sign,time,parameters:model.parameters,pulse,mapped};
}
for(const c of conditions){rows.push(run(c));console.log(`Measured ${c.time.name}/${c.sign}`);}
for(let i=conditions.length-1;i>=0;i--){assert.deepEqual(run(conditions[i],true),rows[i]);console.log(`Replay ${conditions[i].time.name}/${conditions[i].sign}`);}
const report={format:'LIF_SENSITIVITY_V1',label:'MODEL_ASSUMPTION',graphIdentity:manifest.arrays.neuron_ids.sha256,
 sourceHashes:sources,inputHashes:hashes,priorMappingReportSha256:digest(oldBytes),
 protocol:{timeUnits:'arbitrary reference units, not milliseconds',pulseDuration:600,pulseOnDuration:10,pulseAmplitudePerUnit:1000,pulseStride:100,mappingDuration:60,mappingAmplitudePerUnit:500,binDuration:60,
 replay:'Complete reset before every stimulus; repeat conditions, memberships and stimulus order in reverse; exact equality of every deterministic diagnostic',
 timestepCaveat:'dt=2 rescales duration, external increments, refractory steps and retention (19/20)^2; edge delay remains one step, hence doubles in reference units. Integer rounding and threshold checks differ. Not convergence or biological calibration.',
 signs:'Artificial 100-index blocks and their inversion; zero disables outgoing current. No NT inference.'},
 coverage:{inputs:mapping.inputs.map(g=>g.length),outputs:mapping.outputs.map(g=>g.length),excludedInput:mapping.excludedInput,excludedOutput:mapping.excludedOutput},rows};
const output=new URL('data/male-cns-v1.0.sensitivity.json',root),serialized=JSON.stringify(report,null,2)+'\n';
if(process.argv.includes('--check'))assert.equal(fs.readFileSync(output,'utf8'),serialized,'Retained sensitivity evidence changed');else fs.writeFileSync(output,serialized);
console.log(`PASS: ${rows.length} conditions, 108 trials per pass, reverse/reset replay and prior anchors; ${process.argv.includes('--check')?'retained JSON matches':'JSON retained'}`);
