// Headless benchmark of the browser-compatible core; no runtime dependency added.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import ts from '../web/node_modules/typescript/lib/typescript.js';
const source=fs.readFileSync(new URL('../brain/core/lif.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {SparseLif,LIF_V1}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const base=new URL('../data/generated/',import.meta.url);
if(!fs.existsSync(new URL('manifest.json',base))){console.log('SKIP full LIF benchmark: generated graph absent');process.exit(0);}
const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',base),'utf8'));
function array(name){const info=manifest.arrays[name],bytes=fs.readFileSync(new URL(info.file,base));
 assert.equal(bytes.byteLength,info.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),info.sha256);
 return new Uint32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));}
const graph={offsets:array('row_offsets'),targets:array('target_indices'),weights:array('weights')};
// Artificial all-excitatory stress policy: never infer biology from this workload.
const signs=new Int8Array(manifest.retained_neurons).fill(1),model=new SparseLif(graph,signs,{...LIF_V1});
const input=new Int32Array(model.nodes),reports=[];
for(const [name,stride] of [['silent',0],['sparse artificial drive',100],['dense artificial drive',1]]){
 input.fill(0);if(stride)for(let i=0;i<input.length;i+=stride)input[i]=LIF_V1.threshold;
 function run(){model.reset();let spikes=0,edgeVisits=0,hash=2166136261;const start=performance.now();
  for(let t=0;t<120;t++){const fired=model.step(input);spikes+=fired.length;
   for(const i of fired){edgeVisits+=graph.offsets[i+1]-graph.offsets[i];hash=Math.imul(hash^i,16777619)>>>0;}
   hash=Math.imul(hash^t,16777619)>>>0;
  }
  return {milliseconds:performance.now()-start,spikes,edgeVisits,hash};}
 run();const measured=run(),replay=run();
 assert.equal(measured.hash,replay.hash);assert.equal(measured.spikes,replay.spikes);
 reports.push({name,ticks:120,...measured,millisecondsPerTick:measured.milliseconds/120});
}
console.log(JSON.stringify({model:'integer-lif-v1',assumption:'all excitatory, index-based constant drive; no biological mapping',
 nodes:model.nodes,edges:graph.targets.length,modelStateBytes:model.stateBytes,parameters:model.parameters,
 processMemory:process.memoryUsage(),memoryNote:'post-run process snapshot, not peak; includes graph, benchmark and TS compiler',reports},null,2));
