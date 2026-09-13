// Big round pupils for Blue v5, painted in mesh space. Every atlas triangle around an eye (centres from the rig
// config's iris detection) is rasterised in UV with its 3D position interpolated per texel, so a texel goes dark
// when its surface point lies within the pupil radius of the eye centre: the pupil comes out round on the mesh
// whatever the UV layout does, and seams need no special handling. A small catchlight sits up and nose-wards.
// node scripts/models/blue-v5-pupils.mjs <candidate> [source glb] [out glb]   (the source is never overwritten)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';
import fs from 'node:fs';
const CAND = process.argv[2] || 'pixarfur', file = process.argv[3] || '.source-assets/blue/v3/blue-rigged-v5.glb';
const OUT = process.argv[4] || file.replace(/\.glb$/, '-pupils.glb');
const PUPIL = .0066, EDGE = .0008, CATCH = .0019, CATCH_OFF = [.0024, .0028];   // metres; catchlight offset: towards nose, up
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(file);
const mesh = doc.getRoot().listMeshes().find(m => m.listPrimitives()[0].getAttribute('TEXCOORD_0'));
const prim = mesh.listPrimitives()[0];
const pos = prim.getAttribute('POSITION').getArray(), uv = prim.getAttribute('TEXCOORD_0').getArray(), idx = prim.getIndices().getArray();
const mat = doc.getRoot().listMaterials()[0]; const tex = mat.getBaseColorTexture();
const { data, info } = await sharp(Buffer.from(tex.getImage())).raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, C = info.channels;
const cfg = JSON.parse(fs.readFileSync(`.source-assets/blue/v4/build-${CAND}/rig-config.json`, 'utf8'));
const DARK = [9, 8, 11], LIGHT = [248, 246, 238];
let painted = 0, lit = 0, tris = 0;
const blend = (i, rgb, a) => { for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c] * (1 - a) + rgb[c] * a); };
for (const [side, e] of Object.entries(cfg.eyes)) {
  const [bx, by, bz] = e.centre; const c = [bx, bz, -by];   // Blender (x, y, z) -> glTF (x, z, -y)
  const catchP = [c[0] - Math.sign(c[0]) * CATCH_OFF[0], c[1] + CATCH_OFF[1]];   // measured in the eye plane (x, y): the eyes face +z
  const reach = PUPIL + EDGE + .004;
  const d2 = (p, q) => { const dx = p[0] - q[0], dy = p[1] - q[1], dz = p[2] - q[2]; return dx * dx + dy * dy + dz * dz; };
  for (let t = 0; t < idx.length; t += 3) {
    const v = [idx[t], idx[t + 1], idx[t + 2]]; const P = v.map(k => [pos[3 * k], pos[3 * k + 1], pos[3 * k + 2]]);
    if (!P.some(p => d2(p, c) < reach * reach)) continue;
    tris++;
    const U = v.map(k => [uv[2 * k] * W, uv[2 * k + 1] * H]);
    const x0 = Math.max(0, Math.floor(Math.min(...U.map(u => u[0])))), x1 = Math.min(W - 1, Math.ceil(Math.max(...U.map(u => u[0]))));
    const y0 = Math.max(0, Math.floor(Math.min(...U.map(u => u[1])))), y1 = Math.min(H - 1, Math.ceil(Math.max(...U.map(u => u[1]))));
    const det = (U[1][0] - U[0][0]) * (U[2][1] - U[0][1]) - (U[2][0] - U[0][0]) * (U[1][1] - U[0][1]);
    if (Math.abs(det) < 1e-6) continue;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + .5, py = y + .5;
      let w1 = ((px - U[0][0]) * (U[2][1] - U[0][1]) - (U[2][0] - U[0][0]) * (py - U[0][1])) / det;
      let w2 = ((U[1][0] - U[0][0]) * (py - U[0][1]) - (px - U[0][0]) * (U[1][1] - U[0][1])) / det;
      const w0 = 1 - w1 - w2; const slack = -.02;   // a little overlap so neighbouring triangles leave no hairline gaps
      if (w0 < slack || w1 < slack || w2 < slack) continue;
      const p = [0, 1, 2].map(a => w0 * P[0][a] + w1 * P[1][a] + w2 * P[2][a]);
      const dist = Math.sqrt(d2(p, c)); const i = (y * W + x) * C;
      if (dist < PUPIL + EDGE) { blend(i, DARK, Math.min(1, (PUPIL + EDGE - dist) / EDGE)); painted++; }
      const dc = Math.hypot(p[0] - catchP[0], p[1] - catchP[1]);
      if (dc < CATCH) { blend(i, LIGHT, Math.min(1, (CATCH - dc) / .0006)); lit++; }
    }
  }
  console.log(side, 'centre', c.map(x => x.toFixed(3)), 'radius', e.radius);
}
console.log('triangles', tris, 'pupil texels', painted, 'catchlight texels', lit);
const rgb = C === 3 ? Buffer.from(data) : await sharp(data, { raw: { width: W, height: H, channels: C } }).removeAlpha().raw().toBuffer();
const webp = await sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).webp({ quality: 90 }).toBuffer();
tex.setImage(new Uint8Array(webp)).setMimeType('image/webp');
await io.write(OUT, doc);
fs.writeFileSync(`.source-assets/blue/v4/build-${CAND}/atlas-pupils.png`, await sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer());
console.log('atlas repainted', W, 'x', H, 'webp', webp.length, '->', OUT);
