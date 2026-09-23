// Scripted play test for "Your tag", the Breakout sprayed on the hall's brick wall (src/components/hall/wallGame.ts).
//
//   node scripts/qa/wall-game.mjs              (dev server; QA_BASE_URL overrides, default http://localhost:4322/)
//   QA_SKIP=headed,firefox,long node ...       skips the headed-Chromium pass, the Firefox pass, the 60 s heap round
//
// Drives the can with real pointer events, then checks the rules, the pause behaviour, who owns the keyboard, the
// frame cost while playing, that an idle field asks the hall for no frames — and the tag: it accumulates on the GPU
// while the ball flies, stays through game over and idle, is buffed by the next start, is buffed away on its own
// once its time on the idle wall is up, is never stored (a reload finds a clean wall) and a lost WebGL context
// throws nothing.
import { chromium, firefox } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const OUT = process.env.QA_OUT || path.join(os.tmpdir(), 'wall-game', 'v3', 'qa');
const BASE = process.env.QA_BASE_URL || 'http://localhost:4322/';
const SKIP = new Set((process.env.QA_SKIP || '').split(',').filter(Boolean));
await fs.mkdir(OUT, { recursive: true });

const ARGS = ['--use-angle=d3d11', '--enable-precise-memory-info', '--js-flags=--expose-gc'];
const errors = [];
const warnings = [];

const ready = async page => {
  await page.waitForFunction(() => window.__hall?.readyDone, null, { timeout: 120000 });
  await page.waitForFunction(() => window.__hall?.wallGame?.state?.visible && window.__hall.wallPaint.game.wallGameOpacity.value > 0, null, { timeout: 20000 });
};
const watch = (page, label) => {
  page.on('pageerror', e => errors.push(`${label}: ${e.message} ${(e.stack || '').split(/\n/).slice(1, 3).join(' ')}`));
  page.on('console', m => {
    if (m.type() === 'error') errors.push(`${label} console: ${m.text()}`);
    if (m.type() === 'warning') warnings.push(`${label} warning: ${m.text()}`);
  });
};
/** The painted field's screen rect from the real hall camera. */
const fieldBox = page => page.evaluate(() => {
  const H = window.__hall, f = H.wallGame.state.field, cam = H.camera;
  cam.updateMatrixWorld();
  const el = H.renderer.domElement.getBoundingClientRect();
  const pts = [[f.left, f.bottom - 0.2], [f.right, f.bottom - 0.2], [f.left, f.top + 0.4], [f.right, f.top + 0.4]].map(([x, y]) => {
    const v = new H.camLook.constructor(x, y, H.wallZ).project(cam);
    return { x: (v.x * 0.5 + 0.5) * el.width + el.left, y: (-v.y * 0.5 + 0.5) * el.height + el.top };
  });
  return { left: Math.min(...pts.map(p => p.x)), right: Math.max(...pts.map(p => p.x)), top: Math.min(...pts.map(p => p.y)), bottom: Math.max(...pts.map(p => p.y)) };
});
const state = page => page.evaluate(() => window.__hall.wallGame.state);
const coverage = page => page.evaluate(() => window.__hall.wallGame.debugCoverage());
const clickField = async (page, box) => page.mouse.click((box.left + box.right) / 2, box.bottom - (box.bottom - box.top) * 0.3);
/** Follows the ball with real pointer moves; restarts the round when one ends, unless told to stop there. */
const trackFor = async (page, ms, { stopAtEnd = false } = {}) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const p = await page.evaluate(() => {
      const H = window.__hall, g = H.wallGame, s = g.state, cam = H.camera;
      cam.updateMatrixWorld();
      const el = H.renderer.domElement.getBoundingClientRect();
      const v = new H.camLook.constructor(s.ball.x, s.field.paddleY, H.wallZ).project(cam);
      return { x: (v.x * 0.5 + 0.5) * el.width + el.left, y: (-v.y * 0.5 + 0.5) * el.height + el.top, mode: s.mode, served: s.served };
    });
    if (p.mode === 'end' || p.mode === 'repaint') { if (stopAtEnd) break; await page.waitForTimeout(200); continue; }
    if (p.mode === 'idle') { if (stopAtEnd) break; await page.mouse.click(p.x, p.y - 40); await page.waitForTimeout(60); continue; }
    if (p.mode === 'serve' && p.served > 0) { await page.mouse.click(p.x, p.y - 40); await page.waitForTimeout(60); continue; }
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(22);
  }
};
const frameStats = frames => {
  const sorted = frames.slice().sort((a, b) => a - b);
  const pick = q => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
  return { n: frames.length, p50: pick(0.5), p95: pick(0.95), max: sorted[sorted.length - 1] };
};
const startFrameLog = page => page.evaluate(() => {
  window.__wallFrames = [];
  if (window.__wallFrameLog) return;
  window.__wallFrameLog = true;
  let last = 0;
  const tick = t => { if (last) window.__wallFrames.push(t - last); last = t; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});

const browser = await chromium.launch({ headless: true, args: ARGS });
try {
  /* ---------- the field must be painted without ever getting an idle slice ----------
   * It used to be built from requestIdleCallback. Measured 2026-09-21: under the hall's own render loop that
   * callback fires in 23 ms in headless Chromium but only on its 3 s timeout in a real headed window, and a
   * starved callback was never retried. Every headless capture showed the game; Dennis's real session showed a
   * bare wall. Nothing in the game may depend on idle callbacks. */
  const starved = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await starved.addInitScript(() => {
    window.requestIdleCallback = () => 1;          // accepted, never called back
    window.cancelIdleCallback = () => {};
  });
  watch(starved, 'starved');
  await starved.goto(BASE);
  await ready(starved);
  await starved.waitForTimeout(1200);
  const starvedState = await starved.evaluate(() => ({
    opacity: window.__hall.wallPaint.game.wallGameOpacity.value,
    maskWidth: window.__hall.wallPaint.game.wallGameMask.value.image?.width ?? 0,
    atlasWidth: window.__hall.wallPaint.game.wallGameAtlas.value.image?.width ?? 0,
    tagWidth: window.__hall.wallPaint.game.wallGameTag.value.image?.width ?? 0,
    visible: window.__hall.wallGame.state.visible,
  }));
  console.log('no idle slice ever:', JSON.stringify(starvedState));
  assert.equal(starvedState.visible, true);
  assert.ok(starvedState.opacity > 0, 'the field was never painted without an idle callback');
  assert.ok(starvedState.maskWidth > 1 && starvedState.atlasWidth > 1 && starvedState.tagWidth > 1, 'mask, atlas or tag target was never built');
  await starved.close();

  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  watch(page, 'page');
  await page.goto(BASE);
  await ready(page);
  /* ---------- the batten is on the room's circuit: dark while the hall powers up, never ahead of it ---------- */
  const powerUp = await page.evaluate(async () => {
    const H = window.__hall, samples = [];
    const { roomPowerLevels, roomCircuitOffset } = await import('/src/components/hall/roomPower.mjs');
    const t0 = performance.now();
    while (performance.now() - t0 < 6000) {
      const age = H.powerAt === null ? null : performance.now() - H.powerAt;
      const want = age === null ? 1 : roomPowerLevels(age, roomCircuitOffset(H.wallGame.centreX, H.stationX[H.initialFocus])).circuit;
      samples.push({ age, power: H.wallGame.power, want, lamp: H.wallPaint.game.wallGameLightColor.value.g });
      await new Promise(r => requestAnimationFrame(r));
    }
    return samples;
  });
  const during = powerUp.filter(s => s.age !== null);
  const worst = Math.max(...during.map(s => Math.abs(s.power - s.want)));
  console.log(`power-up: ${during.length} frames on the room's cue, first power ${powerUp[0].power.toFixed(3)}, largest deviation from the circuit curve ${worst.toFixed(3)}, final ${powerUp.at(-1).power}`);
  assert.ok(during.length > 30, 'the room did not run its power-up cue');
  assert.ok(powerUp[0].power < 0.2, `the batten was already on when the room was dark (${powerUp[0].power})`);
  assert.ok(worst < 0.25, `the batten left the room's circuit curve by ${worst.toFixed(3)}`);
  assert.equal(powerUp.at(-1).power, 1, 'the batten did not end at full power');
  await page.waitForTimeout(500);

  const programsBefore = await page.evaluate(() => window.__hall.renderer.info.programs.length);
  const fresh = await state(page);
  assert.equal(fresh.cols, 11, '1920x1080 plays the full eleven bricks');
  assert.equal(fresh.blocks, fresh.totalBlocks);
  assert.equal(fresh.hasPaint, false, 'a first visit must find a clean wall');
  const c0 = await coverage(page);
  assert.ok(c0.coat < 1e-5 && c0.fresh < 1e-5, 'the tag target was not empty on a first visit');

  /* ---------- idle: the painted field must not ask the hall to draw ---------- */
  await page.evaluate(() => {
    const g = window.__hall.wallGame;
    const original = g.update.bind(g);
    window.__wallProbe = { calls: 0, asked: 0 };
    g.update = t => { window.__wallProbe.calls += 1; const r = original(t); if (r) window.__wallProbe.asked += 1; return r; };
  });
  await page.waitForTimeout(7000);
  const idleProbe = await page.evaluate(() => ({ ...window.__wallProbe, mode: window.__hall.wallGame.state.mode }));
  console.log('idle 7 s:', JSON.stringify(idleProbe));
  assert.equal(idleProbe.mode, 'idle');
  assert.ok(idleProbe.calls > 200, `the hall ticked the game ${idleProbe.calls} times`);
  // One 0.6 s attract pulse (the can's shake and puff) every 6 s and nothing else.
  assert.ok(idleProbe.asked < 100, `an idle field asked for ${idleProbe.asked} frames`);

  const box = await fieldBox(page);
  const clip = { x: Math.max(0, Math.round(box.left - 40)), y: Math.max(0, Math.round(box.top - 30)), width: Math.round(box.right - box.left + 80), height: Math.round(box.bottom - box.top + 60) };
  await page.screenshot({ path: `${OUT}/idle.png`, clip });

  /* ---------- hovering the field offers a pointer, the wall next to it does not ---------- */
  await page.mouse.move((box.left + box.right) / 2, (box.top + box.bottom) / 2);
  await page.waitForTimeout(220);
  assert.equal(await page.evaluate(() => window.__hall.renderer.domElement.style.cursor), 'pointer', 'no pointer cursor over the field');
  await page.mouse.move(box.right + 60, box.bottom + 120);
  await page.waitForTimeout(220);
  assert.equal(await page.evaluate(() => window.__hall.renderer.domElement.style.cursor), '', 'the bare wall claimed a pointer cursor');

  /* ---------- a click starts the round; it must not open a station ---------- */
  const startUrl = page.url();
  await clickField(page, box);
  await page.waitForFunction(() => window.__hall.wallGame.state.mode === 'play', null, { timeout: 2500 });
  assert.equal(page.url(), startUrl, 'the click navigated away');
  assert.equal(await page.evaluate(() => window.__hall.focus), 0);

  /* ---------- keep the ball alive for 20 s with real pointer moves ---------- */
  await startFrameLog(page);
  await page.evaluate(() => {
    window.__wallWatch = { tunnel: 0, maxScore: 0, minLives: 9, flat: 0 };
    const g = window.__hall.wallGame;
    window.setInterval(() => {
      const s = g.state;
      window.__wallWatch.maxScore = Math.max(window.__wallWatch.maxScore, s.score);
      window.__wallWatch.minLives = Math.min(window.__wallWatch.minLives, s.lives);
      if (s.mode !== 'play') return;
      const v = Math.hypot(s.ball.vx, s.ball.vy);
      if (v > 0.01 && Math.abs(s.ball.vy) < 0.22 * v) window.__wallWatch.flat += 1;
      // a ball inside a live block means it tunnelled through its face (grid read off the game itself)
      const rows = 6, stride = g.alive.length / rows;
      for (let r = 0; r < rows; r++) {
        const y0 = g.rowY(r);
        if (s.ball.y < y0 + 0.004 || s.ball.y > y0 + 1 / 12 - 0.004) continue;
        const left = g.rowLeft(r);
        const c = Math.floor((s.ball.x - left) / 0.25);
        if (c < 0 || c >= g.rowCols(r)) continue;
        const cx = left + (c + 0.5) * 0.25;
        if (Math.abs(s.ball.x - cx) < 0.125 - 0.004 && g.alive[r * stride + c]) window.__wallWatch.tunnel += 1;
      }
    }, 20);
  });
  await trackFor(page, 20000);
  await page.screenshot({ path: `${OUT}/playing.png`, clip });
  let s = await state(page);
  const watched = await page.evaluate(() => window.__wallWatch);
  console.log('after 20 s:', JSON.stringify({ mode: s.mode, score: s.score, blocks: s.blocks, lives: s.lives, tagPoints: s.tagPoints }), JSON.stringify(watched));
  assert.ok(watched.maxScore > 0, 'the score never moved');
  assert.equal(watched.tunnel, 0, 'the ball was found inside a live block');
  assert.equal(watched.flat, 0, 'the ball ran near-horizontal');

  /* ---------- the tag accumulates while the ball flies ---------- */
  const c1 = await coverage(page);
  await trackFor(page, 3000);
  const c2 = await coverage(page);
  console.log('tag coverage after 20 s / 23 s:', JSON.stringify(c1), JSON.stringify(c2));
  assert.ok(c1.coat > 0.004, `20 s of play left almost nothing on the wall (${c1.coat})`);
  assert.ok(c2.coat > c1.coat, 'the tag stopped growing while the ball was flying');
  assert.ok(s.tagPoints > 10, 'no impact points were recorded for the replay');

  /* ---------- a clean frame-time window: still playing, no harness traffic ---------- */
  await page.evaluate(() => { window.__wallFrames.length = 0; });
  await page.waitForTimeout(4000);
  const f1080 = frameStats(await page.evaluate(() => window.__wallFrames.slice()));
  console.log(`frame times while playing, 1920x1080 (${f1080.n} frames): p50 ${f1080.p50.toFixed(1)} ms, p95 ${f1080.p95.toFixed(1)} ms, max ${f1080.max.toFixed(1)} ms`);
  assert.ok(f1080.p95 < 26, `p95 frame time ${f1080.p95.toFixed(1)} ms`);

  /* ---------- the keyboard belongs to the game while it runs ---------- */
  await page.evaluate(() => {
    const g = window.__hall.wallGame;
    g.mode = 'serve'; g.phaseAt = performance.now() + 1e6;
    g.paddleGoal = g.paddleX = g.centreX;
  });
  const before = (await state(page)).paddleX;
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(420);
  await page.keyboard.up('ArrowLeft');
  const after = await page.evaluate(() => ({ paddleX: window.__hall.wallGame.state.paddleX, focus: window.__hall.focus }));
  console.log('arrow key:', before.toFixed(3), '->', after.paddleX.toFixed(3), 'focus', after.focus);
  assert.ok(after.paddleX < before - 0.05, 'the arrow key did not move the can');
  assert.equal(after.focus, 0, 'the arrow key walked the hall while the game was running');

  /* ---------- Escape ends the round: the piece is signed and stays, the keys go back to the hall ---------- */
  await page.evaluate(() => { const g = window.__hall.wallGame; g.mode = 'play'; g.penDown = false; g.ball.vx = 0.5; g.ball.vy = 1.2; });
  const cEsc = await coverage(page);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const stopped = await state(page);
  console.log('after Escape:', JSON.stringify({ mode: stopped.mode, engaged: stopped.engaged, tagSigned: stopped.tagSigned }));
  assert.ok(stopped.mode === 'end' || stopped.mode === 'repaint', 'Escape did not end the round');
  assert.equal(stopped.tagSigned, 1, 'Escape did not sign the piece');
  assert.equal(stopped.engaged, false, 'the game kept the keyboard after Escape');
  assert.ok(Math.hypot(stopped.ball.vx, stopped.ball.vy) < 1e-6, 'the ball kept flying after Escape');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(500);
  const walked = await page.evaluate(() => ({ focus: window.__hall.focus, visible: window.__hall.wallGame.state.visible }));
  console.log('after Escape + ArrowRight:', JSON.stringify(walked));
  assert.equal(walked.focus, 1, 'the hall did not take the arrow key back');
  assert.equal(walked.visible, false, 'the field stayed painted away from station 0');

  /* ---------- back at station 0: the wall is whole, idle, and the signed tag is still on it ---------- */
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(900);
  await page.waitForFunction(() => window.__hall.wallGame.state.mode === 'idle', null, { timeout: 15000 });
  const back = await state(page);
  assert.equal(back.visible, true);
  assert.equal(await page.evaluate(() => window.__hall.wallGame.power), 1, 'back at station 0 the batten must be fully on');
  assert.equal(back.blocks, back.totalBlocks, 'the wall came back with holes in it');
  assert.ok((await coverage(page)).coat >= cEsc.coat * 0.98, 'the tag did not survive the trip to the next station');

  /* ---------- the stop mark ends a running round; so does a click off the play area ---------- */
  const box2 = await fieldBox(page);
  await clickField(page, box2);
  await page.waitForFunction(() => window.__hall.wallGame.state.mode === 'play', null, { timeout: 4000 });
  await trackFor(page, 2500);
  const stopAt = await page.evaluate(() => {
    const H = window.__hall, s = H.wallGame.state.stop, cam = H.camera; cam.updateMatrixWorld();
    const el = H.renderer.domElement.getBoundingClientRect();
    const v = new H.camLook.constructor(s.x + s.w / 2, s.y + s.h / 2, H.wallZ).project(cam);
    return { x: (v.x * 0.5 + 0.5) * el.width + el.left, y: (-v.y * 0.5 + 0.5) * el.height + el.top };
  });
  await page.mouse.click(stopAt.x, stopAt.y);
  await page.waitForTimeout(300);
  const viaMark = await state(page);
  console.log('stop mark:', JSON.stringify({ mode: viaMark.mode, tagSigned: viaMark.tagSigned, engaged: viaMark.engaged }));
  assert.ok(viaMark.mode === 'end' || viaMark.mode === 'repaint', 'the stop mark did not end the round');
  assert.equal(viaMark.tagSigned, 1);
  assert.equal(viaMark.engaged, false);
  await page.waitForFunction(() => window.__hall.wallGame.state.mode === 'idle', null, { timeout: 15000 });
  await clickField(page, box2);
  await page.waitForFunction(() => window.__hall.wallGame.state.mode === 'play', null, { timeout: 4000 });
  await trackFor(page, 1500);
  await page.mouse.click((box2.left + box2.right) / 2, box2.top + 8);            // the score band, above the play area
  await page.waitForTimeout(300);
  const viaOutside = await state(page);
  assert.ok(viaOutside.mode === 'end' || viaOutside.mode === 'repaint', 'a click off the play area did not end the round');
  await page.waitForFunction(() => window.__hall.wallGame.state.mode === 'idle', null, { timeout: 15000 });

  /* ---------- left alone, a round ends by itself ---------- */
  await clickField(page, box2);
  await page.waitForFunction(() => window.__hall.wallGame.state.mode === 'play', null, { timeout: 4000 });
  await page.mouse.move(box2.right + 300, box2.bottom + 200);
  const t0 = Date.now();
  await page.waitForFunction(() => window.__hall.wallGame.state.tagSigned === 1 && window.__hall.wallGame.state.mode !== 'play', null, { timeout: 45000 });
  const alone = await state(page);
  console.log(`unattended: over after ${((Date.now() - t0) / 1000).toFixed(1)} s, lives left ${alone.lives}`);
  assert.ok(Date.now() - t0 < 40000, 'an unattended round ran for more than 40 s');
  await page.waitForFunction(() => window.__hall.wallGame.state.mode === 'idle', null, { timeout: 15000 });
  await clickField(page, box2);
  await page.waitForFunction(() => window.__hall.wallGame.state.mode === 'play', null, { timeout: 4000 });
  await trackFor(page, 1500);

  const cRound = await coverage(page);
  /* ---------- a missed ball costs a life, three cost the round ---------- */
  const drop = lives => page.evaluate(lives => {
    const g = window.__hall.wallGame, f = g.state.field;
    g.lives = lives; g.mode = 'play'; g.penDown = false;
    g.paddleGoal = g.paddleX = f.right - 0.3;                       // parked well away from the ball
    g.ball.x = f.left + 0.3; g.ball.y = f.bottom + 0.4; g.ball.vx = 0.2; g.ball.vy = -1.6;
  }, lives);
  await drop(3);
  await page.waitForTimeout(800);
  const oneDown = await state(page);
  console.log('after a miss:', JSON.stringify({ lives: oneDown.lives, mode: oneDown.mode }));
  assert.equal(oneDown.lives, 2, 'a missed ball did not cost a life');
  await drop(1);
  await page.waitForFunction(() => ['end', 'repaint'].includes(window.__hall.wallGame.state.mode), null, { timeout: 6000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/game-over.png`, clip });
  await page.waitForFunction(() => window.__hall.wallGame.state.mode === 'idle', null, { timeout: 15000 });
  await page.waitForTimeout(400);
  const done = await state(page);
  const c3 = await coverage(page);
  console.log('back to idle:', JSON.stringify({ blocks: done.blocks, lives: done.lives, best: done.best, tagSigned: done.tagSigned, tagPoints: done.tagPoints }), JSON.stringify(c3));
  assert.equal(done.blocks, done.totalBlocks, 'the wall was not re-sprayed');
  assert.equal(done.lives, 3);
  assert.ok(done.best > 0, 'no high score was kept');
  assert.equal(done.tagSigned, 1, 'the finished tag was not signed');
  /* ---------- the tag persists through game over and idle ---------- */
  assert.ok(c3.coat >= cRound.coat, 'the tag did not survive game over');
  await page.screenshot({ path: `${OUT}/finished.png`, clip });

  /* ---------- and it goes quiet again ---------- */
  await page.evaluate(() => { window.__wallProbe.calls = 0; window.__wallProbe.asked = 0; });
  await page.waitForTimeout(7000);
  const idleAfter = await page.evaluate(() => window.__wallProbe);
  console.log('idle 7 s after the round:', JSON.stringify(idleAfter));
  assert.ok(idleAfter.calls > 200);
  assert.ok(idleAfter.asked < 100, `the field asked for ${idleAfter.asked} frames after the round`);
  assert.ok((await coverage(page)).coat >= c3.coat * 0.98, 'the tag faded while idle');

  const stored = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('hall.wall-game.tag')));
  assert.deepEqual(stored, [], `the tag was stored: ${stored}`);
  const c5 = await coverage(page);

  /* ---------- the next start buffs it ---------- */
  const box3 = await fieldBox(page);
  await clickField(page, box3);
  await page.waitForFunction(() => window.__hall.wallGame.state.mode === 'play', null, { timeout: 4000 });
  const c6 = await coverage(page);
  console.log('after the buff:', JSON.stringify(c6));
  assert.ok(c6.coat < c5.coat * 0.3, `the old tag was not buffed (${c6.coat} vs ${c5.coat})`);

  /* ---------- a whole minute of play: no allocation growth, no new shader programs ---------- */
  if (!SKIP.has('long')) {
    await trackFor(page, 3000);
    const heapBefore = await page.evaluate(() => { window.gc?.(); window.gc?.(); return performance.memory.usedJSHeapSize; });
    await trackFor(page, 60000);
    const heapAfter = await page.evaluate(() => { window.gc?.(); window.gc?.(); return performance.memory.usedJSHeapSize; });
    const deltaMb = (heapAfter - heapBefore) / 1048576;
    console.log(`heap over a 60 s round: ${(heapBefore / 1048576).toFixed(1)} -> ${(heapAfter / 1048576).toFixed(1)} MB (${deltaMb >= 0 ? '+' : ''}${deltaMb.toFixed(2)} MB)`);
    assert.ok(deltaMb < 3, `the heap grew by ${deltaMb.toFixed(2)} MB over a minute of play`);
  }
  /* ---------- a cleared wall: crowned, re-sprayed, and still no new shader program ---------- */
  await page.evaluate(() => { const g = window.__hall.wallGame; let keep = 1; for (let i = 0; i < g.alive.length; i++) if (g.alive[i]) { if (keep-- > 0) continue; g.alive[i] = 0; } g.lives = 3; });
  await trackFor(page, 60000, { stopAtEnd: true });
  await page.waitForFunction(() => window.__hall.wallGame.state.mode === 'idle', null, { timeout: 20000 });
  const crowned = await state(page);
  console.log('cleared wall:', JSON.stringify({ tagSigned: crowned.tagSigned, blocks: crowned.blocks, score: crowned.score }));
  assert.equal(crowned.tagSigned, 2, 'a cleared wall was not crowned');
  assert.equal(crowned.blocks, crowned.totalBlocks);
  await page.screenshot({ path: `${OUT}/cleared.png`, clip });
  /* ---------- its time on the idle wall runs out: the roller buffs it away, no ghost ---------- */
  const cCrowned = await coverage(page);
  await page.evaluate(() => { window.__hall.wallGame.tagExpire = performance.now(); window.__hall.wallGame.request(); });
  await page.waitForFunction(() => !window.__hall.wallGame.state.hasPaint, null, { timeout: 5000 });
  await page.waitForTimeout(300);
  const faded = await state(page);
  const cFaded = await coverage(page);
  console.log('tag expired on the idle wall:', JSON.stringify({ mode: faded.mode, tagPoints: faded.tagPoints, tagSigned: faded.tagSigned }), JSON.stringify(cFaded));
  assert.equal(faded.mode, 'idle');
  assert.equal(faded.tagPoints, 0, 'the expired tag kept its points');
  assert.ok(cFaded.coat < cCrowned.coat * 0.02, `the expired tag is still on the wall (${cFaded.coat} vs ${cCrowned.coat})`);
  await page.screenshot({ path: `${OUT}/expired.png`, clip });
  const programsAfter = await page.evaluate(() => window.__hall.renderer.info.programs.length);
  console.log(`shader programs: ${programsBefore} -> ${programsAfter}`);
  assert.equal(programsAfter, programsBefore, 'playing compiled a new shader program');
  await context.close();

  /* ---------- 2560x1440: frame times, and the full field in frame ---------- */
  const big = await browser.newPage({ viewport: { width: 2560, height: 1440 } });
  watch(big, '1440p');
  await big.goto(BASE);
  await ready(big);
  await big.waitForTimeout(3000);
  await clickField(big, await fieldBox(big));
  await big.waitForFunction(() => window.__hall.wallGame.state.mode === 'play', null, { timeout: 2500 });
  await startFrameLog(big);
  await trackFor(big, 8000);
  await big.evaluate(() => { window.__wallFrames.length = 0; });
  await big.waitForTimeout(4000);
  const f1440 = frameStats(await big.evaluate(() => window.__wallFrames.slice()));
  console.log(`frame times while playing, 2560x1440 (${f1440.n} frames): p50 ${f1440.p50.toFixed(1)} ms, p95 ${f1440.p95.toFixed(1)} ms, max ${f1440.max.toFixed(1)} ms`);
  assert.ok(f1440.p95 < 34, `p95 frame time at 2560x1440 ${f1440.p95.toFixed(1)} ms`);
  /* ---------- a lost WebGL context, mid-round: the hall falls back to its CSS backdrop (Stage3D.tsx), the game
   * must not throw, and the next load starts on a clean wall ---------- */
  await big.evaluate(() => new Promise(resolve => {
    const H = window.__hall, canvas = H.renderer.domElement;
    canvas.addEventListener('webglcontextlost', () => setTimeout(resolve, 800), { once: true });
    H.renderer.getContext().getExtension('WEBGL_lose_context').loseContext();
  }));
  await big.reload();
  await ready(big);
  await big.waitForTimeout(1500);
  const afterLoss = await state(big);
  const cLoss = await coverage(big);
  console.log('context lost mid-round, then reloaded:', JSON.stringify({ tagPoints: afterLoss.tagPoints }), JSON.stringify(cLoss));
  assert.equal(afterLoss.tagPoints, 0, 'a reload brought an old tag back');
  assert.ok(cLoss.coat < 0.002, 'a reload found paint on the wall');
  await big.close();

  /* ---------- placement: in frame with 5 % to the left edge, at every supported window ---------- */
  for (const [w, h] of [[1366, 768], [1440, 900], [1920, 1080], [2560, 1080], [2560, 1440], [1024, 768]]) {
    const p = await browser.newPage({ viewport: { width: w, height: h } });
    watch(p, `${w}x${h}`);
    await p.goto(BASE);
    await ready(p);
    await p.waitForTimeout(1500);
    const m = await p.evaluate(() => {
      const H = window.__hall, g = H.wallGame, f = g.state.field, cam = H.camera, V = H.camLook.constructor;
      const el = H.renderer.domElement.getBoundingClientRect();
      const header = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
      let minLeft = 1, minTop = 1, maxBottom = 0;
      for (const [dx, dy] of [[0, 0], [-0.6, 0.18], [0.6, -0.18], [-0.6, -0.18], [0.6, 0.18]]) {
        cam.position.set(H.camPos.x + dx, H.camPos.y + dy, H.camPos.z);
        cam.lookAt(H.camLook.x + Math.sign(dx) * 0.175, H.camLook.y, H.camLook.z);
        cam.updateMatrixWorld();
        const P = (x, y) => { const v = new V(x, y, H.wallZ).project(cam); return [v.x * 0.5 + 0.5, -v.y * 0.5 + 0.5]; };
        minLeft = Math.min(minLeft, P(f.paintedLeft, f.bottom)[0], P(f.paintedLeft, f.top)[0]);
        minTop = Math.min(minTop, P(f.left, f.top + 0.45)[1], P(f.right, f.top + 0.45)[1]);
        maxBottom = Math.max(maxBottom, P(f.left, f.bottom - 0.30)[1]);
      }
      const title = H.wallPaint.uniforms.wallPaintRect.value;
      return { cols: g.state.cols, left: minLeft, top: minTop, bottom: maxBottom, header: header / el.height, toTitle: title.x - f.right, toCabinet: -0.63 - f.right };
    });
    console.log(`${w}x${h}: ${m.cols} bricks, left ${(m.left * 100).toFixed(1)} %, top ${(m.top * 100).toFixed(1)} % (header ${(m.header * 100).toFixed(1)} %), bottom ${(m.bottom * 100).toFixed(1)} %, to lettering ${m.toTitle.toFixed(2)} m, to cabinet ${m.toCabinet.toFixed(2)} m`);
    assert.ok(m.left >= 0.05, `${w}x${h}: only ${(m.left * 100).toFixed(1)} % to the left screen edge`);
    assert.ok(m.top > m.header + 0.02, `${w}x${h}: the field runs under the header`);
    assert.ok(m.toTitle >= 0.35 && m.toCabinet >= 1.2, `${w}x${h}: too close to the lettering or the cabinet`);
    await p.screenshot({ path: `${OUT}/placement-${w}x${h}.png` });
    await p.close();
  }

  /* ---------- touch: a tap and a drag on the field, and a swipe next to it still walks the hall ---------- */
  const touch = await browser.newPage({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: false });
  watch(touch, 'touch');
  await touch.goto(BASE);
  await ready(touch);
  await touch.waitForTimeout(2500);
  const tbox = await fieldBox(touch);
  await touch.touchscreen.tap((tbox.left + tbox.right) / 2, (tbox.top + tbox.bottom) / 2);
  await touch.waitForFunction(() => window.__hall.wallGame.state.mode === 'play', null, { timeout: 2500 });
  assert.equal(await touch.evaluate(() => window.__hall.focus), 0, 'the tap moved the hall');
  // a drag inside the field steers the can and must not swipe the hall
  await touch.evaluate(() => { const g = window.__hall.wallGame; g.mode = 'serve'; g.phaseAt = performance.now() + 1e6; g.paddleGoal = g.paddleX = g.centreX; });
  const tBefore = (await state(touch)).paddleX;
  const dragFrom = { x: (tbox.left + tbox.right) / 2, y: tbox.bottom - 40 };
  await touch.dispatchEvent('.hall__canvas', 'pointerdown', { pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1, clientX: dragFrom.x, clientY: dragFrom.y });
  for (let i = 1; i <= 8; i++) {
    await touch.dispatchEvent('.hall__canvas', 'pointermove', { pointerId: 7, pointerType: 'touch', isPrimary: true, buttons: 1, clientX: dragFrom.x - i * 12, clientY: dragFrom.y });
    await touch.waitForTimeout(16);
  }
  await touch.dispatchEvent('.hall__canvas', 'pointerup', { pointerId: 7, pointerType: 'touch', isPrimary: true, buttons: 0, clientX: dragFrom.x - 96, clientY: dragFrom.y });
  await touch.waitForTimeout(250);
  const dragged = await touch.evaluate(() => ({ paddleX: window.__hall.wallGame.state.paddleX, focus: window.__hall.focus }));
  console.log('touch drag:', tBefore.toFixed(3), '->', dragged.paddleX.toFixed(3));
  assert.ok(dragged.paddleX < tBefore - 0.2, `the drag did not move the can (${dragged.paddleX.toFixed(3)})`);
  assert.equal(dragged.focus, 0, 'the drag swiped the hall');
  // the same gesture well clear of the field still walks the hall
  await touch.evaluate(() => { const g = window.__hall.wallGame; g.stopRound(true); });
  const away = { x: tbox.right + 200, y: tbox.bottom + 120 };
  const beforeSwipe = await touch.evaluate(() => window.__hall.focus);
  await touch.dispatchEvent('.hall', 'pointerdown', { pointerId: 9, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1, clientX: away.x, clientY: away.y });
  await touch.dispatchEvent('.hall', 'pointerup', { pointerId: 9, pointerType: 'touch', isPrimary: true, buttons: 0, clientX: away.x - 180, clientY: away.y });
  await touch.waitForTimeout(700);
  const afterSwipe = await touch.evaluate(() => window.__hall.focus);
  console.log('swipe beside the field:', beforeSwipe, '->', afterSwipe);
  assert.equal(afterSwipe, beforeSwipe + 1, 'the hall stopped swiping next to the field');
  await touch.close();

  /* ---------- storage blocked: everything still works, nothing throws ---------- */
  const blocked = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  // Two uncaught SecurityErrors on this page are not the game's: the Astro dev toolbar (getSettings) and
  // src/components/FxBoot.tsx read localStorage unguarded. Everything else still counts.
  blocked.on('pageerror', e => { if (e.message !== 'The operation is insecure.') errors.push(`storage-blocked: ${e.message}`); });
  blocked.on('console', m => { if (m.type() === 'error') errors.push(`storage-blocked console: ${m.text()}`); });
  const denied = [];
  await blocked.exposeFunction('__denied', where => denied.push(where));
  await blocked.addInitScript(() => {
    const deny = () => { try { window.__denied?.(String(new Error().stack)); } catch { /* not exposed yet */ } throw new DOMException('The operation is insecure.', 'SecurityError'); };
    for (const k of ['getItem', 'setItem', 'removeItem']) Storage.prototype[k] = deny;
  });
  await blocked.goto(BASE);
  await ready(blocked);
  await blocked.waitForTimeout(2500);
  await clickField(blocked, await fieldBox(blocked));
  await blocked.waitForFunction(() => window.__hall.wallGame.state.mode === 'play', null, { timeout: 2500 });
  await trackFor(blocked, 3000);
  await blocked.evaluate(() => { const g = window.__hall.wallGame; g.lives = 1; g.penDown = false; g.ball.y = 0; });
  await blocked.waitForFunction(() => window.__hall.wallGame.state.mode === 'idle', null, { timeout: 15000 });
  const blockedState = await state(blocked);
  console.log('storage blocked:', JSON.stringify({ mode: blockedState.mode, tagSigned: blockedState.tagSigned, hasPaint: blockedState.hasPaint }));
  assert.equal(blockedState.tagSigned, 1);
  assert.equal(blockedState.hasPaint, true);
  assert.ok(denied.some(d => d.includes('wallGame')), 'the game never touched storage, so this pass proved nothing');
  await blocked.close();

  /* ---------- reduced motion: still playable, no flecks, no buff/re-spray animation, no attract pulse ---------- */
  const calm = await browser.newPage({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'reduce' });
  watch(calm, 'reduce');
  await calm.goto(BASE);
  await ready(calm);
  assert.equal(await calm.evaluate(() => window.__hall.wallGame.power), 1, 'reduced motion: the batten must simply be on');
  await calm.waitForTimeout(2000);
  await calm.evaluate(() => {
    const g = window.__hall.wallGame;
    const original = g.update.bind(g);
    window.__wallProbe = { calls: 0, asked: 0 };
    g.update = t => { window.__wallProbe.calls += 1; const r = original(t); if (r) window.__wallProbe.asked += 1; return r; };
  });
  await calm.waitForTimeout(7000);
  const calmIdle = await calm.evaluate(() => window.__wallProbe);
  console.log('reduced motion, idle 7 s:', JSON.stringify(calmIdle));
  assert.equal(calmIdle.asked, 0, 'reduced motion must not pulse the attract hint');
  await clickField(calm, await fieldBox(calm));
  await calm.waitForFunction(() => window.__hall.wallGame.state.mode === 'play', null, { timeout: 2500 });
  const calmProbe = await calm.evaluate(async () => {
    const g = window.__hall.wallGame;
    let flecks = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < 2500) {
      if (g.flecks.some(f => f.ttl > 0)) flecks += 1;
      await new Promise(r => requestAnimationFrame(r));
    }
    g.lives = 1; g.mode = 'play'; g.penDown = false; g.ball.y = 0;
    await new Promise(r => setTimeout(r, 2200));
    return { flecks, mode: g.state.mode, blocks: g.state.blocks, total: g.state.totalBlocks, signed: g.state.tagSigned, jobs: g.state.jobs };
  });
  console.log('reduced motion:', JSON.stringify(calmProbe));
  assert.equal(calmProbe.flecks, 0, 'reduced motion threw paint flecks');
  assert.equal(calmProbe.blocks, calmProbe.total, 'reduced motion did not re-spray the wall at once');
  assert.equal(calmProbe.signed, 1);
  assert.equal(calmProbe.jobs, 0, 'reduced motion animated the signature');
  await calm.close();

  /* ---------- the phone framing has no room for it ---------- */
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  watch(phone, 'phone');
  await phone.goto(BASE);
  await phone.waitForFunction(() => window.__hall?.readyDone, null, { timeout: 120000 });
  await phone.waitForTimeout(2500);
  const phoneState = await phone.evaluate(() => ({ game: window.__hall.wallGame.state.visible, opacity: window.__hall.wallPaint.game.wallGameOpacity.value, built: window.__hall.wallGame.built }));
  console.log('390x844:', JSON.stringify(phoneState));
  assert.equal(phoneState.game, false, 'the field must stay off the compact framing');
  assert.equal(phoneState.opacity, 0);
  assert.equal(phoneState.built, false, 'the phone paid for a game it never shows');
  await phone.close();
} finally {
  await browser.close();
}

/* ---------- a real window, and another engine: visible, playable, the tag grows ---------- */
const smoke = async (type, label, options, base = BASE) => {
  const b = await type.launch(options);
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
    watch(p, label);
    await p.goto(base);
    await ready(p);
    await p.waitForTimeout(3000);
    const box = await fieldBox(p);
    await clickField(p, box);
    await p.waitForFunction(() => window.__hall.wallGame.state.mode === 'play', null, { timeout: 4000 });
    await startFrameLog(p);
    await trackFor(p, 10000);
    const st = await state(p);
    const cov = await coverage(p);
    const fr = frameStats(await p.evaluate(() => window.__wallFrames.slice()));
    await p.screenshot({ path: `${OUT}/${label}.png` });
    console.log(`${label}: mode ${st.mode}, score ${st.score}, tag points ${st.tagPoints}, coverage ${cov.coat.toFixed(4)}, frames p50 ${fr.p50.toFixed(1)} / p95 ${fr.p95.toFixed(1)} ms`);
    assert.ok(st.tagPoints > 4 && cov.coat > 0.001, `${label}: the tag did not grow`);
  } finally { await b.close(); }
};
if (!SKIP.has('headed')) await smoke(chromium, 'headed-chromium', { headless: false, args: ['--use-angle=d3d11', '--window-position=40,40'] });
// Firefox resolves localhost to 127.0.0.1 first, Chromium to [::1]; the dev server listens on [::1] only, and on
// this machine another (older) preview has been seen answering on 127.0.0.1:4322. Pin the address.
if (!SKIP.has('firefox')) await smoke(firefox, 'firefox', { headless: true }, process.env.QA_FIREFOX_URL || BASE.replace('//localhost', '//[::1]'));

assert.deepEqual(errors, [], 'page or console errors');
console.log(`\nwall-game: PASS  (warnings: ${warnings.length})`);
if (warnings.length) console.log(warnings.join('\n'));
console.log('screenshots in ' + OUT);
