// Fetches every hall model/texture URL from a deployment and compares the bytes with public/ on disk.
// usage: node scripts/qa/hero/live-assets.mjs <base-url>   (BAD lines = stale or broken on the server)
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(fileURLToPath(import.meta.url), '../../../..');
const BASE = process.argv[2];
if (!BASE) { console.error('usage: node scripts/qa/hero/live-assets.mjs <base-url>'); process.exit(2); }
const src = readFileSync(path.join(ROOT, 'src/components/hall/hallScene.ts'), 'utf8');
const urls = new Set();
for (const m of src.matchAll(/['"`](\/(?:models|textures)\/[^'"`\s]+?)(\?v=[0-9a-f]+)?['"`]/g)) urls.add(m[1] + (m[2] ?? ''));
// hall-light + hero texture sets built from templates
const extra = [
  '/models/dennis.glb',
  '/models/phone-booth-v1.glb', '/models/tv-rig-v1.glb', '/models/claw-v2.glb',
];
for (const s of ['floor', 'wall']) for (const k of ['bounce', 'contact']) extra.push(`/textures/hall-light/${s}-${k}-v1.webp`);
for (const b of ['floor/concrete-v2', 'wall/brick-v2']) for (const n of ['basecolor', 'normal', 'orm']) extra.push(`/textures/${b}_${n}.webp`);
for (const f of ['powdercoat-v1', 'plastic-v1', 'steel-v1', 'brushed-v1']) for (const n of ['normal', 'orm']) extra.push(`/textures/hardware/${f}-${n}.webp`);
for (const f of readdirSync(path.join(ROOT, 'public/textures/hardware'))) extra.push('/textures/hardware/' + f);
for (const f of readdirSync(path.join(ROOT, 'public/models')).filter(f => /^(mach-|cab-)/.test(f))) extra.push('/models/' + f);
extra.push('/textures/hero-environment-v1.bin.gz');
for (const e of extra) if (![...urls].some(u => u.split('?')[0] === e)) urls.add(e);
let bad = 0, ok = 0, skip = 0;
const list = [...urls].sort();
for (const u of list) {
  const disk = path.join(ROOT, 'public', u.split('?')[0].replace(/^\//, ''));
  if (!existsSync(disk) || !statSync(disk).isFile()) { console.log(`SKIP ${u}`); skip++; continue; }
  const local = readFileSync(disk);
  const r = await fetch(BASE + u, { headers: { 'accept-encoding': 'identity' } });
  const buf = Buffer.from(await r.arrayBuffer());
  const same = buf.length === local.length && createHash('sha256').update(buf).digest('hex') === createHash('sha256').update(local).digest('hex');
  if (r.status !== 200 || !same) { console.log(`BAD  ${r.status} ${u}  served=${buf.length} local=${local.length}`); bad++; }
  else ok++;
}
console.log(`\n${list.length} urls: ok=${ok} bad=${bad} skipped=${skip}`);
