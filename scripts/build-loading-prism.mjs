/** Deterministically render beveled, closed 3D panels offline. Playback remains a native
 * animated image, independent of the main thread preparing the portfolio's 3D room. */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
try {
 const page=await browser.newPage({viewport:{width:96,height:96},deviceScaleFactor:2});
 await page.route('https://prism.local/three/**',async route=>{const relative=new URL(route.request().url()).pathname.replace('/three/','');const root=path.resolve('node_modules/three');const file=path.resolve(root,relative);if(!file.startsWith(root+path.sep))return route.abort();await route.fulfill({path:file,contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'}});});
 await page.setContent(await fs.readFile('scripts/assets/loading-prism.html','utf8'));
 await page.waitForFunction(()=>window.prismReady);
 const frames=[],corners=[];
 for(let i=0;i<288;i++) {
  corners.push(await page.evaluate(time=>window.renderPrism(time),i*1000/60));
  const input=await page.screenshot({omitBackground:true});frames.push(await sharp(input).ensureAlpha().raw().toBuffer());
 }
 const output='public/media/ui/loading-prism-v2-loop.webp';
 await sharp(Buffer.concat(frames),{raw:{width:192,height:192*frames.length,channels:4,pageHeight:192}}).webp({quality:90,alphaQuality:100,effort:6,loop:0,delay:frames.map((_,i)=>Math.round((i+1)*1000/60)-Math.round(i*1000/60))}).toFile(output);
 await sharp(frames[0],{raw:{width:192,height:192,channels:4}}).webp({quality:94}).toFile('public/media/ui/loading-prism-v2-still.webp');
 await fs.mkdir('.source-assets/prism-fix',{recursive:true});await fs.writeFile('.source-assets/prism-fix/corner-tracks.json',JSON.stringify(corners));
 console.log(JSON.stringify({output,frames:frames.length,bytes:(await fs.stat(output)).size}));
} finally {await browser.close();}
