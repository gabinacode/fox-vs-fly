import React, {useRef, useState} from 'react';
import type {PlayerInput} from '../game/input';

const RADIUS = 48;

function clampStick(dx: number, dy: number) {
  const mag = Math.hypot(dx, dy);
  if (mag <= RADIUS) return {x: dx, y: dy, nx: dx / RADIUS, ny: dy / RADIUS};
  const s = RADIUS / mag;
  return {x: dx * s, y: dy * s, nx: (dx * s) / RADIUS, ny: (dy * s) / RADIUS};
}

/** On-screen analog stick (left) + HIT button (right) for phone play. */
export function TouchControls({input, visible}: {input: PlayerInput; visible: boolean}) {
  const baseRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({x: 0, y: 0});
  const [hit, setHit] = useState(false);
  const stickPointer = useRef<number | null>(null);

  if (!visible) return null;

  const updateStick = (clientX: number, clientY: number) => {
    const el = baseRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const mapped = clampStick(clientX - (r.left + r.width / 2), clientY - (r.top + r.height / 2));
    setKnob({x: mapped.x, y: mapped.y});
    input.setStick(mapped.nx, mapped.ny, true);
  };

  const endStick = (pointerId: number) => {
    if (stickPointer.current !== pointerId) return;
    stickPointer.current = null;
    setKnob({x: 0, y: 0});
    input.setStick(0, 0, false);
  };

  const endHit = () => {
    setHit(false);
    input.setAttack(false);
  };

  return (
    <div className="touch-pad" data-testid="touch-pad" aria-label="Touch controls">
      <div
        ref={baseRef}
        className="touch-stick"
        data-testid="touch-stick"
        role="application"
        aria-label="Move stick. Tilt up to jump, down to fastfall."
        onPointerDown={e => {
          e.preventDefault();
          e.stopPropagation();
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          stickPointer.current = e.pointerId;
          updateStick(e.clientX, e.clientY);
        }}
        onPointerMove={e => {
          if (stickPointer.current !== e.pointerId) return;
          e.preventDefault();
          updateStick(e.clientX, e.clientY);
        }}
        onPointerUp={e => { e.preventDefault(); endStick(e.pointerId); }}
        onPointerCancel={e => endStick(e.pointerId)}
      >
        <i className="touch-knob" style={{transform: `translate(${knob.x}px, ${knob.y}px)`}} />
      </div>
      <div
        className={`touch-hit${hit ? ' pressed' : ''}`}
        data-testid="touch-hit"
        role="button"
        tabIndex={-1}
        aria-label="Attack"
        onPointerDown={e => {
          e.preventDefault();
          e.stopPropagation();
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          setHit(true);
          input.setAttack(true);
        }}
        onPointerUp={e => { e.preventDefault(); endHit(); }}
        onPointerCancel={endHit}
      >
        HIT
      </div>
    </div>
  );
}
