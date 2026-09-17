import {describe,expect,it} from 'vitest';
import {
  GAME_VIEW,
  STAGE_BACKGROUND,
  STAGE_HALF,
  STAGE_SURFACE,
  coverRect,
  gameViewTransform,
  stageDrawRect,
} from './stage';

describe('stage map alignment',()=>{
  it('maps measured top surface to ±STAGE_HALF at world y=0',()=>{
    const r=stageDrawRect();
    const scale=r.worldScale;
    const left=r.x+STAGE_SURFACE.left*scale;
    const right=r.x+(STAGE_SURFACE.right+1)*scale;
    const top=r.y+STAGE_SURFACE.top*scale;
    expect(left).toBeCloseTo(-STAGE_HALF,6);
    expect(right).toBeCloseTo(STAGE_HALF,6);
    expect(top).toBeCloseTo(0,6);
    expect(r.width).toBeCloseTo(STAGE_SURFACE.imageWidth*scale,6);
    expect(r.height).toBeCloseTo(STAGE_SURFACE.imageHeight*scale,6);
  });

  it('keeps underside below the walkable plane',()=>{
    const r=stageDrawRect();
    const bottom=r.y+r.height;
    expect(bottom).toBeGreaterThan(0);
  });
});

describe('stage background cover',()=>{
  it('covers a wide canvas without letterboxing',()=>{
    const r=coverRect(STAGE_BACKGROUND.imageWidth,STAGE_BACKGROUND.imageHeight,800,300);
    expect(r.width).toBeGreaterThanOrEqual(800);
    expect(r.height).toBeGreaterThanOrEqual(300);
    expect(r.x).toBeLessThanOrEqual(0);
    expect(r.x+r.width).toBeGreaterThanOrEqual(800);
    expect(r.y).toBeLessThanOrEqual(0);
    expect(r.y+r.height).toBeGreaterThanOrEqual(300);
  });

  it('covers a tall canvas without pillarboxing',()=>{
    const r=coverRect(STAGE_BACKGROUND.imageWidth,STAGE_BACKGROUND.imageHeight,400,700);
    expect(r.width).toBeGreaterThanOrEqual(400);
    expect(r.height).toBeGreaterThanOrEqual(700);
  });
});

describe('renderer-only game view',()=>{
  it('uses the calibrated horizontal world span and centered origin',()=>{
    const view=gameViewTransform(660,340);
    expect(view.scale).toBeCloseTo(660/GAME_VIEW.worldWidth,10);
    expect(view.originX).toBe(330);
    expect(STAGE_HALF*2*view.scale).toBeCloseTo(408,6);
  });

  it.each([[660,340],[358,310],[800,390]])(
    'keeps the complete stage art visible at %ix%i',
    (width,height)=>{
      const view=gameViewTransform(width,height);
      const stage=stageDrawRect();
      const bottom=view.originY+(stage.y+stage.height)*view.scale;
      expect(bottom).toBeLessThanOrEqual(height-GAME_VIEW.stageBottomMargin+1e-8);
      expect(view.originY).toBeLessThanOrEqual(height*GAME_VIEW.groundYRatio+1e-8);
    },
  );
});
