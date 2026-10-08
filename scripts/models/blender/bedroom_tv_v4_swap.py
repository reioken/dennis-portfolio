"""TV corner v4: replace the v3 pieces whose retopology lost the Tripo shape, keep everything else in place.
blender -b -P THIS -- SOURCE_ROOT V3_BLEND V4_BLEND DEST_GLB RENDER_DIR
Rebuilt from the recorded Tripo surfaces (bedroom_tv_source_rebuild.py): N64, SNES, both N64/GameCube
controllers, the loose SNES/N64 cartridges and the retro pile. The stand, CRT, GameCube, handhelds, SNES
controller, case stacks, cables and all other v3 work are carried over unchanged from V3_BLEND.
Pieces keep their real proportions (uniform scale) instead of v3's per-axis squash, which flattened controllers.
"""
import bpy, sys, os, math, json
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bedroom_tv_source_rebuild as R
from bedroom_tv_common import MAT, select_only, mesh, image_mat

SRC, V3, V4, DST, RENDER = [os.path.abspath(p) for p in sys.argv[sys.argv.index('--') + 1:]]
ART = os.path.join(os.path.dirname(SRC), 'bedroom-tv')
bpy.ops.wm.open_mainfile(filepath=V3)
log = []
def note(msg): print(msg, flush=True); log.append(msg)

# ---- remove the v3 pieces being replaced (body + their own detail parts) ----
def doomed(name):
    if name == 'nintendo-ds' or name.startswith('ds-'): return True
    if name in ['nintendo-64', 'nintendo-snes', 'n64-controller', 'gamecube-controller', 'bedroom-retro-games',
                'retro-upper-zelda-box', 'retro-yoshi-cartridge']: return True
    if name.startswith(('n64-controller-', 'gamecube-controller-', 'snes-port-', 'snes-clean-print')): return True
    if name.startswith('n64-') and not name.startswith('n64-controller'): return True
    if name.startswith(('bedroom-yoshi-cartridge', 'bedroom-smash64-cartridge', 'bedroom-ocarina-cartridge',
                        'bedroom-link-past-cartridge')): return True
    return False
gone = [o.name for o in bpy.data.objects if o.type == 'MESH' and doomed(o.name)]
removed_tris = sum(len(bpy.data.objects[n].data.polygons) for n in gone)
for n in gone: bpy.data.objects.remove(bpy.data.objects[n], do_unlink=True)
note('REMOVED %d objects, %d faces' % (len(gone), removed_tris))

stand = bpy.data.objects['tv-stand']
standtree = BVHTree.FromPolygons([stand.matrix_world @ v.co for v in stand.data.vertices], [p.vertices for p in stand.data.polygons])
def shelf(x, y, level):
    hit, *_ = standtree.ray_cast(Vector((x, y, {2: 1, 1: .65, 0: .30}[level])), Vector((0, 0, -1)))
    if hit is None: raise RuntimeError('shelf ray missed')
    return hit.z + .0015

def place(o, width, x, y, base, angle=0, rx=0, depth_scale=1.0):
    """Uniform scale to the real width (optional mild depth correction), rotate, rest on `base`."""
    co = np.array([v.co[:] for v in o.data.vertices]); size = co.max(0) - co.min(0)
    s = width / size[0]
    o.scale = (s, s * depth_scale, s)
    o.rotation_mode = 'XYZ'  # the glTF importer leaves quaternion mode, which ignores rotation_euler
    o.rotation_euler = (math.radians(rx), 0, math.radians(angle))
    o.location = (x, y, 0); bpy.context.view_layer.update()
    low = min((o.matrix_world @ v.co).z for v in o.data.vertices)
    o.location.z = base - low; bpy.context.view_layer.update()

def label(o, name, image_key, x0, x1, a0, a1, axis='front', crop=(0, 1, 0, 1), rotation=0, n=(14, 10), offset=.003, start=-5):
    """Artwork quad grid projected onto o's actual surface (canonical frame, before placement).
    front: x/z rectangle seen along +Y; top: x/y rectangle seen along -Z, rotated by `rotation` degrees."""
    bvh = BVHTree.FromPolygons([v.co for v in o.data.vertices], [p.vertices for p in o.data.polygons])
    cx, ca = (x0 + x1) / 2, (a0 + a1) / 2; c, s = math.cos(math.radians(rotation)), math.sin(math.radians(rotation))
    verts, uvs, faces = [], [], []
    u0, u1, v0, v1 = crop
    for j in range(n[1] + 1):
        for i in range(n[0] + 1):
            dx, da = (x0 + (x1 - x0) * i / n[0]) - cx, (a0 + (a1 - a0) * j / n[1]) - ca
            px, pa = cx + dx * c - da * s, ca + dx * s + da * c
            if axis == 'front': hit, nrm, *_ = bvh.ray_cast(Vector((px, start, pa)), Vector((0, 1, 0)))
            else: hit, nrm, *_ = bvh.ray_cast(Vector((px, pa, 5)), Vector((0, 0, -1)))
            if hit is None: raise RuntimeError('label off surface: ' + name)
            out = Vector((0, -1, 0)) if axis == 'front' else Vector((0, 0, 1))
            verts.append(hit + out * offset)
            uvs.append((u0 + (u1 - u0) * i / n[0], v0 + (v1 - v0) * j / n[1]))
    for j in range(n[1]):
        for i in range(n[0]):
            a = j * (n[0] + 1) + i; faces.append((a, a + 1, a + n[0] + 2, a + n[0] + 1))
    p = mesh(name, [tuple(v) for v in verts], faces, image_key, {k: uv for k, uv in enumerate(uvs)})
    p.parent = o
    return p

def cover(key, file):
    if key not in MAT:
        m = bpy.data.materials.get(key)
        MAT[key] = m if m is not None else image_mat(key, os.path.join(ART, file))
    return key

def fit_crop(file, aspect):
    """Centre crop (u0,u1,v0,v1) of an image to the label aspect (width/height)."""
    img = bpy.data.images.load(os.path.join(ART, file), check_existing=True); w, h = img.size
    a = w / h
    if a > aspect: k = aspect / a; return ((1 - k) / 2, (1 + k) / 2, 0, 1)
    k = a / aspect; return (0, 1, 1 - k, 1)  # keep the top band: titles sit at the top of box art

def finish(o):
    """Bake the placement into world coordinates for o and its label children, like the v3 export pass."""
    kids = [k for k in bpy.data.objects if k.parent == o]
    for k in kids + [o]:
        select_only(k); bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        t = k.modifiers.new('tri', 'TRIANGULATE'); bpy.ops.object.modifier_apply(modifier=t.name)
    return kids

built, sources = [], {}
def piece(source, outname):
    if source not in sources:
        o, info = R.build(SRC, source, log=note); sources[source] = o
        o.name = outname; return o
    t = sources[source]; o = t.copy(); o.data = t.data.copy(); o.name = outname
    bpy.context.collection.objects.link(o); return o

for key, file in [('cover-yoshi', 'yoshi-Named_Boxarts.png'), ('cover-smash64', 'smash64-Named_Boxarts.png'),
                  ('cover-ocarina', 'ocarina-Named_Boxarts.png'), ('cover-link-past', 'link-past-Named_Boxarts.png'),
                  ('cover-mario64', 'mario64-Named_Boxarts.png'), ('cover-mariokart64', 'mariokart64-Named_Boxarts.png'),
                  ('cover-mario-world', 'mario-world-Named_Boxarts.png'), ('ds-top-image', 'ds-top.png'), ('ds-touch-image', 'ds-touch.png')]:
    cover(key, file)

# ---- consoles ----
n64 = piece('n64', 'nintendo-64'); place(n64, .265, .285, .027, shelf(.285, .027, 0), angle=5)
snes = piece('snes', 'nintendo-snes'); place(snes, .27, -.31, .052, shelf(-.31, .052, 0), angle=-4, depth_scale=.9)
built += [n64, snes]

def slot_floor(console, cx, cy):
    """World point on the cartridge slot floor at canonical (cx, cy)."""
    w = console.matrix_world @ Vector((cx, cy, 0))
    tree = BVHTree.FromPolygons([console.matrix_world @ v.co for v in console.data.vertices], [p.vertices for p in console.data.polygons])
    hit, *_ = tree.ray_cast(Vector((w.x, w.y, 1.5)), Vector((0, 0, -1)))
    return hit

# ---- cartridges: labels sit in the moulded recess; SNES labels keep the title band of the box art ----
SNES_LABEL = (-.365, .365, .37, .607); N64_LABEL = (-.222, .222, .125, .58)
def cartridge(src, name, art, file, gold=False):
    o = piece(src, name)
    x0, x1, a0, a1 = SNES_LABEL if src == 'snes-cartridge' else N64_LABEL
    label(o, name + '-label', art, x0, x1, a0, a1, crop=fit_crop(file, (x1 - x0) / (a1 - a0)))
    if gold:
        o.data = o.data.copy(); o.data.materials[0] = R.mat_for('gold')
    return o

yoshi = cartridge('snes-cartridge', 'bedroom-yoshi-cartridge', 'cover-yoshi', 'yoshi-Named_Boxarts.png')
floor = slot_floor(snes, 0, .05); place(yoshi, .12, floor.x, floor.y, floor.z - .004, angle=-4)
smash = cartridge('n64-cartridge', 'bedroom-smash64-cartridge', 'cover-smash64', 'smash64-Named_Boxarts.png')
floor = slot_floor(n64, 0, .124); place(smash, .115, floor.x, floor.y, floor.z - .004, angle=5)
note('SLOTS yoshi %.3f smash %.3f' % (yoshi.location.z, smash.location.z))
level0 = shelf(0, -.14, 0)
oca = cartridge('n64-cartridge', 'bedroom-ocarina-cartridge', 'cover-ocarina', 'ocarina-Named_Boxarts.png', gold=True)
place(oca, .115, .066, -.150, level0, angle=-11)
lttp = cartridge('snes-cartridge', 'bedroom-link-past-cartridge', 'cover-link-past', 'link-past-Named_Boxarts.png')
place(lttp, .12, -.083, -.140, level0, angle=9)
built += [yoshi, smash, oca, lttp]

# ---- retro pile: Super Mario World box on top, Mario Kart 64 standing, Super Mario 64 lying ----
pile = piece('retro-games', 'bedroom-retro-games')
label(pile, 'retro-box-top', 'cover-mario-world', -.43, .16, -.0, .40, axis='top', rotation=-2.2,
      crop=fit_crop('mario-world-Named_Boxarts.png', .59 / .40))
label(pile, 'retro-standing-cartridge', 'cover-mariokart64', .262, .418, .055, .205,
      crop=fit_crop('mariokart64-Named_Boxarts.png', .156 / .15), start=-.07)  # the lying SNES cart is in front
label(pile, 'retro-lying-cartridge', 'cover-mario64', -.39, -.22, -.355, -.205, axis='top', rotation=13,
      crop=fit_crop('mario64-Named_Boxarts.png', .17 / .15))
place(pile, .235, -.032, .062, shelf(-.032, .062, 0), angle=-8)
built.append(pile)

# ---- original silver DS: the v3 retopology had lost its black keys and silver shell ----
ds = piece('ds', 'nintendo-ds')
label(ds, 'ds-upper-screen', 'ds-top-image', -.203, .203, .35, .603, offset=.004)
label(ds, 'ds-touch-screen', 'ds-touch-image', -.203, .203, -.243, .013, axis='top', offset=.002)
place(ds, .148, .29, .035, shelf(.29, .035, 2), angle=8)
built.append(ds)

# ---- controllers: real depth, resting on their grips ----
for src, name, width, x, y, level, angle, rx in [
        ('gamecube-controller', 'gamecube-controller', .15, .277, -.130, 1, -16, -66),
        ('n64-controller', 'n64-controller', .16, .283, -.175, 0, -12, -60)]:
    o = piece(src, name); place(o, width, x, y, shelf(x, y, level), angle=angle, rx=rx); built.append(o)

for o in list(built):
    built += finish(o)
added = sum(len(o.data.polygons) for o in built)
note('ADDED %d objects, %d triangles' % (len(built), added))

# Share v3's identical clean colours so the corner keeps few static batches.
SHARE = {'bedroom-v4-black': 'bedroom-black', 'bedroom-v4-white': 'bedroom-white', 'bedroom-v4-lightgrey': 'bedroom-clean-grey',
         'bedroom-v4-red': 'bedroom-clean-red', 'bedroom-v4-green': 'bedroom-clean-green',
         'bedroom-v4-blue': 'bedroom-clean-blue', 'bedroom-v4-yellow': 'bedroom-clean-yellow',
         'bedroom-v4-charcoal': 'bedroom-clean-graphite', 'bedroom-v4-darkgrey': 'bedroom-clean-darkgrey',
         'bedroom-v4-indigo-dark': 'bedroom-letter-blue'}
for o in bpy.data.objects:
    if o.type != 'MESH': continue
    for slot in o.material_slots:
        if slot.material and slot.material.name in SHARE and SHARE[slot.material.name] in bpy.data.materials:
            slot.material = bpy.data.materials[SHARE[slot.material.name]]
pieces = [o for o in bpy.data.objects if o.type == 'MESH' and o.name != 'studio-floor']
total = sum(len(o.data.polygons) for o in pieces)
mats = sorted({s.material.name for o in pieces for s in o.material_slots if s.material})
note('TOTAL %d triangles, %d materials' % (total, len(mats)))
os.makedirs(os.path.dirname(DST), exist_ok=True)
for o in bpy.context.selected_objects: o.select_set(False)
for o in pieces: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=DST, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                          export_image_format='WEBP', export_image_quality=91)
bpy.ops.wm.save_as_mainfile(filepath=V4)
os.makedirs(RENDER, exist_ok=True)
with open(os.path.join(RENDER, 'v4-swap.json'), 'w') as f:
    json.dump({'triangles': total, 'materials': mats, 'log': log}, f, indent=2)
scene = bpy.context.scene; scene.cycles.samples = 64
if os.environ.get('BEDROOM_RENDER_ASSEMBLY') != '0':
    cam = scene.camera
    for name, loc, target, scale in [('assembly', (1.2, -3.8, 1.65), (0, 0, .62), 1.47), ('front', (0, -4, 1.24), (0, 0, .61), 1.44),
                                     ('games', (.65, -2, 1.2), (-.03, 0, .42), .89), ('lower', (.3, -2, .55), (0, 0, .2), .78)]:
        cam.location = loc; cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler(); cam.data.ortho_scale = scale
        scene.render.filepath = os.path.join(RENDER, name + '.png'); bpy.ops.render.render(write_still=True)
print('V4 DONE', DST, flush=True)
