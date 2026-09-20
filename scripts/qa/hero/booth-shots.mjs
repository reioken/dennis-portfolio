// Phone booth on /contact/ plus the hall behind it, after any phone-booth-v1 rebake.
// usage: node scripts/qa/hero/booth-shots.mjs <out-dir-outside-repo> [base-url]
import { createRequire } from 'node:module';
import { outDir } from './_out.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [outArg, BASE = 'http://localhost:4321'] = process.argv.slice(2);
const S = outDir(outArg, 'node scripts/qa/hero/booth-shots.mjs <out-dir-outside-repo> [base-url]');
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist'] });
const errs = [];
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('console', m => { if (m.type()==='error') errs.push('console: '+m.text().slice(0,300)); });
page.on('pageerror', e => errs.push('pageerror: '+String(e).slice(0,300)));
page.on('response', r => { if (r.status() >= 400) errs.push(`${r.status()} ${r.url().slice(-80)}`); });
await page.goto(BASE+'/contact/', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(24000);
await page.screenshot({ path: `${S}/booth-case.png` });
await page.keyboard.press('Escape'); await page.waitForTimeout(5000);
await page.screenshot({ path: `${S}/booth-hall.png` });
console.log('url', page.url().replace(BASE, ''));
console.log('ERRORS', errs.length, errs.slice(0, 8));
await b.close();
