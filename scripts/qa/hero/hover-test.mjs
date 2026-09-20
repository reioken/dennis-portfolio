// Checks the close-up edge arrow does not drift on hover and that a proxy shows a hover state.
// usage: node scripts/qa/hero/hover-test.mjs [base-url] [steps-right]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [BASE = 'http://localhost:4321', steps = '2'] = process.argv.slice(2);
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist'] });
const page = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
await page.goto(BASE+'/', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(18000);
for (let i = 0; i < Number(steps); i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1500); }
await page.waitForTimeout(2000);
await page.keyboard.press('Enter'); await page.waitForTimeout(5000);
await page.mouse.click(480, 420); await page.waitForTimeout(5000);
const r = await page.$eval('.closeup__edge--next', e => { const q = e.getBoundingClientRect(); return { x: q.x + q.width / 2, y: q.y + q.height / 2 }; });
await page.mouse.move(r.x - 200, r.y); await page.waitForTimeout(300);
await page.mouse.move(r.x, r.y);
const samples = await page.evaluate(() => new Promise(res => { const el = document.querySelector('.closeup__edge--next'); const out = []; const t0 = performance.now();
  const f = () => { const q = el.getBoundingClientRect(); out.push([+q.x.toFixed(2), +q.y.toFixed(2)]); if (performance.now() - t0 < 1200) requestAnimationFrame(f); else res(out); }; f(); }));
const xs = samples.map(s => s[0]), ys = samples.map(s => s[1]);
console.log('arrow x range', Math.min(...xs), Math.max(...xs), 'y range', Math.min(...ys), Math.max(...ys), 'transform', await page.$eval('.closeup__edge--next', e => getComputedStyle(e).transform));
const proxy = await page.$('.closeup__proxy');
const pb = await proxy.boundingBox();
await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2); await page.waitForTimeout(400);
console.log('proxy hover background', await page.evaluate(() => { const el = document.querySelector('.closeup__proxy:hover'); return el ? getComputedStyle(el).backgroundColor : 'no hovered proxy'; }));
await b.close();
