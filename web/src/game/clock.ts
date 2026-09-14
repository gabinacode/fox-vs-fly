/** Wall-time pacing only. The C++ simulation always advances exactly one frame. */
export class FixedClock {
 debt=0;last=0;
 reset(now:number){this.debt=0;this.last=now;}
 /** Advance wall time without adding schedule debt (e.g. while blocked on the neural worker). */
 mark(now:number){this.last=now;}
 accrue(now:number){this.debt+=Math.max(0,now-this.last);this.last=now;return this.debt<=1500;}
 ready(){return this.debt>=1000/60;}
 consume(){this.debt-=1000/60;}
}
