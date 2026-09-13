"""Rig a normalised Blue v4 mesh (from blue_v4_inspect.py) into the same 26-joint skeleton the clips are authored for.

blender --background --python scripts/models/blender/blue_v4_build.py -- normalised.glb outdir [rig-config.json]

Without a config the joints are proposed from the mesh (paw clusters, body bounds) and written to outdir/rig-config.json
for adjustment; a check render draws them over the mesh. Skin weights are capsule-distance falloffs per bone with
surface diffusion. The blink is a lid squash morph on the eye region plus a closed-eye copy of the base colour
texture (the runtime swaps it mid-blink), so nothing separate ever moves in the face.
Outputs: blue-v4-master.blend (armature + skin + BlueBlink), rig-config.json, joints.png, blue-v4-closed.png.
"""
import bpy, bmesh, sys, json, math
import numpy as np
from pathlib import Path
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
SRC = Path(args[0]).resolve(); OUT = Path(args[1]).resolve(); OUT.mkdir(parents=True, exist_ok=True)
CONFIG = Path(args[2]).resolve() if len(args) > 2 else None

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SRC))
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1: bpy.ops.object.join()
mesh = bpy.context.view_layer.objects.active; mesh.name = 'BlueCoat'
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=.000001); bpy.ops.object.mode_set(mode='OBJECT')
V = lambda p: Vector(p)
co = np.array([v.co[:] for v in mesh.data.vertices], dtype=np.float64)
lo, hi = co.min(axis=0), co.max(axis=0); H = hi[2] - lo[2]

# ---------------------------------------------------------------- joints
def components(z0, z1, min_faces=20):
    bm = bmesh.new(); bm.from_mesh(mesh.data)
    faces = [f for f in bm.faces if all(z0 <= v.co.z <= z1 for v in f.verts)]
    seen = set(); out = []
    for f in faces:
        if f.index in seen: continue
        stack = [f]; comp = []; seen.add(f.index)
        while stack:
            g = stack.pop(); comp.append(g)
            for e in g.edges:
                for n in e.link_faces:
                    if n.index not in seen and z0 <= min(v.co.z for v in n.verts) and max(v.co.z for v in n.verts) <= z1:
                        seen.add(n.index); stack.append(n)
        pts = np.array([v.co[:] for g in comp for v in g.verts])
        if len(comp) >= min_faces: out.append({'centre': pts.mean(axis=0), 'faces': len(comp), 'min': pts.min(axis=0), 'max': pts.max(axis=0)})
    bm.free(); return sorted(out, key=lambda c: -c['faces'])

def propose():
    paws = components(lo[2], lo[2] + .035)[:4]
    if len(paws) < 4: raise SystemExit(f'found {len(paws)} paw clusters at floor level; give a config')
    paws = sorted(paws, key=lambda c: c['centre'][1])
    front = sorted(paws[:2], key=lambda c: c['centre'][0]); hind = sorted(paws[2:], key=lambda c: c['centre'][0])
    fr, fl = front[0]['centre'], front[1]['centre']; hr, hl = hind[0]['centre'], hind[1]['centre']  # R has negative x
    fy = (fr[1] + fl[1]) / 2; hy = (hr[1] + hl[1]) / 2; fx = (fl[0] - fr[0]) / 2; hx = (hl[0] - hr[0]) / 2
    nose_y = lo[1]; tail_y = hi[1]
    # torso line: sample the body's vertical centre at a few stations between the legs
    def centre_z(y, half=.03):
        sel = co[(np.abs(co[:, 1] - y) < half) & (np.abs(co[:, 0]) < .06)]
        return float((sel[:, 2].max() + sel[:, 2].min()) / 2) if len(sel) else H * .6
    spine_z = centre_z((fy + hy) / 2); chest_z = centre_z(fy); pelvis_z = centre_z(hy)
    head_top = co[co[:, 1] < nose_y + .12][:, 2]
    head_z = float(head_top.max()) - .07 if len(head_top) else H * .85
    j = {
        'Root': [0, 0, 0],
        'Pelvis': [0, hy - .02, pelvis_z + .01], 'Spine': [0, (fy + hy) / 2 + .02, spine_z + .01], 'Chest': [0, fy + .03, chest_z + .01],
        'Neck': [0, fy - .03, chest_z + .07], 'Head': [0, nose_y + .10, head_z],
        'Ear.L': [.065, nose_y + .13, head_z + .06], 'Ear.R': [-.065, nose_y + .13, head_z + .06],
        'Tail0': [0, hy + .03, pelvis_z + .01],
    }
    for side, sx in (('L', 1), ('R', -1)):
        px = fx * sx; hpx = hx * sx
        j[f'FrontUpper.{side}'] = [px, fy + .02, chest_z - .03]; j[f'FrontLower.{side}'] = [px, fy + .03, chest_z * .45]; j[f'FrontPaw.{side}'] = [px, fy - .015, .023]
        j[f'HindUpper.{side}'] = [hpx, hy - .05, pelvis_z - .02]; j[f'HindLower.{side}'] = [hpx, hy + .04, pelvis_z * .45]; j[f'HindPaw.{side}'] = [hpx, hy - .01, .023]
    # tail: follow the rear-most vertices upward in steps
    t0 = np.array(j['Tail0']); tail_len = max(.20, (tail_y - hy) * .9)
    for i in range(1, 6):
        u = i / 5; j[f'Tail{i}'] = [0, float(t0[1] + tail_len * u * .85), float(t0[2] - .02 * u + .10 * math.sin(math.pi * u * .8))]
    return {'joints': j, 'radius': {'torso': .11, 'neck': .07, 'head': .09, 'ear': .03, 'leg': .045, 'paw': .04, 'tail': .035},
            'eyes': None, 'height': float(H), 'front_paw_y': float(fy), 'hind_paw_y': float(hy), 'nose_y': float(nose_y)}

config = json.loads(CONFIG.read_text()) if CONFIG else propose()
J = {k: V(v) for k, v in config['joints'].items()}
PARENT = {'Root': None, 'Pelvis': 'Root', 'Spine': 'Pelvis', 'Chest': 'Spine', 'Neck': 'Chest', 'Head': 'Neck', 'Ear.L': 'Head', 'Ear.R': 'Head'}
for s in 'LR':
    PARENT.update({f'FrontUpper.{s}': 'Chest', f'FrontLower.{s}': f'FrontUpper.{s}', f'FrontPaw.{s}': f'FrontLower.{s}',
                   f'HindUpper.{s}': 'Pelvis', f'HindLower.{s}': f'HindUpper.{s}', f'HindPaw.{s}': f'HindLower.{s}'})
for i in range(6): PARENT[f'Tail{i}'] = 'Pelvis' if i == 0 else f'Tail{i - 1}'
NAMES = list(PARENT)

# ---------------------------------------------------------------- armature
data = bpy.data.armatures.new('BlueQuadruped'); arm = bpy.data.objects.new('BlueRig', data)
bpy.context.collection.objects.link(arm)
bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
for n in NAMES:
    b = data.edit_bones.new(n); b.head = J[n]; b.tail = J[n] + V((0, 0, .025))
    if PARENT[n]: b.parent = data.edit_bones[PARENT[n]]
bpy.ops.object.mode_set(mode='OBJECT'); arm.show_in_front = True

# ---------------------------------------------------------------- weights: capsule falloff + surface diffusion
# Each bone influences vertices near the segment from its head to its child's head (or a stub for leaves), with a
# radius by body part; legs only reach vertices on their own side and below the torso line.
def segment(n):
    a = np.array(J[n]); kids = [k for k in NAMES if PARENT[k] == n and not k.startswith('Ear')]
    if n == 'Root': return None
    if n.startswith('Tail') and n != 'Tail5': b = np.array(J[f'Tail{int(n[4]) + 1}'])
    elif n in ('Pelvis',): b = np.array(J['Spine'])
    elif n == 'Spine': b = np.array(J['Chest'])
    elif n == 'Chest': b = np.array(J['Neck'])
    elif n == 'Neck': b = np.array(J['Head'])
    elif n == 'Head': b = a + np.array([0, -.08, .02])
    elif n.startswith('Ear'): b = a + np.array([0, 0, .05])
    elif 'Upper' in n: b = np.array(J[n.replace('Upper', 'Lower')])
    elif 'Lower' in n: b = np.array(J[n.replace('Lower', 'Paw')])
    elif 'Paw' in n: b = a + np.array([0, -.04, 0])
    elif n == 'Tail5': b = a + np.array([0, .04, .02])
    else: b = a
    return a, b
R = config['radius']
def radius(n):
    if n in ('Pelvis', 'Spine', 'Chest'): return R['torso']
    if n == 'Neck': return R['neck']
    if n == 'Head': return R['head']
    if n.startswith('Ear'): return R['ear']
    if 'Paw' in n: return R['paw']
    if n.startswith('Tail'): return R['tail']
    return R['leg']
W = np.zeros((len(co), len(NAMES)), dtype=np.float64)
torso_z = min(J['Chest'].z, J['Pelvis'].z) - .02
for i, n in enumerate(NAMES):
    seg = segment(n)
    if seg is None: continue
    a, b = seg; d = b - a; L2 = float(d @ d) or 1e-9
    t = np.clip(((co - a) @ d) / L2, 0, 1)
    dist = np.linalg.norm(co - (a + t[:, None] * d), axis=1)
    w = np.exp(-(dist / radius(n)) ** 2 * 1.2)
    if 'Front' in n or 'Hind' in n:
        side = 1 if n.endswith('.L') else -1
        w *= (np.sign(co[:, 0]) == side) | (np.abs(co[:, 0]) < .012)
        w *= co[:, 2] < torso_z + (.04 if 'Upper' in n else 0)
    if n.startswith('Ear'):
        side = 1 if n.endswith('.L') else -1
        w *= (np.sign(co[:, 0]) == side)
    W[:, i] = w
W[:, NAMES.index('Root')] = 0
# vertices nothing reaches fall back to the nearest torso bone
empty = W.sum(axis=1) < 1e-6
if empty.any():
    for idx in np.where(empty)[0]:
        best = min(('Pelvis', 'Spine', 'Chest', 'Head'), key=lambda n: np.linalg.norm(co[idx] - np.array(J[n]))); W[idx, NAMES.index(best)] = 1
W /= W.sum(axis=1, keepdims=True)
edges = np.array([list(e.vertices) for e in mesh.data.edges]); degree = np.bincount(edges.ravel(), minlength=len(co)).clip(1)
for _ in range(14):
    s = np.zeros_like(W); np.add.at(s, edges[:, 0], W[edges[:, 1]]); np.add.at(s, edges[:, 1], W[edges[:, 0]])
    W = W * .4 + (s / degree[:, None]) * .6
for n in NAMES: mesh.vertex_groups.new(name=n)
for v in mesh.data.vertices:
    ids = np.argsort(W[v.index])[-4:]; ws = W[v.index, ids]; ws /= max(ws.sum(), 1e-9)
    for i, w in zip(ids, ws):
        if w > 1e-4: mesh.vertex_groups[NAMES[i]].add([v.index], float(w), 'REPLACE')
mod = mesh.modifiers.new('Blue skin', 'ARMATURE'); mod.object = arm; mesh.parent = arm

# ---------------------------------------------------------------- eyes: lid squash morph + closed texture
mesh.shape_key_add(name='Basis')
closed = mesh.shape_key_add(name='BlueBlink')
base_image = None
for mat in mesh.data.materials:
    if not mat or not mat.use_nodes: continue
    for node in mat.node_tree.nodes:
        if node.type == 'TEX_IMAGE' and node.image and any(l.to_socket.name == 'Base Color' for l in node.outputs[0].links): base_image = node.image
eye_report = {}
if base_image is not None:
    Wd = base_image.size[0]; Hd = base_image.size[1]
    px = np.empty(Wd * Hd * 4, dtype=np.float32); base_image.pixels.foreach_get(px); img = px.reshape(Hd, Wd, 4)
    uv = mesh.data.uv_layers.active.data
    # per-vertex UV (first loop wins) and colour lookup
    vuv = np.zeros((len(co), 2)); seen = np.zeros(len(co), dtype=bool)
    for p in mesh.data.polygons:
        for li, vi in zip(p.loop_indices, p.vertices):
            if not seen[vi]: vuv[vi] = uv[li].uv[:]; seen[vi] = True
    ui = np.clip((vuv[:, 0] * Wd).astype(int), 0, Wd - 1); vi_ = np.clip((vuv[:, 1] * Hd).astype(int), 0, Hd - 1)
    col = img[vi_, ui, :3]
    # Iris texels are far brighter than the black fur; pink (nose, inner ears) is excluded by hue, and the search is
    # limited to the upper front of the head.
    lum = col @ np.array([.2126, .7152, .0722])
    pink = (col[:, 0] > col[:, 1] + .08) & (col[:, 0] > col[:, 2] - .02) & (col[:, 1] < .45)
    # iris texels are amber: red over green over a small blue; pale inner-ear highlights have blue close to red and
    # sit above the eye line, so the band is capped below the ear bases (the fur build's ears once passed as eyes)
    hue = (col[:, 0] > col[:, 1]) & (col[:, 2] < col[:, 0] * .5)
    amber = (lum > .15) & hue & ~pink & (co[:, 1] < config['nose_y'] + .16) & (co[:, 2] > H * .62) & (co[:, 2] < H * .86) & (np.abs(co[:, 0]) > .012) & (np.abs(co[:, 0]) < .07)
    eyes = {}
    for side, sx in (('L', 1), ('R', -1)):
        sel = amber & (np.sign(co[:, 0]) == sx)
        if sel.sum() < 6 and ('L' if sx < 0 else 'R') in eyes:
            # too few iris texels on this side: mirror the other eye and take the vertices around the mirrored centre
            m = np.array(eyes['L' if sx < 0 else 'R']['centre']) * np.array([-1, 1, 1]); sel = np.linalg.norm(co - m, axis=1) < .012
            print('BLUE_V4_EYE_MIRRORED', side, int(sel.sum()), flush=True)
        if sel.sum() < 6: continue
        # keep the dense cluster around the median (stray bright texels elsewhere on the head would inflate the radius)
        for _ in range(3):
            med = np.median(co[sel], axis=0); keep = np.linalg.norm(co - med, axis=1) < .02
            if (sel & keep).sum() >= 6: sel = sel & keep
        c = co[sel].mean(axis=0); r = min(.022, float(np.linalg.norm(co[sel] - c, axis=1).max()) + .004)
        eyes[side] = {'centre': [round(float(x), 4) for x in c], 'radius': round(r, 4), 'vertices': int(sel.sum())}
        # squash: vertices near the eye move toward the eye's horizontal midline (lids meeting) and sink a little
        d = np.linalg.norm(co - c, axis=1); infl = np.clip(1 - (d - r * .9) / (r * .8), 0, 1); infl = infl * infl * (3 - 2 * infl)
        for idx in np.where(infl > 0)[0]:
            p = closed.data[idx].co; dz = p.z - c[2]
            p.z -= dz * .88 * infl[idx]; p.y += .003 * infl[idx]  # skin pulls in (+y is backwards)
        # closed-eye texture: paint the amber texels with the surrounding fur colour, a soft dark lid line across
        sel_uv = vuv[sel]; cu, cv = sel_uv.mean(axis=0); ru = float(np.abs(sel_uv - [cu, cv]).max()) * 1.25 + 2 / Wd
        yy, xx = np.mgrid[0:Hd, 0:Wd]; du = (xx / Wd - cu); dv = (yy / Hd - cv); inside = (du * du + dv * dv) < ru * ru
        ring = ((du * du + dv * dv) < (ru * 1.6) ** 2) & ~inside
        fur = np.median(img[ring][:, :3], axis=0) if ring.any() else np.array([.03, .03, .035])
        img[inside, :3] = fur * .9
        line = (np.abs(dv) < ru * .12) & inside; img[line, :3] = fur * .45
    eye_report = eyes
    closed_img = bpy.data.images.new('BlueCoatClosed', Wd, Hd, alpha=False); closed_img.pixels.foreach_set(img.ravel()); closed_img.pack()
    closed_img.filepath_raw = str(OUT / 'blue-v4-closed.png'); closed_img.file_format = 'PNG'; closed_img.save()
config['eyes'] = eye_report

# ---------------------------------------------------------------- check render with joints, save
scene = bpy.context.scene; scene.render.engine = 'BLENDER_EEVEE'; scene.render.resolution_x = scene.render.resolution_y = 1100
world = bpy.data.worlds.new('W'); scene.world = world; world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (.5, .5, .55, 1); world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.2
for loc in ((1, -2, 2), (-2, 1, 1.5), (0, 2, 2)):
    d = bpy.data.lights.new('L', 'AREA'); d.energy = 60; d.size = 2; o = bpy.data.objects.new('L', d); scene.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector((0, 0, .2)) - o.location).to_track_quat('-Z', 'Y').to_euler()
dot = bpy.data.materials.new('Joint'); dot.diffuse_color = (1, .2, .1, 1); dot.use_backface_culling = False
dot.use_nodes = True; dot.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (1, .15, .1, 1); dot.node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value = (1, .2, .1, 1); dot.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 2
# the coat is drawn see-through so the joints inside it can be checked
for mat in mesh.data.materials:
    if not mat: continue
    mat.surface_render_method = 'BLENDED'
    if mat.use_nodes and 'Principled BSDF' in mat.node_tree.nodes: mat.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value = .28
marks = []
for n in NAMES:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=6, radius=.009, location=J[n]); s = bpy.context.object; s.data.materials.append(dot); marks.append(s)
    seg = segment(n)
    if seg is not None:
        a, b = seg; mid = (a + b) / 2; L = float(np.linalg.norm(b - a))
        bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=.003, depth=L, location=mid); c = bpy.context.object
        c.rotation_euler = Vector((b - a)).to_track_quat('Z', 'Y').to_euler(); c.data.materials.append(dot); marks.append(c)
cd = bpy.data.cameras.new('C'); cd.type = 'ORTHO'; cd.ortho_scale = .75; cam = bpy.data.objects.new('C', cd); scene.collection.objects.link(cam); scene.camera = cam
aim = Vector((0, 0, H / 2)); tiles = []
for name, loc in (('side', (3, 0, H / 2)), ('front', (0, -3, H / 2)), ('top', (0, 0, 3))):
    cam.location = loc; cam.rotation_euler = (aim - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(OUT / f'joints-{name}.png'); bpy.ops.render.render(write_still=True)
for m in marks: bpy.data.objects.remove(m)
for mat in mesh.data.materials:
    if not mat: continue
    mat.surface_render_method = 'DITHERED'
    if mat.use_nodes and 'Principled BSDF' in mat.node_tree.nodes: mat.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value = 1.0
for pb in arm.pose.bones: pb.rotation_mode = 'QUATERNION'
bpy.ops.file.pack_all()
(OUT / 'rig-config.json').write_text(json.dumps(config, indent=1))
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'blue-v4-master.blend'))
print('BLUE_V4_BUILT', json.dumps({'vertices': len(co), 'eyes': eye_report, 'height': round(H, 3)}), flush=True)
