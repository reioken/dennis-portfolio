import {chromium} from 'file:///C:/Users/denni/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';import assert from 'node:assert/strict';import sharp from 'sharp';import {createHash} from 'node:crypto';
const css=await fs.readFile('src/components/hall/hall-loading.css','utf8');const guard=await fs.readFile('src/components/hall/HallGuard.astro','utf8');const markup=guard.slice(guard.indexOf('<div class="hall-startup"'),guard.indexOf('<script is:inline'));
// Screencast delivery may skip refreshes; verify ongoing pixel changes, not every source frame.
const meta=await sharp('public/media/ui/loading-prism-v2-loop.webp',{animated:true}).metadata();assert.equal(meta.pages,288);assert.equal(meta.loop,0);assert.equal(meta.delay.reduce((a,b)=>a+b,0),4800);
// Pixel continuity catches edge-on face popping that a frame-clock test alone misses.
const {data:sequence,info:sequenceInfo}=await sharp('public/media/ui/loading-prism-v2-loop.webp',{animated:true}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const frameBytes=sequenceInfo.width*sequenceInfo.pageHeight*4;
const differences=Array.from({length:meta.pages},(_,i)=>{let sum=0;const previous=(i+meta.pages-1)%meta.pages;for(let j=0;j<frameBytes;j++)sum+=Math.abs(sequence[i*frameBytes+j]-sequence[previous*frameBytes+j]);return sum/frameBytes;});
const sorted=[...differences].sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length/2)];
assert.ok(sorted[0]>.5,'A frame visibly stalls');
assert.ok(sorted.at(-1)<median*3,'A face pops abruptly between frames');
assert.ok(differences[0]<median*2,'The loop boundary jumps');
console.log(JSON.stringify({sequence:{min:sorted[0],median,max:sorted.at(-1),loop:differences[0]}}));
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});const results=[];
try{for(const variant of ['native']){
const page=await browser.newPage({viewport:{width:500,height:500}});await page.route('**/media/ui/loading-prism-v2-loop.webp',r=>r.fulfill({path:'public/media/ui/loading-prism-v2-loop.webp',contentType:'image/webp'}));
await page.setContent(`<html class="gl-pending"><base href="http://localhost:4322"><style>body{background:#08090e}${css}.hall-startup__orbit,.hall-startup__glint,.hall-startup__signal{visibility:hidden!important}</style><body>${markup}</body></html>`);await page.locator('img').evaluate(img=>img.decode());
const cdp=await page.context().newCDPSession(page);const frames=[];cdp.on('Page.screencastFrame',e=>{frames.push({ts:e.metadata.timestamp,buffer:Buffer.from(e.data,'base64')});cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});});await cdp.send('Page.startScreencast',{format:'png',maxWidth:500,maxHeight:500,everyNthFrame:1});await page.waitForTimeout(500);
const blocked=await page.evaluate(()=>{const start=Date.now()/1000;const t=performance.now();while(performance.now()-t<14400){}return {start,end:Date.now()/1000};});await page.waitForTimeout(300);await cdp.send('Page.stopScreencast');const during=frames.filter(f=>f.ts>blocked.start+.1&&f.ts<blocked.end-.1);let previous,held,largest=0;const samples=[];for(const f of during){const crop=await sharp(f.buffer).extract({left:190,top:178,width:120,height:120}).raw().toBuffer();const hash=createHash('sha1').update(crop).digest('hex');if(hash!==previous){if(held)largest=Math.max(largest,f.ts-held);held=f.ts;previous=hash;}samples.push({ts:f.ts,hash});}largest=Math.max(largest,blocked.end-held);assert.ok(largest<.2,`Cube held for ${largest}s`);assert.ok(new Set(samples.map(f=>f.hash)).size>140,'Too few distinct cube frames');results.push({variant,blocked,during:during.length,distinct:new Set(samples.map(f=>f.hash)).size,largestHold:largest});await page.close();console.log(JSON.stringify(results.at(-1)));}
}finally{await browser.close();}await fs.mkdir('.source-assets/smoothness-2026-09-11',{recursive:true});await fs.writeFile('.source-assets/smoothness-2026-09-11/prism-motion.json',JSON.stringify(results,null,2));
