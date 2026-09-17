import {describe,expect,it} from 'vitest';
import {interactiveRenderProfile} from './performance';

describe('interactive render profile',()=>{
 it('separates game and brain cadence on phones without cutting asset DPR',()=>{
  expect(interactiveRenderProfile(390,false,8)).toEqual({pixelRatioCap:2,gameFrameIntervalMs:1000/30,brainFrameIntervalMs:1000/15,uiIntervalMs:100,mobile:true,constrained:true});
 });
 it('treats coarse-pointer tablets as mobile and avoids redundant full-rate desktop brain/HUD work',()=>{
  expect(interactiveRenderProfile(1024,true).mobile).toBe(true);
  expect(interactiveRenderProfile(1280,false,8)).toEqual({pixelRatioCap:2,gameFrameIntervalMs:0,brainFrameIntervalMs:1000/30,uiIntervalMs:100,mobile:false,constrained:false});
 });
 it('uses a lower brain cadence on low-core desktops while preserving game cadence and 2x resolution',()=>{
  expect(interactiveRenderProfile(1280,false,4)).toEqual({pixelRatioCap:2,gameFrameIntervalMs:0,brainFrameIntervalMs:1000/15,uiIntervalMs:100,mobile:false,constrained:true});
 });
});
