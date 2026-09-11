import {chromium} from 'file:///C:/Users/denni/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='.source-assets/smoothness-2026-09-11';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});const results=[];
try {for(const warm of (process.env.CACHE_WARM_ONLY ? [true] : [false,true])) {
 const context=await browser.newContext({viewport:{width:1366,height:900},reducedMotion:'no-preference'});
 await context.addInitScript(({warm})=>{
  if(!warm)Object.defineProperty(navigator,'connection',{get:()=>({saveData:true,effectiveType:'4g'}),configurable:true});
  window.__routeProbe={events:[],interactions:[],frames:[]};const p=window.__routeProbe;
  for(const type of ['astro:before-preparation','astro:after-preparation','astro:after-swap','astro:page-load'])document.addEventListener(type,()=>p.events.push({type,t:performance.now(),path:location.pathname,cache:document.querySelector('.hall')?.dataset.navigationCache,root:document.documentElement.className,named:[document.documentElement,...document.querySelectorAll('[data-astro-transition-scope],.hall,.hall-panel__card,.site-nav')].map(e=>({tag:e.tagName,cls:e.className,name:getComputedStyle(e).viewTransitionName}))}));
  try{new PerformanceObserver(list=>{for(const e of list.getEntries())if(e.interactionId)p.interactions.push({name:e.name,id:e.interactionId,start:e.startTime,inputDelay:e.processingStart-e.startTime,processing:e.processingEnd-e.processingStart,presentation:Math.max(0,e.startTime+e.duration-e.processingEnd),duration:e.duration,target:e.target?.className});}).observe({type:'event',buffered:true,durationThreshold:16});}catch{}
  function frame(t){const el=document.querySelector('.hall-panel'),rect=el?.getBoundingClientRect(),card=el?.querySelector('.hall-panel__card');if(p.frames.length<15000)p.frames.push({t,path:location.pathname,x:rect?.x,width:rect?.width,opacity:card?getComputedStyle(card).opacity:null});requestAnimationFrame(frame);}requestAnimationFrame(frame);
 },{warm});
 const page=await context.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.stack??e.message));page.on('request',r=>{if(r.resourceType()==='document'||r.url().endsWith('.css'))requests.push({url:r.url(),type:r.resourceType()});});
 try{
  await page.goto('http://localhost:4322/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('.hall__stage')&&!document.querySelector('.hall__stage').hasAttribute('data-power')&&!document.documentElement.classList.contains('gl-pending'),null,{timeout:45000});
  await page.waitForTimeout(1800);
  const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:450,downloadThroughput:250000,uploadThroughput:125000,connectionType:'cellular4g'});
  await page.locator('.hall-dock__open').click();await page.waitForURL('**/about/');await page.waitForTimeout(1000);
  let data=await page.evaluate(()=>({probe:window.__routeProbe,cache:document.querySelector('.hall')?.dataset.navigationCache,connection:{saveData:navigator.connection?.saveData,effectiveType:navigator.connection?.effectiveType},resources:performance.getEntriesByType('resource').filter(e=>e.name.endsWith('.css')||new URL(e.name).pathname==='/about/').map(e=>({url:e.name,start:e.startTime,duration:e.duration,transfer:e.transferSize}))}));
  await fs.writeFile(`${out}/route-cache-${warm?'warm':'cold'}.json`,JSON.stringify({...data,requests,errors},null,2));
  assert.equal(data.cache,warm?'hit':'miss','initial About route cache');assert.equal(errors.length,0,errors.join('\n'));
  const prep=data.probe.events.find(e=>e.type==='astro:before-preparation'),swap=data.probe.events.find(e=>e.type==='astro:after-swap'&&e.t>prep.t);
  assert(prep&&swap);const visible=data.probe.frames.find(f=>f.t>=swap.t&&Number(f.opacity)>=.98);
  const timing={warm,swapMs:Math.round(swap.t-prep.t),panelOpaqueMs:visible?Math.round(visible.t-prep.t):null,cache:data.cache,interactions:data.probe.interactions};
  console.log(JSON.stringify({initialTiming:timing}));
  await fs.writeFile(`${out}/route-cache-${warm?'warm':'cold'}.json`,JSON.stringify({...data,requests,errors},null,2));
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  if(warm){
   await page.goBack();await page.waitForURL('http://localhost:4322/');await page.goForward();await page.waitForURL('**/about/');
   await page.locator('.lang-switch').click();await page.waitForURL('**/en/about/');await page.waitForTimeout(1000);assert.equal(await page.locator('html').getAttribute('lang'),'en');
   await page.locator('.site-nav__menu').click();await page.locator('.nav-dropdown__link[href="/en/"]').click();await page.waitForURL('http://localhost:4322/en/');await page.waitForFunction(()=>performance.getEntriesByName('hall:route-prepared').some(e=>e.detail?.path==='/en/about/'),null,{timeout:35000});
   await page.locator('.hall-dock__open').click();await page.waitForURL('**/en/about/');await page.waitForTimeout(600);assert.equal(await page.locator('.hall').getAttribute('data-navigation-cache'),'hit','English About revisit cache');
   await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:450,downloadThroughput:250000,uploadThroughput:125000,connectionType:'cellular4g'});
   await page.locator('.site-nav__direct[href="/en/contact/"]').click();
   await page.locator('.site-nav__direct[href="/en/about/"]').click();await page.waitForTimeout(1200);
   assert.equal(new URL(page.url()).pathname,'/en/about/');assert.equal(await page.locator('html').evaluate(e=>e.classList.contains('hall-routing')),false);
   await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
   await page.locator('.site-nav__menu').click();await page.locator('.nav-dropdown__link[href="/en/work/"]').click();await page.waitForURL('**/en/work/');await page.waitForTimeout(700);
   assert.equal(errors.length,0,errors.join('\n'));
  }
  results.push({...timing,ok:true,errors});console.log(JSON.stringify(results.at(-1)));
 }catch(e){await fs.writeFile(`${out}/route-cache-failure.json`,JSON.stringify(await page.evaluate(()=>({events:window.__routeProbe.events,root:document.documentElement.outerHTML.slice(0,600),hall:document.querySelector('.hall')?.outerHTML.slice(0,600),resources:performance.getEntriesByType('resource').filter(e=>!new URL(e.name).pathname.includes('/_astro/')).map(e=>({name:e.name,start:e.startTime,duration:e.duration}))})),null,2));results.push({warm,ok:false,error:String(e),errors});console.log(JSON.stringify(results.at(-1)));}
 await context.close();await fs.writeFile(`${out}/route-cache-results.json`,JSON.stringify(results,null,2));
}}finally{await browser.close();}
if(results.some(r=>!r.ok))process.exitCode=1;
