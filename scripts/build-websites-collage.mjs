/**
 * Website Designs fallback mark — stacked newer client work.
 */
import sharp from 'sharp';
import path from 'node:path';

const root = path.resolve('public/media');
const picks = [
  path.join(root, 'websites', 'baufinanz-cover.webp'),
  path.join(root, 'websites', 'willi-alt-cover.webp'),
  path.join(root, 'websites', 'ig-seidel-cover.webp'),
  path.join(root, 'sportmueller', 'category-1.webp'),
];

const W = 1200;
const H = 900;
const cardW = 520;
const cardH = Math.round(cardW * 0.62);
const radius = 16;
const outDir = path.join(root, 'websites');

const bg = await sharp({
  create: {
    width: W,
    height: H,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .png()
  .toBuffer();

const layouts = [
  { x: 180, y: 220, rot: -10, scale: 0.9 },
  { x: 280, y: 180, rot: -4, scale: 0.94 },
  { x: 380, y: 140, rot: 3, scale: 0.97 },
  { x: 470, y: 100, rot: 8, scale: 1 },
];

const composites = [];

for (let i = 0; i < picks.length; i++) {
  const { x, y, rot, scale } = layouts[i];
  const w = Math.round(cardW * scale);
  const h = Math.round(cardH * scale);

  const resized = await sharp(picks[i])
    .resize(w, h, { fit: 'cover', position: 'top' })
    .png()
    .toBuffer();

  const mask = Buffer.from(`
<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${w}" height="${h}" rx="${radius}" ry="${radius}" fill="#fff"/>
</svg>`);

  const rounded = await sharp(resized)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  const stroke = Buffer.from(`
<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="${radius}"
    fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="2"/>
</svg>`);

  const framed = await sharp(rounded)
    .composite([{ input: stroke }])
    .png()
    .toBuffer();

  const pad = 80;
  const canvasW = w + pad * 2;
  const canvasH = h + pad * 2;
  const rotated = await sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: framed, left: pad, top: pad }])
    .png()
    .toBuffer()
    .then((buf) =>
      sharp(buf)
        .rotate(rot, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer(),
    );

  const meta = await sharp(rotated).metadata();
  composites.push({
    input: rotated,
    left: Math.round(x - (meta.width - w) / 2),
    top: Math.round(y - (meta.height - h) / 2),
  });
}

const composed = await sharp(bg).composite(composites).png().toBuffer();

for (const name of ['stack.webp', 'stack-v2.webp', 'logo.webp']) {
  await sharp(composed).webp({ quality: 88, alphaQuality: 95 }).toFile(path.join(outDir, name));
}
await sharp(composed).avif({ quality: 70 }).toFile(path.join(outDir, 'stack-v2.avif'));
await sharp(composed).avif({ quality: 70 }).toFile(path.join(outDir, 'stack.avif'));
await sharp(composed)
  .flatten({ background: { r: 12, g: 14, b: 22 } })
  .resize(1400, 875, { fit: 'cover' })
  .webp({ quality: 86 })
  .toFile(path.join(outDir, 'collage-cover.webp'));

console.log('[websites-stack]', { count: picks.length, out: 'stack-v2.webp' });
