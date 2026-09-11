/** Render the original metallic CSS cube once, at build-authoring time.
 * Run with PLAYWRIGHT_MODULE pointing to a Playwright installation when not installed locally.
 * 288 frames at 60 fps in a native animated image. No browser-side 3D or sprite clocks.
 */
import fs from 'node:fs/promises';
import sharp from 'sharp';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
try{
 const page=await browser.newPage({viewport:{width:64,height:64},deviceScaleFactor:2});
 await page.setContent(await fs.readFile('scripts/assets/loading-prism.html','utf8'));
 await page.evaluate(()=>document.getAnimations().forEach(a=>a.pause()));
 const frames=[];
 for(let i=0;i<288;i++){
  await page.evaluate(time=>document.getAnimations().forEach(a=>a.currentTime=time),i*1000/60);
  const input=await page.screenshot({omitBackground:true});
  frames.push(await sharp(input).ensureAlpha().raw().toBuffer());
 }
 const path='public/media/ui/loading-prism-loop.webp';
 await sharp(Buffer.concat(frames),{raw:{width:128,height:128*frames.length,channels:4,pageHeight:128}})
  .webp({quality:85,alphaQuality:100,effort:6,loop:0,
   delay:frames.map((_,i)=>Math.round((i+1)*1000/60)-Math.round(i*1000/60))}).toFile(path);
 await sharp(frames[0],{raw:{width:128,height:128,channels:4}}).webp({quality:90}).toFile('public/media/ui/loading-prism-still.webp');
 console.log(JSON.stringify({path,frames:frames.length,bytes:(await fs.stat(path)).size}));
}finally{await browser.close();}
