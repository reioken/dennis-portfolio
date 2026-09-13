import sharp from 'sharp';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

/**
 * Generate small `@sm.webp` variants for every product shot under
 * public/media/<project>/shots/. Used by the hero collage (and anywhere else
 * shots render well below their intrinsic size) via srcset.
 */
const MEDIA = path.resolve('public/media');
const SM_WIDTH = 720; // desktop-shot display width tops out around 360px CSS → 720 covers 2x small screens
const QUALITY = 74;

async function main() {
  const projects = await readdir(MEDIA, { withFileTypes: true });
  let count = 0;
  for (const proj of projects) {
    if (!proj.isDirectory()) continue;
    // shots/ is the usual place; lowlight keeps its captures under screens/ (three 430–455 KB files that the hall
    // otherwise loads full-size as screen textures)
    for (const sub of ['shots', 'screens']) {
    const shotsDir = path.join(MEDIA, proj.name, sub);
    let files;
    try {
      files = await readdir(shotsDir);
    } catch {
      continue;
    }
    for (const file of files) {
      if (!/\.webp$/i.test(file)) continue;
      if (/@(2x|sm)\.webp$/i.test(file)) continue;
      const src = path.join(shotsDir, file);
      const out = path.join(shotsDir, file.replace(/\.webp$/i, '@sm.webp'));
      // Existing thumbs are left alone (re-encoding them only churns the repository).
      try { await stat(out); continue; } catch {}
      const img = sharp(src, { failOn: 'none' });
      const meta = await img.metadata();
      // Always emit an @sm file so srcset references never 404 — small sources
      // are just re-encoded at their native width.
      const width = meta.width && meta.width > SM_WIDTH ? SM_WIDTH : undefined;
      await img
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: QUALITY, effort: 5 })
        .toFile(out);
      const before = (await stat(src)).size;
      const after = (await stat(out)).size;
      console.log(
        `${proj.name}/${sub}/${path.basename(out)}  ${(before / 1024).toFixed(0)}KB → ${(after / 1024).toFixed(0)}KB`,
      );
      count++;
    }
    }
  }
  // Case covers live wherever the content points (project root, shots/, jpg): the cards want a 720 px source too.
  const { readFile } = await import('node:fs/promises');
  const workDir = path.resolve('src/content/work');
  for (const entry of await readdir(workDir)) {
    if (!entry.endsWith('.mdx')) continue;
    const text = await readFile(path.join(workDir, entry), 'utf8');
    const m = text.match(/^cover:\s*"([^"]+)"/m);
    if (!m || !/\.(webp|jpe?g)$/i.test(m[1])) continue;
    const src = path.resolve('public', m[1].replace(/^\//, ''));
    const out = src.replace(/\.(webp|jpe?g)$/i, '@sm.webp');
    try { await stat(out); continue; } catch {}
    try { await stat(src); } catch { continue; }
    const img = sharp(src, { failOn: 'none' });
    const meta = await img.metadata();
    await img.resize({ width: meta.width && meta.width > SM_WIDTH ? SM_WIDTH : undefined, withoutEnlargement: true }).webp({ quality: QUALITY, effort: 5 }).toFile(out);
    console.log(`${m[1]} → ${path.basename(out)}  ${((await stat(src)).size / 1024).toFixed(0)}KB → ${((await stat(out)).size / 1024).toFixed(0)}KB`);
    count++;
  }
  console.log(`done. ${count} @sm variants written`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
