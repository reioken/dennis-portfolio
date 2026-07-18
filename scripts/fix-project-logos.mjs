/**
 * Install correct project logos into public/media.
 */
import sharp from 'sharp';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const media = (...p) => path.join(root, 'public', 'media', ...p);

async function toWebp(src, dest, { maxW = 900, keyBlack = false, thr = 24 } = {}) {
  await mkdir(path.dirname(dest), { recursive: true });
  let pipeline = sharp(src).rotate().ensureAlpha();
  if (keyBlack) {
    const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += 4) {
      const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      if (lum <= thr) data[i + 3] = 0;
      else if (lum < thr + 28) data[i + 3] = Math.round(((lum - thr) / 28) * data[i + 3]);
    }
    pipeline = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
  }
  await pipeline
    .resize({ width: maxW, withoutEnlargement: true })
    .webp({ quality: 90, alphaQuality: 95, effort: 4 })
    .toFile(dest);
  console.log('webp', path.relative(root, dest));
}

// 1) Berry mascot (app icon)
await toWebp(
  'C:/Users/denni/Documents/Berry/public/icons/icon-512.png',
  media('berry', 'logo.webp'),
  { maxW: 512, keyBlack: true, thr: 18 },
);
await copyFile(
  'C:/Users/denni/Documents/Berry/public/icons/icon-512.png',
  media('berry', 'logo.png'),
);

// 2) Riftcast R mark
await copyFile(
  'C:/Users/denni/Documents/riftcast/desktop/public/icons/mark.svg',
  media('riftcast', 'logo.svg'),
);
await toWebp(
  'C:/Users/denni/Documents/riftcast/desktop/public/icons/mark-512.png',
  media('riftcast', 'logo.webp'),
  { maxW: 512, keyBlack: true, thr: 12 },
);

// 3) Mina — crop logo from cover (left wordmark area)
const minaCover = media('mina', 'cover.webp');
const minaTmp = media('mina', '_logo-crop.png');
await sharp(minaCover)
  .extract({ left: 48, top: 168, width: 480, height: 340 })
  .ensureAlpha()
  .png()
  .toFile(minaTmp);
{
  const { data, info } = await sharp(minaTmp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    if (r > 245 && g > 245 && b > 245) data[i + 3] = 0;
    else if (r > 230 && g > 230 && b > 230)
      data[i + 3] = Math.round(((255 - (r + g + b) / 3) / 25) * 255);
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .webp({ quality: 92, alphaQuality: 95 })
    .toFile(media('mina', 'logo.webp'));
  console.log('webp mina/logo.webp (cropped)');
}

// 4) Forever white wordmark — strip black plate
await toWebp(media('forever', 'logo-white.png'), media('forever', 'logo.webp'), {
  maxW: 900,
  keyBlack: true,
  thr: 20,
});
await copyFile(media('forever', 'logo-white.png'), media('forever', 'logo.png'));

// 5) SportMüller — strip black plate (keeps orange + white)
await toWebp(media('sportmueller', 'logo-head.png'), media('sportmueller', 'logo.webp'), {
  maxW: 1000,
  keyBlack: true,
  thr: 18,
});
await copyFile(media('sportmueller', 'logo-head.png'), media('sportmueller', 'logo.png'));

// 6) Ashwake — key black from AI mark
const ashSrc =
  process.env.USERPROFILE +
  '/.cursor/projects/c-Users-denni-Projects-dennis-portfolio/assets/ashwake-logo-raw.png';
await toWebp(ashSrc, media('ashwake', 'logo.webp'), { maxW: 900, keyBlack: true, thr: 16 });

// 7) Web Designs — collage of 4 client covers (no fake wordmark)
const webCovers = [
  media('websites', 'gecam-cover.webp'),
  media('websites', 'leonardo-cover.webp'),
  media('websites', 'aak-cover.webp'),
  media('websites', 'bouche-cover.webp'),
];
const cell = 420;
const gap = 16;
const canvas = cell * 2 + gap;
const tiles = await Promise.all(
  webCovers.map((src) =>
    sharp(src)
      .resize(cell, Math.round(cell * 0.62), { fit: 'cover', position: 'top' })
      .png()
      .toBuffer(),
  ),
);
await sharp({
  create: {
    width: canvas,
    height: Math.round(cell * 0.62) * 2 + gap,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([
    { input: tiles[0], top: 0, left: 0 },
    { input: tiles[1], top: 0, left: cell + gap },
    { input: tiles[2], top: Math.round(cell * 0.62) + gap, left: 0 },
    { input: tiles[3], top: Math.round(cell * 0.62) + gap, left: cell + gap },
  ])
  .webp({ quality: 86 })
  .toFile(media('websites', 'logo.webp'));
console.log('webp websites/logo.webp (collage)');

console.log('done');
