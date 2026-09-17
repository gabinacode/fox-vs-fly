export interface InteractiveRenderProfile {
  /** Maximum backing-store pixels per CSS pixel. */
  pixelRatioCap:number;
  /** Zero means draw the lightweight match canvas on every requestAnimationFrame. */
  gameFrameIntervalMs:number;
  /** The expensive 139,662-soma canvas is independent of simulation cadence. */
  brainFrameIntervalMs:number;
  /** Publish scoreboard and signal DOM at a human-readable cadence. */
  uiIntervalMs:number;
  mobile:boolean;
  constrained:boolean;
}

/** Keep simulation timing untouched while reducing redundant presentation work.
 * Asset backing-store resolution stays at the desktop 2× cap so sprites/stage stay sharp. */
export function interactiveRenderProfile(width:number,coarsePointer:boolean,logicalCores=8):InteractiveRenderProfile {
  const mobile=coarsePointer||width<=720;
  const constrained=mobile||(logicalCores>0&&logicalCores<=4);
  return {
    pixelRatioCap:2,
    gameFrameIntervalMs:mobile?1000/30:0,
    brainFrameIntervalMs:1000/(constrained?15:30),
    uiIntervalMs:100,
    mobile,
    constrained,
  };
}
