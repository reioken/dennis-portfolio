// Claw machine in the hall plus its case page, at 2x. usage after any claw-v2 rebake.
// usage: node scripts/qa/hero/claw-shots.mjs <out-dir-outside-repo> [base-url]
import { createRequire } from 'node:module';
import { outDir } from './_out.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [outArg, BASE = 'http://localhost:4321'] = process.argv.slice(2);
const S = outDir(outArg, 'node scripts/qa/hero/claw-shots.mjs <out-dir-outside-repo> [base-url]');
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist'] });
const errs = [];
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('console', m => { if (m.type()==='error') errs.push('console: '+m.text().slice(0,300)); });
page.on('pageerror', e => errs.push('pageerror: '+String(e).slice(0,300)));
page.on('response', r => { if (r.status() >= 400) errs.push(`${r.status()} ${r.url().slice(-80)}`); });
await page.goto(BASE+'/', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(22000);
await page.screenshot({ path: `${S}/claw-hall.png`, clip: { x: 560, y: 380, width: 800, height: 560 } });
await page.keyboard.press('Enter'); await page.waitForTimeout(6000);
await page.screenshot({ path: `${S}/claw-case-full.png`, scale: 'css' });
await page.screenshot({ path: `${S}/claw-case.png`, clip: { x: 0, y: 56, width: 800, height: 1000 } });
console.log('url', page.url().replace(BASE, ''));
console.log('ERRORS', errs.length, errs.slice(0, 8));
await b.close();
