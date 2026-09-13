import {it,expect} from 'vitest';
import {NeuralDiagnostic} from './diagnostic';
import type {LoadedGraph} from './connectome';
it('diagnostic pixels come only from real model spikes and follow delayed transmission',()=>{
 const graph={ids:new BigUint64Array([1n,2n,3n,4n]),offsets:new Uint32Array([0,1,2,2,2]),targets:new Uint32Array([2,3]),weights:new Uint32Array([1000,1000]),
 annotations:{superclass:new Uint32Array([1,1,2,2]),somaSide:new Uint32Array([1,2,1,2])},dictionaries:{superclass:[null,'visual_projection','descending_neuron'],somaSide:[null,'L','R']},manifest:{graph_identity:'fixture'}} as unknown as LoadedGraph;
 const a=new NeuralDiagnostic(graph);expect([...a.initial().activity]).toEqual([0,0,0,0]);
 const first=a.step();expect([...first.activity]).toEqual([255,0,0,0]);expect(first.spikes).toBe(1);
 expect([...a.step().activity]).toEqual([0,0,255,0]);expect([...first.activity]).toEqual([255,0,0,0]);
 const b=new NeuralDiagnostic(graph);expect(b.step().hash).toBe(first.hash);
 for(let i=2;i<120;i++)a.step();expect(()=>a.step()).toThrow('completed');
});
