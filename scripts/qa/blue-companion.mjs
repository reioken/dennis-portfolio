// Blue accompanies the visitor: sits beside the focused cabinet, climbs the claw
// machine while About is open, comes back down afterwards. Runs against the dev server.
import { chromium } from 'file:///C:/Users/denni/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out = '.source-assets/blue/qa'; await fs.mkdir(out, { recursive: true });
const base = process.env.QA_BASE_URL || 'http://localhost:4321/';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11'] });
const report = {};
const state = page => page.evaluate(() => { const h = window.__hall, b = h.blue; return { focus: h.focus, pose: h.pose, mood: b.mood, plan: b.plan, elevation: b.elevation, pos: b.body.position.toArray().map(v => +v.toFixed(3)), yaw: +b.body.rotation.y.toFixed(2), purr: +b.purr.toFixed(2), blink: +b.blink.toFixed(2), path: location.pathname }; });
async function until(page, predicate, timeout, label) {
  const start = Date.now();
  while (Date.now() - start < timeout) { const s = await state(page); if (predicate(s)) return s; await page.waitForTimeout(250); }
  throw new Error(label + ': timeout, last state ' + JSON.stringify(await state(page)));
}
const crop = async (page, name) => { const c = await page.evaluate(() => { const b = window.__hall.blue.button; return { x: parseFloat(b.style.left) / 100 * innerWidth, y: parseFloat(b.style.top) / 100 * innerHeight, hidden: b.hidden }; }); if (!c.hidden) await page.screenshot({ path: `${out}/companion-${name}.png`, clip: { x: Math.max(0, c.x - 260), y: Math.max(0, c.y - 200), width: 520, height: 360 } }); await page.screenshot({ path: `${out}/companion-${name}-full.png` }); };
try {
  for (const [reduce, width, height] of [[false, 1440, 900], [true, 1440, 900], [false, 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: reduce ? 'reduce' : 'no-preference' });
    const tag = (reduce ? 'reduced-' : '') + (width < 600 ? 'phone-' : '');
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
    await page.goto(base);
    await page.waitForFunction(() => window.__hall?.readyDone && window.__hall?.blue, { timeout: 90000 });
    await page.waitForTimeout(reduce ? 500 : 6000);
    const home = await state(page); assert.equal(home.plan.kind, 'home');
    // Station: pick the third cabinet, Blue strolls in and sits beside it.
    await page.evaluate(() => window.__hall.cb.onPick(2));
    const seated = await until(page, s => s.focus === 2 && (s.mood === 'sit' || s.mood === 'sitidle'), reduce ? 4000 : 30000, 'sit at station 2');
    assert.equal(seated.plan.kind, 'station'); assert.equal(seated.elevation, 0);
    const stationX = await page.evaluate(() => window.__hall.stationX.map(v => +v.toFixed(3)));
    // Blue's positions are root-local; compact layouts shift the root by (.4, 0, .05) and scale it by .75.
    const scale = width < 600 ? .75 : 1, shiftX = width < 600 ? .4 : 0, shiftZ = width < 600 ? .05 : 0;
    const world = pos => [pos[0] * scale + shiftX, pos[1] * scale, pos[2] * scale + shiftZ];
    const sitAt = world(seated.pos);
    assert.ok(Math.abs(Math.abs(sitAt[0] - stationX[2]) - .92) < .08, 'sits beside the cabinet: ' + JSON.stringify(sitAt));
    assert.ok(Math.abs(sitAt[2] - .8) < .08, 'sits on the lane: ' + JSON.stringify(sitAt));
    await page.waitForTimeout(reduce ? 300 : 2200); await crop(page, tag + 'station');
    report[tag + 'station'] = await state(page);
    // About: the claw cabinet is station 0 and the panel opens on top of the hall.
    await page.evaluate(() => document.querySelector('a[href="/about/"], a[href="/en/about/"]').click());
    const perched = await until(page, s => s.pose !== 'hall' && s.focus === 0 && s.mood === 'perchidle', reduce ? 6000 : 45000, 'perch on About');
    const perchAt = world(perched.pos);
    assert.ok(Math.abs(perched.elevation * scale - 1.95) < .01 && Math.abs(perchAt[1] - 1.95) < .01, 'on the cabinet top: ' + JSON.stringify(perchAt));
    assert.ok(Math.abs(perchAt[2] - .2) < .04 && Math.abs(perchAt[0]) < .04, 'at the front edge: ' + JSON.stringify(perchAt));
    assert.ok(Math.abs(perched.yaw) < .08, 'faces the viewer: ' + perched.yaw);
    await page.waitForTimeout(reduce ? 300 : 1500); await crop(page, tag + 'perch');
    report[tag + 'perch'] = perched;
    if (!reduce && width >= 600) {
      // Petting on the ledge: eyes close and he pushes his head, without standing up.
      await page.evaluate(() => window.__hall.blue.pet());
      await page.waitForTimeout(900);
      const petted = await state(page); assert.equal(petted.mood, 'perchidle'); assert.ok(petted.purr > 0 && petted.blink > .8, JSON.stringify(petted));
      await crop(page, 'perch-petted');
      // Back to the hall: down again and off to the basket.
      await page.goBack();
      const down = await until(page, s => s.pose === 'hall' && s.elevation === 0 && s.mood !== 'jump' && s.mood !== 'unperch', 30000, 'climb down');
      assert.equal(down.plan.kind, 'home'); assert.ok(down.pos[1] < .2, JSON.stringify(down));
      await page.waitForTimeout(1500); await crop(page, 'home-again');
      report.down = await state(page);
    }
    assert.equal(errors.length, 0, errors.join('\n'));
    await page.close();
  }
} finally { await browser.close(); }
console.log(JSON.stringify(report, null, 1));
await fs.writeFile(`${out}/companion-results.json`, JSON.stringify(report, null, 2));
