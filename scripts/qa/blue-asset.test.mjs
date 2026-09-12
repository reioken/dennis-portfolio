// Structure guard for Blue's runtime GLB: an optimiser pass (resample, Meshopt) must not rename or drop what the
// runtime looks up by name — bones, clips, morph targets, materials — nor lose the Root motion on turn and jump clips.
import test from 'node:test';
import assert from 'node:assert/strict';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const FILE = process.env.BLUE_GLB || 'public/models/blue-rigged-v2.glb';
const BONES = ['Root', 'Pelvis', 'Spine', 'Chest', 'Neck', 'Head', 'Ear.L', 'Ear.R',
  'FrontUpper.L', 'FrontLower.L', 'FrontPaw.L', 'FrontUpper.R', 'FrontLower.R', 'FrontPaw.R',
  'HindUpper.L', 'HindLower.L', 'HindPaw.L', 'HindUpper.R', 'HindLower.R', 'HindPaw.R',
  'Tail0', 'Tail1', 'Tail2', 'Tail3', 'Tail4', 'Tail5'];
const CLIPS = ['arch', 'flick', 'happy', 'idle', 'jumpdown', 'jumpup', 'perch', 'perchidle', 'settle', 'sit', 'sitidle', 'sleep', 'stand', 'trot',
  'turnL45', 'turnL90', 'turnR45', 'turnR90', 'unperch', 'wake', 'walk'];
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
    if (name.startsWith('turn')) assert.ok(rootChannels.includes('rotation'), `${name} has a Root rotation channel`);
    else if (name.startsWith('jump')) assert.ok(rootChannels.includes('translation'), `${name} has a Root translation channel`);
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
      assert.ok(Math.abs(degrees - (name.endsWith('90') ? 90 : 45)) < 1.5, `${name} ends at ${degrees.toFixed(1)}°`);
    } else {
      const dy = last[1] - first[1], dz = last[2] - first[2];
      assert.ok(Math.abs(Math.abs(dy) - 1.95) < .02, `${name} rises/drops 1.95 m (got ${dy.toFixed(3)})`);
      assert.ok(Math.abs(dz - .63) < .02, `${name} travels .63 m forward (got ${dz.toFixed(3)})`);
    }
  }
});

test('morph targets keep their names and order, the materials and eyeballs exist', () => {
  const mesh = root.listMeshes().find(m => m.getExtras()?.targetNames);
  assert.ok(mesh, 'the skinned coat mesh carries morph targets');
  assert.deepEqual(mesh.getExtras().targetNames, MORPHS);
  for (const primitive of mesh.listPrimitives()) assert.equal(primitive.listTargets().length, MORPHS.length);
  const materials = root.listMaterials().map(m => m.getName());
  for (const name of ['Blue amber eyeball', 'Blue face', 'Material_0']) assert.ok(materials.includes(name), name);
  const nodes = root.listNodes().map(n => n.getName());
  for (const eye of ['Eye.L', 'Eye.R']) {
    const node = root.listNodes().find(n => n.getName() === eye);
    assert.ok(node?.getMesh(), `${eye} is a mesh node`);
    assert.equal(node.getParentNode()?.getName(), 'Head', `${eye} hangs off the Head bone`);
  }
  assert.ok(nodes.length >= 28);
});

test('the file stays within its budget', async () => {
  const { stat } = await import('node:fs/promises');
  const bytes = (await stat(FILE)).size;
  assert.ok(bytes < 1_600_000, `${bytes} bytes`);
});
