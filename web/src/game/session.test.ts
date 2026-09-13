import {it,expect,vi,afterEach} from 'vitest';import {Session} from './session';import type {Simulation,Snapshot} from '../wasm/sim';import {DummyBrain} from '../../../brain/core/dummy';
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('applies matching worker outputs and rejects stale reset replies',()=>{
 vi.useFakeTimers();vi.stubGlobal('window',globalThis);
 const f={x:0,y:0,vx:0,vy:0,damage:0,grounded:1,action:0,hitstun:0,stocks:3,facing:1,action_frame:0,jumps:2,hitlag:0,invulnerable:0};
 const state:Snapshot={tick:0,fox:{...f,x:10},fly:f,winner:-1,hash:1};
 const step=vi.fn(()=>state.tick++),reset=vi.fn(()=>state.tick=0);
 const sim={snapshot:()=>({...state}),step,reset} as unknown as Simulation;
 const w={postMessage:vi.fn(),terminate:vi.fn(),onmessage:(_e:unknown)=>{},onerror:()=>{}};
 const s=new Session(sim,w as unknown as Worker,()=>{},()=>{},166700);s.play();vi.advanceTimersByTime(20);expect(w.postMessage).toHaveBeenCalledTimes(1);
 const request=w.postMessage.mock.calls[0][0];expect(request.count).toBe(166700);const frame=new DummyBrain(166700).step({...state,tick:0});w.onmessage({data:{epoch:request.epoch,frame}});
 expect(step).toHaveBeenCalledWith({axis:0,buttons:0},{axis:1000,buttons:4});expect(s.frame).toBe(frame);
 vi.advanceTimersByTime(20);const old=w.postMessage.mock.calls.at(-1)![0];s.reset();w.onmessage({data:{epoch:old.epoch,frame}});expect(step).toHaveBeenCalledTimes(1);expect(s.state.tick).toBe(0);s.dispose();
});
