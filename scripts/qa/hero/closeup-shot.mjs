// Opens a hall station, clicks its screen into the close-up, shoots it idle and hovered.
// usage: node scripts/qa/hero/closeup-shot.mjs <out-dir-outside-repo> [base-url] [steps-right]
import { createRequire } from 'node:module';
import { outDir } from './_out.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [outArg, BASE = 'http://localhost:4321', steps = '1'] = process.argv.slice(2);
const S = outDir(outArg, 'node scripts/qa/hero/closeup-shot.mjs <out-dir-outside-repo> [base-url] [steps-right]');
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist'] });
const errs = [];
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('console', m => { if (m.type()==='error') errs.push('console: '+m.text().slice(0,300)); });
page.on('pageerror', e => errs.push('pageerror: '+String(e).slice(0,300)));
await page.goto(BASE+'/', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(18000);
for (let i = 0; i < Number(steps); i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1500); }
await page.waitForTimeout(2000);
await page.keyboard.press('Enter'); await page.waitForTimeout(5000);
// the close-up opens from the machine's screen
const box = await page.evaluate(() => { const el = document.querySelector('.closeup__screen, [data-screen-hit], .stage__screen-hit'); const r = el?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, w: r.width, h: r.height, cls: el.className } : null; });
console.log('screen el', JSON.stringify(box));
await page.mouse.click(480, 420); await page.waitForTimeout(5000);
await page.screenshot({ path: `${S}/closeup.png` });
await page.mouse.move(960, 480); await page.waitForTimeout(800);
await page.screenshot({ path: `${S}/closeup-hover.png` });
console.log('classes', await page.evaluate(() => [...document.querySelectorAll('[class*=closeup]')].slice(0, 6).map(e => e.className)));
console.log('ERRORS', errs.length, errs.slice(0, 6));
await b.close();
