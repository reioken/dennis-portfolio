import {chromium} from 'file:///C:/Users/denni/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
const out='.source-assets/smoothness-2026-09-11';await fs.mkdir(out,{recursive:true});
const name=process.env.PASS||'baseline';const width=Number(process.env.WIDTH||1366);
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'no-preference'});
await context.route('**/Stage3D.*.js',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('this.scene.background=','window.__hall=this,this.scene.background=')});});
if(process.env.DELAY_MODEL)await context.route('**/models/dennis.glb*',async route=>{await new Promise(r=>setTimeout(r,Number(process.env.DELAY_MODEL)));await route.continue();});
await context.addInitScript(()=>{
 window.__probe={frames:[],events:[],long:[],loaf:[],inputs:[]};const p=window.__probe;let last=performance.now();
 for(const type of ['longtask','long-animation-frame','event'])try{new PerformanceObserver(list=>{for(const e of list.getEntries())p[type==='longtask'?'long':type==='event'?'inputs':'loaf'].push(e.toJSON());}).observe({type,buffered:true,durationThreshold:16});}catch{}
 for(const name of ['click','astro:before-preparation','astro:after-preparation','astro:before-swap','astro:after-swap','astro:page-load'])document.addEventListener(name,e=>p.events.push({t:performance.now(),name,href:e.target?.closest?.('a')?.getAttribute('href'),path:location.pathname}),true);
 function frame(t){const el=document.querySelector('.hall-panel'),r=el?.getBoundingClientRect(),s=el&&getComputedStyle(el),card=el?.querySelector('.hall-panel__card'),cs=card&&getComputedStyle(card),sc=window.__hall;
  if(p.frames.length<20000)p.frames.push({t:performance.now(),rafTime:t,dt:t-last,path:location.pathname,rect:r?{x:r.x,y:r.y,w:r.width,h:r.height}:null,left:s?.getPropertyValue('--panel-left'),opacity:cs?.opacity,transform:cs?.transform,power:document.querySelector('.hall__stage')?.getAttribute('data-power'),stageOpacity:document.querySelector('.hall__stage')&&getComputedStyle(document.querySelector('.hall__stage')).opacity,startup:{...document.querySelector('.hall__stage')?.dataset},ready:sc?.readyDone,pending:sc?.pending,model:!!sc?.figure,perf:sc?.perfLevel,root:document.documentElement.className});last=t;requestAnimationFrame(frame);
 }requestAnimationFrame(frame);
});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://localhost:4322/',{waitUntil:'domcontentloaded'});
 for(let i=0;i<4;i++){await page.waitForTimeout(1600);await page.screenshot({path:`${out}/${name}-${width}-startup-${i}.png`});}
 await page.waitForFunction(()=>window.__hall?.readyDone&&!document.querySelector('.hall__stage')?.hasAttribute('data-power'),null,{timeout:25000});
 await page.waitForTimeout(1000);
 for(const route of ['/about/','/','/work/riftback/','/work/lowlight/','/','/about/','/']){
  await page.evaluate(href=>{const a=[...document.querySelectorAll('a')].find(a=>a.getAttribute('href')===href&&!a.closest('[inert]'));if(!a)throw Error('no link '+href);a.click();},route);
  await page.waitForURL('http://localhost:4322'+route);await page.waitForTimeout(1300);
 }
 const report=await page.evaluate(()=>({probe:window.__probe,resources:performance.getEntriesByType('resource').map(e=>({name:e.name,start:e.startTime,duration:e.duration,bytes:e.transferSize})),marks:performance.getEntriesByType('mark').map(e=>e.toJSON())}));
 await fs.writeFile(`${out}/${name}-${width}.json`,JSON.stringify({...report,errors}));
 const navigations=report.probe.events.filter(e=>e.name==='astro:before-preparation').map(e=>{const next=report.probe.events.find(n=>n.name==='astro:after-swap'&&n.t>e.t);const frames=report.probe.frames.filter(f=>f.t>=e.t&&f.t<e.t+1100);const rects=[...new Set(frames.filter(f=>f.rect).map(f=>`${Math.round(f.rect.x)},${Math.round(f.rect.w)}`))];return{path:next?.path,swap:next?Math.round(next.t-e.t):null,maxFrame:Math.round(Math.max(...frames.map(f=>f.dt))),rects:rects.slice(0,30)};});
 console.log(JSON.stringify({name,width,errors,longTasks:report.probe.long.length,longFrames:report.probe.loaf.length,navigations},null,2));
}finally{await browser.close();}
