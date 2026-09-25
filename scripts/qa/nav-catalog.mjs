import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import {base,outDir} from './_env.mjs';
const BASE=base('http://localhost:4322');
const out=outDir('polish-2026-09-11');
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
const results=[];
try {for(const width of [320,1366]) {
 const context=await browser.newContext({viewport:{width,height:900},isMobile:width<600,hasTouch:width<600,reducedMotion:'reduce'});
 const page=await context.newPage();let errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const route of ['/work/','/lab/','/arcade/','/work/forever/','/work/visual-craft/','/work/web-clients/']) {
  errors=[];
  await page.goto(BASE+route,{waitUntil:'networkidle',timeout:45000});
  await page.waitForFunction(()=>!document.documentElement.classList.contains('gl-pending'),null,{timeout:15000}).catch(()=>{});
  const early=await page.locator('.project-card img').count() ? await page.locator('.project-card img').first().evaluate(e=>({src:e.currentSrc,complete:e.complete,w:e.naturalWidth,loading:e.loading})).catch(()=>null) : null;
  await page.evaluate(async()=>{await Promise.all([...document.images].filter(e=>{const r=e.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0}).map(e=>e.decode().catch(()=>{})))});
  const state=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,heading:document.querySelector('h1')?.innerText,earlyImages:[...document.images].filter(e=>{const r=e.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0&&r.width>0}).map(e=>({src:e.currentSrc,complete:e.complete,w:e.naturalWidth,height:e.getBoundingClientRect().height})),cards:[...document.querySelectorAll('.project-card,.arcade-card')].map(e=>({text:e.innerText.slice(0,65),href:e.getAttribute('href'),height:e.getBoundingClientRect().height}))}));
  const slug=route.replaceAll('/','_'); await page.screenshot({path:`${out}/nav-catalog-${width}${slug}.png`});
  results.push({width,route,early,...state,errors});console.log(JSON.stringify(results.at(-1)));
  await fs.writeFile(`${out}/nav-catalog.json`,JSON.stringify(results,null,2));
 }
 await context.close();
}}finally{await browser.close();}
