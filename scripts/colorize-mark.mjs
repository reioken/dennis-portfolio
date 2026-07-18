import sharp from 'sharp';
import { writeFileSync } from 'fs';

// Violet → blue → ice brand gradient over white mark alpha
const size = 256;
const { data, info } = await sharp('public/brand/mark-white.png')
  .resize(size, size)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const out = Buffer.alloc(size * size * 4);
for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    const a = data[i + 3];
    if (a < 8) {
      out[i + 3] = 0;
      continue;
    }
    // diagonal t 0..1
    const t = (x / (size - 1) + y / (size - 1)) / 2;
    // #ac8bfd → #4a82fe → #c8daf4
    let r, g, b;
    if (t < 0.5) {
      const u = t / 0.5;
      r = Math.round(0xac + (0x4a - 0xac) * u);
      g = Math.round(0x8b + (0x82 - 0x8b) * u);
      b = Math.round(0xfd + (0xfe - 0xfd) * u);
    } else {
      const u = (t - 0.5) / 0.5;
      r = Math.round(0x4a + (0xc8 - 0x4a) * u);
      g = Math.round(0x82 + (0xda - 0x82) * u);
      b = Math.round(0xfe + (0xf4 - 0xfe) * u);
    }
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
    out[i + 3] = a;
  }
}

await sharp(out, { raw: { width: size, height: size, channels: 4 } })
  .png()
  .toFile('public/brand/mark-gradient.png');

const fav = await sharp('public/brand/mark-gradient.png').resize(48, 48).png().toBuffer();
writeFileSync(
  'public/favicon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#07080c"/><image href="data:image/png;base64,${fav.toString('base64')}" x="8" y="8" width="48" height="48"/></svg>`,
);

await sharp('public/brand/mark-tile.png').resize(180, 180).png().toFile('public/apple-touch-icon.png');
console.log('gradient mark + favicon ready');
