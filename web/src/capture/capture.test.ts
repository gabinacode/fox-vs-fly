import {it, expect} from 'vitest';
import {expandInputRle} from './types';
import {getCapturePreset,getCaptureShot,CAPTURE_PRESET_NAMES,CAPTURE_SHOT_NAMES} from './presets';
import {parseCaptureFlags, isCaptureMode} from './config';
import {ScriptedInput} from './scripted_input';
import {brainCameraState,gameCameraState} from './camera';

it('expands capture RLE into a deterministic Fox timeline', () => {
  expect(expandInputRle([[1000, 0, 2], [-1000, 4, 1]])).toEqual([
    {axis: 1000, buttons: 0},
    {axis: 1000, buttons: 0},
    {axis: -1000, buttons: 4},
  ]);
  expect(() => expandInputRle([[0, 0, 0]])).toThrow(/RLE/);
});

it('hero-sequence preset matches searched feint-L-then-R markers', () => {
  const p = getCapturePreset('hero-sequence');
  expect(p).toBeTruthy();
  expect(p!.id).toBe('feint-L-then-R');
  expect(p!.chain).toBe(true);
  expect(expandInputRle(p!.inputRle)).toHaveLength(168);
  expect(p!.markers.map(m => `${m.id}:${m.tick}`)).toEqual([
    'fox-move:18',
    'fox-approach-visible:19',
    'model-activity-delta:19',
    'model-activity-visible:20',
    'sensory-change:32',
    'sensory-visible:33',
    'motor-change:36',
    'fly-react:36',
    'fly-attack-visible:37',
    'hit-impact:42',
  ]);
  expect(p!.markers.find(m => m.id === 'fly-react')?.kind).toBe('attack');
});

it('lists capture presets used by the LinkedIn edit', () => {
  expect(CAPTURE_PRESET_NAMES).toEqual(
    expect.arrayContaining(['hero-sequence', 'fox-approach', 'fly-attack', 'breathe']),
  );
  expect(CAPTURE_SHOT_NAMES).toEqual(['reveal','approach','brain-response','fly-response','impact','split']);
  expect(getCaptureShot('approach')).toMatchObject({view:'game',startTick:0,endTick:88,camera:'trailer',freezeFlyAfterTick:42});
  expect(getCaptureShot('split')).toMatchObject({view:'split',startTick:8,endTick:63});
  expect(getCaptureShot('split')!.freezeFlyAfterTick).toBeUndefined();
});

it('parses capture query flags without inventing unknown presets as active mode', () => {
  expect(parseCaptureFlags('?capture=hero-sequence&view=brain&debug=1&loop=1&export=1')).toEqual({
    preset: 'hero-sequence',
    shot:null,
    view: 'brain',
    camera:'clean',
    brainCamera:'front',
    debug: true,
    loop: true,
    exportMode: true,
  });
  expect(isCaptureMode(parseCaptureFlags('?capture=hero-sequence'))).toBe(true);
  expect(isCaptureMode(parseCaptureFlags('?capture=not-a-real-preset'))).toBe(false);
  expect(parseCaptureFlags('')).toEqual({
    preset: null,
    shot:null,
    view: 'game',
    camera:'clean',
    brainCamera:'front',
    debug: false,
    loop: false,
    exportMode: false,
  });
});

it('maps shot and camera presets without touching simulation state',()=>{
  expect(parseCaptureFlags('?shot=impact')).toMatchObject({preset:'hero-sequence',shot:'impact',view:'game',camera:'impact'});
  expect(parseCaptureFlags('?shot=brain-response&brainCamera=orbit-subtle')).toMatchObject({view:'brain',brainCamera:'orbit-subtle'});
  const fighter={x:0,y:0,vx:0,vy:0,facing:1,grounded:1,action:0,action_frame:0,damage:0,stocks:3,hitlag:0,hitstun:0,jumps:2,invulnerable:0};
  const snapshot={tick:36,fox:{...fighter,x:-49},fly:{...fighter,x:-27,action:6,hitlag:3},winner:-1,hash:1};
  expect(gameCameraState('impact',snapshot,28,56).impact).toBeGreaterThan(0);
  expect(gameCameraState('still',snapshot,0,1).zoom).toBeCloseTo(3.05);
  expect(gameCameraState('still',snapshot,0,1).panY).toBe(-22);
  expect(parseCaptureFlags('?shot=reveal&camera=still')).toMatchObject({camera:'still'});
  expect(brainCameraState('orbit-subtle',55,56).yaw).toBeCloseTo(.155);
});

it('scripted input advances deterministically and rewinds', () => {
  const s = new ScriptedInput([
    {axis: 1000, buttons: 0},
    {axis: 0, buttons: 4},
  ]);
  expect(s.sample()).toEqual({axis: 1000, buttons: 0});
  expect(s.sample()).toEqual({axis: 0, buttons: 4});
  expect(s.sample()).toEqual({axis: 0, buttons: 4});
  expect(s.exhausted).toBe(true);
  s.rewind();
  expect(s.sample()).toEqual({axis: 1000, buttons: 0});
});
