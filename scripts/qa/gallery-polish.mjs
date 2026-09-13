import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const out = '.source-assets/polish-2026-09-11';
const pass = process.env.GALLERY_PASS || 'gallery';
await fs.mkdir(out, {recursive:true});
const browser = await chromium.launch({headless:true,args:['--use-angle=d3d11']});
const results=[];
const check=(row,name,ok,detail)=>{ row.checks.push({name,ok,...(detail===undefined?{}:{detail})}); if(!ok)console.log('FAIL',row.viewport,name,JSON.stringify(detail)); };
async function geometry(page){return page.evaluate(()=>{
 const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};
 return Object.fromEntries(['.hall-panel','.hall-panel__body','.hall-panel__corridor','.closeup__screen','.closeup__shot.is-current','.closeup__rail','.closeup__bar','.gallery-view__stage','.gallery-view__image'].map(sel=>{const e=document.querySelector(sel);if(!e||!visible(e))return[sel,null];const r=e.getBoundingClientRect();return[sel,{x:r.x,y:r.y,w:r.width,h:r.height,scrollW:e.scrollWidth,clientW:e.clientWidth}]}));
});}
async function capture(page,row,name){row.geometry[name]=await geometry(page);await page.screenshot({path:`${out}/${pass}-${row.viewport}-${name}.png`});}
async function sceneReady(page){await page.waitForFunction(()=>!document.documentElement.classList.contains('gl-pending'),null,{timeout:25000});await page.waitForTimeout(500);}
async function openCapture(page){await page.locator('.captures__large').click();await page.locator('.closeup__screen').waitFor({state:'visible'});await page.waitForTimeout(300);}
try{
 for(const v of [{width:390,height:844},{width:844,height:390},{width:1366,height:900}]){
  const context=await browser.newContext({viewport:v,deviceScaleFactor:1,isMobile:v.width<900,hasTouch:v.width<900,reducedMotion:'reduce'});
  const page=await context.newPage();const row={viewport:`${v.width}x${v.height}`,checks:[],geometry:{},errors:[]};results.push(row);
  page.on('pageerror',e=>row.errors.push(e.message));
  try{
   await page.goto('http://localhost:4322/work/saute-survivors/',{waitUntil:'networkidle',timeout:60000});
   await page.locator('.captures__large').waitFor();await sceneReady(page);
   await capture(page,row,'panel');
   check(row,'panel stays inside viewport',await page.locator('.hall-panel').evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1}));
   await page.locator('.hall-panel__reading').click();await page.waitForTimeout(150);
   check(row,'reading view opens and has room',await page.locator('.hall-panel').evaluate(e=>document.documentElement.classList.contains('is-reading')&&e.getBoundingClientRect().height>120));
   await capture(page,row,'reading');
   await page.keyboard.press('Escape');
   check(row,'Escape leaves reading view on same route',!await page.locator('html').evaluate(e=>e.classList.contains('is-reading'))&&page.url().includes('/work/saute-survivors'));
   await openCapture(page);await capture(page,row,'capture');
   if(v.width<900)check(row,'physical control labels hidden on mobile',await page.locator('.closeup__tag').evaluateAll(es=>es.every(e=>getComputedStyle(e).display==='none')));
   const next=page.locator(v.width<900?'.closeup__count button:last-child':'.closeup__rail-nav button:nth-child(2)');
   const before=await page.locator('.closeup__count span').innerText();
   await next.click();await page.waitForTimeout(220);
   check(row,'next capture changes counter',await page.locator('.closeup__count span').innerText()!==before);
   const afterClick=await page.locator('.closeup__count span').innerText();
   await next.focus();await page.keyboard.press('Space');await page.waitForTimeout(220);
   check(row,'Space activates focused next without starting arcade',page.url().includes('/work/saute-survivors')&&await page.locator('.closeup__count span').innerText()!==afterClick);
   await page.locator(v.width<900?'.closeup__fs':'.closeup__rail-btn--grow').click();await page.waitForTimeout(300);
   const isFullscreen=await page.evaluate(()=>Boolean(document.fullscreenElement));
   check(row,'native fullscreen opens',isFullscreen);
   if(isFullscreen){
    const fs=await page.locator('.closeup__screen').boundingBox();
    check(row,'fullscreen fills viewport',fs&&Math.abs(fs.x)<1&&Math.abs(fs.y)<1&&Math.abs(fs.width-v.width)<2&&Math.abs(fs.height-v.height)<2,fs);
    check(row,'fullscreen exit control visible',await page.locator('.closeup__fs').isVisible());
    check(row,'fullscreen navigation visible',await page.locator('.closeup__count').isVisible());
    await capture(page,row,'fullscreen');
    await page.locator('.closeup__fs').click();await page.waitForTimeout(150);
    check(row,'fullscreen exit button works',!await page.evaluate(()=>Boolean(document.fullscreenElement)));
    await page.locator(v.width<900?'.closeup__fs':'.closeup__rail-btn--grow').click();await page.waitForTimeout(100);
    await page.keyboard.press('Escape');await page.waitForTimeout(200);
    check(row,'Escape in fullscreen cannot navigate away',await page.locator('.closeup').count()===1&&page.url().includes('/work/saute-survivors'));
    // Headless Chromium also ignores native fullscreen Escape on a plain HTML probe.
    // Record that browser limitation and use the explicit exit control to continue.
    if(await page.evaluate(()=>Boolean(document.fullscreenElement))){row.nativeEscapeLimitation=true;await page.locator('.closeup__fs').click();await page.waitForTimeout(150);}


   }
   await page.keyboard.press('Escape');await page.waitForTimeout(220);
   check(row,'Escape returns to project without navigating away',await page.locator('.closeup').count()===0&&page.url().includes('/work/saute-survivors'));
   check(row,'focus returns to screenshot',await page.evaluate(()=>document.activeElement?.classList.contains('captures__thumb')));
   await openCapture(page);
   await page.locator(v.width<900?'.closeup__bar-btn':'.closeup__rail-btn--up').click();await page.waitForTimeout(220);
   check(row,'back control returns to project',await page.locator('.closeup').count()===0);
   // Exercise the browser-independent fallback as used when fullscreen is unavailable.
   await page.evaluate(()=>{Element.prototype.requestFullscreen=undefined;});
   await openCapture(page);await page.locator(v.width<900?'.closeup__fs':'.closeup__rail-btn--grow').click();
   await page.locator('.gallery-view').waitFor({state:'visible'});await page.waitForTimeout(200);
   check(row,'fallback lightbox opens',await page.locator('.gallery-view').isVisible());
   check(row,'fallback thumbnail buttons all named',await page.locator('.gallery-view__film-item').evaluateAll(es=>es.every(e=>!!e.getAttribute('aria-label'))));
   await capture(page,row,'lightbox');
   check(row,'lightbox image centered in stage',await page.evaluate(()=>{const s=document.querySelector('.gallery-view__stage').getBoundingClientRect(),i=document.querySelector('.gallery-view__image').getBoundingClientRect();return Math.abs(s.y+s.height/2-i.y-i.height/2)<3&&Math.abs(s.x+s.width/2-i.x-i.width/2)<3}));
   const lightboxBefore=await page.locator('.gallery-view__count').innerText();await page.keyboard.press('ArrowRight');await page.waitForTimeout(160);
   check(row,'fallback keyboard navigation',await page.locator('.gallery-view__count').innerText()!==lightboxBefore);
   await page.locator('.gallery-view__icon-btn').focus();await page.keyboard.press('Shift+Tab');
   check(row,'fallback traps reverse tab',await page.evaluate(()=>!!document.activeElement?.closest('.gallery-view')));
   await page.keyboard.press('Escape');await page.waitForTimeout(220);
   check(row,'fallback Escape leaves closeup open',await page.locator('.gallery-view').count()===0&&await page.locator('.closeup').count()===1);
   check(row,'fallback restores fullscreen control focus',await page.evaluate(()=>document.activeElement?.classList.contains('closeup__fs')||document.activeElement?.classList.contains('closeup__rail-btn--grow')));
   await page.keyboard.press('Escape');
   await page.goto('http://localhost:4322/about/',{waitUntil:'networkidle',timeout:60000});await sceneReady(page);
   await capture(page,row,'about');
   check(row,'about panel stays inside viewport',await page.locator('.hall-panel').evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1}));
   await page.goto('http://localhost:4322/work/riftback/',{waitUntil:'networkidle',timeout:60000});await sceneReady(page);
   await openCapture(page);
   const oldSource=await page.locator('.closeup__shot.is-current img').getAttribute('src');
   await page.locator('.closeup__chips button').nth(1).click();await page.waitForTimeout(240);
   check(row,'surface switch changes image',await page.locator('.closeup__shot.is-current img').getAttribute('src')!==oldSource);
   check(row,'phone surface uses portrait layout',await page.locator('.closeup').evaluate(e=>e.classList.contains('closeup--phone')));
   check(row,'old surface image is removed after dissolve',await page.locator('.closeup__shot.is-out').count()===0);
   await capture(page,row,'phone-surface');
   await page.keyboard.press('Escape');
   if(v.width===1366){
    await page.goto('http://localhost:4322/work/echo-frequency/',{waitUntil:'networkidle',timeout:60000});await sceneReady(page);
    await openCapture(page);
    const hasArcade=await page.locator('.closeup__rail-btn--play').count()===1;
    if(!hasArcade)row.playableShortcutLimitation='No published arcade build is available on this route; play-shortcut branch cannot be exercised.';
    const countBefore=await page.locator('.closeup__count span').innerText();
    await page.locator('.closeup__rail-nav button:nth-child(2)').focus();await page.keyboard.press('Space');await page.waitForTimeout(220);
    check(row,'Space on Echo Frequency activates next',page.url().includes('/work/echo-frequency')&&await page.locator('.closeup__count span').innerText()!==countBefore);
    await capture(page,row,'playable');
   }
   check(row,'no page errors',row.errors.length===0,row.errors);
  }catch(error){row.fatal=String(error);console.log(row.fatal);}
  console.log(JSON.stringify(row));await fs.writeFile(`${out}/${pass}.json`,JSON.stringify(results,null,2));await context.close();
 }
}finally{await browser.close();}
if(results.some(r=>r.fatal||r.checks.some(c=>!c.ok)))process.exitCode=1;
