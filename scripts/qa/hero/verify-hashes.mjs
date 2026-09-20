// Checks every "/asset?v=<sha>" cache-buster in the hall sources against the file on disk.
// usage: node scripts/qa/hero/verify-hashes.mjs   (exits 1 on any mismatch or missing file)
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(fileURLToPath(import.meta.url), '../../../..');
const files = [
  'src/components/hall/hallScene.ts',
  'src/components/hall/hallLayout.ts',
  'src/components/hall/heroMaterial.ts',
  'src/components/hall/blueCat.ts',
  'src/components/hall/hardwareWear.ts',
  'src/components/hall/floorReflectionShader.ts',
];
let bad = 0, ok = 0, missing = 0;
for (const f of files) {
  const p = path.join(ROOT, f);
  if (!existsSync(p)) continue;
  const src = readFileSync(p, 'utf8');
  const re = /['"`](\/[^'"`\s?]+\.(?:glb|webp|avif|png|jpg|ktx2|bin|bin\.gz|json))\?v=([0-9a-f]{6,})['"`]/g;
  let m;
  while ((m = re.exec(src))) {
    const [, url, v] = m;
    const disk = path.join(ROOT, 'public', url.replace(/^\//, ''));
    if (!existsSync(disk)) { console.log(`MISSING FILE ${f}: ${url}`); missing++; continue; }
    const sha = createHash('sha256').update(readFileSync(disk)).digest('hex').slice(0, v.length);
    if (sha !== v) { console.log(`MISMATCH ${f}: ${url}?v=${v}  actual=${sha}`); bad++; }
    else ok++;
  }
}
// also catch template-literal / concatenated forms
for (const f of files) {
  const p = path.join(ROOT, f);
  if (!existsSync(p)) continue;
  const src = readFileSync(p, 'utf8');
  for (const m of src.matchAll(/\?v=([0-9a-f]{6,})/g)) {
    const line = src.slice(src.lastIndexOf('\n', m.index) + 1, src.indexOf('\n', m.index));
    if (!/\/[\w./-]+\.(glb|webp|avif|png|jpg|ktx2|bin|gz|json)\?v=/.test(line)) console.log(`UNCHECKED ${f}: ${line.trim().slice(0, 140)}`);
  }
}
console.log(`\nchecked ok=${ok} mismatch=${bad} missingFile=${missing}`);
process.exit(bad + missing ? 1 : 0);
