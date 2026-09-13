import {expect,it} from 'vitest';
import {ratePopulationRoles} from '../../../brain/core/rate_mapping';
import {mapPopulationRoles} from './population_display';
const graph={annotations:{superclass:new Uint32Array([1,1,1,1,1,1,2,3,4,5,6])},dictionaries:{superclass:[null,'visual_projection','descending_neuron','vnc_motor','vnc_sensory','visual_projection_tbc','descending_neuron_tbc']}};
it('highlights exact controller inputs/readouts, not VNC sensory or tbc candidates',()=>{
 expect([...ratePopulationRoles(graph)]).toEqual([1,1,1,1,1,1,2,2,0,0,0]);
});
it('maps roles through soma indices while conserving positioned/unpositioned coverage',()=>{
 const geometry={version:1 as const,provenance:'MALECNS' as const,neuron_count:11,positions:new Float32Array(12),visual_indices:new Uint32Array([1,6,7,8])};
 const roles=ratePopulationRoles(graph),original=roles.slice(),result=mapPopulationRoles(roles,geometry);
 expect([...result.visual]).toEqual([1,2,2,0]);expect(result.drive).toEqual({total:6,positioned:1,unpositioned:5});expect(result.readout).toEqual({total:2,positioned:2,unpositioned:0});expect(roles).toEqual(original);
 expect(()=>mapPopulationRoles(new Uint8Array(10),geometry)).toThrow('mismatch');roles[0]=3;expect(()=>mapPopulationRoles(roles,geometry)).toThrow('Invalid');
});
