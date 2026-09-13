// Closed-eye atlas for Blue v6 (the v1 mesh with its original Meshy coat). The eyes are the polygons of the
// `Blue amber eyes` material, so the eye region is taken from the mesh, not from colour: every eye triangle is
// rasterised in UV space (8-bit in Node; Blender's float round-trip crushes the dark fur), dilated a little, and
// painted with the median fur colour of the ring around it, plus a soft dark seam along the middle as the lid line.
// The runtime swaps this atlas in while `blink` > 0.5 and lifts the eye material's amber tint at the same time.
// node scripts/models/blue-v6-closed-eyes.mjs [source glb] [out webp]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';
import fs from 'node:fs';
const SRC = process.argv[2] || '.source-assets/blue/v3/blue-rigged-v6.glb';
const OUT = process.argv[3] || 'public/models/blue-v6-closed.webp';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(SRC);
const mesh = doc.getRoot().listMeshes().find(m => m.listPrimitives().some(p => /amber/i.test(p.getMaterial()?.getName() ?? '')));
const eyePrim = mesh.listPrimitives().find(p => /amber/i.test(p.getMaterial().getName()));
const coatPrim = mesh.listPrimitives().find(p => !/amber/i.test(p.getMaterial().getName()));
const tex = coatPrim.getMaterial().getBaseColorTexture();
const { data, info } = await sharp(Buffer.from(tex.getImage())).raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, C = info.channels;
const uv = eyePrim.getAttribute('TEXCOORD_0').getArray(), idx = eyePrim.getIndices().getArray();
const pos = eyePrim.getAttribute('POSITION').getArray();
// 1. rasterise the eye triangles into a mask, tagging each texel with the eye side and its height on the mesh
const mask = new Uint8Array(W * H), side = new Int8Array(W * H), heightOf = new Float32Array(W * H);
let minY = Infinity, maxY = -Infinity;
for (let t = 0; t < idx.length; t += 3) {
  const v = [idx[t], idx[t + 1], idx[t + 2]];
  const U = v.map(k => [uv[2 * k] * W, uv[2 * k + 1] * H]); const P = v.map(k => [pos[3 * k], pos[3 * k + 1], pos[3 * k + 2]]);
  const x0 = Math.max(0, Math.floor(Math.min(...U.map(u => u[0])))), x1 = Math.min(W - 1, Math.ceil(Math.max(...U.map(u => u[0]))));
  const y0 = Math.max(0, Math.floor(Math.min(...U.map(u => u[1])))), y1 = Math.min(H - 1, Math.ceil(Math.max(...U.map(u => u[1]))));
  const det = (U[1][0] - U[0][0]) * (U[2][1] - U[0][1]) - (U[2][0] - U[0][0]) * (U[1][1] - U[0][1]);
  if (Math.abs(det) < 1e-9) continue;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const px = x + .5, py = y + .5;
    const w1 = ((px - U[0][0]) * (U[2][1] - U[0][1]) - (U[2][0] - U[0][0]) * (py - U[0][1])) / det;
    const w2 = ((U[1][0] - U[0][0]) * (py - U[0][1]) - (px - U[0][0]) * (U[1][1] - U[0][1])) / det;
    const w0 = 1 - w1 - w2; if (w0 < -.03 || w1 < -.03 || w2 < -.03) continue;
    const i = y * W + x; mask[i] = 1;
    const wy = w0 * P[0][1] + w1 * P[1][1] + w2 * P[2][1]; heightOf[i] = wy; minY = Math.min(minY, wy); maxY = Math.max(maxY, wy);
    side[i] = Math.sign(w0 * P[0][0] + w1 * P[1][0] + w2 * P[2][0]) || 1;
  }
}
const eyeTexels = mask.reduce((a, b) => a + b, 0);
// 2. dilate by 3 px so the anti-aliased rim goes too, then paint with the fur colour from a ring outside the eye
const R = 3, dil = new Uint8Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (!mask[y * W + x]) continue; for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < H && xx >= 0 && xx < W) dil[yy * W + xx] = 1; } }
const ring = [];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (dil[y * W + x]) continue; let near = false; for (let dy = -10; dy <= 10 && !near; dy += 2) for (let dx = -10; dx <= 10; dx += 2) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < H && xx >= 0 && xx < W && dil[yy * W + xx]) { near = true; break; } } if (near) { const i = (y * W + x) * C; ring.push([data[i], data[i + 1], data[i + 2]]); } }
const median = ch => { const a = ring.map(p => p[ch]).sort((p, q) => p - q); return a[a.length >> 1]; };
const fur = [median(0), median(1), median(2)];
const out = Buffer.from(data);
const midY = (minY + maxY) / 2, band = (maxY - minY) * .09;
let painted = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = y * W + x; if (!dil[i]) continue;
  // a little of the original texel's own variation survives so the patch does not read as a flat disc
  const o = i * C, keep = .25;
  let rgb = [0, 1, 2].map(c => Math.round(fur[c] * .92 * (1 - keep) + out[o + c] * keep * .6));
  if (mask[i] && Math.abs(heightOf[i] - midY) < band) rgb = rgb.map(v => Math.round(v * .45));   // lid seam
  out[o] = rgb[0]; out[o + 1] = rgb[1]; out[o + 2] = rgb[2]; painted++;
}
const rgb = C === 3 ? out : await sharp(out, { raw: { width: W, height: H, channels: C } }).removeAlpha().raw().toBuffer();
// 1024²: the closed atlas is on screen for a blink or while he sleeps at ~110 px; 2048² cost 800 KB for nothing
await sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).resize(1024, 1024).webp({ quality: 88 }).toFile(OUT);
fs.mkdirSync('.source-assets/blue/v6', { recursive: true });
await sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).png().toFile('.source-assets/blue/v6/closed-atlas.png');
console.log(`eye texels ${eyeTexels}, painted ${painted}, fur ${fur.join(',')}, atlas ${W}x${H} -> ${OUT} (${fs.statSync(OUT).size} bytes)`);
