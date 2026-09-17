import {it,expect} from 'vitest';
import {SIGN_POLICIES,TEMPORAL_POLICIES,sourceSigns,sensitivityModel,sensitivityTrial} from '../../../brain/core/sensitivity';
const empty={offsets:new Uint32Array(202),targets:new Uint32Array(),weights:new Uint32Array()};
it('sign controls include exact block inversion and disabled transmission',()=>{
 expect(Array.from(sourceSigns(201,'alternating')).filter(x=>x===-1)).toHaveLength(100);
 expect(sourceSigns(201,'inverted')).toEqual(sourceSigns(201,'alternating').map(x=>-x));
 expect(sourceSigns(201,'zero').every(x=>x===0)).toBe(true);
});
it('fixed-duration disconnected pulses have analytical counts, bins and reset replay at both steps',()=>{
 for(const time of TEMPORAL_POLICIES)for(const sign of SIGN_POLICIES){
  const model=sensitivityModel(empty,sign,time),row=sensitivityTrial(model,time);
  expect(row.spikes).toBe(time.dt===1?12:9);
  expect(row.lastSpikeTime).toBe(time.dt===1?9:8);
  expect(row.bins).toEqual([row.spikes,0,0,0,0,0,0,0,0,0]);
  expect(row.steps*time.dt).toBe(600);expect(sensitivityTrial(model,time)).toEqual(row);
 }
});
it('signed same-side fixture checks delayed readout, time normalization and reverse reset with pending state',()=>{
 const graph={offsets:new Uint32Array([0,1,2,2,2]),targets:new Uint32Array([2,3]),weights:new Uint32Array([1000,1000])};
 const mapping={inputs:[new Uint32Array([0]),new Uint32Array([1])] as [Uint32Array,Uint32Array],outputs:[new Uint32Array([2]),new Uint32Array([3])] as [Uint32Array,Uint32Array],excludedInput:0,excludedOutput:0};
 for(const time of TEMPORAL_POLICIES)for(const sign of SIGN_POLICIES){
  const model=sensitivityModel(graph,sign,time);
  const left=sensitivityTrial(model,time,mapping,0),right=sensitivityTrial(model,time,mapping,1);
  expect(sensitivityTrial(model,time,mapping,1)).toEqual(right);
  model.reset();model.step(new Int32Array([1000,0,0,0]));
  expect(model.snapshot().pending[2]).toBe(sign==='zero'?0:sign==='inverted'?-1000:1000);
  expect(sensitivityTrial(model,time,mapping,0)).toEqual(left);
  const count=sign==='zero'||sign==='inverted'||time.name==='stronger-leak'?0:time.dt===2?15:12;
  expect(left.readoutCounts).toEqual([count,0]);expect(right.readoutCounts).toEqual([0,count]);
  expect(left.readoutPerReferenceUnit).toEqual([count/60,0]);
  expect(left.readoutPerTick).toEqual([count/(60/time.dt),0]);
 }
 expect(graph.weights).toEqual(new Uint32Array([1000,1000]));
});
