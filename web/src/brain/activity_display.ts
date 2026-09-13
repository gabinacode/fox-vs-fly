import type {BrainGeometry} from '../../../brain/include/types';
export type ActivityScale='linear'|'log';
/** Fixed display-only scale. Zero stays zero; no frame-dependent normalization. */
export function activityByte(value:number,scale:ActivityScale){
 return scale==='linear'?value:Math.round(255*Math.log1p(value)/Math.log(256));
}
export function mapRateActivity(activity:Uint8Array,geometry:BrainGeometry,output:Uint8Array,scale:ActivityScale){
 if(activity.length!==(geometry.neuron_count??geometry.positions.length/3)||output.length!==geometry.positions.length/3)throw Error('Brain frame/geometry mismatch');
 for(let i=0;i<output.length;i++)output[i]=activityByte(activity[geometry.visual_indices?.[i]??i],scale);
}
