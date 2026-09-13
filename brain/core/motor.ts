import type {ControllerInput} from '../include/types';
/** These exact displayed values are the only route to Fly controller input. */
export function motorDecode(m:Float32Array):ControllerInput {
 if(m.length!==5||m.some(x=>!Number.isFinite(x)||x<0||x>1))throw Error('Invalid motor channels');
 return {axis:Math.round((m[1]-m[0])*1000),buttons:(m[2]>.5?1:0)|(m[4]>.5?2:0)|(m[3]>.5?4:0)};
}
