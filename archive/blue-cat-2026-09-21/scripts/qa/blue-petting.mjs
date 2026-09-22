// Real pointerdown, held strokes, touch and keyboard; output goes outside the project
// while the dev browser is running. Do not edit the project during this script.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({headless:true,args:['--use-angle=d3d11']});
const report=[];
try {
 for(const [width,height,touch] of [[1440,900,false],[390,844,true]]) {
  const page=await browser.newPage({viewport:{width,height},hasTouch:touch,isMobile:touch});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.QA_BASE_URL||'http://localhost:4321/');
  await page.waitForFunction(()=>window.__hall?.readyDone,{timeout:120000});await page.waitForTimeout(6500);
  await page.evaluate(()=>window.__hall.stop());
  const pose=async mood=>page.evaluate(mood=>{
   const h=window.__hall,b=h.blue;
   b.undisturbed=false;b.pendingHappy=false;b.pendingPet=null;b.purr=0;b.touchAmount=0;b.inBed=false;b.elevation=0;
   b.enter('idle');b.body.position.set(-1.35,0,.8);b.body.rotation.set(0,0,0);
   b.enter(mood);b.dwell=100;
   for(let i=0;i<45;i++)b.update(1/60,h.camera,true,false);
   const V=b.body.position.constructor,p=new V();b.body.getWorldPosition(p);
   h.camera.position.copy(p).add(new V(1.8,.8,1.6));h.camera.lookAt(p.x,p.y+.2,p.z);h.camera.updateProjectionMatrix();
   b.update(0,h.camera,true,false);h.dirty=h.mirrorDirty=true;h.renderFrame();
  },mood);
  const target=async region=>page.evaluate(region=>{
   const h=window.__hall,b=h.blue,V=b.body.position.constructor,p=new V();
   b.model.getObjectByName(region==='head'?'Head':region==='back'?'Spine':'Tail3').getWorldPosition(p);p.project(h.camera);
   const r=h.renderer.domElement.getBoundingClientRect(),cx=r.left+(p.x+1)*r.width/2,cy=r.top+(1-p.y)*r.height/2;
   for(const d of [[0,0],[-4,0],[4,0],[0,-4],[0,4],[-8,0],[8,0],[0,-8],[0,8],[-12,-8],[12,-8]]){
    const x=cx+d[0],y=cy+d[1];const hit=h.blueAt(x,y);
    if(hit&&b.region(hit)===region)return {x,y};
   }return null;
  },region);
  const tick=async n=>page.evaluate(n=>{const h=window.__hall,b=h.blue;for(let i=0;i<n;i++)b.update(1/60,h.camera,true,false);h.dirty=h.mirrorDirty=true;h.renderFrame();return {mood:b.mood,amount:b.touchAmount,purr:b.purr,region:b.touchRegion,pending:b.pendingPet,flick:b.flick?.isRunning(),focus:h.focus,position:b.body.position.toArray()};},n);
  for(const region of ['head','back','tail']){
   await pose('idle');const pt=await target(region);assert.ok(pt,`${width}: visible ${region} is hittable after sleeping`);
   if(touch)await page.touchscreen.tap(pt.x,pt.y);
   else{await page.mouse.move(pt.x,pt.y);await page.mouse.down();}
   const down=await tick(3);
   assert.equal(down.region,region);assert.ok(down.amount>.5,'response is already visible within 50 ms');
   if(region==='head')assert.equal(down.mood,'happy');
   if(region==='back')assert.equal(down.mood,'arch');
   if(region==='tail')assert.equal(down.flick,true);
   if(!touch)await page.mouse.up();
   assert.equal(new URL(page.url()).pathname,'/');assert.equal(down.focus,0);
   report.push({width,region,down});
  }
  if(touch){
   await pose('idle');
   const pt=await page.locator('.hall__blue-pet').boundingBox();assert.ok(pt);
   const x=pt.x+pt.width/2,y=pt.y+pt.height/2;
   const cdp=await page.context().newCDPSession(page);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
   for(let i=0;i<15;i++){
    await page.waitForTimeout(80);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+(i%2?18:-18),id:1}]});
    await tick(6);
   }
   const held=await tick(0);
   assert.ok(held.purr>.8,'vertical finger strokes keep feeding the response: '+JSON.stringify(held));
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   assert.equal(held.focus,0,'petting never swipes to another cabinet');
   report.push({width,stroke:'vertical touch',held});
   await cdp.detach();
  }else{
   await pose('idle');const pt=await target('back');await page.mouse.move(pt.x,pt.y);await page.mouse.down();
   for(let i=0;i<15;i++){await page.waitForTimeout(80);await page.mouse.move(pt.x+(i%2?5:-5),pt.y);await tick(6);}
   const held=await tick(0);assert.ok(held.purr>.8,'a stroke lasting 1.5 s still feeds the response');assert.ok(held.amount>.9);
   await page.mouse.up();const released=await tick(100);assert.ok(released.amount<.05,'release settles the response');
   await pose('idle');await page.locator('.hall__blue-pet').focus();await page.keyboard.press('Enter');assert.equal((await tick(3)).mood,'happy');
   // The actual sleeping skin and its bounds must also accept a click. The last
   // touched surface is retained until the wake clip finishes.
   await pose('sleep');const sleepPt=await target('back');assert.ok(sleepPt,'curled back is hittable');
   await page.mouse.click(sleepPt.x,sleepPt.y);const waking=await tick(3);assert.equal(waking.mood,'wake');assert.equal(waking.pending,'back');
   const wakeFrames=await page.evaluate(()=>Math.ceil(window.__hall.blue.actions.get('wake').getClip().duration*60)+6);assert.equal((await tick(wakeFrames)).mood,'arch','a back touch is still a back touch after waking');
  }
  assert.deepEqual(errors,[]);await page.close();
 }
}finally{await browser.close();}
console.log(JSON.stringify(report));
