// Native mobile exhibition: rendering, network, navigation, history and desktop resize.
// node scripts/qa/hero/mobile-exhibition.mjs OUT [BASE]
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { outDir } from './_out.mjs';

const out = outDir(process.argv[2], 'mobile-exhibition.mjs OUT [BASE]');
const base = process.argv[3] ?? 'http://localhost:4322';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors = [], results = [];
try {
  for (const width of [320, 390, 768, 844]) {
    const context = await browser.newContext({ viewport: { width, height: width === 844 ? 390 : 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const requests = [];
    page.on('request', request => requests.push(request.url()));
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(base);
    await page.locator('.mobile-arcade__machine img').first().evaluate(img => img.decode());
    await page.waitForTimeout(700);
    const state = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - innerWidth,
      height: document.documentElement.scrollHeight,
      viewport: innerHeight,
      stage: Boolean(document.querySelector('.hall__stage')),
      pending: document.documentElement.classList.contains('gl-pending'),
      exhibits: document.querySelectorAll('[data-exhibit]').length,
      first: document.querySelector('[data-exhibit]')?.getAttribute('data-exhibit'),
    }));
    assert.equal(state.overflow, 0);
    assert.equal(state.stage, false);
    assert.equal(state.pending, false);
    assert.equal(state.exhibits, 12);
    assert.equal(state.first, 'kasse');
    assert.ok(state.height > state.viewport * 3);
    assert.equal(requests.filter(url => /\/Stage3D\./.test(url)).length, 0, 'mobile home must not load the hidden hall');
    assert.ok(requests.filter(url => /\/models\//.test(url)).every(url => url.includes('mach-riftback-')), 'only the visible cabinet may prepare');
    if (width === 320 || width === 390) await page.screenshot({ path: `${out}/home-${width}.png` });
    results.push({ width, ...state, posterRequests: requests.filter(url => url.includes('/media/mobile-arcade/')).length });

    if (width === 390) {
      const lowlight = page.locator('[data-exhibit="lowlight"]');
      await lowlight.locator('.mobile-arcade__open').scrollIntoViewIfNeeded();
      const before = await lowlight.evaluate(el => el.getBoundingClientRect().top);
      await lowlight.locator('.mobile-arcade__open').click();
      await page.locator('.mobile-viewer__links a').click();
      await page.waitForURL('**/work/lowlight/');
      await page.locator('.captures--native').waitFor();
      await page.locator('.hall-panel__back').click();
      await page.waitForURL(base + '/');
      await page.waitForTimeout(300);
      const after = await page.locator('[data-exhibit="lowlight"]').evaluate(el => el.getBoundingClientRect().top);
      assert.ok(Math.abs(before - after) < 3, `return position ${before} → ${after}`);
      await page.screenshot({ path: `${out}/return-lowlight.png` });
      await page.goBack();
      await page.waitForURL('**/work/lowlight/');
      await page.goForward();
      await page.waitForURL(base + '/');
      await page.waitForTimeout(250);
      assert.ok(Math.abs(before - await page.locator('[data-exhibit="lowlight"]').evaluate(el => el.getBoundingClientRect().top)) < 3);

      await page.getByRole('button', { name: 'Switch to English' }).click();
      await page.waitForURL('**/en/');
      await page.waitForTimeout(300);
      assert.equal(await page.locator('html').getAttribute('lang'), 'en');
      assert.ok((await page.locator('[data-exhibit="riftback"] .mobile-arcade__open').getAttribute('href')).startsWith('/en/'));
      assert.ok(Math.abs(before - await page.locator('[data-exhibit="lowlight"]').evaluate(el => el.getBoundingClientRect().top)) < 3);
      await page.goto(base + '/en/');
      await page.locator('.mobile-arcade__machine img').first().evaluate(img => img.decode());
      await page.screenshot({ path: `${out}/home-en.png` });
      assert.equal(await page.locator('.hall__stage').count(), 0);
      await page.locator('.mobile-arcade__index[href="/en/work/"]').click();
      await page.waitForURL('**/en/work/');
      assert.ok(await page.locator('a[href="/en/work/mina/"]').count());
      await page.goBack();
      await page.waitForURL('**/en/');

      // Boot is deferred on a phone; widening must still bring up the desktop hall.
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.locator('.hall.is-3d').waitFor({ timeout: 60000 });
      await page.waitForTimeout(2000);
      assert.equal(await page.locator('.mobile-arcade').isVisible(), false);
      await page.screenshot({ path: `${out}/desktop.png` });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator('.mobile-arcade').waitFor({ state: 'visible' });
      assert.equal(await page.locator('.hall').isVisible(), false);

      // About has its own visible claw and returns to the exhibition.
      await page.locator('.mobile-arcade__exhibit--about .mobile-arcade__open').click();
      await page.waitForURL('**/en/about/');
      await page.locator('.hall-panel').waitFor();
      await page.locator('.mobile-claw.is-ready').waitFor({ timeout: 45000 });
      await page.locator('.hall-panel__back').click();
      await page.waitForURL('**/en/');
      await page.locator('.mobile-arcade').waitFor({ state: 'visible' });
    }
    await context.close();
  }
  const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const plain = await noJs.newPage();
  await plain.goto(base);
  assert.ok(await plain.locator('.mobile-arcade').isVisible());
  assert.equal(await plain.locator('[data-exhibit]').count(), 12);
  await plain.locator('[data-exhibit="riftback"] .mobile-arcade__open').click();
  await plain.waitForURL('**/work/riftback/');
  await noJs.close();
  assert.deepEqual(errors, []);
  await writeFile(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2));
  console.log(JSON.stringify({ results, errors }, null, 2));
} finally {
  await browser.close();
}
