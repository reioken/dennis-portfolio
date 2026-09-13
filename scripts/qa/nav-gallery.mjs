import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='.source-assets/polish-2026-09-11';
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
const results=[];
try {for(const mode of ['reduce','no-preference','no-js']) for(const width of [320,1366]) {
 const context=await browser.newContext({viewport:{width,height:900},javaScriptEnabled:mode!=='no-js',reducedMotion:mode==='no-js'?'reduce':mode});
 const page=await context.newPage();let errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const route of ['/work/forever/','/work/visual-craft/','/en/work/web-clients/']) {
  errors=[]; let result={mode,width,route};
  try {
   await page.goto('http://localhost:4322'+route,{waitUntil:'networkidle'});
   const first=page.locator('.shot-gallery__card,.shot-gallery__cover-trigger').first();
   await first.scrollIntoViewIfNeeded();
   await first.locator('img').evaluate(e=>e.decode());
   const state=await first.evaluate(el=>{const nodes=[];for(let p=el;p;p=p.parentElement){const s=getComputedStyle(p);nodes.push({tag:p.tagName,class:p.className,opacity:s.opacity,visibility:s.visibility,display:s.display});}return {nodes,src:el.querySelector('img')?.currentSrc,opacity:getComputedStyle(el).opacity};});
   assert(!state.nodes.some(e=>Number(e.opacity)===0||e.visibility==='hidden'||e.display==='none'),JSON.stringify(state));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);
   assert.equal(errors.filter(e=>/hydration|418/i.test(e)).length,0,errors.join('\n'));
   await page.screenshot({path:`${out}/nav-gallery-${mode}-${width}${route.replaceAll('/','_')}.png`});
   if(mode==='no-js') {
    await page.locator('.site-nav__fallback-toggle').click();
    const links=page.locator('.site-nav__fallback-links a');
    assert.equal(await links.count(),6);
    assert.equal(await links.first().isVisible(),true);
    assert.equal(await page.locator('.site-nav__menu').isVisible(),false);
    await page.locator('.site-nav__fallback-toggle').click();
   }
   result={...result,ok:true,opacity:state.opacity,errors};
  }catch(e){result={...result,ok:false,error:String(e)}}
  results.push(result);console.log(JSON.stringify(result));await fs.writeFile(`${out}/nav-gallery-results.json`,JSON.stringify(results,null,2));
 }
 await context.close();
}}finally{await browser.close();}
if(results.some(r=>!r.ok))process.exitCode=1;
