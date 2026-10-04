// Built-preview review of the October portfolio interface and native reading paths.
// node scripts/qa/hero/portfolio-refresh.mjs OUT [BASE]
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { outDir } from './_out.mjs';
const out = outDir(process.argv[2], 'portfolio-refresh.mjs OUT [BASE]');
const base = process.argv[3] ?? 'http://127.0.0.1:4334';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const results = [], errors = [];
const watch = page => {
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
};
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
try {
  for (const [width, height] of [[320,700], [390,844], [768,1024], [844,390]]) {
    const ctx = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true });
    const p = await ctx.newPage(); watch(p);
    const models = [];
    p.on('request', r => { if (r.url().includes('/models/')) models.push(r.url()); });
    await p.goto(`${base}/contact/`);
    await p.locator('input[name="name"]').waitFor({ state: 'visible' });
    await p.waitForTimeout(600);
    assert.equal(models.length, 0, 'fresh mobile Contact never requests hall models');
    assert.equal(await p.locator('.hall__stage').count(), 0);
    assert.equal(await overflow(p), 0);
    await p.screenshot({ path: `${out}/contact-${width}.png`, fullPage: true });
    await p.getByRole('button', { name: 'Menü öffnen' }).click();
    assert.equal(await p.locator('.site-nav__sheet a[href="/contact/"]').isVisible(), true);
    await p.keyboard.press('Escape');
    await p.goto(base);
    await p.locator('.mobile-arcade__machine img').first().evaluate(img => img.decode());
    assert.equal(await overflow(p), 0);
    await p.screenshot({ path: `${out}/home-${width}.png` });
    if (width === 390 || width === 844) {
      const exhibit = p.locator('[data-exhibit="riftback"]');
      await exhibit.locator('.mobile-arcade__open').click();
      const viewer = p.locator('.mobile-viewer');
      await p.locator('.mobile-viewer[data-state="ready"]').waitFor({ timeout: 45000 });
      await p.waitForTimeout(200);
      await p.screenshot({ path: `${out}/viewer-${width}.png` });
      await viewer.locator('[data-full]').click();
      await viewer.locator('[data-full-next]').click();
      assert.equal(await viewer.getAttribute('data-image'), '1');
      await viewer.locator('[data-full-close]').click();
      await viewer.locator('.mobile-viewer__links a').click();
      await p.waitForURL('**/work/riftback/');
      await p.screenshot({ path: `${out}/case-${width}.png` });
      const order = await p.evaluate(() => ({ title: document.querySelector('h1#case-title').getBoundingClientRect().top, capture: document.querySelector('.hall-panel__captures').getBoundingClientRect().top }));
      assert.ok(order.title < order.capture, 'title precedes mobile gallery');
      assert.equal(await overflow(p), 0);
      await p.locator('.hall-panel__back').click();
      await p.waitForURL(`${base}/`);
    }
    await p.goto(`${base}/about/`);
    await p.screenshot({ path: `${out}/about-${width}.png` });
    assert.equal(await p.locator('#about-career').getAttribute('open'), null);
    assert.equal(await p.locator('.about-current__games li').count(), 5);
    assert.equal(await overflow(p), 0);
    if (width === 390) {
      await p.locator('#about-process').scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${out}/about-process.png` });
      await p.locator('#about-current').scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${out}/about-current.png` });
      await p.locator('#about-career > summary').click();
      assert.notEqual(await p.locator('#about-career').getAttribute('open'), null);
      await p.goto(`${base}/en/about/#about-experience`);
      await p.waitForFunction(() => document.querySelector('#about-career')?.open);
      assert.equal(await overflow(p), 0);
      await p.goto(`${base}/work/`); await p.screenshot({ path: `${out}/projects-mobile.png` });
    }
    results.push({ width, height, contactModels: 0, overflow: 0 });
    console.log(JSON.stringify(results.at(-1)));
    await ctx.close();
  }
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage(); watch(p);
  await p.route('**/models/**', async route => { await new Promise(r => setTimeout(r, 2000)); await route.continue().catch(() => {}); });
  await p.goto(base, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${out}/desktop-loader.png` });
  await p.locator('.hall-startup__routes a').first().focus();
  await p.waitForFunction(() => document.querySelector('[data-startup-phase="ready"]'), null, { timeout: 45000 });
  await p.waitForFunction(() => document.activeElement?.matches('.site-nav a[href="/work/"]'));
  await p.locator('.site-nav a[href="/work/"]').first().evaluate(a => a.blur());
  await p.waitForTimeout(6500);
  await p.unroute('**/models/**');
  await p.screenshot({ path: `${out}/desktop-home.png` });
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(800); await p.keyboard.press('Enter');
  await p.waitForURL('**/work/riftback/');
  await p.waitForTimeout(600); await p.screenshot({ path: `${out}/desktop-case.png` });
  await p.keyboard.press('Escape'); await p.waitForURL(`${base}/`);
  await p.goto(`${base}/about/`); await p.waitForTimeout(3500); await p.screenshot({ path: `${out}/desktop-about.png` });
  await p.goto(`${base}/work/`); await p.screenshot({ path: `${out}/desktop-projects.png` });
  await p.goto(base); await p.waitForFunction(() => document.querySelector('[data-startup-phase="ready"]'), null, { timeout: 45000 });
  await p.setViewportSize({ width: 1024, height: 768 }); await p.waitForTimeout(6500);
  assert.equal(await overflow(p), 0); await p.screenshot({ path: `${out}/desktop-1024.png` });
  await ctx.close();
  const plain = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const nojs = await plain.newPage();
  await nojs.goto(`${base}/about/`); await nojs.locator('#about-career > summary').click();
  assert.notEqual(await nojs.locator('#about-career').getAttribute('open'), null);
  await nojs.goto(`${base}/contact/`); assert.equal(await nojs.locator('input[name="name"]').isVisible(), true);
  await plain.close();
  const reduced = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
  const r = await reduced.newPage(); r.on('pageerror', e => errors.push(String(e)));
  await r.route('**/models/**', route => route.abort());
  await r.goto(`${base}/work/berry/`, { waitUntil: 'domcontentloaded' });
  assert.equal(await r.locator('#case-title').isVisible(), true, 'case content does not wait for models');
  assert.equal(await r.locator('.project-activity[data-activity="paused"]').count(), 1);
  await r.goto(`${base}/contact/`, { waitUntil: 'domcontentloaded' });
  assert.equal(await r.locator('input[name="name"]').isVisible(), true);
  await reduced.close();
  const fallback = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await fallback.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      return /^webgl/.test(type) ? null : getContext.call(this, type, ...args);
    };
  });
  const f = await fallback.newPage();
  await f.goto(base); await f.waitForTimeout(1000);
  assert.equal(await f.locator('.hall-startup').isVisible(), false);
  assert.equal(await f.locator('.site-nav a[href="/work/"]').first().isVisible(), true);
  await f.screenshot({ path: `${out}/desktop-no-webgl.png` });
  await fallback.close();
  assert.deepEqual(errors, []);
  console.log('PASS: native Contact, menu, mobile galleries, About disclosures, DE/EN, desktop navigation, no-JS');
} finally {
  await writeFile(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2));
  await browser.close();
}
