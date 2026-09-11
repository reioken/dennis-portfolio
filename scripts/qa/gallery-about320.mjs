import fs from 'node:fs/promises';
import { chromium } from 'file:///C:/Users/denni/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
try{
 const page=await browser.newPage({viewport:{width:320,height:844},reducedMotion:'reduce'});
 await page.goto('http://localhost:4322/about/',{waitUntil:'networkidle'});
 if(process.env.ABOUT_PATCH)await page.addStyleTag({content:await fs.readFile('src/components/work/about-panel.css','utf8')});
 await page.waitForFunction(()=>!document.documentElement.classList.contains('gl-pending'),null,{timeout:25000});
 for(const reading of [false,true]){
 if(reading)await page.locator('.hall-panel__reading').click();
 console.log(JSON.stringify({reading,geometry:await page.locator('.hall-panel,.hall-panel__body,.about-panel__head,.about-panel__id,.about-panel__surname').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{cls:e.className,x:r.x,y:r.y,w:r.width,h:r.height,scrollWidth:e.scrollWidth,width:e.clientWidth,whiteSpace:s.whiteSpace}}))},null,2));
 if(await page.locator('.hall-panel__body,.about-panel__head,.about-panel__id').evaluateAll(es=>es.some(e=>e.scrollWidth>e.clientWidth+1)))throw new Error('About content overflows at320px, reading='+reading);
 await page.screenshot({path:'.source-assets/polish-2026-09-11/gallery-about320-'+(reading?'reading':'normal')+'.png'});
 }
}finally{await browser.close();}
