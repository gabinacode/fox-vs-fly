import {test,expect} from '@playwright/test';
for(const fallback of [false,true])test(`controller population view shows audited membership independent of activity (${fallback?'Canvas':'WebGL2'})`,async({page})=>{
 test.setTimeout(90000);
 if(fallback){await page.setViewportSize({width:390,height:844});await page.addInitScript(()=>{const old=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type:string,...args:unknown[]){return type==='webgl2'?null:old.apply(this,[type,...args] as never);} as typeof old;});}
 await page.goto('/');const play=page.getByRole('button',{name:'PLAY',exact:true});await expect(play).toBeEnabled({timeout:60000});
 const toggle=page.getByRole('checkbox',{name:'Highlight drive & readout populations'}),canvas=page.locator('.brain-view canvas');
 const pixels=async()=>(await canvas.screenshot()).toString('base64');const inactive=await pixels();
 await expect(toggle).not.toBeChecked();await toggle.check();
 await expect(page.getByText('CONTROLLER POPULATIONS',{exact:true})).toBeVisible();
 await expect(page.getByTestId('population-coverage')).toContainText('9,162 positioned / 9,201 total · 39 unpositioned');
 await expect(page.getByTestId('population-coverage')).toContainText('2,011 positioned / 2,022 total · 11 unpositioned');
 await expect(page.getByTestId('population-coverage')).toContainText('independent of current activity');
 await expect(page.locator('.drive-key')).toHaveCSS('background-color','rgb(77, 204, 255)');await expect(page.locator('.readout-key')).toHaveCSS('background-color','rgb(255, 153, 77)');
 const membership=await pixels();expect(membership).not.toBe(inactive);await expect(page.getByTestId('active-count')).toHaveText('0');
 await toggle.uncheck();await expect.poll(pixels).toBe(inactive);
 await toggle.check();await play.click();await expect.poll(async()=>Number(await page.getByTestId('hud').getAttribute('data-tick')),{timeout:20000}).toBeGreaterThan(30);await page.keyboard.press('Escape');
 await expect.poll(pixels).toBe(membership);await page.keyboard.press('r');
 await expect(page.getByTestId('active-count')).toHaveText('0');await expect(toggle).toBeChecked();await expect.poll(pixels).toBe(membership);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/populations-${fallback?'canvas-mobile':'webgl'}.png`,fullPage:true});
});
test('default game automatically loads real wiring and plays with actual model activity',async({page})=>{
 test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');const play=page.getByRole('button',{name:'PLAY',exact:true});await expect(play).toBeEnabled({timeout:60000});
 await expect(page.getByText('MEASURED WIRING · AUTHORED NEURAL MODEL')).toBeVisible();
 await expect(page.getByText('NEURAL FLY',{exact:true})).toBeVisible();await play.click();
 const hud=page.getByTestId('hud');await expect.poll(async()=>Number(await hud.getAttribute('data-tick')),{timeout:20000}).toBeGreaterThan(120);
 await page.keyboard.press('Escape');await expect(hud).toHaveAttribute('data-running','false');
 const tick=Number(await hud.getAttribute('data-tick'));await expect(page.getByTestId('brain-tick')).toHaveText(`f ${tick-1}`);
 await expect.poll(async()=>Number((await page.getByTestId('active-count').innerText()).replaceAll(',',''))).toBeGreaterThan(0);
 const canvas=page.getByLabel('Measured MaleCNS soma positions with model activity',{exact:true});
 const pixels=async()=>(await canvas.screenshot()).toString('base64');
 // Wait for a painted frame after pause, then verify rates do not fade with rAF.
 await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));
 const held=await pixels();await page.waitForTimeout(350);expect(await pixels()).toBe(held);
 await page.screenshot({path:'test-results/neural-game.png',fullPage:true});
 await page.getByRole('button',{name:'RESUME MATCH'}).click();await expect.poll(async()=>Number(await hud.getAttribute('data-tick'))).toBeGreaterThan(tick+10);
 await page.keyboard.press('r');await expect(hud).toHaveAttribute('data-tick','0');await expect(page.getByTestId('active-count')).toHaveText('0');
 await play.click();await expect.poll(async()=>Number(await hud.getAttribute('data-tick'))).toBeGreaterThan(30);expect(errors).toEqual([]);
});
test('default neural preparation failure leaves PLAY disabled and does not silently use dummy',async({page})=>{
 await page.route('**/connectome-graph/catalog.json',r=>r.fulfill({status:503,body:'unavailable'}));await page.goto('/');
 await expect(page.getByRole('alert')).toContainText('Graph catalog download failed');await expect(page.getByRole('button',{name:'PLAY',exact:true})).toBeDisabled();
 await expect(page.getByText('NEURAL FLY',{exact:true})).toBeVisible();
});

test('default neural controller plays with Canvas fallback and fits mobile width',async({page})=>{
 test.setTimeout(90000);await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>{const old=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type:string,...args:unknown[]){if(type==='webgl2')return null;return old.apply(this,[type,...args] as never);} as typeof old;});
 await page.goto('/');await expect(page.getByRole('button',{name:'PLAY',exact:true})).toBeEnabled({timeout:60000});
 await page.getByRole('button',{name:'PLAY',exact:true}).click();await expect.poll(async()=>Number(await page.getByTestId('hud').getAttribute('data-tick')),{timeout:20000}).toBeGreaterThan(30);
 await expect(page.getByTestId('performance')).toContainText('Canvas fallback');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('neural opponent approaches and hits a stationary Fox',async({page})=>{
 test.setTimeout(90000);await page.goto('/');await expect(page.getByRole('button',{name:'PLAY',exact:true})).toBeEnabled({timeout:60000});
 await expect(page.getByText('MODEL ACTIVITY',{exact:true})).toBeVisible();await page.getByRole('button',{name:'PLAY',exact:true}).click();
 await expect.poll(async()=>Number((await page.getByTestId('fox-damage').innerText()).replace('%','')),{timeout:15000}).toBeGreaterThanOrEqual(8);
 await expect.poll(async()=>Number(await page.getByTestId('hud').getAttribute('data-tick')),{timeout:15000}).toBeGreaterThan(240);
 await expect(page.getByTestId('hud')).toHaveAttribute('data-running','true');
 await expect.poll(async()=>Number((await page.getByTestId('performance').innerText()).split(' ')[0]),{timeout:5000}).toBeGreaterThanOrEqual(50);
 const performance=await page.getByTestId('performance').innerText(),brainFps=Number(performance.match(/\/ (\d+) brain fps/)?.[1]??0);
 expect(brainFps).toBeGreaterThanOrEqual(20);
 console.log('Calibrated controller performance:',performance);
 await page.screenshot({path:'test-results/neural-combat.png',fullPage:true});
});
