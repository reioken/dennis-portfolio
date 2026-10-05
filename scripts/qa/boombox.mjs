// The hall's CD player (src/components/hall/boombox.ts) on the dev server (needs window.__hall, DEV only).
//   node scripts/qa/boombox.mjs [origin=http://localhost:4321] [--shots <dir>]
// With album.selfHosted false, a click must open the album on Spotify (stubbed here) and load no audio. With it true,
// a synthetic beat (generated here, never the album) stands in for every track: a click plays, the trims pulse, the
// disc turns, a click on the disc goes to the next track, the body pauses and resumes. Clicks are aimed at the
// player's projected position, because the hall camera follows the pointer. Exits 1 on any failed check.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const sharp = require('sharp');
const args = process.argv.slice(2);
const ORIGIN = args.find((a) => /^https?:/.test(a)) ?? 'http://localhost:4321';
const shots = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
if (shots) fs.mkdirSync(shots, { recursive: true });

/** 12 s of a 55 Hz kick on every half second over pink-ish noise, 16-bit stereo WAV. */
function beat(seconds = 12, rate = 44100) {
  const n = seconds * rate, data = Buffer.alloc(44 + n * 4);
  data.write('RIFF', 0); data.writeUInt32LE(36 + n * 4, 4); data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22); data.writeUInt32LE(rate, 24);
  data.writeUInt32LE(rate * 4, 28); data.writeUInt16LE(4, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(n * 4, 40);
  let b0 = 0, seed = 1;
  for (let i = 0; i < n; i++) {
    const t = i / rate, k = t % 0.5;
    seed = (seed * 16807) % 2147483647; b0 = 0.97 * b0 + 0.03 * (seed / 2147483647 * 2 - 1);
    const v = (k < 0.14 ? Math.sin(2 * Math.PI * 55 * t) * Math.exp(-k * 18) : 0) * 0.9 + b0 * 0.5;
    const s = Math.max(-1, Math.min(1, v)) * 32767;
    data.writeInt16LE(s | 0, 44 + i * 4); data.writeInt16LE(s | 0, 46 + i * 4);
  }
  return data;
}

let failed = 0;
const check = (ok, label) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++; };
const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const wav = beat(), requests = [], errors = [];
await context.route('**/media/music/**', (route) => { requests.push(route.request().url().split('/').pop()); route.fulfill({ status: 200, contentType: 'audio/wav', body: wav }); });
await context.route('https://open.spotify.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>stub</title>' }));
const page = await context.newPage();
page.on('console', (m) => { if (m.type() === 'error' && !/Outdated Optimize Dep/.test(m.text())) errors.push(m.text()); });
await page.goto(`${ORIGIN}/`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => window.__hall?.boombox && document.querySelector('[data-ready-ms]'), null, { timeout: 120000 });
await page.waitForTimeout(3000);
const state = () => page.evaluate(() => { const x = window.__hall.boombox; return { state: x.state, track: x.track + 1, shown: x.drawn }; });
const where = (part) => page.evaluate((part) => {
  const h = window.__hall, x = h.boombox, v = x.group.position.clone();
  if (part === 'disc') v.set(0, 0.1331, 0.16); else v.set(-0.2, 0.13, 0.14);
  x.player.localToWorld(v); v.project(h.camera);
  return [Math.round((v.x + 1) / 2 * innerWidth), Math.round((1 - v.y) / 2 * innerHeight)];
}, part);
const click = async (part) => { const [x, y] = await where(part); await page.mouse.click(x, y); };
const shot = async (name) => { if (shots) await page.screenshot({ path: path.join(shots, `${name}.png`) }); };

const [bx, by] = await where('body');
await page.mouse.move(bx, by); await page.waitForTimeout(300);
check(await page.evaluate(([x, y]) => getComputedStyle(document.elementFromPoint(x, y)).cursor, [bx, by]) === 'pointer', 'pointer cursor over the player');
check((await state()).shown.startsWith('stopped|06|22:46'), 'standby display: track count and album length');
// the DOM twin: over the player, named, a visible focus ring, a hint that says where it goes
const twin = page.locator('.hall-boombox');
check(await twin.isVisible(), 'DOM twin shown over the player in the hall');
const tb = await twin.boundingBox();
check(tb && bx >= tb.x && bx <= tb.x + tb.width && by >= tb.y && by <= tb.y + tb.height, 'twin covers the player');
check(await page.locator('.hall-boombox__hint').evaluate((e) => getComputedStyle(e).opacity) === '1', 'hint visible while hovered');
// the accessible name leaves the aria-hidden arrow out; innerText would not
const name = await twin.evaluate((e) => [...e.querySelectorAll('strong, span')].filter((n) => !n.closest('[aria-hidden]') && !n.children.length && n.getClientRects().length).map((n) => n.textContent).join(' '));
check(/memoryrot/.test(name) && /a lifetime, briefly/.test(name) && /(Auf Spotify hören|Listen on Spotify|\d\d )/.test(name) || /memoryrot.*a lifetime, briefly$/.test(name), `twin named in the page language (${name})`);
await page.mouse.move(300, 950); await page.waitForTimeout(250);
await page.keyboard.press('Shift'); await twin.focus(); await page.waitForTimeout(200);
check(await twin.evaluate((e) => e.matches(':focus-visible') && getComputedStyle(e).outlineStyle !== 'none'), 'keyboard focus ring on the twin');
check(await page.locator('.hall-boombox__hint').evaluate((e) => getComputedStyle(e).opacity) === '1', 'hint visible on keyboard focus');
await twin.evaluate((e) => e.blur());
// off camera it leaves the tab order: no invisible stop while the hall shows another station
await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1200); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(2500);
check(await twin.evaluate((e) => e.hidden), 'twin hidden while another station is shown');
await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(1200); await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(2500);
check(await twin.isVisible(), 'twin back with the claw machine station');
await shot('standby');
const [popup] = await Promise.all([context.waitForEvent('page', { timeout: 2500 }).catch(() => null), click('body')]);
if (popup) {
  console.log('mode: Spotify (album.selfHosted false)');
  check(popup.url().startsWith('https://open.spotify.com/album/'), 'click opens the album on Spotify');
  check(await popup.evaluate(() => window.opener === null), 'no opener for the new tab');
  check(requests.length === 0 && (await state()).state === 'stopped', 'no audio loaded');
} else {
  console.log('mode: self-hosted audio (synthetic beat in place of the files)');
  await page.waitForTimeout(2000);
  let s = await state();
  check(s.state === 'playing' && s.track === 1 && /^playing\|01\|0:0\d/.test(s.shown), `click plays track 1 (${s.shown})`);
  const trims = [];
  for (let i = 0; i < 30; i++) { trims.push(await page.evaluate(() => window.__hall.boombox.body.emissiveIntensity)); await page.waitForTimeout(50); }
  check(Math.max(...trims) - Math.min(...trims) > 0.4, `trims pulse (${Math.min(...trims).toFixed(2)}-${Math.max(...trims).toFixed(2)})`);
  const [dx, dy] = await where('disc'), box = { left: dx - 30, top: dy - 30, width: 60, height: 60 };
  const a = await sharp(await page.screenshot()).extract(box).raw().toBuffer(); await page.waitForTimeout(90);
  const c = await sharp(await page.screenshot()).extract(box).raw().toBuffer();
  let d = 0; for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - c[i]);
  check(d / a.length > 0.8, `disc turns (window change ${(d / a.length).toFixed(2)})`);
  await shot('playing');
  await click('disc'); await page.waitForTimeout(1200); s = await state();
  check(s.state === 'playing' && s.track === 2 && requests.includes('02-let-this-last.m4a'), 'disc click: next track');
  await click('body'); await page.waitForTimeout(800); s = await state();
  check(s.state === 'paused', 'body click pauses');
  await click('body'); await page.waitForTimeout(800); s = await state();
  check(s.state === 'playing' && s.track === 2, 'body click resumes');
}
check(errors.length === 0, `no console errors${errors.length ? `: ${errors.slice(0, 2).join(' | ')}` : ''}`);
await browser.close();
process.exit(failed ? 1 : 0);
