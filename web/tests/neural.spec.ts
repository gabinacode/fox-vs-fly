import {test,expect} from '@playwright/test';
test('default game automatically loads real wiring and plays with actual model activity',async({page})=>{
 test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');const play=page.getByRole('button',{name:'PLAY',exact:true});await expect(play).toBeEnabled({timeout:60000});
 await expect(page.getByText('MEASURED WIRING · AUTHORED NEURAL MODEL')).toBeVisible();
 await expect(page.getByText('NEURAL CPU',{exact:true})).toBeVisible();await play.click();
 const hud=page.getByTestId('hud');await expect.poll(async()=>Number(await hud.getAttribute('data-tick')),{timeout:20000}).toBeGreaterThan(120);
 await page.keyboard.press('Escape');await expect(hud).toHaveAttribute('data-running','false');
 const tick=Number(await hud.getAttribute('data-tick'));await expect(page.getByTestId('brain-tick')).toHaveText(`f ${tick-1}`);
 await expect.poll(async()=>Number((await page.getByTestId('active-count').innerText()).replaceAll(',',''))).toBeGreaterThan(0);
 await page.screenshot({path:'test-results/neural-game.png',fullPage:true});
 await page.getByRole('button',{name:'RESUME MATCH'}).click();await expect.poll(async()=>Number(await hud.getAttribute('data-tick'))).toBeGreaterThan(tick+10);
 await page.keyboard.press('r');await expect(hud).toHaveAttribute('data-tick','0');await expect(page.getByTestId('active-count')).toHaveText('0');
 await play.click();await expect.poll(async()=>Number(await hud.getAttribute('data-tick'))).toBeGreaterThan(30);expect(errors).toEqual([]);
});
test('default neural preparation failure leaves PLAY disabled and does not silently use dummy',async({page})=>{
 await page.route('**/connectome-graph/catalog.json',r=>r.fulfill({status:503,body:'unavailable'}));await page.goto('/');
 await expect(page.getByRole('alert')).toContainText('Graph catalog download failed');await expect(page.getByRole('button',{name:'PLAY',exact:true})).toBeDisabled();
 await expect(page.getByText('NEURAL CPU',{exact:true})).toBeVisible();
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
 console.log('Calibrated controller performance:',await page.getByTestId('performance').innerText());
 await page.screenshot({path:'test-results/neural-combat.png',fullPage:true});
});
