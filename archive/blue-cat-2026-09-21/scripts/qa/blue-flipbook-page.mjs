/**
 * Builds one self-contained compare.html from two blue-flipbook label folders.
 *
 *   node scripts/qa/blue-flipbook-page.mjs <beforeDir> <afterDir> [outFile]
 *
 * Both folders are the `<QA_OUT>/<label>` directories blue-flipbook.mjs wrote. Every scenario is shown as a
 * pair of synchronized flipbooks running at real speed (30 fps), before on the left, after on the right.
 * Frames are inlined as base64 sprite atlases; the builder steps down cell size and JPEG quality until the
 * page fits the size budget, and prints what it settled on.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const [beforeDir, afterDir, outArg] = process.argv.slice(2);
if (!beforeDir || !afterDir) throw new Error('usage: blue-flipbook-page.mjs <beforeDir> <afterDir> [outFile]');
const outFile = path.resolve(outArg || path.join(path.dirname(path.resolve(beforeDir)), 'compare.html'));
const BUDGET = Number(process.env.QA_BUDGET_MB || 48) * 1024 * 1024;
/** A single atlas must stay decodable in the browser, so its pixel count is capped and long runs get smaller cells. */
const MAX_ATLAS_PX = 28e6;
/** Cell width / JPEG quality steps, tried in order until the inlined page fits the budget. */
const STEPS = [{ cell: 420, q: 74 }, { cell: 360, q: 68 }, { cell: 320, q: 62 }, { cell: 280, q: 56 }, { cell: 240, q: 50 }];

const read = async dir => JSON.parse(await fs.readFile(path.join(dir, 'summary.json'), 'utf8'));
const before = await read(beforeDir), after = await read(afterDir);
// Every scenario the `after` run captured. Scenarios or views the `before` run never had (new ones, and the
// close-ups where the hall view is pointless) still appear, with that side marked as not captured.
// The About routine first: it is the one the visitor actually sees end to end.
const FIRST = ['aboutjump'];
const scenarios = Object.keys(after.scenarios).sort((a, b) => (FIRST.includes(b) ? 1 : 0) - (FIRST.includes(a) ? 1 : 0));
if (!scenarios.length) throw new Error('the after folder has no scenario');
const exists = async dir => !!(await fs.stat(dir).catch(() => null));
const viewsOf = {};
for (const name of scenarios) {
  const found = [];
  for (const view of ['hall', 'near', 'roof']) if (await exists(path.join(afterDir, `${name}-${view}`))) found.push(view);
  viewsOf[name] = found;
}

const framesOf = async dir => (await fs.readdir(dir)).filter(f => /^\d{4}\.jpg$/.test(f)).sort();

/** One JPEG holding every frame of a run in a roughly square grid, plus the geometry the page needs to draw it. */
async function atlas(dir, cell, quality) {
  const names = await framesOf(dir);
  const first = await sharp(path.join(dir, names[0])).metadata();
  const aspect = first.height / first.width;
  let cw = cell;
  if (names.length * cw * cw * aspect > MAX_ATLAS_PX) cw = Math.floor(Math.sqrt(MAX_ATLAS_PX / (names.length * aspect)));
  const ch = Math.max(1, Math.round(cw * aspect));
  const cols = Math.max(4, Math.round(Math.sqrt(names.length * ch / cw)));
  const rows = Math.ceil(names.length / cols);
  const tiles = await Promise.all(names.map(async (name, i) => ({
    input: await sharp(path.join(dir, name)).resize(cw, ch).toColourspace('srgb').png().toBuffer(),
    left: (i % cols) * cw, top: Math.floor(i / cols) * ch,
  })));
  const buf = await sharp({ create: { width: cols * cw, height: rows * ch, channels: 3, background: '#000' } })
    .composite(tiles).jpeg({ quality, mozjpeg: true }).toBuffer();
  return { cw, ch, cols, count: names.length, data: buf.toString('base64') };
}

let picked = null, packs = null;
for (const step of STEPS) {
  const built = {};
  let bytes = 0;
  for (const name of scenarios) for (const view of viewsOf[name]) for (const [label, dir] of [['before', beforeDir], ['after', afterDir]]) {
    const folder = path.join(dir, `${name}-${view}`);
    if (!(await exists(folder))) continue;
    const a = await atlas(folder, step.cell, step.q);
    built[`${name}|${view}|${label}`] = a;
    bytes += a.data.length;
  }
  process.stdout.write(`cell ${step.cell} q${step.q}: ${(bytes / 1024 / 1024).toFixed(1)} MB inlined\n`);
  picked = { ...step, bytes };
  packs = built;
  if (bytes <= BUDGET) break;
}

const meta = {
  fps: after.fps ?? 30,
  scenarios: scenarios.map(name => ({
    name,
    seconds: after.scenarios[name].seconds,
    frames: after.scenarios[name].frames,
    views: viewsOf[name],
    triggerFrame: name.startsWith('perch') ? 0 : Math.round(0.5 * (after.fps ?? 30)),
  })),
  before: { label: before.label, base: before.base, capturedAt: before.capturedAt },
  after: { label: after.label, base: after.base, capturedAt: after.capturedAt },
};

const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Blue motion — before / after</title>
<style>
  :root { color-scheme: dark; --bg:#0d0e10; --panel:#15171a; --line:#2a2e33; --fg:#e8e8ea; --dim:#8d939b; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font:14px/1.45 ui-sans-serif,system-ui,'Segoe UI',sans-serif; }
  header { padding:14px 18px; border-bottom:1px solid var(--line); display:flex; flex-wrap:wrap; gap:14px; align-items:center; }
  h1 { font-size:15px; font-weight:600; margin:0 12px 0 0; letter-spacing:.02em; }
  .group { display:flex; gap:6px; flex-wrap:wrap; align-items:center; }
  button { background:var(--panel); color:var(--fg); border:1px solid var(--line); border-radius:5px; padding:5px 11px; font:inherit; cursor:pointer; }
  button:hover { border-color:#4a515a; }
  button[aria-pressed="true"] { background:#31363d; border-color:#5b636d; }
  .stage { display:grid; grid-template-columns:1fr 1fr; gap:14px; padding:16px 18px; align-items:start; }
  figure { margin:0; }
  figcaption { color:var(--dim); font-size:12px; padding:7px 2px 0; display:flex; justify-content:space-between; gap:8px; }
  canvas { width:100%; height:auto; display:block; background:#000; border:1px solid var(--line); border-radius:6px; }
  .bar { display:flex; gap:12px; align-items:center; padding:0 18px 18px; }
  input[type=range] { flex:1; accent-color:#8d939b; }
  .t { font-variant-numeric:tabular-nums; color:var(--dim); min-width:140px; }
  .note { padding:0 18px 22px; color:var(--dim); font-size:12px; max-width:110ch; }
  @media (max-width:900px){ .stage{grid-template-columns:1fr;} }
</style></head>
<body>
<header>
  <h1>Blue motion — before / after</h1>
  <div class="group" id="scenarios"></div>
  <div class="group" id="views"></div>
  <div class="group" id="speeds"></div>
  <div class="group"><button id="play" aria-pressed="true">Pause</button></div>
</header>
<div class="stage">
  <figure><canvas id="cL"></canvas><figcaption><span>Before — production</span><span id="capL"></span></figcaption></figure>
  <figure><canvas id="cR"></canvas><figcaption><span>After — local</span><span id="capR"></span></figcaption></figure>
</div>
<div class="bar"><span class="t" id="clock"></span><input type="range" id="scrub" min="0" max="0" value="0" step="1"></div>
<p class="note" id="note"></p>
<script id="packs" type="application/json">${JSON.stringify(packs)}</script>
<script id="meta" type="application/json">${JSON.stringify(meta)}</script>
<script>
const PACKS = JSON.parse(document.getElementById('packs').textContent);
const META = JSON.parse(document.getElementById('meta').textContent);
const FPS = META.fps;
const state = { scenario: META.scenarios[0].name, view: (META.scenarios[0].views || ['near'])[0], speed: 1, playing: true, frame: 0 };
const sheets = {};                        // decoded atlases for the current scenario + view only

const mk = (host, items, get, set) => {
  host.innerHTML = '';
  for (const it of items) {
    const b = document.createElement('button');
    b.textContent = it.text; b.dataset.value = it.value;
    b.onclick = () => { set(it.value); paint(); };
    host.append(b);
  }
  host.render = () => [...host.children].forEach(b => b.setAttribute('aria-pressed', String(b.dataset.value === String(get()))));
  host.render();
};
const scenariosBar = document.getElementById('scenarios');
const viewsBar = document.getElementById('views');
const speedsBar = document.getElementById('speeds');
mk(scenariosBar, META.scenarios.map(s => ({ text: s.name, value: s.name })), () => state.scenario, v => {
  state.scenario = v; state.frame = 0;
  if (!viewsFor(v).includes(state.view)) state.view = viewsFor(v)[0];
  buildViews(); load();
});
function viewsFor(name) { return (META.scenarios.find(s => s.name === name) || {}).views || ['near']; }
function buildViews() {
  mk(viewsBar, viewsFor(state.scenario).map(v => ({ text: v, value: v })), () => state.view, v => { state.view = v; load(); });
}
buildViews();
mk(speedsBar, [{ text: '0.25x', value: '0.25' }, { text: '0.5x', value: '0.5' }, { text: '1x', value: '1' }], () => state.speed, v => { state.speed = Number(v); });

const cL = document.getElementById('cL'), cR = document.getElementById('cR');
const xL = cL.getContext('2d'), xR = cR.getContext('2d');
const scrub = document.getElementById('scrub'), clock = document.getElementById('clock');
const play = document.getElementById('play');
play.onclick = () => { state.playing = !state.playing; play.textContent = state.playing ? 'Pause' : 'Play'; play.setAttribute('aria-pressed', String(state.playing)); };
scrub.oninput = () => { state.frame = Number(scrub.value); state.playing = false; play.textContent = 'Play'; play.setAttribute('aria-pressed', 'false'); draw(); };

function key(label) { return state.scenario + '|' + state.view + '|' + label; }
function load() {
  for (const k of Object.keys(sheets)) delete sheets[k];
  for (const label of ['before', 'after']) {
    const pack = PACKS[key(label)];
    const canvas = label === 'before' ? cL : cR;
    if (!pack) {
      // This side never captured this scenario or view (new scenarios, and close-ups with no useful hall view).
      sheets[label] = null;
      canvas.width = 640; canvas.height = 360;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#15171a'; ctx.fillRect(0, 0, 640, 360);
      ctx.fillStyle = '#8d939b'; ctx.font = '18px monospace'; ctx.textAlign = 'center';
      ctx.fillText('not captured in this build', 320, 184);
      continue;
    }
    const img = new Image();
    img.onload = () => { if (sheets[label]) sheets[label].ready = true; draw(); };
    img.src = 'data:image/jpeg;base64,' + pack.data;
    sheets[label] = { img, pack, ready: false };
    canvas.width = pack.cw; canvas.height = pack.ch;
  }
  const counts = ['before', 'after'].map(l => sheets[l]?.pack.count).filter(Boolean);
  const n = Math.min(...counts);
  scrub.max = String(n - 1);
  if (state.frame >= n) state.frame = 0;
  paint(); draw();
}
function blit(ctx, side, i) {
  const s = sheets[side];
  if (!s?.ready) return;
  const { cw, ch, cols } = s.pack;
  const k = Math.min(i, s.pack.count - 1);
  ctx.drawImage(s.img, (k % cols) * cw, Math.floor(k / cols) * ch, cw, ch, 0, 0, cw, ch);
}
function draw() {
  blit(xL, 'before', state.frame);
  blit(xR, 'after', state.frame);
  scrub.value = String(state.frame);
  const n = Number(scrub.max) + 1;
  clock.textContent = (state.frame / FPS).toFixed(2) + ' s  ·  frame ' + (state.frame + 1) + '/' + n + '  ·  ' + state.speed + 'x';
}
function paint() {
  scenariosBar.render(); viewsBar.render(); speedsBar.render();
  buildViews();
  const s = META.scenarios.find(x => x.name === state.scenario);
  document.getElementById('capL').textContent = META.before.base;
  document.getElementById('capR').textContent = META.after.base;
  document.getElementById('note').textContent =
    state.scenario + ' · ' + state.view + ' view · ' + s.seconds + ' s captured at ' + FPS + ' fps · action starts at frame ' + (s.triggerFrame + 1) +
    ' · before ' + META.before.capturedAt + ' · after ' + META.after.capturedAt;
}
let last = 0, acc = 0;
requestAnimationFrame(function tick(now) {
  if (!last) last = now;
  const dt = (now - last) / 1000; last = now;
  if (state.playing) {
    acc += dt * state.speed;
    const stepTime = 1 / FPS;
    while (acc >= stepTime) { acc -= stepTime; state.frame = (state.frame + 1) % (Number(scrub.max) + 1); }
    draw();
  }
  requestAnimationFrame(tick);
});
load();
</script>
</body></html>`;

await fs.writeFile(outFile, html);
const size = (await fs.stat(outFile)).size;
console.log(JSON.stringify({ outFile, megabytes: +(size / 1024 / 1024).toFixed(1), cell: picked.cell, quality: picked.q, scenarios }));
