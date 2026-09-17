import {describe,expect,it} from 'vitest';
import type {BrainFrame} from '../../../brain/include/types';
import type {Snapshot} from '../wasm/sim';
import {brainReaction} from './brain';

describe('gameplay-coupled brain rendering',()=>{
 it('turns toward the opponent and reacts to applied attack/impact values without changing them',()=>{
  const fighter={x:0,y:0,vx:0,vy:0,facing:1,grounded:1,action:0,action_frame:0,damage:0,stocks:3,hitlag:0,hitstun:0,jumps:2,invulnerable:0};
  const snapshot={tick:1,fox:{...fighter,x:68,hitlag:2},fly:{...fighter,x:-20,vy:3},winner:-1,hash:1} as Snapshot;
  const frame={version:1,tick:1,activity:new Uint8Array(),active_neuron_count:0,sensory_values:new Float32Array(6),motor_values:new Float32Array([0,0,0,.8,0])} satisfies BrainFrame;
  const reaction=brainReaction(snapshot,frame,true);
  expect(reaction).toMatchObject({attack:true,impact:true});
  expect(reaction.drive).toBeCloseTo(.8);
  expect(reaction.yaw).toBeCloseTo(.316,3);
  expect(reaction.pitch).toBeLessThan(0);
  expect(frame.motor_values[3]).toBeCloseTo(.8);
 });
});
