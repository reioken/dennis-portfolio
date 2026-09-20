// Walks every URL in the sitemap and reports console errors, page errors, failed requests and >=400s.
// usage: node scripts/qa/hero/preview-sweep.mjs <base-url>   (point it at `astro preview`, not dev)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.argv[2];
if (!BASE) { console.error('usage: node scripts/qa/hero/preview-sweep.mjs <base-url>'); process.exit(2); }
const xml = await (await fetch(`${BASE}/sitemap-0.xml`)).text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].replace(/^https?:\/\/[^/]+/, BASE));
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs = [];
let cur = '';
page.on('console', m => { if (m.type() === 'error') errs.push(`${cur} console: ${m.text().slice(0, 200)}`); });
page.on('pageerror', e => errs.push(`${cur} pageerror: ${String(e).slice(0, 200)}`));
page.on('requestfailed', r => errs.push(`${cur} reqfail: ${r.url().slice(-70)} ${r.failure()?.errorText}`));
page.on('response', r => { if (r.status() >= 400) errs.push(`${cur} ${r.status()} ${r.url().slice(-70)}`); });
for (const u of urls) {
  cur = u.replace(BASE, '') || '/';
  const r = await page.goto(u, { waitUntil: 'domcontentloaded' });
  if (!r || r.status() >= 400) errs.push(`${cur} STATUS ${r?.status()}`);
  await page.waitForTimeout(/\/(en\/)?$/.test(cur) ? 16000 : 3500);
}
console.log(`pages ${urls.length}  ERRORS ${errs.length}`);
for (const e of errs.slice(0, 20)) console.log('  ' + e);
await b.close();
