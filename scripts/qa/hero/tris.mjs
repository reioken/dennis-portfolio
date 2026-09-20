// Triangle count and byte size of GLB files, one line each.
// usage: node scripts/qa/hero/tris.mjs <file.glb> [file.glb ...]   (uncompressed GLB only)
import { readFileSync, statSync } from 'node:fs';
if (process.argv.length < 3) { console.error('usage: node scripts/qa/hero/tris.mjs <file.glb> [file.glb ...]'); process.exit(2); }
for (const f of process.argv.slice(2)) {
  const buf = readFileSync(f);
  const jlen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jlen).toString('utf8'));
  let t = 0;
  for (const m of json.meshes ?? []) for (const p of m.primitives) {
    const a = json.accessors[p.indices ?? p.attributes.POSITION];
    t += a.count / 3;
  }
  console.log(`${f.split(/[\\/]/).pop().padEnd(28)} ${String(Math.round(t)).padStart(7)} tris  ${String(statSync(f).size).padStart(8)} B`);
}
