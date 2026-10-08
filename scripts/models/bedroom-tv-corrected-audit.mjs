// Decode the actual delivered candidate; numerical checks do not imply visual approval.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
const [file, out] = process.argv.slice(2);
if (!file || !out) throw Error('Usage: node bedroom-tv-corrected-audit.mjs MODEL.glb[.gz] REPORT.json');
await MeshoptDecoder.ready;
const bytes = await readFile(file);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.readBinary(file.endsWith('.gz') ? gunzipSync(bytes) : bytes);
const root = doc.getRoot(), errors = [], materials = root.listMaterials();
const names = root.listNodes().map(n => n.getName());
const required = ['tv-stand','bedroom-crt','crt-screen','nintendo-gamecube','nintendo-snes','nintendo-64','nintendo-gameboy','nintendo-ds','gamecube-controller','snes-controller','n64-controller','bedroom-gamecube-stack','bedroom-retro-games','bedroom-melee-case','bedroom-yoshi-cartridge','bedroom-smash64-cartridge'];
for (const name of required) if (!names.includes(name)) errors.push(`Missing assembly: ${name}`);
let triangles = 0, texturedPrimitives = 0;
for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
  const positions = p.getAttribute('POSITION');
  const indices = p.getIndices();
  triangles += (indices?.getCount() ?? positions.getCount()) / 3;
  for (const semantic of p.listSemantics()) {
    const attribute = p.getAttribute(semantic);
    if ([...attribute.getArray()].some(x => !Number.isFinite(x))) errors.push(`Nonfinite ${mesh.getName()} ${semantic}`);
  }
  if (indices && [...indices.getArray()].some(x => x >= positions.getCount())) errors.push(`Invalid indices: ${mesh.getName()}`);
  if (p.getMaterial()?.getBaseColorTexture() || p.getMaterial()?.getEmissiveTexture()) {
    texturedPrimitives++;
    const uv = p.getAttribute('TEXCOORD_0');
    const divisor = uv?.getNormalized() ? ({5121:255,5123:65535,5120:127,5122:32767}[uv.getComponentType()] ?? 1) : 1;
    if (!uv || [...uv.getArray()].some(x => x / divisor < -.001 || x / divisor > 1.001)) errors.push(`Invalid print UV: ${mesh.getName()}`);
  }
}
for (const m of materials.filter(m => m.getName().startsWith('bedroom-clean-'))) {
  if (m.getBaseColorTexture() || m.getNormalTexture() || m.getOcclusionTexture() || m.getMetallicRoughnessTexture()) errors.push(`AI hardware texture retained: ${m.getName()}`);
}
const art = [];
for (const name of ['cover-melee','cover-wind-waker','cover-ocarina','cover-yoshi','cover-smash64','cover-link-past','cover-links-awakening','cover-mario-ds','crt-image','gb-image','ds-top-image','ds-touch-image','bedroom-spines']) {
  const m = materials.find(m => m.getName() === name), t = m?.getBaseColorTexture() ?? m?.getEmissiveTexture();
  if (!t) errors.push(`Missing original artwork: ${name}`);
  else art.push({ name, size: t.getSize(), bytes: t.getImage().byteLength });
}
if (triangles > 750000 || materials.length > 60) errors.push('Candidate exceeds detail/draw budget');
const report = { file, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, triangles, materials: materials.length, namedAssemblies: required, art, texturedPrimitives, hardwareAITextures: 0, errors, visualApproval: 'Unapproved: these are technical checks only.' };
await writeFile(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ triangles, materials: materials.length, images: art.length, bytes: bytes.length, errors }));
if (errors.length) process.exitCode = 1;
