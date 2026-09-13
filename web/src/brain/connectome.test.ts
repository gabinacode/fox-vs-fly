import {it,expect} from 'vitest';
import {ANNOTATIONS,GRAPH_LIMITS,loadGraph,readBounded,sha256,validateCatalog,validateManifest,type GraphCatalog,type GraphManifest} from './connectome';
async function fixture(targetValues=[1,2,2,0]){
 const buffers:Record<string,ArrayBuffer>={neuron_ids:new BigUint64Array([9007199254740993n,9007199254740994n,9007199254740995n]).buffer,
  row_offsets:new Uint32Array([0,2,3,4]).buffer,target_indices:new Uint32Array(targetValues).buffer,weights:new Uint32Array([1,2,3,4]).buffer};
 for(const name of ANNOTATIONS)buffers['annotation_'+name]=new Uint32Array([1,0,1]).buffer;
 const files=new Map<string,Uint8Array<ArrayBuffer>>(),arrays:any={};
 for(const [name,buffer] of Object.entries(buffers)){
  const raw=new Uint8Array(buffer),chunks=[];
  for(let offset=0;offset<raw.length;offset+=16){const part=raw.slice(offset,offset+16),compressed=new Uint8Array(await new Response(new Blob([part.buffer]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
   const sha=await sha256(compressed),file=`chunk-${sha}.bin`;files.set(file,compressed);
   chunks.push({file,offset,raw_bytes:part.length,bytes:compressed.length,sha256:sha,raw_sha256:await sha256(part)});}
  arrays[name]={dtype:name==='neuron_ids'?'<u8':'<u4',length:buffer.byteLength/(name==='neuron_ids'?8:4),bytes:buffer.byteLength,sha256:await sha256(raw),chunks};
 }
 const manifest:GraphManifest={format:'MALECNS_GRAPH_V1',release:'male-cns:v1.0',nodes:3,edges:4,synaptic_contacts:10,graph_identity:arrays.neuron_ids.sha256,arrays,dictionaries:Object.fromEntries(ANNOTATIONS.map(n=>[n,[null,'fixture']]))};
 const rawManifest=new TextEncoder().encode(JSON.stringify(manifest));files.set('graph-test.json',rawManifest);
 const catalog:GraphCatalog={format:'MALECNS_GRAPH_CATALOG_V1',release:manifest.release,nodes:3,edges:4,graph_identity:manifest.graph_identity,
  download_bytes:rawManifest.length+Object.values(arrays).reduce((sum:number,a:any)=>sum+a.chunks.reduce((n:number,c:any)=>n+c.bytes,0),0),
  array_bytes:Object.values(buffers).reduce((n,b)=>n+b.byteLength,0),manifest:{file:'graph-test.json',bytes:rawManifest.length,sha256:await sha256(rawManifest)}};
 const fetcher=(async(url:URL|RequestInfo)=>{const data=files.get(new URL(String(url)).pathname.split('/').at(-1)!);return data?new Response(data):new Response(null,{status:404});}) as typeof fetch;
 return {catalog,manifest,files,fetcher};
}
it('loads exact uint64 IDs, sparse edges and annotations from multiple verified gzip chunks',async()=>{
 const f=await fixture(),updates:number[]=[];
 const {graph,metrics}=await loadGraph(f.catalog,new URL('https://example.test/'),p=>updates.push(p.received),new AbortController().signal,f.fetcher);
 expect(graph.ids[0]).toBe(9007199254740993n);expect([...graph.offsets]).toEqual([0,2,3,4]);expect([...graph.targets]).toEqual([1,2,2,0]);
 expect([...graph.weights]).toEqual([1,2,3,4]);expect(graph.dictionaries.consensus_nt).toEqual([null,'fixture']);expect(metrics.synapticContacts).toBe(10);
 expect(metrics.arrayBytes).toBe(f.catalog.array_bytes);expect(metrics.downloadedBytes).toBe(f.catalog.download_bytes);expect(updates).toEqual([...updates].sort((a,b)=>a-b));
});
it('rejects download/memory budgets, path traversal, missing chunks and inconsistent identity',async()=>{
 const f=await fixture();expect(()=>validateCatalog({...f.catalog,array_bytes:GRAPH_LIMITS.arrayBytes+1})).toThrow('memory');
 expect(()=>validateCatalog({...f.catalog,download_bytes:GRAPH_LIMITS.downloadBytes+1})).toThrow('download');
 expect(()=>validateCatalog({...f.catalog,manifest:{...f.catalog.manifest,file:'../graph.json'}})).toThrow();
 const m=structuredClone(f.manifest);m.arrays.weights.chunks.pop();expect(()=>validateManifest(m,f.catalog)).toThrow();
 expect(()=>validateManifest({...f.manifest,graph_identity:'a'.repeat(64)},f.catalog)).toThrow();
});
it('rejects same-size transport corruption and valid-hash malformed CSR',async()=>{
 const f=await fixture();const chunk=f.manifest.arrays.weights.chunks[0];f.files.get(chunk.file)![0]^=1;
 await expect(loadGraph(f.catalog,new URL('https://example.test/'),()=>{},new AbortController().signal,f.fetcher)).rejects.toThrow('checksum');
 const bad=await fixture([1,1,2,0]);await expect(loadGraph(bad.catalog,new URL('https://example.test/'),()=>{},new AbortController().signal,bad.fetcher)).rejects.toThrow('CSR');
});
it('rejects stream truncation/excess output and aborts without returning a graph',async()=>{
 const signal=new AbortController().signal;
 await expect(readBounded(new Response(new Uint8Array(5)).body,4,signal)).rejects.toThrow('exceeds');
 await expect(readBounded(new Response(new Uint8Array(3)).body,4,signal)).rejects.toThrow('Truncated');
 const f=await fixture(),controller=new AbortController();controller.abort();
 await expect(loadGraph(f.catalog,new URL('https://example.test/'),()=>{},controller.signal,f.fetcher)).rejects.toThrow();
});
