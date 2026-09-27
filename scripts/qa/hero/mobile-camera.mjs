// Selected-cabinet camera and screenshot navigation; run against dev for camera telemetry.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { outDir } from './_out.mjs';
const out = outDir(process.argv[2], 'mobile-camera.mjs OUT [BASE]');
const base = process.argv[3] ?? 'http://localhost:4321';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const results = [], errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(String(error)));
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto(base);
  await page.waitForTimeout(800);
  assert.ok(requests.filter(url => /\/models\//.test(url)).every(url => url.includes('mach-riftback-')));
  for (const slug of ['riftback', 'lowlight', 'snapsize']) {
    const exhibit = page.locator(`[data-exhibit="${slug}"]`);
    await exhibit.locator('.mobile-arcade__open').scrollIntoViewIfNeeded();
    const scroll = await page.evaluate(() => scrollY);
    const overview = await page.evaluate(() => {
      const h = window.__hall;
      return h ? { state: 'overview', slug: h.machines[0]?.item.slug, pos: h.camera.position.toArray(), pose: h.pose } : null;
    });
    await exhibit.locator('.mobile-arcade__open').click();
    const dialog = page.locator('.mobile-viewer');
    await dialog.waitFor();
    const poses = overview?.slug === slug ? [overview] : [];
    for (let i = 0; i < 150; i++) {
      const sample = await page.evaluate(() => ({ state: document.querySelector('.mobile-viewer')?.dataset.state, pos: window.__hall?.camera?.position.toArray(), pose: window.__hall?.pose }));
      poses.push(sample);
      if (sample.state === 'ready' || sample.state === 'fallback') break;
      await page.waitForTimeout(200);
    }
    assert.equal(await dialog.getAttribute('data-state'), 'ready', `${slug} real 3D ready`);
    assert.ok(poses.some(p => p.pose === 'zoom'));
    assert.ok(poses.some(p => p.pose === 'screen'));
    const start = poses.find(p => p.pos)?.pos, end = poses.at(-1).pos;
    assert.ok(Math.abs(start[0] - end[0]) > .5, 'camera turns from side to monitor');
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}/${slug}-screen.png` });
    assert.equal(await dialog.getAttribute('data-image'), '0');
    await dialog.locator('[data-next]').click();
    assert.equal(await dialog.getAttribute('data-image'), '1');
    await dialog.locator('.mobile-viewer__screen:not([aria-busy])').waitFor();
    const shot = await dialog.locator('.mobile-viewer__full img').getAttribute('src');
    assert.equal(await page.evaluate(() => window.__hall.override), shot);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}/${slug}-next.png` });
    await dialog.locator('[data-full]').click();
    assert.equal(await dialog.locator('.mobile-viewer__full').isVisible(), true);
    await dialog.locator('[data-full-next]').click();
    assert.equal(await dialog.getAttribute('data-image'), '2');
    await dialog.locator('.mobile-viewer__full:not([aria-busy])').waitFor();
    await page.screenshot({ path: `${out}/${slug}-enlarged.png` });
    await dialog.locator('.mobile-viewer__full img').evaluate(el => {
      el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [new Touch({ identifier: 1, target: el, clientX: 90, clientY: 330 })] }));
      el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: [new Touch({ identifier: 1, target: el, clientX: 290, clientY: 330 })], cancelable: true }));
    });
    assert.equal(await dialog.getAttribute('data-image'), '1', 'swipe works in enlarged view');
    await dialog.locator('[data-full-close]').click();
    const next = dialog.locator('[data-control="tbtn_1"], [data-control="btn_2"]').first();
    if (await next.count()) {
      await next.click();
      assert.equal(await dialog.getAttribute('data-image'), '2');
    }
    await dialog.evaluate(el => {
      el.dispatchEvent(new TouchEvent('touchstart', { touches: [new Touch({ identifier: 1, target: el, clientX: 290, clientY: 330 })] }));
      el.dispatchEvent(new TouchEvent('touchend', { changedTouches: [new Touch({ identifier: 1, target: el, clientX: 90, clientY: 330 })], cancelable: true }));
    });
    assert.equal(await dialog.getAttribute('data-image'), await next.count() ? '3' : '2');
    if (slug === 'riftback') {
      await dialog.locator('select').selectOption('1');
      assert.equal(await dialog.getAttribute('data-image'), '0');
      await dialog.locator('.mobile-viewer__screen:not([aria-busy])').waitFor();
      assert.ok((await dialog.locator('.mobile-viewer__screen img').getAttribute('src')).includes('mobile'));
    }
    const lastImage = await dialog.getAttribute('data-image');
    const lastGroup = await dialog.locator('select').inputValue();
    await dialog.locator('[data-close]').click();
    await dialog.waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => scrollY), scroll);
    await exhibit.locator('.mobile-arcade__open').click();
    await page.locator('.mobile-viewer[data-state="ready"]').waitFor();
    assert.equal(await dialog.getAttribute('data-image'), lastImage, 'reopening retains the screenshot');
    assert.equal(await dialog.locator('select').inputValue(), lastGroup, 'reopening retains the surface group');
    await dialog.locator('[data-close]').click();
    await dialog.waitFor({ state: 'detached' });
    results.push({ slug, poses, shot });
  }
  // Closing during a slow model load must leave neither a dialog nor a scroll lock.
  await page.route('**/models/**', route => route.abort());
  await page.locator('[data-exhibit="berry"] .mobile-arcade__open').click();
  await page.locator('.mobile-viewer [data-close]').click();
  await page.waitForTimeout(1000);
  assert.equal(await page.locator('.mobile-viewer').count(), 0);
  assert.equal(await page.locator('html').evaluate(el => el.classList.contains('mobile-viewer-open')), false);
  await context.close();
  for (const [width, height, reducedMotion] of [[320, 700, 'reduce'], [844, 390, 'no-preference']]) {
    const ctx = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, reducedMotion });
    const p = await ctx.newPage();
    p.on('pageerror', error => errors.push(String(error)));
    await p.goto(base);
    await p.locator('[data-exhibit="safeplate"] .mobile-arcade__open').click();
    await p.locator('.mobile-viewer[data-state="ready"]').waitFor({ timeout: 45000 });
    const bounds = await p.locator('.mobile-viewer__screen').boundingBox();
    assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width + 1);
    await p.screenshot({ path: `${out}/safeplate-${width}.png` });
    await p.keyboard.press('Escape');
    await p.locator('.mobile-viewer').waitFor({ state: 'detached' });
    if (width === 320) {
      await p.locator('[data-exhibit="riftback"] .mobile-arcade__open').click();
      await p.locator('.mobile-viewer[data-state="ready"]').waitFor({ timeout: 45000 });
      const panel = await p.locator('.mobile-viewer__footer').evaluate(el => ({ width: el.clientWidth, content: el.scrollWidth }));
      assert.ok(panel.content <= panel.width, 'gallery panel must not overflow at 320 px');
      await p.screenshot({ path: `${out}/riftback-320.png` });
      await p.keyboard.press('Escape');
      await p.locator('.mobile-viewer').waitFor({ state: 'detached' });
    }
    await ctx.close();
  }
  const fallback = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const fp = await fallback.newPage();
  await fp.route('**/models/**', route => route.abort());
  await fp.goto(base);
  await fp.locator('[data-exhibit="berry"] .mobile-arcade__open').click();
  await fp.locator('.mobile-viewer[data-state="fallback"]').waitFor({ timeout: 45000 });
  await fp.locator('.mobile-viewer [data-next]').click();
  assert.equal(await fp.locator('.mobile-viewer').getAttribute('data-image'), '1');
  await fallback.close();
  assert.deepEqual(errors, []);
  await writeFile(`${out}/results.json`, JSON.stringify({ results, errors, models: requests.filter(url => /\/models\//.test(url)) }, null, 2));
  console.log(JSON.stringify({ passed: results.map(r => r.slug), errors }));
} finally { await browser.close(); }
