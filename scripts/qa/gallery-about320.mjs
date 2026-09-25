// About panel at 320 px (preview server, 4322): nothing may overflow sideways. The reading-mode pass was removed with
// the reading mode (012b6da, 2026-09-12).
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import {base,outDir} from './_env.mjs';
const BASE=base('http://localhost:4322');
const out=outDir('polish-2026-09-11');
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
try{
 const page=await browser.newPage({viewport:{width:320,height:844},reducedMotion:'reduce'});
 await page.goto(BASE+'/about/',{waitUntil:'networkidle'});
 if(process.env.ABOUT_PATCH)await page.addStyleTag({content:await fs.readFile('src/components/work/about-panel.css','utf8')});
 await page.waitForFunction(()=>!document.documentElement.classList.contains('gl-pending'),null,{timeout:25000});
 console.log(JSON.stringify({geometry:await page.locator('.hall-panel,.hall-panel__body,.about-panel__head,.about-panel__id,.about-panel__surname').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{cls:e.className,x:r.x,y:r.y,w:r.width,h:r.height,scrollWidth:e.scrollWidth,width:e.clientWidth,whiteSpace:s.whiteSpace}}))},null,2));
 if(await page.locator('.hall-panel__body,.about-panel__head,.about-panel__id').evaluateAll(es=>es.some(e=>e.scrollWidth>e.clientWidth+1)))throw new Error('About content overflows at 320px');
 await page.screenshot({path:out+'/gallery-about320-normal.png'});
}finally{await browser.close();}
