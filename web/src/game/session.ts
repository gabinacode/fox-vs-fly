import {Simulation,type Snapshot} from '../wasm/sim';
import type {BrainFrame,ControllerInput} from '../../../brain/include/types';
import {motorDecode} from '../../../brain/core/motor';
import {FixedClock} from './clock';
import {PlayerInput} from './input';
export class Session {
 input=new PlayerInput();clock=new FixedClock();running=false;epoch=0;generation=0;pending=false;frame:BrainFrame|null=null;state:Snapshot;
 /** When true, the interval pump does not advance — callers use stepOnce(). */
 exportDrive=false;
 private sentInput:ControllerInput={axis:0,buttons:0};private sentTick=0;private timer:number;private sentAt=0;
 private stepWaiters:{resolve:()=>void;reject:(error:Error)=>void}|null=null;
 constructor(readonly sim:Simulation,readonly worker:Worker,private change:()=>void,private failed:(message:string)=>void,readonly neuronCount=7200){
  this.state=sim.snapshot();
  worker.onmessage=(event:MessageEvent<{epoch:number;frame:BrainFrame;type?:string;message?:string}>)=>{
   if(event.data.epoch!==this.epoch||!this.pending||!this.running)return;
   try{if(event.data.type==='error')throw Error(event.data.message||'Controller failed');const f=event.data.frame;if(f.tick!==this.sentTick||f.version!==1||f.activity.length!==this.neuronCount)throw Error('Worker frame mismatch');
    const controls=motorDecode(f.motor_values);this.sim.step(this.sentInput,controls);this.frame=f;this.state=sim.snapshot();this.pending=false;
    if(this.state.winner!==-1&&!this.exportDrive)this.pause();this.change();
    if(this.stepWaiters){const w=this.stepWaiters;this.stepWaiters=null;w.resolve();}
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
  // Waiting on the neural worker is not schedule debt — phones would otherwise pause after a few seconds.
  if(this.pending){this.clock.mark(now);if(now-this.sentAt>2000)this.fail('Controller timeout. Reload to restart.');return;}
  if(!this.clock.accrue(now)){this.pause();this.failed('Simulation fell behind. Press Resume to continue at this frame.');return;}
  if(!this.clock.ready())return;
  this.clock.consume();this.sentInput=this.input.sample();this.sentTick=this.state.tick;this.pending=true;this.sentAt=now;
  this.worker.postMessage({epoch:this.epoch,generation:this.generation,observation:this.state,count:this.neuronCount});
 }
 /** Advance exactly one game frame; waits for the matching neural worker reply. */
 stepOnce():Promise<void>{
  if(this.pending||this.stepWaiters)return Promise.reject(Error('Step already pending'));
  if(this.state.winner!==-1)return Promise.reject(Error('Match ended'));
  return new Promise((resolve,reject)=>{
   this.stepWaiters={resolve,reject};
   this.running=true;
   this.sentInput=this.input.sample();
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
