import type {Snapshot,Fighter} from '../wasm/sim';
export function drawGame(canvas:HTMLCanvasElement,s:Snapshot){
 const dpr=Math.min(devicePixelRatio,2),w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
 if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
 const c=canvas.getContext('2d')!;c.setTransform(dpr,0,0,dpr,0,0);c.fillStyle='#141b1b';c.fillRect(0,0,w,h);
 const scale=w/240,ox=w/2,oy=h*.70;
 c.strokeStyle='#22302e';c.lineWidth=1;for(let x=ox%40;x<w;x+=40){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}for(let y=oy%40;y<h;y+=40){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
 const glow=c.createRadialGradient(ox,oy,10,ox,oy,w*.65);glow.addColorStop(0,'#334b3b66');glow.addColorStop(1,'#141b1b00');c.fillStyle=glow;c.fillRect(0,0,w,h);
 c.save();c.translate(ox,oy);c.scale(scale,scale);
 c.fillStyle='#2c3733';c.beginPath();c.moveTo(-68,1);c.lineTo(68,1);c.lineTo(55,9);c.lineTo(-55,9);c.closePath();c.fill();
 c.strokeStyle='#c3d4b7';c.lineWidth=.65;c.beginPath();c.moveTo(-68,0);c.lineTo(68,0);c.stroke();
 c.strokeStyle='#62745d';c.lineWidth=.3;for(let i=-55;i<=55;i+=11){c.beginPath();c.moveTo(i,2);c.lineTo(i+5,7);c.stroke();}
 const fighter=(f:Fighter,isFly:boolean)=>{
  if(!f.stocks)return;c.save();c.translate(f.x,-f.y);if(f.invulnerable>0)c.globalAlpha=s.tick%8<4?.45:.9;
  c.fillStyle='#0005';c.beginPath();c.ellipse(0,f.y,5,1.3,0,0,Math.PI*2);c.fill();
  c.scale(f.facing,1);const bob=f.grounded?Math.sin(s.tick*.5)*Math.min(Math.abs(f.vx),1)*.7:0;c.translate(0,bob);
  if(f.hitlag){c.strokeStyle='#edf6c8';c.lineWidth=.7;for(let i=0;i<8;i++){const a=i*Math.PI/4;c.beginPath();c.moveTo(Math.cos(a)*9,-7+Math.sin(a)*9);c.lineTo(Math.cos(a)*13,-7+Math.sin(a)*13);c.stroke();}}
  if(isFly){
   c.fillStyle='#c4e3d688';for(const side of [-1,1]){c.save();c.translate(-1,-10);c.rotate(side*(.5+Math.sin(s.tick*2)*.18));c.beginPath();c.ellipse(-side*4,-3,3,7,.5*side,0,Math.PI*2);c.fill();c.restore();}
   c.fillStyle='#bdcf8a';c.beginPath();c.ellipse(-1,-6,4,5,-.3,0,Math.PI*2);c.fill();c.fillStyle='#485546';c.fillRect(-4,-5,6,1);c.fillRect(-3,-3,4,.7);
   c.fillStyle='#dbe8a1';c.beginPath();c.arc(2,-11,4,0,Math.PI*2);c.fill();c.fillStyle='#e8876a';c.beginPath();c.ellipse(4,-11,2.3,3,0,0,Math.PI*2);c.fill();c.fillStyle='#2c3027';c.fillRect(4,-12,.6,1);
   c.strokeStyle='#c4d491';c.lineWidth=.65;for(const y of [-5,-3]){c.beginPath();c.moveTo(-1,y);c.lineTo(-6,y+2);c.lineTo(-7,y+4);c.moveTo(1,y);c.lineTo(5,y+2);c.lineTo(6,y+4);c.stroke();}
  }else{
   c.fillStyle='#c4744e';c.beginPath();c.moveTo(-3,-5);c.lineTo(-11,-9);c.lineTo(-9,-1);c.lineTo(-2,-1);c.fill();c.fillStyle='#e9dbb7';c.beginPath();c.moveTo(-11,-9);c.lineTo(-7,-6);c.lineTo(-9,-1);c.fill();
   c.fillStyle='#e4dfc9';c.fillRect(-3,-10,6,6);c.fillStyle='#73908b';c.fillRect(-3,-4,6,3);c.fillStyle='#cbd6c6';c.fillRect(-4,-1,3,1.5);c.fillRect(2,-1,4,1.5);
   c.fillStyle='#dc9768';c.beginPath();c.moveTo(-4,-10);c.lineTo(-5,-18);c.lineTo(-1,-15);c.lineTo(2,-18);c.lineTo(4,-14);c.lineTo(8,-12);c.lineTo(2,-9);c.closePath();c.fill();c.fillStyle='#f2e5c9';c.beginPath();c.moveTo(1,-12);c.lineTo(8,-12);c.lineTo(2,-9);c.fill();c.fillStyle='#152222';c.fillRect(2,-14,1.5,1);
   c.strokeStyle='#a7c1aa';c.lineWidth=2;c.beginPath();c.moveTo(1,-8);c.lineTo(f.action===6?10:5,-6);c.stroke();
  }
  if(f.action===6){const active=f.action_frame>=5&&f.action_frame<8;c.strokeStyle=active?'#e5ff9c':'#b4d29555';c.lineWidth=active?1.6:.5;c.beginPath();c.arc(6,-6,8,-1.2,1.2);c.stroke();}
  c.restore();
  c.font='600 3.5px monospace';c.textAlign='center';c.fillStyle=isFly?'#c9f28a':'#ebbe95';c.fillText(isFly?'CPU':'YOU',f.x,-f.y-24);
 };
 fighter(s.fox,false);fighter(s.fly,true);c.restore();
 c.font='10px monospace';c.fillStyle='#84968b';c.textAlign='left';c.fillText('THE CLEARING / 001',20,h-20);c.textAlign='right';c.fillText('3 STOCKS · NO ITEMS',w-20,h-20);
}
