// Blue turns with steps instead of spinning: a goal behind him triggers a turn clip whose root yaw drives the
// body, walking curves at a bounded yaw rate, and settling/sitting/perching is preceded by a turn rather than a
// spin during the clip. Runs against the dev server; every frame is stepped by hand so the numbers are exact.
import { chromium } from 'file:///C:/Users/denni/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out = '.source-assets/blue/qa'; await fs.mkdir(out, { recursive: true });
const base = process.env.QA_BASE_URL || 'http://localhost:4321/';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11'] });
const report = {};
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  await page.goto(base);
  await page.waitForFunction(() => window.__hall?.readyDone && window.__hall?.blue, { timeout: 90000 });
  await page.waitForTimeout(3000);
  // Drive Blue by hand: park him facing +z on the lane, then send him to a goal straight behind him.
  const run = await page.evaluate(() => {
    const h = window.__hall, b = h.blue; h.stop();
    const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
    b.body.position.set(-1.2, 0, .7); b.body.rotation.set(0, 0, 0); b.elevation = 0; b.plan = { kind: 'home' };
    b.enter('idle'); b.visits = 0; b.plannedVisits = 9;
    for (let i = 0; i < 20; i++) b.update(1 / 60, h.camera, true, false);
    b.goal.set(-1.2, 0, .2); b.arrival = 'idle'; b.travelSpeed = .21; b.enter('walk');
    const frames = []; let lastYaw = b.yaw;
    for (let i = 0; i < 60 * 12; i++) {
      b.update(1 / 60, h.camera, true, false);
      const yaw = b.yaw, rate = wrap(yaw - lastYaw) * 60; lastYaw = yaw;
      frames.push({ t: i / 60, mood: b.mood, clip: b.mood === 'turn' ? b.turnClip : '', scale: b.turnScale, rate, yaw, speed: b.speed, x: b.body.position.x, z: b.body.position.z });
      if (b.mood === 'idle' && i > 60 && Math.hypot(b.body.position.x + 1.2, b.body.position.z - .2) < .05) break;
    }
    return frames;
  });
  const turns = run.filter(f => f.mood === 'turn');
  const walking = run.filter(f => f.mood === 'walk');
  assert.ok(turns.length > 10, 'a turn clip played for a goal behind him');
  const clips = [...new Set(turns.map(f => f.clip))];
  const turnYaw = turns.reduce((sum, f) => sum + f.rate / 60, 0);
  const walkRates = walking.map(f => Math.abs(f.rate));
  report.behind = { clips, scales: [...new Set(turns.map(f => +f.scale.toFixed(2)))], turnFrames: turns.length, turnYawDeg: +(turnYaw * 180 / Math.PI).toFixed(1),
    maxWalkYawRate: +Math.max(0, ...walkRates).toFixed(2), maxTurnYawRate: +Math.max(...turns.map(f => Math.abs(f.rate))).toFixed(2), endYawDeg: +(run.at(-1).yaw * 180 / Math.PI).toFixed(1), frames: run.length };
  assert.ok(clips.every(c => /^turn[LR](45|90)$/.test(c)), 'turn clips: ' + clips);
  assert.ok(Math.abs(turnYaw) > 1.7, 'the turn clips carried most of the 180°: ' + report.behind.turnYawDeg);
  assert.ok(report.behind.maxWalkYawRate < 1.15, 'walking yaw rate bounded: ' + report.behind.maxWalkYawRate);
  // One continuous sweep: 90° in about 0.6 s peaks near 4 rad/s, a stretched 135° turn a little higher.
  assert.ok(report.behind.maxTurnYawRate < 6.5, 'turn yaw rate plausible: ' + report.behind.maxTurnYawRate);
  // Arrival at the basket: a turn precedes the settle, and the settle itself no longer spins.
  const home = await page.evaluate(() => {
    const h = window.__hall, b = h.blue;
    const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
    b.body.position.set(-1.65, 0, .6); b.body.rotation.set(0, -1.6, 0); b.enter('idle'); b.visits = 9; b.plannedVisits = 2;
    b.goal.set(-1.65, 0, .18); b.arrival = 'home'; b.travelSpeed = .21; b.enter('walk');
    const frames = []; let lastYaw = b.yaw;
    for (let i = 0; i < 60 * 14; i++) {
      b.update(1 / 60, h.camera, true, false);
      const yaw = b.yaw; frames.push({ mood: b.mood, rate: wrap(yaw - lastYaw) * 60, yaw }); lastYaw = yaw;
      if (b.mood === 'sleep') break;
    }
    return { moods: [...new Set(frames.map(f => f.mood))], settleRate: Math.max(0, ...frames.filter(f => f.mood === 'settle').map(f => Math.abs(f.rate))), finalYaw: frames.at(-1).yaw, sawTurn: frames.some(f => f.mood === 'turn') };
  });
  report.home = { ...home, settleRate: +home.settleRate.toFixed(2), finalYaw: +home.finalYaw.toFixed(2) };
  assert.ok(home.sawTurn, 'turned before settling: ' + home.moods);
  assert.ok(home.settleRate < .5, 'settle no longer spins: ' + home.settleRate);
  assert.ok(Math.abs(home.finalYaw - .95) < .12, 'faces the rest yaw: ' + home.finalYaw);
  await page.evaluate(() => { const h = window.__hall; h.dirty = h.mirrorDirty = true; h.renderFrame(); });
  await page.screenshot({ path: `${out}/turn-final.png` });
  assert.equal(errors.length, 0, errors.join('\n'));
  await page.close();
} finally { await browser.close(); }
console.log(JSON.stringify(report, null, 1));
await fs.writeFile(`${out}/turn-results.json`, JSON.stringify(report, null, 2));
