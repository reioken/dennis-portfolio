// Live crawl: every sitemap URL, desktop 1440x900 (+ phone 390x844 for a subset).
// Collects status, SEO tags, console/page errors, failed requests, overflow, link + asset targets.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const OUT = process.argv[2] ?? 'crawl-out';
const SHOTS = path.join(OUT, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const ORIGIN = 'https://www.dennisbf.design';

const xml = await (await fetch(`${ORIGIN}/sitemap-0.xml`)).text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
urls.push(`${ORIGIN}/rarer/`, `${ORIGIN}/rarer/?mode=depth`, `${ORIGIN}/does-not-exist/`);

const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist'] });
const results = [];
const targets = new Map(); // url -> Set(pages)
const note = (t, from) => { if (!targets.has(t)) targets.set(t, new Set()); targets.get(t).add(from); };

async function visit(url, viewport, tag) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
  const page = await ctx.newPage();
  const rec = { url, tag, console: [], pageErrors: [], failed: [], bad: [] };
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) rec.console.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
  page.on('pageerror', (e) => rec.pageErrors.push(String(e).slice(0, 300)));
  page.on('requestfailed', (r) => rec.failed.push(`${r.url()} ${r.failure()?.errorText}`));
  page.on('response', (r) => { if (r.status() >= 400) rec.bad.push(`${r.status()} ${r.url()}`); });
  const t0 = Date.now();
  let resp;
  try { resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); } catch (e) { rec.gotoError = String(e).slice(0, 200); }
  rec.status = resp?.status();
  rec.loadMs = Date.now() - t0;
  await page.waitForTimeout(9000);
  try {
    Object.assign(rec, await page.evaluate(() => {
      const q = (s) => document.querySelector(s);
      const meta = (n) => q(`meta[name="${n}"]`)?.content ?? q(`meta[property="${n}"]`)?.content ?? null;
      const de = document.documentElement;
      return {
        title: document.title, lang: de.lang, desc: meta('description'), canonical: q('link[rel=canonical]')?.href ?? null,
        ogImage: meta('og:image'), ogTitle: meta('og:title'), robots: meta('robots'),
        hreflang: [...document.querySelectorAll('link[rel=alternate][hreflang]')].map((l) => `${l.hreflang}=${l.href}`),
        h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim().slice(0, 80)),
        overflowX: de.scrollWidth - de.clientWidth,
        imgsNoAlt: [...document.images].filter((i) => !i.hasAttribute('alt')).map((i) => i.currentSrc || i.src).slice(0, 10),
        imgsBroken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && (i.currentSrc || i.src) && i.loading !== 'lazy').map((i) => i.currentSrc || i.src).slice(0, 10),
        links: [...new Set([...document.querySelectorAll('a[href]')].map((a) => a.href))],
        assets: [...new Set([
          ...[...document.images].flatMap((i) => [i.src, ...(i.srcset || '').split(',').map((s) => s.trim().split(/\s+/)[0])]),
          ...[...document.querySelectorAll('source[srcset]')].flatMap((s) => s.srcset.split(',').map((x) => x.trim().split(/\s+/)[0])),
          ...[...document.querySelectorAll('video[poster]')].map((v) => v.poster),
          ...[...document.querySelectorAll('video[src],source[src]')].map((v) => v.src),
        ].filter(Boolean).map((u) => new URL(u, location.href).href))],
        btnNoName: [...document.querySelectorAll('button,a[href]')].filter((b) => !(b.textContent.trim() || b.getAttribute('aria-label') || b.getAttribute('aria-labelledby') || b.title || b.querySelector('img[alt]:not([alt=""])'))).length,
        hallState: document.querySelector('.hall')?.className ?? null,
        bodyText: document.body.innerText.length,
      };
    }));
  } catch (e) { rec.evalError = String(e).slice(0, 200); }
  for (const l of rec.links ?? []) note(l.split('#')[0], url);
  for (const a of rec.assets ?? []) note(a, url);
  delete rec.links; delete rec.assets;
  const name = `${tag}-${new URL(url).pathname.replace(/\W+/g, '_') || 'home'}${new URL(url).search ? '_q' : ''}.png`;
  try { await page.screenshot({ path: path.join(SHOTS, name) }); } catch {}
  rec.shot = name;
  await ctx.close();
  results.push(rec);
  console.log(tag, rec.status, url, `err:${rec.pageErrors.length} con:${rec.console.length} bad:${rec.bad.length} ovf:${rec.overflowX}`);
}

const jobs=[];for (const u of urls) jobs.push([u,{ width: 1440, height: 900 },'desktop']);
const phone = urls.filter((u) => !u.includes('/en/') || /\/en\/(about\/)?$/.test(u));
for (const u of phone) jobs.push([u,{ width: 390, height: 844 },'phone']);let j=0;await Promise.all(Array.from({length:4},async()=>{while(j<jobs.length){const a=jobs[j++];await visit(...a);}}));
await browser.close();

// check every link/asset target once
const checked = [];
const list = [...targets.keys()].filter((t) => /^https?:/.test(t));
let i = 0;
async function worker() {
  while (i < list.length) {
    const t = list[i++];
    let status, err;
    try {
      let r = await fetch(t, { method: 'HEAD', redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (link audit)' } });
      if ([403, 405, 501].includes(r.status) || r.status >= 500) r = await fetch(t, { method: 'GET', redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (link audit)' } });
      status = r.status;
    } catch (e) { err = String(e.cause?.code ?? e).slice(0, 80); }
    if (err || status >= 400) checked.push({ target: t, status, err, from: [...targets.get(t)].slice(0, 4) });
  }
}
await Promise.all(Array.from({ length: 8 }, worker));

fs.writeFileSync(path.join(OUT, 'crawl.json'), JSON.stringify({ results, brokenTargets: checked, targetCount: list.length }, null, 1));
console.log('targets', list.length, 'broken', checked.length);
for (const c of checked) console.log('BROKEN', c.status ?? c.err, c.target, '<-', c.from[0]);
