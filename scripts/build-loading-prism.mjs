/** Render the original metallic CSS cube once, at build-authoring time.
 * Run with PLAYWRIGHT_MODULE pointing to a Playwright installation when not installed locally.
 * 288 frames at 60 fps, packed into 72 columns and 4 rows. No browser-side 3D work.
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
  frames.push({input,left:(i%72)*128,top:Math.floor(i/72)*128});
 }
 const path='public/media/ui/loading-prism.webp';
 await sharp({create:{width:72*128,height:4*128,channels:4,background:'#00000000'}}).composite(frames).webp({quality:80,alphaQuality:80,effort:6}).toFile(path);
 console.log(JSON.stringify({path,frames:frames.length,bytes:(await fs.stat(path)).size}));
}finally{await browser.close();}