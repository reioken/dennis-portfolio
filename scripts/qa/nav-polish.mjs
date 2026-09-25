import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {base,outDir} from './_env.mjs';
const BASE=base('http://localhost:4322');
const out=outDir('polish-2026-09-11');
await fs.mkdir(out, {recursive:true});
const browser = await chromium.launch({headless:true,args:['--use-angle=d3d11']});
const results=[];
async function check(name, run) {
  try { const details=await run(); results.push({name,ok:true,...details}); }
  catch(e) {results.push({name,ok:false,error:String(e)});}
  console.log(JSON.stringify(results.at(-1)));
  await fs.writeFile(`${out}/nav-results.json`,JSON.stringify(results,null,2));
}
try {
 for(const width of [320,390,1366]) {
  const context=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,reducedMotion:'reduce'});
  const page=await context.newPage(); let errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(BASE+'/work/',{waitUntil:'networkidle'});
  await check(`${width}: header geometry`,async()=>{
    const boxes=await page.locator('.site-nav__brand,.site-nav__direct,.site-nav__menu,.lang-switch').evaluateAll(els=>els.filter(e=>e.getBoundingClientRect().width).map(e=>{const r=e.getBoundingClientRect();return {name:e.className,x:r.x,right:r.right,y:r.y,bottom:r.bottom,width:r.width,height:r.height};}));
    for(const b of boxes) {assert(b.x>=0&&b.right<=width+1,JSON.stringify(b));assert(b.height>=44,JSON.stringify(b));}
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++) {const a=boxes[i],b=boxes[j];assert(!(a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y),`Overlapping ${a.name}/${b.name}`);}
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);
    return {boxes};
  });
  await check(`${width}: menu keyboard and dismissal`,async()=>{
    const trigger=page.locator('.site-nav__menu');
    await trigger.click();
    const dialog=page.getByRole('dialog',{name:'Menü'});
    await dialog.waitFor();
    await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-current')==='page');
    assert.equal(await page.locator('main').getAttribute('inert'),'');
    assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
    const dismiss=dialog.locator('.site-nav__dismiss');
    await dismiss.focus();
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('href')),'/privacy/');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement?.className),'site-nav__dismiss');
    await page.screenshot({path:`${out}/nav-${width}-menu.png`});
    await page.keyboard.press('Escape');
    await dialog.waitFor({state:'detached'});
    await page.waitForFunction(()=>document.activeElement?.classList.contains('site-nav__menu'));
    assert.equal(await page.evaluate(()=>document.activeElement?.classList.contains('site-nav__menu')),true);
    assert.equal(await page.locator('main').getAttribute('inert'),null);
    assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden');
    await trigger.click();
    await page.locator('.site-nav__dismiss').click();
    await dialog.waitFor({state:'detached'});
    await trigger.click();
    if(width<600) await page.touchscreen.tap(8,700); else await page.mouse.click(8,700);
    await dialog.waitFor({state:'detached'});
    return {touch:width<600,focusRestored:true};
  });
  await check(`${width}: filters and navigation history`,async()=>{
    await page.getByRole('button',{name:'Spiele',exact:true}).click();
    assert.equal(new URL(page.url()).searchParams.get('filter'),'games');
    const count=await page.locator('.work-filter + [role="status"]').innerText();
    assert.match(count,/\d+ Projekte/);
    await page.locator('.site-nav__direct--work').count();
    await page.locator('main .grid a[href*="/work/"]').first().click();
    await page.waitForURL(/\/work\/[^/]+\//);
    await page.goBack({waitUntil:'networkidle'});
    await page.getByRole('button',{name:'Spiele',exact:true}).waitFor();
    await page.waitForFunction(()=>document.querySelector('.work-filter__tab.is-active')?.textContent?.includes('Spiele'));
    assert.equal(new URL(page.url()).searchParams.get('filter'),'games');
    await page.goForward({waitUntil:'networkidle'});
    assert.match(new URL(page.url()).pathname,/\/work\/[^/]+\//);
    await page.goBack({waitUntil:'networkidle'});
    await page.getByRole('button',{name:'Alle',exact:true}).click();
    assert.equal(new URL(page.url()).searchParams.get('filter'),'all');
    assert.equal(errors.filter(e=>/418|hydration/i.test(e)).length,0,errors.join('\n'));
    return {count};
  });
  await check(`${width}: EN contact hydration and language switch`,async()=>{
    errors=[];
    await page.goto(BASE+'/en/contact/',{waitUntil:'networkidle'});
    await page.waitForFunction(()=>!document.documentElement.classList.contains('gl-pending'));
    await page.getByRole('button',{name:'Auf Deutsch wechseln'}).waitFor();
    assert.equal(await page.locator('html').getAttribute('lang'),'en');
    assert.equal(errors.filter(e=>/418|hydration|Hydration/i.test(e)).length,0,errors.join('\n'));
    await page.locator('.site-nav__menu').click();
    await page.getByRole('dialog',{name:'Menu'}).waitFor();
    assert.equal(await page.locator('#site-menu [aria-current="page"]').getAttribute('href'),'/en/contact/');
    await page.locator('.site-nav__dismiss').click();
    await page.getByRole('button',{name:'Auf Deutsch wechseln'}).click();
    await page.waitForURL(BASE+'/contact/');
    await page.getByRole('button',{name:'Switch to English'}).waitFor();
    return {errors};
  });
  await context.close();
 }
}finally {await browser.close();}
if(results.some(r=>!r.ok))process.exitCode=1;
