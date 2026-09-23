export interface InteractiveRenderProfile {
  /** Maximum backing-store pixels per CSS pixel. */
  pixelRatioCap:number;
  /** Zero means draw the lightweight match canvas on every requestAnimationFrame. */
  gameFrameIntervalMs:number;
  /** The expensive 139,662-soma canvas is independent of simulation cadence. */
  brainFrameIntervalMs:number;
  /** Deterministically sampled points let Blink redraw more often at a similar point budget. */
  brainPointStride:number;
  /** Publish scoreboard and signal DOM at a human-readable cadence. */
  uiIntervalMs:number;
  mobile:boolean;
  constrained:boolean;
}

/** True for Blink (Chrome/Edge/Brave). ANGLE point sprites on 139k somas cost far more than Firefox. */
export function blinkPointSpriteHeavy(globalObj:{chrome?:unknown;navigator?:{userAgent?:string;userAgentData?:{brands?:{brand:string}[]}}}=globalThis):boolean {
  if(globalObj.chrome)return true;
  const brands=globalObj.navigator?.userAgentData?.brands;
  if(brands?.some(b=>/Chromium|Google Chrome|Microsoft Edge|Brave/i.test(b.brand)))return true;
  const ua=globalObj.navigator?.userAgent??'';
  return /Chrome\/\d/.test(ua)&&!/Firefox\//.test(ua);
}

/** Keep simulation timing untouched while reducing redundant presentation work.
 * Asset backing-store resolution stays at the desktop 2× cap so sprites/stage stay sharp. */
export function interactiveRenderProfile(width:number,coarsePointer:boolean,logicalCores=8,pointSpriteHeavy=false):InteractiveRenderProfile {
  const mobile=coarsePointer||width<=720;
  const constrained=mobile||pointSpriteHeavy||(logicalCores>0&&logicalCores<=4);
  const lowBudget=mobile||(logicalCores>0&&logicalCores<=4);
  return {
    pixelRatioCap:2,
    // Cap match draws at 60 Hz even on 120 Hz displays; sim target stays 60 Hz.
    gameFrameIntervalMs:mobile?1000/30:1000/60,
    // Blink/ANGLE uses short batches: 30 Hz with 1/6 of the cloud on desktops,
    // and 15 Hz with 2/3 on phones/low-core hosts. This removes the visible 10 Hz cadence.
    brainFrameIntervalMs:1000/(pointSpriteHeavy?(lowBudget?15:30):constrained?15:30),
    brainPointStride:pointSpriteHeavy?(lowBudget?2:6):1,
    uiIntervalMs:100,
    mobile,
    constrained:constrained||pointSpriteHeavy,
  };
}
