import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const out=process.env.QA_OUT || path.join(os.tmpdir(),'blue-cat-qa');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
const reports=[];
try {
  for(const [width,height,reduce] of [[1440,900,false],[390,844,false],[1440,900,true]]) {
    const page=await browser.newPage({viewport:{width,height},reducedMotion:reduce?'reduce':'no-preference'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.env.QA_BASE_URL || 'http://localhost:4321/');
    await page.waitForFunction(()=>window.__hall?.readyDone&&window.__hall?.blue,{timeout:90000});
    await page.waitForTimeout(reduce?600:7200);
    const initial=await page.evaluate(()=>{
      const h=window.__hall,b=h.blue;h.stop();
      return {position:b.body.position.toArray(),mood:b.mood,actions:[...b.actions.keys()],meshes:[],overflow:document.documentElement.scrollWidth>innerWidth,buttonHidden:b.button.hidden};
    });
    assert.deepEqual([...initial.actions].sort(),['arch','bedin','bedout','catch','flick','happy','idle','jumpdown','jumpup','perch','perchidle','playready','pounce','settle','sit','sitarch','sitidle','sleep','stand','swat','swatL','trot',...['L','R'].flatMap(side=>[15,30,45,60,90,120,180].map(angle=>`turn${side}${angle}`)),'unperch','wake','walk'].sort());
    assert.equal(initial.overflow,false); if(width>=900)assert.equal(initial.buttonHidden,false); // focused mobile cabinet framing can put the bed outside the view
    assert.equal(await page.getByRole('button', {name: 'Blue streicheln', includeHidden:true}).count(), 1);
    await page.screenshot({path:`${out}/${width}-${reduce?'reduced':'room'}.png`});
    const simulation=await page.evaluate(reduce=>{
      const h=window.__hall,b=h.blue;
      const before=b.body.position.toArray(),seen=new Set();let bad=0;
      if(!reduce)b.disturb(); // he starts the visit asleep; only the visitor wakes him
      for(let i=0;i<7200;i++){
        b.update(1/60,h.camera,true,reduce);seen.add(b.mood);
        if(!b.body.position.toArray().every(Number.isFinite)||b.body.position.x< -2.1||b.body.position.x>-.65||b.body.position.z<.1||b.body.position.z>1.6)bad++;
      }
      const after=b.body.position.toArray();
      const age=b.age;b.update(5,h.camera,false,reduce);
      const frozen=b.age===age;
      b.update(0,h.camera,true,reduce);
      return {seen:[...seen],bad,before,after,frozen};
    },reduce);
    assert.equal(simulation.bad,0);assert.equal(simulation.frozen,true);
    if(reduce)assert.deepEqual(simulation.before,simulation.after);
    else for(const mood of ['idle','walk','settle','sleep','wake'])assert.ok(simulation.seen.includes(mood),mood);
    await page.evaluate(()=>{
      const h=window.__hall,b=h.blue;b.body.position.set(-1.35,0,.62);b.enter('idle');
      // Mobile now frames one cabinet; focus this isolated interaction probe on Blue.
      if(innerWidth<900){b.root.updateWorldMatrix(true,true);const p=b.body.getWorldPosition(b.body.position.clone());h.camera.position.copy(p).add({x:0,y:.6,z:1.6});h.camera.lookAt(p.x,p.y+.15,p.z);h.camera.updateProjectionMatrix();h.camera.updateMatrixWorld();}
      for(let i=0;i<30;i++)b.update(1/60,h.camera,true,false);h.dirty=h.mirrorDirty=true;h.renderFrame();
    });
    const pet=page.locator('.hall__blue-pet');
    const rect=await pet.boundingBox();assert.ok(rect);await page.mouse.click(rect.x+rect.width/2,rect.y+rect.height/2);assert.ok(['happy','arch'].includes(await page.evaluate(()=>window.__hall.blue.mood)),'a body click purrs or arches');assert.equal(new URL(page.url()).pathname,'/');
    if(await pet.isVisible()) {
      await page.evaluate(()=>{const b=window.__hall.blue;b.enter('idle');});
      await pet.focus();await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(()=>window.__hall.blue.mood),'happy');
      assert.equal(new URL(page.url()).pathname,'/');
    }
    await page.evaluate(()=>{
      const h=window.__hall,b=h.blue;b.pet();for(let i=0;i<45;i++)b.update(1/60,h.camera,true,false);h.dirty=h.mirrorDirty=true;h.renderFrame();
    });
    const happy=await page.evaluate(()=>{const b=window.__hall.blue;return {mood:b.mood,blink:b.blink,ground:b.ground};});
    assert.equal(happy.mood,'happy');assert.ok(happy.blink>.9);
    await page.screenshot({path:`${out}/${width}-${reduce?'reduced-happy':'happy'}.png`});
    assert.equal(errors.length,0,errors.join('\n'));
    reports.push({width,height,reduce,initial,simulation,happy,errors});
    console.log(JSON.stringify(reports.at(-1)));
    await page.close();
  }
} finally {await browser.close();}
await fs.writeFile(`${out}/results.json`,JSON.stringify(reports,null,2));
