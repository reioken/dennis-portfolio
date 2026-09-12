// Pack Blue's Blender export for the web: drop redundant animation keys, quantize and Meshopt-compress geometry,
// morph targets and animation, then write the runtime asset. Run after blue_animate.py, then the structure guard:
//   node scripts/models/blue-pack.mjs && node --test scripts/qa/blue-asset.test.mjs
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { resample, meshopt, prune } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { stat } from 'node:fs/promises';

const input = process.argv[2] || '.source-assets/blue/v3/blue-rigged-v2.glb';
const output = process.argv[3] || 'public/models/blue-rigged-v2.glb';
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const document = await io.read(input);
await document.transform(
  // 1e-4 keeps every authored curve within a tenth of a millimetre / a hundredth of a degree while dropping the
  // keys the 30 fps bake produced on straight segments.
  resample({ tolerance: 1e-4 }),
  prune(),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
await io.write(output, document);
const before = (await stat(input)).size, after = (await stat(output)).size;
console.log(`BLUE_PACKED ${before} -> ${after} bytes (${(100 * after / before).toFixed(0)} %) ${output}`);
