import {chromium,firefox} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.QA_BASE_URL||'http://localhost:4321/';
const out=process.env.QA_OUT||'.source-assets/blue/qa/toys';await fs.mkdir(out,{recursive:true});
const reports=[];
for(const engine of (process.argv[2]?[process.argv[2]]:['chromium','firefox'])){
 const browser=await({chromium,firefox}[engine]).launch({headless:true,...(engine==='chromium'?{args:['--use-angle=d3d11']}: {})});
 try{for(const [width,reduce] of [[1440,false],[390,false],[1440,true]]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:reduce?'reduce':'no-preference',hasTouch:width<600});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(base,{timeout:120000});await page.waitForFunction(()=>window.__hall?.readyDone&&window.__hall.blue?.toys?.toys.length===2,null,{timeout:120000});await page.waitForTimeout(6500);await page.evaluate(()=>window.__hall.stop());
  const initial=await page.evaluate(()=>window.__hall.blue.body.position.toArray());
  const ball=page.getByRole('button',{name:'Ball anstupsen',exact:true});const mouse=page.getByRole('button',{name:'Stoffmaus anstupsen',exact:true});
  await page.screenshot({path:`${out}/${engine}-${width}-${reduce}-initial.png`});
  if(width<600)await ball.tap();else await ball.click();
  const run=await page.evaluate(reduce=>{
   const h=window.__hall,b=h.blue;const moods=new Set();let swats=0,prev='',maxSpeed=0,bad=0;
   for(let i=0;i<60*30;i++){
    b.update(1/60,h.camera,true,reduce);moods.add(b.mood);if(b.mood==='swat'&&prev!=='swat')swats++;prev=b.mood;
    for(const t of b.toys.toys){maxSpeed=Math.max(maxSpeed,Math.hypot(t.velocity.x,t.velocity.z));if(!t.position.toArray().every(Number.isFinite)||t.position.y<t.radius-.001||t.position.x< -2.32||t.position.x>1.71||t.position.z<.29||t.position.z>.87)bad++;}
   }
   h.dirty=h.mirrorDirty=true;h.renderFrame();return{moods:[...moods],swats,maxSpeed,bad,position:b.body.position.toArray()};
  },reduce);
  assert.equal(run.bad,0);assert.ok(run.maxSpeed<=1.21);if(!reduce)assert.ok(run.swats>0,'Blue reaches and bats the ball');else assert.deepEqual(run.position,initial);
  await mouse.focus();await page.keyboard.press('Enter');
  const mouseRun=await page.evaluate(reduce=>{const h=window.__hall,b=h.blue;let swats=0,previous='';for(let i=0;i<1500;i++){b.update(1/60,h.camera,true,reduce);if(b.mood==='swat'&&previous!=='swat')swats++;previous=b.mood;}return {swats,mood:b.mood,p:b.body.position.toArray(),goal:b.goal.toArray(),toy:b.toy?.position.toArray(),timer:b.playUntil-b.clock};},reduce);console.log({engine,width,mouseRun});if(!reduce)assert.ok(mouseRun.swats>0,'Blue also bats the mouse');
  const rapid=await page.evaluate(reduce=>{const h=window.__hall,b=h.blue,t=b.toys.toys[1];let max=0;for(let i=0;i<120;i++){t.button.click();b.update(1/60,h.camera,true,reduce);max=Math.max(max,Math.hypot(t.velocity.x,t.velocity.z));}const before=t.position.toArray();b.update(5,h.camera,false,reduce);return{max,before,after:t.position.toArray(),hidden:t.button.hidden};},reduce);
  assert.ok(rapid.max<=1.21);assert.deepEqual(rapid.before,rapid.after);assert.equal(rapid.hidden,true);
  if(!reduce){const rest=await page.evaluate(()=>{const h=window.__hall,b=h.blue;b.toy=null;b.enter('idle');b.inBed=true;b.elevation=.085;b.body.position.set(-1.65,.085,.18);b.undisturbed=false;b.hover=false;for(let i=0;i<90;i++)b.update(1/60,h.camera,true,false);b.enter('settle');for(let i=0;i<306;i++)b.update(1/60,h.camera,true,false);return{mood:b.mood,weight:b.actions.get('sleep').getEffectiveWeight()};});assert.equal(rest.mood,'sleep');assert.ok(rest.weight>.99,'reused sleeping action keeps its full weight');}
  assert.deepEqual(errors,[]);reports.push({engine,width,reduce,run,rapid,errors});console.log(JSON.stringify(reports.at(-1)));await page.close();
 }}finally{await browser.close()}
}
await fs.writeFile(`${out}/report.json`,JSON.stringify(reports,null,2));
