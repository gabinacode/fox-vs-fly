// Real graph + game closed loop, followed by reset and native replay of exact inputs.
import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';import os from 'node:os';import path from 'node:path';
import {build} from '../web/node_modules/esbuild/lib/main.js';
const root=new URL('../',import.meta.url),base=new URL('data/generated/',root);
if(!fs.existsSync(new URL('manifest.json',base))){console.log('SKIP real neural replay: generated graph absent');process.exit(0);}
const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',base),'utf8'));
const checked=(info)=>{const b=fs.readFileSync(new URL(info.file,base));assert.equal(crypto.createHash('sha256').update(b).digest('hex'),info.sha256);return b;};
const array=name=>{const info=manifest.arrays[name],b=checked(info);assert.equal(b.length,info.bytes);return new Uint32Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.length));};
const dictionaries=JSON.parse(checked(manifest.annotations));
const graph={offsets:array('row_offsets'),targets:array('target_indices'),weights:array('weights'),annotations:Object.fromEntries(['superclass','somaSide'].map(n=>[n,array('annotation_'+n)])),dictionaries};
const bundle=await build({stdin:{contents:`export {MaleCNSBrain} from './brain/core/male_cns';export {motorDecode} from './brain/core/motor';export {Simulation} from './web/src/wasm/sim';`,resolveDir:root.pathname},bundle:true,write:false,format:'esm',platform:'node',define:{'import.meta.env.BASE_URL':'"/"'}});
const {MaleCNSBrain,motorDecode,Simulation}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const create=(await import(new URL('web/public/wasm/sim.js',root))).default;
const sim=new Simulation(await create({wasmBinary:fs.readFileSync(new URL('web/public/wasm/sim.wasm',root))})),brain=new MaleCNSBrain(graph);
function run(generation){sim.reset();const hashes=[],inputs=[],spikeHash=crypto.createHash('sha256');let spikes=0,nonzero=0;const start=performance.now();
 for(let tick=0;tick<600;tick++){
  const o=sim.snapshot();if(o.winner!==-1)break;
  const frame=brain.step(o,generation);if(tick%17===0)assert.equal(brain.step(o,generation),frame);
  spikeHash.update(frame.activity);spikeHash.update(new Uint8Array(frame.motor_values.buffer));spikes+=frame.active_neuron_count;
  const fly=motorDecode(frame.motor_values),fox={axis:tick%180<90?500:-500,buttons:tick%30===0?4:0};if(fly.axis||fly.buttons)nonzero++;
  sim.step(fox,fly);inputs.push([fox.axis,fox.buttons,fly.axis,fly.buttons].join(' '));hashes.push(sim.snapshot().hash);
 }
 return {hashes,inputs,spikeHash:spikeHash.digest('hex'),spikes,nonzero,milliseconds:performance.now()-start};
}
const measured=run(0),replay=run(1);assert.deepEqual(replay.hashes,measured.hashes);assert.deepEqual(replay.inputs,measured.inputs);assert.equal(replay.spikeHash,measured.spikeHash);assert(measured.spikes>0);assert(measured.nonzero>0);
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'neural-replay-'));
try{const fixture=path.join(temporary,'neural.inputs');fs.writeFileSync(fixture,`42 ${measured.inputs.length}\n${measured.inputs.join('\n')}\n`);
 const native=execFileSync(new URL('build/sim_replay',root).pathname,[fixture],{encoding:'utf8'}).trim().split('\n').map(Number);assert.deepEqual(native,measured.hashes);
}finally{fs.rmSync(temporary,{recursive:true,force:true});}
console.log(JSON.stringify({controller:'MaleCNSBrain authored all-positive LIF',frames:measured.hashes.length,finalGameHash:measured.hashes.at(-1),spikeAndMotorHash:measured.spikeHash,spikes:measured.spikes,framesWithMotorInput:measured.nonzero,millisecondsPerFrame:measured.milliseconds/measured.hashes.length,resetReplay:'identical',nativeWasmReplay:'identical'},null,2));
