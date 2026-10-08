# Modelling helpers for the hi-fi pieces built clean in Blender (hifi_unit_gen.py, hifi_speaker_gen.py): bevelled
# boxes and cylinders, boolean cuts that carry the cutter's material onto the cut faces, flat glTF materials.
# Axes as Blender's (X right, Y to the back, Z up); every primitive is applied, so coordinates are world ones.
import bpy, bmesh, math

MAT = {}

def material(name, colour, rough, metal):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    c = [((colour >> s) & 255) / 255 for s in (16, 8, 0)]
    b.inputs['Base Color'].default_value = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c] + [1]
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    return m

def select_only(o):
    for x in bpy.context.selected_objects: x.select_set(False)
    bpy.context.view_layer.objects.active = o; o.select_set(True)

def box(name, x0, x1, y0, y1, z0, z1, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    o = bpy.context.active_object; o.name = name
    o.scale = (x1 - x0, y1 - y0, z1 - z0)
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=True)
    o.data.materials.append(MAT[mat])
    return o

def cyl(name, r, x, z, y0, y1, mat, verts=64, axis='Y', at=None):
    """A cylinder along Y from y0 to y1 at (x, z) (or along Z at `at` = (x, y), z from y0 to y1)."""
    if axis == 'Y':
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=abs(y1 - y0), location=(x, (y0 + y1) / 2, z), rotation=(math.pi / 2, 0, 0))
    else:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=abs(y1 - y0), location=(at[0], at[1], (y0 + y1) / 2))
    o = bpy.context.active_object; o.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    o.data.materials.append(MAT[mat])
    return o

def bevel_edges(o, pick, width, segments):
    bm = bmesh.new(); bm.from_mesh(o.data)
    edges = [e for e in bm.edges if pick(e)]
    bmesh.ops.bevel(bm, geom=edges, offset=width, offset_type='OFFSET', segments=segments, profile=0.5, affect='EDGES', clamp_overlap=True)
    bm.to_mesh(o.data); bm.free()

def along(axis):
    """Picks the edges running along an axis (0 x, 1 y, 2 z)."""
    def pick(e):
        d = e.verts[1].co - e.verts[0].co
        return abs(d[axis]) > 0.9 * d.length
    return pick

vertical = along(2)

def boolean(target, cutter, op='DIFFERENCE'):
    select_only(target)
    m = target.modifiers.new('b', 'BOOLEAN'); m.operation = op; m.object = cutter; m.solver = 'EXACT'
    m.material_mode = 'TRANSFER'
    bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.data.objects.remove(cutter)

def rounded_box(name, x0, x1, y0, y1, z0, z1, mat, corner, edge, top_only=False):
    """A box with its vertical edges rounded by `corner`, then its top (and bottom) rims by `edge`."""
    o = box(name, x0, x1, y0, y1, z0, z1, mat)
    bevel_edges(o, vertical, corner, 10)
    zt, zb = z1, z0
    bevel_edges(o, lambda e: not vertical(e) and (all(abs(v.co.z - zt) < 1e-5 for v in e.verts) or (not top_only and all(abs(v.co.z - zb) < 1e-5 for v in e.verts))), edge, 6)
    return o

def soften(o, width=0.0016, angle=40):
    """A thin bevel on every sharp edge, so cut edges catch a line of light."""
    select_only(o)
    m = o.modifiers.new('soft', 'BEVEL'); m.limit_method = 'ANGLE'; m.angle_limit = math.radians(angle); m.width = width; m.segments = 2
    bpy.ops.object.modifier_apply(modifier=m.name)

def finish(o, angle=35):
    """Smooth by angle, flat faces kept flat (boolean cuts leave long triangles that smear a rounding over a face)."""
    select_only(o)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle))
    m = o.modifiers.new('wn', 'WEIGHTED_NORMAL'); m.mode = 'FACE_AREA'; m.keep_sharp = True; m.weight = 100
    bpy.ops.object.modifier_apply(modifier=m.name)

def join(target, others):
    for o in others:
        select_only(target); o.select_set(True); bpy.context.view_layer.objects.active = target
        bpy.ops.object.join()

def export(parts, path):
    for p in parts: print('PART', p.name, len(p.data.polygons), [m.name for m in p.data.materials])
    for x in bpy.context.selected_objects: x.select_set(False)
    for p in parts: p.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_yup=True, export_apply=True, use_selection=True)
    print('DONE')
