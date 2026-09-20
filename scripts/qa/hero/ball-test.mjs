// Trackball proxy check: drag it, click the left half, screen arrow, keyboard - does the slide count move.
// usage: node scripts/qa/hero/ball-test.mjs <out-dir-outside-repo> [base-url] [steps-right]
import { createRequire } from 'node:module';
import { outDir } from './_out.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [outArg, BASE = 'http://localhost:4321', steps = '2'] = process.argv.slice(2);
const S = outDir(outArg, 'node scripts/qa/hero/ball-test.mjs <out-dir-outside-repo> [base-url] [steps-right]');
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist'] });
const errs = [];
const page = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
page.on('console', m => { if (m.type()==='error') errs.push('console: '+m.text().slice(0,300)); });
page.on('pageerror', e => errs.push('pageerror: '+String(e).slice(0,300)));
await page.goto(BASE+'/', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(18000);
for (let i = 0; i < Number(steps); i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1500); }
await page.waitForTimeout(2000);
await page.keyboard.press('Enter'); await page.waitForTimeout(5000);
await page.mouse.click(480, 420); await page.waitForTimeout(5000);
const count = () => page.evaluate(() => document.querySelector('.closeup__count span')?.textContent?.trim());
const balls = await page.$$eval('.closeup__proxy--ball', els => els.map(e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
console.log('ball proxies', JSON.stringify(balls), 'tags', await page.$$eval('.closeup__tag', e => e.length), 'count', await count());
const r = balls[1];
await page.mouse.move(r.x + 5, r.y + r.h / 2); await page.mouse.down();
for (let i = 0; i < 16; i++) { await page.mouse.move(r.x + 5 + i * 10, r.y + r.h / 2 + i * 2); await page.waitForTimeout(16); }
await page.screenshot({ path: `${S}/ball-dragging.png`, clip: { x: 1200, y: 740, width: 420, height: 200 } });
await page.mouse.up(); await page.waitForTimeout(700);
console.log('after drag right 160px', await count());
// a plain click on the left half still pages back, and the screen arrow pages forward
await page.mouse.click(balls[0].x + 6, balls[0].y + balls[0].h / 2); await page.waitForTimeout(700);
console.log('after click left half', await count());
await page.mouse.move(960, 420); await page.waitForTimeout(400);
await page.click('.closeup__edge--next'); await page.waitForTimeout(700);
console.log('after screen arrow next', await count());
await page.keyboard.press('ArrowRight'); await page.waitForTimeout(700);
console.log('after keyboard right', await count());
console.log('ERRORS', errs.length, errs.slice(0, 6));
await b.close();
