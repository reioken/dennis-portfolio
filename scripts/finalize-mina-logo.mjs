import sharp from 'sharp';
import { copyFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const ash = path.join(
  process.env.USERPROFILE || '',
  '.cursor/projects/c-Users-denni-Projects-dennis-portfolio/assets/mina-logo-clean.png',
);

// Crop from case-study cover (authentic source)
await sharp(path.join(root, 'public/media/mina/cover.webp'))
  .extract({ left: 36, top: 172, width: 640, height: 390 })
  .resize({ width: 720 })
  .webp({ quality: 93 })
  .toFile(path.join(root, 'public/media/mina/logo-from-slide.webp'));

// Clean reconstruction on soft plate (readable on dark cards)
const mark = await sharp(ash).resize({ width: 700, withoutEnlargement: true }).ensureAlpha().png().toBuffer();
const meta = await sharp(mark).metadata();
const padX = 48;
const padY = 36;
const w = meta.width + padX * 2;
const h = meta.height + padY * 2;
const plate = Buffer.from(
  `<svg width="${w}" height="${h}"><rect x="0" y="0" width="${w}" height="${h}" rx="28" fill="#f7f7f5"/></svg>`,
);
await sharp(plate)
  .composite([{ input: mark, left: padX, top: padY }])
  .webp({ quality: 92 })
  .toFile(path.join(root, 'public/media/mina/logo.webp'));

await sharp(path.join(root, 'public/media/mina/logo.webp'))
  .png()
  .toFile(path.join(root, 'public/media/_tmp/mina_final.png'));

console.log('mina logo finalized');
