import {Simulation,type Snapshot} from '../wasm/sim';
import type {BrainFrame} from '../../../brain/include/types';
import {motorDecode} from '../../../brain/core/motor';
import {FixedClock} from './clock';
import {PlayerInput} from './input';
type WorkerFrame=Omit<BrainFrame,'activity'>&{activity?:Uint8Array};
export class Session {
 input=new PlayerInput();clock=new FixedClock();running=false;epoch=0;generation=0;pending=false;frame:BrainFrame|null=null;state:Snapshot;
 /** When true, the interval pump does not advance — callers use stepOnce(). */
 exportDrive=false;
 /**
  * Capture presentation: when set, Fly gameplay input is forced idle once
  * `state.tick` reaches this value (inclusive). Motor values remain the live decode for UI.
  */
 flyIdleAfterTick:number|null=null;
 private sentTick=0;private timer:number;private sentAt=0;
 private stepWaiters:{resolve:()=>void;reject:(error:Error)=>void}|null=null;
 constructor(readonly sim:Simulation,readonly worker:Worker,private change:()=>void,private failed:(message:string)=>void,readonly neuronCount=7200){
  this.state=sim.snapshot();
  worker.onmessage=(event:MessageEvent<{epoch:number;frame?:WorkerFrame;type?:string;message?:string}>)=>{
   if(event.data.epoch!==this.epoch||!this.pending||!this.running)return;
   try{if(event.data.type==='error')throw Error(event.data.message||'Controller failed');const wire=event.data.frame;if(!wire)throw Error('Worker frame missing');
    const activity=wire.activity??this.frame?.activity;
    if(wire.tick!==this.sentTick||wire.version!==1||!activity||activity.length!==this.neuronCount||(!wire.activity&&wire.model_tick!==this.frame?.model_tick))throw Error('Worker frame mismatch');
    const f:BrainFrame=wire.activity?(wire as BrainFrame):{...wire,activity};
    const decoded=motorDecode(f.motor_values);
    const controls=this.flyIdleAfterTick!=null&&this.state.tick>=this.flyIdleAfterTick?{axis:0,buttons:0}:decoded;
    // Sample Fox at apply time, not request time — neural wait would otherwise freeze stale input.
    this.sim.step(this.input.sample(),controls);this.frame=f;this.state=sim.snapshot();this.pending=false;
    if(this.state.winner!==-1&&!this.exportDrive)this.pause();this.change();
    if(this.stepWaiters){const w=this.stepWaiters;this.stepWaiters=null;w.resolve();}else this.pump(performance.now());
   }catch(error){this.fail(String(error));}
  };
  worker.onerror=()=>this.fail('The controller worker stopped. Reload the page to restart.');
  this.timer=window.setInterval(()=>this.pump(performance.now()),4);
 }
 private fail(message:string){
  if(this.stepWaiters){const w=this.stepWaiters;this.stepWaiters=null;w.reject(Error(message));}
  this.pause();this.failed(message);
 }
 private pump(now:number){
  if(!this.running||this.exportDrive||this.stepWaiters)return;
  // Worker time satisfies the current frame budget, capped at one frame so a
  // slow device never accumulates catch-up debt or skips deterministic frames.
  if(this.pending){this.clock.wait(now);if(now-this.sentAt>2000)this.fail('Controller timeout. Reload to restart.');return;}
  // A suspended/overloaded phone may deliver a very late timer. Drop wall-clock debt
  // instead of forcing a click; deterministic game frames are never skipped.
  if(!this.clock.accrue(now)){this.clock.reset(now);return;}
  if(!this.clock.ready())return;
  this.clock.consume();this.sentTick=this.state.tick;this.pending=true;this.sentAt=now;
  this.worker.postMessage({epoch:this.epoch,generation:this.generation,observation:this.state,count:this.neuronCount});
 }
 /** Advance exactly one game frame; waits for the matching neural worker reply. */
 stepOnce():Promise<void>{
  if(this.pending||this.stepWaiters)return Promise.reject(Error('Step already pending'));
  if(this.state.winner!==-1)return Promise.reject(Error('Match ended'));
  return new Promise((resolve,reject)=>{
   this.stepWaiters={resolve,reject};
   this.running=true;
   this.sentTick=this.state.tick;
   this.pending=true;
   this.sentAt=performance.now();
   this.worker.postMessage({epoch:this.epoch,generation:this.generation,observation:this.state,count:this.neuronCount});
  });
 }
 play(){if(this.state.winner!==-1)this.reset();this.clock.reset(performance.now());this.running=true;this.change();}
 pause(){this.running=false;this.epoch++;this.pending=false;this.input.clear();this.change();}
 reset(){this.pause();this.generation++;this.sim.reset();this.state=this.sim.snapshot();this.frame=null;this.change();}
 dispose(){window.clearInterval(this.timer);this.worker.terminate();this.input.clear();}
}
