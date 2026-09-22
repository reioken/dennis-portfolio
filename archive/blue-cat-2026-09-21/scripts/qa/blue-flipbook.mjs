/**
 * Real-speed before/after motion flipbook for Blue.
 *
 * Steps the cat deterministically at 1/60 s and captures a frame every 1/30 s of simulated time, so a
 * 30 fps playback of the resulting folder runs at real speed. Every scenario is captured twice: once
 * through the hall camera the visitor actually sees, once through a fixed close camera of our own.
 *
 *   QA_BASE_URL   dev server with window.__hall (default http://localhost:4322/)
 *   QA_OUT        output root, must be outside the project
 *   QA_LABEL      subfolder name, e.g. `before` or `after`
 *   QA_SCENARIOS  optional comma list to restrict the run
 *
 * Writes <QA_OUT>/<label>/<scenario>-<view>/0001.jpg, trace-<scenario>.json, sheet-<scenario>-<view>.png
 * and summary.json. Capture only: nothing in the site is modified.
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { tmpdir } from 'node:os';

const BASE = process.env.QA_BASE_URL || 'http://localhost:4322/';
const LABEL = process.env.QA_LABEL || 'after';
const root = path.resolve(process.env.QA_OUT || path.join(tmpdir(), 'blue-flipbook'));
if (root.startsWith(process.cwd())) throw new Error('QA_OUT must be outside the project');
const out = path.join(root, LABEL);

const VIEWPORT = { width: 1440, height: 900 };
/** The hall crop: the claw cabinet, the takeoff lane and the cat bed, identical for every capture. */
const HALL_CLIP = { x: 250, y: 100, width: 720, height: 720 };
/** Scenarios that frame something else in the hall view. `aboutjump` needs the whole cabinet, the cat standing on
 * its roof with headroom, and the floor take-off spot, which the shared hall crop cuts off at the top. */
const HALL_CLIPS = { aboutjump: { x: 480, y: 40, width: 560, height: 780 } };
/** The `roof` view: same direction as the About camera, tight on the cap, for the landing, the turnaround and the
 * lie-down. The cat fills about 40 % of the frame height and stays inside it while he swings broadside. */
const ROOF_CLIPS = { aboutjump: { x: 400, y: 40, width: 700, height: 820 } };
/** The near crop: the site's own header and footer bars trimmed off, nothing else. */
const NEAR_CLIP = { x: 170, y: 60, width: 1100, height: 700 };
/** The profile jump needs a tall, narrow frame; everything else uses the wide near crop. */
const NEAR_CLIPS = {
  jump: { x: 420, y: 55, width: 640, height: 720 },
  aboutjump: { x: 300, y: 40, width: 860, height: 760 },
  perchfront: { x: 250, y: 60, width: 940, height: 700 },
  perchcompact: { x: 20, y: 60, width: 350, height: 700 },
  jumpcompact: { x: 0, y: 40, width: 390, height: 790 },
};
const FPS = 30, SUB = 2;            // capture step 1/30 s, simulated in 2 steps of 1/60 s
const PRE = 0.5, SEED = 0x9e3779b9;

/** Fixed capture length per scenario in seconds, so before and after line up frame for frame. */
const SCENARIOS = [
  { name: 'turn45', seconds: 3.2 },
  { name: 'turn90', seconds: 3.6 },
  { name: 'turn150', seconds: 4.4 },
  { name: 'walkaway', seconds: 5.2 },
  { name: 'walkarc', seconds: 5.2 },
  { name: 'settle', seconds: 6.6 },
  { name: 'bedsettle', seconds: 10.0 },
  { name: 'jump', seconds: 6.5 },
  { name: 'aboutjump', seconds: 14.0 },
  { name: 'jumpcompact', seconds: 6.5 },
  { name: 'perchfront', seconds: 1.0 },
  { name: 'perchcompact', seconds: 1.0 },
];
/** Scenarios where Blue is under about 60 px tall in the hall crop: the hall view adds nothing to the comparison. */
const NEAR_ONLY = new Set(['perchfront', 'perchcompact', 'walkarc', 'jumpcompact']);
/** Extra views beyond hall/near. */
const EXTRA_VIEWS = { aboutjump: ['roof'] };
const viewsFor = name => [...(NEAR_ONLY.has(name) ? ['near'] : ['hall', 'near']), ...(EXTRA_VIEWS[name] ?? [])];
/** perchcompact reproduces the 390 px layout, where the root is shifted and scaled .75 against a fixed cabinet. */
const VIEWPORTS = { perchcompact: { width: 390, height: 844 }, jumpcompact: { width: 390, height: 844 } };

const wanted = process.env.QA_SCENARIOS?.split(',').map(s => s.trim()).filter(Boolean);
const list = wanted ? SCENARIOS.filter(s => wanted.includes(s.name)) : SCENARIOS;

await fs.mkdir(out, { recursive: true });

/* ------------------------------------------------------------------ page side ---- */

/**
 * Installed once in the page. Owns the deterministic reset, the per-scenario setup/trigger and the
 * per-frame step, so the Node side only drives an index and takes screenshots.
 */
function install() {
  const h = window.__hall, b = h.blue;
  const V = b.body.position.constructor;         // THREE.Vector3, without importing three into the page
  const Q = b.body.quaternion.constructor;

  const HOME = new V(-1.65, 0, .18), HOME_LIFT = .085, REST_YAW = .95;
  const REST_FORWARD = new V(Math.sin(REST_YAW), 0, Math.cos(REST_YAW));
  const BED_EXIT = HOME.clone().addScaledVector(REST_FORWARD, .55);
  const STAND = new V(-1.35, 0, .8);
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  /** v6g and later expose ledgeSpot(); the v6f baseline has LEDGE.spot = (0, 1.95, .17) instead. */
  const ledge = () => (b.ledgeSpot ? b.ledgeSpot() : b.local(new V(0, 1.95, .17)));

  let seedState = 0;
  const seedRandom = seed => {
    seedState = seed | 0;
    Math.random = () => {
      seedState = seedState + 0x6D2B79F5 | 0;
      let t = Math.imul(seedState ^ seedState >>> 15, 1 | seedState);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };

  const BONES = ['FrontPawL', 'FrontPawR', 'HindPawL', 'HindPawR', 'Head', 'Pelvis', 'Chest', 'FrontUpperL', 'FrontUpperR', 'Neck', 'Spine'];

  /** Put the cat back into an identical settled idle stand, springs and blink included. */
  const reset = () => {
    b.mixer.stopAllAction();
    b.layer = undefined;
    b.wanted = () => b.plan;
    b.pendingHappy = false; b.pendingPet = null; b.purr = 0; b.toy = null;
    b.inBed = false; b.undisturbed = false; b.elevation = 0; b.faceYaw = null;
    b.afterJump = null; b.planChanged = false;
    b.speed = 0; b.loco = 1; b.walkMix = 0; b.trotMix = 0; b.yawRate = 0; b.lastYaw = 0;
    b.age = 0; b.clock = 0; b.frame = 0; b.visits = 0; b.plannedVisits = 2;
    b.ground = 0; b.seatGround = 0; b.perchGround = 0;
    b.blink = 0; b.blinkAge = 0; b.blinkPeriod = 5; b.slowBlink = 0;
    b.plan = { kind: 'home' };
    b.body.position.copy(STAND);
    b.body.rotation.set(0, 0, 0);
    b.enter('idle'); b.idle.play(); b.walk.play();
    b.dwell = 1e4;
    for (let i = 0; i < 60; i++) b.update(1 / 60, h.camera, true, false);
    b.dwell = 1e4;
  };

  const runHidden = seconds => { for (let i = 0, n = Math.round(seconds * 60); i < n; i++) b.update(1 / 60, h.camera, true, false); };

  /** Cabinet-space camera placement (root sits at the origin on desktop), applied straight to h.camera.
   * `world` skips the root offset: on compact layouts the root shifts but the cabinet does not, so a camera that
   * has to frame the cabinet must stay put. */
  const place = (pos, aim, fov, world) => {
    const dx = world ? 0 : b.root.position.x, dz = world ? 0 : b.root.position.z;
    h.camera.position.set(pos[0] + dx, pos[1], pos[2] + dz);
    h.camera.lookAt(aim[0] + dx, aim[1], aim[2] + dz);
    if (fov) h.camera.fov = fov;
    h.camera.updateProjectionMatrix();
  };

  /** Neutral fill for the near view only: the cat is black in a dark hall and the legs read as one mass. */
  const fills = [];
  const addFill = (pos, aim, world) => {
    let Ctor = null, Hemi = null;
    const dx = world ? 0 : b.root.position.x, dz = world ? 0 : b.root.position.z;
    h.scene.traverse(o => { if (o.isPointLight && !Ctor) Ctor = o.constructor; if (o.isHemisphereLight && !Hemi) Hemi = o; });
    const mid = new V(aim[0] + dx, aim[1], aim[2] + dz);
    const cam = new V(pos[0] + dx, pos[1], pos[2] + dz);
    if (Ctor) {
      const key = new Ctor(0xffffff, 5.5, 8, 2);
      key.position.copy(cam).lerp(mid, .22); key.position.y += .75;
      const side = new Ctor(0xffffff, 2.2, 8, 2);
      side.position.copy(mid).addScaledVector(new V().subVectors(cam, mid).normalize(), .9);
      side.position.y += .15;
      // push the side light around the subject so the far flank is not black
      side.position.x += (cam.x > mid.x ? -1.5 : 1.5);
      for (const l of [key, side]) { l.castShadow = false; h.scene.add(l); fills.push(l); }
    }
    if (Hemi) { fills.push({ hemi: Hemi, was: Hemi.intensity }); Hemi.intensity = Math.max(Hemi.intensity, 1.1); }
    return !!Ctor;
  };
  const clearFill = () => {
    for (const l of fills.splice(0)) {
      if (l.hemi) l.hemi.intensity = l.was;
      else { h.scene.remove(l); l.dispose?.(); }
    }
  };

  const NEAR = {
    turn45: { pos: [.35, .48, 2.6], aim: [-.9, .30, .74], fov: 55 },
    turn90: { pos: [.35, .48, 2.6], aim: [-.9, .30, .74], fov: 55 },
    turn150: { pos: [.35, .48, 2.6], aim: [-.9, .30, .74], fov: 55 },
    walkaway: { pos: [.35, .48, 2.6], aim: [-.9, .30, .74], fov: 55 },
    walkarc: { pos: [-.9, 1.95, 2.4], aim: [-1.25, .14, .7], fov: 55 },    // from above and in front: the path reads as an arc
    settle: { pos: [-.25, .45, 2.15], aim: [-1.35, .16, .8], fov: 45 },
    bedsettle: { pos: [-.25, .45, 1.85], aim: [-1.43, .12, .34], fov: 50 },
    jump: { pos: [-3.0, 1.0, .5], aim: [0, .99, .5], fov: 64 },            // pure profile along x, floor to well above the roof
    aboutjump: { pos: [-3.0, 1.15, .55], aim: [0, 1.05, .35], fov: 66 },   // the whole routine in profile
    perchfront: { pos: [0, 2.08, 1.61], aim: [0, 2.06, .2], fov: 45 },     // straight in front, roof height, 1.2 m off the lip
    perchcompact: { pos: [0, 2.08, 1.61], aim: [0, 2.06, .2], fov: 45, world: true },
    jumpcompact: { pos: [-3.0, 1.0, .5], aim: [0, .99, .5], fov: 64, world: true },
  };
  /** The site's own About framing of the claw machine (measured on /about/: camera (1.163, 1.568, 3.939), fov 34,
   * looking almost straight down -z). The hall view keeps that direction but pulls back and widens, so the whole
   * cabinet, the cat standing on the roof with headroom and the floor take-off spot are all in one frame. */
  const ABOUT_CAM = { pos: [1.55, 2.05, 5.10], aim: [0, 1.15, .30], fov: 50 };
  /** Same direction again, tight on the cap: landing, turnaround, lie-down. */
  const ROOF = { aboutjump: { pos: [.667, 1.911, 2.35], aim: [0, 2.02, .05], fov: 34 } };
  /** perchfront's second still: the same subject seen from 30° above. */
  const PERCH_ABOVE = { pos: [0, 2.68, 1.239], aim: [0, 2.02, .25], fov: 45 };

  const setup = {
    turn45: () => {}, turn90: () => {}, turn150: () => {}, walkaway: () => {}, walkarc: () => {},
    settle: () => {},
    aboutjump: () => {
      // The real About routine: standing on the lane, told to go and perch.
      b.body.position.set(-.55, 0, .86);
      b.body.rotation.set(0, -1.2, 0);
      b.elevation = 0; b.inBed = false;
    },
    perchcompact: () => setup.perchfront(),
    jumpcompact: () => setup.jump(),
    bedsettle: () => {
      b.body.position.copy(BED_EXIT);
      b.body.position.y = 0;
      b.body.rotation.set(0, wrap(REST_YAW + Math.PI), 0);
      b.elevation = 0; b.inBed = false;
    },
    jump: () => {
      // The take-off lane in Blue's own space: on compact layouts the root is shifted and scaled, so a literal
      // (0, 0, .8) would start him somewhere else entirely and the jump would not be the real one.
      b.body.position.copy(b.local(new V(0, 0, .80)));
      b.body.rotation.set(0, Math.PI, 0);
      b.plan = { kind: 'perch' };
    },
    perchfront: () => {
      b.body.position.copy(ledge());
      b.elevation = b.body.position.y;
      b.plan = { kind: 'perch' };
      b.body.rotation.set(0, 0, 0);
      b.enter('perch');
      runHidden(b.length('perch') + 1.2);      // through the lie-down, then a second of perchidle
      if (b.mood !== 'perchidle') { b.enter('perchidle'); runHidden(1.0); }
    },
  };

  const trigger = {
    turn45: () => turnTo(45), turn90: () => turnTo(90), turn150: () => turnTo(150),
    walkaway: () => {
      const a = 100 * Math.PI / 180;
      b.goal.copy(b.body.position).add(new V(Math.sin(a) * 1.2, 0, Math.cos(a) * 1.2));
      b.travelSpeed = .34; b.arrival = 'idle';
      b.enter('walk');
    },
    // A goal 60° off the nose: a cat walks off in an arc instead of pivoting on the spot first.
    walkarc: () => {
      const a = b.yaw + 60 * Math.PI / 180;
      b.goal.copy(b.body.position).add(new V(Math.sin(a) * 1.2, 0, Math.cos(a) * 1.2));
      b.travelSpeed = .34; b.arrival = 'idle';
      b.enter('walk');
    },
    aboutjump: () => { b.plan = { kind: 'perch' }; b.resume([b.stationX]); },
    settle: () => b.enter('settle'),
    bedsettle: () => {
      b.goal.copy(BED_EXIT);
      b.arrival = 'home';
      b.arrive([b.stationX]);                  // -> enterBed(): bedin, turn on the cushion, settle, sleep
    },
    jump: () => b.startJump(b.body.position, ledge(), true),
    perchfront: () => {},
    perchcompact: () => {},
    jumpcompact: () => b.startJump(b.body.position, ledge(), true),
  };
  const turnTo = degrees => {
    const a = degrees * Math.PI / 180;
    b.goal.copy(b.body.position).add(new V(Math.sin(a), 0, Math.cos(a)));
    b.arrival = 'idle'; b.travelSpeed = .21;
    b.startTurn(a, 'walk');
  };

  const sample = () => {
    b.body.updateWorldMatrix(true, true);
    const bones = {};
    for (const name of BONES) {
      const o = b.model.getObjectByName(name);
      if (o) bones[name] = o.getWorldPosition(new V()).toArray();
    }
    return {
      age: b.age, mood: b.mood, yaw: b.yaw,
      position: b.body.position.toArray(),
      world: b.body.getWorldPosition(new V()).toArray(),
      elevation: b.elevation, speed: b.speed,
      bones,
    };
  };

  window.__fb = {
    clips: () => {
      const o = {};
      for (const [name, action] of b.actions) o[name] = action.getClip().duration;
      return { clips: o, asset: b.assetBuild ?? null, hasLedgeSpot: typeof b.ledgeSpot === 'function' };
    },
    /** Start a run. view: 'hall' keeps the site camera; 'near' uses our fixed camera plus a fill light. */
    begin(scenario, view, fov0) {
      clearFill();
      h.camera.fov = fov0;
      h.camera.position.set(this.hallCam.p[0], this.hallCam.p[1], this.hallCam.p[2]);
      h.camera.quaternion.set(this.hallCam.q[0], this.hallCam.q[1], this.hallCam.q[2], this.hallCam.q[3]);
      h.camera.updateProjectionMatrix();
      seedRandom(this.seed);
      reset();
      (setup[scenario] || (() => {}))();
      let lit = true;
      if (view === 'near') {
        const c = NEAR[scenario];
        place(c.pos, c.aim, c.fov, c.world);
        lit = addFill(c.pos, c.aim, c.world);
      }
      // The cabinet does not move with Blue's root, so both About-style cameras are anchored in world space.
      else if (view === 'roof') { const c = ROOF[scenario]; place(c.pos, c.aim, c.fov, true); }
      else if (scenario === 'aboutjump') place(ABOUT_CAM.pos, ABOUT_CAM.aim, ABOUT_CAM.fov, true);
      this.scenario = scenario;
      this.view = view;
      this.triggerAt = scenario.startsWith('perch') ? 0 : Math.round(this.pre * this.fps);
      this.i = -1;
      return { lit, mood: b.mood, position: b.body.position.toArray(), yaw: b.yaw };
    },
    /** Advance to captured frame i and render it. */
    step(i) {
      if (i > 0) for (let k = 0; k < this.sub; k++) b.update(1 / (this.fps * this.sub), h.camera, true, false);
      if (i === this.triggerAt) (trigger[this.scenario] || (() => {}))();
      h.dirty = h.mirrorDirty = true;
      h.renderFrame();
      this.i = i;
      return sample();
    },
    /** perchfront only: the extra still from 30° above. */
    above() {
      place(PERCH_ABOVE.pos, PERCH_ABOVE.aim, PERCH_ABOVE.fov, NEAR[this.scenario]?.world);
      h.dirty = h.mirrorDirty = true;
      h.renderFrame();
      return sample();
    },
    end() { clearFill(); },
    seed: 0, pre: 0, fps: 30, sub: 2,
    hallCam: { p: h.camera.position.toArray(), q: h.camera.quaternion.toArray() },
    fov0: h.camera.fov,
  };
  return { fov0: h.camera.fov, hallCam: window.__fb.hallCam };
}

/* ------------------------------------------------------------------ analysis ---- */

const PAWS = ['FrontPawL', 'FrontPawR', 'HindPawL', 'HindPawR'];
const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Planted runs per paw and how far the paw slides while planted. A paw counts as planted when it is within 5 mm of
 * its own floor level AND is not inside a lift-off/touch-down transition: the frames on either side of a run where
 * the paw is already travelling but has barely left the ground belong to the step, not to the contact, so they are
 * trimmed by the paw's own horizontal speed (a planted paw has none).
 */
function footSlide(trace) {
  const dt = 1 / FPS, result = {};
  for (const paw of PAWS) {
    const pts = trace.map(f => f.bones?.[paw]).filter(Boolean);
    if (pts.length !== trace.length) { result[paw] = null; continue; }
    const min = Math.min(...pts.map(p => p[1]));
    const speed = pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      return Math.hypot(b[0] - a[0], b[2] - a[2]) / (2 * dt);
    });
    // 40 mm/s: below a tenth of the walk's paw speed, so only real contacts qualify.
    const planted = pts.map((p, i) => p[1] <= min + .005 && speed[i] < .04);
    const intervals = [];
    let start = -1;
    for (let i = 0; i <= planted.length; i++) {
      if (i < planted.length && planted[i]) { if (start < 0) start = i; continue; }
      if (start >= 0) {
        if (i - start >= 2) {
          let pathMm = 0, spanMm = 0;
          for (let k = start + 1; k < i; k++) pathMm += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][2] - pts[k - 1][2]) * 1000;
          for (let k = start; k < i; k++) spanMm = Math.max(spanMm, Math.hypot(pts[k][0] - pts[start][0], pts[k][2] - pts[start][2]) * 1000);
          intervals.push({ from: +(start * dt).toFixed(3), to: +((i - 1) * dt).toFixed(3), frames: i - start, pathMm: +pathMm.toFixed(1), spanMm: +spanMm.toFixed(1) });
        }
        start = -1;
      }
    }
    result[paw] = {
      minHeight: +min.toFixed(4),
      intervals,
      worstPathMm: +Math.max(0, ...intervals.map(v => v.pathMm)).toFixed(1),
      worstSpanMm: +Math.max(0, ...intervals.map(v => v.spanMm)).toFixed(1),
      totalPlantedFrames: intervals.reduce((s, v) => s + v.frames, 0),
    };
  }
  return result;
}

function yawRates(trace) {
  const dt = 1 / FPS, series = [];
  for (let i = 1; i < trace.length; i++) series.push(+(wrapAngle(trace[i].yaw - trace[i - 1].yaw) / dt * 180 / Math.PI).toFixed(2));
  return { series, maxDegPerSec: +Math.max(0, ...series.map(Math.abs)).toFixed(1) };
}

/** Root speed, height and forward travel of a jump, sampled every 1/15 s. */
function rootProfile(trace) {
  const dt = 1 / FPS, rows = [];
  const z0 = trace[0].position[2], y0 = trace[0].position[1];
  for (let i = 0; i < trace.length; i += 2) {
    const p = trace[i].position, q = trace[Math.max(0, i - 1)].position;
    const speed = i === 0 ? 0 : Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) / dt;
    rows.push({ t: +(i * dt).toFixed(3), mood: trace[i].mood, height: +(p[1] - y0).toFixed(4), forward: +(z0 - p[2]).toFixed(4), speed: +speed.toFixed(3) });
  }
  return rows;
}

/* ------------------------------------------------------------------ sheets ---- */

async function contactSheet(frames, file, cell, cols) {
  const picked = frames.filter((_, i) => i % 2 === 0);
  const rows = Math.max(1, Math.ceil(picked.length / cols));
  const first = await sharp(picked[0].buf).metadata();
  const cw = cell, ch = Math.max(1, Math.round(cell * first.height / first.width));
  const tiles = await Promise.all(picked.map(async (f, i) => ({
    input: await sharp(f.buf).resize(cw, ch).png().toBuffer(),
    left: (i % cols) * cw, top: Math.floor(i / cols) * ch,
  })));
  const W = cols * cw, H = rows * ch;
  const labels = picked.map((f, i) => {
    const x = (i % cols) * cw + 7, y = Math.floor(i / cols) * ch + ch - 8;
    return `<text x="${x}" y="${y}" font-family="monospace" font-size="17" stroke="#000" stroke-width="4" paint-order="stroke" fill="#fff">${f.t.toFixed(2)}s</text>`;
  }).join('');
  await sharp({ create: { width: W, height: H, channels: 3, background: '#141414' } })
    .composite([...tiles, { input: Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${labels}</svg>`), top: 0, left: 0 }])
    .png().toFile(file);
  return { file, cells: picked.length, width: W, height: H };
}

/* ------------------------------------------------------------------ run ---- */

const summary = { label: LABEL, base: BASE, capturedAt: new Date().toISOString(), viewport: VIEWPORT, fps: FPS, hallClip: HALL_CLIP, nearClip: NEAR_CLIP, nearClips: NEAR_CLIPS, errors: [], scenarios: {} };
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11'] });
try {
  const page = await browser.newPage({ viewport: VIEWPORT });
  page.on('pageerror', e => summary.errors.push(String(e.message)));
  page.setDefaultTimeout(240000);        // a cold dev server compiles the hall on the first request
  await page.goto(BASE);
  await page.waitForFunction(() => window.__hall?.readyDone && window.__hall.blue, null, { timeout: 240000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.__hall.stop());
  await page.waitForTimeout(400);
  const { fov0 } = await page.evaluate(install);
  await page.evaluate(({ seed, pre, fps, sub }) => Object.assign(window.__fb, { seed, pre, fps, sub }), { seed: SEED, pre: PRE, fps: FPS, sub: SUB });
  summary.clips = await page.evaluate(() => window.__fb.clips());

  for (const { name, seconds } of list) {
    const frames = Math.round(seconds * FPS);
    const record = { seconds, frames, views: {} };
    await page.setViewportSize(VIEWPORTS[name] || VIEWPORT);
    if (VIEWPORTS[name]) await page.waitForTimeout(400);           // the cat reads the container width once a second
    for (const view of viewsFor(name)) {
      const dir = path.join(out, `${name}-${view}`);
      await fs.rm(dir, { recursive: true, force: true });
      await fs.mkdir(dir, { recursive: true });
      const started = await page.evaluate(([s, v, f]) => window.__fb.begin(s, v, f), [name, view, fov0]);
      const clip = view === 'hall' ? (HALL_CLIPS[name] || HALL_CLIP) : view === 'roof' ? ROOF_CLIPS[name] : (NEAR_CLIPS[name] || NEAR_CLIP);
      const trace = [], shots = [];
      for (let i = 0; i < frames; i++) {
        trace.push(await page.evaluate(k => window.__fb.step(k), i));
        const buf = await page.screenshot({ clip, type: 'jpeg', quality: 80 });
        await fs.writeFile(path.join(dir, String(i + 1).padStart(4, '0') + '.jpg'), buf);
        shots.push({ t: i / FPS, buf });
      }
      if (name.startsWith('perch') && view !== 'roof') {
        const extra = await page.evaluate(() => window.__fb.above());
        const buf = await page.screenshot({ clip, type: 'jpeg', quality: 80 });
        await fs.writeFile(path.join(dir, 'still-above.jpg'), buf);
        record.above = extra;
      }
      await page.evaluate(() => window.__fb.end());
      const sheet = await contactSheet(shots, path.join(out, `sheet-${name}-${view}.png`), 240, 8);
      record.views[view] = { dir, lit: started.lit, sheet: path.basename(sheet.file), cells: sheet.cells, start: started };
      if (view === 'near') {
        await fs.writeFile(path.join(out, `trace-${name}.json`), JSON.stringify({ scenario: name, fps: FPS, triggerFrame: name === 'perchfront' ? 0 : Math.round(PRE * FPS), trace }, null, 1));
        record.footSlide = footSlide(trace);
        record.yaw = yawRates(trace);
        record.rootProfile = rootProfile(trace);
        record.moods = trace.reduce((acc, f, i) => { if (!acc.length || acc.at(-1).mood !== f.mood) acc.push({ mood: f.mood, t: +(i / FPS).toFixed(3) }); return acc; }, []);
      }
      process.stdout.write(`${LABEL} ${name}-${view}: ${frames} frames\n`);
    }
    summary.scenarios[name] = record;
  }
} finally {
  await browser.close();
}
// A restricted run tops up an existing summary instead of throwing the other scenarios away.
const summaryFile = path.join(out, 'summary.json');
const previous = await fs.readFile(summaryFile, 'utf8').then(JSON.parse).catch(() => null);
if (previous?.scenarios) {
  summary.scenarios = { ...previous.scenarios, ...summary.scenarios };
  // A top-up must not rewrite what the folder as a whole is: keep the original base URL and timestamp and record
  // the extra run beside them, so a comparison page still names the build the bulk of the frames came from.
  summary.topUps = [...(previous.topUps ?? []), { at: summary.capturedAt, base: summary.base, scenarios: list.map(s => s.name) }];
  summary.base = previous.base; summary.capturedAt = previous.capturedAt; summary.clips = previous.clips ?? summary.clips;
}
await fs.writeFile(summaryFile, JSON.stringify(summary, null, 1));
console.log(JSON.stringify({ out, errors: summary.errors.slice(0, 5), scenarios: Object.keys(summary.scenarios) }));
if (summary.errors.length) process.exitCode = 1;
