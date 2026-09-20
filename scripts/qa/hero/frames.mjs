// Frame-time sampler: hall idle, navigating, opening a case, case idle. Run before and after a change.
// usage: node scripts/qa/hero/frames.mjs <base-url> [--4k]   (--4k = 2560x1440 @ dpr 1.5)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.argv[2];
if (!BASE) { console.error('usage: node scripts/qa/hero/frames.mjs <base-url> [--4k]'); process.exit(2); }
const big = process.argv.includes('--4k');
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist'] });
const ctx = await b.newContext(big
  ? { viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1.5 }
  : { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto(BASE+'/', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(18000);
const sample = (ms) => page.evaluate((ms) => new Promise(res => { const d=[]; let last=performance.now(); const t0=last;
  const f=(t)=>{ d.push(t-last); last=t; if(t-t0<ms) requestAnimationFrame(f); else { d.shift(); d.sort((a,b)=>a-b); const sum=d.reduce((a,c)=>a+c,0);
    res({ frames:d.length, mean:+(sum/d.length).toFixed(1), p95:+d[Math.floor(d.length*.95)].toFixed(1), max:+d[d.length-1].toFixed(1), over33:d.filter(x=>x>33).length }); } };
  requestAnimationFrame(f); }), ms);
const out = {};
await page.keyboard.press('ArrowRight'); await page.waitForTimeout(3000);
out.hallIdle = await sample(5000);
const nav = sample(6000); for (let i=0;i<3;i++){ await page.keyboard.press('ArrowRight'); await page.waitForTimeout(900);} for (let i=0;i<3;i++){ await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(900);} out.navigate = await nav;
await page.waitForTimeout(1500);
const open = sample(5000); await page.keyboard.press('Enter'); out.openCase = await open;
out.caseIdle = await sample(4000);
console.log(BASE, big ? '4k' : '1080p', JSON.stringify(out));
await b.close();
