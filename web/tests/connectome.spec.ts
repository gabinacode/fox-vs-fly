import {test,expect} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
const catalog=JSON.parse(readFileSync(new URL('../public/connectome-graph/catalog.json',import.meta.url),'utf8'));
test('full measured graph loads in its worker while gameplay continues, then unloads',async({page})=>{
 test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?controller=dummy');await page.getByRole('button',{name:'PLAY',exact:true}).click();
 const workerPromise=page.waitForEvent('worker',w=>w.url().includes('connectome.worker'));
 await page.getByRole('button',{name:'Load connectivity',exact:true}).click();const worker=await workerPromise;
 const status=page.getByTestId('network-status');await expect.poll(async()=>Number(await page.getByTestId('hud').getAttribute('data-tick'))).toBeGreaterThan(30);
 await expect(status).toHaveAttribute('data-state','ready',{timeout:60000});
 const metrics=JSON.parse((await status.getAttribute('data-metrics'))!);
 expect(metrics.nodes).toBe(catalog.nodes);expect(metrics.edges).toBe(catalog.edges);expect(metrics.arrayBytes).toBe(catalog.array_bytes);
 expect(metrics.downloadedBytes).toBe(catalog.download_bytes);expect(metrics.synapticContacts).toBe(124177617);
 expect(metrics.maxStagingBytes).toBeLessThan(3*1024**2);await expect(page.getByTestId('hud')).toHaveAttribute('data-running','true');
 console.log('Full graph worker metrics:',JSON.stringify(metrics));console.log('Gameplay with graph resident:',await page.getByTestId('performance').innerText());
 await page.screenshot({path:'test-results/network-ready.png',fullPage:true});
 const closed=new Promise<void>(resolve=>worker.once('close',resolve));await page.getByRole('button',{name:'Unload network'}).click();await closed;
 await expect(status).toHaveAttribute('data-state','idle');await expect(status).toHaveAttribute('data-metrics','');expect(errors).toEqual([]);
});
test('corrupt graph never becomes ready; retry succeeds without stopping the match',async({page})=>{
 test.setTimeout(90000);await page.route('**/connectome-graph/*.bin',r=>r.fulfill({body:'corrupt'}),{times:1});
 await page.goto('/?controller=dummy');await page.getByRole('button',{name:'PLAY',exact:true}).click();await page.getByRole('button',{name:'Load connectivity',exact:true}).click();
 const status=page.getByTestId('network-status');await expect(status).toHaveAttribute('data-state','error');await expect(status).toContainText('Truncated graph stream');
 await expect(page.getByTestId('hud')).toHaveAttribute('data-running','true');await page.getByRole('button',{name:'Retry network'}).click();
 await expect(status).toHaveAttribute('data-state','ready',{timeout:60000});await page.getByRole('button',{name:'Unload network'}).click();
});
test('cancel terminates pending graph worker and discards late progress',async({page})=>{
 let unblock!:()=>void;const gate=new Promise<void>(resolve=>unblock=resolve);
 await page.route('**/connectome-graph/*.bin',async route=>{await gate;await route.abort().catch(()=>{});});
 await page.goto('/?controller=dummy');await page.getByRole('button',{name:'PLAY',exact:true}).click();
 const workerPromise=page.waitForEvent('worker',w=>w.url().includes('connectome.worker'));
 await page.getByRole('button',{name:'Load connectivity',exact:true}).click();const worker=await workerPromise;
 await expect(page.getByTestId('network-status')).toHaveAttribute('data-state','loading');
 const closed=new Promise<void>(resolve=>worker.once('close',resolve));await page.getByRole('button',{name:'Cancel preparation'}).click();await closed;unblock();
 await expect(page.getByTestId('network-status')).toHaveAttribute('data-state','idle');await expect(page.getByTestId('hud')).toHaveAttribute('data-running','true');
 await expect(page.getByRole('button',{name:'Load connectivity',exact:true})).toBeEnabled();
});

test('browser LIF benchmark replays headless traces, stops, reruns and leaves gameplay running',async({page})=>{
 test.setTimeout(120000);await page.goto('/?controller=dummy');await page.getByRole('button',{name:'PLAY',exact:true}).click();
 await page.getByRole('button',{name:'Load connectivity',exact:true}).click();
 await expect(page.getByTestId('network-status')).toHaveAttribute('data-state','ready',{timeout:60000});
 const panel=page.getByTestId('neural-experiment');await page.getByRole('button',{name:'Run neural benchmark'}).click();
 await expect(panel).toHaveAttribute('data-state','running');await page.getByRole('button',{name:'Stop experiment'}).click();
 await expect(panel).toHaveAttribute('data-state','idle',{timeout:10000});
 await expect(page.getByTestId('network-status')).toHaveAttribute('data-state','ready');
 const tick=Number(await page.getByTestId('hud').getAttribute('data-tick'));
 await page.getByRole('button',{name:'Run neural benchmark'}).click();
 await expect(panel).toHaveAttribute('data-state','done',{timeout:60000});
 const result=JSON.parse((await panel.getAttribute('data-result'))!);
 expect(result.rows.map((r:{hash:number})=>r.hash)).toEqual([1552838989,3852583875,88130405]);
 expect(result.rows.map((r:{spikes:number})=>r.spikes)).toEqual([0,488482,6668000]);
 expect(result.modelBytes).toBe(3167300);expect(result.inputBytes).toBe(666800);
 expect(Number(await page.getByTestId('hud').getAttribute('data-tick'))).toBeGreaterThan(tick+60);
 await expect(page.getByTestId('hud')).toHaveAttribute('data-running','true');
 console.log('Browser LIF:',JSON.stringify(result));console.log('Gameplay during LIF:',await page.getByTestId('performance').innerText());
 await page.screenshot({path:'test-results/neural-benchmark.png',fullPage:true});
 await page.getByRole('button',{name:'Run neural benchmark'}).click();await page.getByRole('button',{name:'Unload network'}).click();
 await expect(page.getByTestId('network-status')).toHaveAttribute('data-state','idle');await expect(panel).toHaveCount(0);
});

test('controlled comparisons preserve baseline, disable propagation and report late activity',async({page})=>{
 test.setTimeout(90000);await page.goto('/?controller=dummy');await page.getByRole('button',{name:'PLAY',exact:true}).click();
 await page.getByRole('button',{name:'Load connectivity',exact:true}).click();
 await expect(page.getByTestId('network-status')).toHaveAttribute('data-state','ready',{timeout:60000});
 await page.getByLabel('Experiment suite').selectOption('controls');await page.getByRole('button',{name:'Run neural benchmark'}).click();
 const panel=page.getByTestId('neural-experiment');await expect(page.getByLabel('Experiment suite')).toBeDisabled();
 await expect(panel).toHaveAttribute('data-state','done',{timeout:60000});
 const result=JSON.parse((await panel.getAttribute('data-result'))!);expect(result.suite).toBe('controls');
 expect(result.rows[0].hash).toBe(3852583875);expect(result.rows[0].spikes).toBe(488482);
 expect(result.rows[1].spikes).toBe(1667*40);expect(result.rows[1].lateSpikes).toBe(1667*20);
 expect(result.rows[2].hash).not.toBe(result.rows[0].hash);expect(result.rows[3].hash).not.toBe(result.rows[0].hash);
 console.log('Controlled comparisons:',JSON.stringify(result));
 await page.screenshot({path:'test-results/neural-controls.png',fullPage:true});
 await expect(page.getByTestId('hud')).toHaveAttribute('data-running','true');
 await page.getByLabel('Experiment suite').selectOption('throughput');await expect(panel).toHaveAttribute('data-result','');
 await page.getByRole('button',{name:'Unload network'}).click();
});

test('long pulse sensitivity preserves short response, bins counts and extinguishes disconnected drive',async({page})=>{
 test.setTimeout(120000);await page.goto('/?controller=dummy');await page.getByRole('button',{name:'PLAY',exact:true}).click();
 await page.getByRole('button',{name:'Load connectivity',exact:true}).click();
 await expect(page.getByTestId('network-status')).toHaveAttribute('data-state','ready',{timeout:60000});
 await page.getByLabel('Experiment suite').selectOption('stability');await page.getByRole('button',{name:'Run neural benchmark'}).click();
 const panel=page.getByTestId('neural-experiment');await expect(panel).toHaveAttribute('data-state','done',{timeout:90000});
 const result=JSON.parse((await panel.getAttribute('data-result'))!);expect(result.suite).toBe('stability');
 for(const row of result.rows){expect(row.ticks).toBe(600);expect(row.spikeBins.length).toBe(10);
  expect(row.spikeBins.reduce((a:number,b:number)=>a+b,0)).toBe(row.spikes);expect(row.spikeBins[9]).toBe(row.lateSpikes);}
 expect(result.rows[0].spikeBins.slice(0,2)).toEqual([153059,240944]);
 expect(result.rows[1].spikes).toBe(6668);expect(result.rows[1].lastSpikeTick).toBe(9);expect(result.rows[1].lateSpikes).toBe(0);
 console.log('Long pulse sensitivity:',JSON.stringify(result));await page.screenshot({path:'test-results/neural-stability.png',fullPage:true});
 await expect(page.getByTestId('hud')).toHaveAttribute('data-running','true');await page.getByRole('button',{name:'Unload network'}).click();
});

test('annotation mapping uses measured populations with disconnected and shuffled controls',async({page})=>{
 test.setTimeout(120000);await page.goto('/?controller=dummy');await page.getByRole('button',{name:'PLAY',exact:true}).click();
 await page.getByRole('button',{name:'Load connectivity',exact:true}).click();await expect(page.getByTestId('network-status')).toHaveAttribute('data-state','ready',{timeout:60000});
 await page.getByLabel('Experiment suite').selectOption('mapped');await page.getByRole('button',{name:'Run neural benchmark'}).click();
 const panel=page.getByTestId('neural-experiment');await expect(panel).toHaveAttribute('data-state','done',{timeout:90000});
 const result=JSON.parse((await panel.getAttribute('data-result'))!);
 expect(result.mappingCoverage).toEqual({inputs:[4589,4612],outputs:[656,648],excludedInput:0,excludedOutput:10});
 expect(result.rows[1].readout).toEqual([[0,0],[0,0]]);expect(result.rows[0].hash).not.toBe(result.rows[2].hash);
 for(const row of result.rows)for(const window of row.readout)for(const value of window){expect(value).toBeGreaterThanOrEqual(0);expect(value).toBeLessThanOrEqual(1);}
 console.log('Annotation mapping:',JSON.stringify(result));await page.screenshot({path:'test-results/neural-mapping.png',fullPage:true});
 await expect(page.getByTestId('hud')).toHaveAttribute('data-running','true');await page.getByRole('button',{name:'Unload network'}).click();
});

test('independent lateral trials verify counterbalanced replay and zero disconnected contrast',async({page})=>{
 test.setTimeout(120000);await page.goto('/?controller=dummy');await page.getByRole('button',{name:'PLAY',exact:true}).click();
 await page.getByRole('button',{name:'Load connectivity',exact:true}).click();await expect(page.getByTestId('network-status')).toHaveAttribute('data-state','ready',{timeout:60000});
 await page.getByLabel('Experiment suite').selectOption('independent');await page.getByRole('button',{name:'Run neural benchmark'}).click();
 const panel=page.getByTestId('neural-experiment');await expect(panel).toHaveAttribute('data-state','done',{timeout:90000});
 const result=JSON.parse((await panel.getAttribute('data-result'))!);expect(result.suite).toBe('independent');
 expect(result.rows[0].readout[0][0]).toBeCloseTo(0.13940548780487805,12);
 expect(result.rows[0].readout[0][1]).toBeCloseTo(0.13940329218106995,12);
 expect(result.rows[1].readout).toEqual([[0,0],[0,0]]);expect(result.rows[1].directionalContrast).toBe(0);
 for(const row of result.rows){expect(row.trialHashes).toHaveLength(2);const [left,right]=row.readout;
  expect(row.directionalContrast).toBeCloseTo((right[1]-right[0])-(left[1]-left[0]),12);}
 console.log('Independent lateral trials:',JSON.stringify(result));await page.screenshot({path:'test-results/neural-independent.png',fullPage:true});
 await expect(page.getByTestId('hud')).toHaveAttribute('data-running','true');await page.getByRole('button',{name:'Unload network'}).click();
});

test('amplitude and shuffle sweep preserves all conditions and reference traces',async({page})=>{
 test.setTimeout(180000);await page.goto('/?controller=dummy');await page.getByRole('button',{name:'PLAY',exact:true}).click();
 await page.getByRole('button',{name:'Load connectivity',exact:true}).click();await expect(page.getByTestId('network-status')).toHaveAttribute('data-state','ready',{timeout:60000});
 await page.getByLabel('Experiment suite').selectOption('robustness');await page.getByRole('button',{name:'Run neural benchmark'}).click();
 const panel=page.getByTestId('neural-experiment');await expect(panel).toHaveAttribute('data-state','done',{timeout:120000});
 const result=JSON.parse((await panel.getAttribute('data-result'))!);expect(result.rows).toHaveLength(15);
 for(const amplitude of [250,500,1000]){const rows=result.rows.filter((r:{amplitude:number})=>r.amplitude===amplitude);
  expect(rows).toHaveLength(5);expect(rows[1].readout).toEqual([[0,0],[0,0]]);
  expect(rows.slice(2).map((r:{shuffleSeed:number})=>r.shuffleSeed)).toEqual([20260912,20260913,20260914]);}
 expect(result.rows[10].trialHashes).toEqual([1348478627,3786965343]);expect(result.rows[12].trialHashes).toEqual([2992661511,1233460176]);
 writeFileSync('test-results/mapping-sweep.json',JSON.stringify(result,null,2));
 console.log('Amplitude sweep:',JSON.stringify(result.rows.map((r:{name:string;directionalContrast:number;readout:number[][]})=>({name:r.name,contrast:r.directionalContrast,readout:r.readout}))));
 await page.screenshot({path:'test-results/neural-sweep.png',fullPage:true});await expect(page.getByTestId('hud')).toHaveAttribute('data-running','true');
 await page.getByRole('button',{name:'Unload network'}).click();
});

test('model-derived diagnostic streams actual spikes, resets, clears and unloads',async({page})=>{
 test.setTimeout(90000);await page.goto('/?controller=dummy');await page.getByRole('button',{name:'PLAY',exact:true}).click();
 await page.getByRole('button',{name:'Load connectivity',exact:true}).click();await expect(page.getByTestId('network-status')).toHaveAttribute('data-state','ready',{timeout:60000});
 const view=page.getByTestId('diagnostic-view');await page.getByRole('button',{name:'Start spike diagnostic',exact:true}).click();
 await expect.poll(async()=>Number(await view.getAttribute('data-tick'))).toBeGreaterThan(5);
 await expect(page.getByRole('button',{name:'Run neural benchmark'})).toBeDisabled();
 await page.getByRole('button',{name:'Reset diagnostic',exact:true}).click();
 await expect(view).toHaveAttribute('data-tick','120',{timeout:20000});await expect(view).toHaveAttribute('data-hash','322408360');
 expect(Number(await view.getAttribute('data-spikes'))).toBeGreaterThan(0);
 await page.screenshot({path:'test-results/neural-diagnostic.png',fullPage:true});
 await page.getByRole('button',{name:'Clear diagnostic',exact:true}).click();await expect(view).toHaveAttribute('data-tick','0');await expect(view).toHaveAttribute('data-spikes','0');
 await page.getByRole('button',{name:'Start spike diagnostic',exact:true}).click();await page.getByRole('button',{name:'Unload network'}).click();
 await expect(view).toHaveCount(0);await expect(page.getByTestId('hud')).toHaveAttribute('data-running','true');
});

test('diagnostic Canvas fallback reaches the identical model trace',async({page})=>{
 test.setTimeout(90000);await page.addInitScript(()=>{const old=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type:string,...args:unknown[]){if(type==='webgl2')return null;return old.apply(this,[type,...args] as never);} as typeof old;});
 await page.goto('/?controller=dummy');await page.getByRole('button',{name:'Load connectivity',exact:true}).click();await expect(page.getByTestId('network-status')).toHaveAttribute('data-state','ready',{timeout:60000});
 await page.getByRole('button',{name:'Start spike diagnostic',exact:true}).click();const view=page.getByTestId('diagnostic-view');
 await expect(view).toHaveAttribute('data-tick','120',{timeout:30000});await expect(view).toHaveAttribute('data-hash','322408360');
 await page.getByRole('button',{name:'Unload network'}).click();await expect(view).toHaveCount(0);
});
