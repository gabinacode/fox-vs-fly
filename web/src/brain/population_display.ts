import type {BrainGeometry} from '../../../brain/include/types';
export function mapPopulationRoles(roles:Uint8Array,geometry:BrainGeometry){
 if(!(roles instanceof Uint8Array)||roles.length!==(geometry.neuron_count??geometry.positions.length/3))throw Error('Population/geometry mismatch');
 const total=[0,0,0],positioned=[0,0,0],visual=new Uint8Array(geometry.positions.length/3);
 for(const role of roles){if(role>2)throw Error('Invalid controller population role');total[role]++;}
 for(let j=0;j<visual.length;j++){const i=geometry.visual_indices?.[j]??j;if(i>=roles.length)throw Error('Invalid population visual index');visual[j]=roles[i];positioned[roles[i]]++;}
 return {visual,drive:{total:total[1],positioned:positioned[1],unpositioned:total[1]-positioned[1]},readout:{total:total[2],positioned:positioned[2],unpositioned:total[2]-positioned[2]}};
}
export type PopulationCoverage=Pick<ReturnType<typeof mapPopulationRoles>,'drive'|'readout'>;
