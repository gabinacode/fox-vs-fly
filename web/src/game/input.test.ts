import {it, expect} from 'vitest';
import {KeyboardInput, PlayerInput, mapStick, STICK_DEADZONE, STICK_VERTICAL} from './input';
import {FixedClock} from './clock';

it('captures a quick tap, simultaneous controls and blur cleanup', () => {
  const k = new KeyboardInput();
  k.down('KeyW'); k.up('KeyW');
  expect(k.sample().buttons).toBe(1);
  expect(k.sample().buttons).toBe(0);
  k.down('KeyD'); k.down('KeyJ');
  expect(k.sample()).toEqual({axis: 1000, buttons: 4});
  k.clear();
  expect(k.sample()).toEqual({axis: 0, buttons: 0});
});

it('paces frames independently and never consumes unrequested frames', () => {
  const c = new FixedClock();
  c.reset(0); c.accrue(50);
  let n = 0;
  while (c.ready()) { c.consume(); n++; }
  expect(n).toBe(2);
  c.accrue(51);
  expect(c.ready()).toBe(true);
  c.consume();
  expect(c.ready()).toBe(false);
  expect(c.accrue(3000)).toBe(false);
});

it('worker waits satisfy at most one frame without accumulating catch-up debt', () => {
  const c = new FixedClock();
  c.reset(0);
  c.wait(800);
  expect(c.debt).toBeCloseTo(1000 / 60);
  c.consume();
  expect(c.ready()).toBe(false);
  c.wait(3000);
  expect(c.debt).toBeCloseTo(1000 / 60);
});

it('maps analog stick deadzone, walk range, jump and fastfall gates', () => {
  expect(mapStick(0, 0)).toEqual({axis: 0, jump: false, fastfall: false});
  expect(mapStick(STICK_DEADZONE * 0.5, 0).axis).toBe(0);
  expect(mapStick(1, 0)).toEqual({axis: 1000, jump: false, fastfall: false});
  expect(mapStick(-1, 0).axis).toBe(-1000);
  const walk = mapStick(0.4, 0).axis;
  expect(Math.abs(walk)).toBeGreaterThan(0);
  expect(Math.abs(walk)).toBeLessThan(600);
  expect(mapStick(0, -STICK_VERTICAL).jump).toBe(true);
  expect(mapStick(0, STICK_VERTICAL).fastfall).toBe(true);
  expect(mapStick(0, -STICK_VERTICAL + 0.01).jump).toBe(false);
});

it('merges touch stick and hit with keyboard, and latches a quick attack tap', () => {
  const p = new PlayerInput();
  p.setStick(1, 0, true);
  expect(p.sample()).toEqual({axis: 1000, buttons: 0});
  p.setAttack(true); p.setAttack(false);
  expect(p.sample().buttons).toBe(4);
  expect(p.sample().buttons).toBe(0);
  p.setStick(0, -1, true);
  p.down('KeyJ');
  expect(p.sample()).toEqual({axis: 0, buttons: 5});
  p.clear();
  expect(p.sample()).toEqual({axis: 0, buttons: 0});
  p.down('KeyD');
  expect(p.sample().axis).toBe(1000);
  p.setStick(0.2, 0, true);
  expect(Math.abs(p.sample().axis)).toBeLessThan(Math.abs(1000));
});
