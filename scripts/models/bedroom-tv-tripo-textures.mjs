// Extract observed GLB colour maps for material-region classification during Blender polish.
import fs from 'node:fs/promises';
import sharp from 'sharp';
const root = '.source-assets/bedroom-tv-tripo';
const manifest = JSON.parse(await fs.readFile('scripts/models/bedroom-tv-tripo.references.json', 'utf8'));
await fs.mkdir(`${root}/tex`, { recursive: true });
for (const entry of manifest.references) {
  const file = await fs.readFile(`${root}/textured/${entry.id}.glb`);
  const length = file.readUInt32LE(12);
  const gltf = JSON.parse(file.subarray(20, 20 + length).toString());
  if (!gltf.meshes[0].primitives[0].attributes.TEXCOORD_0) throw new Error(`${entry.id}: missing UVs`);
  const image = gltf.images[0], view = gltf.bufferViews[image.bufferView];
  const binStart = 28 + length;
  const bytes = file.subarray(binStart + (view.byteOffset ?? 0), binStart + (view.byteOffset ?? 0) + view.byteLength);
  const metadata = await sharp(bytes).metadata();
  if (metadata.width !== 4096 || metadata.height !== 4096) throw new Error(`${entry.id}: expected 4K texture`);
  await sharp(bytes).median(5).png().toFile(`${root}/tex/${entry.id}-median.png`);
  console.log(`${entry.id}: verified UVs and 4096×4096 colour source`);
}
