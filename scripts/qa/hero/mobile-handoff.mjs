// Verify that moving the live cabinet into the dialog preserves its projection.
// node scripts/qa/hero/mobile-handoff.mjs OUT [DEV_BASE]  (dev server: reads window.__hall)
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { outDir } from './_out.mjs';
const out = outDir(process.argv[2], 'mobile-handoff.mjs OUT [DEV_BASE]');
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors = [], results = [];
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(process.argv[3] ?? 'http://localhost:4321');
  // Phones open an exhibit by tapping its cabinet; the caption's "Screens erkunden" button is hidden below 900 px.
  const machine = page.locator('[data-exhibit="riftback"] .mobile-arcade__machine');
  await machine.scrollIntoViewIfNeeded();
  await page.locator('[data-exhibit="riftback"] .mobile-arcade__live').waitFor({ timeout: 45000 });
  await page.waitForTimeout(250);
  // The cabinet in view animates in the list: its poster view, capped at 30 fps (the hall itself runs at 60).
  const loop = await page.evaluate(() => new Promise(resolve => {
    const h = window.__liveCabinet = window.__hall;
    let frames = 0, last = h.last;
    const t0 = performance.now();
    const count = () => {
      if (h.last !== last) { frames++; last = h.last; }
      if (performance.now() - t0 < 1000) requestAnimationFrame(count);
      else resolve({ slug: h.machines[0].item.slug, running: h.running, poster: h.exhibitPoster, frames });
    };
    requestAnimationFrame(count);
  }));
  assert.equal(loop.slug, 'riftback');
  assert.ok(loop.running && loop.poster, 'the cabinet in view runs in its poster view');
  assert.ok(loop.frames > 0 && loop.frames <= 32, `the list canvas drew ${loop.frames} frames in 1 s; the exhibit loop is capped at 30 fps`);
  for (const attempt of ['first', 'reopen', 'scrolled']) {
    if (attempt === 'scrolled') await page.evaluate(() => scrollBy(0, 180));
    await page.evaluate(() => {
      const h = window.__hall;
      const points = () => {
        const r = h.renderer.domElement.getBoundingClientRect();
        return [[0, 0, 0], [0, 1, 0], [.3, 1.6, .2]].map(([x,y,z]) => {
          const p = h.machines[0].group.position.clone().set(x,y,z).applyMatrix4(h.machines[0].group.matrixWorld).project(h.camera);
          return { x: r.x + (p.x + 1) * r.width / 2, y: r.y + (1 - p.y) * r.height / 2 };
        });
      };
      window.handoffPoints = points;
      window.handoff = {};
      // Sampled at the tap itself (window capture runs before MobileArcade's document handler moves the canvas),
      // so a scroll that is still settling cannot skew the comparison.
      addEventListener('click', () => Object.assign(window.handoff, { before: points(), running: h.running }), { capture: true, once: true });
      const original = h.enterExhibitFrom.bind(h);
      h.enterExhibitFrom = rect => { original(rect); window.handoff.after = points(); };
    });
    await page.screenshot({ path: `${out}/${attempt}-before.png` });
    await machine.click();
    await page.locator('.mobile-viewer[data-state="entering"]').waitFor();
    await page.screenshot({ path: `${out}/${attempt}-entry.png` });
    await page.waitForTimeout(180);
    await page.screenshot({ path: `${out}/${attempt}-moving.png` });
    await page.locator('.mobile-viewer[data-state="ready"]').waitFor();
    const sample = await page.evaluate(() => window.handoff);
    assert.ok(sample.running, 'entry starts from the running list canvas');
    sample.maxJump = Math.max(...sample.before.map((p,i) => Math.hypot(p.x-sample.after[i].x,p.y-sample.after[i].y)));
    assert.ok(sample.maxJump < .5, `handoff moved the cabinet ${sample.maxJump}px`);
    assert.equal(await page.locator('.mobile-viewer__poster').isVisible(), false, 'no recentered poster during entry');
    await page.locator('.mobile-viewer [data-next]').click();
    await page.evaluate(() => {
      const h = window.__hall;
      const arrived = event => {
        if (event.detail.pose !== 'zoom' || document.querySelector('.mobile-viewer')?.dataset.state !== 'closing') return;
        window.handoff.exitBefore = window.handoffPoints();
        document.removeEventListener('hall:settled', arrived);
      };
      document.addEventListener('hall:settled', arrived);
      const original = h.renderExhibitPoster.bind(h);
      h.renderExhibitPoster = () => {
        original();
        window.handoff.exitAfter = window.handoffPoints();
        window.handoff.parkedBlend = h.machines[0].dissolve?.uniforms.screenBlend.value;
        h.renderExhibitPoster = original;
      };
    });
    await page.locator('.mobile-viewer [data-close]').click();
    await page.locator('.mobile-viewer[data-state="closing"]').waitFor();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/${attempt}-returning.png` });
    await page.locator('.mobile-viewer').waitFor({ state: 'detached' });
    await page.locator('[data-exhibit="riftback"] .mobile-arcade__live').waitFor();
    const exit = await page.evaluate(() => window.handoff);
    assert.ok(exit.exitBefore && exit.exitAfter, 'return reaches the list before parking');
    assert.equal(exit.parkedBlend, 1, 'the list must not park on an unfinished screenshot dissolve');
    sample.exitJump = Math.max(...exit.exitBefore.map((p,i) => Math.hypot(p.x-exit.exitAfter[i].x,p.y-exit.exitAfter[i].y)));
    assert.ok(sample.exitJump < .5, `return handoff moved the cabinet ${sample.exitJump}px`);
    await page.screenshot({ path: `${out}/${attempt}-returned.png` });
    results.push({ attempt, ...sample, parkedBlend: exit.parkedBlend });
  }
  // Scrolled out of view, the list canvas stops; the page then moves its one live model to the exhibit in view.
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.__liveCabinet.running), false, 'the cabinet stops once out of view');
  assert.deepEqual(errors, []);
  await writeFile(`${out}/results.json`, JSON.stringify({ loop, results, errors }, null, 2));
  console.log(JSON.stringify({ loop, results, errors }, null, 2));
} finally { await browser.close(); }
