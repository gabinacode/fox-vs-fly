import type {BrainGeometry} from '../../../brain/include/types';
export type ActivityScale='linear'|'log';
/** Precomputed log1p display map: byte b → round(255 * log1p(b) / log(256)). */
const LOG_LUT=Uint8Array.from({length:256},(_,value)=>value?Math.round(255*Math.log1p(value)/Math.log(256)):0);
/** Fixed display-only scale. Zero stays zero; no frame-dependent normalization. */
export function activityByte(value:number,scale:ActivityScale){
 const byte=value&255;return scale==='linear'?byte:LOG_LUT[byte];
}
export function mapRateActivity(activity:Uint8Array,geometry:BrainGeometry,output:Uint8Array,scale:ActivityScale){
 if(activity.length!==(geometry.neuron_count??geometry.positions.length/3)||output.length!==geometry.positions.length/3)throw Error('Brain frame/geometry mismatch');
 const indices=geometry.visual_indices,n=output.length;
 // Hoist indices + avoid optional chaining in the 139k hot loop (Chrome is sensitive here).
 if(scale==='linear'){
  if(indices)for(let i=0;i<n;i++)output[i]=activity[indices[i]];
  else for(let i=0;i<n;i++)output[i]=activity[i];
 }else if(indices)for(let i=0;i<n;i++)output[i]=LOG_LUT[activity[indices[i]]];
 else for(let i=0;i<n;i++)output[i]=LOG_LUT[activity[i]];
}
