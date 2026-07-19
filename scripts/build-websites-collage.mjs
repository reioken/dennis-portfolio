import sharp from 'sharp';
import path from 'node:path';

const dir = path.resolve('public/media/websites');
const files = [
  'gecam-cover.webp',
  'leonardo-cover.webp',
  'aak-cover.webp',
  'bouche-cover.webp',
];

const W = 1600;
const H = 900;
const marginX = 56;
const gap = 16;
const cardW = Math.floor((W - marginX * 2 - gap * (files.length - 1)) / files.length);
const cardH = Math.round(cardW * (875 / 1400));
const totalW = files.length * cardW + (files.length - 1) * gap;
const startX = Math.round((W - totalW) / 2);
const startY = Math.round((H - cardH) / 2);
const radius = 14;

const bg = await sharp({
  create: {
    width: W,
    height: H,
    channels: 3,
    background: { r: 10, g: 12, b: 20 },
  },
})
  .png()
  .toBuffer();

const glowSvg = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="g" cx="50%" cy="48%" r="52%">
      <stop offset="0%" stop-color="#4a82fe" stop-opacity="0.2"/>
      <stop offset="50%" stop-color="#ac8bfd" stop-opacity="0.09"/>
      <stop offset="100%" stop-color="#0a0c14" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
</svg>`);

const composites = [{ input: glowSvg, top: 0, left: 0 }];

for (let i = 0; i < files.length; i++) {
  const x = startX + i * (cardW + gap);
  const y = startY + (i % 2 === 0 ? -8 : 10);

  const resized = await sharp(path.join(dir, files[i]))
    .resize(cardW, cardH, { fit: 'cover', position: 'top' })
    .png()
    .toBuffer();

  const mask = Buffer.from(`
<svg width="${cardW}" height="${cardH}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${cardW}" height="${cardH}" rx="${radius}" ry="${radius}" fill="#fff"/>
</svg>`);

  const rounded = await sharp(resized)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  const shadow = await sharp({
    create: {
      width: cardW + 20,
      height: cardH + 24,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: Buffer.from(`
<svg width="${cardW + 20}" height="${cardH + 24}" xmlns="http://www.w3.org/2000/svg">
  <rect x="6" y="8" width="${cardW}" height="${cardH}" rx="${radius}" fill="black" opacity="0.5"/>
</svg>`),
      },
    ])
    .blur(9)
    .png()
    .toBuffer();

  const stroke = Buffer.from(`
<svg width="${cardW}" height="${cardH}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0.75" y="0.75" width="${cardW - 1.5}" height="${cardH - 1.5}" rx="${radius}"
    fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
</svg>`);

  composites.push({ input: shadow, left: x - 3, top: y - 1 });
  composites.push({ input: rounded, left: x, top: y });
  composites.push({ input: stroke, left: x, top: y });
}

const composed = await sharp(bg).composite(composites).png().toBuffer();

await sharp(composed).webp({ quality: 86 }).toFile(path.join(dir, 'logo.webp'));
await sharp(composed).avif({ quality: 68 }).toFile(path.join(dir, 'logo.avif'));
await sharp(composed)
  .resize(1400, 875, { fit: 'cover' })
  .webp({ quality: 86 })
  .toFile(path.join(dir, 'collage-cover.webp'));
await sharp(composed)
  .resize(1400, 875, { fit: 'cover' })
  .avif({ quality: 68 })
  .toFile(path.join(dir, 'collage-cover.avif'));

console.log('[websites-collage]', { cardW, cardH, count: files.length });
