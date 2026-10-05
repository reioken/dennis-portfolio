// Native mobile exhibition: rendering, network, navigation, history and desktop resize.
// node scripts/qa/hero/mobile-exhibition.mjs OUT [BASE]
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { outDir } from './_out.mjs';
import { exhibitInView, liveExhibits, modelOwners } from './_exhibits.mjs';

const out = outDir(process.argv[2], 'mobile-exhibition.mjs OUT [BASE]');
const base = process.argv[3] ?? 'http://localhost:4322';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors = [], results = [];
// Phones open an exhibit by tapping its cabinet; the caption's "Screens erkunden" button is hidden below 900 px.
const cabinet = slug => `[data-exhibit="${slug}"] .mobile-arcade__machine`;
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
    // The exhibit in view (the claw at the top) prepares its live model; no other exhibit may load one.
    const inView = await exhibitInView(page);
    if (inView) await page.locator(`[data-exhibit="${inView}"][data-live="ready"]`).waitFor({ timeout: 45000 });
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
    assert.equal(state.exhibits, 14); // claw, 12 project cabinets, phone (Deductidle and Ishikiri, October 4–5)
    assert.equal(state.first, 'kasse');
    assert.ok(state.height > state.viewport * 3);
    assert.equal(requests.filter(url => /\/Stage3D\./.test(url)).length, 0, 'mobile home must not load the hidden hall');
    const owners = modelOwners(requests);
    assert.ok(owners.every(owner => owner === inView), `only the exhibit in view (${inView}) may prepare, models of: ${owners.join(', ')}`);
    assert.deepEqual(await liveExhibits(page), inView ? [inView] : []);
    if (width === 320 || width === 390) await page.screenshot({ path: `${out}/home-${width}.png` });
    results.push({ width, ...state, inView, modelOwners: owners, posterRequests: requests.filter(url => url.includes('/media/mobile-arcade/')).length });

    if (width === 390) {
      // Scrolling on hands the one live model to the cabinet now in view.
      const seen = requests.length;
      await page.locator(cabinet('riftback')).scrollIntoViewIfNeeded();
      await page.locator('[data-exhibit="riftback"][data-live="ready"]').waitFor({ timeout: 45000 });
      assert.equal(await exhibitInView(page), 'riftback');
      assert.deepEqual(await liveExhibits(page), ['riftback'], 'one resident model');
      assert.deepEqual(modelOwners(requests.slice(seen)), ['riftback'], 'only the cabinet in view prepares');

      const lowlight = page.locator('[data-exhibit="lowlight"]');
      await page.locator(cabinet('lowlight')).scrollIntoViewIfNeeded();
      const before = await lowlight.evaluate(el => el.getBoundingClientRect().top);
      await page.locator(cabinet('lowlight')).click();
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
      for (const link of ['.mobile-arcade__machine', '.mobile-arcade__story']) {
        assert.ok((await page.locator(`[data-exhibit="riftback"] ${link}`).getAttribute('href')).startsWith('/en/'), `${link} localized`);
      }
      assert.ok(Math.abs(before - await page.locator('[data-exhibit="lowlight"]').evaluate(el => el.getBoundingClientRect().top)) < 3);
      await page.goto(base + '/en/');
      await page.locator('.mobile-arcade__machine img').first().evaluate(img => img.decode());
      await page.screenshot({ path: `${out}/home-en.png` });
      assert.equal(await page.locator('.hall__stage').count(), 0);
      // "Alle Projekte" opens the full list (?filter=all) since 2026-10-06, not the featured default
      await page.locator('.mobile-arcade__index[href="/en/work/?filter=all"]').click();
      await page.waitForURL('**/en/work/?filter=all');
      await page.locator('a[href="/en/work/mina/"]').first().waitFor({ state: 'attached' });
      // Let the index hydrate before leaving. Unmounting its React islands mid-hydration, while the desktop boot
      // below holds the main thread, logs React's recoverable error #424 (a 13 ms visit no reader makes).
      // Astro drops [ssr] when it schedules hydration; the idle callback waits for React to finish it.
      await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));
      await page.evaluate(() => new Promise(resolve => requestIdleCallback(() => resolve(), { timeout: 2000 })));
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
  assert.equal(await plain.locator('[data-exhibit]').count(), 14);
  await plain.locator(cabinet('riftback')).click();
  await plain.waitForURL('**/work/riftback/');
  await noJs.close();
  assert.deepEqual(errors, []);
  await writeFile(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2));
  console.log(JSON.stringify({ results, errors }, null, 2));
} finally {
  await browser.close();
}
