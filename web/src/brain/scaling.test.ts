import {it,expect} from 'vitest';
import {SparseLif,LIF_V1} from '../../../brain/core/lif';
import {
  SCALING_FRACTIONS,SCALING_REPLICA_COUNTS,inducedPrefix,scalingNodeCounts,
  driveInput,lifStateBytes,graphBytes,sharedGraphReplicaBytes,independentCopyBytes,
} from '../../../brain/core/scaling';

const toy={
  offsets:new Uint32Array([0,2,3,5,5]),
  targets:new Uint32Array([1,2,2,0,3]),
  weights:new Uint32Array([1,2,3,4,5]),
};

it('induced prefix keeps only in-bound edges and preserves CSR order',()=>{
  const g=inducedPrefix(toy,3);
  expect(Array.from(g.offsets)).toEqual([0,2,3,4]);
  expect(Array.from(g.targets)).toEqual([1,2,2,0]);
  expect(Array.from(g.weights)).toEqual([1,2,3,4]);
  expect(inducedPrefix(toy,4)).toBe(toy);
  expect(()=>inducedPrefix(toy,0)).toThrow(/prefix/);
  expect(()=>inducedPrefix(toy,5)).toThrow(/prefix/);
});

it('prefix models agree with full-graph dynamics restricted to the same nodes',()=>{
  const full=new SparseLif(toy,new Int8Array([1,1,1,1]),{...LIF_V1});
  const prefix=new SparseLif(inducedPrefix(toy,3),new Int8Array([1,1,1]),{...LIF_V1});
  const fullIn=new Int32Array([1000,0,0,0]);
  const preIn=new Int32Array([1000,0,0]);
  const fullSpikes=Array.from(full.step(fullIn));
  const preSpikes=Array.from(prefix.step(preIn));
  expect(fullSpikes.filter(i=>i<3)).toEqual(preSpikes);
  expect(Array.from(full.step()).filter(i=>i<3)).toEqual(Array.from(prefix.step()));
});

it('scaling helpers expose fixed fractions, drive strides and shared-vs-copy memory',()=>{
  expect(SCALING_FRACTIONS).toEqual([1/64,1/16,1/4,1/2,1]);
  expect(SCALING_REPLICA_COUNTS).toEqual([1,2,4]);
  expect(scalingNodeCounts(166700)).toEqual([2604,10418,41675,83350,166700]);
  expect(Array.from(driveInput(5,2,7))).toEqual([7,0,7,0,7]);
  expect(lifStateBytes(10)).toBe(190);
  expect(graphBytes(toy)).toBe(toy.offsets.byteLength+toy.targets.byteLength+toy.weights.byteLength);
  const shared=sharedGraphReplicaBytes(toy,4),copies=independentCopyBytes(toy,4);
  expect(shared.graphBytes).toBe(graphBytes(toy));
  expect(copies.graphBytes).toBe(graphBytes(toy)*4);
  expect(shared.stateBytes).toBe(lifStateBytes(4)*4);
  expect(copies.totalBytes).toBeGreaterThan(shared.totalBytes);
});
