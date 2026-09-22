// Rapid real pointer input must not flip the head, restart reactions or cancel travel.
// Screenshots are buffered until the browser closes; never edit the project during this test.
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import os from 'node:os';
const mode='polish';
const out=process.env.QA_OUT || path.join(os.tmpdir(),'blue-polish-qa');
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
const frames=[],report={mode,errors:[],scenarios:[]};
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(process.env.QA_BASE_URL||'http://localhost:4321/');
  await page.waitForFunction(()=>window.__hall?.readyDone,{timeout:120000});await page.waitForTimeout(6500);
  await page.evaluate(()=>window.__hall.stop());
  const pose=async()=>page.evaluate(()=>{
   const h=window.__hall,b=h.blue; b.mixer.stopAllAction();b.layer=undefined;
   b.undisturbed=false;b.pendingHappy=false;b.pendingPet=null;b.purr=0;b.touchAmount=0;b.inBed=false;b.elevation=0;
   b.enter('idle');b.idle.play();b.walk.play();b.body.position.set(-1.35,0,.8);b.body.rotation.set(0,0,0);b.dwell=100;
   for(let i=0;i<60;i++)b.update(1/60,h.camera,true,false);
   const V=b.body.position.constructor,p=new V();b.body.getWorldPosition(p);
   h.camera.position.copy(p).add(new V(1.8,.8,1.6));h.camera.lookAt(p.x,p.y+.2,p.z);h.camera.updateProjectionMatrix();
   b.update(0,h.camera,true,false);h.dirty=h.mirrorDirty=true;h.renderFrame();
   window.trace=[];window.previousPose=null;
  });
  const target=async (region,side=0)=>page.evaluate(({region,side})=>{
   const h=window.__hall,b=h.blue,V=b.body.position.constructor,p=new V();
   b.model.getObjectByName(region==='head'?'Head':region==='back'?'Spine':'Tail3').getWorldPosition(p);p.project(h.camera);
   const r=h.renderer.domElement.getBoundingClientRect(),cx=r.left+(p.x+1)*r.width/2,cy=r.top+(1-p.y)*r.height/2;
   for(let dy=-24;dy<=24;dy+=4)for(let dx=-24;dx<=24;dx+=4){
    const x=cx+dx,y=cy+dy,hit=h.blueAt(x,y);if(hit&&b.region(hit)===region){const local=b.body.worldToLocal(hit.point.clone());if(!side||local.x*side>.012)return{x,y};}
   }return null;
  },{region,side});
  const tick=async n=>page.evaluate(n=>{
   const h=window.__hall,b=h.blue;
   for(let i=0;i<n;i++){
    b.update(1/60,h.camera,true,false);
    const bones=['Head','Chest','Tail1'].map(name=>b.model.getObjectByName(name));
    const q=bones.map(bone=>bone.quaternion.clone());
    const delta=window.previousPose?q.map((v,j)=>v.angleTo(window.previousPose[j])*180/Math.PI):[0,0,0];window.previousPose=q;
    window.trace.push({mood:b.mood,age:b.age,time:b.layer?.time,rate:b.layer?.timeScale,region:b.touchRegion,flick:b.flick?.time,delta});
   }
   h.dirty=h.mirrorDirty=true;h.renderFrame();
  },n);
  for(const scenario of ['alternate','tail','turn','head']){
   await pose();
   if(scenario==='head')await page.evaluate(()=>{const h=window.__hall,b=h.blue,p=b.body.getWorldPosition(b.body.position.clone());h.camera.position.copy(p).add({x:0,y:.45,z:1.8});h.camera.lookAt(p.x,p.y+.22,p.z);h.camera.updateMatrixWorld();});
   if(scenario==='turn')await page.evaluate(()=>{const b=window.__hall.blue;b.goal.set(0,0,.8);b.arrival='idle';b.travelSpeed=.34;b.startTurn(Math.PI/2,'walk');});
   let hits=0;
   for(let i=0;i<24;i++){
    const region=scenario==='tail'?'tail':scenario==='turn'||scenario==='head'?'head':i%2?'back':'head';
    const p=await target(region,scenario==='head'?(i%2?1:-1):0);
    if(p){await page.mouse.click(p.x,p.y);hits++;}
    await tick(5);
    frames.push(await page.screenshot({clip:{x:400,y:180,width:600,height:550}}));
   }
   const trace=await page.evaluate(()=>window.trace);
   report.scenarios.push({scenario,hits,transitions:trace.filter((v,i)=>i&&v.mood!==trace[i-1].mood).length,maxDegreesPerFrame:[0,1,2].map(j=>Math.max(...trace.map(v=>v.delta[j]))),trace});
  }
}finally{await browser.close();}
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
for(let i=0;i<frames.length;i+=12){
 const cells=await Promise.all(frames.slice(i,i+12).map((b,j)=>sharp(b).resize(300,275,{fit:'contain'}).png().toBuffer().then(input=>({input,left:(j%4)*300,top:Math.floor(j/4)*275}))));
 await sharp({create:{width:1200,height:825,channels:3,background:'#202020'}}).composite(cells).png().toFile(path.join(out,`sheet-${i/12}.png`));
}
console.log(JSON.stringify({...report,scenarios:report.scenarios.map(({trace,...s})=>s)}));

assert.deepEqual(report.errors,[]);
for(const s of report.scenarios){
 assert.ok(s.hits>=22,s.scenario+' stays hittable');
 assert.ok(s.maxDegreesPerFrame[0]<8,s.scenario+' has no head snap');
 if(s.scenario==='head'||s.scenario==='alternate') assert.ok(s.maxDegreesPerFrame[0]<4,s.scenario+' head motion stays smooth under rapid input');
 if(s.scenario==='alternate') assert.ok(s.transitions<=2,'rapid region changes do not restart whole-body reactions');
 if(s.scenario==='tail') assert.equal(s.trace.filter((v,i)=>i&&v.flick<s.trace[i-1].flick).length,0,'tail flick completes without repeated resets');
 if(s.scenario==='turn') {assert.equal(s.trace[0].mood,'turn','petting cannot cancel a turn');assert.ok(s.trace.every(v=>v.mood==='turn'||v.mood==='walk'),'the mapped path remains in control');}
 assert.ok(s.trace.every(v=>!['happy','arch','sitarch'].includes(v.mood)||v.rate===1),'petting never accelerates a reaction');
}
