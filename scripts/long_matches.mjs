import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
import os from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';
import {graph,api,makeModel,makeSimulation,identity} from './neural_runtime.mjs';
import {opponents,opponentInput,MatchMetrics} from './match_evaluation.mjs';
const root=new URL('../',import.meta.url),check=process.argv.includes('--check'),arg=name=>{const i=process.argv.indexOf(name);assert(i<0||process.argv[i+1],`${name} requires a repository-relative path`);return i<0?null:process.argv[i+1];};
const reportPath=new URL(arg('--output')??'data/long-matches.json',root),baselineArg=arg('--baseline');
const calibrationBytes=fs.readFileSync(new URL('web/public/neural/readout.json',root)),calibration=JSON.parse(calibrationBytes);assert.equal(calibration.graph_identity,identity);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const provenance={graphIdentity:identity,calibrationSha256:sha(calibrationBytes),neuralWasmSha256:sha(fs.readFileSync(new URL('web/public/wasm/neural.wasm',root))),simulationWasmSha256:sha(fs.readFileSync(new URL('web/public/wasm/sim.wasm',root))),controllerSha256:sha(Buffer.concat(['brain/core/male_cns.ts','brain/core/neural_sensory.ts','brain/core/rate_mapping.ts'].map(file=>fs.readFileSync(new URL(file,root))))),opponentsSha256:sha(fs.readFileSync(new URL('scripts/match_evaluation.mjs',root)))};
const sim=await makeSimulation(),brain=new api.MaleCNSBrain(graph,await makeModel(),calibration);let generation=0;
function run(opponent,seed,limit){
 sim.reset();const epoch=generation++,metrics=new MatchMetrics(),hash=crypto.createHash('sha256'),hashes=[],inputs=[];let prefix=null;
 for(let tick=0;tick<limit;tick++){
  const before=sim.snapshot();if(before.winner!==-1)break;
  const frame=brain.step(before,epoch);assert(frame.motor_values.every(x=>Number.isFinite(x)&&x>=0&&x<=1));assert(frame.active_neuron_count>=0&&frame.active_neuron_count<=166700);
  const fly=api.motorDecode(frame.motor_values),fox=opponentInput(opponent,before,seed);assert(Number.isInteger(fly.axis)&&Math.abs(fly.axis)<=1000&&(fly.buttons&~7)===0);
  sim.step(fox,fly);const after=sim.snapshot();assert.equal(after.tick,tick+1);assert([after.fox,after.fly].every(f=>Object.values(f).every(Number.isFinite)));
  hash.update(frame.activity);hash.update(new Uint8Array(frame.motor_values.buffer));hash.update(`${fox.axis},${fox.buttons},${after.hash};`);
  hashes.push(after.hash);inputs.push(`${fox.axis} ${fox.buttons} ${fly.axis} ${fly.buttons}`);metrics.observe(before,after,frame,fly);
  if(after.tick===600)prefix={frames:600,traceSha256:hash.copy().digest('hex'),gameHash:after.hash};
 }
 const final=sim.snapshot(),result={opponent,phaseSeed:seed,frameLimit:limit,...metrics.result(),simulatedSeconds:final.tick/60,outcome:final.winner===-1?'timeout':final.winner===1?'fly_win':final.winner===0?'fly_loss':'draw',finalStocks:{fox:final.fox.stocks,fly:final.fly.stocks},finalDamage:{fox:final.fox.damage,fly:final.fly.damage},finalGameHash:final.hash,traceSha256:hash.digest('hex'),prefix600:prefix};
 assert.equal(result.stockLosses.fly,3-final.fly.stocks);assert.equal(result.stockLosses.fox,3-final.fox.stocks);
 assert.equal(result.recovery.started,result.recovery.landed+result.recovery.stockLost+result.recovery.open);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'long-match-'));
 try{const file=path.join(dir,'inputs.txt');fs.writeFileSync(file,`42 ${inputs.length}\n${inputs.join('\n')}\n`);const native=execFileSync(new URL('build/sim_replay',root).pathname,[file],{encoding:'utf8'}).trim().split('\n').map(Number);assert.deepEqual(native,hashes);}finally{fs.rmSync(dir,{recursive:true,force:true});}
 return result;
}
if(check){
 const saved=JSON.parse(fs.readFileSync(reportPath));assert.deepEqual(provenance,saved.provenance,'Recorded evidence inputs changed; rerun the complete assay');
 assert.equal(saved.matches.length,opponents.length*2);
 if(baselineArg){
  const baseline=JSON.parse(fs.readFileSync(new URL(baselineArg,root))),find=(report,opponent,seed)=>report.matches.find(r=>r.opponent===opponent&&r.phaseSeed===seed);
  for(const opponent of ['rushdown','shuttle'])for(const seed of [7,29]){const before=find(baseline,opponent,seed),after=find(saved,opponent,seed);assert(before&&after);assert.notEqual(before.outcome,'fly_win');assert.equal(after.outcome,'fly_win');assert(after.finalStocks.fly>=before.finalStocks.fly);assert(after.observedDamage.fox>before.observedDamage.fox);if(opponent==='shuttle')assert(after.frames<before.frames);}
  for(const opponent of ['stationary','jump_crossup','edge_bait'])for(const seed of [7,29]){const before=find(baseline,opponent,seed),after=find(saved,opponent,seed);assert(before&&after);assert.equal(after.outcome,before.outcome);assert(after.finalStocks.fly>=before.finalStocks.fly);assert(after.observedDamage.fox>=before.observedDamage.fox);}
 }
 for(const opponent of opponents){
  const expected=saved.matches.find(r=>r.opponent===opponent&&r.phaseSeed===7);assert(expected);
  const full=opponent==='rushdown'||opponent==='shuttle',r=run(opponent,7,full?expected.frameLimit:600);
  if(full){assert.deepEqual(r,expected);console.log(`Verified complete ${opponent}: ${r.frames} frames, outcome, metrics, trace and native/WASM agree`);}
  else{const p=expected.prefix600??{frames:expected.frames,traceSha256:expected.traceSha256,gameHash:expected.finalGameHash};assert.equal(r.frames,p.frames);assert.equal(r.traceSha256,p.traceSha256);assert.equal(r.finalGameHash,p.gameHash);console.log(`Verified ${opponent} prefix: ${r.frames} frames, trace and native/WASM agree`);}
 }
}else{
 const matches=[];
 for(const opponent of opponents)for(const seed of [7,29]){const r=run(opponent,seed,opponent==='shuttle'?7200:3600);matches.push(r);console.log(JSON.stringify({opponent,seed,frames:r.frames,outcome:r.outcome,stocks:r.finalStocks,damage:r.observedDamage,recovery:r.recovery}));}
 const chosen=matches.find(r=>r.opponent==='rushdown'&&r.phaseSeed===7),repeated=run(chosen.opponent,chosen.phaseSeed,chosen.frameLimit);assert.deepEqual(repeated,chosen,'Full match reset replay must agree');
 const report={schema:2,controller:'V2 authored stable rate model over measured MaleCNS wiring',provenance,protocol:{gameHz:60,modelHz:30,maxCombatFrames:3600,maxShuttleFrames:7200,seeds:[7,29],seedMeaning:'Opponent pulse/waypoint phase only; simulation initial state always seed 42, Fox left/Fly right',damageMeaning:'Sum of observed positive post-step damage changes; a hit followed by stock reset in the same step can be omitted',recoveryMeaning:'Fly airborne outside x +/-68 or below y=0; closes on stage landing or stock loss; does not establish recoverability',limitations:'Scripted policies, one stage and spawn orientation; timeouts retained, no human win-rate or biological claim',trace:'SHA-256 over every full packed activity array, motor values, opponent input and game hash'},matches,resetReplay:{opponent:chosen.opponent,phaseSeed:chosen.phaseSeed,frames:chosen.frames,identical:true},nativeWasmReplay:'Every frame of every bout and repeated bout matches'};
 fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');console.log(`Saved ${matches.length} bouts with full native replay and one full neural reset replay`);
}
