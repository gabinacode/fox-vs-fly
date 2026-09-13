import {DummyBrain} from '../../../brain/core/dummy';
import type {Observation} from '../../../brain/include/types';
let brain:DummyBrain;
self.onmessage=(event:MessageEvent<{epoch:number;observation:Observation;count:number}>)=>{
 const {epoch,observation,count}=event.data;
 if(!Number.isInteger(count)||count<1||count>1000000)throw Error('Invalid neuron count');
 if(!brain||brain.count!==count)brain=new DummyBrain(count,42);
 const frame=brain.step(observation);
 self.postMessage({epoch,frame},{transfer:[frame.activity.buffer,frame.sensory_values.buffer,frame.motor_values.buffer]});
};
