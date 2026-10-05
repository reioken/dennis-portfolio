// Live performance probe for dennisbf.design (read-only; nothing is submitted).
// Desktop: cold load -> hall idle -> pointer parallax -> station navigation -> open case -> case idle -> back.
// Phone:   cold load -> scroll the exhibition -> tap the first cabinet -> idle -> close.
//
// usage: node scripts/qa/live/perf.mjs --label=name [--origin=https://www.dennisbf.design] [--gpu=rtx|igpu --luid=<high,low>]
//          [--vp=1920x1080] [--dpr=1] [--cpu=1] [--net=none|fast4g|slow4g] [--phone]
//          [--block=marquee] [--css=nobackdrop] [--shader=noarea|nopoint|lights] [--gpuTimer] [--warm] [--out=<dir outside the project>]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const arg = (k, d) => { const a = process.argv.find(s => s.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const flag = k => process.argv.includes(`--${k}`);
const ORIGIN = arg('origin', 'https://www.dennisbf.design');
const LABEL = arg('label', 'run');
const GPU = arg('gpu', 'rtx');
const PHONE = flag('phone');
const [VW, VH] = arg('vp', PHONE ? '390x844' : '1920x1080').split('x').map(Number);
const DPR = Number(arg('dpr', PHONE ? '3' : '1'));
const CPU = Number(arg('cpu', '1'));
const NET = arg('net', 'none');
const BLOCK = arg('block', '');
const CSS = arg('css', '');
const GPU_TIMER = flag('gpuTimer');
const WARM = flag('warm');
const OUT = arg('out', path.join(os.tmpdir(), 'portfolio-live-perf'));
fs.mkdirSync(OUT, { recursive: true });

// --gpu=igpu needs the integrated adapter's LUID from chrome://gpu (it changes on reboot), e.g. --luid=0,104648
const LUID = { igpu: arg('luid', '') };
if (GPU === 'igpu' && !LUID.igpu) { console.error('--gpu=igpu needs --luid=<high,low> from chrome://gpu'); process.exit(2); }
const args = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'];
if (LUID[GPU]) args.push(`--use-adapter-luid=${LUID[GPU]}`);
const browser = await chromium.launch({ channel: 'chromium', headless: true, args });
const ctx = await browser.newContext({
  viewport: { width: VW, height: VH }, deviceScaleFactor: DPR,
  isMobile: PHONE, hasTouch: PHONE, reducedMotion: 'no-preference',
  userAgent: PHONE ? 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36' : undefined,
});

// ---------- in-page instrumentation ----------
await ctx.addInitScript(({ gpuTimer }) => {
  const P = window.__perf = { contexts: [], frames: [], longtasks: [], loaf: [], console: [], marks: {} };
  // frame clock: our own rAF loop records every frame the page produces
  let last = 0;
  // per context: the vsyncs in which it drew (its visible animation rate, independent of the panel's Hz)
  const loop = t => {
    if (last) P.frames.push([t, t - last]);
    last = t;
    for (const c of P.contexts) { if (c.draws !== c.seenDraws) { c.seenDraws = c.draws; (c.renders = c.renders || []).push(t); } }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  try {
    new PerformanceObserver(l => { for (const e of l.getEntries()) P.longtasks.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true });
  } catch {}
  try {
    new PerformanceObserver(l => {
      for (const e of l.getEntries()) {
        const scripts = (e.scripts || []).map(s => ({ src: (s.sourceURL || '').split('/').pop() + ':' + (s.sourceFunctionName || '') + ':' + (s.invoker || ''), d: Math.round(s.duration), forced: Math.round(s.forcedStyleAndLayoutDuration || 0) })).sort((a, b) => b.d - a.d).slice(0, 3);
        P.loaf.push({ t: Math.round(e.startTime), d: Math.round(e.duration), block: Math.round(e.blockingDuration || 0), render: Math.round(e.renderStart ? e.startTime + e.duration - e.renderStart : 0), style: Math.round(e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0), scripts });
      }
    }).observe({ type: 'long-animation-frame', buffered: true });
  } catch {}
  // WebGL contexts: count draws, remember canvas sizes, optionally time GPU passes by viewport size
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, attrs) {
    const gl = orig.call(this, type, attrs);
    if (!gl || !/webgl/.test(type) || gl.__wrapped) return gl;
    gl.__wrapped = true;
    const rec = { id: P.contexts.length, type, cls: this.className || '(none)', attrs: attrs || {}, draws: 0, tris: 0, timer: null, passes: {} };
    P.contexts.push(rec);
    rec.canvas = this;
    for (const fn of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const f = gl[fn];
      if (!f) continue;
      gl[fn] = function (...a) { rec.draws++; return f.apply(this, a); };
    }
    if (gpuTimer && type === 'webgl2') {
      const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      if (ext) {
        rec.timer = { pending: [], active: null, label: 'canvas', totals: {} };
        const T = rec.timer;
        const begin = label => { const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); T.active = { q, label }; };
        const end = () => { if (!T.active) return; gl.endQuery(ext.TIME_ELAPSED_EXT); T.pending.push(T.active); T.active = null; };
        const vp = gl.viewport;
        gl.viewport = function (x, y, w, h) { const lbl = `${w}x${h}`; if (T.on && T.active && T.active.label !== lbl) { end(); begin(lbl); } return vp.call(this, x, y, w, h); };
        T.start = () => { T.on = true; if (!T.active) begin('frame'); };
        T.stop = () => { end(); T.on = false; };
        T.poll = () => {
          if (gl.getParameter(ext.GPU_DISJOINT_EXT)) { T.pending.forEach(p => gl.deleteQuery(p.q)); T.pending = []; T.disjoint = (T.disjoint || 0) + 1; return; }
          while (T.pending.length && gl.getQueryParameter(T.pending[0].q, gl.QUERY_RESULT_AVAILABLE)) {
            const p = T.pending.shift();
            const ns = gl.getQueryParameter(p.q, gl.QUERY_RESULT);
            gl.deleteQuery(p.q);
            T.totals[p.label] = (T.totals[p.label] || 0) + ns / 1e6;
          }
        };
        // bracket every rAF callback so the queries cover the frame's real work on this context
        if (!window.__rafWrapped) {
          window.__rafWrapped = true;
          const raf = window.requestAnimationFrame.bind(window);
          window.requestAnimationFrame = cb => raf(t => {
            for (const c of P.contexts) if (c.timer && c.timer.armed) c.timer.start();
            try { cb(t); } finally { for (const c of P.contexts) if (c.timer && c.timer.armed) { c.timer.stop(); c.timer.poll(); } }
          });
        }
      }
    }
    return gl;
  };
  const ci = console.info.bind(console);
  console.info = (...a) => { P.console.push([Math.round(performance.now()), a.join(' ')]); ci(...a); };
}, { gpuTimer: GPU_TIMER });

// A/B experiments on the shipped shaders: drop a light class from every three.js program (local test browser only)
const SHADER = arg('shader', '');
if (SHADER) await ctx.addInitScript(mode => {
  const src = WebGL2RenderingContext.prototype.shaderSource;
  WebGL2RenderingContext.prototype.shaderSource = function (sh, s) {
    if (/area|lights/.test(mode)) s = s.replace(/#define NUM_RECT_AREA_LIGHTS \d+/, '#define NUM_RECT_AREA_LIGHTS 0');
    if (/point|lights/.test(mode)) s = s.replace(/#define NUM_POINT_LIGHTS \d+/, '#define NUM_POINT_LIGHTS 0');
    return src.call(this, sh, s);
  };
}, SHADER);

if (CSS === 'nobackdrop') await ctx.addInitScript(() => {
  const s = document.createElement('style');
  s.textContent = '*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}';
  document.addEventListener('DOMContentLoaded', () => document.head.appendChild(s));
});

const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send('Network.enable');
if (!WARM) await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
const NETS = { fast4g: { latency: 85, downloadThroughput: 9e6 / 8, uploadThroughput: 1.5e6 / 8 }, slow4g: { latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 0.75e6 / 8 } };
if (NETS[NET]) await cdp.send('Network.emulateNetworkConditions', { offline: false, ...NETS[NET] });
if (BLOCK === 'marquee') await page.route(/navigation-marquee/, r => r.abort());

const reqs = new Map();
let bytes = 0, nReq = 0;
cdp.on('Network.requestWillBeSent', e => reqs.set(e.requestId, { url: e.request.url, t: e.timestamp }));
cdp.on('Network.loadingFinished', e => { const r = reqs.get(e.requestId); if (r) { r.bytes = e.encodedDataLength; r.end = e.timestamp; bytes += e.encodedDataLength; nReq++; } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 160)));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 160)); });

const sleep = ms => page.waitForTimeout(ms);
const t0 = Date.now();
await page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded', timeout: 90000 });

const result = { label: LABEL, origin: ORIGIN, gpu: GPU, vp: `${VW}x${VH}@${DPR}`, cpu: CPU, net: NET, block: BLOCK, css: CSS, shader: SHADER, phone: PHONE, phases: {} };

if (!PHONE) {
  const ok = await page.waitForFunction(() => document.querySelector('[data-ready-ms]') || document.querySelector('.hall[data-startup-fallback]'), null, { timeout: 120000, polling: 250 }).then(() => true).catch(() => false);
  result.readyWallMs = Date.now() - t0;
  result.ready = ok;
  // let the room ignition finish (data-power removed) before sampling
  await page.waitForFunction(() => !document.querySelector('.hall__stage[data-power]'), null, { timeout: 30000, polling: 250 }).catch(() => {});
  await sleep(2500);
} else {
  await page.waitForLoadState('load', { timeout: 120000 }).catch(() => {});
  result.loadWallMs = Date.now() - t0;
  await sleep(4000);
}

const snap = () => page.evaluate(() => ({ n: window.__perf.frames.length, lt: window.__perf.longtasks.length, loaf: window.__perf.loaf.length, draws: window.__perf.contexts.map(c => c.draws), now: performance.now() }));
const armTimers = on => page.evaluate(on => { for (const c of window.__perf.contexts) if (c.timer) { c.timer.armed = on; if (!on) c.timer.totals = c.timer.totals; } }, on);
const resetTimers = () => page.evaluate(() => { for (const c of window.__perf.contexts) if (c.timer) { c.timer.totals = {}; c.timer.disjoint = 0; } });
async function phase(name, fn) {
  if (GPU_TIMER) { await resetTimers(); await armTimers(true); }
  const a = await snap();
  await fn();
  const b = await snap();
  if (GPU_TIMER) await armTimers(false);
  const stats = await page.evaluate(({ a, b }) => {
    const P = window.__perf;
    const d = P.frames.slice(a.n, b.n).map(f => f[1]).sort((x, y) => x - y);
    const q = p => d.length ? +d[Math.min(d.length - 1, Math.floor(d.length * p))].toFixed(1) : null;
    const lts = P.longtasks.slice(a.lt, b.lt);
    const loafs = P.loaf.slice(a.loaf, b.loaf).sort((x, y) => y.d - x.d).slice(0, 4);
    const secs = (b.now - a.now) / 1000;
    const ctx = P.contexts.map((c, i) => {
      const cv = c.canvas; const live = cv && cv.isConnected && getComputedStyle(cv).display !== 'none';
      const timer = c.timer ? Object.fromEntries(Object.entries(c.timer.totals).map(([k, v]) => [k, +(v / Math.max(1, d.length)).toFixed(2)])) : undefined;
      const gpuMsPerFrame = c.timer ? +(Object.values(c.timer.totals).reduce((s, v) => s + v, 0) / Math.max(1, d.length)).toFixed(2) : undefined;
      const rs = (c.renders || []).filter(x => x >= a.now && x <= b.now);
      const gaps = rs.slice(1).map((x, k) => x - rs[k]).sort((x, y) => x - y);
      const gq = p => gaps.length ? +gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * p))].toFixed(0) : null;
      return { id: c.id, cls: c.cls, live, buffer: cv ? `${cv.width}x${cv.height}` : '?', drawsPerSec: Math.round((b.draws[i] - (a.draws[i] || 0)) / secs),
        renderFps: +(rs.length / secs).toFixed(1), gapP50: gq(.5), gapP95: gq(.95), gapMax: gaps.length ? Math.round(gaps[gaps.length - 1]) : null, gaps50: gaps.filter(x => x > 50).length,
        gpuMsPerFrame, gpuPasses: timer, disjoint: c.timer?.disjoint };
    }).filter(c => c.drawsPerSec > 0 || c.live);
    return {
      secs: +secs.toFixed(1), fps: +(d.length / secs).toFixed(1), frames: d.length,
      p50: q(.5), p95: q(.95), p99: q(.99), max: d.length ? +d[d.length - 1].toFixed(0) : null,
      over33: d.filter(x => x > 33.4).length, over50: d.filter(x => x > 50).length,
      longTasks: lts.length, longTaskMs: Math.round(lts.reduce((s, x) => s + x[1], 0)), longestTask: Math.round(Math.max(0, ...lts.map(x => x[1]))),
      worstFrames: loafs, contexts: ctx,
    };
  }, { a, b });
  result.phases[name] = stats;
  console.log(`[${LABEL}] ${name}: fps ${stats.fps} p50 ${stats.p50} p95 ${stats.p95} p99 ${stats.p99} max ${stats.max} >33ms ${stats.over33} longTasks ${stats.longTasks}/${stats.longTaskMs}ms` +
    stats.contexts.map(c => ` | ctx${c.id} ${c.cls === '(none)' ? 'hall' : c.cls.replace('hall-console__canvas', 'console')} ${c.buffer} ${c.renderFps}fps gap p50/p95/max ${c.gapP50}/${c.gapP95}/${c.gapMax} >50ms:${c.gaps50}${c.gpuMsPerFrame !== undefined ? ` gpu ${c.gpuMsPerFrame}ms/f` : ''}`).join(''));
}

if (!PHONE) {
  const box = { x: VW / 2, y: VH * 0.45 };
  await page.mouse.move(box.x, box.y);
  await sleep(1500);
  await phase('hallIdle', () => sleep(8000));
  await phase('hallPointer', async () => {
    const t = Date.now();
    while (Date.now() - t < 6000) { const a = (Date.now() - t) / 600; await page.mouse.move(box.x + Math.cos(a) * VW * 0.25, box.y + Math.sin(a) * VH * 0.15, { steps: 2 }); await sleep(16); }
  });
  await page.mouse.move(VW / 2, VH * 0.3);
  await sleep(1500);
  await phase('navigate', async () => {
    for (let i = 0; i < 4; i++) { await page.keyboard.press('ArrowRight'); await sleep(1300); }
    for (let i = 0; i < 2; i++) { await page.keyboard.press('ArrowLeft'); await sleep(1300); }
  });
  await sleep(1500);
  await phase('openCase', async () => { await page.keyboard.press('Enter'); await sleep(5000); });
  await phase('caseIdle', () => sleep(5000));
  await phase('backToHall', async () => { await page.keyboard.press('Escape'); await sleep(5000); });
} else {
  await phase('phoneIdleTop', () => sleep(5000));
  await phase('phoneScroll', async () => {
    for (let i = 0; i < 40; i++) { await page.mouse.wheel(0, 120); await sleep(100); }
    await sleep(1500);
    for (let i = 0; i < 20; i++) { await page.mouse.wheel(0, 120); await sleep(100); }
  });
  // second exhibit (first project) to the centre, give the 450 ms preparation time to start its live model
  await page.evaluate(() => document.querySelectorAll('.mobile-arcade__exhibit')[1]?.querySelector('.mobile-arcade__machine')?.scrollIntoView({ block: 'center' }));
  await sleep(5000);
  await phase('phoneExhibitIdle', () => sleep(6000));
  const tapped = await page.evaluate(() => {
    const el = document.querySelectorAll('.mobile-arcade__exhibit')[1]?.querySelector('.mobile-arcade__machine');
    if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: Math.max(r.y + 20, Math.min(r.y + r.height / 2, innerHeight - 40)), slug: el.getAttribute('href') };
  });
  result.tapped = tapped;
  if (tapped) {
    await phase('phoneEnter', async () => { await page.touchscreen.tap(tapped.x, tapped.y); await sleep(4000); });
    await phase('phoneViewerIdle', () => sleep(5000));
  }
}

const meta = await page.evaluate(() => {
  const P = window.__perf;
  const marks = Object.fromEntries(performance.getEntriesByType('mark').map(m => [m.name, Math.round(m.startTime)]));
  const nav = performance.getEntriesByType('navigation')[0];
  const lcp = performance.getEntriesByType('largest-contentful-paint');
  const fcp = performance.getEntriesByName('first-contentful-paint')[0];
  const ready = document.querySelector('[data-ready-ms]')?.getAttribute('data-ready-ms');
  const loadLts = P.longtasks.filter(x => x[0] < (Number(ready) || 1e9) + 1000);
  return {
    marks, readyMs: ready, fcp: fcp ? Math.round(fcp.startTime) : null, domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
    loadLongTasks: loadLts.length, loadLongTaskMs: Math.round(loadLts.reduce((s, x) => s + x[1], 0)), loadLongest: Math.round(Math.max(0, ...loadLts.map(x => x[1]))),
    loadLongTaskList: loadLts.map(x => [Math.round(x[0]), Math.round(x[1])]),
    loadWorstFrames: P.loaf.filter(x => x.t < (Number(ready) || 1e9) + 3000).sort((a, b) => b.d - a.d).slice(0, 8),
    consoleInfo: P.console, contexts: P.contexts.map(c => ({ id: c.id, cls: c.cls, type: c.type, attrs: c.attrs, buffer: c.canvas ? `${c.canvas.width}x${c.canvas.height}` : '?' })),
    dpr: devicePixelRatio, glRenderer: (() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g && g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; })(),
  };
});
Object.assign(result, meta);
result.network = { requests: nReq, mb: +(bytes / 1048576).toFixed(2) };
const groups = {};
for (const r of reqs.values()) {
  if (!r.bytes) continue;
  const u = new URL(r.url);
  const g = /\/models\//.test(u.pathname) ? 'models' : /\/textures\//.test(u.pathname) ? 'textures' : /\.(js|mjs)$/.test(u.pathname) ? 'js' : /\.css$/.test(u.pathname) ? 'css' : /\/media\//.test(u.pathname) ? 'media' : /\.(woff2?|ttf)$/.test(u.pathname) ? 'fonts' : u.host.includes('dennisbf') ? 'other' : 'thirdparty';
  groups[g] = groups[g] || { n: 0, mb: 0 };
  groups[g].n++; groups[g].mb += r.bytes / 1048576;
}
for (const g of Object.values(groups)) g.mb = +g.mb.toFixed(2);
result.network.groups = groups;
result.network.biggest = [...reqs.values()].filter(r => r.bytes).sort((a, b) => b.bytes - a.bytes).slice(0, 10).map(r => [Math.round(r.bytes / 1024) + ' KB', new URL(r.url).pathname]);
result.network.all = [...reqs.values()].filter(r => r.bytes).sort((a, b) => b.bytes - a.bytes).map(r => [Math.round(r.bytes / 1024), new URL(r.url).pathname]);
result.errors = errors.slice(0, 10);
fs.writeFileSync(path.join(OUT, `${LABEL}.json`), JSON.stringify(result, null, 1));
console.log(`[${LABEL}] gl=${result.glRenderer.slice(0, 60)} ready=${result.readyMs ?? '-'}ms wall=${result.readyWallMs ?? result.loadWallMs}ms fcp=${result.fcp} net=${result.network.mb}MB/${result.network.requests} loadLongTasks=${result.loadLongTasks}/${result.loadLongTaskMs}ms (max ${result.loadLongest}) ladder=${JSON.stringify(result.consoleInfo)} errors=${errors.length}`);
await browser.close();
