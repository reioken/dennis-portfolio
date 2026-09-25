// Hall startup under delayed/failed assets, reduced motion, early navigation and missing WebGL (preview server, 4322).
// abort-gpu: leaving for /work/ during the gpu phase no longer tears the stage down; the parked hall finishes warming
// in the background and the way back finds it lit, with no errors (checked below).
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {base,outDir} from './_env.mjs';
const BASE=base('http://localhost:4322');
const out=outDir('smoothness-2026-09-11');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});const results=[];
const cases=(process.env.STARTUP_CASES||'normal,delayed-figure,delayed-art,reduced,early-about,abort-gpu,no-webgl,failed-figure,timeout').split(',');
try{for(const name of cases){
 const context=await browser.newContext({viewport:{width:name==='reduced'?390:1366,height:900},reducedMotion:name==='reduced'?'reduce':'no-preference'});
 await context.route('**/Stage3D.*.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('this.scene.background=','window.__hall=this,this.scene.background=')});});
 if(name==='no-webgl')await context.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.includes('webgl')?null:get.call(this,type,...args);};});
 if(['delayed-figure','early-about','timeout'].includes(name))await context.route('**/models/dennis.glb*',async route=>{await new Promise(r=>setTimeout(r,name==='timeout'?35000:name==='delayed-figure'?12000:5000));await route.continue().catch(()=>{});});
 if(name==='failed-figure')await context.route('**/models/dennis.glb*',route=>route.fulfill({status:404,body:''}));
 if(name==='delayed-art')await context.route('**/textures/cabinet-art/**/riftback.webp',async route=>{await new Promise(r=>setTimeout(r,3500));await route.continue().catch(()=>{});});
 await context.addInitScript(()=>{
  window.__startupFrames=[];
  function sample(t){const el=document.querySelector('.hall__stage'),sc=window.__hall,loader=document.querySelector('.hall-startup'),style=el&&getComputedStyle(el),ls=loader&&getComputedStyle(loader);
   // shown: the stage is laid out at all. While parked on /work/ it sits in a display:none island (rect 0x0), where its own
   // opacity says nothing about what the visitor sees.
   const frame={t,power:el?.dataset.power,phase:el?.dataset.startupPhase,opacity:style?.opacity,shown:!!el&&el.getClientRects().length>0,ready:sc?.readyDone,pending:sc?.pending,managed:sc?.managedLoading,loader:ls?.visibility==='visible'&&Number(ls?.opacity)>.01};
   if(window.__startupFrames.length<10000)window.__startupFrames.push(frame);requestAnimationFrame(sample);
  }requestAnimationFrame(sample);
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(BASE+'/',{waitUntil:'domcontentloaded'});
  if(name==='early-about'){await page.locator('.site-nav__direct[href="/about/"]').click();await page.waitForURL('**/about/');}
  if(name==='abort-gpu'){await page.waitForFunction(()=>document.querySelector('.hall__stage')?.dataset.startupPhase==='gpu',null,{timeout:25000});await page.locator('.site-nav__direct[href="/work/"]').click();await page.waitForURL('**/work/');
   await page.waitForFunction(()=>document.querySelector('.hall__stage')?.dataset.startupPhase==='ready',null,{timeout:45000});
   await page.locator('.site-nav__brand').click();await page.waitForURL(u=>u.pathname==='/');
   await page.waitForFunction(()=>document.querySelector('.hall.is-3d')&&!document.documentElement.classList.contains('gl-pending')&&!document.querySelector('.hall__stage')?.hasAttribute('data-power'),null,{timeout:15000});
   assert.equal(await page.locator('canvas').count(),1);
   if(await page.locator('.hall-startup').count())assert.equal(await page.locator('.hall-startup').evaluate(e=>getComputedStyle(e).visibility),'hidden');
   await page.screenshot({path:`${out}/abort-gpu-return.png`});}
  if(name==='delayed-figure'){await page.waitForTimeout(10000);const state=await page.locator('.hall__stage').evaluate(e=>({power:e.dataset.power,opacity:getComputedStyle(e).opacity}));assert.equal(state.power,'loading');assert.equal(state.opacity,'0');await page.screenshot({path:`${out}/loading-delayed.png`});}
  if(['no-webgl','failed-figure','timeout'].includes(name)){
   await page.waitForFunction(()=>!document.documentElement.classList.contains('gl-pending')&&!document.querySelector('.hall__stage'),null,{timeout:45000});
   if(await page.locator('.hall-startup').count())assert.equal(await page.locator('.hall-startup').evaluate(e=>getComputedStyle(e).visibility),'hidden');
  }else if(name!=='abort-gpu'){
   await page.waitForFunction(()=>window.__hall?.readyDone,null,{timeout:45000});
   const ready=await page.evaluate(()=>({phase:document.querySelector('.hall__stage').dataset.startupPhase,pending:window.__hall.pending,managed:window.__hall.managedLoading}));
   assert.equal(ready.pending,0);assert.equal(ready.managed,false);
   if(!['reduced','early-about'].includes(name)){
    await page.waitForTimeout(3800);if(name==='normal')await page.screenshot({path:`${out}/lighting-warmup.png`});
   }
   await page.waitForFunction(()=>!document.querySelector('.hall__stage')?.hasAttribute('data-power'),null,{timeout:15000});
   await page.waitForFunction(()=>getComputedStyle(document.querySelector('.hall-startup')).visibility==='hidden',null,{timeout:3000});
   if(name==='early-about')assert.equal(await page.locator('.hall-panel--about').count(),1);
  }
  const report=await page.evaluate(()=>({frames:window.__startupFrames,dataset:{...document.querySelector('.hall__stage')?.dataset},hallClass:document.querySelector('.hall')?.className}));
  assert.equal(report.frames.filter(f=>f.shown&&f.phase&&f.phase!=='ready'&&f.phase!=='failed'&&Number(f.opacity)>0).length,0,'no incomplete scene can be visible');
  assert.deepEqual(errors,[]);
  results.push({name,ok:true,dataset:report.dataset,frameCount:report.frames.length,visibleBeforeReady:report.frames.filter(f=>f.shown&&f.power==='loading'&&Number(f.opacity)>0).length,errors});
  await fs.writeFile(`${out}/startup-${name}.json`,JSON.stringify(report));
 }catch(error){results.push({name,ok:false,error:String(error),errors});}
 await context.close();console.log(JSON.stringify(results.at(-1)));await fs.writeFile(`${out}/startup-checks.json`,JSON.stringify(results,null,2));
}}finally{await browser.close();}
if(results.some(r=>!r.ok))process.exitCode=1;

