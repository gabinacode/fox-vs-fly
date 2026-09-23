import type {Snapshot,Fighter} from '../wasm/sim';
import {
  debugSpritesEnabled,
  fighterSpritesReady,
  getFighterAtlas,
  prefersReducedMotion,
  selectFighterAnimation,
  spriteFor,
  spriteImageLeft,
  spriteImageTop,
  SPRITE_DRAW,
  type FighterId,
  type AnimSelection,
} from './sprites';
import {drawBackground,drawStage,gameViewTransform} from './stage';
import type {GameCameraState} from '../capture/camera';

function drawFighterSprite(
  c:CanvasRenderingContext2D,
  id:FighterId,
  f:Fighter,
  tick:number,
  label:string,
  labelColor:string,
  absolutePhase=false,
){
  if(!f.stocks)return;
  const atlas=getFighterAtlas();
  if(!atlas)return;
  const sel=selectFighterAnimation(id,f,tick,absolutePhase);
  const img=spriteFor(atlas[id],sel);
  const drawH=SPRITE_DRAW[id].height;
  const drawW=drawH*(img.naturalWidth/img.naturalHeight);
  const imageLeft=spriteImageLeft(drawW,img.naturalWidth,SPRITE_DRAW[id].anchorX);
  const imageTop=spriteImageTop(drawH,img.naturalHeight,SPRITE_DRAW[id].padBottom);
  const reduced=prefersReducedMotion();

  c.save();
  c.translate(f.x,-f.y);
  if(f.invulnerable>0)c.globalAlpha=tick%8<4?.45:.9;

  if(f.hitlag){
    c.strokeStyle='#edf6c8';c.lineWidth=.7;
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4;
      c.beginPath();
      c.moveTo(Math.cos(a)*9,-drawH*.45+Math.sin(a)*9);
      c.lineTo(Math.cos(a)*13,-drawH*.45+Math.sin(a)*13);
      c.stroke();
    }
  }

  // Flip around the fighter root so facing does not translate the sprite.
  c.scale(f.facing||1,1);

  let bob=0,wing=0;
  if(!reduced&&sel.state==='idle'&&f.grounded){
    if(id==='fox')bob=Math.sin(tick*.08)*.12;
    else wing=Math.sin(tick*.55)*.03;
  }

  c.translate(0,bob);
  if(wing){c.translate(0,-drawH*.55);c.rotate(wing);c.translate(0,drawH*.55);}

  // Opaque feet sit on the sim root; extract PAD is transparent below content.
  c.imageSmoothingEnabled=true;
  c.imageSmoothingQuality='high';
  c.drawImage(img,imageLeft,imageTop,drawW,drawH);
  c.restore();

  if(label){
    c.font='600 3.5px monospace';c.textAlign='center';c.fillStyle=labelColor;
    c.fillText(label,f.x,-f.y+imageTop-3);
  }

  if(debugSpritesEnabled())drawSpriteDebug(c,f,sel,id,imageTop);
}

function drawSpriteDebug(c:CanvasRenderingContext2D,f:Fighter,sel:AnimSelection,id:FighterId,imageTop:number){
  const lines=[
    `${id} ${sel.state}${sel.state==='walk'?`#${sel.frame+1}`:''}`,
    `face ${f.facing>0?'R':'L'}  gnd ${sel.grounded?'Y':'N'}`,
    `act ${f.action}.${f.action_frame}  atk ${sel.phase}`,
  ];
  c.save();
  c.font='2.8px monospace';c.textAlign='center';c.fillStyle='#9dffc8';
  lines.forEach((line,i)=>c.fillText(line,f.x,-f.y+imageTop-8-i*3.4));
  // Root crosshair
  c.strokeStyle='#9dffc888';c.lineWidth=.35;
  c.beginPath();c.moveTo(f.x-2,-f.y);c.lineTo(f.x+2,-f.y);c.moveTo(f.x,-f.y-2);c.lineTo(f.x,-f.y+2);c.stroke();
  c.restore();
}

export function drawGame(canvas:HTMLCanvasElement,s:Snapshot,opts?:{clean?:boolean;camera?:GameCameraState;pixelRatioCap?:number}){
  const dpr=Math.min(devicePixelRatio,opts?.pixelRatioCap??2),w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  const c=canvas.getContext('2d')!;c.setTransform(dpr,0,0,dpr,0,0);
  const camera=opts?.camera;
  drawBackground(c,w,h,camera?.parallaxX??0,camera?.parallaxY??0,camera?1.035+(camera.zoom-1)*.18:1);
  const view=gameViewTransform(w,h);
  c.save();
  const zoom=camera?.zoom??1,centerX=camera?.centerX??0;
  c.translate(view.originX,view.originY);
  if(camera?.roll)c.rotate(camera.roll);
  // Tiny vertical shear separates the plate from the background without changing game state.
  if(camera)c.transform(1,.006*(camera.zoom-1),0,1,0,0);
  c.scale(view.scale*zoom,view.scale*zoom);c.translate(-centerX,camera?.panY??0);
  drawStage(c);
  if(fighterSpritesReady()){
    drawFighterSprite(c,'fox',s.fox,s.tick,opts?.clean?'':'YOU',opts?.clean?'':'#ebbe95',!!camera);
    drawFighterSprite(c,'fly',s.fly,s.tick,opts?.clean?'':'FLY',opts?.clean?'':'#c9f28a',!!camera);
  }
  c.restore();
  if(camera?.impact){
    const vignette=c.createRadialGradient(w*.5,h*.53,w*.12,w*.5,h*.53,w*.72);
    vignette.addColorStop(0,'rgba(0,0,0,0)');vignette.addColorStop(1,`rgba(0,0,0,${.12*camera.impact})`);
    c.fillStyle=vignette;c.fillRect(0,0,w,h);
  }
  if(!opts?.clean){
    c.font='10px monospace';c.fillStyle='#9ab0a8';c.textAlign='left';c.fillText('THE CLEARING / 001',20,h-20);
  }
}
