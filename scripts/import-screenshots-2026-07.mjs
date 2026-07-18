/**
 * Import curated screenshots (screenshots-2026-07) → public/media as webp,
 * refresh product logos from app directories.
 */
import sharp from 'sharp';
import { copyFile, mkdir, readdir, access } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const shotRoot = path.join(root, 'public', 'media', 'screenshots-2026-07');
const media = (...p) => path.join(root, 'public', 'media', ...p);

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function toWebp(src, dest, { maxW, quality = 82 } = {}) {
  await mkdir(path.dirname(dest), { recursive: true });
  const img = sharp(src, { failOn: 'none' }).rotate();
  const meta = await img.metadata();
  const width = meta.width && maxW && meta.width > maxW ? maxW : undefined;
  await img
    .resize(width ? { width, withoutEnlargement: true } : undefined)
    .webp({ quality, effort: 4 })
    .toFile(dest);
}

async function toWebpKeyed(src, dest, { maxW = 512, thr = 18 } = {}) {
  await mkdir(path.dirname(dest), { recursive: true });
  let pipeline = sharp(src).rotate().ensureAlpha();
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    if (lum <= thr) data[i + 3] = 0;
    else if (lum < thr + 28) data[i + 3] = Math.round(((lum - thr) / 28) * data[i + 3]);
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .resize({ width: maxW, withoutEnlargement: true })
    .webp({ quality: 90, alphaQuality: 95, effort: 4 })
    .toFile(dest);
}

/** src basename → dest stem (without extension). Skip duplicates / junk. */
const MAP = {
  berry: {
    '01-home.png': 'screen-home',
    '02-search.png': 'screen-search',
    '03-collection.png': 'screen-collection',
    '04-decks-meta.png': 'screen-decks-meta',
    '05-deck-editor.png': 'screen-deck-editor',
    '06-insights.png': 'screen-insights',
    '07-tournaments.png': 'screen-tournaments',
  },
  nexus: {
    '01-home.png': 'screen-home',
    '02-grid.png': 'screen-grid',
    '03-showcase.png': 'screen-showcase',
    '04-coverflow.png': 'screen-coverflow',
    '05-couch.png': 'screen-couch',
    '06-toplists.png': 'screen-toplists',
    '07-wrapped.png': 'screen-wrapped',
    '08-cmdk.png': 'screen-cmdk',
    'blizz.png': 'screen-blizzard',
    'bulk.png': 'screen-bulk',
    'couchfeat.png': 'screen-couch-featured',
    'dice.png': 'screen-dice',
    'heatmap.png': 'screen-heatmap',
    'onboard.png': 'screen-onboard',
    'Screenshot 2026-07-18 205816.png': 'screen-home-featured',
    // top.png == 06-toplists (sha1 match) — skip
  },
  floordirekt: {
    '01-start.png': 'screen-start',
    '02-bilder.png': 'screen-bilder',
    '03-layout-export.png': 'screen-layout-export',
    '04-sprachen.png': 'screen-sprachen',
    '05-pruefen.png': 'screen-pruefen',
    '06-fertig.png': 'screen-fertig',
  },
  riftcast: {
    '01-launcher-home.png': 'screen-launcher',
    '02-launcher-remote.png': 'screen-launcher-remote',
    '03-desktop-live.png': 'screen-desktop',
    '04-desktop-controls.png': 'screen-desktop-controls',
    '05-mobile-controls.png': 'screen-app',
    '06-mobile-quality.png': 'screen-quality',
    '07-pad-shooter.png': 'screen-pad',
  },
};

const MAX_W = {
  berry: { std: 900, hi: 1200 },
  nexus: { std: 1600, hi: 2400 },
  floordirekt: { std: 1600, hi: 2200 },
  riftcast: { std: 1400, hi: 2000 },
};

let imported = 0;
for (const [project, files] of Object.entries(MAP)) {
  const dir = path.join(shotRoot, project);
  const limits = MAX_W[project];
  for (const [srcName, stem] of Object.entries(files)) {
    const src = path.join(dir, srcName);
    if (!(await exists(src))) {
      console.warn('missing', project, srcName);
      continue;
    }
    const dest = media(project, `${stem}.webp`);
    const destHi = media(project, `${stem}@2x.webp`);
    await toWebp(src, dest, { maxW: limits.std, quality: 82 });
    await toWebp(src, destHi, { maxW: limits.hi, quality: 84 });
    console.log('ok', `${project}/${stem}.webp`);
    imported++;
  }
}

// Cover aliases
const aliases = [
  ['nexus/screen-home.webp', 'nexus/hero.webp'],
  ['berry/screen-home.webp', 'berry/hero.webp'],
  ['riftcast/screen-desktop.webp', 'riftcast/cover.webp'],
  ['floordirekt/screen-pruefen.webp', 'floordirekt/cover.webp'],
];
for (const [from, to] of aliases) {
  const a = media(...from.split('/'));
  const b = media(...to.split('/'));
  if (await exists(a)) {
    await copyFile(a, b);
    console.log('cover', to, '←', from);
  }
}

// Logos from app directories (current)
const berryIcon = 'C:/Users/denni/Documents/Berry/public/icons/icon-512.png';
if (await exists(berryIcon)) {
  await copyFile(berryIcon, media('berry', 'logo.png'));
  await toWebpKeyed(berryIcon, media('berry', 'logo.webp'), { maxW: 512, thr: 18 });
  console.log('logo berry');
}

const nexusLogoSvg = 'C:/Users/denni/Documents/NEXUS/assets/logo.svg';
const nexusLogoPng = 'C:/Users/denni/Documents/NEXUS/assets/logo-256.png';
const nexusLive = 'C:/Users/denni/Documents/riftcast/site/nexus/img/mark-live.svg';
if (await exists(nexusLogoSvg)) {
  await copyFile(nexusLogoSvg, media('nexus', 'logo.svg'));
  console.log('logo nexus.svg');
}
if (await exists(nexusLive)) {
  await copyFile(nexusLive, media('nexus', 'logo-live.svg'));
  console.log('logo nexus-live.svg');
}
if (await exists(nexusLogoPng)) {
  await copyFile(nexusLogoPng, media('nexus', 'logo.png'));
  await toWebpKeyed(nexusLogoPng, media('nexus', 'logo.webp'), { maxW: 512, thr: 12 });
  console.log('logo nexus.webp');
}

const riftMarkSvg = 'C:/Users/denni/Documents/riftcast/desktop/public/icons/mark.svg';
const riftMarkPng = 'C:/Users/denni/Documents/riftcast/desktop/public/icons/mark-512.png';
if (await exists(riftMarkSvg)) {
  await copyFile(riftMarkSvg, media('riftcast', 'logo.svg'));
  console.log('logo riftcast.svg');
}
if (await exists(riftMarkPng)) {
  await copyFile(riftMarkPng, media('riftcast', 'logo.png'));
  await toWebpKeyed(riftMarkPng, media('riftcast', 'logo.webp'), { maxW: 512, thr: 12 });
  console.log('logo riftcast.webp');
}

const fdStudio = 'C:/Users/denni/Documents/Floordirekt/fd-pipeline/assets/floordirekt-studio-icon.png';
if (await exists(fdStudio)) {
  await copyFile(fdStudio, media('floordirekt', 'logo.png'));
  // Keep rounded icon as-is (no keying — red plate is brand)
  await toWebp(fdStudio, media('floordirekt', 'logo.webp'), { maxW: 512, quality: 90 });
  console.log('logo floordirekt studio');
}

console.log(`done: ${imported} screens imported`);
