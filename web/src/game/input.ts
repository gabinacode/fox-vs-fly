import type {ControllerInput} from '../../../brain/include/types';

/** Stick magnitudes below this are treated as centered (normalized units). */
export const STICK_DEADZONE = 0.18;
/** Vertical gate for jump (up) / fastfall (down) on the analog stick. */
export const STICK_VERTICAL = 0.55;

/**
 * Map a normalized stick vector to sim controls.
 * `ny` uses screen space (positive = down). Horizontal uses a remapped deadzone
 * so partial tilts produce walk-range axes (<600) before dash.
 */
export function mapStick(nx: number, ny: number): {axis: number; jump: boolean; fastfall: boolean} {
  const ax = Math.abs(nx) < STICK_DEADZONE ? 0
    : Math.sign(nx) * Math.min(1, (Math.abs(nx) - STICK_DEADZONE) / (1 - STICK_DEADZONE));
  return {
    axis: Math.round(ax * 1000),
    jump: ny <= -STICK_VERTICAL,
    fastfall: ny >= STICK_VERTICAL,
  };
}

export class KeyboardInput {
  held = new Set<string>();
  pressed = new Set<string>();
  down(code: string) { if (!this.held.has(code)) this.pressed.add(code); this.held.add(code); }
  up(code: string) { this.held.delete(code); }
  clear() { this.held.clear(); this.pressed.clear(); }
  sample(): ControllerInput {
    const has = (k: string) => this.held.has(k) || this.pressed.has(k);
    const value = {
      axis: (Number(has('KeyD')) - Number(has('KeyA'))) * 1000,
      buttons: (has('KeyW') ? 1 : 0) | (has('KeyS') ? 2 : 0) | (has('KeyJ') ? 4 : 0),
    };
    this.pressed.clear();
    return value;
  }
}

/** Merges keyboard with an optional on-screen analog stick + attack button. */
export class PlayerInput {
  private keys = new KeyboardInput();
  private stickX = 0;
  private stickY = 0;
  private stickActive = false;
  private attackHeld = false;
  private attackPressed = false;

  down(code: string) { this.keys.down(code); }
  up(code: string) { this.keys.up(code); }

  /** `nx`/`ny` in [-1, 1]; `ny` positive is down. Inactive clears stick contribution. */
  setStick(nx: number, ny: number, active: boolean) {
    this.stickActive = active;
    if (!active) { this.stickX = 0; this.stickY = 0; return; }
    this.stickX = Math.max(-1, Math.min(1, nx));
    this.stickY = Math.max(-1, Math.min(1, ny));
  }

  setAttack(held: boolean) {
    if (held && !this.attackHeld) this.attackPressed = true;
    this.attackHeld = held;
  }

  clear() {
    this.keys.clear();
    this.stickActive = false;
    this.stickX = 0;
    this.stickY = 0;
    this.attackHeld = false;
    this.attackPressed = false;
  }

  sample(): ControllerInput {
    const kb = this.keys.sample();
    const stick = this.stickActive ? mapStick(this.stickX, this.stickY) : {axis: 0, jump: false, fastfall: false};
    const attack = this.attackHeld || this.attackPressed;
    this.attackPressed = false;
    const touchButtons = (stick.jump ? 1 : 0) | (stick.fastfall ? 2 : 0) | (attack ? 4 : 0);
    return {
      axis: this.stickActive ? stick.axis : kb.axis,
      buttons: kb.buttons | touchButtons,
    };
  }
}
