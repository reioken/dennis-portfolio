// Preserve rejected v2 provenance and record actual files for the current unapproved correction.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const artifact = process.argv[2];
if (!artifact) throw Error('Usage: node bedroom-tv-correction-status.mjs ARTIFACT_DIRECTORY');
const file = 'scripts/models/bedroom-tv-tripo.references.json';
const manifest = JSON.parse(await readFile(file, 'utf8'));
const audit = JSON.parse(await readFile(path.join(artifact, 'tv-v3-delivery-audit.json'), 'utf8'));
const review = JSON.parse(await readFile(path.join(artifact, 'tv-v3-final-pieces/review.json'), 'utf8'));
const blend = '.source-assets/bedroom-tv-tripo/bedroom-tv-v3.blend';
const blendhash = createHash('sha256').update(await readFile(blend)).digest('hex');
if (review.length !== 15 || review.some(r => r.sourceBlendSha256 !== blendhash)) throw Error('All fifteen current-source closeups are required');
manifest.status = 'V2 rejected by Dennis; all fifteen source types reprocessed and assembled in Blender v3; correction candidate awaiting visual acceptance; browser verification unavailable';
manifest.assembly.visualApproval = 'rejected';
for (const r of manifest.references) {
  r.blender.visualApproval = 'rejected-v2';
  const source = `.source-assets/bedroom-tv-tripo/corrected/${r.id}.glb`, bytes = await readFile(source);
  r.correction = { status: 'assembled-v3-candidate-unapproved', cleanSourceGlb: source, cleanSourceSha256: createHash('sha256').update(bytes).digest('hex'), hardwareAITextures: 0, artistRepairs: 'Recorded in editable assembled Blender source and bedroom_tv_artist_repairs.py', closeup: path.join(artifact, `tv-v3-final-pieces/${r.id}.png`), sourceBlendSha256: blendhash };
}
manifest.correction = { version: 3, blend, sourceBlendSha256: blendhash, model: 'public/models/bedroom-tv-v3.glb.gz', sha256: audit.sha256, bytes: audit.bytes, triangles: audit.triangles, materials: audit.materials, artworkTextures: audit.art.length, hardwareAITextures: 0, additionalTripoCredits: 0, published: false, visualApproval: 'unapproved', checks: path.join(artifact, 'tv-v3-delivery-audit.json'), closeups: path.join(artifact, 'tv-v3-final-pieces/review.json'), browserVerification: 'Unavailable: CUA fails before execution with kernel-assets path error, os error 3' };
await writeFile(file, JSON.stringify(manifest, null, 2) + '\n');
console.log(manifest.status);
