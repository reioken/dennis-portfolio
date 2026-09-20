// TV rig above the hall at 2x, plus a full frame, after any tv-rig-v1 rebake.
// usage: node scripts/qa/hero/tv-shots.mjs <out-dir-outside-repo> [base-url]
import { createRequire } from 'node:module';
import { outDir } from './_out.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [outArg, BASE = 'http://localhost:4321'] = process.argv.slice(2);
const S = outDir(outArg, 'node scripts/qa/hero/tv-shots.mjs <out-dir-outside-repo> [base-url]');
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist'] });
const errs = [];
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('console', m => { if (m.type()==='error') errs.push('console: '+m.text().slice(0,400)); });
page.on('pageerror', e => errs.push('pageerror: '+String(e).slice(0,300)));
page.on('response', r => { if (r.status() >= 400) errs.push(`${r.status()} ${r.url().slice(-80)}`); });
await page.goto(BASE+'/', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(22000);
await page.keyboard.press('ArrowRight'); await page.waitForTimeout(6000);
await page.screenshot({ path: `${S}/tv.png`, clip: { x: 640, y: 56, width: 640, height: 320 } });
await page.screenshot({ path: `${S}/tv-full.png`, scale: 'css' });
console.log('ERRORS', errs.length, errs.slice(0, 6));
await b.close();
