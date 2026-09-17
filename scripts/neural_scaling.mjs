// Developer-only neural scaling profile. --check verifies deterministic hashes only.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import os from 'node:os';
import ts from '../web/node_modules/typescript/lib/typescript.js';

const root=new URL('../',import.meta.url),digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const sources={},modules={};
for(const name of ['lif','scaling']){
  const path=`brain/core/${name}.ts`,source=fs.readFileSync(new URL(path,root),'utf8');
  sources[path]=digest(source);
  let js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  for(const [dep,url] of Object.entries(modules))js=js.replaceAll(`'./${dep}'`,JSON.stringify(url));
  modules[name]='data:text/javascript;base64,'+Buffer.from(js).toString('base64');
}
sources['scripts/neural_scaling.mjs']=digest(fs.readFileSync(new URL(import.meta.url)));
const {SparseLif,LIF_V1}=await import(modules.lif);
const {
  SCALING_FRACTIONS,SCALING_REPLICA_COUNTS,SCALING_WORKLOADS,inducedPrefix,scalingNodeCounts,
  driveInput,lifStateBytes,graphBytes,sharedGraphReplicaBytes,independentCopyBytes,
}=await import(modules.scaling);

const base=new URL('data/generated/',root);
if(!fs.existsSync(new URL('manifest.json',base))){console.log('SKIP neural scaling: generated graph absent');process.exit(0);}
const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',base)));
const hashes={};
function checked(info){const bytes=fs.readFileSync(new URL(info.file,base));assert.equal(digest(bytes),info.sha256);hashes[info.file]=info.sha256;return bytes;}
function array(name){const info=manifest.arrays[name],b=checked(info);assert.equal(b.length,info.bytes);assert.equal(info.dtype,'<u4');return new Uint32Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.length));}
const full={offsets:array('row_offsets'),targets:array('target_indices'),weights:array('weights')};
checked(manifest.arrays.neuron_ids);
assert.equal(full.offsets.length-1,manifest.retained_neurons);
assert.equal(full.targets.length,manifest.arrays.weights.length);

const WARMUP=8,MEASURE=40,NODE_COUNTS=scalingNodeCounts(manifest.retained_neurons);
assert.deepEqual(NODE_COUNTS,[...SCALING_FRACTIONS].map(f=>Math.max(1,Math.floor(manifest.retained_neurons*f))));
assert.equal(NODE_COUNTS.at(-1),manifest.retained_neurons);

function measureLif(graph,stride){
  const signs=new Int8Array(graph.offsets.length-1).fill(1);
  const model=new SparseLif(graph,signs,{...LIF_V1});
  const input=driveInput(model.nodes,stride,LIF_V1.threshold);
  const visit=(fired)=>{let e=0;for(const i of fired)e+=graph.offsets[i+1]-graph.offsets[i];return e;};
  function run(ticks){
    model.reset();let hash=2166136261,spikes=0,edgeVisits=0;
    const start=performance.now();
    for(let t=0;t<ticks;t++){
      const fired=model.step(input);spikes+=fired.length;edgeVisits+=visit(fired);
      hash=Math.imul(hash^t,16777619)>>>0;
      for(const i of fired)hash=Math.imul(hash^i,16777619)>>>0;
    }
    return {milliseconds:performance.now()-start,spikes,edgeVisits,hash};
  }
  run(WARMUP);
  const measured=run(MEASURE),replay=run(MEASURE);
  assert.equal(measured.hash,replay.hash);
  assert.equal(measured.spikes,replay.spikes);
  return {
    spikes:measured.spikes,edgeVisits:measured.edgeVisits,hash:measured.hash,
    milliseconds:measured.milliseconds,millisecondsPerTick:measured.milliseconds/MEASURE,
  };
}

const scaleRows=[];
for(const nodes of NODE_COUNTS){
  const graph=inducedPrefix(full,nodes);
  const workloads={};
  for(const w of SCALING_WORKLOADS){
    const row=measureLif(graph,w.stride);
    workloads[w.name]={spikes:row.spikes,edgeVisits:row.edgeVisits,hash:row.hash,
      milliseconds:row.milliseconds,millisecondsPerTick:row.millisecondsPerTick};
    console.log(`LIF nodes=${nodes} ${w.name}: ${row.millisecondsPerTick.toFixed(3)} ms/tick hash=${row.hash}`);
  }
  scaleRows.push({
    nodes,edges:graph.targets.length,fraction:nodes/manifest.retained_neurons,
    graphBytes:graphBytes(graph),stateBytes:lifStateBytes(nodes),workloads,
  });
}

const replicaGraph=inducedPrefix(full,NODE_COUNTS[NODE_COUNTS.length-2]);
const replicaRows=[];
for(const replicas of SCALING_REPLICA_COUNTS){
  const signs=new Int8Array(replicaGraph.offsets.length-1).fill(1);
  const models=Array.from({length:replicas},()=>new SparseLif(replicaGraph,signs,{...LIF_V1}));
  const input=driveInput(replicaGraph.offsets.length-1,100,LIF_V1.threshold);
  function run(ticks){
    for(const m of models)m.reset();
    let hash=2166136261,spikes=0;
    const start=performance.now();
    for(let t=0;t<ticks;t++)for(let r=0;r<replicas;r++){
      const fired=models[r].step(input);spikes+=fired.length;
      hash=Math.imul(hash^((t<<8)|r),16777619)>>>0;
      for(const i of fired)hash=Math.imul(hash^i,16777619)>>>0;
    }
    return {milliseconds:performance.now()-start,spikes,hash};
  }
  run(WARMUP);
  const measured=run(MEASURE),replay=run(MEASURE);
  assert.equal(measured.hash,replay.hash);
  replicaRows.push({
    replicas,nodes:replicaGraph.offsets.length-1,edges:replicaGraph.targets.length,
    spikes:measured.spikes,hash:measured.hash,
    milliseconds:measured.milliseconds,
    millisecondsPerReplicaTick:measured.milliseconds/(MEASURE*replicas),
    millisecondsWallPerTick:measured.milliseconds/MEASURE,
    sharedGraphBytes:sharedGraphReplicaBytes(replicaGraph,replicas),
    independentCopyBytes:independentCopyBytes(replicaGraph,replicas),
  });
  console.log(`Replicas=${replicas}: wall ${replicaRows.at(-1).millisecondsWallPerTick.toFixed(3)} ms/tick`);
}

let rateRow=null;
const wasmJs=new URL('web/public/wasm/neural.js',root),wasmBin=new URL('web/public/wasm/neural.wasm',root);
if(fs.existsSync(wasmJs)&&fs.existsSync(wasmBin)){
  const {build}=await import('../web/node_modules/esbuild/lib/main.js');
  const bundle=await build({stdin:{contents:`export {WasmRateModel} from './web/src/brain/rate_model';`,resolveDir:root.pathname},
    bundle:true,write:false,format:'esm',platform:'node',define:{'import.meta.env.BASE_URL':'"/"'}});
  const api=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  const create=(await import(wasmJs)).default;
  const model=new api.WasmRateModel(await create({wasmBinary:fs.readFileSync(wasmBin)}),full);
  const input=new Uint32Array(model.count);for(let i=0;i<input.length;i+=100)input[i]=1000;
  function run(ticks){model.reset();const start=performance.now();let last=0;
    for(let t=0;t<ticks;t++){const v=model.step(input);last=v[0];}return {milliseconds:performance.now()-start,probe:last};}
  run(WARMUP);const measured=run(MEASURE),replay=run(MEASURE);
  assert.equal(measured.probe,replay.probe);
  rateRow={model:'wasm-rate-v2',nodes:model.count,edges:full.targets.length,driveStride:100,driveAmplitude:1000,
    milliseconds:measured.milliseconds,millisecondsPerTick:measured.milliseconds/MEASURE,probe:measured.probe};
  console.log(`Rate WASM full sparse drive: ${rateRow.millisecondsPerTick.toFixed(3)} ms/tick`);
}

const recommendation={
  decision:'Do not add shared-graph batches, worker threads, SIMD or GPU yet for the shipped single-match browser path.',
  reasons:[
    'Full-graph LIF and WASM rate timings remain the dominant cost versus the scalar GameBatch fighter core.',
    'Sequential independent SparseLif replicas on a shared induced CSR scale wall time roughly with replica count; graph sharing alone does not reduce CPU work.',
    'Independent full-graph CSR copies would multiply the ~200 MiB connectivity arrays; shared-graph batches are only motivated for multi-environment research/training, not the one Fly controller in the player build.',
    'A single realtime match does not justify SharedArrayBuffer, cross-origin isolation, Metal or WebGPU complexity on this evidence.',
  ],
  limits:[
    'Induced node-prefix subgraphs are engineering slices, not biologically meaningful modules.',
    'All-positive signs and index-strided drive are MODEL_ASSUMPTION stress policies.',
    'Wall-clock timings are single-host descriptive measurements, not performance gates or cross-device promises.',
  ],
};

const deterministic={
  format:'NEURAL_SCALING_V1',
  label:'MODEL_ASSUMPTION',
  graphIdentity:manifest.arrays.neuron_ids.sha256,
  sourceHashes:sources,
  inputHashes:hashes,
  protocol:{
    fractions:[...SCALING_FRACTIONS],
    replicaCounts:[...SCALING_REPLICA_COUNTS],
    workloads:[...SCALING_WORKLOADS],
    warmupTicks:WARMUP,
    measureTicks:MEASURE,
    subgraph:'Induced CSR prefix: first N nodes and edges with target < N',
    replicaMode:'Independent SparseLif state arrays sharing one induced CSR; stepped sequentially',
  },
  scales:scaleRows.map(r=>({
    nodes:r.nodes,edges:r.edges,fraction:r.fraction,graphBytes:r.graphBytes,stateBytes:r.stateBytes,
    workloads:Object.fromEntries(Object.entries(r.workloads).map(([k,v])=>[k,{spikes:v.spikes,edgeVisits:v.edgeVisits,hash:v.hash}])),
  })),
  replicas:replicaRows.map(r=>({
    replicas:r.replicas,nodes:r.nodes,edges:r.edges,spikes:r.spikes,hash:r.hash,
    sharedGraphBytes:r.sharedGraphBytes,independentCopyBytes:r.independentCopyBytes,
  })),
  rateProbe:rateRow?{model:rateRow.model,nodes:rateRow.nodes,edges:rateRow.edges,driveStride:rateRow.driveStride,driveAmplitude:rateRow.driveAmplitude,probe:rateRow.probe}:null,
  recommendation,
};

const timings={
  host:{platform:os.platform(),arch:os.arch(),cpus:os.cpus()[0]?.model??null,node:process.version},
  processMemory:process.memoryUsage(),
  memoryNote:'Post-run process snapshot including TS transpile and graph buffers; not peak RSS or browser heap.',
  scales:scaleRows.map(r=>({nodes:r.nodes,workloads:Object.fromEntries(Object.entries(r.workloads).map(([k,v])=>[k,{milliseconds:v.milliseconds,millisecondsPerTick:v.millisecondsPerTick}]))})),
  replicas:replicaRows.map(r=>({replicas:r.replicas,milliseconds:r.milliseconds,millisecondsPerReplicaTick:r.millisecondsPerReplicaTick,millisecondsWallPerTick:r.millisecondsWallPerTick})),
  rate:rateRow?{milliseconds:rateRow.milliseconds,millisecondsPerTick:rateRow.millisecondsPerTick}:null,
};

const report={...deterministic,timings};
const output=new URL('data/neural-scaling.json',root);
if(process.argv.includes('--check')){
  const prior=JSON.parse(fs.readFileSync(output,'utf8'));
  const {timings:_ignored,...priorDet}=prior;
  assert.deepEqual(deterministic,priorDet,'Deterministic neural scaling evidence changed');
  console.log('PASS: neural scaling deterministic section matches retained JSON');
}else{
  fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log(`PASS: neural scaling retained (${scaleRows.length} scales, ${replicaRows.length} replica rows)`);
}
