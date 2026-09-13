import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';import os from 'node:os';import path from 'node:path';
import {graph,api,makeModel,makeSimulation,identity} from './neural_runtime.mjs';
const root=new URL('../',import.meta.url),calibration=JSON.parse(fs.readFileSync(new URL('web/public/neural/readout.json',root)));
assert.equal(calibration.graph_identity,identity);
const sim=await makeSimulation(),brain=new api.MaleCNSBrain(graph,await makeModel(),calibration),motorDecode=api.motorDecode;
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
console.log(JSON.stringify({controller:'MaleCNSBrain calibrated stable rate model',frames:measured.hashes.length,finalGameHash:measured.hashes.at(-1),activityAndMotorHash:measured.spikeHash,activeNodeSamples:measured.spikes,framesWithMotorInput:measured.nonzero,millisecondsPerFrame:measured.milliseconds/measured.hashes.length,resetReplay:'identical',nativeWasmReplay:'identical'},null,2));
