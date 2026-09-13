import {readFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {pathToFileURL} from 'node:url';
const root=new URL('../',import.meta.url);const fixture=new URL('sim/tests/fixtures/duel.inputs',root);
const native=execFileSync(new URL('build/sim_replay',root).pathname,[fixture.pathname],{encoding:'utf8'}).trim().split('\n').map(Number);
const input=readFileSync(fixture,'utf8').trim().split(/\s+/).map(Number);const [seed,count]=input;
const create=(await import(pathToFileURL(new URL('web/public/wasm/sim.js',root).pathname).href)).default;
const sim=await create({wasmBinary:readFileSync(new URL('web/public/wasm/sim.wasm',root))});sim._sim_reset(seed);
for(let i=0;i<count;i++){sim._sim_step(...input.slice(2+i*4,6+i*4));const hash=sim._sim_hash()>>>0;if(hash!==native[i])throw Error(`Native/WASM divergence frame ${i}: ${hash} != ${native[i]}`);}
console.log(`Native/WASM replay: ${count} per-frame hashes match; final=${native.at(-1)}`);
