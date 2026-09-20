// Shared scanned surfaces for the hall's hero machines, from ambientCG (CC0) sets unpacked under
// .source-assets/textures-cc0/<id>/. One pair per surface in public/textures/hardware/:
//   <name>-normal.webp   tangent-space normal (OpenGL convention)
//   <name>-orm.webp      R = albedo variation (luminance of the scan, mean 0.5), G = roughness, B unused
//   node scripts/assets/hardware-textures.mjs
// sharp only: never import @gltf-transform/functions in this process.
import sharp from 'sharp';
import { mkdir, stat } from 'node:fs/promises';

const SRC = '.source-assets/textures-cc0', OUT = 'public/textures/hardware';
const SETS = [
  { name: 'powdercoat-v1', id: 'Metal027', size: 1024 },
  { name: 'plastic-v1', id: 'Plastic012B', size: 1024 },
  { name: 'brushed-v1', id: 'Metal009', size: 1024 },
  { name: 'steel-v1', id: 'Metal038', size: 1024 },
];
await mkdir(OUT, { recursive: true });
for (const { name, id, size } of SETS) {
  const file = kind => `${SRC}/${id}/${id}_1K-JPG_${kind}.jpg`;
  await sharp(file('NormalGL')).resize(size, size).webp({ quality: 88 }).toFile(`${OUT}/${name}-normal.webp`);
  const grey = async kind => (await sharp(file(kind)).resize(size, size).greyscale().raw().toBuffer());
  const [color, rough] = [await grey('Color'), await grey('Roughness')];
  const mean = color.reduce((s, v) => s + v, 0) / color.length;
  const out = Buffer.alloc(size * size * 3);
  for (let i = 0; i < size * size; i++) {
    out[i * 3] = Math.max(0, Math.min(255, Math.round(127.5 * color[i] / mean)));
    out[i * 3 + 1] = rough[i];
  }
  await sharp(out, { raw: { width: size, height: size, channels: 3 } }).webp({ quality: 86 }).toFile(`${OUT}/${name}-orm.webp`);
  const kb = async f => Math.round((await stat(f)).size / 1024);
  console.log(`${name}: normal ${await kb(`${OUT}/${name}-normal.webp`)} KB, orm ${await kb(`${OUT}/${name}-orm.webp`)} KB`);
}
