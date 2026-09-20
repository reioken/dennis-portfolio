// Production layout/loading snapshots before and after the September repair pass.
// node scripts/qa/hero/repair-layout.mjs OUT BASE [width]
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { outDir } from './_out.mjs';

const [out, base = 'http://127.0.0.1:4322', onlyWidth] = process.argv.slice(2);
const dir = outDir(out, 'repair-layout.mjs OUT BASE');
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const results = [];
try {
  for (const [width, height, route] of [[390,844,'/work/nexus/'], [320,740,'/work/mina/'], [844,390,'/work/nexus/'], [1024,768,'/work/nexus/'], [1440,900,'/contact/']]) {
    if (onlyWidth && width !== Number(onlyWidth)) continue;
    const tag = `${width}-${route.split('/').filter(Boolean).at(-1)}`;
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript(() => {
      window.__shifts = [];
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__shifts.push({ value: entry.value, nodes: entry.sources?.map(s => s.node?.className) });
      }).observe({ type: 'layout-shift', buffered: true });
    });
    // Hold hydration briefly so the server-rendered mobile layout can be compared with its final state.
    if (width < 900) await page.route('**/_astro/*.js', async route => {
      await new Promise(resolve => setTimeout(resolve, 1200));
      await route.continue();
    });
    await page.goto(base + route, { waitUntil: 'domcontentloaded' });
    if (width < 900) await page.screenshot({ path: `${dir}/${tag}-initial.png` });
    if (width >= 900) await page.waitForSelector('.hall.is-3d', { timeout: 60000 });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${dir}/${tag}.png` });
    const state = await page.evaluate(() => {
      const rect = selector => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const r = el.getBoundingClientRect(), css = getComputedStyle(el);
        return { x:r.x, y:r.y, width:r.width, height:r.height, padding:css.padding, display:css.display, scrollWidth:el.scrollWidth, clientWidth:el.clientWidth };
      };
      return { shifts:window.__shifts, overflow:document.documentElement.scrollWidth > innerWidth,
        panel:rect('.hall-panel'), body:rect('.hall-panel__body'), footer:rect('.hall-panel__corridor'),
        carousel:rect('.captures__hero'), title:rect('.hall-panel__title'), ready:document.querySelector('[data-ready-ms]')?.dataset.readyMs,
        models:performance.getEntriesByType('resource').filter(r => r.name.includes('/models/')).length };
    });
    results.push({ tag, state, errors });
    console.log(tag, JSON.stringify(results.at(-1)));
    await context.close();
  }
} finally { await browser.close(); }
await writeFile(`${dir}/layout.json`, JSON.stringify(results, null, 2));
if (results.some(r => r.errors.length || r.state.overflow || r.state.shifts.reduce((sum, s) => sum + s.value, 0) > .01 || (Number(r.tag.split('-')[0]) < 900 && r.state.models > 0))) process.exitCode = 1;
