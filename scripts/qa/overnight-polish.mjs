import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {base,outDir} from './_env.mjs';
const BASE=base('http://localhost:4322');
const out=outDir('polish-2026-09-11');
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
const results=[];
try {
 for(const [width,height] of [[375,667],[820,1180]]) {
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:width<600,reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[],steps=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/contact',route=>route.abort());
  async function check(route) {
   await page.waitForURL(url=>url.pathname===route);
   await page.waitForFunction(()=>!!document.querySelector('.hall.is-3d')&&!document.documentElement.classList.contains('gl-pending')&&!document.documentElement.classList.contains('hall-routing'));
   const state=await page.evaluate(()=>({halls:document.querySelectorAll('.hall').length,canvases:document.querySelectorAll('canvas').length,dialogs:document.querySelectorAll('dialog[open]').length,inert:!!document.querySelector('main[inert]'),overflow:document.documentElement.scrollWidth-innerWidth}));
   assert.deepEqual(state,{halls:1,canvases:1,dialogs:0,inert:false,overflow:0});
   assert.deepEqual(errors,[]);steps.push({route,...state});
  }
  try {
   await page.goto(BASE+'/',{waitUntil:'networkidle'});await check('/');
   const secondary=await context.newPage();await secondary.goto('about:blank');await secondary.bringToFront();await page.waitForTimeout(3000);await secondary.close();await page.bringToFront();await check('/');
   await page.locator('.hall-dock__open').tap();await check('/about/');
   await page.screenshot({path:`${out}/overnight-about-${width}.png`});
   await page.locator('.site-nav__menu').tap();await page.locator('.nav-dropdown__link[href="/contact/"]').tap();await check('/contact/');
   await page.locator('.hall-panel__body').evaluate(el=>el.scrollTop=el.scrollHeight);
   await page.locator('.site-nav__brand').tap();await check('/');
   await page.locator('.hall-dock__directory').tap();await page.locator('.hall-directory__item[href="/work/saute-survivors/"]').tap();await check('/work/saute-survivors/');
   await page.locator('.hall-panel__body').evaluate(el=>el.scrollTop=el.scrollHeight);
   await page.keyboard.press('Escape');await check('/');
   await page.waitForTimeout(3000);assert.deepEqual(errors,[]);
   results.push({width,height,ok:true,steps,errors});
  }catch(error){results.push({width,height,ok:false,error:String(error),steps,errors});}
  await context.close();
 }
}finally{await browser.close();await fs.writeFile(`${out}/overnight-interactions.json`,JSON.stringify(results,null,2));}
console.log(JSON.stringify(results,null,2));
if(results.some(r=>!r.ok))process.exitCode=1;
