// Cap and re-encode the textures inside the hall models: base colour and emissive maps up to 2048², normal,
// roughness and occlusion maps up to 1024², everything as WebP. Runs in its own process on purpose: the
// @gltf-transform/functions bundle pulls in a second native sharp build, and two libvips in one process break
// every encode ("colourspace: parameter space not set"). Run before pack-models.mjs.
//   node scripts/models/shrink-textures.mjs
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT = 'public/models';
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'kenney') yield* walk(path); }
    else if (entry.name.endsWith('.glb')) yield path;
  }
}

let changed = 0;
for await (const file of walk(ROOT)) {
  const document = await io.read(file);
  const root = document.getRoot();
  const log = [];
  for (const texture of root.listTextures()) {
    let colour = false;
    for (const material of root.listMaterials()) {
      if (material.getBaseColorTexture() === texture || material.getEmissiveTexture() === texture) colour = true;
    }
    const cap = colour ? 2048 : 1024;
    const view = texture.getImage();
    if (!view) continue;
    const image = Buffer.from(view);
    const meta = await sharp(image).metadata();
    const width = meta.width ?? 0, height = meta.height ?? 0;
    const needsResize = Math.max(width, height) > cap, needsFormat = texture.getMimeType() !== 'image/webp';
    if (!needsResize && !needsFormat) continue;
    let pipeline = sharp(image);
    if (needsResize) pipeline = pipeline.resize(cap, cap, { fit: 'inside', withoutEnlargement: true });
    const out = await pipeline.webp({ quality: 86, effort: 5 }).toBuffer();
    texture.setImage(new Uint8Array(out)).setMimeType('image/webp');
    log.push(`${texture.getName() || 'texture'} ${width}x${height} ${texture.getMimeType()} ${Math.round(image.length / 1024)} KB -> ${Math.min(width, cap)}x${Math.min(height, cap)} webp ${Math.round(out.length / 1024)} KB`);
  }
  if (!log.length) continue;
  const before = (await stat(file)).size;
  await io.write(file, document);
  const after = (await stat(file)).size;
  changed++;
  console.log(`${relative(ROOT, file)}: ${Math.round(before / 1024)} KB -> ${Math.round(after / 1024)} KB`);
  for (const line of log) console.log(`  ${line}`);
}
console.log(`TEXTURES_SHRUNK ${changed} files`);
