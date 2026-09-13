// Usage: node scripts/models/blue-toys-pack.mjs <directory containing ball-clean.glb and mouse-clean.glb>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { stat } from 'node:fs/promises';
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
for (const name of ['ball', 'mouse']) {
  const document = await io.read(path.join(process.argv[2], `${name}-clean.glb`));
  for (const material of document.getRoot().listMaterials()) {
    material.setMetallicFactor(0).setRoughnessFactor(.95).setNormalTexture(null).setMetallicRoughnessTexture(null);
  }
  await document.transform(prune());
  for (const texture of document.getRoot().listTextures()) {
    // gltf-transform and the app use different libvips builds; isolate image IO
    // so loading both native libraries in one process cannot corrupt colourspace enums.
    const resized = spawnSync(process.execPath, ['--input-type=module', '-e', "import sharp from 'sharp';const chunks=[];for await(const c of process.stdin)chunks.push(c);process.stdout.write(await sharp(Buffer.concat(chunks)).resize(512,512,{fit:'inside'}).webp({quality:82}).toBuffer());"], { input: Buffer.from(texture.getImage()), maxBuffer: 8 * 1024 * 1024 });
    if (resized.status !== 0) throw new Error(resized.stderr.toString());
    texture.setImage(resized.stdout).setMimeType('image/webp');
  }
  await document.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const file = `public/models/blue-toy-${name}-v1.glb`;
  await io.write(file, document);
  console.log(file, (await stat(file)).size);
}
