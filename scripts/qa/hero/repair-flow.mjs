// Focused interaction/readiness regression for the repair pass; no forms submitted.
// node scripts/qa/hero/repair-flow.mjs OUT BASE
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { outDir } from './_out.mjs';

const [out, base = 'http://127.0.0.1:4322'] = process.argv.slice(2);
const dir = outDir(out, 'repair-flow.mjs OUT BASE');
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const report = { errors: [], checks: [] };
const watch = page => {
  page.on('pageerror', e => report.errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
};
try {
  const context = await browser.newContext({ viewport: { width:1920, height:1080 } });
  const page = await context.newPage();
  watch(page);
  // Exercise readiness with delayed material dependencies, not just a warm localhost cache.
  await page.route('**/textures/hardware/wear-*', async route => {
    await new Promise(resolve => setTimeout(resolve, 800));
    await route.continue();
  });
  await page.goto(base + '/work/safeplate/', { waitUntil:'domcontentloaded' });
  await page.waitForSelector('.hall.is-3d .hall__stage[data-startup-phase="ready"]', { timeout:60000 });
  await page.waitForTimeout(3000);
  const materials = await page.evaluate(() => ({
    compile:performance.getEntriesByName('hall:compile-start')[0]?.startTime,
    resources:performance.getEntriesByType('resource').filter(r => /wear-|hero-environment/.test(r.name)).map(r => ({ name:r.name.split('/').at(-1), end:r.responseEnd }))
  }));
  assert.equal(materials.resources.length, 7);
  assert.ok(materials.resources.every(r => r.end <= materials.compile), 'All material images must arrive before shader preparation');
  report.checks.push({ materials });
  await page.locator('.captures__large').click();
  await page.waitForSelector('.closeup__proxy', { timeout:10000 });
  assert.ok(await page.locator('.closeup__proxy').count() >= 2, 'Essfreude retains its hardware controls');
  await page.waitForTimeout(2000);
  const closeupImage = await page.locator('.closeup__shot.is-current img').evaluate(img => ({ src:img.currentSrc, width:img.naturalWidth }));
  assert.ok(closeupImage.width > 0, 'Close-up image loads');
  await page.screenshot({ path:`${dir}/safeplate-closeup.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
  await page.evaluate(() => { window.__repairCanvas = document.querySelector('.hall__stage canvas'); });
  await page.locator('.lang-switch').first().click();
  await page.waitForURL('**/en/work/safeplate/');
  assert.ok(await page.evaluate(() => window.__repairCanvas === document.querySelector('.hall__stage canvas')), 'Language switch retains the hall');
  await page.goBack();
  await page.waitForURL('**/work/safeplate/');
  await page.locator('.hall-panel__back').click();
  // The saved language preference may redirect home to /en/ after going back.
  await page.waitForURL(url => url.origin === new URL(base).origin && /^\/(?:en\/)?$/.test(url.pathname));
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(1200);
  report.checks.push('Essfreude close-up controls, Escape, language switch, history and return to hall');
  await context.close();

  const phone = await browser.newContext({ viewport:{ width:390,height:844 }, hasTouch:true, isMobile:true });
  const p = await phone.newPage();
  watch(p);
  await p.goto(base + '/work/nexus/', { waitUntil:'networkidle' });
  const slides = p.locator('.captures__slide');
  assert.ok(await slides.first().isVisible());
  await slides.first().click();
  await p.getByRole('dialog').waitFor({ state:'visible' });
  await p.keyboard.press('Escape');
  await p.getByRole('dialog').waitFor({ state:'hidden' });
  await p.locator('.captures__hero').evaluate(el => { el.scrollLeft = el.children[1].offsetLeft - 20; });
  await p.waitForTimeout(700);
  assert.match(await p.locator('.captures__caption').innerText(), /^02/);
  await p.setViewportSize({ width:844,height:390 });
  await p.waitForTimeout(500);
  assert.ok(await p.locator('.hall-panel__back').isVisible());
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  report.checks.push('Phone lightbox, swipe selection, landscape resize and reachable back button');
  await phone.close();
  assert.deepEqual(report.errors, []);
} finally {
  await browser.close();
  await writeFile(`${dir}/flow.json`, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report));
