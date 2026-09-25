// Startup cue, reduced motion, WebGL-less and JS-less fallbacks (preview server, 4322). The last step loads a project at
// 390 px, which is a native page since d58c490 (2026-09-17): it asserts that page (hall not booted) and screenshots it.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {base,outDir,expectNativeCase} from './_env.mjs';
const BASE=base('http://localhost:4322');
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});const out=outDir('polish-2026-09-11'),results=[];
try{
 const normal=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'no-preference'}),p=await normal.newPage();
 await p.goto(BASE+'/',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>document.querySelector('.hall__stage[data-power="on"]'),null,{timeout:20000});const start=Date.now();
 await p.screenshot({path:`${out}/startup-ignition.png`});await p.waitForTimeout(1800);assert.equal(await p.locator('.hall__stage').getAttribute('data-power'),'on');await p.screenshot({path:`${out}/startup-flicker.png`});
 await p.waitForFunction(()=>document.querySelector('.hall.is-3d')&&!document.querySelector('.hall__stage[data-power]'),null,{timeout:8500});const elapsed=Date.now()-start;assert.ok(elapsed>=3600);await p.screenshot({path:`${out}/startup-lit.png`});results.push({mode:'normal-motion',cueElapsed:elapsed});await normal.close();
 const reduced=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),r=await reduced.newPage();await r.goto(BASE+'/',{waitUntil:'networkidle'});await r.waitForFunction(()=>document.querySelector('.hall.is-3d'));assert.equal(await r.locator('.hall__stage').getAttribute('data-power'),null);results.push({mode:'reduced-motion',cueSkipped:true});await reduced.close();
 const fallback=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});await fallback.addInitScript(()=>{window.__glOk=false});const f=await fallback.newPage();await f.goto(BASE+'/',{waitUntil:'networkidle'});assert.equal(await f.locator('.hall.is-3d').count(),0);assert.ok(await f.locator('.machine--kasse').isVisible());await f.locator('.hall-dock__arrow--next').click();await f.locator('.hall-dock__open').click();await f.waitForURL('**/work/**');results.push({mode:'webgl-disabled',cssNavigation:true});await f.screenshot({path:`${out}/fallback-project.png`});await fallback.close();
 const nojs=await browser.newContext({viewport:{width:390,height:844},javaScriptEnabled:false}),n=await nojs.newPage();await n.goto(BASE+'/',{waitUntil:'networkidle'});await n.locator('.machine--kasse').click();await n.waitForURL('**/about/');assert.ok(await n.locator('h1').isVisible());results.push({mode:'javascript-disabled',aboutNavigation:true});await nojs.close();
 console.log(JSON.stringify(results,null,2));await fs.writeFile(`${out}/startup-and-fallback.json`,JSON.stringify(results,null,2));
 const glass=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),g=await glass.newPage();await g.goto(BASE+'/work/riftback/',{waitUntil:'networkidle'});console.log(JSON.stringify({native390:await expectNativeCase(g)}));await g.waitForTimeout(500);await g.screenshot({path:`${out}/glass-${process.env.GLASS_PASS||'before'}-390.png`});await glass.close();
}finally{await browser.close()}
