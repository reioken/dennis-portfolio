// Blue v6 atlas post-processing (Dennis, 2026-09-13: white pixels flickering on the face, ears skin-coloured on
// the outside). The Meshy atlas is 1,469 small UV islands; at hall size the head samples mip levels where every
// texel averages several islands, so eye whites, pink ear skin and whisker strokes bleed into the face and shimmer
// as the sampling shifts (the probe measured ~130 single-frame bright pixels on a 240×180 crop; with the atlas
// replaced by a flat colour: 0). This script reduces that bleed while preserving the fur's light and detail:
//   1. the eyes get their own texture (the eye polygons are a separate primitive): 1024² open, 512² closed with the
//      lids painted shut; outside the eye islands both are filled with a flat colour, so their mip chains stay clean
//      and no eye colours are left in the coat atlas,
//   2. the coat atlas gets the eye polygons and a 3 px rim painted with fur, the ear rims and backs darkened to the
//      coat colour (they were skin-coloured), and the gutters between islands padded with the nearest island,
//   3. gently lift baked-in dark fur patches, keeping the existing hair detail, then average every mip level
//      in linear light. No majority-island selection or hard brightness caps: those broke the coat in Phase 18.
//   4. the 1024² base goes into a copy of the GLB and the 512²..1² levels into one sheet
//      (public/models/blue-<build>-mips.webp) that the runtime uploads as the texture's mip levels.
// node scripts/models/blue-v6-atlas.mjs [source glb] [out glb] [build suffix, default v6d]
// Then: node scripts/models/blue-pack.mjs <out glb> public/models/blue-rigged-<build>.glb
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';
import fs from 'node:fs';
const SRC = process.argv[2] || '.source-assets/blue/v3/blue-rigged-v6.glb';
const OUT = process.argv[3] || '.source-assets/blue/v3/blue-rigged-v6-atlas.glb';
// File-name suffix of the shipped set (see BLUE_ASSET_BUILD in blueCat.ts): every content change gets a new name,
// because /models/* is edge-cached for a day and the GLB, the sheet and the closed texture must come from one build.
const BUILD = process.argv[4] || 'v6d';
const PUB = 'public/models', INSPECT = '.source-assets/blue/v6';
fs.mkdirSync(INSPECT, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(SRC);
const root = doc.getRoot();
const mesh = root.listMeshes().find(m => m.listPrimitives().some(p => /amber/i.test(p.getMaterial()?.getName() ?? '')));
const eyePrim = mesh.listPrimitives().find(p => /amber/i.test(p.getMaterial().getName()));
const coatPrim = mesh.listPrimitives().find(p => !/amber/i.test(p.getMaterial().getName()));
const tex = coatPrim.getMaterial().getBaseColorTexture();
if (eyePrim.getMaterial().getBaseColorTexture() !== tex) throw new Error('the eye material is expected to share the coat atlas in the export');
const { data, info } = await sharp(Buffer.from(tex.getImage())).raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, C = info.channels;
if (W !== 2048 || H !== 2048) throw new Error(`expected a 2048² atlas, got ${W}x${H}`);
const orig = new Float32Array(W * H * 3);
for (let i = 0; i < W * H; i++) { orig[3 * i] = data[i * C]; orig[3 * i + 1] = data[i * C + 1]; orig[3 * i + 2] = data[i * C + 2]; }
const img = Float32Array.from(orig);

// ---------------------------------------------------------------- islands and the owner map
const owner = new Int32Array(W * H).fill(-1);
const earClass = new Uint8Array(W * H);   // 1 = inside of the pinna, 2 = rim / back
const eyeMask = new Uint8Array(W * H), eyeHeight = new Float32Array(W * H);
let islands = 0;
const skinJoints = root.listSkins()[0].listJoints().map(j => j.getName());
const earJoints = new Set(skinJoints.map((n, i) => [n, i]).filter(([n]) => /^Ear/.test(n)).map(([, i]) => i));
function unionFind(n) { const par = new Int32Array(n); for (let i = 0; i < n; i++) par[i] = i; const find = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; }; return { find, union: (a, b) => { a = find(a); b = find(b); if (a !== b) par[a] = b; } }; }
function raster(prim, tag) {
  const uv = prim.getAttribute('TEXCOORD_0').getArray(), idx = prim.getIndices().getArray(), pos = prim.getAttribute('POSITION').getArray(), nrm = prim.getAttribute('NORMAL').getArray();
  const J = prim.getAttribute('JOINTS_0')?.getArray(), Wt = prim.getAttribute('WEIGHTS_0')?.getArray();
  const n = pos.length / 3, uf = unionFind(n);
  for (let t = 0; t < idx.length; t += 3) { uf.union(idx[t], idx[t + 1]); uf.union(idx[t + 1], idx[t + 2]); }
  const ids = new Map(); const idOf = v => { const r = uf.find(v); if (!ids.has(r)) ids.set(r, islands++); return ids.get(r); };
  const earW = v => { if (!J) return 0; let s = 0; for (let k = 0; k < 4; k++) if (earJoints.has(J[4 * v + k])) s += Wt[4 * v + k]; return s; };
  let minY = Infinity, maxY = -Infinity;
  for (let t = 0; t < idx.length; t += 3) {
    const v = [idx[t], idx[t + 1], idx[t + 2]], id = idOf(v[0]);
    const U = v.map(k => [uv[2 * k] * W, uv[2 * k + 1] * H]);
    const P = v.map(k => [pos[3 * k], pos[3 * k + 1], pos[3 * k + 2]]);
    const ear = v.reduce((a, k) => a + earW(k), 0) / 3 > .5;
    const nz = v.reduce((a, k) => a + nrm[3 * k + 2], 0) / 3;   // +z is forward in the glTF frame
    const ec = !ear ? 0 : nz > .30 ? 1 : 2;
    const x0 = Math.max(0, Math.floor(Math.min(...U.map(u => u[0])))), x1 = Math.min(W - 1, Math.ceil(Math.max(...U.map(u => u[0]))));
    const y0 = Math.max(0, Math.floor(Math.min(...U.map(u => u[1])))), y1 = Math.min(H - 1, Math.ceil(Math.max(...U.map(u => u[1]))));
    const det = (U[1][0] - U[0][0]) * (U[2][1] - U[0][1]) - (U[2][0] - U[0][0]) * (U[1][1] - U[0][1]);
    if (Math.abs(det) < 1e-9) continue;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + .5, py = y + .5;
      const w1 = ((px - U[0][0]) * (U[2][1] - U[0][1]) - (U[2][0] - U[0][0]) * (py - U[0][1])) / det;
      const w2 = ((U[1][0] - U[0][0]) * (py - U[0][1]) - (px - U[0][0]) * (U[1][1] - U[0][1])) / det;
      const w0 = 1 - w1 - w2; if (w0 < -.03 || w1 < -.03 || w2 < -.03) continue;
      const i = y * W + x;
      const inside = w0 >= 0 && w1 >= 0 && w2 >= 0;
      if (owner[i] < 0 || inside) owner[i] = id;
      if (ec && (earClass[i] === 0 || inside)) earClass[i] = ec;
      if (tag === 'eye') { eyeMask[i] = 1; const wy = w0 * P[0][1] + w1 * P[1][1] + w2 * P[2][1]; eyeHeight[i] = wy; minY = Math.min(minY, wy); maxY = Math.max(maxY, wy); }
    }
  }
  return { minY, maxY };
}
raster(coatPrim, 'coat');
const eyeRange = raster(eyePrim, 'eye');
let owned = 0; for (let i = 0; i < W * H; i++) if (owner[i] >= 0) owned++;
const dilate = (mask, R) => { const out = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (!mask[y * W + x]) continue; for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < H && xx >= 0 && xx < W) out[yy * W + xx] = 1; } } return out; };
const eyeRim = dilate(eyeMask, 3), eyeEdge = dilate(eyeMask, 2);
const lum = (a, i) => a[3 * i] * .2126 + a[3 * i + 1] * .7152 + a[3 * i + 2] * .0722;
const medianOf = (idx, a) => [0, 1, 2].map(ch => { const s = idx.map(i => a[3 * i + ch]).sort((p, q) => p - q); return s[s.length >> 1]; });
console.log(`islands ${islands}, owned texels ${owned} of ${W * H} (${(100 * owned / (W * H)).toFixed(1)} %)`);

// ---------------------------------------------------------------- coat: ears, eye sockets, gutters
const coatSamples = []; for (let i = 0; i < W * H; i += 7) if (owner[i] >= 0 && !earClass[i] && !eyeRim[i] && lum(orig, i) < 70) coatSamples.push(i);
const coat = medianOf(coatSamples, orig);
// Lift only the low-frequency baked shadow on the fur. The gain comes from nearby
// texels of the same island, so fine hair contrast and the original hues survive.
// Eye/ear colours are handled separately below; exact black remains black.
let lifted = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = y * W + x;
  if (owner[i] < 0 || earClass[i] || eyeRim[i]) continue;
  let sum = 0, count = 0;
  for (let dy = -4; dy <= 4; dy += 2) for (let dx = -4; dx <= 4; dx += 2) {
    const xx = x + dx, yy = y + dy;
    if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
    const j = yy * W + xx;
    if (owner[j] !== owner[i] || eyeRim[j] || earClass[j]) continue;
    sum += lum(orig, j); count++;
  }
  const low = count ? sum / count : lum(orig, i);
  const lift = 15 * (1 - Math.exp(-low / 6)) * Math.exp(-low / 70);
  const gain = Math.min(2.5, (low + lift) / Math.max(low, .001));
  for (let c = 0; c < 3; c++) img[3 * i + c] = Math.min(255, orig[3 * i + c] * gain);
  lifted++;
}
console.log(`fur shadow gain on ${lifted} texels; original hair detail retained`);
let earDark = 0;
for (let i = 0; i < W * H; i++) {
  if (earClass[i] !== 2) continue;
  const k = .18;   // a little of the texel's own structure stays so the rim reads as fur, not paint
  for (let c = 0; c < 3; c++) img[3 * i + c] = coat[c] * (1 - k) + img[3 * i + c] * k * .7;
  earDark++;
}
const ring = []; for (let i = 0; i < W * H; i++) if (!eyeRim[i] && dilate1(i)) ring.push(i);
function dilate1(i) { const x = i % W, y = (i / W) | 0; for (let dy = -10; dy <= 10; dy += 2) for (let dx = -10; dx <= 10; dx += 2) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < H && xx >= 0 && xx < W && eyeRim[yy * W + xx]) return true; } return false; }
const fur = medianOf(ring, orig);
let socket = 0;
for (let i = 0; i < W * H; i++) {
  if (!eyeRim[i]) continue;
  const keep = .25;
  for (let c = 0; c < 3; c++) img[3 * i + c] = fur[c] * .92 * (1 - keep) + orig[3 * i + c] * keep * .6;
  socket++;
}
console.log(`coat colour ${coat.map(v => v.toFixed(0)).join(',')}, ear rim/back texels darkened ${earDark}; eye sockets painted ${socket} texels with fur ${fur.map(v => v.toFixed(0)).join(',')}`);
{
  const queue = new Int32Array(W * H); let qh = 0, qt = 0;
  for (let i = 0; i < W * H; i++) if (owner[i] >= 0) queue[qt++] = i;
  const from = new Int32Array(W * H).fill(-1);
  while (qh < qt) {
    const i = queue[qh++], x = i % W, y = (i / W) | 0, src = from[i] < 0 ? i : from[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy; if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
      const j = yy * W + xx; if (owner[j] >= 0) continue;
      owner[j] = owner[src]; from[j] = src; earClass[j] = earClass[src];
      for (let c = 0; c < 3; c++) img[3 * j + c] = img[3 * src + c];
      queue[qt++] = j;
    }
  }
  console.log(`gutter texels padded ${W * H - owned}`);
}
// ---------------------------------------------------------------- colour-preserving mip chain for the coat
// Average light, not sRGB bytes. Selecting a majority island at every level discarded fur
// detail and biased ties towards unrelated dark islands; hard luminance caps made this worse.
// The padded, eye-free atlas can now be filtered continuously without either operation.
const linear = v => { const s = v / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; };
const srgb = v => 255 * (v <= .0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - .055);
function downsample(level) {
  const { w, rgb } = level, hw = w >> 1;
  const nrgb = new Float32Array(hw * hw * 3);
  for (let y = 0; y < hw; y++) for (let x = 0; x < hw; x++) {
    const at = [(2 * y) * w + 2 * x, (2 * y) * w + 2 * x + 1, (2 * y + 1) * w + 2 * x, (2 * y + 1) * w + 2 * x + 1];
    const j = y * hw + x;
    for (let c = 0; c < 3; c++) {
      if (hw >= 1024) nrgb[3 * j + c] = srgb(at.reduce((sum, i) => sum + linear(rgb[3 * i + c]), 0) / 4);
      else {
        // A tent low-pass suppresses subpixel sparkle from the baked bright hairs
        // without clipping their light away. Padding keeps island-edge samples valid.
        let sum = 0;
        const weights = [1, 3, 3, 1];
        for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) {
          const xx = Math.max(0, Math.min(w - 1, x * 2 + dx - 1)), yy = Math.max(0, Math.min(w - 1, y * 2 + dy - 1));
          sum += linear(rgb[3 * (yy * w + xx) + c]) * weights[dx] * weights[dy];
        }
        nrgb[3 * j + c] = srgb(sum / 64);
      }
    }
  }
  const out = { w: hw, rgb: nrgb };
  return out;
}
const levels = [{ w: W, own: owner, rgb: img }];
while (levels[levels.length - 1].w > 1) levels.push(downsample(levels[levels.length - 1]));
const toBuf = (rgb, w) => { const b = Buffer.alloc(w * w * 3); for (let i = 0; i < b.length; i++) b[i] = Math.max(0, Math.min(255, Math.round(rgb[i]))); return b; };
const base = levels.find(l => l.w === 1024);
const baseWebp = await sharp(toBuf(base.rgb, 1024), { raw: { width: 1024, height: 1024, channels: 3 } }).webp({ quality: 90 }).toBuffer();
tex.setImage(new Uint8Array(baseWebp)).setMimeType('image/webp').setName('Blue coat atlas');
{
  // levels 512..1 stacked in a 512-wide column (height 1023); the runtime slices it back into mip levels 1..10
  const rows = levels.filter(l => l.w <= 512); let top = 0; const composite = [];
  for (const l of rows) { composite.push({ input: toBuf(l.rgb, l.w), raw: { width: l.w, height: l.w, channels: 3 }, left: 0, top }); top += l.w; }
  await sharp({ create: { width: 512, height: top, channels: 3, background: '#000' } }).composite(composite).webp({ quality: 90 }).toFile(`${PUB}/blue-${BUILD}-mips.webp`);
}

// ---------------------------------------------------------------- the eyes: their own textures
const box = (src, w, f) => { const hw = w / f, out = new Float32Array(hw * hw * 3); for (let y = 0; y < hw; y++) for (let x = 0; x < hw; x++) for (let c = 0; c < 3; c++) { let s = 0; for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) s += src[3 * ((y * f + dy) * w + x * f + dx) + c]; out[3 * (y * hw + x) + c] = s / (f * f); } return out; };
const eyeIdx = []; for (let i = 0; i < W * H; i++) if (eyeMask[i]) eyeIdx.push(i);
const eyeMean = [0, 1, 2].map(c => eyeIdx.reduce((a, i) => a + orig[3 * i + c], 0) / eyeIdx.length);
const eyeOpen = new Float32Array(W * H * 3);
for (let i = 0; i < W * H; i++) for (let c = 0; c < 3; c++) eyeOpen[3 * i + c] = eyeEdge[i] ? orig[3 * i + c] : eyeMean[c];
const eyeOpen1024 = box(eyeOpen, W, 2);
const eyeWebp = await sharp(toBuf(eyeOpen1024, 1024), { raw: { width: 1024, height: 1024, channels: 3 } }).webp({ quality: 90 }).toBuffer();
const eyeTex = doc.createTexture('Blue eyes').setImage(new Uint8Array(eyeWebp)).setMimeType('image/webp');
eyePrim.getMaterial().setBaseColorTexture(eyeTex);
const eyeClosed = new Float32Array(W * H * 3);
const midY = (eyeRange.minY + eyeRange.maxY) / 2, band = (eyeRange.maxY - eyeRange.minY) * .09;
for (let i = 0; i < W * H; i++) {
  const keep = eyeRim[i] ? .25 : 0;
  let rgb = [0, 1, 2].map(c => fur[c] * .92 * (1 - keep) + orig[3 * i + c] * keep * .6);
  if (eyeMask[i] && Math.abs(eyeHeight[i] - midY) < band) rgb = rgb.map(v => v * .45);   // lid seam
  eyeClosed[3 * i] = rgb[0]; eyeClosed[3 * i + 1] = rgb[1]; eyeClosed[3 * i + 2] = rgb[2];
}
const eyeClosed512 = box(eyeClosed, W, 4);
await sharp(toBuf(eyeClosed512, 512), { raw: { width: 512, height: 512, channels: 3 } }).webp({ quality: 88 }).toFile(`${PUB}/blue-${BUILD}-closed.webp`);
await io.write(OUT, doc);
// inspection copies
await sharp(toBuf(img, W), { raw: { width: W, height: H, channels: 3 } }).png().toFile(`${INSPECT}/atlas-coat-2048.png`);
await sharp(toBuf(eyeOpen1024, 1024), { raw: { width: 1024, height: 1024, channels: 3 } }).png().toFile(`${INSPECT}/eyes-open-1024.png`);
await sharp(toBuf(eyeClosed512, 512), { raw: { width: 512, height: 512, channels: 3 } }).png().toFile(`${INSPECT}/eyes-closed-512.png`);
for (const l of levels) if (l.w <= 256 && l.w >= 16) await sharp(toBuf(l.rgb, l.w), { raw: { width: l.w, height: l.w, channels: 3 } }).png().toFile(`${INSPECT}/mip-coat-${l.w}.png`);
const size = f => fs.statSync(f).size;
console.log(`BLUE_ATLAS ${OUT}: coat 1024² ${baseWebp.length} B + eyes 1024² ${eyeWebp.length} B; sheet ${size(`${PUB}/blue-${BUILD}-mips.webp`)} B; closed eyes 512² ${size(`${PUB}/blue-${BUILD}-closed.webp`)} B; eye texels ${eyeIdx.length}, eye mean ${eyeMean.map(v => v.toFixed(0)).join(',')}`);
