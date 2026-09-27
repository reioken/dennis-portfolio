// Verify that moving the live cabinet into the dialog preserves its projection.
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
  await page.locator('[data-exhibit="riftback"] .mobile-arcade__live').waitFor({ timeout: 45000 });
  await page.waitForTimeout(250);
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
      window.handoff = { before: points(), stopped: !h.running, screenBlend: h.machines[0].dissolve?.uniforms.screenBlend.value };
      const original = h.enterExhibitFrom.bind(h);
      h.enterExhibitFrom = rect => { original(rect); window.handoff.after = points(); };
    });
    await page.screenshot({ path: `${out}/${attempt}-before.png` });
    await page.locator('[data-exhibit="riftback"] .mobile-arcade__open').click();
    await page.locator('.mobile-viewer[data-state="entering"]').waitFor();
    await page.screenshot({ path: `${out}/${attempt}-entry.png` });
    await page.waitForTimeout(180);
    await page.screenshot({ path: `${out}/${attempt}-moving.png` });
    await page.locator('.mobile-viewer[data-state="ready"]').waitFor();
    const sample = await page.evaluate(() => window.handoff);
    assert.ok(sample.stopped, 'list canvas must not run continuously');
    assert.equal(sample.screenBlend, 1, 'the list must not freeze on an unfinished screenshot dissolve');
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
    sample.exitJump = Math.max(...exit.exitBefore.map((p,i) => Math.hypot(p.x-exit.exitAfter[i].x,p.y-exit.exitAfter[i].y)));
    assert.ok(sample.exitJump < .5, `return handoff moved the cabinet ${sample.exitJump}px`);
    await page.screenshot({ path: `${out}/${attempt}-returned.png` });
    results.push({ attempt, ...sample });
  }
  assert.deepEqual(errors, []);
  await writeFile(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2));
  console.log(JSON.stringify({ results, errors }, null, 2));
} finally { await browser.close(); }
