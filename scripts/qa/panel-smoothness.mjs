// About panel geometry (preview server, 4322): stable on a direct load at four viewports, and a live resize lands on
// the same panel rect and camera frame as a direct load at that size. The reading-mode round trips were removed with
// the reading mode (012b6da, 2026-09-12); the resize between viewports they covered is kept.
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import {base,outDir} from './_env.mjs';
const BASE=base('http://localhost:4322');
const out=outDir('smoothness-2026-09-11');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
const context=await browser.newContext({viewport:{width:1366,height:900}});
await context.route('**/Stage3D.*.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('this.scene.background=','window.__hall=this,this.scene.background=')});});
await context.addInitScript(()=>{window.__panelFrames=[];const tick=()=>{const e=document.querySelector('.hall-panel');if(e){const r=e.getBoundingClientRect();window.__panelFrames.push({t:performance.now(),x:r.x,w:r.width,y:r.y,h:r.height});}requestAnimationFrame(tick);};requestAnimationFrame(tick);});
const page=await context.newPage(),errors=[],checks=[],baselines={};
page.on('pageerror',e=>errors.push(e.message));
async function ready(){await page.waitForFunction(()=>window.__hall?.readyDone&&!document.documentElement.classList.contains('gl-pending')&&!document.querySelector('.hall__stage')?.hasAttribute('data-power'),null,{timeout:45000});await page.waitForTimeout(1000);}
async function sample(){return page.evaluate(()=>{const el=document.querySelector('.hall-panel'),r=el.getBoundingClientRect(),sc=window.__hall;return{rect:{x:r.x,w:r.width,y:r.y,h:r.height},frame:sc.frame,goal:sc.goalPos.toArray(),camera:sc.camera.position.toArray(),overflow:document.querySelector('.hall-panel__body').scrollWidth>document.querySelector('.hall-panel__body').clientWidth+1,inert:document.querySelector('.hall').inert};});}
function check(name,pass,detail){checks.push({name,pass,detail});console.log(JSON.stringify(checks.at(-1)));}
async function direct(width,height){await page.setViewportSize({width,height});await page.goto(BASE+'/about/',{waitUntil:'domcontentloaded'});if(process.env.PANEL_PATCH)await page.addStyleTag({content:'@media(max-width:899px){.hall-panel{transition:none}}'});await ready();const s=await sample();baselines[width+'x'+height]=s;const frames=await page.evaluate(()=>window.__panelFrames);check('stable direct '+width,frames.length>1&&Math.max(...frames.map(f=>f.x))-Math.min(...frames.map(f=>f.x))<1&&Math.max(...frames.map(f=>f.w))-Math.min(...frames.map(f=>f.w))<1,{sample:s,frameCount:frames.length,initial:frames[0]});check('no content overflow '+width,!s.overflow,s.rect);await page.screenshot({path:`${out}/panel-final-direct-${width}.png`});return s;}
async function resize(width,height){await page.setViewportSize({width,height});await page.waitForTimeout(850);const s=await sample(),b=baselines[width+'x'+height];const frameDelta=Math.max(...Object.keys(b.frame).map(k=>Math.abs((b.frame[k]??0)-(s.frame[k]??0))));const goalDelta=Math.max(...b.goal.map((x,i)=>Math.abs(x-s.goal[i])));const rectDelta=Math.max(...['x','w'].map(k=>Math.abs(b.rect[k]-s.rect[k])));check('resize to '+width+'x'+height+' matches direct load',!s.inert&&!s.overflow&&frameDelta<.0001&&rectDelta<1,{sample:s,frameDelta,goalDelta,rectDelta});await page.screenshot({path:`${out}/panel-final-resize-${width}x${height}.png`});}
try{
 await direct(1366,900);await direct(1280,900);await direct(390,844);await direct(844,390);
 await page.setViewportSize({width:1366,height:900});await page.waitForTimeout(750);await resize(1280,900);
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(750);await resize(844,390);
 await page.setViewportSize({width:844,height:390});await page.waitForTimeout(750);await resize(390,844);
 check('no page errors',errors.length===0,errors);
}finally{await fs.writeFile(`${out}/panel-final-qa.json`,JSON.stringify({checks,errors,baselines},null,2));await browser.close();}
if(checks.some(c=>!c.pass))process.exitCode=1;
