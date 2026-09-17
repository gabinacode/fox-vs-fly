import {describe,expect,it,beforeEach} from 'vitest';
import {
  Action,
  ACTIVE_END,
  STARTUP,
  WALK_STRIDE,
  attackPhase,
  resetFighterSpriteVisuals,
  selectFighterAnimation,
  spriteImageLeft,
  spriteImageTop,
  SPRITE_DRAW,
  type AnimSelection,
} from './sprites';
import type {Fighter} from '../wasm/sim';

const base=():Fighter=>({
  x:0,y:0,vx:0,vy:0,facing:1,grounded:1,action:Action.Idle,action_frame:0,
  damage:0,stocks:3,hitlag:0,hitstun:0,jumps:2,invulnerable:0,
});

function sel(partial:Partial<Fighter>,tick=0,id:'fox'|'fly'='fox'):AnimSelection{
  return selectFighterAnimation(id,{...base(),...partial},tick);
}

describe('fighter sprite animation selection',()=>{
  beforeEach(()=>resetFighterSpriteVisuals());

  it('maps idle, walk and attack phases from sim state',()=>{
    expect(sel({action:Action.Idle,vx:0}).state).toBe('idle');
    expect(sel({action:Action.Walk,vx:1.2}).state).toBe('walk');
    expect(sel({action:Action.Dash,vx:2}).state).toBe('walk');
    expect(sel({action:Action.Run,vx:2.5}).state).toBe('walk');
    expect(sel({action:Action.Attack,action_frame:0}).state).toBe('attackWindup');
    expect(sel({action:Action.Attack,action_frame:STARTUP}).state).toBe('attackStrike');
    expect(sel({action:Action.Attack,action_frame:ACTIVE_END}).state).toBe('attackRecover');
    expect(attackPhase({...base(),action:Action.Attack,action_frame:6})).toBe('strike');
  });

  it('uses jumpsquat / air / landing hold without overriding attacks',()=>{
    expect(sel({action:Action.JumpSquat,grounded:1}).state).toBe('jumpStart');
    expect(sel({action:Action.Air,grounded:0}).state).toBe('jumpAir');
    // Land: previous air memory then grounded idle.
    selectFighterAnimation('fox',{...base(),action:Action.Air,grounded:0},10);
    expect(sel({action:Action.Idle,grounded:1,vx:0},11).state).toBe('jumpLand');
    expect(sel({action:Action.Attack,action_frame:5,grounded:1},12).state).toBe('attackStrike');
  });

  it('keeps hitstun on idle/air poses and avoids idle/walk flicker near zero velocity',()=>{
    expect(sel({action:Action.Hurt,hitstun:8,grounded:1,vx:0}).state).toBe('idle');
    resetFighterSpriteVisuals();
    expect(sel({action:Action.Hurt,hitstun:8,grounded:0}).state).toBe('jumpAir');
    resetFighterSpriteVisuals();
    expect(sel({action:Action.Idle,vx:.2}).state).toBe('idle');
    expect(sel({action:Action.Idle,vx:.5}).state).toBe('walk');
  });

  it('advances walk frames by horizontal travel, not wall-clock tick',()=>{
    const stride=WALK_STRIDE.fox;
    const frames:number[]=[];
    for(let t=0;t<20;t++)frames.push(sel({action:Action.Walk,vx:1.5},t).frame);
    expect(new Set(frames).size).toBeGreaterThan(1);
    expect(Math.max(...frames)).toBeLessThan(4);
    // One full cycle after stride world-units of travel at vx=1.5 ⇒ stride/1.5 ticks.
    resetFighterSpriteVisuals();
    const ticksPerCycle=Math.ceil(stride/1.5);
    const seen=new Set<number>();
    for(let t=0;t<ticksPerCycle;t++)seen.add(sel({action:Action.Walk,vx:1.5},t).frame);
    expect(seen.has(0)).toBe(true);
    expect(seen.size).toBeGreaterThan(1);
    // Faster travel advances further in the same number of ticks.
    resetFighterSpriteVisuals();
    for(let t=0;t<4;t++)sel({action:Action.Walk,vx:.5},t);
    const slow=sel({action:Action.Walk,vx:.5},4).frame;
    resetFighterSpriteVisuals();
    for(let t=0;t<4;t++)sel({action:Action.Walk,vx:1.75},t);
    const fast=sel({action:Action.Walk,vx:1.75},4).frame;
    expect(fast).not.toBe(slow);
  });

  it('resets walk phase when leaving and re-entering walk',()=>{
    for(let t=0;t<10;t++)sel({action:Action.Walk,vx:1.5},t);
    expect(sel({action:Action.Walk,vx:1.5},10).frame).not.toBe(0);
    sel({action:Action.Idle,vx:0},11);
    expect(sel({action:Action.Walk,vx:1.5},12).frame).toBe(0);
  });
});

describe('fighter sprite ground anchor',()=>{
  it('places the extractor body anchor on the sim root instead of centering attack padding',()=>{
    const fox=SPRITE_DRAW.fox;
    const drawWidth=fox.height*(140/127);
    const left=spriteImageLeft(drawWidth,140,fox.anchorX);
    expect(left+(fox.anchorX/140)*drawWidth).toBeCloseTo(0,10);
    expect(left).not.toBeCloseTo(-drawWidth/2,2);
  });

  it('raises the image so extract PAD sits below the sim root',()=>{
    const fox=SPRITE_DRAW.fox;
    const top=spriteImageTop(fox.height,127,fox.padBottom);
    const padScaled=(fox.padBottom*fox.height)/127;
    expect(top+fox.height-padScaled).toBeCloseTo(0,10);
    expect(top).toBeGreaterThan(-fox.height);
  });

  it('keeps fly feet on the root with the same extract PAD',()=>{
    const fly=SPRITE_DRAW.fly;
    const top=spriteImageTop(fly.height,105,fly.padBottom);
    expect(top+fly.height-(fly.padBottom*fly.height)/105).toBeCloseTo(0,10);
  });
});
