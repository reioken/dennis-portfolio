// 2x close-up of one hall station (marquee crop + whole machine), for silkscreen/bevel quality.
// usage: node scripts/qa/hero/station-zoom.mjs <out-dir-outside-repo> [base-url] [steps-right]
import { createRequire } from 'node:module';
import { outDir } from './_out.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const S = outDir(process.argv[2], 'node scripts/qa/hero/station-zoom.mjs <out-dir-outside-repo> [base-url] [steps-right]');
const BASE = process.argv[3] ?? 'http://localhost:4321';
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist'] });
const errs = [];
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('console', m => { if (m.type()==='error') errs.push('console: '+m.text().slice(0,300)); });
page.on('pageerror', e => errs.push('pageerror: '+String(e).slice(0,300)));
await page.goto(BASE+'/', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(18000);
for (let i = 0; i < Number(process.argv[4] ?? 1); i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1500); } await page.waitForTimeout(2500);
await page.keyboard.press('Enter'); await page.waitForTimeout(6000);
await page.screenshot({ path: `${S}/zoom-top.png`, clip: { x: 270, y: 230, width: 460, height: 130 } });
await page.screenshot({ path: `${S}/zoom-machine.png`, clip: { x: 60, y: 90, width: 740, height: 960 } });
console.log('ERRORS', errs.length, errs.slice(0,10));
await b.close();
