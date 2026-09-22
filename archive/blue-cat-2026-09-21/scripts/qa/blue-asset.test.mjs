// Structure guard for Blue's runtime GLB: an optimiser pass (resample, Meshopt) must not rename or drop what the
// runtime looks up by name — bones, clips, morph targets, materials — nor lose the Root motion on turn and jump clips.
import test from 'node:test';
import assert from 'node:assert/strict';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const FILE = process.env.BLUE_GLB || 'public/models/blue-rigged-v6h.glb';
/** v4 and later (Meshy multi-view mesh, one PBR material, eyes painted into the coat) have no eyeball or lid nodes;
 * v6 is the v1 mesh with its original atlas: the coat plus the tinted `Blue amber eyes` polygons, no normal map.
 * The file-name suffix is the asset build (BLUE_ASSET_BUILD in blueCat.ts); the version is its digits. */
const BUILD = FILE.match(/blue-rigged-(v\d+[a-z]?)\.glb$/)?.[1];
const VERSION = BUILD?.match(/\d+/)?.[0];
const V4 = Number(VERSION) >= 4;
const ORIGINAL = VERSION === '6';
const BONES = ['Root', 'Pelvis', 'Spine', 'Chest', 'Neck', 'Head', 'Ear.L', 'Ear.R',
  'FrontUpper.L', 'FrontLower.L', 'FrontPaw.L', 'FrontUpper.R', 'FrontLower.R', 'FrontPaw.R',
  'HindUpper.L', 'HindLower.L', 'HindPaw.L', 'HindUpper.R', 'HindLower.R', 'HindPaw.R',
  'Tail0', 'Tail1', 'Tail2', 'Tail3', 'Tail4', 'Tail5'];
const CLIPS = ['arch', 'bedin', 'bedout', 'catch', 'flick', 'happy', 'idle', 'jumpdown', 'jumpup', 'perch', 'perchidle', 'playready', 'pounce', 'settle', 'sit', 'sitarch', 'sitidle', 'sleep', 'stand', 'swat', 'swatL', 'trot',
  ...['L', 'R'].flatMap(side => [15, 30, 45, 60, 90, 120, 180].map(angle => `turn${side}${angle}`)), 'unperch', 'wake', 'walk'].sort();
const MORPHS = ['BlueBlink', 'BlueGround', 'BlueSit', 'BluePerch'];

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const document = await io.read(FILE);
const root = document.getRoot();

test('every bone the runtime addresses is present, once', () => {
  const names = root.listNodes().map(n => n.getName());
  for (const bone of BONES) assert.equal(names.filter(n => n === bone).length, 1, bone);
  assert.equal(root.listSkins().length, 1);
  assert.equal(root.listSkins()[0].listJoints().length, BONES.length);
});

test('the clip list is exactly what blueCat.ts expects', () => {
  assert.deepEqual(root.listAnimations().map(a => a.getName()).sort(), CLIPS);
});

test('turn clips carry their yaw and jump clips their trajectory on the Root bone', () => {
  for (const animation of root.listAnimations()) {
    const name = animation.getName();
    const rootChannels = animation.listChannels().filter(c => c.getTargetNode()?.getName() === 'Root').map(c => c.getTargetPath());
    // A turn's hindquarter pivot rides on the skeleton (Pelvis), never on the Root: the runtime strips every
    // Root track from a turn clip and would throw the offset away.
    if (name.startsWith('turn')) { assert.ok(rootChannels.includes('rotation'), `${name} has a Root rotation channel`); assert.ok(!rootChannels.includes('translation'), `${name} has no Root translation`); }
    else if (name.startsWith('jump') || name.startsWith('bed')) assert.ok(rootChannels.includes('translation'), `${name} has a Root translation channel`);
    else assert.equal(rootChannels.length, 0, `${name} has no Root channel`);
  }
});

test('turn clips end at their nominal angle and jumps at their authored displacement', () => {
  const quatYaw = q => Math.atan2(2 * (q[3] * q[1] + q[0] * q[2]), 1 - 2 * (q[1] * q[1] + q[2] * q[2]));
  for (const animation of root.listAnimations()) {
    const name = animation.getName();
    const channel = animation.listChannels().find(c => c.getTargetNode()?.getName() === 'Root');
    if (!channel) continue;
    const output = channel.getSampler().getOutput();
    const count = output.getCount(), first = output.getElement(0, []), last = output.getElement(count - 1, []);
    if (name.startsWith('turn')) {
      // yaw of last relative to first: last * inverse(first)
      const inv = [-first[0], -first[1], -first[2], first[3]];
      const q = [last[3] * inv[0] + last[0] * inv[3] + last[1] * inv[2] - last[2] * inv[1],
        last[3] * inv[1] - last[0] * inv[2] + last[1] * inv[3] + last[2] * inv[0],
        last[3] * inv[2] + last[0] * inv[1] - last[1] * inv[0] + last[2] * inv[3],
        last[3] * inv[3] - last[0] * inv[0] - last[1] * inv[1] - last[2] * inv[2]];
      const degrees = Math.abs(quatYaw(q)) * 180 / Math.PI;
      assert.ok(Math.abs(degrees - Number(name.match(/\d+$/)[0])) < 1.5, `${name} ends at ${degrees.toFixed(1)}°`);
    } else if (name.startsWith('bed')) {
      const dy = last[1] - first[1], dz = last[2] - first[2];
      assert.ok(Math.abs(dy - (name === 'bedin' ? .085 : -.085)) < .01, `${name} climbs/drops the cushion height (got ${dy.toFixed(3)})`);
      assert.ok(Math.abs(dz - .55) < .02, `${name} travels .55 m forward (got ${dz.toFixed(3)})`);
    } else {
      const dy = last[1] - first[1], dz = last[2] - first[2];
      // .761 m is the real desktop span (take-off lane z .80 to the lying spot at .0389), so the runtime's warp
      // is the identity there and the authored forepaw contact really lands on the cap edge.
      assert.ok(Math.abs(Math.abs(dy) - 1.95) < .02, `${name} rises/drops 1.95 m (got ${dy.toFixed(3)})`);
      assert.ok(Math.abs(dz - .761) < .02, `${name} travels .761 m forward (got ${dz.toFixed(3)})`);
    }
  }
});

test('jump-up decelerates monotonically from the hook into the landing and never rises above the roof', () => {
  const animation=root.listAnimations().find(a=>a.getName()==='jumpup');
  const sampler=animation.listChannels().find(c=>c.getTargetNode()?.getName()==='Root'&&c.getTargetPath()==='translation').getSampler();
  const times=sampler.getInput().getArray(),positions=sampler.getOutput();
  let peak = -Infinity, worst = 0, previous = Infinity;
  for (let i = 1; i < times.length; i++) {
    const a = positions.getElement(i - 1, []), b = positions.getElement(i, []);
    peak = Math.max(peak, b[1]);
    if (times[i] < .92) { previous = Infinity; continue; }          // still in the ballistic rise
    const dt = times[i] - times[i - 1];
    if (dt <= 0) continue;
    const speed = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / dt;
    if (previous < Infinity) worst = Math.max(worst, speed - previous);
    previous = speed;
  }
  assert.ok(peak <= 1.96, `the root never flies above the roof: peak ${peak.toFixed(3)} m`);
  assert.ok(worst < .06, `no re-acceleration after the hook: worst gain ${worst.toFixed(3)} m/s`);
});

test('morph targets keep their names and order, the materials and eyeballs exist', () => {
  const mesh = root.listMeshes().find(m => m.getExtras()?.targetNames);
  assert.ok(mesh, 'the skinned coat mesh carries morph targets');
  assert.deepEqual(mesh.getExtras().targetNames, MORPHS);
  for (const primitive of mesh.listPrimitives()) assert.equal(primitive.listTargets().length, MORPHS.length);
  const materials = root.listMaterials().map(m => m.getName());
  const nodes = root.listNodes().map(n => n.getName());
  if (ORIGINAL) {
    assert.deepEqual(materials, [`Blue coat v${VERSION}`, 'Blue amber eyes']);
    const [coat, eyes] = root.listMaterials();
    assert.ok(coat.getBaseColorTexture() && !coat.getNormalTexture(), 'the coat keeps the original atlas and no normal map');
    assert.deepEqual(coat.getBaseColorTexture().getSize(), [1024, 1024], 'the coat atlas is the 1024² base of the colour-preserving chain (blue-v6-atlas.mjs)');
    const eyeTexture = eyes.getBaseColorTexture();
    assert.ok(eyeTexture && eyeTexture !== coat.getBaseColorTexture(), 'the eye polygons have their own texture');
    assert.deepEqual(eyeTexture.getSize(), [1024, 1024], 'the open-eye texture');
    assert.ok(eyes.getBaseColorFactor()[1] < .7 && eyes.getBaseColorFactor()[2] < .3, 'the eye polygons keep their amber tint');
    assert.ok(nodes.length >= 27);
  } else if (V4) {
    assert.deepEqual(materials, [`Blue coat v${VERSION}`]);
    const coat = root.listMaterials()[0];
    assert.ok(coat.getBaseColorTexture() && coat.getNormalTexture(), 'the coat keeps its base colour and normal maps');
    assert.ok(nodes.length >= 27);
  } else {
    for (const name of ['Blue amber eyeball', 'Blue face', 'Blue ear back', 'Material_0']) assert.ok(materials.includes(name), name);
    for (const eye of ['Eye.L', 'Eye.R', 'Lid.U.L', 'Lid.U.R', 'Lid.D.L', 'Lid.D.R']) {
      const node = root.listNodes().find(n => n.getName() === eye);
      assert.ok(node?.getMesh(), `${eye} is a mesh node`);
      assert.equal(node.getParentNode()?.getName(), 'Head', `${eye} hangs off the Head bone`);
    }
    assert.ok(nodes.length >= 32);
  }
});

test('the v6 companion textures are in place', async () => {
  if (!ORIGINAL) return;
  const sharp = (await import('sharp')).default;
  const closed = await sharp(`public/models/blue-${BUILD}-closed.webp`).metadata();
  assert.deepEqual([closed.width, closed.height], [512, 512], 'closed-eye texture');
  const mips = await sharp(`public/models/blue-${BUILD}-mips.webp`).metadata();
  assert.deepEqual([mips.width, mips.height], [512, 1023], 'coat mip sheet: the levels 512..1 stacked in one column');
});

test('the file stays within its budget', async () => {
  const { stat } = await import('node:fs/promises');
  const bytes = (await stat(FILE)).size;
  assert.ok(bytes < (V4 ? 3_400_000 : 1_600_000), `${bytes} bytes`);
});

test('coat mip levels preserve average light instead of darkening with distance', async () => {
  if (!ORIGINAL) return;
  const sharp = (await import('sharp')).default;
  const energy = async image => {
    const {data,info}=await image.removeAlpha().raw().toBuffer({resolveWithObject:true});
    let sum=0;
    for(let i=0;i<data.length;i++){const s=data[i]/255;sum+=s<=.04045?s/12.92:((s+.055)/1.055)**2.4;}
    return sum/(info.width*info.height*info.channels);
  };
  const coat=root.listMaterials().find(m=>/coat/.test(m.getName())).getBaseColorTexture();
  const reference=await energy(sharp(Buffer.from(coat.getImage())));
  let top=0;
  for(let w=512;w>=4;w>>=1){
    const level=await energy(sharp(`public/models/blue-${BUILD}-mips.webp`).extract({left:0,top,width:w,height:w}));
    assert.ok(Math.abs(level/reference-1)<.12,`${w}px mip preserves average light: ${(level/reference).toFixed(3)}`);
    top+=w;
  }
});
