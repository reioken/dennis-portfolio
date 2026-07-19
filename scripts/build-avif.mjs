import sharp from 'sharp';
import { readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Erzeugt .avif-Geschwister für alle WebP/JPEG unter public/media.
 * Die Komponenten hängen per <picture><source type="image/avif"> davor —
 * deshalb muss für JEDES referenzierte Bild ein AVIF existieren
 * (Browser fallen bei 404 einer gewählten Source nicht aufs img zurück).
 * Bereits vorhandene AVIFs werden übersprungen → schnelle Re-Runs.
 */
const ROOT = path.resolve('public/media');
const QUALITY = 55;

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(abs)));
    else if (/\.(webp|jpe?g)$/i.test(entry.name)) out.push(abs);
  }
  return out;
}

async function main() {
  const files = await walk(ROOT);
  let made = 0;
  let skipped = 0;
  let savedKB = 0;

  for (const src of files) {
    const out = src.replace(/\.(webp|jpe?g)$/i, '.avif');
    if (existsSync(out)) {
      skipped++;
      continue;
    }
    await sharp(src, { failOn: 'none' }).avif({ quality: QUALITY, effort: 4 }).toFile(out);
    const before = (await stat(src)).size;
    const after = (await stat(out)).size;
    savedKB += Math.max(0, before - after) / 1024;
    made++;
  }

  console.log(`[avif] ${made} erzeugt, ${skipped} übersprungen, ~${Math.round(savedKB)} KB kleiner als die Quellen`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
