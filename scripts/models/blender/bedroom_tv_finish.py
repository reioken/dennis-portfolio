"""TV corner finish pass (Dennis, Oct 8: "higher quality textures, more realistic, like the other assets; also needs a
remote somewhere"). Opens the assembled Blend, adds a Sony Trinitron remote (RM-style, modelled to 18 x 5 x 2 cm),
densifies the stand's flat decks, then bakes ambient occlusion from the whole corner into every piece's vertex
colours (contact shadows under consoles, cases and cables, crevices in ports and keys), as the hall's other assets
carry baked occlusion. The runtime multiplies COLOR_0 into each material (bedroomTv.ts).
blender -b IN_BLEND -P THIS -- OUT_BLEND DEST_GLB
"""
import bpy, bmesh, sys, os, math
import numpy as np
from mathutils import Vector, Matrix
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bedroom_tv_common import MAT, select_only, mesh, loft, rounded_loop
from hifi_gen import material, box, cyl, bevel_edges
import bedroom_tv_stand_build as STAND
OUT_BLEND, DST = [os.path.abspath(p) for p in sys.argv[sys.argv.index('--') + 1:]]
FONT = 'C:/Windows/Fonts/arialbd.ttf'

def mat(key, colour, rough, metal=0):
    if key not in MAT: MAT[key] = bpy.data.materials.get(key) or material(key, colour, rough, metal)
    return key

# ---------------- remote ----------------
def label(words, x, y, z, size, key):
    c = bpy.data.curves.new('remote-print', 'FONT'); c.body = words; c.size = size; c.align_x = 'CENTER'
    if os.path.exists(FONT): c.font = bpy.data.fonts.load(FONT, check_existing=True)
    t = bpy.data.objects.new('remote-print', c); bpy.context.collection.objects.link(t); t.location = (x, y, z)
    c.materials.append(MAT[key]); select_only(t); bpy.ops.object.convert(target='MESH'); bpy.ops.object.transform_apply(location=True)
    return t

def remote():
    """Local frame: length along +Y (IR window at +Y), top face up, bottom at z=0, centred on x."""
    mat('remote-body', 0x2a2b30, .55); mat('remote-key', 0x8b8e95, .45); mat('remote-key-dark', 0x3c3e44, .5)
    mat('remote-red', 0xb4323c, .45); mat('remote-print-white', 0xd9dbe0, .6); mat('remote-ir', 0x0d0d10, .15)
    L, W, T = .18, .05, .019
    def section(y, w, t): return [(x, y, z) for x, z in [(px, pz + t / 2) for px, pz in rounded_loop(w, t, t * .45, 6)]]
    body = loft('remote', [section(-L / 2, W * .86, T * .78), section(-L / 2 + .012, W * .97, T * .95), section(0, W, T),
                           section(L / 2 - .014, W * .98, T * .98), section(L / 2, W * .9, T * .82)], 'remote-body')
    parts = [body]
    top = lambda y: T * (.95 if abs(y) < L / 2 - .014 else .85) + .0004
    parts.append(mesh('remote-ir', [(-.018, L / 2 + .0006, .004), (.018, L / 2 + .0006, .004), (.018, L / 2 + .0006, .014),
                                    (-.018, L / 2 + .0006, .014)], [(3, 2, 1, 0)], 'remote-ir'))
    def key(x, y, r, k, h=.0022):
        o = cyl('remote-key', r, 0, 0, 0, h, k, verts=20, axis='Z', at=(x, y)); o.location.z = T - .0004; return o
    parts.append(key(-.015, .068, .0042, 'remote-red'))
    parts.append(label('POWER', -.015, .059, T + .0003, .0032, 'remote-print-white'))
    for i, words in enumerate(['TV/VIDEO', 'DISPLAY']):
        x = .004 + i * .014; parts.append(key(x, .068, .0034, 'remote-key'))
    for r in range(4):
        for c in range(3):
            x, y = -.013 + c * .013, .045 - r * .013
            parts.append(key(x, y, .0042, 'remote-key'))
            parts.append(label(['1', '2', '3', '4', '5', '6', '7', '8', '9', '-/--', '0', 'ENTER'][r * 3 + c], x, y - .0005, T + .0024, .0036, 'remote-key-dark'))
    for x, words in [(-.012, 'VOL'), (.012, 'CH')]:
        rock = box('remote-rocker', x - .0045, x + .0045, -.028, .002, T - .0004, T + .0018, 'remote-key-dark')
        bevel_edges(rock, lambda e: True, .0012, 2); parts.append(rock)
        parts += [label('+', x, -.0035, T + .0019, .004, 'remote-print-white'), label('–', x, -.026, T + .0019, .004, 'remote-print-white'),
                  label(words, x, -.035, T + .0003, .0032, 'remote-print-white')]
    parts.append(key(0, -.014, .0036, 'remote-key-dark'))
    parts.append(label('MUTING', 0, -.021, T + .0003, .0026, 'remote-print-white'))
    parts.append(label('SONY', 0, -.068, T + .0003, .0085, 'remote-print-white'))
    parts.append(label('RM-887', 0, -.078, T + .0003, .0028, 'remote-print-white'))
    for p in parts: select_only(p); bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
    select_only(parts[0])
    for p in parts: p.select_set(True)
    bpy.ops.object.join(); o = bpy.context.object; o.name = 'bedroom-remote'
    return o

stand = bpy.data.objects['tv-stand']
from mathutils.bvhtree import BVHTree
standtree = BVHTree.FromPolygons([stand.matrix_world @ v.co for v in stand.data.vertices], [p.vertices for p in stand.data.polygons])
def shelf(x, y, level):
    hit, *_ = standtree.ray_cast(Vector((x, y, {2: 1, 1: .65, 0: .30}[level])), Vector((0, 0, -1)))
    return hit.z + .0008
rm = remote()
# lying on the top deck in front of the TV's right corner, turned casually towards the room
x, y = .17, -.165
rm.data.transform(Matrix.Translation((x, y, shelf(x, y, 2))) @ Matrix.Rotation(math.radians(-62), 4, 'Z')); rm.data.update()
t = rm.modifiers.new('tri', 'TRIANGULATE'); select_only(rm); bpy.ops.object.modifier_apply(modifier=t.name)
print('REMOTE', len(rm.data.polygons), flush=True)

# ---------------- the stand, modelled in Blender (bedroom_tv_stand_build.py) at the same deck levels ----------------
levels = [shelf(0, 0, i) - .0008 for i in range(3)]
bpy.data.objects.remove(stand, do_unlink=True)
stand = STAND.build(levels)
print('STAND LEVELS', [round(v, 4) for v in levels], flush=True)
# densify the deck tops so vertex occlusion can draw contact shadows
bm = bmesh.new(); bm.from_mesh(stand.data)
for _ in range(7):
    # only the deck tops, where things stand; posts, rims and feet keep their topology
    long = [e for e in bm.edges if e.calc_length() > .035 and e.link_faces and all(f.normal.z > .95 for f in e.link_faces)]
    if not long: break
    bmesh.ops.subdivide_edges(bm, edges=long, cuts=1, use_grid_fill=True)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
bm.to_mesh(stand.data); bm.free(); stand.data.update()
print('STAND', len(stand.data.polygons), flush=True)

# ---------------- bake occlusion into vertex colours ----------------
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'GPU'; sc.cycles.samples = 256
prefs = bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type = 'OPTIX'; prefs.get_devices()
for d in prefs.devices: d.use = d.type != 'CPU'
sc.world.light_settings.distance = .07
skip = {'studio-floor'}
targets = [o for o in bpy.data.objects if o.type == 'MESH' and o.name not in skip and not o.name.startswith('crt-screen')]
for o in targets:
    for a in list(o.data.color_attributes): o.data.color_attributes.remove(a)
    o.data.color_attributes.new('ao', 'BYTE_COLOR', 'POINT'); o.data.color_attributes.active_color = o.data.color_attributes['ao']
for o in bpy.context.selected_objects: o.select_set(False)
for o in targets: o.select_set(True)
bpy.context.view_layer.objects.active = targets[0]
bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
# soften: occlusion is a contact cue, not a dirt layer
for o in targets:
    a = o.data.color_attributes['ao']; n = len(a.data)
    c = np.zeros(n * 4, np.float32); a.data.foreach_get('color', c); c = c.reshape(-1, 4)
    # average with neighbours twice: removes sampling speckle, which read as smudges on the plastics
    ao = c[:, 0].copy(); ev = np.zeros(len(o.data.edges) * 2, np.int64); o.data.edges.foreach_get('vertices', ev); ev = ev.reshape(-1, 2)
    for _ in range(2):
        acc = ao.copy(); cnt = np.ones(n)
        np.add.at(acc, ev[:, 0], ao[ev[:, 1]]); np.add.at(acc, ev[:, 1], ao[ev[:, 0]])
        np.add.at(cnt, ev[:, 0], 1); np.add.at(cnt, ev[:, 1], 1); ao = acc / cnt
    c[:, 0] = ao
    v = .42 + .58 * c[:, 0]
    # On metal the colour also scales the reflection, so occlusion there stays light.
    metal = np.zeros(n, bool)
    for poly in o.data.polygons:
        m = o.data.materials[poly.material_index] if o.data.materials else None
        if m and any(k in m.name for k in ('chrome', 'silver', 'gold', 'steel')): metal[list(poly.vertices)] = True
    v[metal] = .82 + .18 * c[metal, 0]
    c[:, 0] = c[:, 1] = c[:, 2] = v; c[:, 3] = 1
    a.data.foreach_set('color', c.ravel())
print('AO BAKED', len(targets), flush=True)

pieces = [o for o in bpy.data.objects if o.type == 'MESH' and o.name not in skip]
for o in bpy.context.selected_objects: o.select_set(False)
for o in pieces: o.select_set(True)
kw = dict(filepath=DST, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
          export_image_format='WEBP', export_image_quality=91)
try: bpy.ops.export_scene.gltf(**kw, export_vertex_color='ACTIVE', export_active_vertex_color_when_no_material=True)
except TypeError: bpy.ops.export_scene.gltf(**kw, export_colors=True)
bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
print('FINISH DONE', sum(len(o.data.polygons) for o in pieces), flush=True)
