import type {ControllerInput,FighterObservation,Observation} from '../../../brain/include/types';
import {runtimeAssetUrl} from '../capture/runtime_url';
export interface Fighter extends FighterObservation { facing:number; action_frame:number; jumps:number; hitlag:number; invulnerable:number; }
export interface Snapshot extends Observation { fox:Fighter; fly:Fighter; winner:number; hash:number; }
interface Module { _sim_reset(seed:number):void; _sim_step(x:number,b:number,y:number,c:number):void; _sim_field(p:number,f:number):number; _sim_tick():number; _sim_winner():number; _sim_hash():number; }
export class Simulation {
 constructor(private m:Module){this.reset();}
 reset(){this.m._sim_reset(42);}
 step(a:ControllerInput,b:ControllerInput){this.m._sim_step(a.axis,a.buttons,b.axis,b.buttons);}
 snapshot():Snapshot {
  const fighter=(p:number):Fighter=>{const f=(n:number)=>this.m._sim_field(p,n);return {x:f(0)/1000,y:f(1)/1000,vx:f(2)/1000,vy:f(3)/1000,facing:f(4),grounded:f(5),action:f(6),action_frame:f(7),damage:f(8),stocks:f(9),hitlag:f(10),hitstun:f(11),jumps:f(12),invulnerable:f(15)};};
  return {tick:this.m._sim_tick(),fox:fighter(0),fly:fighter(1),winner:this.m._sim_winner(),hash:this.m._sim_hash()>>>0};
 }
}
export async function loadSimulation(){
 if(typeof WebAssembly==='undefined')throw Error('This browser does not support WebAssembly. Open in current Chrome.');
 const url=runtimeAssetUrl('wasm/sim.js').href;
 const {default:create}=await import(/* @vite-ignore */ url);
 const module=await create({locateFile:(name:string)=>new URL(name,url).href});
 return new Simulation(module);
}
