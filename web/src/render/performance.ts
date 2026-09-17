export interface InteractiveRenderProfile {
  /** Maximum backing-store pixels per CSS pixel. */
  pixelRatioCap:number;
  /** Zero means draw on every requestAnimationFrame. */
  frameIntervalMs:number;
  /** Zero means publish every simulation snapshot to React. */
  uiIntervalMs:number;
  mobile:boolean;
}

/** Keep simulation timing untouched while reducing presentation work on phones. */
export function interactiveRenderProfile(width:number,coarsePointer:boolean):InteractiveRenderProfile {
  const mobile=coarsePointer||width<=720;
  return mobile
    ?{pixelRatioCap:1,frameIntervalMs:1000/30,uiIntervalMs:100,mobile:true}
    :{pixelRatioCap:2,frameIntervalMs:0,uiIntervalMs:0,mobile:false};
}
