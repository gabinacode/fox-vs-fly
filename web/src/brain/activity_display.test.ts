import {it,expect} from 'vitest';
import {packRateActivity} from '../../../brain/core/male_cns';
import {activityByte,mapRateActivity,mapSampledRateActivity} from './activity_display';
import {mapSampledActivity} from './geometry';
it('fixed log scale preserves zero/endpoints and order without changing input',()=>{
 expect(activityByte(0,'log')).toBe(0);expect(activityByte(255,'log')).toBe(255);
 expect(activityByte(1,'log')).toBe(32);expect(activityByte(16,'log')).toBe(130);
 for(let i=1;i<256;i++){expect(activityByte(i,'log')).toBeGreaterThanOrEqual(activityByte(i-1,'log'));expect(activityByte(i,'linear')).toBe(i);}
});
it('holds the latest mapped rates exactly and clears old activity on a zero frame',()=>{
 const geometry={version:1 as const,provenance:'MALECNS' as const,positions:new Float32Array(6),visual_indices:new Uint32Array([2,0]),neuron_count:3};
 const input=new Uint8Array([1,255,16]),out=new Uint8Array(2);
 mapRateActivity(input,geometry,out,'log');expect([...out]).toEqual([130,32]);expect([...input]).toEqual([1,255,16]);
 mapRateActivity(input,geometry,out,'linear');expect([...out]).toEqual([16,1]);
 mapRateActivity(new Uint8Array(3),geometry,out,'log');expect([...out]).toEqual([0,0]);
 expect(()=>mapRateActivity(new Uint8Array(2),geometry,out,'log')).toThrow('mismatch');
});
it('maps only stable display samples while preserving full data indexing and peak semantics',()=>{
 const geometry={version:1 as const,provenance:'MALECNS' as const,positions:new Float32Array(12),visual_indices:new Uint32Array([3,0,2,1]),neuron_count:4};
 const sample=new Uint32Array([0,2]),input=new Uint8Array([10,20,30,40]),out=new Uint8Array(4);
 mapSampledRateActivity(input,geometry,out,sample,'linear');expect([...out]).toEqual([40,0,30,0]);
 mapSampledActivity(input,geometry,out,sample);expect([...out]).toEqual([40,0,30,0]);
 mapSampledActivity(new Uint8Array([1,2,3,4]),geometry,out,sample);expect([...out]).toEqual([40,0,30,0]);
 mapSampledRateActivity(new Uint8Array([1,2,3,4]),geometry,out,sample,'linear');expect([...out]).toEqual([4,0,3,0]);
});
it('JS pack helper matches the documented rate display formula',()=>{
 const rates=new Uint32Array([0,31,32,63,64,128,192,32704,65535]),out=new Uint8Array(rates.length);
 expect(packRateActivity(rates,out)).toBe(5);expect([...out]).toEqual([0,0,0,0,1,1,2,255,255]);
});
