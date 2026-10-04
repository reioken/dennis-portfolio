import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

// Encode the owner's original marketing captures without recomposition or overlays.
const source = process.argv[2];
const sideArt = process.argv[3];
if (!source || !sideArt) throw new Error('Usage: node scripts/assets/ishikiri-media.mjs MARKETING_PACK SIDE_ART_PNG');
const shots = {
  title: '01-brand/ishikiri-key-art.png',
  carving: '00-featured/02-carving-action-1.png',
  'ushi-oni': '00-featured/03-ushi_oni-cut-2.png',
  ryujin: '00-featured/04-ryujin-encounter.png',
  'festival-stall': '00-featured/05-festival_stall-cut-1.png',
  companions: '00-featured/10-choose-companions.png',
  journey: '00-featured/12-map-stop-1.png',
  forge: '00-featured/14-forge.png',
  minerals: '00-featured/15-mineral-cabinet.png',
};
const out = 'public/media/ishikiri';
await mkdir(`${out}/shots`, { recursive: true });
const provenance = [];
for (const [name, relative] of Object.entries(shots)) {
  const input = await readFile(path.join(source, relative));
  for (const [suffix, width] of [['', 1920], ['@sm', 720]]) {
    const image = sharp(input).resize({ width, withoutEnlargement: true });
    await image.clone().webp({ quality: suffix ? 80 : 88 }).toFile(`${out}/shots/${name}${suffix}.webp`);
    await image.clone().avif({ quality: suffix ? 54 : 65, effort: 5 }).toFile(`${out}/shots/${name}${suffix}.avif`);
  }
  provenance.push({ name, source: relative, sha256: createHash('sha256').update(input).digest('hex') });
}
await sharp(path.join(source, '01-brand/ishikiri-logo-paper.png')).resize({width:1024}).webp({quality:90}).toFile(`${out}/logo.webp`);
await sharp(sideArt).resize(768,1152,{fit:'cover'}).webp({quality:90}).toFile('public/textures/cabinet-art/quiet-v2/ishikiri.webp');
await writeFile('scripts/assets/ishikiri-media.json', JSON.stringify({ pack: 'Ishikiri marketing pack 2026-10-04', captures: provenance }, null, 2)+'\n');
console.log(`Encoded ${provenance.length} original captures, logo and side art.`);
