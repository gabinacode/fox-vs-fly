import {test,expect} from '@playwright/test';
test('production WASM boots, keyboard moves/jumps/attacks, worker drives HUD, pause/reset',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?controller=dummy');await expect(page.getByRole('button',{name:'PLAY',exact:true})).toBeEnabled();
 await expect(page.getByText('SYNTHETIC CONTROLLER · LIVE DEMO')).toBeVisible();
 await page.screenshot({path:'test-results/ready.png',fullPage:true});
 await page.getByRole('button',{name:'PLAY',exact:true}).click();const hud=page.getByTestId('hud');
 await page.keyboard.down('d');await expect.poll(async()=>Number(await hud.getAttribute('data-fox-x'))).toBeGreaterThan(-20);await page.keyboard.up('d');
 await page.keyboard.press('w');await expect.poll(async()=>Number(await hud.getAttribute('data-fox-y'))).toBeGreaterThan(0);
 await expect.poll(async()=>Number((await page.getByTestId('active-count').innerText()).replaceAll(',',''))).toBeGreaterThan(0);
 await expect.poll(async()=>Number(await hud.getAttribute('data-tick'))).toBeGreaterThan(60);
 // Face and approach the opponent; jumping can leave it behind Fox.
 for(let i=0;i<60;i++){
  const damage=Number((await page.getByTestId('fox-damage').innerText()).replace('%',''))+Number((await page.getByTestId('fly-damage').innerText()).replace('%',''));if(damage>0)break;
  const dx=Number(await hud.getAttribute('data-fly-x'))-Number(await hud.getAttribute('data-fox-x'));
  const toward=dx<0?'a':'d';await page.keyboard.down(toward);await page.keyboard.press('j');await page.waitForTimeout(80);await page.keyboard.up(toward);
 }
 await expect.poll(async()=>Number(await page.getByTestId('fox-damage').innerText().then(s=>s.replace('%','')))+Number(await page.getByTestId('fly-damage').innerText().then(s=>s.replace('%','')))).toBeGreaterThan(0);
 console.log('Browser performance:',await page.getByTestId('performance').innerText());
 await page.screenshot({path:'test-results/playing.png',fullPage:true});
 await page.keyboard.press('Escape');await expect(hud).toHaveAttribute('data-running','false');const tick=await hud.getAttribute('data-tick');await page.waitForTimeout(150);await expect(hud).toHaveAttribute('data-tick',tick!);
 await page.keyboard.press('r');await expect(hud).toHaveAttribute('data-tick','0');await expect(page.getByTestId('active-count')).toHaveText('0');
 await page.getByRole('button',{name:'About the experiment'}).click();await expect(page.getByText('A wiring diagram is only the beginning.')).toBeVisible();expect(errors).toEqual([]);
});
test('WebGL2 fallback still renders and plays',async({page})=>{
 await page.addInitScript(()=>{const old=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type:string,...args:unknown[]){if(type==='webgl2')return null;return old.apply(this,[type,...args] as never);} as typeof old;});
 await page.goto('/?controller=dummy');await expect(page.getByRole('button',{name:'PLAY',exact:true})).toBeEnabled();await expect(page.getByTestId('performance')).toContainText('Canvas fallback');await page.getByRole('button',{name:'PLAY',exact:true}).click();await expect.poll(async()=>Number(await page.getByTestId('hud').getAttribute('data-tick'))).toBeGreaterThan(20);
});
test('WASM loading errors are actionable and never start fake gameplay',async({page})=>{
 await page.route('**/wasm/sim.wasm',route=>route.abort());await page.goto('/?controller=dummy');await expect(page.getByRole('alert')).toContainText('Unable to start');await expect(page.getByRole('button',{name:'PLAY',exact:true})).toBeDisabled();
});
test('worker failure pauses gameplay',async({page})=>{
 await page.addInitScript(()=>{const Original=window.Worker;window.Worker=class extends Original {constructor(url:string|URL,options?:WorkerOptions){super(url,options);setTimeout(()=>this.dispatchEvent(new ErrorEvent('error',{message:'test failure'})),1000);}};});
 await page.goto('/?controller=dummy');await expect(page.getByRole('button',{name:'PLAY',exact:true})).toBeEnabled();await page.getByRole('button',{name:'PLAY',exact:true}).click();await expect(page.getByRole('alert')).toContainText('worker stopped');await expect(page.getByTestId('hud')).toHaveAttribute('data-running','false');
});
test('Fox controls fill the match column under the scoreboard',async({page})=>{
 await page.goto('/?controller=dummy');
 await expect(page.getByRole('button',{name:'PLAY',exact:true})).toBeEnabled();
 const placed=await page.evaluate(()=>{
  const panel=document.querySelector('.arena-panel');
  const board=document.querySelector('.scoreboard');
  const controls=document.querySelector('.controls');
  if(!panel||!board||!controls)return false;
  const p=panel.getBoundingClientRect(),b=board.getBoundingClientRect(),c=controls.getBoundingClientRect();
  return panel.contains(controls)&&c.top>=b.bottom-1&&c.bottom<=p.bottom+2&&c.left>=p.left-1&&c.right<=p.right+2&&c.height>80;
 });
 expect(placed).toBe(true);
 await expect(page.getByRole('region',{name:'Fox controls'})).toContainText('YOUR SIDE OF THE EXPERIMENT');
});
test('sensory and motor bars sit at bottom corners over the brain canvas',async({page})=>{
 await page.goto('/?controller=dummy');
 await expect(page.getByRole('button',{name:'PLAY',exact:true})).toBeEnabled();
 const placed=await page.evaluate(()=>{
  const stage=document.querySelector('.brain-stage');
  const sensory=document.querySelector('.brain-signals.sensory');
  const motor=document.querySelector('.brain-signals.motor');
  const view=document.querySelector('.brain-view');
  const key=document.querySelector('.activity-key');
  if(!stage||!sensory||!motor||!view||!key)return false;
  const s=sensory.getBoundingClientRect(),v=view.getBoundingClientRect(),m=motor.getBoundingClientRect(),k=key.getBoundingClientRect();
  const upper=v.top+v.height*.38;
  return view.contains(sensory)&&view.contains(motor)&&stage.contains(view)
   &&s.left>=v.left-1&&m.right<=v.right+1
   &&s.bottom<=v.bottom+2&&m.bottom<=v.bottom+2
   &&s.top>upper&&m.top>upper
   &&s.right<v.left+v.width*.5&&m.left>v.left+v.width*.5
   &&k.top<v.top+v.height*.25&&k.right<=v.right+2&&k.left>v.left+v.width*.45
   &&k.bottom<=m.top+1;
 });
 expect(placed).toBe(true);
 await expect(page.getByTestId('motor-action')).toBeVisible();
 const widths=await page.evaluate(()=>{
  const motor=document.querySelector('.brain-signals.motor') as HTMLElement;
  const action=document.querySelector('[data-testid="motor-action"]') as HTMLElement;
  const before=motor.getBoundingClientRect().width;
  action.textContent='Left + Jump + Attack + Fastfall';
  const mid=motor.getBoundingClientRect().width;
  action.textContent='Neutral';
  const after=motor.getBoundingClientRect().width;
  return {before,mid,after};
 });
 expect(Math.abs(widths.mid-widths.before)).toBeLessThan(2);
 expect(Math.abs(widths.after-widths.before)).toBeLessThan(2);
});
test('mobile layout keeps a taller fight window and original brain height',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?controller=dummy');
 await expect(page.getByRole('button',{name:'PLAY',exact:true})).toBeEnabled();
 await expect(page.getByTestId('performance')).toContainText('phone mode');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(page.getByRole('region',{name:'Fox controls'})).toBeHidden();
 const layout=await page.evaluate(()=>{
  window.scrollTo(0,0);
  const arena=document.querySelector('.arena')!.getBoundingClientRect();
  const board=document.querySelector('.scoreboard')!.getBoundingClientRect();
  const panel=document.querySelector('.arena-panel')!.getBoundingClientRect();
  const sensory=document.querySelector('.brain-signals.sensory')!.getBoundingClientRect();
  const view=document.querySelector('.brain-view')!.getBoundingClientRect();
  const motor=document.querySelector('.brain-signals.motor')!.getBoundingClientRect();
  const upper=view.top+view.height*.38;
  return {
   arenaTop:arena.top,arenaHeight:arena.height,brainHeight:view.height,brainWidth:view.width,
   scoreboardEndsPanel:Math.abs(board.bottom-panel.bottom)<=2,
   bottomCorners:sensory.top>upper&&motor.top>upper&&sensory.bottom<=view.bottom+2&&motor.bottom<=view.bottom+2
    &&sensory.left>=view.left-1&&motor.right<=view.right+1&&sensory.right<view.left+view.width*.5&&motor.left>view.left+view.width*.5,
  };
 });
 expect(layout.arenaTop).toBeGreaterThanOrEqual(0);
 expect(layout.arenaHeight).toBeGreaterThanOrEqual(220);
 expect(layout.brainHeight).toBeCloseTo(310,0);
 expect(layout.brainWidth).toBeGreaterThan(160);
 expect(layout.scoreboardEndsPanel).toBe(true);
 expect(layout.bottomCorners).toBe(true);
 await page.screenshot({path:'test-results/mobile.png',fullPage:true});
});
test('mobile browser blur does not pause an active match',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?controller=dummy');
 await expect(page.getByRole('button',{name:'PLAY',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'PLAY',exact:true}).click();
 const hud=page.getByTestId('hud');
 await expect.poll(async()=>Number(await hud.getAttribute('data-tick'))).toBeGreaterThan(5);
 const before=Number(await hud.getAttribute('data-tick'));
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
 await expect(hud).toHaveAttribute('data-running','true');
 await expect.poll(async()=>Number(await hud.getAttribute('data-tick'))).toBeGreaterThan(before);
});
test('mobile page hide pauses safely and resumes when visible without a click',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?controller=dummy');
 await expect(page.getByRole('button',{name:'PLAY',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'PLAY',exact:true}).click();
 const hud=page.getByTestId('hud');
 await expect.poll(async()=>Number(await hud.getAttribute('data-tick'))).toBeGreaterThan(5);
 await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
 await expect(hud).toHaveAttribute('data-running','false');
 const pausedTick=Number(await hud.getAttribute('data-tick'));
 await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));});
 await expect(hud).toHaveAttribute('data-running','true');
 await expect.poll(async()=>Number(await hud.getAttribute('data-tick'))).toBeGreaterThan(pausedTick);
});
test('mobile touch stick moves Fox and HIT attacks',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?controller=dummy');
 await expect(page.getByRole('button',{name:'PLAY',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'PLAY',exact:true}).click();
 const hud=page.getByTestId('hud');
 await expect(page.getByTestId('touch-pad')).toBeVisible();
 const stick=page.getByTestId('touch-stick');
 const box=await stick.boundingBox();
 expect(box).toBeTruthy();
 const startX=Number(await hud.getAttribute('data-fox-x'));
 await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);
 await page.mouse.down();
 await page.mouse.move(box!.x+box!.width*0.9,box!.y+box!.height/2);
 await expect.poll(async()=>Number(await hud.getAttribute('data-fox-x'))).toBeGreaterThan(startX);
 await page.mouse.up();
 const flyStart=Number(await page.getByTestId('fly-damage').innerText().then(s=>s.replace('%','')));
 for(let i=0;i<50;i++){
  const damage=Number(await page.getByTestId('fly-damage').innerText().then(s=>s.replace('%','')));
  if(damage>flyStart)break;
  const dx=Number(await hud.getAttribute('data-fly-x'))-Number(await hud.getAttribute('data-fox-x'));
  const stickBox=(await stick.boundingBox())!;
  const cx=stickBox.x+stickBox.width/2,cy=stickBox.y+stickBox.height/2;
  await page.mouse.move(cx,cy);await page.mouse.down();
  await page.mouse.move(cx+(dx<0?-36:36),cy);await page.waitForTimeout(60);
  await page.mouse.up();
  const hit=page.getByTestId('touch-hit');
  const hb=await hit.boundingBox();
  await page.mouse.click(hb!.x+hb!.width/2,hb!.y+hb!.height/2);
  await page.waitForTimeout(80);
 }
 await expect.poll(async()=>Number(await page.getByTestId('fly-damage').innerText().then(s=>s.replace('%','')))).toBeGreaterThan(flyStart);
 await page.screenshot({path:'test-results/mobile-touch.png',fullPage:true});
});

test('measured geometry loads with explicit synthetic activity and no full graph download',async({page})=>{
 const requested:string[]=[];page.on('request',r=>requested.push(r.url()));await page.goto('/?controller=dummy');await expect(page.getByRole('button',{name:'PLAY',exact:true})).toBeEnabled();
 await expect(page.getByTestId('geometry-status')).toContainText('166,700 retained neurons');await expect(page.getByText('139,662',{exact:true})).toBeVisible();await expect(page.getByText('27,038',{exact:true})).toBeVisible();
 expect(requested.some(u=>/target_indices|row_offsets|weights|connectome-graph\/(chunk|graph)-/.test(u))).toBe(false);
});
test('corrupt geometry falls back visibly and remains playable',async({page})=>{
 await page.route('**/connectome/positions-*.bin',r=>r.fulfill({body:'corrupt'}));await page.goto('/?controller=dummy');await expect(page.getByRole('status')).toContainText('showing synthetic geometry');await page.getByRole('button',{name:'PLAY',exact:true}).click();await expect.poll(async()=>Number(await page.getByTestId('hud').getAttribute('data-tick'))).toBeGreaterThan(20);
});
