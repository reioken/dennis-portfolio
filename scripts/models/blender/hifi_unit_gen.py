# The hi-fi's CD micro system, modelled clean (Dennis, 2026-10-07, on the Tripo unit's rippled seams: "ok fix the model
# then or make a new one"). Same proportions and the same places as the Tripo model it replaces (.source-assets/hifi/
# radio-4k.glb, measured by raycasting: keys, knob, display, lid, lamp, jack), so hifi.ts's overlays stay where they
# were; but every surface is a bevelled primitive or a boolean cut, so seams are straight and highlights run clean.
# Flat materials, no textures: silver shell, darker base, dark recesses, chrome.
#   blender -b -P scripts/models/blender/hifi_unit_gen.py -- .source-assets/hifi/radio-gen.glb
# Axes as Blender's (X right, Y to the back, Z up); exported Y-up like the Tripo model, in its units (width 0.871).
import bpy, bmesh, sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hifi_gen import MAT, material, select_only, box, cyl, bevel_edges, vertical, boolean, rounded_box, soften, finish, join, export
argv = sys.argv[sys.argv.index('--') + 1:]
DST = argv[0]

FRONT, BACK, TOP, BASE = -0.425, 0.49, 0.3593, 0.058
HALF = 0.4354
KEYS = [(-0.1009, 0.1380), (-0.0335, 0.1373), (0.0342, 0.1372), (0.1014, 0.1376)]
KEY_R, KEY_FRONT = 0.0175, -0.4335
KNOB = (0.2674, 0.2115)
# the lid in the middle of the deck between the front rim and the hinge housing (Dennis: "make sure the cd is properly
# in the middle"); Tripo's sat back against the housing
LID = (0.0, -0.03, 0.30)
POWER = (-0.2751, 0.1842)
JACK = (0.1862, 0.0667)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

MAT.update(dict(silver=material('hifi-radio', 0xc3c6cc, 0.38, 0.55), base=material('hifi-radio-base', 0x5c5f66, 0.5, 0.3),
           ink=material('hifi-radio-ink', 0x16171a, 0.65, 0.0), bezel=material('hifi-radio-bezel', 0x23272f, 0.3, 0.2),
           chrome=material('hifi-radio-chrome', 0xd9dce2, 0.3, 0.9), knob=material('hifi-knob', 0xcfd2d8, 0.36, 0.8), key=material('hifi-key', 0xc9ccd3, 0.34, 0.5),
           rubber=material('hifi-radio-rubber', 0x1a1b1f, 0.8, 0.0)))

# ---------- the shell, the base under it, the hinge housing at the back ----------
body = rounded_box('radio-body', -HALF, HALF, FRONT, BACK, BASE, TOP, 'silver', 0.075, 0.032)
base = rounded_box('base', -HALF + 0.008, HALF - 0.008, FRONT + 0.008, BACK - 0.008, 0.006, BASE + 0.004, 'base', 0.068, 0.008)
hinge = rounded_box('hinge', -0.23, 0.23, 0.285, 0.47, TOP - 0.02, TOP + 0.0095, 'silver', 0.02, 0.008, top_only=True)
boolean(body, hinge, 'UNION')
# ---------- cuts: the lid's well, the top seam, the display, sockets, jack, vents ----------
boolean(body, cyl('well', LID[2], 0, 0, TOP - 0.02, TOP + 0.05, 'ink', verts=128, axis='Z', at=(LID[0], LID[1])))
boolean(body, box('seam', -HALF - 0.01, HALF + 0.01, -0.36 - 0.0018, -0.36 + 0.0018, TOP - 0.0035, TOP + 0.01, 'ink'))
# 9 mm deep (model): room for the LCD's layers behind its pane; deeper, the window hid the digits behind its own
# walls from the close-up's height
boolean(body, box('display', -0.143, 0.143, FRONT - 0.03, FRONT + 0.009, 0.207, 0.291, 'bezel'))
for i, (x, z) in enumerate(KEYS):
    boolean(body, cyl(f'socket{i}', 0.0215, x, z, FRONT - 0.03, FRONT + 0.012, 'ink'))
boolean(body, cyl('knobsocket', 0.064, KNOB[0], KNOB[1], FRONT - 0.03, FRONT + 0.016, 'ink', verts=96))
boolean(body, cyl('powersocket', 0.026, POWER[0], POWER[1], FRONT - 0.03, FRONT + 0.008, 'ink'))
boolean(body, cyl('jack', 0.0085, JACK[0], JACK[1], FRONT - 0.03, FRONT + 0.03, 'ink', verts=32))
for side in (-1, 1):
    for k in range(9):
        y = -0.31 + k * 0.016
        boolean(body, box(f'vent{side}{k}', side * HALF - 0.02, side * HALF + 0.02, y - 0.0035, y + 0.0035, 0.205, 0.3, 'ink'))
# the cut edges catch a thin highlight
soften(body)
# ---------- trims on the front: the display's dark frame, the knob's chrome bezel, the jack's ring, the power key ----------
frame = box('frame', -0.1566, 0.1566, FRONT - 0.003, FRONT + 0.002, 0.199, 0.3006, 'bezel')
boolean(frame, box('frame-hole', -0.143, 0.143, FRONT - 0.01, FRONT + 0.01, 0.207, 0.291, 'bezel'))
bevel_edges(frame, lambda e: True, 0.0012, 2)
ring = cyl('knobring', 0.0775, KNOB[0], KNOB[1], FRONT - 0.006, FRONT + 0.002, 'chrome', verts=96)
boolean(ring, cyl('knobring-hole', 0.0645, KNOB[0], KNOB[1], FRONT - 0.02, FRONT + 0.02, 'chrome', verts=96))
bevel_edges(ring, lambda e: True, 0.0015, 2)
jackring = cyl('jackring', 0.0135, JACK[0], JACK[1], FRONT - 0.003, FRONT + 0.002, 'chrome', verts=32)
boolean(jackring, cyl('jackring-hole', 0.0085, JACK[0], JACK[1], FRONT - 0.01, FRONT + 0.01, 'chrome', verts=32))
power = cyl('power', 0.0225, POWER[0], POWER[1], FRONT - 0.0075, FRONT + 0.006, 'key')
bevel_edges(power, lambda e: all(v.co.y < FRONT - 0.007 for v in e.verts), 0.004, 4)
feet = [cyl(f'foot{i}', 0.03, 0, 0, 0.0, 0.0075, 'rubber', verts=32, axis='Z', at=(sx * (HALF - 0.11), sy)) for i, (sx, sy) in enumerate([(-1, -0.3), (1, -0.3), (-1, 0.38), (1, 0.38)])]
join(body, [base, frame, ring, jackring, power] + feet)
finish(body)

# ---------- the moving parts: four keys (domed faces), the knurled knob ----------
parts = [body]
for i, (x, z) in enumerate(KEYS):
    k = cyl(f'radio-key-{i}', KEY_R, x, z, KEY_FRONT, FRONT + 0.008, 'key', verts=48)
    bevel_edges(k, lambda e: all(v.co.y < KEY_FRONT + 1e-4 for v in e.verts), 0.0045, 5)
    select_only(k); bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
    scene.cursor.location = (x, KEY_FRONT, z); bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    parts.append(k)
knob = cyl('radio-knob', 0.0615, KNOB[0], KNOB[1], -0.49, FRONT + 0.012, 'knob', verts=144)
# knurling: the side's rings step in and out round the circumference
for v in knob.data.vertices:
    dx, dz = v.co.x - KNOB[0], v.co.z - KNOB[1]
    if math.hypot(dx, dz) > 0.06:
        a = math.atan2(dz, dx); k = 1 + 0.014 * math.cos(a * 72)
        v.co.x = KNOB[0] + dx * k; v.co.z = KNOB[1] + dz * k
bm = bmesh.new(); bm.from_mesh(knob.data)
# a groove ring above the knurling, then the face's chamfer
bmesh.ops.bevel(bm, geom=[e for e in bm.edges if all(v.co.y < -0.4899 for v in e.verts)], offset=0.007, segments=4, profile=0.5, affect='EDGES', clamp_overlap=True)
bm.to_mesh(knob.data); bm.free()
select_only(knob); bpy.ops.object.shade_smooth_by_angle(angle=math.radians(30))
scene.cursor.location = (KNOB[0], -0.49, KNOB[1]); bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
parts.append(knob)

export(parts, DST)
