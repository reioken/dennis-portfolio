import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser = await chromium.launch({headless:true,args:['--use-angle=d3d11']});
const results=[];
async function ready(page) {
 await page.goto('http://localhost:4322/',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.querySelector('.hall.is-3d'),{timeout:20000});
}
try {
 const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await ready(page);
 const initial=await page.locator('.hall').getAttribute('data-focus');assert.equal(initial,'kasse');
 const stops=page.locator('.hall-dock__stop');
 assert.equal(await page.locator('.hall-dock__stop[tabindex="0"]').count(),1);
 await stops.first().focus();await page.keyboard.press('ArrowRight');
 assert.equal(await stops.nth(1).getAttribute('aria-current'),'location');
 await page.keyboard.press('End');assert.equal(await stops.last().getAttribute('aria-current'),'location');
 await page.keyboard.press('Home');assert.equal(await stops.first().getAttribute('aria-current'),'location');
 results.push('Keyboard rail: one tab stop, ArrowRight, End and Home work.');
 await page.locator('.hall-dock__directory').click();
 const before=await page.locator('.hall').getAttribute('data-focus');
 await page.locator('.hall-directory ol').hover();await page.mouse.wheel(0,600);await page.waitForTimeout(400);
 assert.equal(await page.locator('.hall').getAttribute('data-focus'),before);
 assert.ok(await page.locator('.hall-directory ol').evaluate(e=>e.scrollTop)>0);
 await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);
 await page.locator('.hall-dock__directory').click();await page.mouse.click(100,400);
 assert.equal(await page.locator('dialog[open]').count(),0);
 results.push('Directory: wheel scrolls list without moving hall; Escape/backdrop close.');
 await page.locator('.hall-dock__open').click();await page.waitForURL('**/about/');await page.waitForTimeout(500);
 await page.keyboard.press('Escape');await page.waitForURL('http://localhost:4322/');await page.waitForTimeout(500);
 assert.deepEqual(errors,[]);results.push('About entry and Escape return: no unhandled browser errors.');
 await page.screenshot({path:'.source-assets/polish-2026-09-11/hall-interactions-desktop.png'});
 await context.close();
 const phone=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 const mobile=await phone.newPage();await ready(mobile);
 const cdp=await phone.newCDPSession(mobile);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:290,y:410}]});
 for(const x of [245,200,155,110]){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:410}]});await mobile.waitForTimeout(60);}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await mobile.waitForTimeout(300);
 assert.equal(new URL(mobile.url()).pathname,'/');assert.equal(await mobile.locator('.hall-dock__stop').nth(1).getAttribute('aria-current'),'location');
 await mobile.locator('.hall-dock__open').tap();await mobile.waitForURL('**/work/**');
 results.push('Phone: swipe selects exactly one station without opening it; next deliberate tap opens project.');
 await mobile.screenshot({path:'.source-assets/polish-2026-09-11/hall-interactions-phone.png'});
 await phone.close();
 console.log(JSON.stringify({passed:results},null,2));await fs.writeFile('.source-assets/polish-2026-09-11/hall-interactions.json',JSON.stringify({passed:results},null,2));
}finally{await browser.close()}
