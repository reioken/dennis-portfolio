/**
 * Import latest product app screenshots into public/media as webp.
 */
import sharp from 'sharp';
import { mkdir, copyFile, access } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = (...parts) => path.join(root, 'public', 'media', ...parts);

const jobs = [
  // NEXUS — freshest full UI set (selected)
  {
    src: 'C:/Users/denni/Downloads/NEXUS-Screenshots/nexus_01_startseite-home.png',
    dest: ['nexus', 'screen-home.webp'],
  },
  {
    src: 'C:/Users/denni/Downloads/NEXUS-Screenshots/nexus_06_grid-ansicht.png',
    dest: ['nexus', 'screen-grid.webp'],
  },
  {
    src: 'C:/Users/denni/Downloads/NEXUS-Screenshots/nexus_04_bibliothek.png',
    dest: ['nexus', 'screen-library.webp'],
  },
  {
    src: 'C:/Users/denni/Downloads/NEXUS-Screenshots/nexus_10_cover-flow.png',
    dest: ['nexus', 'screen-coverflow.webp'],
  },
  // Berry — phone UI
  {
    src: 'C:/Users/denni/Documents/riftcast/site/lesen/berry/assets/screens/01-home.png',
    dest: ['berry', 'screen-home.webp'],
  },
  {
    src: 'C:/Users/denni/Documents/riftcast/site/lesen/berry/assets/screens/03-collection.png',
    dest: ['berry', 'screen-collection.webp'],
  },
  {
    src: 'C:/Users/denni/Documents/riftcast/site/lesen/berry/assets/screens/02-search.png',
    dest: ['berry', 'screen-search.webp'],
  },
  {
    src: 'C:/Users/denni/Documents/Berry/_audit/home.png',
    dest: ['berry', 'screen-home-live.webp'],
  },
  // Riftcast — product surfaces
  {
    src: 'C:/Users/denni/Documents/riftcast/site/shots/desktop.png',
    dest: ['riftcast', 'screen-desktop.webp'],
  },
  {
    src: 'C:/Users/denni/Documents/riftcast/site/shots/app.png',
    dest: ['riftcast', 'screen-app.webp'],
  },
  {
    src: 'C:/Users/denni/Documents/riftcast/site/shots/pad.png',
    dest: ['riftcast', 'screen-pad.webp'],
  },
  {
    src: 'C:/Users/denni/Documents/riftcast/site/shots/launcher.png',
    dest: ['riftcast', 'screen-launcher.webp'],
  },
];

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function toWebp(src, destPath, maxW = 1600) {
  await mkdir(path.dirname(destPath), { recursive: true });
  const img = sharp(src).rotate();
  const meta = await img.metadata();
  const width = meta.width && meta.width > maxW ? maxW : undefined;
  await img
    .resize(width ? { width, withoutEnlargement: true } : undefined)
    .webp({ quality: 82, effort: 4 })
    .toFile(destPath);
}

let ok = 0;
let skip = 0;
for (const job of jobs) {
  const destPath = out(...job.dest);
  if (!(await exists(job.src))) {
    console.warn('missing', job.src);
    skip++;
    continue;
  }
  await toWebp(job.src, destPath);
  console.log('ok', job.dest.join('/'));
  ok++;
}

// Also refresh hero covers from best screens (copy webp as cover aliases)
const aliases = [
  ['nexus/screen-home.webp', 'nexus/hero.webp'],
  ['berry/screen-home.webp', 'berry/hero.webp'],
  ['riftcast/screen-desktop.webp', 'riftcast/cover.webp'],
];
for (const [from, to] of aliases) {
  const a = out(...from.split('/'));
  const b = out(...to.split('/'));
  if (await exists(a)) {
    await copyFile(a, b);
    console.log('cover', to, '←', from);
  }
}

console.log(`done: ${ok} imported, ${skip} missing`);
