// Five soft-navigation cycles through About, Contact, the hall and two projects at 1440 px (preview server, 4322). The
// final step loads a project at 390 px, a native page since d58c490 (2026-09-17): it asserts that page and screenshots it.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {base,outDir,expectNativeCase} from './_env.mjs';
const BASE=base('http://localhost:4322');
const out=outDir('polish-2026-09-11');
const b=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
const c=await b.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'}),p=await c.newPage();const errors=[],steps=[];p.on('pageerror',e=>errors.push(e.message));
try{
 await p.goto(BASE+'/',{waitUntil:'networkidle'});await p.waitForFunction(()=>document.querySelector('.hall.is-3d'));
 async function check(path,action,fullReload=false){
  const start=Date.now();await action();await p.waitForURL(url=>url.pathname===path);const hall=path==='/'||path==='/en/';await p.locator(hall?'.hall-dock':'.hall-panel').waitFor({state:'visible'});const ready=Date.now()-start;
  await p.waitForFunction(()=>!document.documentElement.classList.contains('hall-routing')&&!!document.querySelector('.hall.is-3d'));
  const state=await p.evaluate(()=>({canvases:document.querySelectorAll('canvas').length,halls:document.querySelectorAll('.hall').length,openDialogs:document.querySelectorAll('dialog[open]').length,inertMain:!!document.querySelector('main[inert]'),pending:document.documentElement.classList.contains('gl-pending'),power:document.querySelector('.hall__stage')?.getAttribute('data-power')}));
  assert.deepEqual(state,{canvases:1,halls:1,openDialogs:0,inertMain:false,pending:false,power:null});assert.deepEqual(errors,[]);steps.push({path,panelVisibleMs:ready,fullReload});
 }
 let prefix='';
 for(let cycle=0;cycle<5;cycle++){
  if(cycle===2){await check('/en/',()=>p.locator('.lang-switch').click(),true);prefix='/en'}
  if(cycle===4){await check('/',()=>p.locator('.lang-switch').click(),true);prefix=''}
  await check(prefix+'/about/',()=>p.locator('.site-nav__direct--about').click());
  await check(prefix+'/contact/',()=>p.locator('.site-nav__direct--contact').click());
  await check(prefix+'/',()=>p.locator('.site-nav__brand').click());
  await p.locator('.hall-dock__directory').click();const project=cycle%2?'saute-survivors':'riftback';
  await check(prefix+'/work/'+project+'/',()=>p.locator('.hall-directory__item[href="'+prefix+'/work/'+project+'/"]').click());
  await check(prefix+'/',()=>p.keyboard.press('Escape'));
 }
 const sorted=steps.filter(s=>!s.fullReload).map(s=>s.panelVisibleMs).sort((a,b)=>a-b);const report={routes:steps.length,errors,medianPanelVisibleMs:sorted[Math.floor(sorted.length/2)],p95PanelVisibleMs:sorted[Math.floor(sorted.length*.95)],steps};
 console.log(JSON.stringify(report,null,2));await fs.writeFile(out+'/sustained-navigation.json',JSON.stringify(report,null,2));
 await c.close();const glass=await b.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),g=await glass.newPage();await g.goto(BASE+'/work/riftback/',{waitUntil:'networkidle'});console.log(JSON.stringify({native390:await expectNativeCase(g)}));await g.waitForTimeout(500);await g.screenshot({path:out+'/glass-after-390.png'});await glass.close();
}finally{await b.close()}
