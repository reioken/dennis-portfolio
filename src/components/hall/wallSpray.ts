/**
 * A spray can for 2D canvases: everything the wall game paints ONCE (the frame marks, the digit and icon atlas)
 * is laid down with this, so it has the soft edge, the uneven pressure and the overspray of the real thing.
 * The line the ball leaves is sprayed on the GPU instead (wallTag.ts); both are tuned to look like one can.
 *
 * No fonts: the digits are our own stroke shapes, so they look the same on every machine.
 */

export type Pt = [number, number];

export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Catmull-Rom through the points, sampled to a polyline. `closed` wraps around. */
export function smooth(points: Pt[], perSpan = 10): Pt[] {
  if (points.length < 3) return points.slice();
  const out: Pt[] = [];
  const n = points.length;
  const at = (i: number) => points[Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < n - 1; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let k = 0; k < perSpan; k++) {
      const t = k / perSpan, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(points[n - 1]);
  return out;
}

const sprites = new Map<number, HTMLCanvasElement>();
function sprite(radius: number) {
  const key = Math.max(1, Math.round(radius * 2) / 2);
  let c = sprites.get(key);
  if (c) return c;
  const size = Math.ceil(key * 2 + 2);
  c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, key);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.52, 'rgba(255,255,255,1)');
  grad.addColorStop(0.80, 'rgba(255,255,255,0.42)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  sprites.set(key, c);
  return c;
}

export interface SprayOptions {
  /** 0..1, how hard the cap is pressed. */
  pressure?: number;
  /** Radius multiplier at the start and at the end of the stroke (1 = full). */
  taper?: [number, number];
  /** Overspray specks per pixel of stroke length. */
  speckle?: number;
  /** Hand wobble, in pixels. */
  wobble?: number;
  rng?: () => number;
}

/** One pass of the can along a polyline (canvas pixels). */
export function spray(ctx: CanvasRenderingContext2D, pts: Pt[], radius: number, o: SprayOptions = {}) {
  if (pts.length < 1) return;
  const rng = o.rng ?? mulberry(7);
  const pressure = o.pressure ?? 1;
  const [t0, t1] = o.taper ?? [1, 1];
  const wobble = o.wobble ?? 0;
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const spacing = Math.max(0.55, radius * 0.22);
  const phase = rng() * 10;
  let run = 0;
  const stamp = (x: number, y: number, s: number) => {
    const u = total > 0 ? s / total : 0;
    const breathe = 0.90 + 0.13 * Math.sin(phase + s * 0.045) + 0.07 * Math.sin(phase * 2.3 + s * 0.11);
    // a quick ease at both ends, so a stroke starts and lifts like a hand does it
    const ends = Math.min(1, 0.55 + u * 9) * Math.min(1, 0.55 + (1 - u) * 9);
    const r = Math.max(0.8, radius * (t0 + (t1 - t0) * u) * breathe * ends);
    const img = sprite(r);
    ctx.globalAlpha = Math.min(1, 0.55 * pressure);
    ctx.drawImage(img, x - img.width / 2, y - img.height / 2);
  };
  if (pts.length === 1 || total === 0) {
    // a dot: the can held still for a moment
    const img = sprite(radius);
    ctx.globalAlpha = Math.min(1, 0.8 * pressure);
    for (let k = 0; k < 4; k++) ctx.drawImage(img, pts[0][0] - img.width / 2, pts[0][1] - img.height / 2);
  }
  for (let i = 1; i < pts.length; i++) {
    const ax = pts[i - 1][0], ay = pts[i - 1][1], bx = pts[i][0], by = pts[i][1];
    const len = Math.hypot(bx - ax, by - ay);
    if (len === 0) continue;
    const nx = -(by - ay) / len, ny = (bx - ax) / len;
    for (let d = 0; d < len; d += spacing) {
      const s = run + d;
      const w = wobble ? Math.sin(phase * 1.7 + s * 0.021) * wobble + Math.sin(phase + s * 0.057) * wobble * 0.4 : 0;
      stamp(ax + (bx - ax) * (d / len) + nx * w, ay + (by - ay) * (d / len) + ny * w, s);
    }
    run += len;
  }
  // overspray: fine droplets, dense near the line, thinning out to about three radii
  const specks = Math.round((total + radius * 2) * (o.speckle ?? 0.55));
  ctx.fillStyle = '#fff';
  for (let k = 0; k < specks; k++) {
    const s = rng() * total;
    let acc = 0, i = 1;
    while (i < pts.length - 1 && acc + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) < s) {
      acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      i++;
    }
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const t = Math.min(1, Math.max(0, (s - acc) / len));
    const off = (rng() + rng() + rng() - 1.5) * radius * 3.4;
    const ang = rng() * Math.PI * 2;
    const x = a[0] + (b[0] - a[0]) * t + Math.cos(ang) * off;
    const y = a[1] + (b[1] - a[1]) * t + Math.sin(ang) * off;
    ctx.globalAlpha = (0.25 + rng() * 0.6) * pressure;
    const size = rng() < 0.18 ? 2 : 1;
    ctx.fillRect(Math.round(x), Math.round(y), size, size);
  }
  ctx.globalAlpha = 1;
}

/** A run of paint that gave way: down from (x, y), a bead where it stopped. */
export function drip(ctx: CanvasRenderingContext2D, x: number, y: number, length: number, radius: number, rng: () => number) {
  spray(ctx, [[x, y], [x + (rng() - 0.5) * radius * 0.6, y + length]], radius, { taper: [1, 0.7], speckle: 0, rng });
  spray(ctx, [[x, y + length]], radius * 1.35, { speckle: 0, rng });
}

/** The same stable fine wear the wall lettering carries: pinholes where the paint never took. */
export function wear(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, density = 1.1) {
  let s = seed >>> 0;
  for (let i = 0; i < w * density; i++) {
    s = (1664525 * s + 1013904223) >>> 0;
    const x = (s >>> 8) % w;
    s = (1664525 * s + 1013904223) >>> 0;
    const y = (s >>> 8) % h;
    ctx.clearRect(x, y, 1 + (s % 2), 1);
  }
}

/* ---------- the hand: digits as strokes, in a box 0..0.72 wide and 0..1 tall, y up ---------- */
type Glyph = { smooth: boolean; pts: Pt[] }[];
const S = (...pts: Pt[]) => ({ smooth: true, pts });
const L = (...pts: Pt[]) => ({ smooth: false, pts });
export const DIGIT_STROKES: Glyph[] = [
  /* 0 */ [S([0.50, 0.99], [0.22, 0.84], [0.12, 0.48], [0.24, 0.12], [0.46, 0.01], [0.68, 0.16], [0.78, 0.52], [0.68, 0.86], [0.46, 1.0], [0.30, 0.90])],
  /* 1 */ [L([0.16, 0.70], [0.50, 1.0]), L([0.50, 1.0], [0.47, 0.0])],
  /* 2 */ [S([0.14, 0.76], [0.26, 0.94], [0.48, 1.0], [0.72, 0.86], [0.70, 0.62], [0.44, 0.34], [0.10, 0.03]), L([0.10, 0.03], [0.84, 0.07])],
  /* 3 */ [S([0.14, 0.90], [0.44, 1.0], [0.72, 0.84], [0.60, 0.60], [0.34, 0.53]), S([0.34, 0.53], [0.68, 0.44], [0.80, 0.22], [0.56, 0.02], [0.12, 0.10])],
  /* 4 */ [L([0.58, 1.0], [0.08, 0.34], [0.86, 0.34]), L([0.62, 0.70], [0.58, 0.0])],
  /* 5 */ [L([0.80, 0.99], [0.26, 0.99], [0.19, 0.56]), S([0.19, 0.56], [0.46, 0.65], [0.74, 0.50], [0.78, 0.22], [0.52, 0.01], [0.12, 0.09])],
  /* 6 */ [S([0.72, 0.98], [0.40, 0.82], [0.16, 0.44], [0.22, 0.10], [0.48, 0.0], [0.76, 0.16], [0.72, 0.46], [0.46, 0.56], [0.20, 0.36])],
  /* 7 */ [L([0.10, 0.98], [0.84, 0.98]), S([0.84, 0.98], [0.62, 0.62], [0.46, 0.30], [0.38, 0.0]), L([0.34, 0.50], [0.78, 0.53])],
  /* 8 */ [S([0.70, 0.86], [0.46, 1.0], [0.22, 0.82], [0.44, 0.56], [0.74, 0.30], [0.50, 0.0], [0.18, 0.20], [0.44, 0.56], [0.70, 0.86])],
  /* 9 */ [S([0.76, 0.74], [0.52, 0.99], [0.22, 0.84], [0.22, 0.58], [0.46, 0.46], [0.74, 0.62], [0.78, 0.86]), S([0.78, 0.92], [0.76, 0.50], [0.62, 0.18], [0.36, 0.0])],
];
export const GLYPH_BOX_W = 0.86;
const SLANT = 0.16;

/** Sprays glyph `g` into the cell at (x, y, w, h) canvas pixels. */
export function sprayGlyph(ctx: CanvasRenderingContext2D, g: Glyph, x: number, y: number, h: number, radius: number, rng: () => number, slant = SLANT) {
  const pad = radius * 1.7;
  const hh = h - pad * 2;
  for (const s of g) {
    const pts = (s.smooth ? smooth(s.pts, 9) : s.pts).map(([gx, gy]): Pt => [x + pad + (gx + gy * slant) * hh, y + pad + (1 - gy) * hh]);
    spray(ctx, pts, radius, { rng, taper: [1.12, 0.86], speckle: 0.35, wobble: 0.5 });
  }
}
