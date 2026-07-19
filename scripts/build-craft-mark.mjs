/**
 * Rasterize the clean Logos & Concepts mark (transparent, centered).
 */
import sharp from 'sharp';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

const dir = path.resolve('public/media/craft');
const svg = await readFile(path.join(dir, 'logo.svg'));

const size = 800;
const rendered = await sharp(svg)
  .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .ensureAlpha()
  .png()
  .toBuffer();

await sharp(rendered).webp({ quality: 92, alphaQuality: 100 }).toFile(path.join(dir, 'mark.webp'));
await sharp(rendered).avif({ quality: 72 }).toFile(path.join(dir, 'mark.avif'));
await sharp(rendered).png().toFile(path.join(dir, 'mark.png'));
// Keep logo.webp in sync (legacy refs / cache siblings)
await sharp(rendered).webp({ quality: 92, alphaQuality: 100 }).toFile(path.join(dir, 'logo.webp'));
await sharp(rendered).avif({ quality: 72 }).toFile(path.join(dir, 'logo.avif'));

console.log('[craft-mark] wrote mark.webp / logo.webp', size);
