# The bedroom hi-fi's pieces for the hall (hifi.ts) in one GLB, from the Tripo models in .source-assets/hifi/
# (Gemini product images of every piece -> Tripo image-to-3D, H3.1, 2026-10-06; re-exported with 4K maps on
# October 7). Run from the repo root:
#   python scripts/models/hifi_median.py   (median-filtered colour maps in .source-assets/hifi/tex/, for the paint)
#   blender -b -P scripts/models/blender/hifi_unit_gen.py -- .source-assets/hifi/radio-gen.glb
#   blender -b -P scripts/models/blender/hifi_speaker_gen.py -- .source-assets/hifi/speaker-gen.glb
#   blender -b -P scripts/models/blender/hifi_build.py -- .source-assets/hifi public/models/hifi-v1.glb
#   node scripts/models/shrink-textures.mjs --only hifi-v1 && node scripts/models/pack-models.mjs --only hifi-v1 && node scripts/models/gzip-models.mjs --only hifi-v1
#
# The unit is modelled clean by hifi_unit_gen.py (Tripo's rippled at its seams; Dennis, October 7: "fix the model then
# or make a new one") and taken as it is: body, four keys and the knob, each with its pivot on its face, in Tripo's
# units and places; so is the speaker (hifi_speaker_gen.py). Of the Tripo models, the remote and the leg remain. Their meshes arrive in thousands of
# loose patches a hair apart; welded at 1e-5 they close, and only then does the decimation not tear them. Tripo's own
# maps are not used (October 7: "all look smudged, not accurate"): hifi_paint.py classifies every face of the full mesh
# into flat colours, gloss and metal and bakes that, times ambient occlusion from the real geometry, onto new UVs. The
# speaker's grille and the jewel cases are drawn in hifi.ts; the leg gets the hall's chrome. The leg's pole between the upper collar and the cap is shortened, so the cap stands just above the top glass.
# Units stay Tripo's (the longest side ~0.98); hifi.ts scales each piece to its real size.
import bpy, bmesh, sys, os, math, mathutils
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hifi_paint import face_samples, paint, bake_clean
argv = sys.argv[sys.argv.index('--') + 1:]
SRC, DST = argv[0], argv[1]
TEX = SRC + '/tex'

# (colour, roughness, metal, name)
REMOTE_PAINT = [(0xc8cbd0, 0.4, 0.45, 'plate'), (0x7b7e85, 0.6, 0.0, 'buttons'), (0x3b3d44, 0.55, 0.1, 'shell'),
                (0xc9312b, 0.45, 0.0, 'red'), (0x3a0d13, 0.12, 0.0, 'window'), (0x16171a, 0.65, 0.0, 'ink')]

bpy.ops.wm.read_factory_settings(use_empty=True)

def select_only(o):
    for x in bpy.context.selected_objects: x.select_set(False)
    bpy.context.view_layer.objects.active = o; o.select_set(True)

def import_glb(path, name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path, merge_vertices=True)
    new = [o for o in bpy.data.objects if o not in before]
    mesh = [o for o in new if o.type == 'MESH'][0]
    select_only(mesh)
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in new:
        if o is not mesh: bpy.data.objects.remove(o)
    mesh.name = name + '-hi'
    mat = mesh.data.materials[0]
    mat.name = 'hifi-' + name
    for node in mat.node_tree.nodes:
        if node.type == 'TEX_IMAGE' and node.image:
            kind = 'basecolor' if 'basecolor' in node.image.name else 'normal' if 'normal' in node.image.name else 'rm'
            node.image.name = f'hifi-{name}-{kind}'
    return mesh

def copy_of(src, name, keep=None):
    o = src.copy(); o.data = src.data.copy(); o.name = name; o.data.name = name
    bpy.context.scene.collection.objects.link(o)
    if keep is not None:
        bm = bmesh.new(); bm.from_mesh(o.data); bm.faces.ensure_lookup_table()
        bmesh.ops.delete(bm, geom=[f for f, k in zip(bm.faces, keep) if not k], context='FACES')
        bm.to_mesh(o.data); bm.free()
    return o

def weld(o):
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(o.data); bm.free()
    return o

def lower(o, faces, smooth=0, angle=35):
    """Decimated, its own normals smoothed by angle: the full mesh's normals carried Tripo's surface noise. `smooth`:
    Laplacian passes (volume kept) that iron out the ripples Tripo leaves along seams and panel lines."""
    select_only(o)
    n = len(o.data.polygons)
    if o.data.has_custom_normals: bpy.ops.mesh.customdata_custom_splitnormals_clear()
    if faces < n:
        mod = o.modifiers.new('dec', 'DECIMATE'); mod.decimate_type = 'COLLAPSE'; mod.ratio = faces / n; mod.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if smooth:
        mod = o.modifiers.new('smooth', 'LAPLACIANSMOOTH'); mod.iterations = smooth; mod.lambda_factor = 0.6
        mod.lambda_border = 0.0; mod.use_volume_preserve = True; mod.use_normalized = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle))
    print('PART', o.name, n, '->', len(o.data.polygons))

def pivot(o, at):
    select_only(o)
    bpy.context.scene.cursor.location = at
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')

def luminance(rgb): return rgb.mean(1)


out = []

# ---------- the radio: modelled clean by hifi_unit_gen.py (Tripo's unit rippled at its seams), taken as it is ----------
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=SRC + '/radio-gen.glb')
for o in [o for o in bpy.data.objects if o not in before]:
    if o.type != 'MESH': bpy.data.objects.remove(o); continue
    o.name = o.name.split('.')[0]; out.append(o)

# ---------- the speaker: modelled clean by hifi_speaker_gen.py, taken as it is ----------
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=SRC + '/speaker-gen.glb')
for o in [o for o in bpy.data.objects if o not in before]:
    if o.type != 'MESH': bpy.data.objects.remove(o); continue
    o.name = o.name.split('.')[0]; out.append(o)

# ---------- the remote: decimated, repainted ----------
hi = import_glb(SRC + '/remote-4k.glb', 'remote')
w = weld(copy_of(hi, 'remote-weld')); bpy.data.objects.remove(hi)
centre, normal, rgb = face_samples(w.data, TEX + '/remote-median.png')
L = luminance(rgb); r, g, b = rgb[:, 0], rgb[:, 1], rgb[:, 2]
cls = np.full(len(L), 2, np.int64)
cls[(L > 95) & (L <= 165)] = 1
cls[L > 165] = 0
# the infrared window at the front end (its glass speckled red by the AI), the red power key at the far end
cls[(centre[:, 1] < -0.36) & (L < 120)] = 4
cls[(r - g > 35) & (r > 120) & (centre[:, 1] > 0.2)] = 3
cls[L < 35] = 5
paint(w.data, cls, REMOTE_PAINT)
lo = copy_of(w, 'remote'); lower(lo, 6000)
bake_clean([lo], w, 'remote', 1024)
bpy.data.objects.remove(w)
out.append(lo)

# (the jewel cases are built in hifi.ts: Tripo's came with smudged AI prints, and per-face paint sawed their edges)

# ---------- the leg: the pole between the upper collar and the cap shortened; the hall gives it its chrome ----------
hi = import_glb(SRC + '/leg.glb', 'leg')
A, B, KEEP = 0.835, 0.950, 0.035
for v in hi.data.vertices:
    z = v.co.z
    if z > B: v.co.z = z - (B - A - KEEP)
    elif z > A: v.co.z = A + (z - A) * KEEP / (B - A)
o = weld(copy_of(hi, 'leg'))
lower(o, 2500)
mat = hi.data.materials[0]
for node in list(mat.node_tree.nodes):
    if node.type == 'TEX_IMAGE': mat.node_tree.nodes.remove(node)
bpy.data.objects.remove(hi)
out.append(o)

for o in out:
    bb = [o.matrix_world @ mathutils.Vector(c) for c in o.bound_box]
    print('NODE', o.name, 'origin', tuple(round(c, 4) for c in o.location), 'faces', len(o.data.polygons),
          'min', tuple(round(min(v[i] for v in bb), 4) for i in range(3)), 'max', tuple(round(max(v[i] for v in bb), 4) for i in range(3)))
for o in out:
    for a in [a.name for a in o.data.color_attributes]: o.data.color_attributes.remove(o.data.color_attributes[a])
for x in bpy.context.selected_objects: x.select_set(False)
bpy.ops.export_scene.gltf(filepath=DST, export_format='GLB', export_yup=True, export_apply=True, export_image_format='WEBP')
print('DONE')
