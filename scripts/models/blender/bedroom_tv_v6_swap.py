"""TV corner v6 (after Dennis's v5 notes: TV shape and screen ratio, real GameCube spines, Smash 64 cartridge,
SNES plug, cables clipping, N64 controller placement, GameCube fascia spikes, wonky surfaces). Built on v5:
TV corner v5 (after Dennis's v4 notes): everything v4 rebuilt, plus the GameCube from its Tripo surface with an
authored port fascia, a CRT modelled in Blender after the Trinitron reference, composed cartridge labels showing
the whole artwork, case stacks arranged the way a kid leaves them, the Game Boy lying on the deck, and cables
that end in real plugs: controllers in port 1 of their consoles, the GameCube's AV lead in the TV's front jacks.
blender -b -P THIS -- SOURCE_ROOT V3_BLEND V6_BLEND DEST_GLB RENDER_DIR
Kept from V3_BLEND: stand, Game Boy (re-laid), SNES controller, DS/Game Boy boxes.
"""
import bpy, sys, os, math, json
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bedroom_tv_source_rebuild as R
from bedroom_tv_common import MAT, select_only, mesh, image_mat, wire
from hifi_gen import box, cyl, bevel_edges
import bedroom_tv_crt_build as CRT
import bedroom_tv_parts_build as PARTS

SRC, V3, V4, DST, RENDER = [os.path.abspath(p) for p in sys.argv[sys.argv.index('--') + 1:]]
ART = os.path.join(os.path.dirname(SRC), 'bedroom-tv')
bpy.ops.wm.open_mainfile(filepath=V3)
log = []
def note(msg): print(msg, flush=True); log.append(msg)

# ---- remove the v3 pieces being replaced (body + their own detail parts) ----
def doomed(name):
    if name == 'nintendo-ds' or name.startswith('ds-'): return True
    if name in ['bedroom-crt', 'nintendo-gamecube', 'bedroom-cables', 'bedroom-melee-case', 'melee-original-cover',
                'bedroom-wind-waker-case', 'wind-waker-original-cover'] or name.startswith(
                ('crt-', 'gamecube-spine-', 'top-game-cover', 'bedroom-gamecube-stack')): return True
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
    if hit is None or hit.z < {2: .7, 1: .35, 0: .05}[level]:
        hit, *_ = standtree.ray_cast(Vector((0, 0, {2: 1, 1: .65, 0: .30}[level])), Vector((0, 0, -1)))  # flat deck level
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
def label_art(game):
    """Composed label (bedroom-tv-cart-labels.mjs): the whole box art, nothing cropped away."""
    key = 'cover-label-' + game
    if key not in MAT: MAT[key] = bpy.data.materials.get(key) or image_mat(key, os.path.join(ART, 'labels', game + '-label.png'))
    return key

def n64_cartridge(name, game, gold=False):
    shell = 'cart-gold' if gold else 'cart-charcoal'
    if shell not in MAT: MAT[shell] = R.mat_for('gold') if gold else bpy.data.materials['bedroom-clean-graphite']
    body, lbl = PARTS.n64_cart(name, shell, label_art(game))
    lbl.parent = body
    return body

def cartridge(src, name, game, gold=False):
    if src == 'n64-cartridge': return n64_cartridge(name, game, gold)
    o = piece(src, name)
    x0, x1, a0, a1 = SNES_LABEL if src == 'snes-cartridge' else N64_LABEL
    label(o, name + '-label', label_art(game), x0, x1, a0, a1)
    if gold:
        o.data = o.data.copy(); o.data.materials[0] = R.mat_for('gold')
    return o

yoshi = cartridge('snes-cartridge', 'bedroom-yoshi-cartridge', 'yoshi')
floor = slot_floor(snes, 0, .05); place(yoshi, .12, floor.x, floor.y, floor.z - .004, angle=-4)
smash = cartridge('n64-cartridge', 'bedroom-smash64-cartridge', 'smash64')
floor = slot_floor(n64, 0, .124); place(smash, .116, floor.x, floor.y, floor.z - .006, angle=5)
note('SLOTS yoshi %.3f smash %.3f' % (yoshi.location.z, smash.location.z))
level0 = shelf(0, -.14, 0)
oca = cartridge('n64-cartridge', 'bedroom-ocarina-cartridge', 'ocarina', gold=True)
place(oca, .116, .066, -.150, level0, angle=-11)
lttp = cartridge('snes-cartridge', 'bedroom-link-past-cartridge', 'link-past')
place(lttp, .12, -.083, -.140, level0, angle=9)
built += [yoshi, smash, oca, lttp]

# ---- retro pile: Super Mario World box on top, Mario Kart 64 standing, Super Mario 64 lying ----
pile = piece('retro-games', 'bedroom-retro-games')
# The generated lying N64 cartridge had no clean label recess; it is replaced by a real cartridge piece below.
import bmesh
bm = bmesh.new(); bm.from_mesh(pile.data)
bmesh.ops.delete(bm, geom=[f for f in bm.faces if (f.calc_center_median().x < -.096 and f.calc_center_median().y < -.105)
                          or (f.calc_center_median().x > .19 and abs(f.calc_center_median().y) < .06)], context='FACES')
bm.to_mesh(pile.data); bm.free()
label(pile, 'retro-box-top', 'cover-mario-world', -.43, .16, -.0, .40, axis='top', rotation=-2.2,
      crop=fit_crop('mario-world-Named_Boxarts.png', .59 / .40))
place(pile, .235, -.032, .062, shelf(-.032, .062, 0), angle=-8)
built.append(pile)
# Super Mario 64 lies on top of the boxes, where it was dropped.
mario64 = cartridge('n64-cartridge', 'bedroom-mario64-cartridge', 'mario64')
box_top = max((pile.matrix_world @ v.co).z for v in pile.data.vertices if (pile.matrix_world @ v.co).x < .03)
place(mario64, .116, -.075, .085, box_top + .0005, angle=-31, rx=-90)
mk64 = cartridge('n64-cartridge', 'bedroom-mariokart64-cartridge', 'mariokart64')
place(mk64, .116, .49, -.035, shelf(.49, -.035, 0), angle=-55)
built += [mario64, mk64]

# ---- original silver DS: the v3 retopology had lost its black keys and silver shell ----
ds = piece('ds', 'nintendo-ds')
label(ds, 'ds-upper-screen', 'ds-top-image', -.203, .203, .35, .603, offset=.004)
label(ds, 'ds-touch-screen', 'ds-touch-image', -.203, .203, -.243, .013, axis='top', offset=.002)
place(ds, .148, .29, .035, shelf(.29, .035, 2), angle=8)
built.append(ds)

# ---- GameCube from its Tripo surface; its fascia is authored at the measured 77 % width ----
gc = piece('gamecube', 'nintendo-gamecube'); place(gc, .21, -.36, .067, shelf(-.36, .067, 1), angle=3)
built.append(gc)

# ---- CRT modelled in Blender (bedroom_tv_crt_build.py), at the v3 size and spot ----
MAT['crt-image'] = bpy.data.materials['crt-image']
crt_parts, jacks_local = CRT.build()
level2 = shelf(-.19, -.005, 2)
M_crt = Matrix.Translation((-.19, -.005, level2)) @ Matrix.Rotation(math.radians(-1.5), 4, 'Z') @ Matrix.Translation((0, -.245, 0))
for p in crt_parts: p.data.transform(M_crt); p.data.update()
crt = crt_parts[0]; crt.name = 'bedroom-crt'
next(p for p in crt_parts if p.name.startswith('crt-screen')).name = 'crt-screen'
jacks = {k: M_crt @ v for k, v in jacks_local.items()}

# ---- controllers: real depth, resting on their grips ----
for src, name, width, x, y, level, angle, rx in [
        ('gamecube-controller', 'gamecube-controller', .15, .277, -.130, 1, -16, -66),
        ('n64-controller', 'n64-controller', .16, .315, -.2215, 0, -9, -63)]:
    o = piece(src, name); place(o, width, x, y, shelf(x, y, level), angle=angle, rx=rx); built.append(o)

# Cable anchors need the canonical meshes, so they are measured before the placements are baked.
def port(console, x, z):
    tree = BVHTree.FromPolygons([v.co for v in console.data.vertices], [p.vertices for p in console.data.polygons])
    hit, *_ = tree.ray_cast(Vector((x, -5, z)), Vector((0, 1, 0)))
    R = console.matrix_world.to_3x3().normalized()
    return console.matrix_world @ hit, (R @ Vector((0, -1, 0))).normalized(), R
def stem(controller):
    co = np.array([v.co[:] for v in controller.data.vertices]); top = co[np.abs(co[:, 0]) < .06, 2].max()
    sel = co[(co[:, 2] > top - .02) & (np.abs(co[:, 0]) < .06)]
    R = controller.matrix_world.to_3x3().normalized()
    return controller.matrix_world @ Vector(sel.mean(0)), (R @ Vector((0, 0, 1))).normalized()
def back(console, x, z):
    co = np.array([v.co[:] for v in console.data.vertices])
    return console.matrix_world @ Vector((x, co[:, 1].max(), z))
ports = {'gc': port(gc, -.225, .349), 'snes': port(snes, -.163, .126), 'n64': port(n64, -.234, .115)}
stems = {'gc': stem(bpy.data.objects['gamecube-controller']), 'n64': stem(bpy.data.objects['n64-controller'])}
rears = {'gc-av': back(gc, .16, .11), 'gc-power': back(gc, -.2, .12), 'snes': back(snes, .2, .12), 'n64': back(n64, .15, .1)}

for o in list(built):
    built += finish(o)

# ---- cables: round leads that end in real plugs ----
MAT['rubber'] = bpy.data.materials['bedroom-rubber']
MAT['plug-grey'] = bpy.data.materials['bedroom-clean-grey']
for c in ('yellow', 'white', 'red'): MAT['crt-jack-' + c] = bpy.data.materials['crt-jack-' + c]
extras = []
levels = [shelf(0, 0, i) for i in range(3)]
def cable(name, points, r=.0019, mat='rubber'):
    c = bpy.data.curves.new(name, 'CURVE'); c.dimensions = '3D'; c.resolution_u = 10
    c.bevel_depth = r; c.bevel_resolution = 2; c.use_fill_caps = True
    sp = c.splines.new('BEZIER'); sp.bezier_points.add(len(points) - 1)
    for b, co in zip(sp.bezier_points, points): b.co = co; b.handle_left_type = b.handle_right_type = 'AUTO'
    o = bpy.data.objects.new(name, c); bpy.context.collection.objects.link(o); c.materials.append(MAT[mat])
    select_only(o); bpy.ops.object.convert(target='MESH'); bpy.ops.object.shade_smooth()
    # Auto handles dip between points; a lead lies on a shelf, never through it.
    for v in o.data.vertices:
        if abs(v.co.x) < .61 and abs(v.co.y) < .28:
            below = [L for L in levels if L <= v.co.z + .03]
            if below and v.co.z < max(below) + r * 1.05: v.co.z = max(below) + r * 1.05
    o.data.update()
    extras.append(o); return o
def oriented(o, tip, R):
    o.data.transform(Matrix.Translation(tip) @ R.to_4x4()); o.data.update(); extras.append(o); return o
def plug(kind, tip, R):
    """The console's own plug seated in its port (bedroom_tv_parts_build.plug), body out along local -Y."""
    parts, tail = PARTS.plug(kind, 'plug-' + kind, 'plug-grey', 'rubber')
    for p in parts: oriented(p, tip, R)
    return tip + R @ tail

def lead(name, kind, console, controller, level, bend=1):
    tip, out, R = ports[console]
    start = plug(kind, tip, R)
    end, up = stems[controller] if isinstance(controller, str) else controller
    floor = shelf(start.x, start.y, level) + .0021
    p1 = start + out * .035; p1.z = (start.z + floor) / 2
    p2 = start + out * .085; p2.z = floor
    side = Vector((-(end - p2).y, (end - p2).x, 0)).normalized() * .06 * bend
    mid = (p2 + end) / 2 + side; mid.z = floor
    pre = end + up * .035; pre.z = max(pre.z, floor + .004)
    cable(name, [start, p1, p2, mid, pre, end])
levels = [shelf(0, 0, i) for i in range(3)]
lead('bedroom-cable-gamecube', 'gc', 'gc', 'gc', 1, -1)
def short_lead(name, kind, console, end, gap_y, level):
    """SNES and N64 pads lie right in front of their consoles: the lead drops into the gap between console front and
    pad and runs along it to the pad's cable exit, instead of looping out through the pad."""
    tip, out, R = ports[console]
    start = plug(kind, tip, R)
    floor = shelf(start.x, start.y, level) + .0021
    a = Vector((start.x, gap_y, (start.z + floor) / 2)); b = Vector((start.x + (end.x - start.x) * .5, gap_y, floor))
    c = Vector((end.x, gap_y, floor + .003))
    cable(name, [start, a, b, c, end])
def exit_point(o, back=True):
    pts = np.array([o.matrix_world @ v.co for v in o.data.vertices])
    edge = pts[pts[:, 1] > pts[:, 1].max() - .004] if back else pts
    mid = edge.mean(0); return Vector((mid[0], pts[:, 1].max() - .001, edge[:, 2].min() + .006))
n64c, snesc = bpy.data.objects['n64-controller'], bpy.data.objects['snes-controller']
short_lead('bedroom-cable-n64', 'n64', 'n64', exit_point(n64c), (max(v[1] for v in [n64c.matrix_world @ x.co for x in n64c.data.vertices]) + ports['n64'][0].y) / 2, 0)
short_lead('bedroom-cable-snes', 'snes', 'snes', exit_point(snesc), (max(v[1] for v in [snesc.matrix_world @ x.co for x in snesc.data.vertices]) + ports['snes'][0].y) / 2, 0)

# GameCube AV lead: three RCA plugs in the TV's front jacks, joined, over the deck edge, down to the cube's back.
R_tv = M_crt.to_3x3().normalized()
tails = []
for colour, jack in jacks.items():
    head = cyl('rca', .0042, 0, 0, -.017, -.002, 'crt-jack-' + colour, verts=18)
    collar = cyl('rca-collar', .0034, 0, 0, -.002, .004, 'plug-grey', verts=18)
    oriented(head, jack, R_tv); oriented(collar, jack, R_tv)
    tails.append(jack + R_tv @ Vector((0, -.017, 0)))
join = sum(tails, Vector()) / 3 + R_tv @ Vector((.006, -.045, -.03))
for colour, t in zip(jacks, tails):
    cable('av-' + colour, [t, t + R_tv @ Vector((0, -.015, -.004)), join], .0014)
gx = rears['gc-av']
cable('bedroom-cable-av', [join, Vector((join.x - .01, -.272, levels[2] + .003)), Vector((join.x - .02, -.29, levels[2] - .03)),
      Vector((join.x - .04, -.285, levels[1] + .09)), Vector((join.x - .07, -.215, levels[1] + .0026)),
      Vector((-.47, -.17, levels[1] + .0026)), Vector((-.49, .08, levels[1] + .0026)), Vector((gx.x - .02, gx.y + .04, levels[1] + .01)),
      gx + Vector((0, .012, 0)), gx], .0026)
# Mains leads leave the backs and drop behind the stand.
def mains(name, start, level):
    cable(name, [start, start + Vector((0, .04, -.01)), Vector((start.x, .27, levels[level] + .01)),
                 Vector((start.x + .03, .3, max(levels[level] - .12, .01))), Vector((start.x + .06, .32, .006)), Vector((start.x + .2, .34, .006))], .0026)
mains('gamecube-power', rears['gc-power'], 1)
mains('snes-power', rears['snes'], 0); mains('n64-power', rears['n64'], 0)
mains('tv-power', M_crt @ Vector((.08, .49, .05)), 2)

# ---- the Game Boy lies on the deck instead of hovering on one edge ----
gb_parts = [o for o in bpy.data.objects if o.type == 'MESH' and (o.name == 'nintendo-gameboy' or o.name.startswith('gameboy-'))]
pivot = sum((o.matrix_world @ Vector(c) for o in gb_parts for c in o.bound_box), Vector()) / (8 * len(gb_parts))
a = math.radians(-12)
D = Matrix.Translation(pivot) @ Matrix.Rotation(math.radians(20), 4, 'Z') @ Matrix.Rotation(a, 4, 'Z') @ Matrix.Rotation(math.radians(-24), 4, 'X') @ Matrix.Rotation(-a, 4, 'Z') @ Matrix.Translation(-pivot)
for o in gb_parts: o.data.transform(o.matrix_world.inverted() @ D @ o.matrix_world); o.data.update()
low = min((o.matrix_world @ v.co).z for o in gb_parts for v in o.data.vertices)
lift = shelf(pivot.x, pivot.y, 2) - low
move = Matrix.Translation((.541 - pivot.x, -.06 - pivot.y, lift))
for o in gb_parts: o.data.transform(o.matrix_world.inverted() @ move @ o.matrix_world); o.data.update()
low = min((o.matrix_world @ v.co).z for o in gb_parts for v in o.data.vertices)
lift = shelf(.541, -.06, 2) - low   # the old stand's wing height, which the new stand keeps
for o in gb_parts: o.data.transform(o.matrix_world.inverted() @ Matrix.Translation((0, 0, lift)) @ o.matrix_world); o.data.update()

# ---- GameCube cases the way a kid leaves them: uneven stacks with readable spines, Melee leant against one ----
MAT['case-black'] = bpy.data.materials.get('case-black') or R.material('case-black', 0x101115, .32, 0)
GC = os.path.join(ART, 'gc')
ATLAS = json.load(open(os.path.join(GC, 'spines-atlas.json')))
MAT['gc-spines'] = image_mat('gc-spines', os.path.join(GC, 'spines-atlas.png'))
def gc_cover(game):
    key = 'cover-gc-' + game
    if key not in MAT: MAT[key] = image_mat(key, os.path.join(GC, game + '-front.png'))
    return key
CL, CW, CT = .19, .135, .014   # case length (cover height), width, thickness
def case(name, game, cover=False):
    row = ATLAS['games'].index(game); rh = ATLAS['rowHeight'] / ATLAS['size']
    """Lying frame: long side along X (cover top at -X), spine on the -Y edge, cover on top (+Z), bottom at z=0."""
    body = box(name, -CL / 2, CL / 2, -CW / 2, CW / 2, 0, CT, 'case-black')
    bevel_edges(body, lambda e: True, .0016, 2)
    parts = [body]
    x0, x1, z0, z1, y = -CL / 2 + .002, CL / 2 - .002, .0014, CT - .0014, -CW / 2 - .0004
    v = lambda zz: 1 - (row + 1) * rh + rh * (.04 + .92 * (zz - z0) / (z1 - z0))
    parts.append(mesh(name + '-spine', [(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)], [(0, 1, 2, 3)], 'gc-spines',
                      {0: (.004, v(z0)), 1: (.996, v(z0)), 2: (.996, v(z1)), 3: (.004, v(z1))}))
    if cover:
        y0, y1, z = -CW / 2 + .0035, CW / 2 - .002, CT + .0004
        parts.append(mesh(name + '-cover', [(x1, y0, z), (x1, y1, z), (x0, y1, z), (x0, y0, z)], [(0, 1, 2, 3)], gc_cover(game),
                          {0: (0, 0), 1: (1, 0), 2: (1, 1), 3: (0, 1)}))
    return parts
def put(parts, M):
    for p in parts: p.data.transform(M); p.data.update(); extras.append(p)
def stack(name, x, y, rows, turn, top_cover=None, top_turn=0, seed=0):
    rng = np.random.default_rng(seed); z = shelf(x, y, 1)
    for i, row in enumerate(rows):
        last = i == len(rows) - 1
        jitter = Vector((rng.uniform(-.008, .008), rng.uniform(-.006, .006), 0))
        ang = turn + rng.uniform(-6, 6) + (top_turn if last else 0)
        put(case(f'{name}-{i}', row, bool(top_cover) and last),
            Matrix.Translation(Vector((x, y, z)) + jitter) @ Matrix.Rotation(math.radians(ang), 4, 'Z'))
        z += CT + .0004
    return z
top_a = stack('bedroom-case-stack', -.115, .085, ['metroid-prime', 'luigis-mansion', 'pikmin', 'sunshine', 'twilight-princess',
              'double-dash', 'wind-waker'], 2, True, 17, seed=3)
stack('bedroom-case-pile', .12, .12, ['f-zero-gx', 'animal-crossing', 'paper-mario', 'mario-party-4'], -9, True, -23, seed=7)
# Melee stands leant on the front of the tall stack, cover to the room.
STAND = Matrix(((0, 1, 0, 0), (0, 0, -1, 0), (-1, 0, 0, CL / 2), (0, 0, 0, 1)))   # lying frame -> upright, back face at y=0
front = .085 - CW / 2 - .006
lean = math.radians(-18)
yb = front - .014 - (.098 / math.cos(lean)) * math.sin(-lean)
put(case('bedroom-melee-case', 'melee', True), Matrix.Translation((-.122, yb, shelf(-.122, yb, 1))) @ Matrix.Rotation(math.radians(4), 4, 'Z')
    @ Matrix.Rotation(lean, 4, 'X') @ STAND)
for o in extras:
    select_only(o); t = o.modifiers.new('tri', 'TRIANGULATE'); bpy.ops.object.modifier_apply(modifier=t.name)
note('V5 EXTRAS %d objects, %d triangles' % (len(extras), sum(len(o.data.polygons) for o in extras)))
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
with open(os.path.join(RENDER, 'v6-swap.json'), 'w') as f:
    json.dump({'triangles': total, 'materials': mats, 'log': log}, f, indent=2)
scene = bpy.context.scene; scene.cycles.samples = 64
if os.environ.get('BEDROOM_RENDER_ASSEMBLY') != '0':
    cam = scene.camera
    for name, loc, target, scale in [('assembly', (1.2, -3.8, 1.65), (0, 0, .62), 1.47), ('front', (0, -4, 1.24), (0, 0, .61), 1.44),
                                     ('games', (.65, -2, 1.2), (-.03, 0, .42), .89), ('lower', (.3, -2, .55), (0, 0, .2), .78)]:
        cam.location = loc; cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler(); cam.data.ortho_scale = scale
        scene.render.filepath = os.path.join(RENDER, name + '.png'); bpy.ops.render.render(write_still=True)
print('V6 DONE', DST, flush=True)
