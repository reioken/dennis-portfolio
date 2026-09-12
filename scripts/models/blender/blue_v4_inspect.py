"""Inspect a candidate cat GLB for rigging: normalise it into the hall's frame (Z up, facing -Y, paws on z=0,
body height BODY_HEIGHT), render orthographic views on a 5 cm grid, slice the mesh at several heights and print the
connected components (paw and leg centroids), and save a normalised copy.

blender --background --python scripts/models/blender/blue_v4_inspect.py -- input.glb outdir [body_height]
"""
import bpy, bmesh, sys, json, math
from pathlib import Path
from mathutils import Vector
args = sys.argv[sys.argv.index('--') + 1:]
SRC = Path(args[0]).resolve(); OUT = Path(args[1]).resolve(); OUT.mkdir(parents=True, exist_ok=True)  # Blender resolves relative render paths against the drive root
BODY_HEIGHT = float(args[2]) if len(args) > 2 else .42   # top of the back / head in metres, like the current rig

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SRC))
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
if not meshes: raise SystemExit('no mesh')
bpy.ops.object.select_all(action='DESELECT')
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1: bpy.ops.object.join()
mesh = bpy.context.view_layer.objects.active; mesh.name = 'BlueCoat'
# glTF import brings Y-up data as Z-up objects with a rotation; apply everything so the data is in world space.
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

def bounds(obj):
    xs = [v.co.x for v in obj.data.vertices]; ys = [v.co.y for v in obj.data.vertices]; zs = [v.co.z for v in obj.data.vertices]
    return Vector((min(xs), min(ys), min(zs))), Vector((max(xs), max(ys), max(zs)))

lo, hi = bounds(mesh); size = hi - lo
report = {'source': str(SRC), 'raw_bounds': [list(lo), list(hi)], 'raw_size': list(size), 'vertices': len(mesh.data.vertices), 'faces': len(mesh.data.polygons)}
# The longest horizontal axis is the body axis. The head end is the end with more mass above mid-height.
axis = 'x' if size.x > size.y else 'y'
def mass_above(obj, along, end, frac=.25):
    lo_, hi_ = bounds(obj); span = getattr(hi_ - lo_, along); zmid = (lo_.z + hi_.z) / 2
    count = 0
    for v in obj.data.vertices:
        a = getattr(v.co, along)
        if v.co.z > zmid and ((end == 'min' and a < getattr(lo_, along) + span * frac) or (end == 'max' and a > getattr(hi_, along) - span * frac)): count += 1
    return count
# Rotate so the body axis is Y with the head at -Y (the rig's forward), then scale and drop onto the floor.
if axis == 'x': mesh.rotation_euler = (0, 0, math.radians(90)); bpy.ops.object.transform_apply(rotation=True)
if mass_above(mesh, 'y', 'max') > mass_above(mesh, 'y', 'min'):
    mesh.rotation_euler = (0, 0, math.radians(180)); bpy.ops.object.transform_apply(rotation=True)
lo, hi = bounds(mesh)
scale = BODY_HEIGHT / (hi.z - lo.z)
mesh.scale = (scale, scale, scale); bpy.ops.object.transform_apply(scale=True)
lo, hi = bounds(mesh)
mesh.location = (-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z); bpy.ops.object.transform_apply(location=True)
lo, hi = bounds(mesh)
report.update(body_axis=axis, normalised_bounds=[[round(c, 4) for c in lo], [round(c, 4) for c in hi]], scale=round(scale, 5))

# Horizontal slices: connected components of faces whose vertices all lie within a band.
def slice_components(z0, z1):
    bm = bmesh.new(); bm.from_mesh(mesh.data)
    faces = [f for f in bm.faces if all(z0 <= v.co.z <= z1 for v in f.verts)]
    seen = set(); comps = []
    for f in faces:
        if f.index in seen: continue
        stack = [f]; comp = []
        seen.add(f.index)
        while stack:
            g = stack.pop(); comp.append(g)
            for e in g.edges:
                for n in e.link_faces:
                    if n.index not in seen and z0 <= min(v.co.z for v in n.verts) and max(v.co.z for v in n.verts) <= z1:
                        seen.add(n.index); stack.append(n)
        pts = [v.co.copy() for g in comp for v in g.verts]
        c = sum(pts, Vector()) / len(pts)
        ext = (max(p.x for p in pts) - min(p.x for p in pts), max(p.y for p in pts) - min(p.y for p in pts))
        comps.append({'centre': [round(c.x, 4), round(c.y, 4), round(c.z, 4)], 'faces': len(comp), 'extent': [round(ext[0], 3), round(ext[1], 3)]})
    bm.free()
    return sorted([c for c in comps if c['faces'] > 20], key=lambda c: -c['faces'])
report['slices'] = {f'{z:.2f}': slice_components(z - .01, z + .01) for z in (.03, .06, .10, .15, .20, .25, .30, .35)}

# Orthographic renders on a 5 cm grid.
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'; scene.render.resolution_x = scene.render.resolution_y = 1200
world = bpy.data.worlds.new('W'); scene.world = world; world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (.5, .5, .55, 1); world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.2
for loc in ((1, -2, 2), (-2, 1, 1.5), (0, 2, 2)):
    d = bpy.data.lights.new('L', 'AREA'); d.energy = 60; d.size = 2
    o = bpy.data.objects.new('L', d); scene.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector((0, 0, .2)) - o.location).to_track_quat('-Z', 'Y').to_euler()
# grid lines as thin cubes
grid = bpy.data.materials.new('Grid'); grid.diffuse_color = (.1, .1, .12, 1)
def bar(loc, dims):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); b = bpy.context.object; b.scale = dims; b.data.materials.append(grid)
for i in range(-10, 11):
    bar((i * .05, 0, -.002), (.0015, 1.2, .001)); bar((0, i * .05, -.002), (1.2, .0015, .001))
for i in range(0, 10):
    bar((0, .55, i * .05), (1.2, .0015, .0015))  # height marks on a back wall line
cd = bpy.data.cameras.new('C'); cd.type = 'ORTHO'; cd.ortho_scale = .7
cam = bpy.data.objects.new('C', cd); scene.collection.objects.link(cam); scene.camera = cam
aim = Vector((0, 0, BODY_HEIGHT / 2))
for name, loc in (('front', (0, -3, BODY_HEIGHT / 2)), ('side', (3, 0, BODY_HEIGHT / 2)), ('top', (0, 0, 3)), ('quarter', (2.2, -2.2, 1.4))):
    cam.location = loc; cam.rotation_euler = (aim - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(OUT / f'{name}.png'); bpy.ops.render.render(write_still=True)
# face close-up
cd.ortho_scale = .25; cam.location = (0, -3, BODY_HEIGHT * .8); cam.rotation_euler = (Vector((0, 0, BODY_HEIGHT * .8)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = str(OUT / 'face.png'); bpy.ops.render.render(write_still=True)
for o in list(scene.objects):
    if o.name.startswith('Cube'): bpy.data.objects.remove(o)
bpy.ops.object.select_all(action='DESELECT'); mesh.select_set(True); bpy.context.view_layer.objects.active = mesh
bpy.ops.export_scene.gltf(filepath=str(OUT / 'normalised.glb'), export_format='GLB', use_selection=True, export_animations=False)
(OUT / 'report.json').write_text(json.dumps(report, indent=1))
print('INSPECT_DONE', json.dumps({k: report[k] for k in ('vertices', 'faces', 'normalised_bounds', 'body_axis')}), flush=True)
