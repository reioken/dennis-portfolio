import { chromium } from 'file:///C:/Users/denni/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='.source-assets/smoothness-2026-09-11';
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
const results=[];
try {
 for(const width of [320,390,1366,1920]) {
  const context=await browser.newContext({viewport:{width,height:900}});
  // Hold the 3D bundle to inspect the independent SSR indicator with no GPU contention.
  await context.route('**/Stage3D.*.js',async route=>{await new Promise(r=>setTimeout(r,12000));await route.continue().catch(()=>{});});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:4322/',{waitUntil:'domcontentloaded'});
  await page.locator('.hall-startup').waitFor({state:'visible'});
  const state=await page.evaluate(()=>{
   const e=document.querySelector('.hall-startup'),b=document.querySelector('.site-nav__name');
   return {x:e.getBoundingClientRect().left,centerX:e.getBoundingClientRect().left+e.getBoundingClientRect().width/2,centerY:e.getBoundingClientRect().top+e.getBoundingClientRect().height/2,width:e.getBoundingClientRect().width,animationCount:e.getAnimations({subtree:true}).length,faces:e.querySelectorAll('.hall-startup__prism > i').length,overflow:document.documentElement.scrollWidth-innerWidth};
  });
  assert.ok(Math.abs(state.centerX-width/2)<.1);assert.ok(Math.abs(state.centerY-450)<.1);assert.ok(state.width>120);assert.equal(state.faces,6);assert.ok(state.animationCount>=10);assert.equal(state.overflow,0);
  const before=await page.locator('.hall-startup__prism').evaluate(e=>getComputedStyle(e).transform);
  await page.waitForTimeout(900);
  const after=await page.locator('.hall-startup__prism').evaluate(e=>getComputedStyle(e).transform);assert.notEqual(before,after);
  if(width===1366){
   for(const t of [200,1200,2100,3400]){
    await page.evaluate(t=>document.querySelector('.hall-startup').getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=t;}),t);
    await page.screenshot({path:`${out}/emblem-${t}.png`,clip:{x:583,y:345,width:200,height:210}});
   }
   await page.screenshot({path:`${out}/emblem-desktop.png`});
  }
  if(width===390)await page.screenshot({path:`${out}/emblem-mobile.png`});
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.hall-startup').evaluate(e=>e.getAnimations({subtree:true}).length),0);
  await page.evaluate(()=>{document.documentElement.classList.remove('gl-pending');document.querySelector('.hall__stage')?.removeAttribute('data-power');});
  // Actual lifecycle dismissal is checked by smooth-startup.mjs; React owns stage state.
  assert.deepEqual(errors,[]);results.push({width,...state,ok:true,errors});await context.close();
 }
}finally{await browser.close();await fs.writeFile(`${out}/emblem-qa.json`,JSON.stringify(results,null,2));}
console.log(JSON.stringify(results,null,2));



