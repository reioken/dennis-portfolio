// Lowlight jukebox (preview server, 4322): physical controls page the close-up at 1366 px; at 390 px the project
// page is native (d58c490, 2026-09-17: no hall, carousel -> lightbox). Both widths then return through the hall and
// the directory, and load the English page.
// The /work/nocturne/ -> /work/lowlight/ redirect exists only on Cloudflare (public/_redirects), so it is checked
// only when QA_BASE_URL is the live site; locally the test loads /work/lowlight/ directly.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {base,outDir,isLive,expectNativeCase,openNativeLightbox} from './_env.mjs';
const BASE=base('http://localhost:4322');
const LIVE=isLive(BASE);
const out=outDir('polish-2026-09-11');
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});const results=[];
async function open(page,lang){
 const pre=lang==='en'?'/en':'';
 if(LIVE){await page.goto(BASE+pre+'/work/nocturne/',{waitUntil:'networkidle'});await page.waitForURL('**'+pre+'/work/lowlight/');}
 else await page.goto(BASE+pre+'/work/lowlight/',{waitUntil:'networkidle'});
}
try {
 for(const width of [1366,390]) {
  const context=await browser.newContext({viewport:{width,height:width<600?844:900},hasTouch:width<600,isMobile:width<600,reducedMotion:'reduce'});
  await context.route('**/Stage3D.*.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('this.scene.background=','window.__hall=this,this.scene.background=')});});
  const page=await context.newPage(),errors=[],failed=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(r.url())});
  try {
   await open(page,'de');
   let physical=null,native=null;
   if(width>=900){
    await page.waitForFunction(()=>window.__hall?.readyDone&&!document.documentElement.classList.contains('gl-pending'));
    physical=await page.evaluate(()=>{const m=window.__hall.machines.find(m=>m.item.slug==='lowlight');return {kind:m.item.kind,controls:[...m.ctl.keys()].sort(),screens:m.item.screens};});
    assert.equal(physical.kind,'jukebox');assert.deepEqual(physical.controls,['sel_0','sel_1','sel_2','sel_3','sel_4','sel_5','start_0','tbtn_0','tbtn_1']);
    assert.ok(physical.screens.every(s=>s.includes('/media/lowlight/screens/')));
    assert.equal(await page.locator('.captures__thumb').count(),6);
    await page.locator('.captures__large').click();
    await page.locator('[data-control="sel_5"]').waitFor({state:'visible'});
    await page.locator('[data-control="sel_5"]').click();
    await page.waitForFunction(()=>document.querySelector('.closeup__shot.is-current img')?.getAttribute('src')?.includes('06-playing'));
    await page.locator('[data-control="tbtn_0"]').click();
    await page.waitForFunction(()=>document.querySelector('.closeup__shot.is-current img')?.getAttribute('src')?.includes('05-lyrics'));
    await page.locator('[data-control="tbtn_1"]').click();
    await page.waitForFunction(()=>document.querySelector('.closeup__shot.is-current img')?.getAttribute('src')?.includes('06-playing'));
    await page.screenshot({path:`${out}/lowlight-controls-${width}.png`});
    await page.locator('[data-control="start_0"]').click();
    await page.waitForFunction(()=>!!document.fullscreenElement||!!document.querySelector('.gallery-lightbox'));
    if(await page.evaluate(()=>!!document.fullscreenElement))await page.evaluate(()=>document.exitFullscreen());
    else await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
   }else{
    native=await expectNativeCase(page);
    assert.equal(native.slides,6);
    const fit=await openNativeLightbox(page,5);assert.ok(fit.ok,JSON.stringify(fit));
    const count=await page.locator('.gallery-view__count').innerText();
    await page.keyboard.press('ArrowLeft');await page.waitForTimeout(200);
    assert.notEqual(await page.locator('.gallery-view__count').innerText(),count);
    await page.screenshot({path:`${out}/lowlight-lightbox-${width}.png`});
    await page.keyboard.press('Escape');await page.locator('.gallery-view').waitFor({state:'detached'});
    assert.ok(page.url().includes('/work/lowlight/'));
   }
   await page.locator('.site-nav__brand').click();await page.waitForURL(BASE+'/');
   await page.locator('.hall-dock__directory').click();await page.locator('.hall-directory__item[href="/work/lowlight/"]').click();await page.waitForURL('**/work/lowlight/');
   if(width<900)await expectNativeCase(page,{direct:false});
   await open(page,'en');
   assert.equal(await page.locator('html').getAttribute('lang'),'en');
   await page.waitForTimeout(1000);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
   results.push({width,ok:true,redirectChecked:LIVE,physical,native,errors,failed});
  }catch(error){results.push({width,ok:false,error:String(error),errors,failed});}
  await context.close();
 }
}finally{await browser.close();await fs.writeFile(`${out}/lowlight-interactions.json`,JSON.stringify(results,null,2));}
console.log(JSON.stringify(results,null,2));if(results.some(r=>!r.ok))process.exitCode=1;
