import fs from 'node:fs/promises';
import { chromium } from 'file:///C:/Users/denni/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
try{
 const page=await browser.newPage({viewport:{width:844,height:390},reducedMotion:'reduce'});
 await page.goto('http://localhost:4322/work/saute-survivors/',{waitUntil:'networkidle'});
 if(process.env.GALLERY_INJECT)await page.addStyleTag({content:await fs.readFile('src/components/work/gallery-lightbox.css','utf8')});
 await page.evaluate(()=>{Element.prototype.requestFullscreen=undefined;});
 await page.locator('.captures__large').click();await page.locator('.closeup__fs').click();await page.waitForTimeout(500);
 if(!await page.evaluate(()=>{const s=document.querySelector('.gallery-view__stage').getBoundingClientRect(),i=document.querySelector('.gallery-view__image').getBoundingClientRect();return i.height<=s.height+1&&i.width<=s.width+1&&Math.abs(s.x+s.width/2-i.x-i.width/2)<2&&Math.abs(s.y+s.height/2-i.y-i.height/2)<2}))throw new Error('Lightbox image must fit and center in landscape stage');
 await page.screenshot({path:'.source-assets/polish-2026-09-11/gallery-landscape-final.png'});
 console.log(JSON.stringify(await page.locator('.gallery-view__stage,.gallery-view__figure,.gallery-view__figure picture,.gallery-view__figure img,.gallery-view__figure source').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {tag:e.tagName,cls:e.className,x:r.x,y:r.y,w:r.width,h:r.height,style:e.getAttribute('style'),display:s.display,position:s.position,align:s.alignItems,rows:s.gridTemplateRows,cols:s.gridTemplateColumns,maxHeight:s.maxHeight,height:s.height}})),null,2));
}finally{await browser.close();}
