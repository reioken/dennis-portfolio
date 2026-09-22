import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.argv[2]; const S = process.argv[3];
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist'] });
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs=[]; page.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,200))}); page.on('pageerror',e=>errs.push(String(e).slice(0,200)));
const reqs=[]; page.on('request',r=>{if(/nori|taxi|character|ash-idle/.test(r.url()))reqs.push(r.url().split('/').slice(-2).join('/'))});
await page.goto(BASE+'/',{waitUntil:'domcontentloaded'}); await page.waitForTimeout(12000);
const bed={x:150,y:640,width:300,height:160};
await page.screenshot({path:S+'/blue-0-start.png'});
// hover the cat for 2 s: must stay asleep
const pet=page.locator('button[aria-label="Blue streicheln"]'); const box=await pet.boundingBox(); console.log('pet box',box);
await page.mouse.move(box.x+box.width/2,box.y+box.height/2); await page.waitForTimeout(2500);
await page.screenshot({path:S+'/blue-1-hover.png',clip:bed});
// browse three stations and come back
for(let i=0;i<3;i++){await page.keyboard.press('ArrowRight');await page.waitForTimeout(1500);} await page.screenshot({path:S+'/blue-2-station4.png'});
for(let i=0;i<3;i++){await page.keyboard.press('ArrowLeft');await page.waitForTimeout(1500);} await page.waitForTimeout(1500);
await page.screenshot({path:S+'/blue-3-back.png',clip:bed});
// click him
const box2=await pet.boundingBox(); await page.mouse.click(box2.x+box2.width/2,box2.y+box2.height/2); await page.waitForTimeout(4000);
await page.screenshot({path:S+'/blue-4-clicked.png',clip:bed});
console.log('mascot requests',reqs,'ERRORS',errs);
await b.close();
