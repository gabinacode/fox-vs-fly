import type {BrainGeometry} from '../../../brain/include/types';
import {placeholderGeometry,validateGeometry} from '../../../brain/core/geometry';
type Asset={file:string;sha256:string;bytes:number;length:number;dtype:string};
export async function decodeGeometry(m:any,read:(asset:Asset)=>Promise<ArrayBuffer>):Promise<BrainGeometry>{
 const integer=(n:unknown)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
 if(m.format!=='MALECNS_GEOMETRY_V1'||m.release!=='male-cns:v1.0'||!integer(m.retained_neurons)||m.retained_neurons<1||m.retained_neurons>1000000||!integer(m.positioned_neurons)||m.positioned_neurons<1||m.positioned_neurons>m.retained_neurons||!integer(m.edges)||m.missing_soma_positions!==m.retained_neurons-m.positioned_neurons)throw Error('Invalid measured geometry manifest');
 const load=async(name:string,length:number,dtype:string)=>{
  const a=m.arrays?.[name] as Asset;if(!a||!/^[_a-z0-9-]+\.bin$/.test(a.file)||!(/^[a-f0-9]{64}$/).test(a.sha256)||a.length!==length||a.bytes!==length*4||a.dtype!==dtype)throw Error('Invalid geometry asset');
  const bytes=await read(a);if(bytes.byteLength!==a.bytes)throw Error('Geometry length mismatch');
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==a.sha256)throw Error('Geometry checksum mismatch');return bytes;
 };
 const [p,v]=await Promise.all([load('positions',m.positioned_neurons*3,'<f4'),load('visual_indices',m.positioned_neurons,'<u4')]);
 // DataView keeps the little-endian artifact contract explicit.
 const positions=new Float32Array(p.byteLength/4),indices=new Uint32Array(v.byteLength/4);const pd=new DataView(p),vd=new DataView(v);
 for(let i=0;i<positions.length;i++)positions[i]=pd.getFloat32(i*4,true);
 for(let i=0;i<indices.length;i++){indices[i]=vd.getUint32(i*4,true);if(indices[i]>=m.retained_neurons||(i>0&&indices[i]<=indices[i-1]))throw Error('Invalid visual mapping');}
 const geometry:BrainGeometry={version:1,provenance:'MALECNS',positions,visual_indices:indices,neuron_count:m.retained_neurons,measured:{graph_identity:m.graph_identity,release:m.release,edges:m.edges,missing:m.missing_soma_positions,attribution:m.attribution}};validateGeometry(geometry);return geometry;
}
export async function loadGeometry():Promise<{geometry:BrainGeometry;warning:string}>{
 try{
  const base=new URL(`${import.meta.env.BASE_URL}connectome/`,location.href);
  const response=await fetch(new URL('manifest.json',base),{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Measured geometry unavailable');
  const geometry=await decodeGeometry(await response.json(),async a=>{const r=await fetch(new URL(a.file,base),{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Geometry download failed');return r.arrayBuffer();});
  return {geometry,warning:''};
 }catch(e){return {geometry:placeholderGeometry(),warning:`Measured anatomy unavailable; showing synthetic geometry. ${String(e)}`};}
}
export function mapActivity(activity:Uint8Array,geometry:BrainGeometry,output:Uint8Array){
 if(activity.length!==(geometry.neuron_count??geometry.positions.length/3)||output.length!==geometry.positions.length/3)throw Error('Brain frame/geometry mismatch');
 const indices=geometry.visual_indices;for(let i=0;i<output.length;i++)output[i]=Math.max(output[i],activity[indices?indices[i]:i]);
}
