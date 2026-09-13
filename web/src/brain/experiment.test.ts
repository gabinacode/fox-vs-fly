import {it,expect,vi} from 'vitest';
import {runExperiment} from './experiment';
it('controls have analytically known disconnected responses and reproducible traces',async()=>{
 vi.useFakeTimers();try{
 const graph={offsets:new Uint32Array(202),targets:new Uint32Array(),weights:new Uint32Array()};
 const progress:number[]=[];const promise=runExperiment(graph,new AbortController().signal,(_,n)=>progress.push(n),'controls');
 await vi.runAllTimersAsync();const result=await promise;
 expect(result.rows.map(r=>r.spikes)).toEqual([120,120,120,12]);
 expect(result.rows.map(r=>r.lateSpikes)).toEqual([60,60,60,0]);
 expect(result.rows[0].hash).toBe(result.rows[1].hash);expect(progress.at(-1)).toBe(1440);
 expect(graph.offsets.every(n=>n===0)).toBe(true);
 }finally{vi.useRealTimers();}
});
it('stop is honored after a cooperative yield and rejects invalid suites',async()=>{
 const graph={offsets:new Uint32Array([0,0]),targets:new Uint32Array(),weights:new Uint32Array()};
 const c=new AbortController();await expect(runExperiment(graph,c.signal,()=>c.abort(),'controls')).rejects.toThrow();
 await expect(runExperiment(graph,new AbortController().signal,()=>{},'invalid' as never)).rejects.toThrow('Unknown experiment suite');
});

it('long pulse bins conserve spikes and report finite-window extinction on disconnected neurons',async()=>{
 vi.useFakeTimers();try{
 const graph={offsets:new Uint32Array(202),targets:new Uint32Array(),weights:new Uint32Array()};
 const promise=runExperiment(graph,new AbortController().signal,()=>{},'stability');
 await vi.runAllTimersAsync();const result=await promise;
 for(const row of result.rows){expect(row.ticks).toBe(600);expect(row.spikes).toBe(12);expect(row.lateSpikes).toBe(0);
  expect(row.lastSpikeTick).toBe(9);expect(row.spikeBins).toEqual([12,0,0,0,0,0,0,0,0,0]);}
 }finally{vi.useRealTimers();}
});

it('independent trials remove carryover and preserve stimulus-specific traces under reversed order',async()=>{
 vi.useFakeTimers();try{
 const graph={offsets:new Uint32Array([0,1,2,2,2]),targets:new Uint32Array([2,3]),weights:new Uint32Array([1000,1000])};
 const annotations={annotations:{superclass:new Uint32Array([1,1,2,2]),somaSide:new Uint32Array([1,2,1,2])},dictionaries:{superclass:[null,'visual_projection','descending_neuron'],somaSide:[null,'L','R']}};
 const promise=runExperiment(graph,new AbortController().signal,()=>{},'independent',annotations);await vi.runAllTimersAsync();
 const result=await promise;expect(result.rows[0].readout).toEqual([[1/3,0],[0,1/3]]);
 expect(result.rows[0].directionalContrast).toBe(2/3);expect(result.rows[0].trialHashes?.length).toBe(2);
 expect(result.rows[1].readout).toEqual([[0,0],[0,0]]);expect(result.rows[1].directionalContrast).toBe(0);
 }finally{vi.useRealTimers();}
});

it('sweep retains all predeclared strengths and seeds, with zero disconnected readouts',async()=>{
 vi.useFakeTimers();try{
 const graph={offsets:new Uint32Array([0,0,0,0,0]),targets:new Uint32Array(),weights:new Uint32Array()};
 const annotations={annotations:{superclass:new Uint32Array([1,1,2,2]),somaSide:new Uint32Array([1,2,1,2])},dictionaries:{superclass:[null,'visual_projection','descending_neuron'],somaSide:[null,'L','R']}};
 const promise=runExperiment(graph,new AbortController().signal,()=>{},'robustness',annotations);await vi.runAllTimersAsync();const result=await promise;
 expect(result.rows).toHaveLength(15);
 for(const amplitude of [250,500,1000]){const rows=result.rows.filter(r=>r.amplitude===amplitude);expect(rows).toHaveLength(5);
  expect(rows.flatMap(r=>r.shuffleSeed?[r.shuffleSeed]:[])).toEqual([20260912,20260913,20260914]);
  for(const row of rows)expect(row.readout).toEqual([[0,0],[0,0]]);}
 }finally{vi.useRealTimers();}
});
