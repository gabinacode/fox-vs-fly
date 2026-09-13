import {it,expect} from 'vitest';
import {buildPopulationMapping,shufflePopulationMapping,mappedDrive,mappedRates} from '../core/population_mapping';
const data={annotations:{superclass:new Uint32Array([1,1,2,2,2,1]),somaSide:new Uint32Array([1,2,1,2,3,0])},dictionaries:{superclass:[null,'visual_projection','descending_neuron'],somaSide:[null,'L','R','M']}};
it('selects exact classes and sides without positions, with explicit exclusions',()=>{
 const m=buildPopulationMapping(data);expect([...m.inputs[0]]).toEqual([0]);expect([...m.outputs[1]]).toEqual([3]);
 expect([m.excludedInput,m.excludedOutput]).toEqual([1,1]);const drive=new Int32Array(6).fill(9);
 mappedDrive(m,1,drive,500);expect([...drive]).toEqual([0,500,0,0,0,0]);expect(mappedRates([1,2],m,4)).toEqual([.25,.5]);
});
it('shuffling is deterministic, preserves disjoint group sizes and does not mutate source',()=>{
 const m=buildPopulationMapping(data),a=shufflePopulationMapping(m,6),b=shufflePopulationMapping(m,6);
 expect(a).toEqual(b);expect([...m.inputs[0]]).toEqual([0]);
 const indices=[...a.inputs,...a.outputs].flatMap(g=>[...g]);expect(new Set(indices).size).toBe(4);expect(indices.every(i=>i<6)).toBe(true);
});
it('rejects empty mapping, invalid codes and invalid normalized counts',()=>{
 expect(()=>buildPopulationMapping({...data,annotations:{...data.annotations,somaSide:new Uint32Array(6)}})).toThrow('Empty');
 expect(()=>buildPopulationMapping({...data,annotations:{...data.annotations,superclass:new Uint32Array(6).fill(99)}})).toThrow('Invalid');
 expect(()=>mappedRates([5,0],buildPopulationMapping(data),4)).toThrow();
});

it('predeclared shuffle seeds are reproducible and reject degenerate zero',()=>{
 const m=buildPopulationMapping(data);
 expect(shufflePopulationMapping(m,100,20260913)).toEqual(shufflePopulationMapping(m,100,20260913));
 expect(shufflePopulationMapping(m,100,20260913)).not.toEqual(shufflePopulationMapping(m,100,20260914));
 expect(()=>shufflePopulationMapping(m,6,0)).toThrow('Invalid shuffle seed');
});
