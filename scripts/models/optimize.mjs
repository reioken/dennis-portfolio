// Modell-Pipeline für die Spielhalle.
//
//   node scripts/models/optimize.mjs [--in <dir>] [--only <name>] [--size 1024] [--inspect]
//
// Nimmt GLB/glTF aus .source-assets/models-in/ (nicht im Git; Sketchfab-Downloads liegen dort),
// optimiert sie mit gltf-transform (dedup, prune, weld, Quantisierung, Texturen → WebP mit
// max. --size Pixeln) und schreibt public/models/<name>.glb. Kein Draco/meshopt, damit kein
// WASM-Decoder und keine CSP-Änderung nötig ist. `--inspect` listet Meshes/Materialien, damit
// wir den Bildschirm ("screen") und das Leuchtschild ("marquee") per Namen finden.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const IN = path.resolve(ROOT, opt('--in', '.source-assets/models-in'));
const OUT = path.join(ROOT, 'public', 'models');
const SIZE = Number(opt('--size', '1024'));
const ONLY = opt('--only', null);
const INSPECT = args.includes('--inspect');

if (!existsSync(IN)) {
  console.error(`[models] Eingang fehlt: ${IN}`);
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const gltfTransform = (...a) =>
  execFileSync('npx', ['gltf-transform', ...a], { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'], shell: process.platform === 'win32' }).toString();

/** Meshes/Materialien eines GLB aus dem JSON-Chunk lesen — reicht, um Namen zu finden */
function inspectGlb(file) {
  const b = readFileSync(file);
  const len = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + len).toString());
  const meshes = (json.meshes ?? []).map((m) => `${m.name ?? '?'}[${m.primitives.length}]`);
  const mats = (json.materials ?? []).map((m) => m.name ?? '?');
  const nodes = (json.nodes ?? []).filter((n) => n.mesh !== undefined).map((n) => n.name ?? '?');
  let tris = 0;
  for (const m of json.meshes ?? []) for (const p of m.primitives) if (p.indices !== undefined) tris += (json.accessors[p.indices].count || 0) / 3;
  return { meshes, mats, nodes, tris: Math.round(tris), textures: (json.images ?? []).length };
}

const inputs = [];
for (const e of readdirSync(IN, { withFileTypes: true })) {
  if (e.isDirectory()) {
    const g = readdirSync(path.join(IN, e.name)).find((f) => /\.(gltf|glb)$/i.test(f));
    if (g) inputs.push({ name: e.name, file: path.join(IN, e.name, g) });
  } else if (/\.(gltf|glb)$/i.test(e.name)) {
    inputs.push({ name: e.name.replace(/\.(gltf|glb)$/i, ''), file: path.join(IN, e.name) });
  }
}

for (const { name, file } of inputs) {
  if (ONLY && name !== ONLY) continue;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const out = path.join(OUT, `${slug}.glb`);
  const before = statSync(file).size;
  process.stdout.write(`[models] ${name} → ${path.relative(ROOT, out)} … `);
  gltfTransform('optimize', file, out, '--compress', 'quantize', '--texture-compress', 'webp', '--texture-size', String(SIZE), '--simplify', 'false', '--instance', 'false', '--flatten', 'false', '--join', 'false', '--palette', 'false');
  const after = statSync(out).size;
  console.log(`${(before / 1048576).toFixed(2)} MB → ${(after / 1048576).toFixed(2)} MB`);
  if (INSPECT) {
    const i = inspectGlb(out);
    console.log(`   tris ${i.tris} · textures ${i.textures}\n   nodes: ${i.nodes.join(', ')}\n   materials: ${i.mats.join(', ')}`);
  }
}
if (!inputs.length) console.log('[models] Keine Eingaben gefunden.');
