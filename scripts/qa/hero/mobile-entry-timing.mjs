import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { outDir } from './_out.mjs';
const out = outDir(process.argv[2], 'mobile-entry-timing.mjs OUT [BASE]');
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const results = [];
try {
  for (const dwell of [0, 6000]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.goto(process.argv[3] ?? 'http://localhost:4322');
    await page.locator('[data-exhibit="riftback"] .mobile-arcade__machine').scrollIntoViewIfNeeded();
    await page.waitForTimeout(dwell);
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.evaluate(() => {
        window.entryTimings = { start: performance.now() };
        const observer = new MutationObserver(() => {
          const dialog = document.querySelector('.mobile-viewer');
          const state = dialog?.dataset.state;
          if (state && !window.entryTimings[state]) window.entryTimings[state] = Math.round(performance.now() - window.entryTimings.start);
          if (state === 'ready' || state === 'fallback') observer.disconnect();
        });
        observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-state'] });
      });
      await page.locator('[data-exhibit="riftback"] .mobile-arcade__machine').click();
      await page.locator('.mobile-viewer[data-state="ready"]').waitFor({ timeout: 45000 });
      results.push({ dwell, attempt, ...await page.evaluate(() => ({ timings: window.entryTimings, preparation: { ...document.querySelector('.mobile-viewer__stage').dataset } })) });
      await page.locator('.mobile-viewer [data-close]').click();
      await page.locator('.mobile-viewer').waitFor({ state: 'detached' });
    }
    await context.close();
  }
  await writeFile(`${out}/timing.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
