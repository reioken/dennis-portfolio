// Room lighting per hall stop (dev server, 4321: needs window.__hall): focus follows the rail, power stays 1. Sweeps a few
// stops, the last one (read from the rail: About, the machines, Contact) and back to the first.
import{chromium}from'playwright';import fs from'node:fs/promises';import assert from'node:assert/strict';
import {base,outDir} from './_env.mjs';
const BASE=base('http://localhost:4321');
const out=outDir('hall-light-qa');
await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
try{const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await page.goto(BASE+'/');await page.waitForFunction(()=>window.__hall?.readyDone,null,{timeout:60000});const last=await page.locator('.hall-dock__rail button').count()-1;await page.waitForTimeout(7500);
for(const i of [0,1,2,3,4,5,8,last,0]){await page.locator('.hall-dock__rail button').nth(i).click();await page.waitForTimeout(1100);const result=await page.evaluate(()=>{const h=window.__hall;return{focus:h.focus,pose:h.pose,power:h.roomLighting.power.value,quality:h.perfLevel,weights:h.roomLighting.weights.slice(0,5),slots:h.roomLighting.slots.map(s=>({index:s.index,x:s.screen.position.x,intensity:s.screen.intensity})),programs:h.renderer.info.programs.length};});assert.equal(result.focus,i);assert.equal(result.power,1);if(i<4)await page.screenshot({path:`${out}/hall-${i}.png`});console.log(JSON.stringify(result));}
assert.equal(errors.length,0,errors.join('\n'));await fs.writeFile(out+'/sweep.json',JSON.stringify({errors},null,2));}finally{await browser.close();}
