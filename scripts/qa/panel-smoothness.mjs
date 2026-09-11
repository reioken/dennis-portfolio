import fs from 'node:fs/promises';
import { chromium } from 'file:///C:/Users/denni/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const out='.source-assets/smoothness-2026-09-11';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
const context=await browser.newContext({viewport:{width:1366,height:900}});
await context.route('**/Stage3D.*.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('this.scene.background=','window.__hall=this,this.scene.background=')});});
await context.addInitScript(()=>{window.__panelFrames=[];const tick=()=>{const e=document.querySelector('.hall-panel');if(e){const r=e.getBoundingClientRect();window.__panelFrames.push({t:performance.now(),x:r.x,w:r.width,y:r.y,h:r.height,reading:document.documentElement.classList.contains('is-reading')});}requestAnimationFrame(tick);};requestAnimationFrame(tick);});
const page=await context.newPage(),errors=[],checks=[],baselines={};
page.on('pageerror',e=>errors.push(e.message));
async function ready(){await page.waitForFunction(()=>window.__hall?.readyDone&&!document.documentElement.classList.contains('gl-pending')&&!document.querySelector('.hall__stage')?.hasAttribute('data-power'),null,{timeout:45000});await page.waitForTimeout(1000);}
async function sample(){return page.evaluate(()=>{const el=document.querySelector('.hall-panel'),r=el.getBoundingClientRect(),sc=window.__hall;return{rect:{x:r.x,w:r.width,y:r.y,h:r.height},frame:sc.frame,goal:sc.goalPos.toArray(),camera:sc.camera.position.toArray(),overflow:document.querySelector('.hall-panel__body').scrollWidth>document.querySelector('.hall-panel__body').clientWidth+1,reading:document.documentElement.classList.contains('is-reading'),inert:document.querySelector('.hall').inert};});}
function check(name,pass,detail){checks.push({name,pass,detail});console.log(JSON.stringify(checks.at(-1)));}
async function direct(width,height){await page.setViewportSize({width,height});await page.goto('http://localhost:4322/about/',{waitUntil:'domcontentloaded'});if(process.env.PANEL_PATCH)await page.addStyleTag({content:'@media(max-width:899px){.hall-panel{transition:none}}'});await ready();const s=await sample();baselines[width+'x'+height]=s;const frames=await page.evaluate(()=>window.__panelFrames.filter(f=>!f.reading));check('stable direct '+width,frames.length>1&&Math.max(...frames.map(f=>f.x))-Math.min(...frames.map(f=>f.x))<1&&Math.max(...frames.map(f=>f.w))-Math.min(...frames.map(f=>f.w))<1,{sample:s,frameCount:frames.length,initial:frames[0]});check('no content overflow '+width,!s.overflow,s.rect);await page.screenshot({path:`${out}/panel-final-direct-${width}.png`});return s;}
async function readingResize(width,height,escape){await page.locator('.hall-panel__reading').click();await page.setViewportSize({width,height});await page.waitForTimeout(700);if(escape)await page.keyboard.press('Escape');else await page.locator('.hall-panel__reading').click();await page.waitForTimeout(850);const s=await sample(),b=baselines[width+'x'+height];const frameDelta=Math.max(...Object.keys(b.frame).map(k=>Math.abs((b.frame[k]??0)-(s.frame[k]??0))));const goalDelta=Math.max(...b.goal.map((x,i)=>Math.abs(x-s.goal[i])));check('reading resize close '+(escape?'Escape':'button')+' '+width,!s.reading&&!s.inert&&!s.overflow&&frameDelta<.0001,{sample:s,frameDelta,goalDelta});await page.screenshot({path:`${out}/panel-final-reading-close-${escape?'escape':'button'}-${width}.png`});}
try{
 await direct(1366,900);await direct(1280,900);await direct(390,844);await direct(844,390);
 await page.setViewportSize({width:1366,height:900});await page.waitForTimeout(750);await readingResize(1280,900,false);
 await page.setViewportSize({width:1366,height:900});await page.waitForTimeout(750);await readingResize(1280,900,true);
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(750);await readingResize(844,390,true);
 await page.setViewportSize({width:844,height:390});await page.waitForTimeout(750);await readingResize(390,844,false);
 check('no page errors',errors.length===0,errors);
}finally{await fs.writeFile(`${out}/panel-final-qa.json`,JSON.stringify({checks,errors,baselines},null,2));await browser.close();}
if(checks.some(c=>!c.pass))process.exitCode=1;
