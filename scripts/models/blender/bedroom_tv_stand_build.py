"""The TV stand, modelled in Blender after references/stand.png (mockup 03), replacing the generated Tripo stand
(Dennis, Oct 8: "the table needs to look way higher quality as well, texture and model wise").
Black textured laminate decks 24 mm thick with a bowed front and rounded corners, a softly rounded edge; the top
deck stops short at the right and a separate rounded wing sits beside it, a few millimetres lower; brushed steel
tube posts with dark collars at every joint; adjustable feet. Keeps the measured deck levels and footprint of the
stand it replaces, so every object stays on its shelf. World frame: x right, y back, z up, metres.
build(levels) -> list of objects; levels = top surface heights of the bottom, middle and top decks.
"""
import bpy, math
import numpy as np
from bedroom_tv_common import MAT, select_only
from hifi_gen import material, cyl

X0, X1, Y0, Y1 = -.588, .589, -.247, .247
TOP_X1, WING_X0, WING_Y0, WING_Y1 = .472, .452, -.204, .167
T = .024
POSTS = [(-.535, -.198), (-.535, .198), (.430, -.198), (.430, .198)]
WING_POSTS = [(.545, -.150), (.545, .120)]

def mats():
    for key, colour, rough, metal in [('stand-laminate', 0x26272b, .62, 0), ('stand-steel', 0xc4c7cc, .34, .55),
                                      ('stand-collar', 0x1b1c20, .5, 0), ('stand-foot', 0x111214, .7, 0)]:
        if key not in MAT: MAT[key] = bpy.data.materials.get(key) or material(key, colour, rough, metal)

def outline(x0, x1, y0, y1, bow=.016, r_front=.055, r_back=.035, right_round=False, n=10):
    """Closed outline (counter-clockwise from above): bowed front edge, rounded corners; right end a half round."""
    pts = []
    def arc(cx, cy, r, a0, a1):
        for a in np.linspace(math.radians(a0), math.radians(a1), n): pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    # front edge from left to right, bowed towards -y
    for t in np.linspace(0, 1, 24)[1:-1]:
        x = x0 + r_front + (x1 - x0 - 2 * r_front) * t
        pts.append((x, y0 - bow * math.sin(math.pi * t)))
    if right_round:
        rr = (y1 - y0) / 2; arc(x1 - rr, (y0 + y1) / 2, rr, -90, 90)
    else:
        arc(x1 - r_front, y0 + r_front, r_front, -90, 0); arc(x1 - r_back, y1 - r_back, r_back, 0, 90)
    arc(x0 + r_back, y1 - r_back, r_back, 90, 180); arc(x0 + r_front, y0 + r_front, r_front, 180, 270)
    return pts

def slab(name, pts, top):
    """A deck: the outline extruded T deep with a rounded edge (curve bevel), converted to mesh."""
    c = bpy.data.curves.new(name, 'CURVE'); c.dimensions = '2D'; c.fill_mode = 'BOTH'
    c.extrude = T / 2 - .004; c.bevel_depth = .004; c.bevel_resolution = 3; c.resolution_u = 4
    s = c.splines.new('POLY'); s.points.add(len(pts) - 1)
    for p, (x, y) in zip(s.points, pts): p.co = (x, y, 0, 1)
    s.use_cyclic_u = True
    o = bpy.data.objects.new(name, c); bpy.context.collection.objects.link(o); o.location.z = top - T / 2
    c.materials.append(MAT['stand-laminate'])
    select_only(o); bpy.ops.object.convert(target='MESH'); bpy.ops.object.transform_apply(location=True)
    return o

def build(levels):
    mats(); parts = []
    for i, top in enumerate(levels):
        if i < 2: parts.append(slab('tv-stand-deck', outline(X0, X1, Y0, Y1, right_round=False), top))
        else:
            parts.append(slab('tv-stand-deck', outline(X0, TOP_X1, Y0, Y1), top))
            parts.append(slab('tv-stand-wing', outline(WING_X0, X1, WING_Y0, WING_Y1, bow=0, r_front=.055, r_back=.055), top - .007))
    # posts between the decks, collars where they meet a deck
    for lower, upper, spots in [(levels[0], levels[1], POSTS + WING_POSTS[:0]), (levels[1], levels[2], POSTS), (levels[1], levels[2] - .007, WING_POSTS)]:
        z0, z1 = lower, upper - T
        for x, y in spots:
            parts.append(cyl('tv-stand-post', .0145, 0, 0, z0, z1, 'stand-steel', verts=28, axis='Z', at=(x, y)))
            for zc in (z0, z1 - .012):
                parts.append(cyl('tv-stand-collar', .0175, 0, 0, zc, zc + .012, 'stand-collar', verts=28, axis='Z', at=(x, y)))
    # wing posts continue down to the bottom deck as in the reference
    for x, y in WING_POSTS:
        parts.append(cyl('tv-stand-post', .0145, 0, 0, levels[0], levels[1] - T, 'stand-steel', verts=28, axis='Z', at=(x, y)))
        for zc in (levels[0], levels[1] - T - .012):
            parts.append(cyl('tv-stand-collar', .0175, 0, 0, zc, zc + .012, 'stand-collar', verts=28, axis='Z', at=(x, y)))
    # adjustable feet under the bottom deck
    bottom = levels[0] - T
    for x, y in POSTS + WING_POSTS:
        parts += [cyl('tv-stand-foot', .011, 0, 0, .03, bottom, 'stand-steel', verts=24, axis='Z', at=(x, y)),
                  cyl('tv-stand-foot', .018, 0, 0, .012, .032, 'stand-foot', verts=24, axis='Z', at=(x, y))]
    for p in parts:
        select_only(p); bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
    select_only(parts[0])
    for p in parts: p.select_set(True)
    bpy.ops.object.join(); o = bpy.context.object; o.name = 'tv-stand'
    t = o.modifiers.new('tri', 'TRIANGULATE'); bpy.ops.object.modifier_apply(modifier=t.name)
    return o
