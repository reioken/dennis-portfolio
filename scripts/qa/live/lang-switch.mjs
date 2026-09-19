import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright'); const sharp = require('sharp');
const BASE = process.argv[2]; const S = process.argv[3];
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist'] });
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs=[]; page.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,200))}); page.on('pageerror',e=>errs.push(String(e).slice(0,200)));
const lum = async()=>{const buf=await page.screenshot({clip:{x:200,y:150,width:400,height:300}});const {data}=await sharp(buf).resize(40,30).greyscale().raw().toBuffer({resolveWithObject:true});return Math.round(data.reduce((s,v)=>s+v,0)/data.length)};
const st = ()=>page.evaluate(()=>({url:location.pathname,lang:document.documentElement.lang,dl:document.documentElement.dataset.lang,title:document.title.slice(0,50),marker:window.__m===1,
  canon:document.querySelector('link[rel=canonical]')?.href, aria:document.querySelector('.lang-switch')?.getAttribute('aria-label'),
  dock:[...document.querySelectorAll('.hall a[href]')].slice(0,3).map(a=>a.getAttribute('href')), nav:[...document.querySelectorAll('.site-nav__direct')].map(a=>a.getAttribute('href')),
  visibleLabel:[...document.querySelectorAll('.site-nav__direct--about span')].filter(s=>getComputedStyle(s).display!=='none').map(s=>s.textContent)}));
await page.goto(BASE+'/',{waitUntil:'domcontentloaded'}); await page.waitForTimeout(17000); await page.evaluate(()=>{window.__m=1});
console.log('start lum',await lum());
await page.locator('.lang-switch').first().click(); const s=[];for(let i=0;i<6;i++){await page.waitForTimeout(400);s.push(await lum());}
console.log('HOME->EN lum',s.join(','),await st()); await page.screenshot({path:S+'/lang-en-hall.png'});
await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1500); await page.keyboard.press('Enter'); await page.waitForTimeout(4000);
console.log('EN station enter',await st());
await page.locator('.lang-switch').first().click(); await page.waitForTimeout(2500);
console.log('CASE->DE',await st(),'lum',await lum(),'panel h1',await page.evaluate(()=>[...document.querySelectorAll('.hall-panel h1, .hall-panel [data-lang]')].length)); await page.screenshot({path:S+'/lang-de-case.png'});
await page.goBack(); await page.waitForTimeout(2500); console.log('back',await st());
await page.goBack(); await page.waitForTimeout(2500); console.log('back2',await st(),'lum',await lum());
await page.locator('.site-nav__direct--about').click(); await page.waitForTimeout(3500); console.log('about',await st());
await page.locator('.lang-switch').first().click(); await page.waitForTimeout(2500); console.log('ABOUT switch',await st(),'lum',await lum()); await page.screenshot({path:S+'/lang-about.png'});
console.log('ERRORS',errs);
await b.close();
