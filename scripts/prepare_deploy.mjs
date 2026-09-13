// Sites accepts a root dist directory; preserve the existing web build layout.
import fs from 'node:fs';import crypto from 'node:crypto';
const root=new URL('../',import.meta.url),source=new URL('web/dist/',root),target=new URL('dist/',root);
for(const name of ['index.html','wasm/sim.wasm','wasm/neural.wasm','wasm/neural.js','neural/readout.json','connectome/manifest.json','connectome-graph/catalog.json'])if(!fs.existsSync(new URL(name,source)))throw Error('Build missing '+name);
fs.rmSync(target,{recursive:true,force:true});fs.cpSync(source,target,{recursive:true});
let files=0;function verify(dir,prefix=''){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
 const relative=prefix+entry.name;if(entry.isDirectory())verify(new URL(entry.name+'/',dir),relative+'/');
 else{if(!entry.isFile())throw Error('Non-regular asset');const hash=url=>crypto.createHash('sha256').update(fs.readFileSync(url)).digest('hex');
 if(hash(new URL(relative,source))!==hash(new URL(relative,target)))throw Error('Staging mismatch: '+relative);files++;}
}}
verify(source);console.log(`Prepared ${files} byte-identical static assets in dist/`);
