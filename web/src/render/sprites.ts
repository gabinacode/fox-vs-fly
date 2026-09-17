/** Fighter sprite manifests, preload and animation selection. Simulation state is authoritative. */
import type {Fighter} from '../wasm/sim';
import {runtimeAssetUrl} from '../capture/runtime_url';

export type FighterId='fox'|'fly';
export type AnimState=
  |'idle'|'walk'
  |'jumpStart'|'jumpAir'|'jumpLand'
  |'attackWindup'|'attackStrike'|'attackRecover';

/** Mirrors sim/include/game.h Action / attack phase constants. */
export const Action={Idle:0,Walk:1,Dash:2,Run:3,JumpSquat:4,Air:5,Attack:6,Hurt:7,Respawn:8,Eliminated:9} as const;
export const STARTUP=5, ACTIVE_END=8, RECOVERY_END=23;
const LAND_HOLD_TICKS=7; // ~117 ms at 60 Hz
const WALK_THRESHOLD=.35;
/** World units traveled per full 4-frame walk cycle (matches extracted stance width). */
export const WALK_STRIDE={fox:12,fly:10} as const;

const FRAME_FILES={
  idle:'idle.png',
  walk:['walk-1.png','walk-2.png','walk-3.png','walk-4.png'] as const,
  jumpStart:'jump-start.png',
  jumpAir:'jump-air.png',
  jumpLand:'jump-land.png',
  attackWindup:'attack-windup.png',
  attackStrike:'attack-strike.png',
  attackRecover:'attack-recover.png',
} as const;

export type SpriteSet={
  idle:HTMLImageElement;
  walk:HTMLImageElement[];
  jumpStart:HTMLImageElement;
  jumpAir:HTMLImageElement;
  jumpLand:HTMLImageElement;
  attackWindup:HTMLImageElement;
  attackStrike:HTMLImageElement;
  attackRecover:HTMLImageElement;
};

export type FighterAtlas={fox:SpriteSet; fly:SpriteSet; ready:true};

type VisualMemory={wasGrounded:boolean; landUntil:number; walkDistance:number; walking:boolean};

const memory:Record<FighterId,VisualMemory>={
  fox:{wasGrounded:true,landUntil:-1,walkDistance:0,walking:false},
  fly:{wasGrounded:true,landUntil:-1,walkDistance:0,walking:false},
};

/** World-unit draw height; collision boxes stay authored in sim.
 *  `padBottom` matches extract_fighter_sprites.py PAD so feet sit on the sim root. */
export const SPRITE_DRAW={
  fox:{height:20,padBottom:12,anchorX:66.92},
  fly:{height:14,padBottom:12,anchorX:70.49},
} as const;

/** Canvas X of image left so the extractor's body anchor sits on the sim root. */
export function spriteImageLeft(drawWidth:number,naturalWidth:number,anchorX:number){
  if(naturalWidth<=0)return -drawWidth/2;
  return -(anchorX*drawWidth)/naturalWidth;
}

/** Canvas Y of image top so opaque content bottom lands on the fighter root. */
export function spriteImageTop(drawHeight:number,naturalHeight:number,padBottom:number){
  if(naturalHeight<=0)return -drawHeight;
  return -drawHeight+(padBottom*drawHeight)/naturalHeight;
}

function url(fighter:FighterId,file:string){
  return runtimeAssetUrl(`assets/fighters/${fighter}/${file}`).href;
}

function loadImage(src:string):Promise<HTMLImageElement>{
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.decoding='async';
    img.onload=()=>resolve(img);
    img.onerror=()=>reject(Error(`Failed to load fighter sprite ${src}`));
    img.src=src;
  });
}

async function loadSet(fighter:FighterId):Promise<SpriteSet>{
  const [idle,jumpStart,jumpAir,jumpLand,attackWindup,attackStrike,attackRecover,...walk]=await Promise.all([
    loadImage(url(fighter,FRAME_FILES.idle)),
    loadImage(url(fighter,FRAME_FILES.jumpStart)),
    loadImage(url(fighter,FRAME_FILES.jumpAir)),
    loadImage(url(fighter,FRAME_FILES.jumpLand)),
    loadImage(url(fighter,FRAME_FILES.attackWindup)),
    loadImage(url(fighter,FRAME_FILES.attackStrike)),
    loadImage(url(fighter,FRAME_FILES.attackRecover)),
    ...FRAME_FILES.walk.map(f=>loadImage(url(fighter,f))),
  ]);
  return {idle,walk,jumpStart,jumpAir,jumpLand,attackWindup,attackStrike,attackRecover};
}

let atlas:FighterAtlas|null=null;
let loading:Promise<FighterAtlas>|null=null;

export function fighterSpritesReady(){return !!atlas;}

export function getFighterAtlas(){return atlas;}

export async function preloadFighterSprites():Promise<FighterAtlas>{
  if(atlas)return atlas;
  if(!loading){
    loading=Promise.all([loadSet('fox'),loadSet('fly')]).then(([fox,fly])=>{
      atlas={fox,fly,ready:true};
      return atlas;
    });
  }
  return loading;
}

export function resetFighterSpriteVisuals(){
  for(const id of ['fox','fly'] as const){
    memory[id]={wasGrounded:true,landUntil:-1,walkDistance:0,walking:false};
  }
}

export function attackPhase(f:Fighter):'none'|'windup'|'strike'|'recover'{
  if(f.action!==Action.Attack)return 'none';
  if(f.action_frame<STARTUP)return 'windup';
  if(f.action_frame<ACTIVE_END)return 'strike';
  return 'recover';
}

export type AnimSelection={state:AnimState; frame:number; phase:ReturnType<typeof attackPhase>; grounded:boolean};

/** Deterministic priority: attack → jump/air → landing → walk → idle. Hitstun uses idle/air pose. */
export function selectFighterAnimation(fighter:FighterId,f:Fighter,tick:number,absolutePhase=false):AnimSelection{
  const mem=memory[fighter];
  const grounded=!!f.grounded;
  if(!mem.wasGrounded&&grounded&&f.action!==Action.Attack&&f.action!==Action.Hurt){
    mem.landUntil=tick+LAND_HOLD_TICKS;
  }
  mem.wasGrounded=grounded;
  const phase=attackPhase(f);
  const moving=Math.abs(f.vx)>WALK_THRESHOLD;

  let state:AnimState='idle';
  let frame=0;

  if(f.action===Action.Attack){
    mem.walking=false;
    state=phase==='windup'?'attackWindup':phase==='strike'?'attackStrike':'attackRecover';
  }else if(f.action===Action.JumpSquat){
    mem.walking=false;
    state='jumpStart';
  }else if(!grounded||f.action===Action.Air||f.action===Action.Respawn){
    mem.walking=false;
    state='jumpAir';
  }else if(tick<=mem.landUntil&&f.action!==Action.Walk&&f.action!==Action.Dash&&f.action!==Action.Run){
    mem.walking=false;
    state='jumpLand';
  }else if(
    f.action===Action.Walk||f.action===Action.Dash||f.action===Action.Run
    ||(f.action===Action.Idle&&grounded&&moving)
  ){
    // Prefer sim Walk/Dash/Run; Idle+velocity covers brief traction without idle/walk flicker.
    // Advance by horizontal travel so cadence tracks ground speed (reduces foot skating).
    // Phase is per-fighter visual memory; rAF cannot accelerate it.
    state='walk';
    const stride=WALK_STRIDE[fighter];
    if(absolutePhase)frame=Math.floor((Math.abs(f.x)/stride)*4)%4;
    else{
      if(!mem.walking)mem.walkDistance=0;
      mem.walking=true;
      mem.walkDistance+=Math.abs(f.vx);
      frame=Math.floor((mem.walkDistance/stride)*4)%4;
    }
    mem.walking=true;
  }else{
    mem.walking=false;
    state='idle';
  }

  return {state,frame,phase,grounded};
}

export function spriteFor(set:SpriteSet,sel:AnimSelection):HTMLImageElement{
  switch(sel.state){
    case 'walk':return set.walk[sel.frame]??set.idle;
    case 'jumpStart':return set.jumpStart;
    case 'jumpAir':return set.jumpAir;
    case 'jumpLand':return set.jumpLand;
    case 'attackWindup':return set.attackWindup;
    case 'attackStrike':return set.attackStrike;
    case 'attackRecover':return set.attackRecover;
    default:return set.idle;
  }
}

export function debugSpritesEnabled(){
  return typeof location!=='undefined'&&new URLSearchParams(location.search).get('debugSprites')==='1';
}

export function prefersReducedMotion(){
  return typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
}
