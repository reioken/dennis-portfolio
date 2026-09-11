import { chromium } from 'file:///C:/Users/denni/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});const rows=[];
try{
 for(const v of [{width:390,height:844},{width:844,height:390},{width:1366,height:900}]){
  const context=await browser.newContext({viewport:v,reducedMotion:'reduce'});const page=await context.newPage();
  for(const route of ['saute-survivors','riftback']){
   await page.goto(`http://localhost:4322/work/${route}/`,{waitUntil:'networkidle'});
   await page.evaluate(()=>{Element.prototype.requestFullscreen=undefined;});
   await page.locator('.captures__large').click();
   if(route==='riftback')await page.locator('.closeup__chips button').nth(1).click();
   await page.locator(v.width<900?'.closeup__fs':'.closeup__rail-btn--grow').click();await page.locator('.gallery-view').waitFor();await page.waitForTimeout(200);
   const geometry=await page.evaluate(()=>{const s=document.querySelector('.gallery-view__stage').getBoundingClientRect(),i=document.querySelector('.gallery-view__image').getBoundingClientRect();return{stage:{x:s.x,y:s.y,w:s.width,h:s.height},image:{x:i.x,y:i.y,w:i.width,h:i.height},ok:i.height<=s.height+1&&i.width<=s.width+1&&Math.abs(s.x+s.width/2-i.x-i.width/2)<2&&Math.abs(s.y+s.height/2-i.y-i.height/2)<2};});
   rows.push({viewport:v,route,...geometry});console.log(JSON.stringify(rows.at(-1)));
   await page.screenshot({path:`.source-assets/polish-2026-09-11/gallery-layout-${v.width}-${route}.png`});
  }
  await context.close();
 }
}finally{await browser.close();}
await fs.writeFile('.source-assets/polish-2026-09-11/gallery-layout.json',JSON.stringify(rows,null,2));
if(rows.some(r=>!r.ok))process.exitCode=1;
