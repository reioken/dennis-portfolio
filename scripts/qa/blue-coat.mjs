// Firefox must upload Blue's prepared mip chain like the canvas reference.
// The original ImageBitmap upload turned whole UV islands black in About.
import { chromium, firefox } from 'playwright';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import fs from 'node:fs/promises';
const reports=[],shots=[];
for(const engine of (process.argv[2]?[process.argv[2]]:['chromium','firefox'])){
 const browser=await({chromium,firefox}[engine]).launch({headless:true,...(engine==='chromium'?{args:['--use-angle=d3d11']}: {})});
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto((process.env.QA_BASE_URL||'http://localhost:4321')+'/about/');
  await page.waitForFunction(()=>window.__hall?.readyDone&&window.__hall.blue?.mood==='perchidle',{timeout:120000});
  await page.waitForTimeout(1500);
  await page.evaluate(()=>{const h=window.__hall;h.stop();h.renderFrame();});
  const clip=await page.evaluate(()=>{const b=window.__hall.blue.button;return{x:Math.max(0,parseFloat(b.style.left)/100*innerWidth-260),y:Math.max(0,parseFloat(b.style.top)/100*innerHeight-280),width:520,height:550};});
  const current=await page.screenshot({clip});
  await page.evaluate(()=>{const h=window.__hall,b=h.blue,base=b.coat.map;const copy=image=>{const c=document.createElement('canvas');c.width=image.width;c.height=image.height;c.getContext('2d').drawImage(image,0,0);return c;};const t=base.clone();t.source=new base.source.constructor(copy(base.image));t.mipmaps=base.mipmaps.map(copy);t.generateMipmaps=false;t.needsUpdate=true;b.coat.map=t;b.coat.needsUpdate=true;h.renderFrame();});
  const reference=await page.screenshot({clip});
  const a=await sharp(current).removeAlpha().raw().toBuffer(),b=await sharp(reference).removeAlpha().raw().toBuffer();
  let darkened=0,changed=0;for(let i=0;i<a.length;i+=3){const x=(a[i]+a[i+1]+a[i+2])/3,y=(b[i]+b[i+1]+b[i+2])/3;if(y-x>12)darkened++;if(Math.abs(y-x)>12)changed++;}
  reports.push({engine,darkened,changed,errors});shots.push([engine+'-current',current],[engine+'-reference',reference]);
 }finally{await browser.close();}
}
// Never write into the project while a dev-server browser is running.
const out=process.env.QA_OUT||'.source-assets/blue/qa/coat';await fs.mkdir(out,{recursive:true});
for(const[n,b]of shots)await fs.writeFile(`${out}/${n}.png`,b);
await fs.writeFile(`${out}/report.json`,JSON.stringify(reports,null,2));console.log(JSON.stringify(reports));
for(const r of reports){assert.deepEqual(r.errors,[]);assert.ok(r.darkened<50,`${r.engine}: ${r.darkened} pixels unexpectedly darkened during texture upload`);}
