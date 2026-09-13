import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='.source-assets/polish-2026-09-11';
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});const results=[];
try {
 for(const width of [1366,390]) {
  const context=await browser.newContext({viewport:{width,height:width<600?844:900},hasTouch:width<600,reducedMotion:'reduce'});
  await context.route('**/Stage3D.*.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('this.scene.background=','window.__hall=this,this.scene.background=')});});
  const page=await context.newPage(),errors=[],failed=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(r.url())});
  try {
   await page.goto('http://localhost:4322/work/nocturne/',{waitUntil:'networkidle'});
   await page.waitForURL('**/work/lowlight/');
   await page.waitForFunction(()=>window.__hall?.readyDone&&!document.documentElement.classList.contains('gl-pending'));
   const physical=await page.evaluate(()=>{const m=window.__hall.machines.find(m=>m.item.slug==='lowlight');return {kind:m.item.kind,controls:[...m.ctl.keys()].sort(),screens:m.item.screens,sideNames:[]};});
   assert.equal(physical.kind,'jukebox');assert.deepEqual(physical.controls,['sel_0','sel_1','sel_2','sel_3','sel_4','sel_5','start_0','tbtn_0','tbtn_1']);
   assert.ok(physical.screens.every(s=>s.includes('/media/lowlight/screens/')));
   assert.equal(await page.locator('.captures__thumb').count(),6);
   await page.locator('.captures__large').click();
   if(width>=600) {
    await page.locator('[data-control="sel_5"]').waitFor({state:'visible'});
    await page.locator('[data-control="sel_5"]').click();
   } else await page.locator('.closeup__count .closeup__arrow').first().tap();
   await page.waitForFunction(()=>document.querySelector('.closeup__shot.is-current img')?.getAttribute('src')?.includes('06-playing'));
   await page.locator(width>=600?'[data-control="tbtn_0"]':'.closeup__count .closeup__arrow').first().click();
   await page.waitForFunction(()=>document.querySelector('.closeup__shot.is-current img')?.getAttribute('src')?.includes('05-lyrics'));
   if(width>=600)await page.locator('[data-control="tbtn_1"]').click();
   else await page.locator('.closeup__count .closeup__arrow').last().tap();
   await page.waitForFunction(()=>document.querySelector('.closeup__shot.is-current img')?.getAttribute('src')?.includes('06-playing'));
   await page.screenshot({path:`${out}/lowlight-controls-${width}.png`});
   await page.locator(width>=600?'[data-control="start_0"]':'.closeup__fs').click();
   await page.waitForFunction(()=>!!document.fullscreenElement||!!document.querySelector('.gallery-lightbox'));
   if(await page.evaluate(()=>!!document.fullscreenElement))await page.evaluate(()=>document.exitFullscreen());
   else await page.keyboard.press('Escape');
   await page.keyboard.press('Escape');
   await page.locator('.site-nav__brand').click();await page.waitForURL('http://localhost:4322/');
   await page.locator('.hall-dock__directory').click();await page.locator('.hall-directory__item[href="/work/lowlight/"]').click();await page.waitForURL('**/work/lowlight/');
   await page.goto('http://localhost:4322/en/work/nocturne/',{waitUntil:'networkidle'});await page.waitForURL('**/en/work/lowlight/');
   assert.equal(await page.locator('html').getAttribute('lang'),'en');
   await page.waitForTimeout(1000);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
   results.push({width,ok:true,physical,errors,failed});
  }catch(error){results.push({width,ok:false,error:String(error),errors,failed});}
  await context.close();
 }
}finally{await browser.close();await fs.writeFile(`${out}/lowlight-interactions.json`,JSON.stringify(results,null,2));}
console.log(JSON.stringify(results,null,2));if(results.some(r=>!r.ok))process.exitCode=1;
