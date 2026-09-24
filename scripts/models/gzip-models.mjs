// Web delivery of the hall's models: public/models/<name>.glb -> public/models/<name>.glb.gz
//   node scripts/models/gzip-models.mjs [--only <name>[,<name>...]] [--alpha-quality 75] [--level medium] [--out <dir>] [--dry]
// <name> is relative to public/models without the extension (claw-v2, plush/whale-v1). Without --only, every
// model the hall sources reference as `.glb.gz` is rebuilt. --out writes the .gz files elsewhere (A/B variants).
//
// Cloudflare Pages does not compress model/gltf-binary, so the GLBs went out raw. Per model, on top of
// pack-models.mjs's output (which stays in place as the rollback copy):
//   1. hero_mask (the baked mask atlas): only its alpha plane (wear zones) is re-encoded lossy at --alpha-quality
//      (webp-alpha.mjs; the colour bitstream stays byte-identical, alpha max error 2-3/255). Lossless alpha was
//      ~80 % of each mask. --alpha-quality 100 keeps it lossless. LOSSLESS_ALPHA models always keep it.
//   2. The geometry is re-encoded at --level (default medium = pack-models' level, pixel-identical in the A/B).
//      `--level high` saves another 0.36 MB over the 20 first-visit models, but its 8-bit octahedral normals shift
//      the glass reflections and panel shading of Berry, Hookline and Snapsize (up to 45/255 on ~1 % of the station's
//      pixels, A/B 2026-09-25): held back until Dennis has looked. Node, mesh, material and texture names must survive.
//   3. gzip -9. The hall fetches the .gz and inflates it with DecompressionStream (hallScene.ts, loadGltf).
// PROTECTED files are only gzipped: the decompressed bytes equal the approved .glb exactly (verify-afterimage.mjs).
// Measured 2026-09-25 on the 20 models of a first visit: 12.17 MB -> 8.62 MB.
// New file name on purpose: /models/* is edge-cached for a day. Put the printed `?v=` into the hall's URL.
import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');
const MODELS = path.join(ROOT, 'public', 'models');
const SOURCES = ['src/components/hall/hallScene.ts', 'src/lib/hall-items.ts'];
/** Approved as-is (figure puppet, Nori): gzip only, never re-encoded. */
const PROTECTED = new Set(['dennis', 'chars/nori']);
/**
 * Riftback keeps the old, narrow chip threshold window (heroMaterial.ts): a 2/255 alpha error moved the edges of its
 * paint flakes visibly in the A/B of 2026-09-25, and Riftback is the machine Dennis approved. Every other machine's
 * wider window swallowed the error (no visible change).
 */
const LOSSLESS_ALPHA = /^mach-riftback/;
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const dry = args.includes('--dry');
const alphaQuality = Number(opt('--alpha-quality', '75'));
const level = opt('--level', 'medium');
const OUT = path.resolve(opt('--out', MODELS));

let names = opt('--only', null)?.split(',').map((n) => n.replace(/\.glb(\.gz)?$/, ''));
if (!names) {
  const found = new Set();
  for (const f of SOURCES) for (const m of readFileSync(path.join(ROOT, f), 'utf8').matchAll(/models\/([\w/.-]+?)\.glb\.gz/g)) found.add(m[1]);
  names = [...found].sort();
}
if (!names.length) throw new Error('no models: pass --only <name>');

await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().setLogger(new Logger(Logger.Verbosity.ERROR)).registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

const shape = (document) => {
  const root = document.getRoot();
  return {
    nodes: root.listNodes().map((n) => n.getName()).filter((n) => n !== ''), meshes: root.listMeshes().map((m) => m.getName()),
    materials: root.listMaterials().map((m) => m.getName()), animations: root.listAnimations().map((a) => a.getName()),
    textures: root.listTextures().map((t) => t.getName()),
  };
};

function alpha(image) {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/models/webp-alpha.mjs'), '--quality', String(alphaQuality)], { input: image, maxBuffer: 256 << 20 });
  if (r.status !== 0) throw new Error(`webp-alpha failed: ${r.stderr}`);
  return { out: new Uint8Array(r.stdout), stats: JSON.parse(r.stderr.toString().trim().split('\n').pop()) };
}

const sha8 = (b) => createHash('sha256').update(b).digest('hex').slice(0, 8);
let totalIn = 0, totalGlb = 0, totalOut = 0;
for (const name of names) {
  const src = path.join(MODELS, `${name}.glb`);
  if (!existsSync(src)) throw new Error(`missing ${src}`);
  const raw = readFileSync(src);
  let glb = raw, note = 'gzip only (protected)';
  if (!PROTECTED.has(name)) {
    const document = await io.read(src);
    const before = shape(document);
    const notes = [];
    for (const texture of document.getRoot().listTextures()) {
      if (alphaQuality >= 100 || LOSSLESS_ALPHA.test(name) || texture.getName() !== 'hero_mask' || texture.getMimeType() !== 'image/webp') continue;
      const { out, stats } = alpha(texture.getImage());
      if (stats.rgbMaxError) throw new Error(`${name}: colour changed by the alpha pass`);
      texture.setImage(out);
      notes.push(stats.note ?? `mask ${Math.round(stats.before / 1024)}->${Math.round(stats.after / 1024)} KB, alpha max err ${stats.alphaMaxError}/255 mean ${stats.alphaMeanError}`);
    }
    await document.transform(meshopt({ encoder: MeshoptEncoder, level }));
    const after = shape(document);
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error(`${name}: structure changed: ${JSON.stringify(before).slice(0, 200)} -> ${JSON.stringify(after).slice(0, 200)}`);
    glb = Buffer.from(await io.writeBinary(document));
    // A re-encode that grows the file keeps the packed bytes.
    if (glb.length >= raw.length) { glb = raw; notes.push('re-encode not smaller, packed bytes kept'); }
    note = notes.join('; ') || `meshopt ${level}`;
  }
  const gz = gzipSync(glb, { level: 9 });
  if (!gunzipSync(gz).equals(glb)) throw new Error(`${name}: gzip round trip failed`);
  if (!dry) { mkdirSync(path.dirname(path.join(OUT, name)), { recursive: true }); writeFileSync(path.join(OUT, `${name}.glb.gz`), gz); }
  totalIn += raw.length; totalGlb += glb.length; totalOut += gz.length;
  console.log(`${`/models/${name}.glb.gz?v=${sha8(gz)}`.padEnd(52)} ${String(Math.round(raw.length / 1024)).padStart(5)} KB -> ${String(Math.round(glb.length / 1024)).padStart(5)} KB glb -> ${String(Math.round(gz.length / 1024)).padStart(5)} KB gz  (${note})`);
}
console.log(`MODELS_GZ ${names.length} files ${(totalIn / 1e6).toFixed(2)} MB -> ${(totalGlb / 1e6).toFixed(2)} MB glb -> ${(totalOut / 1e6).toFixed(2)} MB gz${dry ? ' (dry run, nothing written)' : ''}`);
