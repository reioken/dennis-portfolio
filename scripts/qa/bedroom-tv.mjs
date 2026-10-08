// The bedroom corner: real model decoding, static batching, visual framing, pointer/keyboard close-up,
// recovery, responsive desktop framing and exclusion from the native phone exhibition.
// node scripts/qa/bedroom-tv.mjs OUT [BASE]
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { outDir } from './hero/_out.mjs';
const require = createRequire(import.meta.url), { chromium } = require('playwright');
const out = outDir(process.argv[2], 'node scripts/qa/bedroom-tv.mjs OUT [BASE]');
const base = process.argv[3] ?? 'http://localhost:4321';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const checks = [], errors = [];
const check = (name, ok, detail) => { checks.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`, ok ? '' : detail ?? ''); };
async function session(viewport, reduce = false) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1.5, reducedMotion: reduce ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 500)); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  return { ctx, page };
}
const state = page => page.evaluate(() => {
  const h = window.__hall, corner = h?.bedroom;
  const button = document.querySelector('.hall-bedroom'), close = document.querySelector('.hall-bedroom-close');
  const rect = button?.getBoundingClientRect();
  return { pose: h?.pose, exists: !!corner, ready: !!document.querySelector('[data-ready-ms]'),
    twin: button && !button.hidden, close: close && !close.hidden, focus: document.activeElement?.className,
    meshes: corner?.group.children.length, assemblies: corner?.group.userData.assemblies,
    triangles: corner?.group.children.reduce((n, m) => n + (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3, 0),
    position: corner?.group.position.toArray(), scale: corner?.group.scale.x,
    dock: getComputedStyle(document.querySelector('.hall-dock')).visibility,
    rect: rect && { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
    resources: performance.getEntriesByType('resource').filter(x => x.name.includes('bedroom-tv-v9')).length,
    materialNames: corner?.group.children.map(m => m.material.name),
  };
});
const { ctx, page } = await session({ width: 1920, height: 1080 });
await page.waitForFunction(() => document.querySelector('[data-ready-ms]') && document.querySelector('.hall-bedroom:not([hidden])'), null, { timeout: 65000 });
await page.waitForTimeout(4800);
let s = await state(page);
check('corner loaded with the claw', s.exists && s.ready && s.twin, s);
if (s.exists) {
  check('Corrected detail budget: under 60 material draws and 750k triangles', s.meshes < 60 && s.triangles < 750000, { meshes: s.meshes, triangles: s.triangles });
  check('all fifteen source pieces and the curved CRT screen survived', ['tv-stand','bedroom-crt','crt-screen','nintendo-gamecube','nintendo-snes','nintendo-64','nintendo-gameboy','nintendo-ds','gamecube-controller','snes-controller','n64-controller','bedroom-cable-gamecube','bedroom-cable-av','bedroom-case-stack-0','bedroom-remote','bedroom-retro-games','bedroom-melee-case','bedroom-yoshi-cartridge','bedroom-smash64-cartridge'].every(n => s.assemblies?.includes(n)), s.assemblies);
  check('right of claw, beside the back wall', s.position[0] > 0 && s.position[2] < -1, s.position);
  check('individual original covers and handheld/CRT screens', ['cover-gc-melee','cover-gc-wind-waker','cover-label-ocarina','cover-label-yoshi','cover-label-smash64','cover-label-link-past','cover-links-awakening','cover-mario-ds','crt-image','gb-image','ds-top-image','ds-touch-image'].every(n => s.materialNames.includes(n)), s.materialNames);
}
await page.screenshot({ path: `${out}/01-hall.png`, scale: 'css' });
await page.locator('.hall-bedroom').click(); await page.waitForTimeout(1600);
s = await state(page);
check('TV click opens inspect view and moves focus to return', s.pose === 'bedroom' && s.close && s.focus === 'hall-bedroom-close' && s.dock === 'hidden', s);
await page.screenshot({ path: `${out}/02-inspect.png`, scale: 'css' });
await page.keyboard.press('ArrowRight');
check('arrow key keeps inspection open', (await state(page)).pose === 'bedroom');
await page.keyboard.press('Escape'); await page.waitForTimeout(1200);
s = await state(page);
check('Escape restores hall, dock and opener focus', s.pose === 'hall' && s.twin && !s.close && s.focus === 'hall-bedroom' && s.dock === 'visible', s);
await page.keyboard.press('Enter'); await page.waitForTimeout(1100);
check('keyboard opens TV corner', (await state(page)).pose === 'bedroom');
await page.locator('.hall-bedroom-close').click(); await page.waitForTimeout(1000);
check('return button closes', (await state(page)).pose === 'hall');
await page.locator('.hall-cd').click(); await page.waitForTimeout(1200);
check('existing hi-fi close-up still opens', (await state(page)).pose === 'player');
await page.keyboard.press('Escape'); await page.waitForTimeout(1200);
check('hi-fi returns to hall', (await state(page)).pose === 'hall');
if (s.exists) {
  await page.locator('.hall-bedroom').click(); await page.waitForTimeout(900);
  await page.evaluate(() => { window.__bedroomOld = window.__hall; window.__hall.renderer.forceContextLoss(); });
  await page.waitForFunction(() => window.__hall && window.__hall !== window.__bedroomOld && window.__hall.bedroom && window.__hall.readyDone, null, { timeout: 65000 });
  await page.waitForTimeout(900); s = await state(page);
  check('GPU recovery restores the corner and inspect pose', s.exists && s.pose === 'bedroom' && s.close && s.dock === 'hidden', s);
  await page.keyboard.press('Escape'); await page.waitForTimeout(900);
  await page.locator('.hall-cd').click(); await page.waitForTimeout(900);
  await page.evaluate(() => { window.__bedroomOld = window.__hall; window.__hall.renderer.forceContextLoss(); });
  await page.waitForFunction(() => window.__hall && window.__hall !== window.__bedroomOld && window.__hall.cd && window.__hall.readyDone, null, { timeout: 65000 });
  await page.waitForTimeout(900);
  check('GPU recovery also restores the existing hi-fi close-up', (await state(page)).pose === 'player' && await page.locator('.hall-cd-menu').isVisible());
  await page.keyboard.press('Escape'); await page.waitForTimeout(900);
}
await page.setViewportSize({ width: 1344, height: 730 }); await page.waitForTimeout(1200);
await page.locator('.hall-bedroom').click(); await page.waitForTimeout(1400);
await page.screenshot({ path: `${out}/03-short-desktop.png`, scale: 'css' });
check('short desktop inspection opens', (await state(page)).pose === 'bedroom');
await ctx.close();
const mobile = await session({ width: 390, height: 844 }, true); const requests = [];
mobile.page.on('request', r => { if (r.url().includes('/models/bedroom-tv-v9')) requests.push(r.url()); });
await mobile.page.waitForTimeout(3500);
check('native phone home does not load the desktop corner', await mobile.page.locator('.hall-bedroom').count() === 0 && requests.length === 0, requests);
await mobile.ctx.close();
check('no page, console or network errors', errors.length === 0, errors);
writeFileSync(`${out}/checks.json`, JSON.stringify({ checks, errors }, null, 2));
await browser.close();
process.exit(checks.some(x => !x.ok) ? 1 : 0);
