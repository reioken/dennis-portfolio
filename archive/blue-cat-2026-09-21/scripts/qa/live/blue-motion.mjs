// Hosted build: real About navigation, timed movement frames, final phone perch.
import {chromium} from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const [base,outArg]=process.argv.slice(2),out=path.resolve(outArg);
if(out.startsWith(process.cwd()))throw new Error('Output must be outside the project');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 await page.goto(base+'/');
 await page.waitForFunction(()=>performance.getEntriesByName('hall:render-warm-end').length>0,null,{timeout:90000});
 await page.waitForTimeout(2500);
 await page.locator('a[href="/about/"]').first().click();
 const frames=[];
 for(let i=0;i<24;i++){await page.waitForTimeout(650);frames.push(await page.screenshot({clip:{x:0,y:56,width:760,height:760}}));}
 for(let k=0;k<2;k++){
  const cells=await Promise.all(frames.slice(k*12,k*12+12).map(async(input,i)=>({input:await sharp(input).resize(300,300).png().toBuffer(),left:i%4*300,top:Math.floor(i/4)*300})));
  await sharp({create:{width:1200,height:900,channels:3,background:'#202020'}}).composite(cells).png().toFile(path.join(out,'about-motion-'+k+'.png'));
 }
 await page.screenshot({path:path.join(out,'about-final.png')});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(1400);
 await page.screenshot({path:path.join(out,'phone-perch.png')});
 assert.equal(new URL(page.url()).pathname,'/about/');
 await fs.writeFile(path.join(out,'report.json'),JSON.stringify({base,errors},null,2));
 console.log(JSON.stringify({base,errors,out}));assert.deepEqual(errors,[]);
}finally{await browser.close();}
