import {it,expect} from 'vitest';
import {activityByte,mapRateActivity} from './activity_display';
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
