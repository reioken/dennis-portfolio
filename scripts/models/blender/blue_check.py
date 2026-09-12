"""Render Blue's authored poses and measure skin stretch per clip.

blender --background --python scripts/models/blender/blue_check.py -- [blend] [outdir]
Defaults: .source-assets/blue/v3/blue-animated-v2.blend, .source-assets/blue/v3/check-v2/
"""
import bpy, json, sys
from mathutils import Vector
from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
BLEND = Path(args[0]) if args else ROOT / '.source-assets/blue/v3/blue-animated-v2.blend'
OUT = Path(args[1]) if len(args) > 1 else ROOT / '.source-assets/blue/v3/check-v2'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(BLEND))
arm = bpy.data.objects['BlueRig']; mesh = bpy.data.objects['BlueCoat']; scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'; scene.render.resolution_x = 960; scene.render.resolution_y = 800; scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new('Studio'); scene.world.use_nodes = True
bg = scene.world.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (.04, .045, .06, 1); bg.inputs['Strength'].default_value = .5
lights = []
def light(loc, power, color):
    d = bpy.data.lights.new('Softbox', 'AREA'); d.energy = power; d.size = 2; d.color = color
    o = bpy.data.objects.new('Softbox', d); scene.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector((0, 0, .24)) - o.location).to_track_quat('-Z', 'Y').to_euler()
    lights.append((o, Vector(loc)))
light((-1, -2, 2), 90, (1, .85, .7)); light((2, -1, 1), 60, (.68, .74, 1)); light((0, 2, 2), 110, (.72, .64, 1))
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.001)); floor = bpy.context.object
fm = bpy.data.materials.new('Floor'); fm.diffuse_color = (.07, .07, .08, 1); floor.data.materials.append(fm)
cd = bpy.data.cameras.new('Camera'); cam = bpy.data.objects.new('Camera', cd); scene.collection.objects.link(cam); scene.camera = cam
cd.type = 'ORTHO'; cd.ortho_scale = .92
# Marquee stand-in for the perch shots: top at z 0, front face at EDGE_Y (see blue_animate.py), so hanging legs stay visible.
EDGE_Y = -.25
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, EDGE_Y + .35, -.201)); ledge = bpy.context.object; ledge.scale = (.7, .7, .4)
lm = bpy.data.materials.new('Ledge'); lm.diffuse_color = (.16, .17, .2, 1); ledge.data.materials.append(lm)
VIEWS = {'three-quarter': (1.4, -2, 1), 'side': (2.4, 0, .5), 'front': (0, -2.4, .6),
         # The hall camera sees the cabinet top from below; these two views reproduce that angle.
         'low-front': (0, -2.4, -.55), 'low-quarter': (1.3, -2.1, -.5)}
LEDGE_SHOTS = {'perch', 'perchidle', 'unperch'}
lengths = [(mesh.data.vertices[e.vertices[0]].co - mesh.data.vertices[e.vertices[1]].co).length for e in mesh.data.edges]
SHOTS = [('idle', 0, 'three-quarter'), ('idle', 66, 'front'), ('walk', 9, 'side'), ('walk', 27, 'three-quarter'), ('trot', 4, 'side'), ('trot', 11, 'three-quarter'), ('wake', 15, 'three-quarter'), ('settle', 36, 'three-quarter'),
         ('sleep', 0, 'three-quarter'), ('sleep', 90, 'side'), ('sleep', 0, 'front'), ('happy', 30, 'three-quarter'), ('happy', 90, 'front'),
         ('sit', 54, 'three-quarter'), ('sitidle', 60, 'side'), ('sitidle', 30, 'front'), ('jumpup', 12, 'side'), ('jumpup', 17, 'side'), ('jumpup', 24, 'side'), ('jumpup', 30, 'side'), ('jumpup', 36, 'side'), ('jumpup', 29, 'side'), ('jumpdown', 10, 'side'), ('jumpdown', 17, 'side'), ('jumpdown', 24, 'side'), ('jumpdown', 30, 'side'), ('arch', 30, 'side'), ('arch', 30, 'three-quarter'), ('flick', 12, 'three-quarter'), ('flick', 22, 'front'),
         ('perch', 60, 'three-quarter'), ('perch', 60, 'side'), ('perchidle', 45, 'front'), ('perchidle', 45, 'low-front'), ('perchidle', 100, 'low-quarter'), ('perch', 30, 'side'),
         ('stand', 18, 'side'), ('unperch', 15, 'side'), ('unperch', 33, 'low-quarter'), ('turnL90', 12, 'three-quarter'), ('turnL90', 24, 'front'), ('turnL90', 36, 'three-quarter'), ('turnR45', 15, 'front')]
report = []
for label, frame, view in SHOTS:
    action = bpy.data.actions[label]; arm.animation_data.action = action; arm.animation_data.action_slot = action.slots[0]
    blocks = mesh.data.shape_keys.key_blocks
    blocks['BlueBlink'].value = 1 if label in ['sleep', 'happy'] else 0
    blocks['BlueGround'].value = 1 if label == 'sleep' else (.5 if label == 'settle' else 0)
    if 'BlueSit' in blocks: blocks['BlueSit'].value = 1 if label == 'sitidle' else (.6 if label == 'sit' else 0)
    if 'BluePerch' in blocks: blocks['BluePerch'].value = 1 if label in ['perch', 'perchidle'] else (.5 if label == 'unperch' else 0)
    scene.frame_set(frame); bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get(); em = mesh.evaluated_get(dg).to_mesh()
    worst = []
    for e, length in zip(mesh.data.edges, lengths):
        if length <= .00001: continue
        a, b = em.vertices[e.vertices[0]].co, em.vertices[e.vertices[1]].co
        ratio = (a - b).length / length
        worst.append((ratio, tuple(round(c, 3) for c in ((a + b) / 2))))
    worst.sort(reverse=True)
    ratios = [w[0] for w in worst]
    report.append({'clip': label, 'frame': frame, 'min_z': round(min(v.co.z for v in em.vertices), 4), 'max_stretch': round(ratios[0], 2),
                   'p99_stretch': round(ratios[int(len(ratios) * .01)], 3), 'edges_over_3x': sum(r > 3 for r in ratios), 'worst_locations': [w[1] for w in worst[:4]]})
    mesh.evaluated_get(dg).to_mesh_clear()
    on_ledge = label in LEDGE_SHOTS
    floor.hide_render = on_ledge; ledge.hide_render = not on_ledge
    # Root-motion clips carry the body away from the origin: aim the camera at the Root and hide the floor while airborne.
    root_move = arm.pose.bones['Root'].head.copy(); airborne = abs(root_move.z) > .05
    floor.hide_render = on_ledge or airborne
    for o, base_loc in lights: o.location = base_loc + root_move
    aim = Vector((0, 0, .1 if on_ledge else .22)) + root_move
    cam.location = VIEWS[view]; cam.rotation_euler = (aim - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(OUT / f'{label}-{frame}-{view}.png'); bpy.ops.render.render(write_still=True)
(OUT / 'deformation-report.json').write_text(json.dumps(report, indent=2)); print(json.dumps(report))
