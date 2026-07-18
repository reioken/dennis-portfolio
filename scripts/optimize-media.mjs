import sharp from 'sharp';
import { mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve('public/media');

/** @type {{ dir: string; files?: string[]; maxW: number; quality: number }[]} */
const JOBS = [
  {
    dir: 'nexus',
    files: [
      'hero.png',
      'nexus_02_home-hero-modi.png',
      'nexus_04_bibliothek.png',
      'nexus_06_grid-ansicht.png',
      'nexus_08_detail-ansicht.png',
      'nexus_10_cover-flow.png',
      'nexus_11_showcase.png',
    ],
    maxW: 1400,
    quality: 78,
  },
  {
    dir: 'berry',
    files: ['hero.jpg', 'shot-2.jpg'],
    maxW: 1400,
    quality: 78,
  },
  {
    dir: 'mina',
    files: ['cover.jpg', 'mina-1.jpg', 'slide-1.jpg', 'slide-2.jpg', 'slide-3.jpg', 'slide-4.jpg'],
    maxW: 1400,
    quality: 78,
  },
  {
    dir: 'sportmueller',
    files: [
      'category-1.jpg',
      'product-1.jpg',
      'ad-helme-cover.png',
      'ad-helme-smith.png',
      'ad-ski-cover.png',
      'ad-ski-voelkl.png',
      'ad-ski-regional.png',
    ],
    maxW: 1400,
    quality: 78,
  },
  {
    dir: 'forever',
    files: [
      'banner-academy.png',
      'banner-iss.png',
      'product-fsnc-1.jpg',
      'product-fsnc-2.jpg',
    ],
    maxW: 1400,
    quality: 78,
  },
  {
    dir: 'floordirekt',
    files: ['cover.jpg', 'studio-lockup.png', 'logo.png'],
    maxW: 1400,
    quality: 80,
  },
  {
    dir: 'me',
    files: ['portrait.png', 'portrait-full.jpg'],
    maxW: 1200,
    quality: 80,
  },
];

async function optimizeOne(srcPath, outPath, maxW, quality) {
  const img = sharp(srcPath, { failOn: 'none' }).rotate();
  const meta = await img.metadata();
  const width = meta.width && meta.width > maxW ? maxW : undefined;
  await img
    .resize({ width, withoutEnlargement: true })
    .webp({ quality, effort: 5 })
    .toFile(outPath);
  const before = (await stat(srcPath)).size;
  const after = (await stat(outPath)).size;
  return { before, after };
}

async function main() {
  let saved = 0;
  for (const job of JOBS) {
    const dir = path.join(ROOT, job.dir);
    let names = job.files;
    if (!names) {
      names = (await readdir(dir)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f) && !f.includes('-web'));
    }
    for (const name of names) {
      const src = path.join(dir, name);
      try {
        await stat(src);
      } catch {
        console.log('skip missing', src);
        continue;
      }
      const base = name.replace(/\.(png|jpe?g|webp)$/i, '');
      const out = path.join(dir, `${base}.webp`);
      const { before, after } = await optimizeOne(src, out, job.maxW, job.quality);
      saved += Math.max(0, before - after);
      console.log(
        `${job.dir}/${base}.webp  ${(before / 1024).toFixed(0)}KB → ${(after / 1024).toFixed(0)}KB`,
      );
    }
  }
  console.log(`done. saved ~${(saved / 1024 / 1024).toFixed(1)} MB vs originals`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
