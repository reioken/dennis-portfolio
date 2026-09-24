// Pack every hall model for the web: dedup buffers, prune, resample animations, quantize and Meshopt-compress.
// Textures are capped separately by shrink-textures.mjs (run it first; it must not share a process with the
// functions bundle). Each file is rewritten in place after a structure
// check: node, mesh, material, animation and skin names must be unchanged, because the hall addresses controls,
// screens and glow parts by name. A file the pass would make larger is restored from the original. Originals are
// kept in .source-assets/models-original/ for rollback.
//   node scripts/models/shrink-textures.mjs && node scripts/models/pack-models.mjs [--dry] [--only <name>]
// --only packs one file: a full run rewrites every GLB byte-wise, and those names are edge-cached for a day.
// The hall does not load this output directly: gzip-models.mjs --only <name> turns it into <name>.glb.gz.
import { NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { readdir, stat, mkdir, copyFile } from 'node:fs/promises';
import { join, relative, dirname, basename } from 'node:path';

const ROOT = 'public/models', BACKUP = '.source-assets/models-original';
const dry = process.argv.includes('--dry');
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    // Kenney props are not loaded by the hall.
    if (entry.isDirectory()) { if (entry.name !== 'kenney') yield* walk(path); }
    else if (entry.name.endsWith('.glb')) yield path;
  }
}
const names = document => {
  const root = document.getRoot();
  return JSON.stringify({
    nodes: root.listNodes().map(n => n.getName()), meshes: root.listMeshes().map(m => m.getName()),
    materials: root.listMaterials().map(m => m.getName()), animations: root.listAnimations().map(a => a.getName()),
    skins: root.listSkins().map(s => s.listJoints().length),
  });
};
/** Quantization may wrap a shared mesh in one unnamed node; every authored name must survive in order. */
const sameShape = (before, after) => {
  const a = JSON.parse(before), b = JSON.parse(after);
  const nodesOk = JSON.stringify(b.nodes.filter(n => n !== '')) === JSON.stringify(a.nodes.filter(n => n !== '')) && b.nodes.length - a.nodes.length <= 1;
  return nodesOk && ['meshes', 'materials', 'animations', 'skins'].every(k => JSON.stringify(a[k]) === JSON.stringify(b[k]));
};
const differences = (a, b) => Object.keys(a).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k])).map(k => `${k}: ${JSON.stringify(a[k]).slice(0, 160)} -> ${JSON.stringify(b[k]).slice(0, 160)}`);

const rows = [];
for await (const file of walk(ROOT)) {
  if (only && basename(file) !== `${only}.glb`) continue;
  const before = (await stat(file)).size;
  const document = await io.read(file);
  const shape = names(document);
  // Meshopt-compressed input (a previous run) is decoded on read; the pass is idempotent.
  await document.transform(
    // Only duplicate buffers and images are merged; meshes, materials and empty leaf nodes are what the hall
    // addresses by name, so they stay exactly as authored.
    dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.TEXTURE] }),
    prune({ keepLeaves: true, keepAttributes: true, keepIndices: true }),
    resample({ tolerance: 1e-4 }),
  );
  await document.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  if (!sameShape(shape, names(document))) throw new Error(`${file}: structure changed by the pass; ${differences(JSON.parse(shape), JSON.parse(names(document))).join(' | ')}`);
  let after = before, note = '';
  if (!dry) {
    const backup = join(BACKUP, relative(ROOT, file));
    await mkdir(dirname(backup), { recursive: true });
    try { await stat(backup); } catch { await copyFile(file, backup); }
    await io.write(file, document);
    after = (await stat(file)).size;
    // Compare with the true original, not with a previous pack of the same file (the pass is rerun freely).
    const original = (await stat(backup)).size;
    if (after >= original) { await copyFile(backup, file); after = original; note = ' (original kept)'; }
  }
  rows.push({ file: relative(ROOT, file), before, after, note });
}
let totalBefore = 0, totalAfter = 0;
for (const { file, before, after, note } of rows.sort((a, b) => b.before - a.before)) {
  totalBefore += before; totalAfter += after;
  console.log(`${file.padEnd(32)} ${String(Math.round(before / 1024)).padStart(6)} KB -> ${String(Math.round(after / 1024)).padStart(6)} KB (${Math.round(100 * after / before)} %)${note}`);
}
console.log(`MODELS_PACKED ${rows.length} files ${Math.round(totalBefore / 1024)} KB -> ${Math.round(totalAfter / 1024)} KB`);
