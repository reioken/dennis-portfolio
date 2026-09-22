// Deterministic motion strips: non-nominal turns, lying down, ascent and the roof perch.
// Output must stay outside the project so Vite cannot reload a running capture.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
const out=path.resolve(process.env.QA_OUT || path.join(tmpdir(),'blue-motion'));
if(out.startsWith(process.cwd()))throw new Error('Output must be outside the project');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
const report={errors:[],scenarios:[]};
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(process.env.QA_BASE_URL || 'http://localhost:4322/');
 await page.waitForFunction(()=>window.__hall?.readyDone && window.__hall.blue,undefined,{timeout:120000});
 await page.waitForTimeout(2500);
 await page.evaluate(()=>window.__hall.stop());
 for(const scenario of (process.env.QA_SCENARIOS?.split(',') || ['turn20','turn60','turn120','settle','jump','perch','perchcompact'])){
  if(scenario==='perchcompact')await page.setViewportSize({width:390,height:900});
  await page.evaluate(scenario=>{
   const h=window.__hall,b=h.blue; b.mixer.stopAllAction();b.layer=undefined;
   b.wanted=()=>b.plan;
   b.pendingHappy=false;b.pendingPet=null;b.purr=0;b.toy=null;b.inBed=false;b.undisturbed=false;b.elevation=0;b.faceYaw=null;
   b.body.position.set(-1.35,0,.8);b.body.rotation.set(0,0,0);b.plan={kind:'home'};
   b.enter('idle');b.idle.play();b.walk.play();b.dwell=100;
   for(let i=0;i<60;i++)b.update(1/60,h.camera,true,false);
   const V=b.body.position.constructor,p=b.body.getWorldPosition(new V());
   h.camera.position.copy(p).add(new V(1.1,.8,1.45));h.camera.lookAt(p.x,p.y+.15,p.z);h.camera.updateProjectionMatrix();
   if(scenario.startsWith('turn')){const angle=Number(scenario.slice(4))*Math.PI/180;b.goal.copy(b.body.position).add(new V(Math.sin(angle),0,Math.cos(angle)));b.startTurn(angle,'walk');}
   if(scenario==='settle') b.enter('settle');
   if(scenario==='jump'){
    b.body.position.set(0,0,.8);b.body.rotation.set(0,Math.PI,0);b.plan={kind:'perch'};
    b.startJump(b.body.position,b.ledgeSpot(),true);
    p.copy(b.root.position);h.camera.position.copy(p).add(new V(3.4,2.7,3.5));h.camera.lookAt(p.x,1.55,p.z+.1);h.camera.updateProjectionMatrix();
   }
   if(scenario.startsWith('perch')){
    b.body.position.copy(b.ledgeSpot());b.elevation=b.body.position.y;b.plan={kind:'perch'};b.enter('perch');
    p.copy(b.root.position).sub(b.shift);h.camera.position.copy(p).add(new V(1.35,2.8,1.8));h.camera.lookAt(p.x,2.04,p.z+.14);h.camera.updateProjectionMatrix();
   }
  },scenario);
  const frames=[],trace=[],total=scenario==='settle'?4.8:scenario==='jump'?1.85:scenario.startsWith('perch')?2.8:1.6;
  for(let frame=0;frame<16;frame++){
   trace.push(await page.evaluate(({dt,first})=>{
    const h=window.__hall,b=h.blue;
    const n=Math.max(1,Math.round(dt*60));if(!first)for(let i=0;i<n;i++)b.update(dt/n,h.camera,true,false);
    h.dirty=h.mirrorDirty=true;h.renderFrame();
    const paws={};for(const name of ['FrontPawL','FrontPawR','HindPawL','HindPawR']){const v=b.body.position.clone();b.model.getObjectByName(name)?.getWorldPosition(v);paws[name]=v.toArray();}
    return{age:b.age,mood:b.mood,yaw:b.yaw,position:b.body.position.toArray(),paws};
   },{dt:total/15,first:frame===0}));
   const compact=scenario==='perchcompact';
   frames.push(await page.screenshot({clip:{x:compact?0:420,y:150,width:compact?390:600,height:600}}));
  }
  const cells=await Promise.all(frames.map(async(input,i)=>({input:await sharp(input).resize(300,300).png().toBuffer(),left:i%4*300,top:Math.floor(i/4)*300})));
  await sharp({create:{width:1200,height:1200,channels:3,background:'#202020'}}).composite(cells).png().toFile(path.join(out,scenario+'.png'));
  report.scenarios.push({scenario,trace});
  if(scenario.startsWith('perch')){
   const paws=trace.at(-1).paws;
   for(const side of ['L','R']){
    assert.ok(Math.abs(paws['FrontPaw'+side][2]-.409942)<.015,scenario+' forewrists at lip');
    assert.ok(paws['HindPaw'+side][2]<.25,scenario+' hind paws stay behind forepaws');
    assert.ok(paws['HindPaw'+side][1]>1.96,scenario+' hind paws supported above roof');
   }
   if(scenario==='perch')for(const width of [390,1440]){
    await page.setViewportSize({width,height:900});
    const resized=await page.evaluate(()=>{const h=window.__hall,b=h.blue;for(let i=0;i<65;i++)b.update(1/60,h.camera,true,false);b.body.updateWorldMatrix(true,true);const p=b.model.getObjectByName('FrontPawL').getWorldPosition(b.body.position.clone());return p.toArray();});
    assert.ok(Math.abs(resized[2]-.409942)<.015,'resize keeps forewrists at roof edge');
    assert.ok(Math.abs(resized[1]-1.95)<.025,'resize keeps forewrists at roof height');
   }
  }
 }
}finally{await browser.close();}
await fs.writeFile(path.join(out,process.env.QA_SCENARIOS?'report-'+process.env.QA_SCENARIOS+'.json':'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({out,errors:report.errors}));
if(report.errors.length)process.exitCode=1;
