"""Author Blue's clips on the skinned master and export the v2 runtime GLB.

blender --background --python scripts/models/blender/blue_animate.py

Input:  .source-assets/blue/v3/blue-rigged-master.blend (skin from blue_rig.py)
Output: .source-assets/blue/v3/blue-animated-v2.blend, blue-rigged-v2.glb, blue-coat-clean.png

The pose builder works positions-first: torso, legs and tail get target joint
positions per frame, segment lengths are restored along each chain and bone
rotations follow the posed segment directions. Every clip is sampled at 30 fps
without exporter key decimation so slow motion stays continuous.
"""
import bpy, math, json, struct
import numpy as np
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion

ROOT = Path(__file__).resolve().parents[3]
WORK = ROOT / '.source-assets/blue/v3'
MASTER = WORK / 'blue-rigged-master.blend'
OUT_BLEND = WORK / 'blue-animated-v2.blend'
OUT_GLB = WORK / 'blue-rigged-v2.glb'
FPS = 30

bpy.ops.wm.open_mainfile(filepath=str(MASTER))
arm = bpy.data.objects['BlueRig']; mesh = bpy.data.objects['BlueCoat']; data = arm.data
scene = bpy.context.scene; scene.render.fps = FPS

# ---------------------------------------------------------------- reset
arm.animation_data_clear()
for a in list(bpy.data.actions): bpy.data.actions.remove(a)
blocks = mesh.data.shape_keys.key_blocks
if 'BlueGround' in blocks: mesh.shape_key_remove(blocks['BlueGround'])
for pb in arm.pose.bones: pb.matrix_basis = Matrix.Identity(4)

names = [b.name for b in data.bones]
heads = {b.name: b.head_local.copy() for b in data.bones}
parents = {b.name: (b.parent.name if b.parent else None) for b in data.bones}
rest = {n: data.bones[n].matrix_local.copy() for n in names}
restq = {n: m.to_quaternion() for n, m in rest.items()}
TAIL = [f'Tail{i}' for i in range(6)]
TORSO = ['Pelvis', 'Spine', 'Chest', 'Neck', 'Head']

V = lambda p: Vector(p)
clamp = lambda t: max(0., min(1., t))
def smooth(t):
    t = clamp(t); return t * t * (3 - 2 * t)
def ease(t, a, b): return smooth((t - a) / (b - a))
def pulse(t, start, dur):
    u = (t - start) / dur
    return math.sin(math.pi * u) ** 2 if 0 < u < 1 else 0.
def q(axis, angle): return Quaternion(V(axis), angle)
def ik(a, c, l1, l2, bend):
    d = c - a; distance = min(d.length, l1 + l2 - .00001); axis = d.normalized()
    along = (l1 * l1 - l2 * l2 + distance * distance) / (2 * max(distance, .00001))
    height = math.sqrt(max(0, l1 * l1 - along * along))
    b = V(bend); b = (b - axis * b.dot(axis)).normalized()
    return a + axis * along + b * height

# Tail shapes as offsets from Tail0 (rest curl, carried upright, resting on the floor beside the body).
TAIL_REST = [heads[n] - heads['Tail0'] for n in TAIL]
TAIL_UP = [V(v) for v in [(0, 0, 0), (0, .038, .06), (0, .044, .136), (0, .025, .192), (0, -.021, .213), (0, -.055, .188)]]
TAIL_FLOOR = [V(v) for v in [(0, 0, 0), (0, .07, -.08), (.045, .11, -.135), (.10, .07, -.138), (.115, -.02, -.138), (.115, -.09, -.138)]]
DROP = {'Pelvis': .10, 'Spine': .095, 'Chest': .085, 'Neck': .06, 'Head': .05}

def base():
    return {
        'rest': {'torso': 0., 'front': 0., 'hind': 0., 'tail': 0., 'head': 0.},
        'bob': 0., 'sway': 0., 'push': 0., 'head_lift': 0.,
        'yaw': {n: 0. for n in TORSO}, 'roll': {n: 0. for n in TORSO},
        'head': {'yaw': 0., 'pitch': 0., 'roll': 0.},
        'ears': {'L': [0., 0.], 'R': [0., 0.]},
        'legs': {(leg, side): {'dx': 0., 'dy': 0., 'dz': 0., 'pitch': 0.} for leg in ('Front', 'Hind') for side in 'LR'},
        'tail_lift': 0., 'tail_wave': [0.] * 6, 'tail_lift_wave': [0.] * 6,
    }

def solve(P):
    r = P['rest']; p = {}; rot = {}
    p['Root'] = V((0, 0, 0)); rot['Root'] = Quaternion()
    for n in TORSO:
        v = heads[n].copy()
        v.z += P['bob'] - DROP[n] * (r['torso'] if n in ('Pelvis', 'Spine', 'Chest') else r['head'])
        v.x += P['sway']; v.y += P['push']
        if n == 'Head': v.z += P['head_lift']
        p[n] = v
    for a, b in zip(TORSO, TORSO[1:]):
        d = p[b] - p[a]; p[b] = p[a] + d.normalized() * (heads[b] - heads[a]).length
    for n, nxt in [('Pelvis', 'Spine'), ('Spine', 'Chest'), ('Chest', 'Neck'), ('Neck', 'Head')]:
        r0 = heads[nxt] - heads[n]; r1 = p[nxt] - p[n]
        rot[n] = q((0, 0, 1), P['yaw'][n]) @ q(r1.normalized(), P['roll'][n]) @ r0.rotation_difference(r1)
    h = P['head']
    rot['Head'] = q((0, 0, 1), h['yaw']) @ q((1, 0, 0), h['pitch']) @ q((0, 1, 0), h['roll']) @ rot['Neck'].slerp(Quaternion(), .5)
    for side in 'LR':
        ear = 'Ear.' + side
        p[ear] = p['Head'] + rot['Head'] @ (heads[ear] - heads['Head'])
        pitch, yaw = P['ears'][side]
        rot[ear] = rot['Head'] @ q((1, 0, 0), pitch) @ q((0, 0, 1), yaw)
    for side in 'LR':
        sx = 1 if side == 'L' else -1
        for leg, parent, amount in [('Front', 'Chest', r['front']), ('Hind', 'Pelvis', r['hind'])]:
            up, low, paw = [f'{leg}{part}.{side}' for part in ('Upper', 'Lower', 'Paw')]
            a = p[parent] + rot[parent] @ (heads[up] - heads[parent])
            L = P['legs'][(leg, side)]
            c = heads[paw] + V((L['dx'], L['dy'], L['dz']))
            if leg == 'Front': rc = V((sx * .072, -.365, .023)); rb = V((0, .35, -1))
            else: rc = V((sx * .088, .035, .023)); rb = V((0, 1, -.15))
            c = c.lerp(rc, amount); bend = V((0, 1, 0)).lerp(rb, amount)
            b = ik(a, c, (heads[low] - heads[up]).length, (heads[paw] - heads[low]).length, bend)
            p[up], p[low], p[paw] = a, b, c
            rot[up] = (heads[low] - heads[up]).rotation_difference(b - a)
            rot[low] = (heads[paw] - heads[low]).rotation_difference(c - b)
            rot[paw] = q((1, 0, 0), L['pitch'])
    t0 = p['Pelvis'] + rot['Pelvis'] @ (heads['Tail0'] - heads['Pelvis'])
    for i, n in enumerate(TAIL):
        off = TAIL_REST[i].lerp(TAIL_UP[i], P['tail_lift']).lerp(TAIL_FLOOR[i], r['tail'])
        off = off + V((P['tail_wave'][i], 0, P['tail_lift_wave'][i]))
        p[n] = t0 + off
    for i in range(1, len(TAIL)):
        prev, n = TAIL[i - 1], TAIL[i]
        p[n] = p[prev] + (p[n] - p[prev]).normalized() * (heads[n] - heads[prev]).length
    for i in range(len(TAIL) - 1):
        rot[TAIL[i]] = (heads[TAIL[i + 1]] - heads[TAIL[i]]).rotation_difference(p[TAIL[i + 1]] - p[TAIL[i]])
    rot['Tail5'] = rot['Tail4']
    return {n: Matrix.Translation(p[n]) @ rot[n].to_matrix().to_4x4() @ restq[n].to_matrix().to_4x4() for n in names}

# ---------------------------------------------------------------- clips
STRIDE_SPEED = .19; WALK_CYCLE = 1.2; STANCE = .65

def idle(t, D):
    P = base(); w = math.tau * t / D
    P['bob'] = .0016 * math.sin(math.tau * t / (D / 3))
    P['sway'] = .005 * math.sin(w); P['roll']['Pelvis'] = .02 * math.sin(w); P['roll']['Chest'] = -.012 * math.sin(w)
    look_l = pulse(t, 1.2, 3.0); look_r = pulse(t, 5.2, 2.6)
    P['head']['yaw'] = .30 * look_l - .24 * look_r
    P['head']['pitch'] = -.05 * look_l + .03 * look_r
    P['head']['roll'] = .05 * look_r
    for side, flick in (('L', pulse(t, 2.4, .30)), ('R', pulse(t, 6.5, .30))):
        P['ears'][side][0] = .40 * flick + .02 * math.sin(w)
        P['ears'][side][1] = (.08 if side == 'L' else -.08) * P['head']['yaw']
    for i in range(6):
        k = i / 5
        P['tail_wave'][i] = math.sin(math.tau * t / (D / 2) - i * .55) * .012 * k * (1 + k) + pulse(t, 4.6, .55) * .03 * k * k
        P['tail_lift_wave'][i] = math.sin(w - i * .4) * .006 * k
    return P

def walk(t, D):
    P = base(); ph = math.tau * t / D
    P['bob'] = .003 * math.sin(2 * ph + .4)
    P['roll']['Pelvis'] = .022 * math.sin(ph); P['roll']['Chest'] = .016 * math.sin(ph + .3)
    P['yaw']['Pelvis'] = .04 * math.sin(ph); P['yaw']['Chest'] = -.03 * math.sin(ph)
    P['head']['yaw'] = -.02 * math.sin(ph); P['head']['pitch'] = .015 * math.sin(2 * ph)
    stride = STRIDE_SPEED * D * STANCE
    for (leg, side), offset in {('Hind', 'L'): 0, ('Front', 'L'): .25, ('Hind', 'R'): .5, ('Front', 'R'): .75}.items():
        L = P['legs'][(leg, side)]; cycle = (t / D + offset) % 1
        if cycle < STANCE:
            L['dy'] = -stride / 2 + stride * cycle / STANCE
        else:
            u = (cycle - STANCE) / (1 - STANCE)
            L['dy'] = stride / 2 - stride * smooth(u)
            L['dz'] = math.sin(math.pi * u) * .04
            L['pitch'] = .5 * math.sin(math.pi * u) * (1 - u) ** .5
    P['tail_lift'] = .12
    for i in range(6):
        k = i / 5; P['tail_wave'][i] = math.sin(ph - i * .5) * .018 * k
    return P

def rest_amounts(front, torso, hind, tail, head):
    return {'front': front, 'torso': torso, 'hind': hind, 'tail': tail, 'head': head}

def settle(t, D):
    P = base()
    P['rest'] = rest_amounts(ease(t, .2, 1.5), ease(t, .5, 1.9), ease(t, .8, 2.2), ease(t, 1.0, 2.4), ease(t, .6, 2.0))
    P['head']['pitch'] = .10 * P['rest']['head']
    return P

def sleep(t, D):
    P = base(); P['rest'] = rest_amounts(1, 1, 1, 1, 1)
    droop = (1 - math.cos(math.tau * t / D)) / 2
    P['bob'] = .002 * math.sin(math.tau * t / (D / 2))
    P['head']['pitch'] = .10 + .06 * droop; P['head']['roll'] = .03 * droop
    for side in 'LR': P['ears'][side][0] = .08 * droop
    P['tail_wave'][5] = .004 * math.sin(math.tau * t / D); P['tail_wave'][4] = .002 * math.sin(math.tau * t / D)
    return P

def wake(t, D):
    P = base()
    P['rest'] = rest_amounts(1 - ease(t, .7, 2.2), 1 - ease(t, .5, 1.9), 1 - ease(t, .2, 1.5), 1 - ease(t, .6, 2.3), 1 - ease(t, 0, 1.0))
    P['head']['pitch'] = .10 * P['rest']['head']
    return P

def happy(t, D):
    P = base(); w = math.tau * t / D
    P['head']['yaw'] = .10 * math.sin(2 * w); P['head']['pitch'] = -.10 + .05 * math.sin(2 * w); P['head']['roll'] = .18 * math.sin(w)
    P['head_lift'] = .006; P['push'] = -.006; P['roll']['Chest'] = .02 * math.sin(w)
    P['ears']['L'] = [.16, .05]; P['ears']['R'] = [.16, -.05]
    P['tail_lift'] = .95
    for i in range(6):
        k = i / 5; P['tail_wave'][i] = math.sin(2 * w - i * .45) * .02 * k
    return P

CLIPS = [('idle', 8.0, idle), ('walk', WALK_CYCLE, walk), ('settle', 2.4, settle), ('sleep', 6.0, sleep), ('wake', 2.4, wake), ('happy', 4.0, happy)]

# ---------------------------------------------------------------- floor contact corrective for the sphinx rest
corrective = mesh.shape_key_add(name='BlueGround')
restmats = solve(sleep(0, 6.0))
skin = {n: restmats[n] @ rest[n].inverted() for n in names}
groups = {g.index: g.name for g in mesh.vertex_groups}
lifted = 0
for v, cv in zip(mesh.data.vertices, corrective.data):
    matrix = Matrix(((0, 0, 0, 0),) * 4)
    for g in v.groups: matrix += skin[groups[g.group]] * g.weight
    posed = matrix @ v.co
    if posed.z < .002:
        cv.co += matrix.to_3x3().inverted_safe() @ V((0, 0, .002 - posed.z)); lifted += 1

# ---------------------------------------------------------------- bake clips
arm.animation_data_create()
actions = []
for label, duration, fn in CLIPS:
    action = bpy.data.actions.new(label); arm.animation_data.action = action
    frames = round(duration * FPS)
    for frame in range(frames + 1):
        mats = solve(fn(frame / FPS, duration))
        for n, pb in arm.pose.bones.items():
            parent = parents[n]
            basis = rest[n].inverted() @ (rest[parent] @ mats[parent].inverted() if parent else Matrix.Identity(4)) @ mats[n]
            pb.rotation_mode = 'QUATERNION'; pb.matrix_basis = basis
            pb.keyframe_insert('location', frame=frame); pb.keyframe_insert('rotation_quaternion', frame=frame)
    action.use_fake_user = True; actions.append(action)
arm.animation_data.action = None
for a in actions:
    track = arm.animation_data.nla_tracks.new(); track.name = a.name
    track.strips.new(a.name, 0, a); track.mute = True
for pb in arm.pose.bones: pb.matrix_basis = Matrix.Identity(4)

# ---------------------------------------------------------------- coat cleanup
# The Meshy atlas carries streaky high-frequency fur noise. Replace the dark coat
# with a smoothed, neutral satin black while keeping eyes, nose and ear interiors.
src = bpy.data.images['Image_0']
W = src.size[0]
px = np.empty(W * W * 4, dtype=np.float32); src.pixels.foreach_get(px)
img = px.reshape(W, W, 4)[:, :, :3]
S = 1024; f = W // S
img = img.reshape(S, f, S, f, 3).mean(axis=(1, 3))
lum = img @ np.array([.2126, .7152, .0722], dtype=np.float32)
sat = img.max(axis=2) - img.min(axis=2)
def sstep(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
# Keep only saturated bright detail (amber eyes, ear interiors) and the near-white whisker lines;
# grey fur streaks are low-saturation mid tones and belong to the coat.
def blur(a, radius):
    pad = np.pad(a, ((radius, radius), (radius, radius)) + ((0, 0),) * (a.ndim - 2), mode='edge')
    cs = np.cumsum(pad, axis=0); a = (cs[2 * radius:] - cs[:-2 * radius]) / (2 * radius)
    cs = np.cumsum(a, axis=1); return (cs[:, 2 * radius:] - cs[:, :-2 * radius]) / (2 * radius)
# The atlas is fragmented, so the amber eyes are found through the UVs of the eye polygons rather than by colour;
# baked highlight specks elsewhere would otherwise survive any colour threshold and glint under the hall lights.
uv_layer = mesh.data.uv_layers.active.data
yy, xx = np.mgrid[0:S, 0:S]
def rasterize(select):
    mask = np.zeros((S, S), dtype=np.float32)
    for polygon in mesh.data.polygons:
        if not select(polygon): continue
        pts = [np.array(uv_layer[l].uv, dtype=np.float64) * S for l in polygon.loop_indices]
        for i in range(1, len(pts) - 1):
            a, b, c = pts[0], pts[i], pts[i + 1]
            x0, x1 = int(max(0, min(a[0], b[0], c[0]) - 2)), int(min(S - 1, max(a[0], b[0], c[0]) + 2))
            y0, y1 = int(max(0, min(a[1], b[1], c[1]) - 2)), int(min(S - 1, max(a[1], b[1], c[1]) + 2))
            px = xx[y0:y1 + 1, x0:x1 + 1] + .5; py = yy[y0:y1 + 1, x0:x1 + 1] + .5
            edge = lambda p, q: (q[0] - p[0]) * (py - p[1]) - (q[1] - p[1]) * (px - p[0])
            e0, e1, e2 = edge(a, b), edge(b, c), edge(c, a)
            inside = ((e0 >= 0) & (e1 >= 0) & (e2 >= 0)) | ((e0 <= 0) & (e1 <= 0) & (e2 <= 0))
            mask[y0:y1 + 1, x0:x1 + 1] = np.maximum(mask[y0:y1 + 1, x0:x1 + 1], inside)
    # No dilation: atlas polygons are only a few texels wide, so any margin paints the neighbouring island.
    return mask
eye = rasterize(lambda polygon: polygon.material_index == 1)
# Cap the eye texels so the white catchlight cannot bleed into adjacent islands at coarse mip levels;
# the glossy eye material provides the real reflection at runtime.
eye_scale = np.where(eye > 0, np.minimum(1, .5 / np.maximum(lum, 1e-4)), 1)[:, :, None]
img = img * eye_scale
# Ear interiors: forward-facing polygons weighted to the ear bones. Only their pink survives; warm fur
# highlights elsewhere in the atlas are the specks that glinted on the face and chest.
ear_groups = {mesh.vertex_groups['Ear.L'].index, mesh.vertex_groups['Ear.R'].index}
def ear_weight(v): return sum(g.weight for g in v.groups if g.group in ear_groups)
inner_ear = rasterize(lambda polygon: polygon.normal.y < -.15 and sum(ear_weight(mesh.data.vertices[i]) for i in polygon.vertices) / len(polygon.vertices) > .5)
pink = (img[:, :, 0] > img[:, :, 2] + .06) & (img[:, :, 0] > img[:, :, 1]) & (lum > .16) & (sat > .08)
keep = np.maximum(eye, inner_ear * pink)
coat = 1 - keep
m3 = coat[:, :, None]
soft = blur(img * m3, 9) / np.maximum(blur(m3, 9), 1e-4)
flat = np.array([.075, .068, .078], dtype=np.float32)
grey = soft @ np.array([.2126, .7152, .0722], dtype=np.float32)
tone = flat[None, None, :] * (0.55 + 0.45 * np.clip(grey / .12, 0, 2))[:, :, None]
clean = img * (1 - m3) + (0.35 * soft + 0.65 * tone) * m3
out = np.ones((S, S, 4), dtype=np.float32); out[:, :, :3] = np.clip(clean, 0, 1)
cleaned = bpy.data.images.new('BlueCoatClean', S, S, alpha=False)
cleaned.pixels.foreach_set(out.ravel()); cleaned.pack()
cleaned.filepath_raw = str(WORK / 'blue-coat-clean.png'); cleaned.file_format = 'PNG'; cleaned.save()
for mat in mesh.data.materials:
    for node in mat.node_tree.nodes:
        if node.type == 'TEX_IMAGE' and node.image == src: node.image = cleaned
normal = bpy.data.images['Image_2']
if normal.size[0] > 1024: normal.scale(1024, 1024)

bpy.context.view_layer.update()
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
bpy.ops.object.select_all(action='DESELECT')
arm.select_set(True); mesh.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(filepath=str(OUT_GLB), export_format='GLB', use_selection=True,
    export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True,
    export_optimize_animation_size=False, export_morph=True, export_skins=True, export_all_influences=False,
    export_image_format='WEBP', export_image_quality=88)
# ---------------------------------------------------------------- GLB post-processing
# 1. Retain the amber multiply constant as the standard baseColorFactor (the exporter drops linked MixRGB constants).
# 2. Drop sampled channels that never leave the node's rest value (every scale channel, static translations)
#    and repack the binary chunk so the file only carries data that is referenced.
raw = OUT_GLB.read_bytes(); json_length = struct.unpack_from('<I', raw, 12)[0]
document = json.loads(raw[20:20 + json_length])
bin_length = struct.unpack_from('<I', raw, 20 + json_length)[0]; binary = raw[28 + json_length:28 + json_length + bin_length]
for material in document['materials']:
    if material.get('name') == 'Blue amber eyes': material['pbrMetallicRoughness']['baseColorFactor'] = [1, .58, .18, 1]
def accessor_values(index):
    accessor = document['accessors'][index]; view = document['bufferViews'][accessor['bufferView']]
    dtype = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5121: np.uint8}[accessor['componentType']]
    width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[accessor['type']]
    offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
    return np.frombuffer(binary, dtype=dtype, count=accessor['count'] * width, offset=offset).reshape(accessor['count'], width)
REST = {'translation': [0, 0, 0], 'rotation': [0, 0, 0, 1], 'scale': [1, 1, 1]}
dropped = 0
for animation in document['animations']:
    kept = []
    for channel in animation['channels']:
        sampler = animation['samplers'][channel['sampler']]; values = accessor_values(sampler['output'])
        target = channel['target']; node = document['nodes'][target['node']]
        rest_value = np.array(node.get(target['path'], REST[target['path']]), dtype=np.float32)
        if np.ptp(values, axis=0).max() < 1e-5 and np.abs(values[0] - rest_value).max() < 1e-5: dropped += 1; continue
        kept.append(channel)
    used = sorted({channel['sampler'] for channel in kept}); remap = {old: new for new, old in enumerate(used)}
    animation['samplers'] = [animation['samplers'][old] for old in used]
    for channel in kept: channel['sampler'] = remap[channel['sampler']]
    animation['channels'] = kept
used_accessors = set()
for m in document['meshes']:
    for primitive in m['primitives']:
        used_accessors.update(primitive['attributes'].values())
        if 'indices' in primitive: used_accessors.add(primitive['indices'])
        for target in primitive.get('targets', []): used_accessors.update(target.values())
for skin in document.get('skins', []):
    if 'inverseBindMatrices' in skin: used_accessors.add(skin['inverseBindMatrices'])
for animation in document['animations']:
    for sampler in animation['samplers']: used_accessors.update((sampler['input'], sampler['output']))
order = sorted(used_accessors); accessor_map = {old: new for new, old in enumerate(order)}
document['accessors'] = [document['accessors'][old] for old in order]
for m in document['meshes']:
    for primitive in m['primitives']:
        primitive['attributes'] = {k: accessor_map[v] for k, v in primitive['attributes'].items()}
        if 'indices' in primitive: primitive['indices'] = accessor_map[primitive['indices']]
        if 'targets' in primitive: primitive['targets'] = [{k: accessor_map[v] for k, v in target.items()} for target in primitive['targets']]
for skin in document.get('skins', []):
    if 'inverseBindMatrices' in skin: skin['inverseBindMatrices'] = accessor_map[skin['inverseBindMatrices']]
for animation in document['animations']:
    for sampler in animation['samplers']: sampler['input'] = accessor_map[sampler['input']]; sampler['output'] = accessor_map[sampler['output']]
used_views = []
def view_index(old):
    if old not in used_views: used_views.append(old)
    return used_views.index(old)
for accessor in document['accessors']:
    if 'bufferView' in accessor: accessor['bufferView'] = view_index(accessor['bufferView'])
    sparse = accessor.get('sparse')  # morph targets are exported sparse: indices and values live in their own views
    if sparse:
        sparse['indices']['bufferView'] = view_index(sparse['indices']['bufferView'])
        sparse['values']['bufferView'] = view_index(sparse['values']['bufferView'])
for image in document.get('images', []):
    if 'bufferView' in image: image['bufferView'] = view_index(image['bufferView'])
packed = bytearray(); views = []
for old in used_views:
    view = document['bufferViews'][old]; start = view.get('byteOffset', 0)
    while len(packed) % 4: packed += b'\0'
    fresh = dict(view); fresh['byteOffset'] = len(packed); views.append(fresh)
    packed += binary[start:start + view['byteLength']]
while len(packed) % 4: packed += b'\0'
document['bufferViews'] = views; document['buffers'] = [{'byteLength': len(packed)}]
encoded = json.dumps(document, separators=(',', ':')).encode(); encoded += b' ' * ((-len(encoded)) % 4)
body = struct.pack('<II', len(encoded), 0x4e4f534a) + encoded + struct.pack('<II', len(packed), 0x004e4942) + bytes(packed)
OUT_GLB.write_bytes(struct.pack('<III', 0x46546c67, 2, 12 + len(body)) + body)
(WORK / 'rig-report-v2.json').write_text(json.dumps({'clips': [{'name': a.name, 'frames': list(a.frame_range)} for a in actions],
    'ground_lifted_vertices': lifted, 'dropped_static_channels': dropped, 'glb_bytes': OUT_GLB.stat().st_size, 'coat_texture': S}, indent=2))
print('BLUE_ANIMATE_EXPORTED', OUT_GLB.stat().st_size, flush=True)
