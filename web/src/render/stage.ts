/** Authored stage map + background art. Simulation STAGE half-width remains authoritative for collision. */
import {runtimeAssetUrl} from '../capture/runtime_url';

/** Matches sim STAGE/SCALE (68000/1000). */
export const STAGE_HALF=68;

/**
 * Measured walkable top surface in `clearing.png` (pixels, inclusive).
 * Top row aligns to world y=0; left/right span maps to ±STAGE_HALF.
 */
export const STAGE_SURFACE={
  file:'clearing.png',
  imageWidth:1024,
  imageHeight:341,
  left:49,
  right:974,
  top:113,
} as const;

export const STAGE_BACKGROUND={
  file:'clearing-background.jpg',
  imageWidth:1024,
  imageHeight:576,
  fallback:'#060b0c',
} as const;

/**
 * Authored renderer-only framing. This is not a Melee camera implementation:
 * it does not feed simulation, collision, blast zones, or controller sensors.
 */
export const GAME_VIEW={
  worldWidth:220,
  groundYRatio:.68,
  stageBottomMargin:10,
} as const;

export type StageDrawRect={x:number;y:number;width:number;height:number;worldScale:number};
export type CoverRect={x:number;y:number;width:number;height:number;scale:number};
export type GameViewTransform={scale:number;originX:number;originY:number};

/** CSS-style object-fit: cover for the arena backdrop. */
export function coverRect(
  imageWidth:number,
  imageHeight:number,
  canvasWidth:number,
  canvasHeight:number,
):CoverRect{
  const scale=Math.max(canvasWidth/imageWidth,canvasHeight/imageHeight);
  const width=imageWidth*scale;
  const height=imageHeight*scale;
  return {x:(canvasWidth-width)/2,y:(canvasHeight-height)/2,width,height,scale};
}

export function stageDrawRect(
  surface:typeof STAGE_SURFACE=STAGE_SURFACE,
  half:number=STAGE_HALF,
):StageDrawRect{
  const surfaceW=surface.right-surface.left+1;
  const worldScale=(half*2)/surfaceW;
  return {
    x:-half-surface.left*worldScale,
    y:-surface.top*worldScale,
    width:surface.imageWidth*worldScale,
    height:surface.imageHeight*worldScale,
    worldScale,
  };
}

/**
 * Fixed authored view calibrated in-browser. The ground plane follows the
 * preferred vertical composition unless that would clip the stage underside.
 */
export function gameViewTransform(
  canvasWidth:number,
  canvasHeight:number,
  view:typeof GAME_VIEW=GAME_VIEW,
):GameViewTransform{
  const scale=canvasWidth/view.worldWidth;
  const stage=stageDrawRect();
  const stageBottom=stage.y+stage.height;
  const preferredY=canvasHeight*view.groundYRatio;
  const highestVisibleY=canvasHeight-view.stageBottomMargin-stageBottom*scale;
  return {
    scale,
    originX:canvasWidth/2,
    originY:Math.min(preferredY,highestVisibleY),
  };
}

function loadImage(src:string,label:string):Promise<HTMLImageElement>{
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.decoding='async';
    img.onload=()=>resolve(img);
    img.onerror=()=>reject(Error(`Failed to load ${label} ${src}`));
    img.src=src;
  });
}

let stageImage:HTMLImageElement|null=null;
let backgroundImage:HTMLImageElement|null=null;
let loading:Promise<{stage:HTMLImageElement;background:HTMLImageElement}>|null=null;

export function stageReady(){return !!stageImage;}
export function backgroundReady(){return !!backgroundImage;}
export function getStageImage(){return stageImage;}
export function getBackgroundImage(){return backgroundImage;}

export async function preloadStage():Promise<{stage:HTMLImageElement;background:HTMLImageElement}>{
  if(stageImage&&backgroundImage)return {stage:stageImage,background:backgroundImage};
  if(!loading){
    const base=runtimeAssetUrl('assets/stages/');
    loading=Promise.all([
      loadImage(new URL(STAGE_SURFACE.file,base).href,'stage map'),
      loadImage(new URL(STAGE_BACKGROUND.file,base).href,'stage background'),
    ]).then(([stage,background])=>{
      stageImage=stage;
      backgroundImage=background;
      return {stage,background};
    });
  }
  return loading;
}

/** Screen-space backdrop behind the world transform. */
export function drawBackground(c:CanvasRenderingContext2D,w:number,h:number,offsetX=0,offsetY=0,zoom=1){
  const img=backgroundImage;
  if(img&&img.naturalWidth&&img.naturalHeight){
    const r=coverRect(img.naturalWidth,img.naturalHeight,w,h);
    c.imageSmoothingEnabled=true;
    c.imageSmoothingQuality='high';
    const width=r.width*zoom,height=r.height*zoom;
    c.drawImage(img,(w-width)/2+offsetX,(h-height)/2+offsetY,width,height);
    return;
  }
  c.fillStyle=STAGE_BACKGROUND.fallback;
  c.fillRect(0,0,w,h);
}

export function drawStage(c:CanvasRenderingContext2D){
  const img=stageImage;
  if(img){
    const r=stageDrawRect();
    c.imageSmoothingEnabled=true;
    c.imageSmoothingQuality='high';
    c.drawImage(img,r.x,r.y,r.width,r.height);
    return;
  }
  // Fallback geometry if preload has not finished.
  c.fillStyle='#2c3733';
  c.beginPath();c.moveTo(-STAGE_HALF,1);c.lineTo(STAGE_HALF,1);c.lineTo(55,9);c.lineTo(-55,9);c.closePath();c.fill();
  c.strokeStyle='#c3d4b7';c.lineWidth=.65;c.beginPath();c.moveTo(-STAGE_HALF,0);c.lineTo(STAGE_HALF,0);c.stroke();
}
