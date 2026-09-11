import { chromium } from 'file:///C:/Users/denni/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='.source-assets/polish-2026-09-11';const results=[];
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
try {for(const width of (process.env.NAV_WIDTHS ?? '320,390,1366').split(',').map(Number)) for(const js of (process.env.NAV_JS_ONLY ? [true] : [false,true])) {
 const context=await browser.newContext({viewport:{width,height:844},javaScriptEnabled:js,reducedMotion:'reduce'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.stack ?? e.message));
 const visited=[];let result={width,js};try {
  await page.goto('http://localhost:4322/work/',{waitUntil:'networkidle'});
  if(js) {
   for(const route of ['/about/','/contact/','/work/']) {
    await page.locator('.site-nav__menu').click();await page.locator(`.nav-dropdown__link[href="${route}"]`).click();await page.waitForURL('http://localhost:4322'+route);
    await page.waitForLoadState('networkidle');visited.push(route);assert.equal(errors.length,0,errors.join('\n'));
   }
   await page.locator('.lang-switch').click();await page.waitForURL('http://localhost:4322/en/work/');
   await page.locator('.site-nav__menu').click();await page.locator('.nav-dropdown__link[href="/en/about/"]').click();await page.waitForURL('http://localhost:4322/en/about/');await page.waitForLoadState('networkidle');
   assert.equal(errors.length,0,errors.join('\n'));
  } else {
   for(const route of ['/work/','/en/work/']) {
    await page.goto('http://localhost:4322'+route,{waitUntil:'networkidle'});
    const toggle=page.locator('.site-nav__fallback-toggle');const box=await toggle.boundingBox();assert(box.height>=44&&box.x>=0&&box.x+box.width<=width);
    assert.equal(await page.locator('.site-nav__menu').isVisible(),false);
    await toggle.click();assert.equal(await page.locator('.site-nav__fallback-links a').count(),6);assert(await page.locator('.site-nav__fallback-links a').first().isVisible());
    const href=route.startsWith('/en/')?'/en/about/':'/about/';await page.locator(`.site-nav__fallback-links a[href="${href}"]`).click();await page.waitForURL('http://localhost:4322'+href);
   }
   await page.screenshot({path:`${out}/nav-native-${width}.png`});
  }
  result={...result,ok:true,visited,errors};
 }catch(e){result={...result,ok:false,error:String(e),visited,errors};}
 results.push(result);console.log(JSON.stringify(result));await fs.writeFile(`${out}/nav-final.json`,JSON.stringify(results,null,2));await context.close();
}}finally{await browser.close();}
if(results.some(r=>!r.ok))process.exitCode=1;
