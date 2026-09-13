/** Lossless graph loading. No neural dynamics or controller policy lives here. */
export const GRAPH_LIMITS = { arrayBytes: 256 * 1024 ** 2, downloadBytes: 128 * 1024 ** 2,
  chunkBytes: 1024 ** 2, compressedChunkBytes: 2 * 1024 ** 2, manifestBytes: 1024 ** 2 };
export const ANNOTATIONS = ['consensus_nt','predicted_nt','ground_truth','superclass','type','somaSide'] as const;
const CORE = ['neuron_ids','row_offsets','target_indices','weights'] as const;
const ARRAY_NAMES = [...CORE, ...ANNOTATIONS.map(n => `annotation_${n}`)];
interface FileInfo { file:string; bytes:number; sha256:string; }
export interface GraphCatalog { format:'MALECNS_GRAPH_CATALOG_V1'; release:string; nodes:number; edges:number;
  graph_identity:string; download_bytes:number; array_bytes:number; manifest:FileInfo; }
export interface GraphChunk extends FileInfo { offset:number; raw_bytes:number; raw_sha256:string; }
interface GraphArray { dtype:string; length:number; bytes:number; sha256:string; chunks:GraphChunk[]; }
export interface GraphManifest { format:'MALECNS_GRAPH_V1'; release:string; nodes:number; edges:number;
  synaptic_contacts:number; graph_identity:string; arrays:Record<string,GraphArray>;
  dictionaries:Record<string,(string|null)[]>; }
export interface LoadedGraph { ids:BigUint64Array; offsets:Uint32Array; targets:Uint32Array; weights:Uint32Array;
  annotations:Record<string,Uint32Array>; dictionaries:GraphManifest['dictionaries']; manifest:GraphManifest; }
export interface GraphMetrics { nodes:number; edges:number; synapticContacts:number; arrayBytes:number;
  downloadedBytes:number; maxStagingBytes:number; elapsedMs:number; validationMs:number; firstNeuronId:string; }
export interface GraphProgress { phase:'loading'|'validating'; received:number; total:number; }
const integer = (n:unknown):n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
const hash = (s:unknown):s is string => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
const file = (s:unknown,extension:string) => typeof s === 'string' && new RegExp(`^[a-z0-9-]+\\.${extension}$`).test(s);
function check(condition:unknown,message:string):asserts condition { if(!condition) throw Error(message); }
export function validateCatalog(value:unknown):GraphCatalog {
  check(value && typeof value === 'object','Invalid graph catalog');
  const c = value as GraphCatalog;
  check(c.format==='MALECNS_GRAPH_CATALOG_V1' && c.release==='male-cns:v1.0','Unsupported graph release');
  check(integer(c.nodes) && c.nodes>0 && c.nodes<=1000000 && integer(c.edges) && c.edges<=32000000,'Invalid graph counts');
  check(hash(c.graph_identity),'Invalid graph identity');
  check(integer(c.array_bytes) && c.array_bytes<=GRAPH_LIMITS.arrayBytes && c.array_bytes>0,'Graph exceeds array memory budget');
  check(integer(c.download_bytes) && c.download_bytes<=GRAPH_LIMITS.downloadBytes,'Graph exceeds download budget');
  check(c.manifest && file(c.manifest.file,'json') && hash(c.manifest.sha256) && integer(c.manifest.bytes)
    && c.manifest.bytes>0 && c.manifest.bytes<=GRAPH_LIMITS.manifestBytes,'Invalid graph manifest asset');
  return c;
}
export function validateManifest(value:unknown,c:GraphCatalog):GraphManifest {
  check(value && typeof value==='object','Invalid graph manifest');
  const m=value as GraphManifest;
  check(m.format==='MALECNS_GRAPH_V1' && m.release===c.release && m.nodes===c.nodes && m.edges===c.edges
    && m.graph_identity===c.graph_identity && integer(m.synaptic_contacts),'Graph/catalog mismatch');
  check(m.arrays && Object.keys(m.arrays).sort().join() === [...ARRAY_NAMES].sort().join(),'Unexpected graph arrays');
  check(m.dictionaries && Object.keys(m.dictionaries).sort().join() === [...ANNOTATIONS].sort().join(),'Invalid annotation dictionaries');
  let rawTotal=0,downloadTotal=c.manifest.bytes;
  for(const name of ARRAY_NAMES){
    const a=m.arrays[name],width=name==='neuron_ids'?8:4;
    const length=name==='weights'||name==='target_indices'?m.edges:m.nodes+(name==='row_offsets'?1:0);
    check(a && a.dtype===(width===8?'<u8':'<u4') && a.length===length && a.bytes===length*width && hash(a.sha256),'Graph array layout mismatch');
    check(Array.isArray(a.chunks) && a.chunks.length<=Math.ceil(a.bytes/4),'Invalid graph chunks');
    let offset=0;
    for(const part of a.chunks){
      check(file(part.file,'bin') && hash(part.sha256) && hash(part.raw_sha256),'Invalid graph chunk asset');
      check(part.offset===offset && integer(part.raw_bytes) && part.raw_bytes>0 && part.raw_bytes<=GRAPH_LIMITS.chunkBytes
        && part.raw_bytes%width===0 && integer(part.bytes) && part.bytes>0 && part.bytes<=GRAPH_LIMITS.compressedChunkBytes,'Invalid graph chunk bounds');
      offset+=part.raw_bytes;downloadTotal+=part.bytes;
    }
    check(offset===a.bytes,'Incomplete graph array');rawTotal+=a.bytes;
  }
  check(rawTotal===c.array_bytes && downloadTotal===c.download_bytes,'Graph byte totals mismatch');
  check(m.arrays.neuron_ids.sha256===m.graph_identity,'Graph ID identity mismatch');
  for(const name of ANNOTATIONS){const d=m.dictionaries[name];check(Array.isArray(d)&&d.length>0&&d.length<=1000000&&d[0]===null
    &&d.slice(1).every(x=>typeof x==='string')&&new Set(d).size===d.length,'Invalid annotation dictionary');}
  return m;
}
export async function sha256(bytes:Uint8Array<ArrayBuffer>):Promise<string>{
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
}
/** Fixed-size destination, rejecting excess output before writing it. */
export async function readBounded(stream:ReadableStream<Uint8Array>|null,expected:number,signal:AbortSignal){
  check(stream,'Missing graph stream');const reader=stream.getReader(),result=new Uint8Array(expected);let offset=0;
  try {while(true){signal.throwIfAborted();const {value,done}=await reader.read();if(done)break;
    check(offset+value.byteLength<=expected,'Graph stream exceeds declared size');result.set(value,offset);offset+=value.byteLength;}
    check(offset===expected,'Truncated graph stream');return result;
  } catch(e){await reader.cancel().catch(()=>{});throw e;} finally {reader.releaseLock();}
}
export function validateGraph(graph:LoadedGraph):number {
  const {ids,offsets,targets,weights,manifest:m}=graph;
  check(ids.length===m.nodes && offsets.length===m.nodes+1 && targets.length===m.edges && weights.length===m.edges,'Graph array lengths mismatch');
  check(offsets[0]===0 && offsets[m.nodes]===m.edges,'Invalid CSR endpoints');
  let contacts=0;
  for(let row=0;row<m.nodes;row++){
    check(row===0||ids[row]>ids[row-1],'Unsorted or duplicate neuron IDs');
    check(offsets[row]<=offsets[row+1]&&offsets[row+1]<=m.edges,'Invalid CSR row');
    let previous=-1;
    for(let e=offsets[row];e<offsets[row+1];e++){
      check(targets[e]<m.nodes&&targets[e]>previous&&weights[e]>0,'Invalid CSR target or weight');
      previous=targets[e];contacts+=weights[e];
    }
    for(const name of ANNOTATIONS)check(graph.annotations[name][row]<graph.dictionaries[name].length,'Annotation code out of bounds');
  }
  check(Number.isSafeInteger(contacts)&&contacts===m.synaptic_contacts,'Synaptic contact count mismatch');return contacts;
}
export async function loadGraph(catalog:GraphCatalog,base:URL,progress:(p:GraphProgress)=>void,
  signal:AbortSignal,fetcher:typeof fetch=fetch):Promise<{graph:LoadedGraph;metrics:GraphMetrics}>{
  const c=validateCatalog(catalog),start=performance.now();
  check(typeof DecompressionStream!=='undefined','Gzip streaming unavailable. Use current Chrome.');
  check(new Uint8Array(new Uint32Array([1]).buffer)[0]===1,'This graph loader requires a little-endian browser');
  const get=async(info:FileInfo)=>{
    signal.throwIfAborted();const r=await fetcher(new URL(info.file,base),{signal:AbortSignal.any([signal,AbortSignal.timeout(30000)])});
    check(r.ok,'Graph download failed: HTTP '+r.status);
    const bytes=await readBounded(r.body,info.bytes,signal);
    check(await sha256(bytes)===info.sha256,'Graph checksum mismatch');return bytes;
  };
  const manifestBytes=await get(c.manifest);
  const m=validateManifest(JSON.parse(new TextDecoder().decode(manifestBytes)),c);
  const buffers:Record<string,ArrayBuffer>={};let received=c.manifest.bytes,maxStagingBytes=c.manifest.bytes;
  progress({phase:'loading',received,total:c.download_bytes});
  // Sequential chunks bound live staging allocations; graph never crosses to the UI thread.
  for(const name of ARRAY_NAMES){
    const a=m.arrays[name],destination=new Uint8Array(a.bytes);buffers[name]=destination.buffer;
    for(const part of a.chunks){
      const compressed=await get(part);
      const input=new ReadableStream<BufferSource>({start(controller){controller.enqueue(compressed);controller.close();}});
      const raw=await readBounded(input.pipeThrough(new DecompressionStream('gzip')),part.raw_bytes,signal);
      check(await sha256(raw)===part.raw_sha256,'Decoded graph checksum mismatch');
      destination.set(raw,part.offset);received+=part.bytes;maxStagingBytes=Math.max(maxStagingBytes,compressed.byteLength+raw.byteLength);
      progress({phase:'loading',received,total:c.download_bytes});
    }
  }
  check(await sha256(new Uint8Array(buffers.neuron_ids))===m.graph_identity,'Loaded neuron IDs mismatch anatomy');
  progress({phase:'validating',received,total:c.download_bytes});signal.throwIfAborted();
  const graph:LoadedGraph={ids:new BigUint64Array(buffers.neuron_ids),offsets:new Uint32Array(buffers.row_offsets),
    targets:new Uint32Array(buffers.target_indices),weights:new Uint32Array(buffers.weights),
    annotations:Object.fromEntries(ANNOTATIONS.map(name=>[name,new Uint32Array(buffers['annotation_'+name])])),dictionaries:m.dictionaries,manifest:m};
  const validationStart=performance.now(),synapticContacts=validateGraph(graph);signal.throwIfAborted();
  return {graph,metrics:{nodes:m.nodes,edges:m.edges,synapticContacts,arrayBytes:c.array_bytes,downloadedBytes:received,
    maxStagingBytes,elapsedMs:performance.now()-start,validationMs:performance.now()-validationStart,firstNeuronId:graph.ids[0].toString()}};
}
