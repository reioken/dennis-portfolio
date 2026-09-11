import { chromium } from 'file:///C:/Users/denni/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
const out='.source-assets/polish-2026-09-11';
async function allRoutes(dir,rel=''){let out=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){if(e.isDirectory()&&!['_astro','game-builds','media','models','fonts','textures','brand'].includes(e.name))out.push(...await allRoutes(path.join(dir,e.name),rel+e.name+'/'));else if(e.name==='index.html')out.push('/'+rel)}return out;}
const routes=process.env.POLISH_ALL ? await allRoutes('dist') : process.env.POLISH_ROUTES?.split(',') ?? ['/', '/about/', '/contact/', '/work/', '/work/saute-survivors/', '/work/nexus/', '/work/berry/', '/work/mina/', '/arcade/', '/lab/', '/en/contact/', '/en/work/'];
const widths=(process.env.POLISH_WIDTHS ?? '320,768,1440').split(',').map(Number);
const pass=process.env.POLISH_PASS ?? 'baseline';
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
const rows=[];
try {
 for(const width of widths){
  const context=await browser.newContext({viewport:{width,height:Number(process.env.POLISH_HEIGHT)||(width<600?844:900)},deviceScaleFactor:1,isMobile:width<600,hasTouch:width<600,reducedMotion:'reduce'});
  const page=await context.newPage(); let errors=[];let failed=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400&&r.url().startsWith('http://localhost:4322'))failed.push({status:r.status(),url:r.url()})});
  // Form tests may only send to a local mock, never to the contact backend.
  await page.route('**/api/contact',route=>route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}));
  for(const route of routes){
   errors=[];failed=[];
   try {
    await page.goto('http://localhost:4322'+route,{waitUntil:'networkidle',timeout:45000});
    await page.waitForFunction(() => !document.documentElement.classList.contains('gl-pending'), null, {timeout:18000}).catch(() => {});
    await page.waitForTimeout(500);
    await page.evaluate(() => {const panel=document.querySelector('.hall-panel__body');if(panel) panel.scrollTop=panel.scrollHeight;else window.scrollTo(0,document.body.scrollHeight);});
    await page.waitForTimeout(300);
    await page.evaluate(() => {const panel=document.querySelector('.hall-panel__body');if(panel) panel.scrollTop=0;window.scrollTo(0,0);});
    await page.waitForTimeout(150);
    const state=await page.evaluate(()=>{
      const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&!el.closest('[inert]')};
      const label=el=>(el.getAttribute('aria-label')||el.getAttribute('title')||el.textContent||'').trim().slice(0,85);
      return {title:document.title,lang:document.documentElement.lang,overflow:document.documentElement.scrollWidth-innerWidth,canvas:!!document.querySelector('canvas'),hallClass:document.querySelector('.hall')?.className,pending:document.documentElement.classList.contains('gl-pending'),brokenImages:[...document.images].filter(i=>visible(i)&&i.complete&&!i.naturalWidth).map(i=>i.currentSrc),unlabeledButtons:[...document.querySelectorAll('button')].filter(e=>visible(e)&&!label(e)).map(e=>e.className),outside:[...document.querySelectorAll('main a, main button, main input, main textarea')].filter(visible).filter(e=>{const r=e.getBoundingClientRect();return r.left < -2||r.right>innerWidth+2}).map(e=>({label:label(e),class:e.className})).slice(0,12),panel:[...document.querySelectorAll('.hall-panel,.closeup__rail')].filter(visible).map(e=>{const r=e.getBoundingClientRect();return {class:e.className,x:r.x,y:r.y,width:r.width,height:r.height}})};
    });
    const name=route.replaceAll('/','_')||'home';await page.screenshot({path:`${out}/${pass}-${width}${name}.png`,fullPage:false});
    rows.push({width,route,...state,errors:[...new Set(errors)],failed});
    console.log(JSON.stringify(rows.at(-1)));
   }catch(e){rows.push({width,route,fatal:String(e)});console.log(JSON.stringify(rows.at(-1)))}
   await fs.writeFile(`${out}/${pass}.json`,JSON.stringify(rows,null,2));
  }
  await context.close();
 }
}finally{await browser.close()}
