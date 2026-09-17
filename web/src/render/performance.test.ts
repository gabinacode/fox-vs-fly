import {describe,expect,it} from 'vitest';
import {interactiveRenderProfile} from './performance';

describe('interactive render profile',()=>{
 it('reduces presentation work for narrow phone layouts',()=>{
  expect(interactiveRenderProfile(390,false)).toEqual({pixelRatioCap:1,frameIntervalMs:1000/30,uiIntervalMs:100,mobile:true});
 });
 it('treats coarse-pointer tablets as mobile and leaves desktop unthrottled',()=>{
  expect(interactiveRenderProfile(1024,true).mobile).toBe(true);
  expect(interactiveRenderProfile(1280,false)).toEqual({pixelRatioCap:2,frameIntervalMs:0,uiIntervalMs:0,mobile:false});
 });
});
