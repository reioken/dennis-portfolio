// Put a hero machine's baked mask atlas into its GLB as the occlusion texture on TEXCOORD_1.
//   node scripts/models/hero-attach-mask.mjs <name>
// Reads .source-assets/models-in/<name>/<name>.glb and <name>-mask.png (scripts/models/blender/hero_gen.py) and
// rewrites the GLB. The mask's channels are R = AO, G = screen light, B = brand light, A = wear; the hall reads
// all four through the aoMap sampler (src/components/hall/heroMaterial.ts). Every material on a mesh that has
// a second UV set gets it; screens, glass, marquee and side art have none and stay untouched.
// Core only: no @gltf-transform/functions in this process (two native sharp builds live in node_modules).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const name = process.argv[2];
if (!name) throw new Error('usage: hero-attach-mask.mjs <name>');
const dir = `.source-assets/models-in/${name}`;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const document = await io.read(`${dir}/${name}.glb`);
const texture = document.createTexture('hero_mask').setImage(await readFile(`${dir}/${name}-mask.png`)).setMimeType('image/png');
// Optional second bake (terminal_v4_gen.py): how much of the hall's key light reaches each texel. It rides in the
// emissive slot on the same UV set; heroMaterial.ts reads it there and keeps it out of the emissive term.
const lightFile = `${dir}/${name}-light.png`;
const light = existsSync(lightFile) ? document.createTexture('hero_light').setImage(await readFile(lightFile)).setMimeType('image/png') : null;
// Optional third bake (hero_gen.bake_bevel_normal): the rounded-edge normal in the same atlas, as the glTF
// normalTexture on TEXCOORD_1. heroMaterial.ts keeps the tiling scan as the normalMap and perturbs the shading
// normal with this one afterwards; a machine baked before this existed has no file and renders exactly as before.
const bevelFile = `${dir}/${name}-normal.png`;
const bevel = existsSync(bevelFile) ? document.createTexture('hero_bevel').setImage(await readFile(bevelFile)).setMimeType('image/png') : null;
const done = new Set();
for (const mesh of document.getRoot().listMeshes()) {
  for (const primitive of mesh.listPrimitives()) {
    const material = primitive.getMaterial();
    if (!material || !primitive.getAttribute('TEXCOORD_1')) continue;
    material.setOcclusionTexture(texture);
    material.getOcclusionTextureInfo().setTexCoord(1);
    if (light) {
      material.setEmissiveTexture(light);
      material.getEmissiveTextureInfo().setTexCoord(1);
      // An emissive texture under a zero factor has no effect and the optimizer prunes it: unlit materials get a
      // white factor and a flag, and the hall takes the emissive term back (heroMaterial.ts).
      if (material.getEmissiveFactor().every(v => v === 0)) material.setEmissiveFactor([1, 1, 1]).setExtras({ ...material.getExtras(), heroLight: true });
    }
    if (bevel) {
      material.setNormalTexture(bevel);
      material.getNormalTextureInfo().setTexCoord(1);
      material.setNormalScale(1);
    }
    done.add(material.getName());
  }
}
if (!done.size) throw new Error(`${name}: no primitive carries TEXCOORD_1`);
await io.write(`${dir}/${name}.glb`, document);
console.log(`[hero] ${name}: mask${light ? ' + light' : ''}${bevel ? ' + bevel normal' : ''} on ${done.size} materials (${[...done].join(', ')})`);
