import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const OUT = process.argv[2] ?? 'flow-out';
fs.mkdirSync(OUT, { recursive: true });
const ORIGIN = 'https://www.dennisbf.design';
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const log = (...a) => console.log(...a);

// mean luminance of the WebGL canvas via screenshot clip is expensive; sample page screenshot centre instead
async function lum(page) {
  const buf = await page.screenshot({ clip: { x: 200, y: 150, width: 400, height: 300 }, type: 'png' });
  const sharp = require('sharp');
  const { data } = await sharp(buf).resize(40, 30).greyscale().raw().toBuffer({ resolveWithObject: true });
  return data.reduce((s, v) => s + v, 0) / data.length;
}

async function run(tag, viewport, mobile) {
  const ctx = await b.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 3 : 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
  page.on('response', (r) => { if (r.status() >= 400) errs.push(`${r.status()} ${r.url()}`); });
  const shot = (n) => page.screenshot({ path: `${OUT}/${tag}-${n}.png` });
  const state = () => page.evaluate(() => ({
    url: location.pathname, title: document.title, lang: document.documentElement.lang, dl: document.documentElement.dataset.lang,
    panel: !!document.querySelector('.hall-panel'), panelBox: (() => { const r = document.querySelector('.hall-panel')?.getBoundingClientRect(); return r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] : null; })(),
    canvases: document.querySelectorAll('canvas').length, readout: document.querySelector('.site-nav__readout')?.textContent,
    focus: document.activeElement?.tagName + '.' + (document.activeElement?.className || '').toString().slice(0, 40),
  }));

  // 1. cold start: time until hall is lit
  const t0 = Date.now();
  await page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded' });
  const series = [];
  let lit = null;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(500);
    const l = await lum(page);
    series.push(Math.round(l));
    if (lit === null && l > 18) lit = Date.now() - t0;
    if (lit !== null && Date.now() - t0 > lit + 3000) break;
  }
  const transfer = await page.evaluate(() => { const e = performance.getEntriesByType('resource'); return { n: e.length, kb: Math.round(e.reduce((s, x) => s + (x.transferSize || 0), 0) / 1024), dec: Math.round(e.reduce((s, x) => s + (x.decodedBodySize || 0), 0) / 1024) }; });
  const nav = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; const p = performance.getEntriesByType('paint'); return { ttfb: Math.round(n.responseStart), dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), fcp: Math.round(p.find((x) => x.name === 'first-contentful-paint')?.startTime ?? -1) }; });
  log(tag, 'COLD', { litMs: lit, lumSeries: series.join(','), transfer, nav });
  await shot('01-hall');

  if (!mobile) {
    // 2. keyboard station stepping
    for (let i = 0; i < 3; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1200); }
    log(tag, 'after 3x ArrowRight', await state()); await shot('02-station4');
    await page.keyboard.press('Enter'); await page.waitForTimeout(3500);
    log(tag, 'after Enter', await state()); await shot('03-enter');
    await page.keyboard.press('Escape'); await page.waitForTimeout(2500);
    log(tag, 'after Escape', await state());
  }
  // 3. soft nav via header "Über mich"
  await page.locator('.site-nav__direct--about').click({ timeout: 5000 }).catch(async () => { await page.locator('.site-nav__menu').click(); await page.waitForTimeout(800); await shot('03b-menu'); await page.locator('#site-menu a[href$="/about/"]').first().click(); });
  await page.waitForTimeout(800); await shot('04-about-0.8s');
  await page.waitForTimeout(3000); await shot('05-about-3.8s');
  log(tag, 'about soft', await state(), 'lum', Math.round(await lum(page)));
  // next via panel footer
  const next = page.locator('.hall-panel a:has-text("Weiter"), .hall-panel a:has-text("WEITER")').first();
  if (await next.count()) { await next.click(); await page.waitForTimeout(3500); log(tag, 'panel next', await state()); await shot('06-next'); }
  await page.goBack(); await page.waitForTimeout(2500); log(tag, 'back 1', await state());
  await page.goBack(); await page.waitForTimeout(2500); log(tag, 'back 2', await state()); await shot('07-back-hall');
  // 4. language switch
  const ls = page.locator('.lang-switch').first();
  if (await ls.isVisible().catch(() => false)) { await ls.click(); await page.waitForTimeout(2000); log(tag, 'lang switch', await state()); await shot('08-en'); }
  // 5. menu
  await page.locator('.site-nav__menu').click(); await page.waitForTimeout(1000); await shot('09-menu');
  log(tag, 'menu links', await page.evaluate(() => [...document.querySelectorAll('#site-menu a')].map((a) => a.getAttribute('href') + ':' + a.innerText.trim().replace(/\s+/g, ' ').slice(0, 30))));
  await page.keyboard.press('Escape'); await page.waitForTimeout(600);
  log(tag, 'menu closed?', await page.evaluate(() => document.querySelector('.site-nav__menu')?.getAttribute('aria-expanded')));
  // 6. contact: client validation only, nothing is sent
  await page.goto(ORIGIN + '/contact/', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(mobile ? 4000 : 9000);
  await shot('10-contact');
  const submit = page.locator('form button[type=submit]').first();
  if (await submit.count()) { await submit.scrollIntoViewIfNeeded(); await submit.click(); await page.waitForTimeout(800); log(tag, 'contact empty submit', await page.evaluate(() => ({ invalid: [...document.querySelectorAll('[aria-invalid=true]')].map((e) => e.name), alert: document.querySelector('[role=alert]')?.innerText?.slice(0, 120) }))); await shot('11-contact-invalid'); }
  // 7. a project page
  await page.goto(ORIGIN + '/work/nexus/', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(mobile ? 4000 : 10000);
  log(tag, 'project direct', await state()); await shot('12-nexus');
  log(tag, 'unnamed controls', await page.evaluate(() => [...document.querySelectorAll('button,a[href]')].filter((x) => !(x.textContent.trim() || x.getAttribute('aria-label') || x.getAttribute('aria-labelledby') || x.title)).map((x) => x.outerHTML.slice(0, 160))));
  log(tag, 'ERRORS', errs.length, errs.slice(0, 15));
  await ctx.close();
}
await run('desk', { width: 1440, height: 900 }, false);
await run('phone', { width: 390, height: 844 }, true);
// reduced motion cold start
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage(); const t0 = Date.now();
  await page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded' });
  let lit = null; for (let i = 0; i < 40 && lit === null; i++) { await page.waitForTimeout(500); if ((await lum(page)) > 18) lit = Date.now() - t0; }
  console.log('reduced-motion litMs', lit); await page.screenshot({ path: `${OUT}/rm-hall.png` }); await ctx.close();
}
await b.close();
