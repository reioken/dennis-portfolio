// Close-up control check per station: proxy count, always-on tags, does "next" page the slides.
// usage: node scripts/qa/hero/ctl-test.mjs [base-url] [slug,slug] [screen-click-x,y]  (kiosk cabinets: 592,380)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [BASE = 'http://localhost:4321', list = 'saute-survivors,berry,hookline,vgm-battle,riftcast', click = '480,420'] = process.argv.slice(2);
const [CX, CY] = click.split(',').map(Number);
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist'] });
const errs = [];
const page = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
page.on('console', m => { if (m.type()==='error') errs.push('console: '+m.text().slice(0,200)); });
page.on('pageerror', e => errs.push('pageerror: '+String(e).slice(0,200)));
let first = true;
for (const slug of list.split(',')) {
  await page.goto(`${BASE}/work/${slug}/`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(first ? 22000 : 13000); first = false;
  await page.mouse.click(CX, CY); await page.waitForTimeout(5000);
  const count = () => page.evaluate(() => document.querySelector('.closeup__count span')?.textContent?.trim());
  const proxies = await page.$$eval('.closeup__proxy', els => els.map(e => { const r = e.getBoundingClientRect(); return { label: e.getAttribute('aria-label'), x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; }));
  const before = await count();
  const next = proxies.find(p => /^(Nächste|Next)/.test(p.label ?? '')) ?? proxies.find(p => /(Nächste|Next)/.test(p.label ?? ''));
  let after = 'no next control';
  if (next) { await page.mouse.click(next.x, next.y); await page.waitForTimeout(900); after = await count(); }
  console.log(slug, '| controls', proxies.length, '| always-on tags', await page.$$eval('.closeup__tag.is-on', e => e.length), '|', before, '->', after);
  await page.keyboard.press('Escape'); await page.waitForTimeout(1500);
}
console.log('ERRORS', errs.length, errs.slice(0, 8));
await b.close();
