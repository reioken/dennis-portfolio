// About back button, portrait and the panel return paths (dev server, 4321: needs window.__hall) at 1440, 3789 and
// 390 px. Below 900 px the station rail is hidden, so stations are reached with the dock arrows there; Nexus opens as a
// native project page (d58c490) and its back button still returns to the same hall instance.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {base,outDir} from './_env.mjs';
const BASE=base('http://localhost:4321');
const out=outDir('portrait-navigation-qa');
/** Focus hall stop i: the rail where it is shown, otherwise the dock arrows (phones). */
async function goTo(page,i){
 if(await page.locator('.hall-dock__rail').isVisible())await page.locator('.hall-dock__rail button').nth(i).click();
 else{const focus=()=>page.evaluate(()=>window.__hall.focus);for(let n=0;n<40&&await focus()!==i;n++){await page.locator(await focus()<i?'.hall-dock__arrow--next':'.hall-dock__arrow--prev').click();await page.waitForTimeout(300);}assert.equal(await focus(),i);}
 await page.waitForTimeout(800);
}
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});const results=[];await fs.mkdir(out,{recursive:true});
try{for(const [width,height] of [[1440,900],[3789,1896],[390,844]]){
 const page=await browser.newPage({viewport:{width,height}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto(BASE+'/about/');await page.waitForFunction(()=>window.__hall?.readyDone,null,{timeout:60000});await page.waitForTimeout(7500);
 assert.equal(await page.locator('.hall-panel__reading,.site-nav__back').count(),0);
 await page.locator('.hall-panel__back').waitFor({state:'visible'});
 const data=await page.evaluate(()=>{const b=document.querySelector('.hall-panel__back'),p=document.querySelector('.hall-panel__card'),im=document.querySelector('.about-poster__image img'),r=b.getBoundingClientRect();window.__qaHall=window.__hall;return {button:r.toJSON(),panel:p.getBoundingClientRect().toJSON(),portrait:im.getBoundingClientRect().toJSON(),image:im.currentSrc,overflow:document.documentElement.scrollWidth>innerWidth,buttonAtPoint:b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};});
 assert.ok(data.image.includes('portrait-wide-v2'));assert.equal(data.overflow,false);assert.equal(data.buttonAtPoint,true);assert.ok(data.button.width>=44&&data.button.height>=44);if(width>=900)assert.ok(data.button.right<data.panel.left);
 for(const id of ['about-story','about-experience','about-training','about-expertise'])assert.equal(await page.locator('#'+id).count(),1);
 await page.screenshot({path:out+'/'+width+'.png'});
 await page.locator('.hall-panel__back').click();await page.waitForURL(BASE+'/');await page.waitForTimeout(500);assert.ok(await page.evaluate(()=>window.__hall===window.__qaHall));
 await goTo(page,2);await page.locator('.hall-dock__open').click();await page.waitForURL('**/work/nexus/');await page.locator('.hall-panel__back').click();await page.waitForURL(BASE+'/');
 await goTo(page,await page.locator('.hall-dock__rail button').count()-1);await page.locator('.hall-dock__open').click();await page.waitForURL('**/contact/');await page.locator('.hall-panel__back').waitFor({state:'visible'});await page.keyboard.press('Escape');await page.waitForURL(BASE+'/');
 assert.equal(errors.length,0,errors.join('\n'));results.push({width,height,...data,errors});console.log(JSON.stringify(results.at(-1)));await page.close();
}}finally{await browser.close();}await fs.writeFile(out+'/results.json',JSON.stringify(results,null,2));
