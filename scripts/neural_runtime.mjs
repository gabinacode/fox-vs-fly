// Real graph + game closed loop, followed by reset and native replay of exact inputs.
import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';import os from 'node:os';import path from 'node:path';
import {build} from '../web/node_modules/esbuild/lib/main.js';
const root=new URL('../',import.meta.url),base=new URL('data/generated/',root);
if(!fs.existsSync(new URL('manifest.json',base))){console.log('SKIP real neural replay: generated graph absent');process.exit(0);}
const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',base),'utf8'));
const checked=(info)=>{const b=fs.readFileSync(new URL(info.file,base));assert.equal(crypto.createHash('sha256').update(b).digest('hex'),info.sha256);return b;};
export const array=(name,Type=Uint32Array)=>{const info=manifest.arrays[name],b=checked(info);assert.equal(b.length,info.bytes);return new Type(b.buffer.slice(b.byteOffset,b.byteOffset+b.length));};
const dictionaries=JSON.parse(checked(manifest.annotations));
const graph={offsets:array('row_offsets'),targets:array('target_indices'),weights:array('weights'),annotations:Object.fromEntries(['superclass','somaSide'].map(n=>[n,array('annotation_'+n)])),dictionaries};

export {graph};
const bundle=await build({stdin:{contents:`export {MaleCNSBrain} from './brain/core/male_cns';export {MaleCNSBrain as LegacyLifBrain} from './brain/core/male_cns_lif';export {motorDecode} from './brain/core/motor';export {rateMapping} from './brain/core/rate_mapping';export {WasmRateModel} from './web/src/brain/rate_model';export {Simulation} from './web/src/wasm/sim';`,resolveDir:root.pathname},bundle:true,write:false,format:'esm',platform:'node',define:{'import.meta.env.BASE_URL':'"/"'}});
export const api=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
export const identity=manifest.arrays.neuron_ids.sha256;
export async function makeModel(){const create=(await import(new URL('web/public/wasm/neural.js',root))).default;return new api.WasmRateModel(await create({wasmBinary:fs.readFileSync(new URL('web/public/wasm/neural.wasm',root))}),graph);}
export async function makeSimulation(){const create=(await import(new URL('web/public/wasm/sim.js',root))).default;return new api.Simulation(await create({wasmBinary:fs.readFileSync(new URL('web/public/wasm/sim.wasm',root))}));}
