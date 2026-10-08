// Web delivery of painted hardware. Keep the original covers, crisp spines and screen captures at full size.
// The 4K Tripo exports and full Blender source maps stay in .source-assets/bedroom-tv-tripo/.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const file = 'public/models/bedroom-tv-v2.glb';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const document = await io.read(file);
for (const texture of document.getRoot().listTextures()) {
  if (!texture.getName().startsWith('hifi-bedroom-')) continue;
  const cap = texture.getName().endsWith('-rm') ? 512 : 1024;
  const bytes = Buffer.from(texture.getImage());
  const { width, height } = await sharp(bytes).metadata();
  if (Math.max(width, height) <= cap) continue;
  const image = await sharp(bytes).resize(cap, cap, { fit: 'inside' }).webp({ quality: 86, effort: 5 }).toBuffer();
  texture.setImage(image).setMimeType('image/webp');
  console.log(`${texture.getName()}: ${width}×${height} → ${cap}, ${Math.round(image.length / 1024)} KiB`);
}
await io.write(file, document);
