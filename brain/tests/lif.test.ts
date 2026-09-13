import {describe,it,expect} from 'vitest';
import {SparseLif,LIF_V1,type SparseGraph} from '../core/lif';
const graph=(offsets:number[],targets:number[],weights:number[]):SparseGraph=>({offsets:new Uint32Array(offsets),targets:new Uint32Array(targets),weights:new Uint32Array(weights)});
const p={...LIF_V1,threshold:10,floor:-10,leakNumerator:1,leakDenominator:2,refractorySteps:2};
describe('integer sparse LIF',()=>{
 it('integrates, leaks toward zero, thresholds, resets and discards refractory input',()=>{
  const m=new SparseLif(graph([0,0],[],[]),new Int8Array([0]),p);
  expect([...m.step(new Int32Array([9]))]).toEqual([]);expect(m.snapshot().voltage[0]).toBe(9);
  expect([...m.step(new Int32Array([6]))]).toEqual([0]);
  for(let i=0;i<2;i++){expect(m.step(new Int32Array([100])).length).toBe(0);expect(m.snapshot().voltage[0]).toBe(0);}
  expect([...m.step(new Int32Array([10]))]).toEqual([0]);
  m.reset();m.step(new Int32Array([-5]));m.step();expect(m.snapshot().voltage[0]).toBe(-2);
 });
 it('propagates directed measured counts with one tick delay, no same-tick cascade',()=>{
  const m=new SparseLif(graph([0,1,2,2],[1,2],[10,10]),new Int8Array([1,1,0]),p);
  expect([...m.step(new Int32Array([10,0,0]))]).toEqual([0]);
  expect([...m.step()]).toEqual([1]);expect([...m.step()]).toEqual([2]);
 });
 it('sums excitation and inhibition before clamping, with explicit unknown silence',()=>{
  const m=new SparseLif(graph([0,1,2,3,3],[3,3,3],[30,25,100]),new Int8Array([1,-1,0,0]),p);
  m.step(new Int32Array([10,10,10,0]));expect(m.step().length).toBe(0);expect(m.snapshot().voltage[3]).toBe(5);
 });
 it('delays autapses and applies refractory blocking',()=>{
  const m=new SparseLif(graph([0,1],[0],[10]),new Int8Array([1]),{...p,refractorySteps:0});
  m.step(new Int32Array([10]));expect([...m.step()]).toEqual([0]);
  const blocked=new SparseLif(graph([0,1],[0],[10]),new Int8Array([1]),p);
  blocked.step(new Int32Array([10]));expect(blocked.step().length).toBe(0);expect(blocked.snapshot().pending[0]).toBe(0);
 });
 it('reset replays every state exactly and does not mutate measured arrays',()=>{
  const g=graph([0,1,2],[1,0],[9,4]),before=g.weights.slice();const m=new SparseLif(g,new Int8Array([1,-1]),p);
  const run=()=>Array.from({length:100},(_,i)=>{const spikes=[...m.step(new Int32Array([i%7, i%3]))];return {spikes,...m.snapshot()};});
  const a=run();m.reset();expect(run()).toEqual(a);expect(g.weights).toEqual(before);
 });
 it('rejects invalid configuration and CSR before stepping',()=>{
  const g=graph([0,0],[],[]);
  expect(()=>new SparseLif(g,new Int8Array([2]),p)).toThrow();
  expect(()=>new SparseLif(g,new Int8Array([0]),{...p,threshold:0})).toThrow();
  expect(()=>new SparseLif(graph([0,1],[1],[1]),new Int8Array([1]),p)).toThrow();
  const m=new SparseLif(g,new Int8Array([0]),p);expect(()=>m.step(new Int32Array(2))).toThrow();expect(m.tick).toBe(0);
 });
 it('agrees with an independent dense delayed-current reference over 200 ticks',()=>{
  const dense=[[3,12,0,0],[0,0,7,0],[4,0,0,13],[0,6,0,0]],signs=[1,-1,1,0];
  const g=graph([0,2,3,5,6],[0,1,2,0,3,1],[3,12,7,4,13,6]);
  const m=new SparseLif(g,new Int8Array(signs),p);let v=[0,0,0,0],r=[0,0,0,0],last:number[]=[];
  for(let tick=0;tick<200;tick++){
   const input=[(tick*7)%23-5,(tick*11)%19-3,(tick*3)%17-7,tick%13];
   const fired:number[]=[];
   for(let target=0;target<4;target++){
    let current=input[target];for(const source of last)current+=dense[source][target]*signs[source]*p.gain;
    if(r[target]){r[target]--;v[target]=p.reset;continue;}
    v[target]=Math.trunc(v[target]/2)+current;
    if(v[target]>=p.threshold){fired.push(target);v[target]=p.reset;r[target]=p.refractorySteps;}
    else v[target]=Math.max(p.floor,v[target]);
   }
   expect([...m.step(new Int32Array(input))]).toEqual(fired);
   expect([...m.snapshot().voltage]).toEqual(v);expect([...m.snapshot().refractory]).toEqual(r);last=fired;
  }
 });
 it('accumulates large signed currents without int32 wrapping and clamps inhibition',()=>{
  const m=new SparseLif(graph([0,1,2,2],[2,2],[4294967295,4294967294]),new Int8Array([1,-1,0]),p);
  m.step(new Int32Array([10,10,0]));m.step();expect(m.snapshot().voltage[2]).toBe(1);
  m.reset();m.step(new Int32Array([0,10,0]));m.step();expect(m.snapshot().voltage[2]).toBe(-10);
 });

});
