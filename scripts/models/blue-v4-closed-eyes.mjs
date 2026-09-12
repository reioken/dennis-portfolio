// Paint Blue v4's eyes shut on the 8-bit Meshy atlas by colour key (amber and pale texels, dilated) and write the 2048 WebP the runtime swaps in on a blink.
// node scripts/models/blue-v4-closed-eyes.mjs   (reads .source-assets/blue/v4/build-gpt/tex-base.jpg and inspect-gpt/normalised.glb)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';
import fs from 'node:fs';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read('.source-assets/blue/v4/inspect-gpt/normalised.glb');
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
const pos = prim.getAttribute('POSITION').getArray(), uv = prim.getAttribute('TEXCOORD_0').getArray();
const cfg = JSON.parse(fs.readFileSync('.source-assets/blue/v4/build-gpt/rig-config.json', 'utf8'));
const base = '.source-assets/blue/v4/build-gpt/tex-base.jpg';
const { data, info } = await sharp(base).raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, C = info.channels;
const isAmber = (r, g, b) => r > 110 && g > 55 && b < 90 && r > b + 55;
// 1. how do eye-region vertex UVs sample, with v as-is and with v flipped?
for (const [side, e] of Object.entries(cfg.eyes)) {
  const [bx, by, bz] = e.centre; const c = [bx, bz, -by]; const r = e.radius;
  let n = 0, amberAsIs = 0, amberFlip = 0;
  for (let k = 0; k < pos.length / 3; k++) {
    const dx = pos[3 * k] - c[0], dy = pos[3 * k + 1] - c[1], dz = pos[3 * k + 2] - c[2];
    if (dx * dx + dy * dy + dz * dz > r * r) continue; n++;
    const u = Math.min(W - 1, Math.max(0, Math.round(uv[2 * k] * W)));
    const v1 = Math.min(H - 1, Math.max(0, Math.round(uv[2 * k + 1] * H))), v2 = H - 1 - v1;
    const i1 = (v1 * W + u) * C, i2 = (v2 * W + u) * C;
    if (isAmber(data[i1], data[i1 + 1], data[i1 + 2])) amberAsIs++;
    if (isAmber(data[i2], data[i2 + 1], data[i2 + 2])) amberFlip++;
  }
  console.log(side, 'vertices', n, 'amber as-is', amberAsIs, 'amber flipped', amberFlip);
}
// 2. colour-keyed closed atlas: every amber texel becomes fur, softened; a dark seam is drawn along the iris midline per island row
let amberCount = 0; const out = Buffer.from(data);
const fur = [17, 15, 16];
const mask = new Uint8Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * C; if (isAmber(data[i], data[i + 1], data[i + 2]) || (data[i] + data[i + 1] + data[i + 2] > 300 && data[i + 2] > 120 && Math.abs(data[i] - data[i + 2]) < 60)) { mask[y * W + x] = 1; amberCount++; } }
// dilate the mask a little so the dark limbal ring and sclera texels go too
const dil = new Uint8Array(W * H); const R = 6;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (!mask[y * W + x]) continue; for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < H && xx >= 0 && xx < W) dil[yy * W + xx] = 1; } }
let painted = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (dil[y * W + x]) { const i = (y * W + x) * C; out[i] = fur[0]; out[i + 1] = fur[1]; out[i + 2] = fur[2]; painted++; }
console.log('amber texels', amberCount, 'painted', painted);
const png = await sharp(out, { raw: { width: W, height: H, channels: C } }).png().toBuffer();
fs.writeFileSync('.source-assets/blue/v4/build-gpt/closed-atlas.png', png);
await sharp(png).resize(2048, 2048).webp({ quality: 90 }).toFile('public/models/blue-v4-closed.webp');
console.log('closed webp bytes', fs.statSync('public/models/blue-v4-closed.webp').size);
