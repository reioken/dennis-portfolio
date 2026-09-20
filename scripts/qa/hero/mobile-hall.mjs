// Phone/tablet hall navigation, viewport framing and touch flow.
// node scripts/qa/hero/mobile-hall.mjs OUT BASE [--before]
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { outDir } from './_out.mjs';
const [out, base = 'http://127.0.0.1:4322', before] = process.argv.slice(2);
const dir = outDir(out, 'mobile-hall.mjs OUT BASE [--before]');
const browser = await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']});
const report = {errors:[], viewports:[]};
let page;
try {
  const context = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  page = await context.newPage();
  page.on('pageerror', e => report.errors.push(String(e)));
  page.on('console', m => { if(m.type()==='error') report.errors.push(m.text()); });
  await page.goto(base+'/', {waitUntil:'domcontentloaded'});
  await page.waitForSelector('.hall.is-3d .hall__stage[data-startup-phase="ready"]', {timeout:60000});
  await page.waitForTimeout(4500);
  if(!before) {
    assert.equal(await page.locator('.hall-dock__stop').count(),12,'Ten project machines plus About and Contact');
    const railText=await page.locator('.hall-dock__rail').textContent();
    for(const title of ['Mina','Briefly','Riftcast','Carillon']) assert.ok(!railText.includes(title), `${title} removed from hall stops`);
  }
  await page.screenshot({path:`${dir}/claw-phone.png`});
  await page.locator('.hall-dock__arrow--next').tap();
  await page.waitForTimeout(1800);
  for(const [width,height] of (before ? [[390,844]] : [[390,844],[320,740],[768,1024],[844,390]])) {
    await page.setViewportSize({width,height});
    await page.waitForTimeout(1000);
    const state = await page.locator('.hall-dock').evaluate(dock => {
      const rect = n => { const r=n.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; };
      const controls=[...dock.querySelectorAll('button,a')].filter(n=>n.getBoundingClientRect().width>0 && getComputedStyle(n).visibility!=='hidden');
      return {dock:rect(dock),overflow:document.documentElement.scrollWidth>innerWidth,controls:controls.map(n=>({name:n.className,...rect(n)})),railVisible:!!dock.querySelector('.hall-dock__rail').getBoundingClientRect().width};
    });
    report.viewports.push({width,height,...state});
    await page.screenshot({path:`${dir}/hall-${width}.png`});
    if(!before) {
      assert.equal(state.overflow,false);
      assert.equal(state.railVisible,false);
      for(const c of state.controls) {
        assert.ok(c.w>=48 && c.h>=48,`${width}: small target ${c.name}`);
        assert.ok(c.x>=0 && c.x+c.w<=width+1 && c.y>=0 && c.y+c.h<=height+1,`${width}: clipped target ${c.name}`);
      }
      for(let i=0;i<state.controls.length;i++) for(let j=i+1;j<state.controls.length;j++) {
        const a=state.controls[i],b=state.controls[j];
        assert.ok(a.x+a.w<=b.x || b.x+b.w<=a.x || a.y+a.h<=b.y || b.y+b.h<=a.y,`${width}: overlapping targets`);
      }
    }
  }
  if(!before) {
    await page.setViewportSize({width:390,height:844});
    const count=await page.locator('.hall-dock__count').innerText();
    const cdp=await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:310,y:350}]});
    await page.waitForTimeout(60);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:200,y:352}]});
    await page.waitForTimeout(60);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:70,y:352}]});
    await page.waitForTimeout(60);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForTimeout(700);
    assert.notEqual(await page.locator('.hall-dock__count').innerText(),count,'Swipe changes station');
    assert.equal(new URL(page.url()).pathname,'/','Swipe does not accidentally open a project');
    await page.evaluate(() => {
      window.__tapEvents=[];
      for(const type of ['pointerdown','pointerup','click']) document.addEventListener(type,e=>window.__tapEvents.push({type,target:e.target.className,x:e.clientX,y:e.clientY,at:performance.now()}),true);
    });
    await page.locator('.hall-dock__directory').tap();
    await page.waitForTimeout(250);
    report.tap=await page.evaluate(()=>({events:window.__tapEvents,open:document.querySelector('.hall-directory').open}));
    await page.screenshot({path:`${dir}/directory-tap.png`});
    await page.locator('.hall-directory').waitFor({state:'visible'});
    await page.waitForTimeout(200);
    await page.screenshot({path:`${dir}/directory-phone.png`});
    await page.locator('.hall-directory__item[href$="/work/mina/"]').tap();
    await page.waitForURL('**/work/mina/');
    await page.locator('.case-page').waitFor({state:'visible'});
    await page.goBack();
    await page.waitForURL(base+'/');
    await page.waitForSelector('.hall.is-3d .hall__stage[data-startup-phase="ready"]');
    await page.locator('.hall-dock__directory').tap();
    await page.locator('.hall-directory__item[href$="/work/nexus/"]').tap();
    await page.waitForURL('**/work/nexus/');
    await page.locator('.hall-panel__back').tap();
    await page.waitForURL(base+'/');
    await page.locator('.hall-dock__open').tap();
    await page.waitForURL('**/work/nexus/');
    await page.locator('.hall-panel__back').tap();
    await page.waitForURL(base+'/');
    await page.setViewportSize({width:1440,height:900});
    await page.locator('.hall-dock__stop').first().click();
    await page.waitForTimeout(1800);
    await page.screenshot({path:`${dir}/claw-desktop.png`});
    report.flow='Swipe, project list, project return, primary action and desktop resize passed';
    assert.deepEqual(report.errors,[]);
  }
} catch(error) {
  if(page) {
    report.failure=await page.evaluate(()=>({url:location.href,stage:document.querySelector('.hall__stage')?.outerHTML.slice(0,700),tap:window.__tapEvents,resources:performance.getEntriesByType('resource').slice(-8).map(r=>({name:r.name,duration:r.duration}))}));
    await page.screenshot({path:`${dir}/failure.png`});
  }
  throw error;
} finally {
  await browser.close();
  await writeFile(`${dir}/mobile-hall.json`,JSON.stringify(report,null,2));
}
console.log(JSON.stringify(report));
