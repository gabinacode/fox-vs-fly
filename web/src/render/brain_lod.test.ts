import {describe,expect,it} from 'vitest';
import {sampleBrainPointIndices} from './brain_lod';

describe('interactive brain point sampling',()=>{
 it('keeps a stable, broadly distributed sample for reduced-work rendering',()=>{
  const first=sampleBrainPointIndices(3000,3)!,second=sampleBrainPointIndices(3000,3)!;
  expect(first).toEqual(second);
  expect(first.length).toBeGreaterThan(950);
  expect(first.length).toBeLessThanOrEqual(1000);
  expect(first[0]).toBe(0);
  expect(first[first.length-1]).toBeGreaterThan(2900);
  for(let i=1;i<first.length;i++)expect(first[i]).toBeGreaterThan(first[i-1]);
 });

 it('leaves the full point array available at stride one and handles an empty cloud',()=>{
  expect(sampleBrainPointIndices(100,1)).toBeNull();
  expect(sampleBrainPointIndices(0,3)).toBeNull();
 });

 it('rejects invalid sampling requests',()=>{
  expect(()=>sampleBrainPointIndices(-1,3)).toThrow(RangeError);
  expect(()=>sampleBrainPointIndices(10,0)).toThrow(RangeError);
 });
});
