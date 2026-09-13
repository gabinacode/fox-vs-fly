import {it,expect} from 'vitest';
import {decodeGeometry,mapActivity} from './geometry';
async function fixture(indices=[0,2]){
 const bytes={positions:new Float32Array([-.2,.3,0,.2,-.3,0]).buffer,visual_indices:new Uint32Array(indices).buffer};
 const arrays:any={};for(const [name,buffer] of Object.entries(bytes)){const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),b=>b.toString(16).padStart(2,'0')).join('');arrays[name]={file:name.replace('_','-')+'.bin',sha256,bytes:buffer.byteLength,length:buffer.byteLength/4,dtype:name==='positions'?'<f4':'<u4'};}
 const manifest={format:'MALECNS_GEOMETRY_V1',release:'male-cns:v1.0',retained_neurons:3,positioned_neurons:2,missing_soma_positions:1,edges:4,attribution:'test fixture',arrays};
 const read=async(a:any)=>a.file==='positions.bin'?bytes.positions:bytes.visual_indices;
 return {manifest,read};
}
it('loads verified measured positions and maps full graph activity through visual indices',async()=>{const f=await fixture();const g=await decodeGeometry(f.manifest,f.read);expect(g.provenance).toBe('MALECNS');expect(g.neuron_count).toBe(3);const out=new Uint8Array(2);mapActivity(new Uint8Array([10,255,40]),g,out);expect([...out]).toEqual([10,40]);expect(()=>mapActivity(new Uint8Array(2),g,out)).toThrow();});
it('rejects corruption, missing coverage and out-of-range indices',async()=>{const f=await fixture();await expect(decodeGeometry(f.manifest,async()=>new ArrayBuffer(24))).rejects.toThrow();await expect(decodeGeometry({...f.manifest,missing_soma_positions:0},f.read)).rejects.toThrow();const bad=await fixture([0,3]);await expect(decodeGeometry(bad.manifest,bad.read)).rejects.toThrow('visual mapping');});
it('rejects same-size tampering and manifest path traversal',async()=>{const f=await fixture();await expect(decodeGeometry(f.manifest,async a=>{const b=(await f.read(a)).slice(0);new Uint8Array(b)[0]^=1;return b;})).rejects.toThrow('checksum');f.manifest.arrays.positions.file='../positions.bin';await expect(decodeGeometry(f.manifest,f.read)).rejects.toThrow('asset');});
