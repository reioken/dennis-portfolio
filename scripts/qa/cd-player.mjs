// The hall's CD player (src/components/hall/cdPlayer.ts): opening from the
// hall by pointer and keyboard, the close-up's keys, the track list, playback state, the disc turning, volume, Esc,
// focus, the Spotify fallback when a file does not load, and reduced motion. The album's files are replaced by a
// synthetic tone and the cover by a test card, so it runs with or without the real files in public/. On a build
// (no window.__hall) the checks that read the scene itself (the disc's angle, the volume) are skipped.
//   node scripts/qa/cd-player.mjs [origin] [outdir] [--real]   (--real: the album's own files, no stand-ins)
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const sharp = require('sharp');

const ORIGIN = process.argv[2] ?? 'http://localhost:4321';
const OUT = process.argv[3]?.startsWith('--') ? undefined : process.argv[3];
const REAL = process.argv.includes('--real');
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let failures = 0;
const check = (name, ok, detail = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };

function tone(seconds = 8, rate = 22050) {
  const n = seconds * rate, data = Buffer.alloc(44 + n * 2);
  data.write('RIFF', 0); data.writeUInt32LE(36 + n * 2, 4); data.write('WAVE', 8); data.write('fmt ', 12);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22); data.writeUInt32LE(rate, 24);
  data.writeUInt32LE(rate * 2, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const t = i / rate, kick = Math.exp(-((t * 4) % 1) * 9);
    const v = 0.35 * Math.sin(2 * Math.PI * 220 * t) + 0.5 * kick * Math.sin(2 * Math.PI * 60 * t);
    data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 32767))), 44 + i * 2);
  }
  return data;
}
const card = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e05a8a"/><stop offset="1" stop-color="#3a3f9a"/></linearGradient></defs><rect width="512" height="512" fill="url(#g)"/><path d="M256 70 L346 200 H290 V420 H222 V200 H166 Z" fill="#fff"/></svg>`)).png().toBuffer();
const wav = tone();

const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });

async function session({ reduce = false, missing = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, reducedMotion: reduce ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const errors = [], popups = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 240)));
  // Spotify is never reached: a request for it is recorded and refused.
  await ctx.route('https://open.spotify.com/**', (route) => { popups.push(route.request().url()); return route.abort(); });
  ctx.on('page', (p) => { p.close().catch(() => {}); });
  if (missing || !REAL) await page.route('**/media/music/a-lifetime-briefly/*.m4a', (route) => missing ? route.fulfill({ status: 404, body: '' }) : route.fulfill({ status: 200, contentType: 'audio/wav', body: wav }));
  if (!REAL) await page.route('**/media/music/a-lifetime-briefly/cover.webp', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: card }));
  await page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('[data-ready-ms]') && document.querySelector('.hall-cd'), null, { timeout: 60000 });
  await page.waitForTimeout(reduce ? 800 : 3500);
  return { ctx, page, errors, popups };
}
const state = (page) => page.evaluate(() => {
  const h = window.__hall, cd = h?.cd, menu = document.querySelector('.hall-cd-menu');
  const current = menu?.querySelector('[data-track][aria-current]');
  return {
    pose: h ? h.pose : document.querySelector('.hall')?.dataset.player === 'open' ? 'player' : 'hall', player: document.querySelector('.hall')?.dataset.player ?? null, menu: menu && !menu.hidden, menuState: menu?.dataset.state, failed: menu?.hasAttribute('data-failed'),
    track: current ? Number(current.getAttribute('data-track')) : -1, angle: cd ? cd.angle : null, spin: cd ? cd.spin : null, station: document.querySelector('.hall')?.dataset.focus,
    keys: [...document.querySelectorAll('.hall-cd-key')].filter((k) => !k.hidden).length, playPressed: document.querySelector('.hall-cd-key[data-act="play"]')?.getAttribute('aria-pressed'),
    twin: !document.querySelector('.hall-cd')?.hidden, focus: document.activeElement?.className?.toString().slice(0, 40), focusAct: document.activeElement?.dataset?.act ?? null,
    media: navigator.mediaSession?.metadata?.title ?? null, dock: getComputedStyle(document.querySelector('.hall-dock')).visibility,
  };
});
const key = (page, act) => page.locator(`.hall-cd-key[data-act="${act}"]`).click();

{
  const { ctx, page, errors, popups } = await session();
  let s = await state(page);
  check('twin over the player in the hall', s.twin && s.pose === 'hall');
  const box = await page.locator('.hall-cd').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(300);
  const hint = await page.evaluate(() => getComputedStyle(document.querySelector('.hall-cd__hint')).opacity);
  check('hint on hover', Number(hint) > 0.9, `opacity ${hint}`);
  if (OUT) await page.screenshot({ path: `${OUT}/1-hall-hover.jpg`, type: 'jpeg', quality: 85 });
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(1200);
  s = await state(page);
  check('click opens the close-up', s.pose === 'player' && s.player === 'open' && s.menu, JSON.stringify({ pose: s.pose, player: s.player, menu: s.menu }));
  check('six key twins on screen', s.keys === 6, String(s.keys));
  check('console steps aside', s.dock === 'hidden', s.dock);
  check('stopped: first track current', s.menuState === 'stopped' && s.track === 0);
  await key(page, 'play');
  await page.waitForTimeout(1600);
  s = await state(page);
  check('play key plays', s.menuState === 'playing' && s.playPressed === 'true', JSON.stringify({ st: s.menuState, pressed: s.playPressed }));
  if (s.spin === null) console.log('SKIP disc turns while playing (build: no window.__hall)');
  else check('disc turns while playing', s.spin > 0.2 && s.angle > 0.3, `spin ${s.spin.toFixed(2)} angle ${s.angle.toFixed(2)}`);
  check('media session names the track', s.media === 'before i knew', String(s.media));
  const progress = await page.evaluate(() => Number(getComputedStyle(document.querySelector('.hall-cd-menu [aria-current] .hall-cd-menu__bar')).getPropertyValue('--progress')) || 0);
  check('the track runs (progress line moves)', progress > 0, String(progress));
  const cover = await page.evaluate(() => document.querySelector('.hall-cd-menu__cover')?.naturalWidth ?? 0);
  check('the cover loads', cover === (REAL ? 1024 : 512), String(cover));
  if (OUT) await page.screenshot({ path: `${OUT}/2-open-playing.jpg`, type: 'jpeg', quality: 88 });
  await key(page, 'next');
  await page.waitForTimeout(500);
  s = await state(page);
  check('next key: track 2, still playing', s.track === 1 && s.menuState === 'playing', JSON.stringify({ track: s.track, st: s.menuState }));
  await key(page, 'prev');
  await page.waitForTimeout(400);
  s = await state(page);
  check('prev key within 3 s: back to track 1', s.track === 0, String(s.track));
  await page.locator('.hall-cd-menu [data-track="3"]').click();
  await page.waitForTimeout(600);
  s = await state(page);
  check('track list: picks track 4 and plays it', s.track === 3 && s.menuState === 'playing', JSON.stringify({ track: s.track, st: s.menuState }));
  await page.locator('.hall-cd-menu [data-track="3"]').click();
  await page.waitForTimeout(300);
  check('the current row again pauses', (await state(page)).menuState === 'paused');
  await key(page, 'play');
  await page.waitForTimeout(300);
  // A source change cancels earlier play promises. Their rejection must not reset the final track's UI.
  const delayTrack = async (route) => { await page.waitForTimeout(500); await route.fallback(); };
  await page.route('**/media/music/a-lifetime-briefly/*.m4a', delayTrack);
  await page.evaluate(() => { for (let i = 0; i < 3; i++) document.querySelector('.hall-cd-key[data-act="next"]').click(); });
  await page.waitForTimeout(1600);
  s = await state(page);
  check('rapid next presses retain the final track and playing display', s.track === 0 && s.menuState === 'playing' && s.playPressed === 'true', JSON.stringify({ track: s.track, st: s.menuState }));
  await page.unroute('**/media/music/a-lifetime-briefly/*.m4a', delayTrack);
  const vol0 = await page.evaluate(() => window.__hall?.cd.lastVolume ?? null);
  await key(page, 'louder');
  await key(page, 'louder');
  await key(page, 'louder');
  await key(page, 'quieter');
  await page.waitForTimeout(200);
  const vol1 = await page.evaluate(() => window.__hall?.cd.lastVolume ?? null);
  if (vol0 === null) console.log('SKIP volume steps (build: no window.__hall)');
  else check('volume keys step and stop at the top', vol1 === Math.min(10, vol0 + 2) || vol1 === 9, `${vol0} -> ${vol1}`);
  await key(page, 'stop');
  await page.waitForTimeout(300);
  check('stop key stops', (await state(page)).menuState === 'stopped');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1100);
  s = await state(page);
  check('Esc goes back to the hall', s.pose === 'hall' && s.player === null && !s.menu, JSON.stringify({ pose: s.pose, player: s.player }));
  check('console is back', s.dock === 'visible', s.dock);
  // keyboard: Enter on the twin opens and puts focus on the play key; Space plays; Esc returns focus to the twin
  await page.evaluate(() => document.querySelector('.hall-cd').focus());
  await page.keyboard.press('Enter');
  await page.waitForTimeout(900);
  s = await state(page);
  check('Enter opens with focus on the play key', s.pose === 'player' && s.focusAct === 'play', JSON.stringify({ pose: s.pose, focus: s.focus, act: s.focusAct }));
  await page.keyboard.press('Space');
  await page.waitForTimeout(500);
  check('Space on the play key plays', (await state(page)).menuState === 'playing');
  const station = (await state(page)).station;
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(400);
  s = await state(page);
  check('arrows do not walk the hall while open', s.station === station && s.pose === 'player', `${station} -> ${s.station}`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(900);
  s = await state(page);
  check('Esc returns focus to the player button', s.pose === 'hall' && /hall-cd/.test(s.focus ?? ''), s.focus);
  check('music keeps playing in the hall', s.menuState === 'playing');
  // a click into the room beside the lid closes it
  await page.locator('.hall-cd').click();
  await page.waitForTimeout(1100);
  await page.mouse.click(1500, 1000);
  await page.waitForTimeout(900);
  check('a click beside the lid goes back', (await state(page)).pose === 'hall');
  check('no popups', popups.length === 0, popups.join(' '));
  check('no console errors', errors.length === 0, errors.slice(0, 4).join(' | '));
  await ctx.close();
}
{
  const { ctx, page, errors, popups } = await session({ missing: true });
  await page.locator('.hall-cd').click();
  await page.waitForTimeout(1100);
  await key(page, 'play');
  await page.waitForTimeout(1200);
  const s = await state(page);
  check('missing file: player hands over to Spotify', s.failed === true && s.menuState === 'stopped', JSON.stringify({ failed: s.failed, st: s.menuState }));
  await key(page, 'play');
  await page.waitForTimeout(800);
  check('then play opens the album on Spotify', popups.some((u) => /open\.spotify\.com\/album/.test(u)), popups.join(' '));
  check('only the expected 404', errors.every((e) => /404|Failed to load resource/.test(e)), errors.slice(0, 3).join(' | '));
  await ctx.close();
}
{
  const { ctx, page } = await session({ reduce: true });
  await page.locator('.hall-cd').click();
  await page.waitForTimeout(400);
  await key(page, 'play');
  await page.waitForTimeout(1200);
  const s = await state(page);
  check('reduced motion: close-up without travel', s.pose === 'player');
  if (s.angle === null) console.log('SKIP reduced motion: the disc stands still (build: no window.__hall)');
  else check('reduced motion: the disc stands still', s.angle === 0 && s.menuState === 'playing', `angle ${s.angle}`);
  await ctx.close();
}
await browser.close();
console.log(failures ? `${failures} FAILED` : 'ALL PASS');
process.exit(failures ? 1 : 0);
