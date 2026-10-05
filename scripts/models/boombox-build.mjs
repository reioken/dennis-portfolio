// The CD player beside the claw machine (Dennis, 2026-10-05): the Meshy model (scripts/models/cd-player-generate.py,
// concept E) in metres, with its display strip and disc window copied out as overlay meshes for the live display and
// the spinning disc, and an emissive mask for the violet speaker trims.
//   node scripts/models/boombox-build.mjs [--debug <dir>]
//   npx gltf-transform optimize .source-assets/cd-player/boombox-built.glb public/models/boombox-v1.glb \
//     --texture-size 1024 --texture-compress webp --compress meshopt --simplify false --join false --palette false --flatten false
//   node scripts/models/gzip-models.mjs --only boombox-v1
// The window and display were measured on a flat-colour front render of the Meshy model (orthographic, Blender) and
// ray casts into it; the numbers below are in the Meshy model's own units, before the scale.
// Overlay faces are the body's own faces over each region (a margin wider than the region, so the region's edge is
// drawn by the overlay's texture, not by triangle edges), lifted off the surface along their normals. Their UVs are
// a planar projection: the display's [0,1] square spans DISPLAY plus its margin, the disc's spans the window circle.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');
const SOURCE = path.join(ROOT, '.source-assets/cd-player/boombox-e.glb');
const OUT = path.join(ROOT, '.source-assets/cd-player/boombox-built.glb');
const debug = process.argv.includes('--debug') ? process.argv[process.argv.indexOf('--debug') + 1] : null;

/** Width of the boombox in the hall (m) and how much of Meshy's depth it keeps (its reconstruction is too deep). */
export const WIDTH = 0.62, DEPTH_KEEP = 0.78;
/** Display strip: centre and size in the model's x/y (front view), and the margin the overlay reaches past it. */
export const DISPLAY = { x: -0.00124, y: 0.16058, w: 0.40691, h: 0.05086, margin: 0.03 };
/** Disc window: centre, the disc's radius and the overlay's reach (the dark rim of the window starts at 0.2209). */
export const DISC = { x: -0.00167, y: -0.15913, r: 0.2209, reach: 0.25 };
const LIFT = 0.0025;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const document = await io.read(SOURCE);
const root = document.getRoot();
const [mesh] = root.listMeshes();
const [prim] = mesh.listPrimitives();
const body = prim.getMaterial();
const pos = prim.getAttribute('POSITION'), nrm = prim.getAttribute('NORMAL'), uv = prim.getAttribute('TEXCOORD_0');
const index = prim.getIndices();
const P = pos.getArray(), N = nrm.getArray(), I = index.getArray();
const buffer = root.listBuffers()[0];

// bounds before the scale: x centred, y on the floor, z centred
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
for (let i = 0; i < P.length; i += 3) {
  minX = Math.min(minX, P[i]); maxX = Math.max(maxX, P[i]);
  minY = Math.min(minY, P[i + 1]); maxY = Math.max(maxY, P[i + 1]);
  minZ = Math.min(minZ, P[i + 2]); maxZ = Math.max(maxZ, P[i + 2]);
}
const k = WIDTH / (maxX - minX), cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
const place = (x, y, z) => [(x - cx) * k, (y - minY) * k, (z - cz) * k * DEPTH_KEEP];
// normals under a non-uniform scale: the inverse transpose, here a divide by the per-axis factor
const turn = (x, y, z) => { const v = [x, y, z / DEPTH_KEEP], l = Math.hypot(...v) || 1; return v.map(c => c / l); };

/** Copy of the faces over one region, lifted, with planar UVs; the body keeps its own faces. */
function overlay(name, inRegion, project) {
  const positions = [], normals = [], uvs = [];
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    const fx = (P[a * 3] + P[b * 3] + P[c * 3]) / 3, fy = (P[a * 3 + 1] + P[b * 3 + 1] + P[c * 3 + 1]) / 3;
    const fnz = (N[a * 3 + 2] + N[b * 3 + 2] + N[c * 3 + 2]) / 3;
    if (fnz < 0.3 || !inRegion(fx, fy)) continue;
    for (const v of [a, b, c]) {
      const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2], nx = N[v * 3], ny = N[v * 3 + 1], nz = N[v * 3 + 2];
      positions.push(...place(x + nx * LIFT, y + ny * LIFT, z + nz * LIFT));
      normals.push(...turn(nx, ny, nz));
      uvs.push(...project(x, y));
    }
  }
  const material = document.createMaterial(name).setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.4).setMetallicFactor(0);
  const p = document.createPrimitive().setMaterial(material)
    .setAttribute('POSITION', document.createAccessor().setBuffer(buffer).setType('VEC3').setArray(new Float32Array(positions)))
    .setAttribute('NORMAL', document.createAccessor().setBuffer(buffer).setType('VEC3').setArray(new Float32Array(normals)))
    .setAttribute('TEXCOORD_0', document.createAccessor().setBuffer(buffer).setType('VEC2').setArray(new Float32Array(uvs)));
  const node = document.createNode(name).setMesh(document.createMesh(name).addPrimitive(p));
  root.listScenes()[0].addChild(node);
  console.log(`${name}: ${positions.length / 9} faces`);
}

const dx = DISPLAY.w / 2 + DISPLAY.margin, dy = DISPLAY.h / 2 + DISPLAY.margin;
overlay('boombox_display',
  (x, y) => Math.abs(x - DISPLAY.x) < dx && Math.abs(y - DISPLAY.y) < dy,
  // [0,1] over the strip plus its margin; glTF UVs run top-down
  (x, y) => [(x - DISPLAY.x + dx) / (2 * dx), 1 - (y - DISPLAY.y + dy) / (2 * dy)]);
overlay('boombox_disc',
  (x, y) => Math.hypot(x - DISC.x, y - DISC.y) < DISC.reach + 0.02,
  (x, y) => [0.5 + (x - DISC.x) / (2 * DISC.reach), 0.5 - (y - DISC.y) / (2 * DISC.reach)]);

// the body itself in metres
for (let i = 0; i < P.length; i += 3) {
  const [x, y, z] = place(P[i], P[i + 1], P[i + 2]);
  P[i] = x; P[i + 1] = y; P[i + 2] = z;
  const [nx, ny, nz] = turn(N[i], N[i + 1], N[i + 2]);
  N[i] = nx; N[i + 1] = ny; N[i + 2] = nz;
}
pos.setArray(P); nrm.setArray(N);
mesh.setName('boombox_body');
root.listNodes().find(n => n.getMesh() === mesh)?.setName('boombox_body').setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
body.setName('boombox_body');

// Violet trims as an emissive mask: the base colour's saturated blue-violet texels (the display strip is covered by
// its overlay). The hall sets the colour and drives the intensity with the music.
const colour = body.getBaseColorTexture();
const { data, info } = await sharp(Buffer.from(colour.getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const mask = Buffer.alloc(info.width * info.height);
for (let i = 0, j = 0; i < data.length; i += 3, j++) {
  const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), s = mx ? (mx - mn) / mx : 0;
  let h = 0;
  if (mx !== mn) h = mx === r ? ((g - b) / (mx - mn)) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4;
  h = (h * 60 + 360) % 360;
  mask[j] = h > 215 && h < 290 && s > 0.2 && mx > 0.35 ? 255 : 0;
}
const maskPng = await sharp(mask, { raw: { width: info.width, height: info.height, channels: 1 } }).blur(1.2).png().toBuffer();
const emissive = document.createTexture('boombox_trim').setImage(maskPng).setMimeType('image/png');
body.setEmissiveTexture(emissive).setEmissiveFactor([0, 0, 0]);
if (debug) {
  mkdirSync(debug, { recursive: true });
  await sharp(maskPng).toFile(path.join(debug, 'trim-mask.png'));
  await sharp(Buffer.from(colour.getImage())).resize(1024).toFile(path.join(debug, 'basecolor.png'));
}
await io.write(OUT, document);
console.log('BUILT', OUT, 'scale', k.toFixed(5), 'size', [WIDTH, (maxY - minY) * k, (maxZ - minZ) * k * DEPTH_KEEP].map(v => v.toFixed(3)).join(' x '));
