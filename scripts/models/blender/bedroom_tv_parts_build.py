"""Small hard-surface parts for the TV corner, modelled to real dimensions (metres) in Blender.
N64 cartridge (Dennis, v5: "the smash bros 64 cart doesnt look like that irl"): 116 x 75 x 19 mm, arched top,
narrower foot, two vertical grooves framing the centre panel, a 61 x 49 mm label recess carrying the real PAL
label layout (NINTENDO64 band over the artwork), connector opening underneath.
Controller plugs (v5: "the plug for the snes controller is wrong"): SNES/Super Famicom plug as a flat-bottomed,
round-topped grey body with grip ribs, N64 plug in the same family but smaller, GameCube plug round.
Frames: cartridge front at y=0 facing -Y, bottom at z=0, centred on x. Plugs: tip at the origin, body along -Y.
"""
import bpy, bmesh, math
import numpy as np
from mathutils import Vector
from bedroom_tv_common import MAT, select_only, mesh, loft
from hifi_gen import box, cyl, bevel_edges, boolean

def _outline_face(name, pts, depth, mat):
    bm = bmesh.new()
    vs = [bm.verts.new((x, 0, z)) for x, z in pts]
    f = bm.faces.new(vs)
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    for v in [e for e in r['geom'] if isinstance(e, bmesh.types.BMVert)]: v.co.y += depth
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o); me.materials.append(MAT[mat])
    return o

def n64_cart(name, shell, label):
    """Returns [body, label quad]."""
    W2, FOOT2, SH, TOP, D = .058, .0535, .062, .075, .019
    pts = [(-FOOT2, 0), (FOOT2, 0), (FOOT2, .015), (W2, .019), (W2, SH)]
    for t in np.linspace(0, 1, 17)[1:-1]:
        x = W2 - 2 * W2 * t; pts.append((x, SH + (TOP - SH) * (1 - (x / W2) ** 2)))
    pts += [(-W2, SH), (-W2, .019), (-FOOT2, .015)]
    body = _outline_face(name, pts, D, shell)
    bevel_edges(body, lambda e: abs((e.verts[1].co - e.verts[0].co).y) < 1e-6, .0016, 2)
    for gx in (-.0345, .0345):
        boolean(body, box('cut', gx - .0008, gx + .0008, -.01, .0009, .004, .09, shell))
    boolean(body, box('cut', -.0315, .0315, -.01, .0007, .0155, .0665, shell))
    boolean(body, box('cut', -.041, .041, .003, .016, -.01, .007, shell))
    for p in body.data.polygons: p.use_smooth = False
    select_only(body); bpy.ops.object.shade_smooth_by_angle(angle=math.radians(30))
    q = mesh(name + '-label', [(-.0305, .0003, .0162), (.0305, .0003, .0162), (.0305, .0003, .0658), (-.0305, .0003, .0658)],
             [(0, 1, 2, 3)], label, {0: (0, 0), 1: (1, 0), 2: (1, 1), 3: (0, 1)})
    return [body, q]

def plug(kind, name, grey, rubber):
    """Plug with its tip at the origin and the body along -Y; returns parts and the boot end (cable start)."""
    parts = []
    if kind == 'gc':
        parts.append(cyl(name, .0056, 0, 0, -.026, 0, grey, verts=24))
        boot_r, length = .0034, .026
    elif kind == 'snes':
        # The real SNES/Super Famicom plug: a stadium-section grey moulding as wide as the port slot, a short nose
        # inside the slot, a lip at the port face, then tapering in plan view to the cable (Dennis, v6: "still wrong").
        def stadium(w, h, y, n=10):
            r = h / 2; pts = []
            for cx, a0 in ((w / 2 - r, -90), (-w / 2 + r, 90)):
                for a in np.linspace(math.radians(a0), math.radians(a0 + 180), n): pts.append((cx + r * math.cos(a), y, r * math.sin(a)))
            return pts
        parts.append(loft(name, [stadium(.036, .0085, .004), stadium(.036, .0085, -.001), stadium(.043, .0135, -.0025),
                                 stadium(.043, .0135, -.012), stadium(.034, .0125, -.022), stadium(.017, .0105, -.031),
                                 stadium(.012, .009, -.034)], grey))
        boot_r, length = .0036, .034
    else:
        tip_w, tip_h, back_w, back_h, length = (.016, .0095, .018, .0115, .027)
        def d_loop(w, h, y):
            # flat underside, rounded top: half a rounded rectangle plus a semicircular crown
            pts = []
            for a in np.linspace(math.pi, 0, 13): pts.append((w / 2 * math.cos(a), h * .45 + h * .55 * math.sin(a)))
            pts += [(w / 2, -h * .45 + .0015), (w / 2 - .0015, -h * .45), (-w / 2 + .0015, -h * .45), (-w / 2, -h * .45 + .0015)]
            return [(x, y, z - h * .275) for x, z in reversed(pts)]
        parts.append(loft(name, [d_loop(tip_w, tip_h, 0), d_loop(tip_w, tip_h, -.006), d_loop(back_w, back_h, -.011), d_loop(back_w, back_h, -length)], grey))
        boot_r = .0036
    parts.append(cyl(name + '-boot', boot_r, 0, 0, -length - .014, -length + .001, rubber, verts=18))
    for p in parts:
        select_only(p); bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
    return parts, Vector((0, -length - .014, 0))
