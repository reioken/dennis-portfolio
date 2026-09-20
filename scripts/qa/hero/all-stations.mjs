// One case-page screenshot per station (14), for the side-by-side wear sheet.
// usage: node scripts/qa/hero/all-stations.mjs <out-dir-outside-repo> [base-url] [slug,slug]
import { createRequire } from 'node:module';
import { outDir } from './_out.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [outArg, BASE = 'http://localhost:4321', only = ''] = process.argv.slice(2);
const S = outDir(outArg, 'node scripts/qa/hero/all-stations.mjs <out-dir-outside-repo> [base-url] [slug,slug]');
const SLUGS = ['riftback', 'nexus', 'lowlight', 'vgm-battle', 'saute-survivors', 'echo-frequency', 'safeplate', 'cab-no-9', 'hookline', 'berry', 'carillon', 'riftcast', 'briefly', 'mina'];
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist'] });
const errs = [];
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('console', m => { if (m.type()==='error') errs.push('console: '+m.text().slice(0,200)); });
page.on('pageerror', e => errs.push('pageerror: '+String(e).slice(0,200)));
page.on('response', r => { if (r.status() >= 400) errs.push(`${r.status()} ${r.url().slice(-80)}`); });
let first = true;
for (const [i, slug] of SLUGS.entries()) {
  if (only && !only.split(',').includes(slug)) continue;
  await page.goto(`${BASE}/work/${slug}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(first ? 22000 : 13000);
  first = false;
  await page.screenshot({ path: `${S}/${String(i + 1).padStart(2, '0')}-case.png`, clip: { x: 0, y: 56, width: 800, height: 1000 } });
  console.log(i + 1, slug);
}
console.log('ERRORS', errs.length, errs.slice(0, 12));
await b.close();
