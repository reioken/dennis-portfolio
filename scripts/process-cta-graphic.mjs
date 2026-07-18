/**
 * Key out near-black background → transparent WebP for CTA visual.
 */
import sharp from 'sharp';
import path from 'node:path';
import { copyFile } from 'node:fs/promises';

const root = path.resolve(import.meta.dirname, '..');
const src =
  process.argv[2] ||
  path.join(
    process.env.USERPROFILE || '',
    '.cursor/projects/c-Users-denni-Projects-dennis-portfolio/assets/cta-graphic-raw2.png',
  );
const outPng = path.join(root, 'public/media/cta/cta-graphic.png');
const outWebp = path.join(root, 'public/media/cta/cta-graphic.webp');

const { data, info } = await sharp(src)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const thr = 28; // near-black → transparent
const soft = 48; // feather band
for (let i = 0; i < data.length; i += 4) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (lum <= thr) {
    data[i + 3] = 0;
  } else if (lum < soft) {
    data[i + 3] = Math.round(((lum - thr) / (soft - thr)) * 255);
  }
}

await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
  .png()
  .toFile(outPng);

await sharp(outPng)
  .resize({ width: 1600, withoutEnlargement: true })
  .webp({ quality: 88, alphaQuality: 90, effort: 4 })
  .toFile(outWebp);

console.log('wrote', outWebp);
