import type {Snapshot} from '../wasm/sim';
import type {BrainCameraPreset,GameCameraPreset} from './types';

export type GameCameraState={centerX:number;zoom:number;roll:number;parallaxX:number;parallaxY:number;impact:number;/** Canvas-Y after scale; negative lifts the plate. */panY?:number};
export type BrainCameraState={yaw:number;pitch:number;zoom:number;panX:number;panY:number;cinematic:boolean};

const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const smooth=(t:number)=>{const x=clamp(t,0,1);return x*x*(3-2*x);};

export function gameCameraState(preset:GameCameraPreset,s:Snapshot,localFrame:number,totalFrames:number):GameCameraState{
  const t=smooth(localFrame/Math.max(1,totalFrames-1));
  const midpoint=(s.fox.x+s.fly.x)/2;
  const safeMid=clamp(midpoint,-24,24);
  const impactFrames=Math.max(s.fox.hitlag,s.fly.hitlag);
  const impact=impactFrames>0?clamp(impactFrames/4,0,1):0;
  if(preset==='clean')return {centerX:0,zoom:1,roll:0,parallaxX:0,parallaxY:0,impact:0};
  if(preset==='wide')return {centerX:safeMid*t*.38,zoom:.94+.095*t,roll:(t-.5)*.002,parallaxX:-8*t,parallaxY:2*t,impact:0};
  if(preset==='trailer')return {centerX:safeMid*.62+s.fox.x*.08,zoom:1.025+.09*t,roll:Math.sin(t*Math.PI)*-.003,parallaxX:-10*t,parallaxY:3*t,impact:0};
  if(preset==='close')return {centerX:safeMid*.82,zoom:1.13+.045*t,roll:Math.sin(t*Math.PI)*.002,parallaxX:-safeMid*.12,parallaxY:2,impact:0};
  /** Editorial still — crop into the plate so Fox/Fly read clearly in 1080×1350. */
  if(preset==='still')return {centerX:safeMid*.15,zoom:3.05,roll:0,parallaxX:-safeMid*.03,parallaxY:5,impact:0,panY:-22};
  const kickX=impact?Math.sin((s.tick+1)*2.35)*1.8*impact:0;
  return {centerX:safeMid*.86+kickX,zoom:1.12+.035*t+.035*impact,roll:(impact?Math.sin(s.tick*3.1)*.009*impact:0),parallaxX:-safeMid*.15-kickX*.35,parallaxY:2-impact*2,impact};
}

export function brainCameraState(preset:BrainCameraPreset,localFrame:number,totalFrames:number):BrainCameraState{
  const t=smooth(localFrame/Math.max(1,totalFrames-1));
  if(preset==='front')return {yaw:.12,pitch:0,zoom:1,panX:0,panY:0,cinematic:true};
  if(preset==='push')return {yaw:.08+.055*t,pitch:-.012*t,zoom:1.02+.14*t,panX:-.018*t,panY:.012*t,cinematic:true};
  if(preset==='close')return {yaw:.14,pitch:-.018,zoom:1.23+.04*t,panX:-.025,panY:.016,cinematic:true};
  return {yaw:.085+.07*t,pitch:-.012+Math.sin(t*Math.PI)*.018,zoom:1.06+.06*t,panX:-.012*t,panY:.008*t,cinematic:true};
}
