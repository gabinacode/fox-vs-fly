import type {ControllerInput} from '../../../brain/include/types';

/**
 * Deterministic Fox input stream for capture mode.
 * Indexed by the observation tick Session applies when the neural reply arrives.
 */
export class ScriptedInput {
  private index = 0;
  constructor(readonly timeline: ControllerInput[]) {
    if (!timeline.length) throw Error('Capture timeline is empty');
  }
  down(_code: string) {}
  up(_code: string) {}
  clear() {}
  /** Restart from the beginning after reset / loop. */
  rewind() {
    this.index = 0;
  }
  sample(): ControllerInput {
    const value = this.timeline[Math.min(this.index, this.timeline.length - 1)]!;
    this.index = Math.min(this.index + 1, this.timeline.length);
    return {...value};
  }
  get exhausted() {
    return this.index >= this.timeline.length;
  }
  get position() {
    return this.index;
  }
}
