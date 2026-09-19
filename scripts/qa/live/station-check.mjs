import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const S = process.argv[2]; const BASE = process.argv[3] ?? 'http://localhost:4321';
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist'] });
const errs = [];
async function go(tag, vp, mobile) {
  const ctx = await b.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type()==='error') errs.push(tag+' console: '+m.text().slice(0,200)); });
  page.on('pageerror', e => errs.push(tag+' pageerror: '+String(e).slice(0,200)));
  page.on('response', r => { if (r.status()>=400) errs.push(tag+` ${r.status()} ${r.url()}`); });
  await page.goto(BASE+'/', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(mobile?16000:18000);
  if (!mobile) { for (let i=0;i<4;i++){ await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1300);} await page.waitForTimeout(2500);
    await page.screenshot({ path: `${S}/vgm-${tag}-hall.png` });
    console.log(tag,'readout', await page.evaluate(()=>document.querySelector('.site-nav__readout')?.innerText, null), 'dock count', await page.evaluate(()=>document.querySelectorAll('.hall button').length));
    await page.keyboard.press('Enter'); await page.waitForTimeout(5000); await page.screenshot({ path: `${S}/vgm-${tag}-case.png` });
    console.log(tag,'url', page.url());
  }
  await page.goto(BASE+'/work/vgm-battle/', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(mobile?5000:14000);
  await page.screenshot({ path: `${S}/vgm-${tag}-direct.png` });
  await ctx.close();
}
await go('desk', { width: 1440, height: 900 }, false);
await go('phone', { width: 390, height: 844 }, true);
console.log('ERRORS', errs.length, errs.slice(0,10));
await b.close();
