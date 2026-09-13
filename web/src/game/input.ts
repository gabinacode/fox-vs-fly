import type {ControllerInput} from '../../../brain/include/types';
export class KeyboardInput {
 held=new Set<string>(); pressed=new Set<string>();
 down(code:string){if(!this.held.has(code))this.pressed.add(code);this.held.add(code);}
 up(code:string){this.held.delete(code);}
 clear(){this.held.clear();this.pressed.clear();}
 sample():ControllerInput {const has=(k:string)=>this.held.has(k)||this.pressed.has(k);const value={axis:(Number(has('KeyD'))-Number(has('KeyA')))*1000,buttons:(has('KeyW')?1:0)|(has('KeyS')?2:0)|(has('KeyJ')?4:0)};this.pressed.clear();return value;}
}
