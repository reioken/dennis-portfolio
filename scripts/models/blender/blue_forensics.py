"""Eye forensics: which deformation moves Blue's eyes during the leap?

blender --background --python scripts/models/blender/blue_forensics.py -- [blend] [outdir]
Defaults: .source-assets/blue/v3/blue-animated-v2.blend, .source-assets/blue/v3/forensics/

Reports every shape key's deltas grouped by the vertices' dominant bone (and on the eye polygons
in particular), the skin weights on eye and socket vertices, and renders the jump clip's launch
frames one suspect at a time: no morphs, blink only, each corrective only, and all together.
"""
import bpy, json, sys
from collections import defaultdict
from mathutils import Vector
from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
# Absolute paths: Blender resolves relative render paths against the drive root, not the working directory.
BLEND = (Path(args[0]) if args else ROOT / '.source-assets/blue/v3/blue-animated-v2.blend').resolve()
OUT = (Path(args[1]) if len(args) > 1 else ROOT / '.source-assets/blue/v3/forensics').resolve()
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(BLEND))
arm = bpy.data.objects['BlueRig']; mesh = bpy.data.objects['BlueCoat']; scene = bpy.context.scene
me = mesh.data; groups = {g.index: g.name for g in mesh.vertex_groups}
report = {}

# ---------------------------------------------------------------- eye and socket vertex sets
eye_verts = {i for p in me.polygons if p.material_index == 1 for i in p.vertices}
eye_centre = {}
for side, sign in (('L', 1), ('R', -1)):
    pts = [me.vertices[i].co for i in eye_verts if sign * me.vertices[i].co.x > 0]
    eye_centre[side] = sum(pts, Vector()) / max(1, len(pts))
socket_verts = set()
for v in me.vertices:
    if v.index in eye_verts: continue
    for side in 'LR':
        if (v.co - eye_centre[side]).length < .03: socket_verts.add(v.index)
def dominant(v):
    best = max(v.groups, key=lambda g: g.weight, default=None)
    return groups[best.group] if best else None
def weight_summary(indices):
    summary = defaultdict(float); partial = 0
    for i in indices:
        v = me.vertices[i]
        for g in v.groups: summary[groups[g.group]] += g.weight
        if any(groups[g.group] != 'Head' and g.weight > .05 for g in v.groups): partial += 1
    total = max(1e-9, sum(summary.values()))
    return {'count': len(indices), 'not_pure_head': partial, 'weights': {k: round(v / total, 3) for k, v in sorted(summary.items(), key=lambda kv: -kv[1])}}
report['eye_vertices'] = weight_summary(eye_verts)
report['socket_vertices'] = weight_summary(socket_verts)
# Blender's armature modifier leaves (1 - sum of weights) of every vertex at its rest position; a corrective that
# ignores that remainder sees under-weighted vertices near the origin and 'lifts' them by huge amounts.
sums = [sum(g.weight for g in v.groups) for v in me.vertices]
report['weight_sums'] = {'vertices': len(sums), 'below_0.01': sum(s < .01 for s in sums), 'below_0.5': sum(s < .5 for s in sums), 'below_0.99': sum(s < .99 for s in sums),
    'eye_below_0.5': sum(sums[i] < .5 for i in eye_verts), 'head_dominant_below_0.5': sum(sums[v.index] < .5 for v in me.vertices if dominant(v) == 'Head')}

# ---------------------------------------------------------------- shape-key deltas
basis = me.shape_keys.key_blocks['Basis']
report['shape_keys'] = {}
for key in me.shape_keys.key_blocks:
    if key.name == 'Basis': continue
    by_bone = defaultdict(lambda: [0, 0.]); eye_max = 0; eye_hit = 0; socket_max = 0; socket_hit = 0
    for i, (b, k) in enumerate(zip(basis.data, key.data)):
        d = (k.co - b.co).length
        if d < 1e-6: continue
        bone = dominant(me.vertices[i]); by_bone[bone][0] += 1; by_bone[bone][1] = max(by_bone[bone][1], d)
        if i in eye_verts: eye_hit += 1; eye_max = max(eye_max, d)
        if i in socket_verts: socket_hit += 1; socket_max = max(socket_max, d)
    report['shape_keys'][key.name] = {'eye_vertices_moved': eye_hit, 'eye_max_delta_mm': round(eye_max * 1000, 2),
        'socket_vertices_moved': socket_hit, 'socket_max_delta_mm': round(socket_max * 1000, 2),
        'by_dominant_bone': {k: {'vertices': v[0], 'max_mm': round(v[1] * 1000, 2)} for k, v in sorted(by_bone.items(), key=lambda kv: -kv[1][0])}}

# ---------------------------------------------------------------- render matrix on the launch frames
scene.render.engine = 'BLENDER_EEVEE'; scene.render.resolution_x = 720; scene.render.resolution_y = 600; scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new('Studio'); scene.world.use_nodes = True
bg = scene.world.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (.04, .045, .06, 1); bg.inputs['Strength'].default_value = .5
def light(loc, power, color):
    d = bpy.data.lights.new('Softbox', 'AREA'); d.energy = power; d.size = 2; d.color = color
    o = bpy.data.objects.new('Softbox', d); scene.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector((0, 0, .24)) - o.location).to_track_quat('-Z', 'Y').to_euler()
light((-1, -2, 2), 90, (1, .85, .7)); light((2, -1, 1), 60, (.68, .74, 1)); light((0, 2, 2), 110, (.72, .64, 1))
cd = bpy.data.cameras.new('Camera'); cam = bpy.data.objects.new('Camera', cd); scene.collection.objects.link(cam); scene.camera = cam
cd.type = 'ORTHO'; cd.ortho_scale = .36  # head close-up
blocks = me.shape_keys.key_blocks
keys = [k.name for k in blocks if k.name != 'Basis']
CASES = [('none', {})] + [(k, {k: 1.}) for k in keys] + [('all', {k: 1. for k in keys})]
VIEWS = {'front': (0, -2.4, .45), 'level': (0, -2.4, .3), 'low': (0, -2.4, -.3)}
action = bpy.data.actions['jump']; arm.animation_data.action = action; arm.animation_data.action_slot = action.slots[0]
for frame in (0, 12, 18):
    scene.frame_set(frame); bpy.context.view_layer.update()
    head = arm.pose.bones['Head']; head_world = arm.matrix_world @ head.head
    for case, values in CASES:
        for k in keys: blocks[k].value = values.get(k, 0.)
        for view, loc in VIEWS.items():
            if case not in ('none', 'BlueBlink', 'all') and view != 'level': continue
            cam.location = Vector(loc); cam.rotation_euler = (head_world - cam.location).to_track_quat('-Z', 'Y').to_euler()
            scene.render.filepath = str(OUT / f'jump-{frame:02d}-{case}-{view}.png'); bpy.ops.render.render(write_still=True)
for k in keys: blocks[k].value = 0.
(OUT / 'eye-forensics.json').write_text(json.dumps(report, indent=2)); print(json.dumps(report, indent=1))
