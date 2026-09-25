// Lightbox in a landscape phone (844x390, preview server 4322). Project pages below 900 px are native since d58c490
// (2026-09-17): no close-up, a tap on a carousel slide opens the lightbox directly, so the probe asserts the native page
// and enters the lightbox from there. The image must fit and centre in the stage.
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import {base,outDir,expectNativeCase,openNativeLightbox} from './_env.mjs';
const BASE=base('http://localhost:4322');
const out=outDir('polish-2026-09-11');
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
try{
 const page=await browser.newPage({viewport:{width:844,height:390},reducedMotion:'reduce'});
 await page.goto(BASE+'/work/saute-survivors/',{waitUntil:'networkidle'});
 if(process.env.GALLERY_INJECT)await page.addStyleTag({content:await fs.readFile('src/components/work/gallery-lightbox.css','utf8')});
 console.log(JSON.stringify({native:await expectNativeCase(page)}));
 const fit=await openNativeLightbox(page,0);await page.waitForTimeout(250);
 if(!fit.ok)throw new Error('Lightbox image must fit and center in landscape stage '+JSON.stringify(fit));
 await page.screenshot({path:out+'/gallery-landscape-final.png'});
 console.log(JSON.stringify(await page.locator('.gallery-view__stage,.gallery-view__figure,.gallery-view__figure picture,.gallery-view__figure img,.gallery-view__figure source').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {tag:e.tagName,cls:e.className,x:r.x,y:r.y,w:r.width,h:r.height,style:e.getAttribute('style'),display:s.display,position:s.position,align:s.alignItems,rows:s.gridTemplateRows,cols:s.gridTemplateColumns,maxHeight:s.maxHeight,height:s.height}})),null,2));
}finally{await browser.close();}
