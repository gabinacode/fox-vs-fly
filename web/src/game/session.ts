import {Simulation,type Snapshot} from '../wasm/sim';
import type {BrainFrame,ControllerInput} from '../../../brain/include/types';
import {motorDecode} from '../../../brain/core/motor';
import {FixedClock} from './clock';
import {KeyboardInput} from './input';
export class Session {
 input=new KeyboardInput();clock=new FixedClock();running=false;epoch=0;generation=0;pending=false;frame:BrainFrame|null=null;state:Snapshot;
 private sentInput:ControllerInput={axis:0,buttons:0};private sentTick=0;private timer:number;private sentAt=0;
 constructor(readonly sim:Simulation,readonly worker:Worker,private change:()=>void,private failed:(message:string)=>void,readonly neuronCount=7200){
  this.state=sim.snapshot();
  worker.onmessage=(event:MessageEvent<{epoch:number;frame:BrainFrame;type?:string;message?:string}>)=>{
   if(event.data.epoch!==this.epoch||!this.pending||!this.running)return;
   try{if(event.data.type==='error')throw Error(event.data.message||'Controller failed');const f=event.data.frame;if(f.tick!==this.sentTick||f.version!==1||f.activity.length!==this.neuronCount)throw Error('Worker frame mismatch');
    const controls=motorDecode(f.motor_values);this.sim.step(this.sentInput,controls);this.frame=f;this.state=sim.snapshot();this.pending=false;
    if(this.state.winner!==-1)this.pause();this.change();
   }catch(error){this.fail(String(error));}
  };
  worker.onerror=()=>this.fail('The controller worker stopped. Reload the page to restart.');
  this.timer=window.setInterval(()=>this.pump(performance.now()),4);
 }
 private fail(message:string){this.pause();this.failed(message);}
 private pump(now:number){
  if(!this.running)return;
  if(!this.clock.accrue(now)){this.pause();this.failed('Simulation fell behind. Press Resume to continue at this frame.');return;}
  if(this.pending){if(now-this.sentAt>2000)this.fail('Controller timeout. Reload to restart.');return;}
  if(!this.clock.ready())return;
  this.clock.consume();this.sentInput=this.input.sample();this.sentTick=this.state.tick;this.pending=true;this.sentAt=now;
  this.worker.postMessage({epoch:this.epoch,generation:this.generation,observation:this.state,count:this.neuronCount});
 }
 play(){if(this.state.winner!==-1)this.reset();this.clock.reset(performance.now());this.running=true;this.change();}
 pause(){this.running=false;this.epoch++;this.pending=false;this.input.clear();this.change();}
 reset(){this.pause();this.generation++;this.sim.reset();this.state=this.sim.snapshot();this.frame=null;this.change();}
 dispose(){window.clearInterval(this.timer);this.worker.terminate();this.input.clear();}
}
