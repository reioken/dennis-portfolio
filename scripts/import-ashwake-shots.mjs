/**
 * Import Ashwake marketing screenshots into public/media/ashwake/shots.
 *
 *   node scripts/import-ashwake-shots.mjs
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const srcDir = path.resolve('..', 'Ashwake', 'marketing', 'screenshots');
const outDir = path.resolve('public', 'media', 'ashwake', 'shots');

const files = [
  '01_camp_brand',
  '02_forge_ember_defense',
  '03_draft_cards',
  '04_phase_gate_bank_push',
  '05_vigil_night',
  '06_siege_hold_the_ember',
  '07_boss_encounter',
  '08_pause_build',
  '09_accessibility_settings',
  '10_results_victory',
  '11_ability_fork',
];

await mkdir(outDir, { recursive: true });

for (const stem of files) {
  const src = path.join(srcDir, `${stem}.png`);
  const base = await sharp(src).rotate().resize({ width: 1600, withoutEnlargement: true }).toBuffer();
  await sharp(base).webp({ quality: 82, effort: 5 }).toFile(path.join(outDir, `${stem}.webp`));
  await sharp(base).avif({ quality: 62 }).toFile(path.join(outDir, `${stem}.avif`));
  const meta = await sharp(src).metadata();
  if ((meta.width || 0) >= 1800) {
    const hi = await sharp(src).rotate().resize({ width: 1920, withoutEnlargement: true }).toBuffer();
    await sharp(hi).webp({ quality: 80, effort: 4 }).toFile(path.join(outDir, `${stem}@2x.webp`));
    await sharp(hi).avif({ quality: 60 }).toFile(path.join(outDir, `${stem}@2x.avif`));
  }
  console.log('ok', stem);
}

// Case cover — forge shot (core loop)
await sharp(path.join(srcDir, '02_forge_ember_defense.png'))
  .rotate()
  .resize({ width: 1600, withoutEnlargement: true })
  .webp({ quality: 84, effort: 5 })
  .toFile(path.resolve('public', 'media', 'ashwake', 'cover.webp'));
await sharp(path.join(srcDir, '02_forge_ember_defense.png'))
  .rotate()
  .resize({ width: 1600, withoutEnlargement: true })
  .avif({ quality: 64 })
  .toFile(path.resolve('public', 'media', 'ashwake', 'cover.avif'));

console.log('done — cover.webp from forge shot');
