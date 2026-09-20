// Per model in public/models: world bounding size, screen plate size + aspect, and control node names.
// usage: node scripts/qa/hero/inspect-models.mjs <name> [name ...]   (name without .glb, e.g. mach-berry-v2)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ROOT = path.resolve(fileURLToPath(import.meta.url), '../../../..');
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');
const { MeshoptDecoder } = require('meshoptimizer');
if (process.argv.length < 3) { console.error('usage: node scripts/qa/hero/inspect-models.mjs <name> [name ...]'); process.exit(2); }
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const CTL = /^(joy|btn|btn_\d+|start_\d+|trackball|tbtn_\d+|kbtn_\d+|sel_\d+)$/;
for (const name of process.argv.slice(2)) {
  const d = await io.read(path.join(ROOT, 'public/models', `${name}.glb`));
  const nodes = d.getRoot().listNodes();
  const ctl = nodes.map(n => n.getName()).filter(n => CTL.test(n.toLowerCase()));
  let aspect = '?', size = '';
  let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (const n of nodes) {
    const mesh = n.getMesh(); if (!mesh) continue;
    const m = n.getWorldMatrix();
    for (const p of mesh.listPrimitives()) {
      const pos = p.getAttribute('POSITION'); if (!pos) continue;
      const mn = pos.getMin([]), mx = pos.getMax([]);
      for (const c of [[mn[0], mn[1], mn[2]], [mx[0], mx[1], mx[2]], [mn[0], mx[1], mn[2]], [mx[0], mn[1], mx[2]]]) {
        const w = [m[0] * c[0] + m[4] * c[1] + m[8] * c[2] + m[12], m[1] * c[0] + m[5] * c[1] + m[9] * c[2] + m[13], m[2] * c[0] + m[6] * c[1] + m[10] * c[2] + m[14]];
        for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], w[i]); hi[i] = Math.max(hi[i], w[i]); }
        if (n.getName().toLowerCase() === 'screen') { n._lo = n._lo ? n._lo.map((v, i) => Math.min(v, w[i])) : [...w]; n._hi = n._hi ? n._hi.map((v, i) => Math.max(v, w[i])) : [...w]; }
      }
    }
    if (n._lo) { const sx = n._hi[0] - n._lo[0], sy = Math.hypot(n._hi[1] - n._lo[1], n._hi[2] - n._lo[2]); aspect = (sx / sy).toFixed(2); size = `${sx.toFixed(2)}x${sy.toFixed(2)}`; }
  }
  console.log(name, '| size', hi.map((v, i) => (v - lo[i]).toFixed(2)).join('x'), '| screen', size, 'aspect', aspect, '| ctl', ctl.join(','));
}
