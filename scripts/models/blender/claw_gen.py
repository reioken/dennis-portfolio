"""
claw_gen.py — procedural claw machine (Greifautomat) generator for Blender 5.x (headless).

Sister of cabinet_gen.py: builds ONE crane cabinet from a JSON spec, exports a game-ready
GLB and (optionally) renders an Eevee studio preview.

    blender --background --python scripts/models/blender/claw_gen.py -- \
        --spec .source-assets/models-in/claw/spec.json \
        --out  .source-assets/models-in/claw/claw.glb \
        [--preview .source-assets/models-in/claw] [--figure public/models/dennis.glb] \
        [--blend debug.blend]

Coordinate conventions (same as cabinet_gen.py)
------------------------------------------------
Built Z-up with the FRONT facing -Y, standing on z = 0, centred on x = 0 / y = 0. The glTF
exporter (Y-up) turns that into front = +Z for the three.js hall scene. Every node is exported
with an identity transform EXCEPT the three moving parts, whose object origin is their pivot:

    carriage   pivot at the centre of the carriage block (bbox centre)
    claw       pivot at the attachment point under the carriage; the cable continues upwards
               past the pivot, hidden inside the winch housing and the canopy, so the scene may
               lower the claw node (up to ~0.25 m) without the cable detaching. That hidden
               length also mirrors the tip depth, which keeps the mesh bbox centred on the
               pivot — gltf-transform's `quantize` (optimize.mjs) rewrites node translations
               to the mesh bbox centre, and a symmetric mesh keeps the pivot exact.
    disc       pivot at the centre of the turntable (bbox centre)
    joy        joystick (washer + shaft + ball), pivot where the shaft enters the ledge surface
    btn        the play button (ring + cap), pivot = cap rest position on the ledge surface
               (joy/btn are asymmetric, so their pivot survives only in the Blender export —
               after optimize.mjs the node origin is the bbox centre, see cabinet_gen.py)

Mesh names are a contract with src/components/hall/hallScene.ts:
    body chrome glass back floor lamp led gantry carriage claw disc marquee joy btn coin chute
    (`marquee` is a single quad, UV 0..1 upright, like the cabinets' marquee.)

Spec fields (metres / sRGB hex; all optional except name)
    name          output basename
    paint         cabinet paint              "#14121a"
    chrome        chrome / posts / frames    "#d8dbe4"
    accent        joystick, button, disc rim, LED strips   "#c8daf4"
    glassTint     pane tint                  "#8fb0c8"
    height width depth                       1.95 / 0.9 / 0.9
    baseHeight    base cabinet height (glass box starts here)   0.74
    canopyHeight  header height                                 0.15
    wear          roughness-noise amplitude 0..1 (paint only)   0.25
    marqueeText   preview-only lettering on the marquee (default: name)

Layout (defaults): base 0..0.74, glass box 0.74..1.80, canopy 1.80..1.95. The turntable top is
at baseHeight + 0.06; a 0.62 m figure on it leaves 0.12 m to the claw tip at rest.
"""

import argparse
import json
import math
import os
import sys

import bpy
import bmesh
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cabinet_gen as cg  # noqa: E402  (helpers + studio; module state: cg.COLL, cg._MATS)
from cabinet_gen import (  # noqa: E402
    apply_modifiers,
    at,
    bm_to_object,
    box,
    box_project_uv,
    build_studio,
    control_group,
    cylinder,
    export_glb,
    frame_plate,
    gltf_bbox,
    grey,
    hex_rgb,
    join_objects,
    make_wear_image,
    material,
    prism_yz,
    quad,
    render_preview,
    seg_frame,
    sphere,
    tiny_tex,
    tri_count,
)

I4 = Matrix.Identity(4)


def rot(axis, deg):
    return Matrix.Rotation(math.radians(deg), 4, axis)


def T(x, y, z):
    return Matrix.Translation((x, y, z))


def wbox(name, sx, sy, sz, mat, center, bevel=0.0, seg=2):
    """World-axis box: sx along X, sy along Y (depth), sz along Z (height)."""
    return box(name, sx, sy, sz, mat, I4, bevel=bevel, seg=seg, center=center)


def loft_tube(name, points, radii, side, mat, segs=10):
    """Tapered tube through 3D `points` (one radius per point), capped. `side` is a constant
    unit vector perpendicular to the path plane, so the ring frames never twist."""
    bm = bmesh.new()
    pts = [Vector(p) for p in points]
    n = len(pts)
    side = Vector(side).normalized()
    rings = []
    for i in range(n):
        if i == 0:
            t = pts[1] - pts[0]
        elif i == n - 1:
            t = pts[-1] - pts[-2]
        else:
            t = pts[i + 1] - pts[i - 1]
        t.normalize()
        v = t.cross(side).normalized()
        ring = []
        for k in range(segs):
            a = 2 * math.pi * k / segs
            ring.append(bm.verts.new(pts[i] + (side * math.cos(a) + v * math.sin(a)) * radii[i]))
        rings.append(ring)
    for i in range(n - 1):
        for k in range(segs):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % segs], rings[i + 1][(k + 1) % segs], rings[i + 1][k]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    ob = bm_to_object(name, bm, mat, None, smooth=True)
    cg.mark_sharp_by_angle(ob.data, 60.0)
    return ob


def world_bbox(ob):
    pts = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def yup(v):
    """Blender (x, y, z) -> glTF (x, up, front)."""
    return (v[0], v[2], -v[1])


# --------------------------------------------------------------------------------------
# spec
# --------------------------------------------------------------------------------------


class Spec:
    def __init__(self, d):
        self.name = d.get("name", "claw")
        self.paint = hex_rgb(d.get("paint"), hex_rgb("#14121a"))
        self.chrome = hex_rgb(d.get("chrome"), hex_rgb("#d8dbe4"))
        self.accent = hex_rgb(d.get("accent"), hex_rgb("#c8daf4"))
        self.glass_tint = hex_rgb(d.get("glassTint"), hex_rgb("#8fb0c8"))
        self.H = float(d.get("height", 1.95))
        self.W = float(d.get("width", 0.9))
        self.D = float(d.get("depth", 0.9))
        self.base_h = float(d.get("baseHeight", 0.74))
        self.top_h = float(d.get("canopyHeight", 0.15))
        self.wear = float(d.get("wear", 0.25))
        self.marquee_text = d.get("marqueeText") or self.name.replace("-", " ")


# --------------------------------------------------------------------------------------
# the machine
# --------------------------------------------------------------------------------------


def build(s, wear_img):
    W, D, H = s.W, s.D, s.H
    base_top = s.base_h
    top0 = H - s.top_h  # canopy bottom = glass box top
    glass_h = top0 - base_top
    fr = 0.03  # chrome frame rail height
    post_r = 0.0225  # corner post radius (Ø 0.045)
    zc = base_top + glass_h / 2

    # --- materials ---------------------------------------------------------------------
    paint = material("claw_paint", s.paint, rough=0.42, coat=0.25, rough_tex=wear_img)
    chrome = material("claw_chrome", s.chrome, rough=0.18, metal=1.0)
    metal = material("claw_metal", grey(0.55), rough=0.38, metal=1.0)
    dark = material("claw_dark", grey(0.04), rough=0.5, spec=0.35)
    hole = material("claw_hole", grey(0.004), rough=0.9)
    glass = material("claw_glass", tuple(c * 0.35 for c in s.glass_tint), rough=0.05, alpha=0.12)
    accent = material("claw_accent", s.accent, rough=0.3, coat=0.3, emit=s.accent, emit_strength=0.25)
    led = material("claw_led", s.accent, rough=0.4, emit=s.accent, emit_strength=3.0)
    lamp_m = material("claw_lamp", grey(1.0), rough=0.5, emit=(1.0, 0.96, 0.9), emit_strength=4.0)
    floor_m = material("claw_floor", hex_rgb("#cfccd6"), rough=0.8, spec=0.3)
    back_m = material("claw_back", hex_rgb("#241f33"), rough=0.65, spec=0.35)
    marquee_m = material("claw_marquee", grey(0.95), rough=0.4, emit=grey(1.0), emit_strength=1.0, base_tex=tiny_tex("claw_marquee_tex", (0.98, 0.98, 0.98)))

    G = {k: [] for k in ("body", "chrome", "glass", "back", "floor", "lamp", "led", "gantry", "carriage", "claw", "disc", "marquee", "coin", "chute")}
    info = {"pivots": {}}  # control name -> world pivot, see control_group()

    # front face frame of the base: X right, Y up, Z out (towards the player)
    F, _ = seg_frame((-D / 2, 0.0), (-D / 2, 1.0))

    art = material("claw_art", grey(.05), rough=.48, base_tex=tiny_tex("claw_art_tex", (.05,.05,.05)))
    G["front_art"] = [quad("front_art", W-.04, base_top-.075, art, at(F,0,base_top/2,.0008))]

    # --- base cabinet ------------------------------------------------------------------
    plinth_h = 0.05
    G["body"].append(wbox("base", W, D, base_top - 0.04, paint, (0, 0, 0.04 + (base_top - 0.04) / 2), bevel=0.012, seg=3))
    G["body"].append(wbox("plinth", W - 0.05, D - 0.05, plinth_h, dark, (0, 0, plinth_h / 2), bevel=0.004, seg=1))
    G["chrome"].append(box("kick", W - 0.06, 0.10, 0.005, metal, at(F, 0, 0.105, 0.0025), bevel=0.002, seg=1))

    # control ledge: sloped shelf protruding from the front, just under the glass
    yF, yB = -D / 2 - 0.14, -D / 2 + 0.03
    zb, zft, zbt = base_top - 0.15, base_top - 0.07, base_top - 0.045
    G["body"].append(prism_yz("ledge", [(yF, zb), (yF, zft), (yB, zbt), (yB, zb)], -0.28, 0.28, paint, bevel=0.010, seg=3))
    LF, LL = seg_frame((yF, zft), (yB, zbt))  # Y along the slope (front -> back), Z = surface normal
    jx, jy = -0.10, LL * 0.46
    joy = control_group(G, info["pivots"], "joy", LF, jx, jy, 0.0)  # own object, origin on the ledge surface
    joy.append(cylinder("joy_washer", 0.03, 0.004, dark, at(LF, jx, jy, 0.002), segs=24))
    joy.append(cylinder("joy_shaft", 0.006, 0.075, chrome, at(LF, jx, jy, 0.004 + 0.0375), segs=12))
    joy.append(sphere("joy_ball", 0.020, accent, at(LF, jx, jy, 0.004 + 0.075 + 0.012), segs=24, rings=12))
    bx, by = 0.10, LL * 0.46
    btn = control_group(G, info["pivots"], "btn", LF, bx, by, 0.0)  # own object, origin = cap rest position
    btn.append(cylinder("btn_ring", 0.027, 0.006, dark, at(LF, bx, by, 0.003), segs=28))
    btn.append(cylinder("btn_cap", 0.021, 0.013, accent, at(LF, bx, by, 0.006 + 0.0065), segs=28, bevel=0.006, bevel_seg=2))

    # coin door (front right): raised frame with a recessed door plate
    cx, cy = 0.21, 0.41
    door_w, door_h = 0.155, 0.215
    G["coin"].append(frame_plate("coin_frame", door_w + 0.035, door_h + 0.035, door_w, door_h, 0.012, -0.002, 0.011, dark, at(F, cx, cy, 0), bevel=0.003, seg=2, inner_bevel=0.002))
    G["coin"].append(box("coin_door", door_w, door_h, 0.004, metal, at(F, cx, cy, 0.0025)))
    dz = 0.0045  # door face
    G["coin"].append(box("slot_plate", 0.045, 0.07, 0.006, dark, at(F, cx, cy + 0.05, dz + 0.003), bevel=0.0015, seg=1))
    G["coin"].append(box("slot", 0.005, 0.03, 0.002, hole, at(F, cx, cy + 0.058, dz + 0.007)))
    G["coin"].append(cylinder("coin_return", 0.008, 0.005, chrome, at(F, cx, cy + 0.027, dz + 0.0025), segs=14))
    G["coin"].append(box("slot_lip", 0.028, 0.008, 0.003, chrome, at(F, cx, cy + 0.078, dz + 0.0065), bevel=0.001, seg=1))
    G["coin"].append(cylinder("lock", 0.007, 0.004, chrome, at(F, cx + 0.06, cy + 0.088, dz + 0.002), segs=14))
    G["coin"].append(box("cup", 0.10, 0.04, 0.018, metal, at(F, cx, cy - 0.078, dz + 0.009), bevel=0.004, seg=2))
    G["coin"].append(box("cup_hole", 0.08, 0.02, 0.004, hole, at(F, cx, cy - 0.081, dz + 0.018)))

    # prize chute (front left): dark opening behind a clear flap, push bar at the bottom
    hx, hy = -0.20, 0.36
    ch_w, ch_h = 0.27, 0.23
    G["chute"].append(frame_plate("chute_frame", ch_w + 0.04, ch_h + 0.04, ch_w, ch_h, 0.010, -0.002, 0.008, dark, at(F, hx, hy, 0), bevel=0.003, seg=2, inner_bevel=0.002))
    G["chute"].append(box("chute_hole", ch_w, ch_h, 0.003, hole, at(F, hx, hy, 0.0015)))
    flap_h = ch_h - 0.008
    flap_m = at(F, hx, hy + ch_h / 2 - 0.002, 0.006) @ rot("X", -4) @ T(0, -flap_h / 2, 0)  # hinged at the top, bottom ajar
    G["glass"].append(box("chute_flap", ch_w - 0.008, flap_h, 0.004, glass, flap_m))
    G["chute"].append(box("push_bar", 0.20, 0.018, 0.005, dark, at(F, hx, hy - ch_h / 2 + 0.018, 0.006 + 0.002 + flap_h * math.sin(math.radians(4))), bevel=0.0015, seg=1))

    # LED strip under the glass box edge: on the base face, just below the chrome bottom frame
    z_led = base_top - 0.018
    G["led"].append(wbox("led_f", W - 0.12, 0.006, 0.012, led, (0, -D / 2, z_led)))
    for sx in (-1, 1):
        G["led"].append(wbox(f"led_s{sx}", 0.006, D - 0.12, 0.012, led, (sx * W / 2, 0, z_led)))

    # --- glass box ---------------------------------------------------------------------
    for sx in (-1, 1):
        for sy in (-1, 1):
            G["chrome"].append(cylinder(f"post_{sx}{sy}", post_r, glass_h, chrome, I4, segs=24, center=(sx * (W / 2 - post_r), sy * (D / 2 - post_r), zc)))
    for z0, nm in ((base_top + fr / 2, "bf"), (top0 - fr / 2, "tf")):
        for sy in (-1, 1):
            G["chrome"].append(wbox(f"{nm}_y{sy}", W, 2 * post_r, fr, chrome, (0, sy * (D / 2 - post_r), z0), bevel=0.003, seg=1))
        for sx in (-1, 1):
            G["chrome"].append(wbox(f"{nm}_x{sx}", 2 * post_r, D - 4 * post_r, fr, chrome, (sx * (W / 2 - post_r), 0, z0), bevel=0.003, seg=1))
    pane_w, pane_d, pane_h = W - 2 * post_r, D - 2 * post_r, glass_h - 2 * fr
    G["glass"].append(quad("glass_f", pane_w, pane_h, glass, T(0, -(D / 2 - post_r), zc) @ rot("X", 90)))
    G["glass"].append(quad("glass_l", pane_d, pane_h, glass, T(-(W / 2 - post_r), 0, zc) @ rot("Z", -90) @ rot("X", 90)))
    G["glass"].append(quad("glass_r", pane_d, pane_h, glass, T(W / 2 - post_r, 0, zc) @ rot("Z", 90) @ rot("X", 90)))
    back_t = 0.012
    G["back"].append(wbox("back", pane_w, back_t, pane_h, back_m, (0, D / 2 - post_r, zc)))
    floor_t = 0.015
    floor_top = base_top + 0.01 + floor_t
    G["floor"].append(wbox("floor", pane_w, pane_d, floor_t, floor_m, (0, 0, floor_top - floor_t / 2), bevel=0.003, seg=1))
    G["lamp"].append(wbox("lamp", W - 0.16, 0.03, 0.025, lamp_m, (0, D / 2 - 0.065, top0 - fr - 0.02), bevel=0.003, seg=1))
    info["glass_inner"] = (Vector((-(W / 2 - post_r), -(D / 2 - post_r), floor_top)), Vector((W / 2 - post_r, D / 2 - post_r - back_t / 2, top0 - fr)))

    # --- gantry (static) -----------------------------------------------------------------
    rail_y, rail_z, rail_r = 0.19, top0 - 0.038, 0.011
    for sy in (-1, 1):
        G["gantry"].append(cylinder(f"rail_{sy}", rail_r, W - 0.16, chrome, T(0, sy * rail_y, rail_z) @ rot("Y", 90), segs=14))
        for sx in (-1, 1):
            zb0 = rail_z - 0.005
            G["gantry"].append(wbox(f"bracket_{sx}{sy}", 0.028, 0.028, top0 - zb0, dark, (sx * (W / 2 - 0.095), sy * rail_y, (zb0 + top0) / 2)))

    # --- carriage (moving: bridge across the rails + trolley + winch housing) --------------
    for sy in (-1, 1):
        G["carriage"].append(wbox(f"roller_{sy}", 0.05, 0.075, 0.05, dark, (0, sy * rail_y, rail_z), bevel=0.004, seg=2))
    bridge_z = rail_z - rail_r - 0.012
    G["carriage"].append(cylinder("bridge", 0.008, 2 * rail_y + 0.02, chrome, T(0, 0, bridge_z) @ rot("X", 90), segs=12))
    trolley_h = 0.055
    trolley_top = bridge_z + 0.011
    G["carriage"].append(wbox("trolley", 0.10, 0.08, trolley_h, dark, (0, 0, trolley_top - trolley_h / 2), bevel=0.005, seg=2))
    G["carriage"].append(wbox("winch", 0.06, 0.06, top0 - 0.001 - trolley_top, dark, (0, 0, (trolley_top + top0 - 0.001) / 2), bevel=0.004, seg=1))
    G["carriage"].append(cylinder("winch_cap", 0.018, 0.004, chrome, I4, segs=16, center=(0, 0, trolley_top + 0.002)))
    claw_origin = Vector((0, 0, trolley_top - trolley_h))

    # --- claw (moving; pivot = attachment point under the trolley) -----------------------
    chuck_top = claw_origin.z - 0.027
    chuck_h = 0.048
    chuck_bot = chuck_top - chuck_h
    G["claw"].append(cylinder("collar", 0.012, 0.014, dark, I4, segs=12, center=(0, 0, chuck_top + 0.005)))
    # chuck radius > prong knuckle radius + tube radius, so the (symmetric) chuck sets the x/y extents
    G["claw"].append(cylinder("chuck", 0.044, chuck_h, chrome, I4, segs=24, center=(0, 0, chuck_top - chuck_h / 2), bevel=0.009, bevel_seg=2, r2=0.030))
    G["claw"].append(cylinder("chuck_rim", 0.044, 0.006, dark, I4, segs=24, center=(0, 0, chuck_bot + 0.003)))
    prong = [(0.030, 0.006), (0.034, -0.010), (0.037, -0.026), (0.033, -0.042), (0.025, -0.056), (0.016, -0.067), (0.007, -0.075), (0.002, -0.079)]
    radii = [0.0062, 0.0062, 0.0058, 0.0053, 0.0046, 0.0038, 0.0028, 0.0016]
    for k in range(3):
        a = math.radians(90 + 120 * k)  # one prong at the back, two at the front
        ca, sa = math.cos(a), math.sin(a)
        pts = [(ca * r, sa * r, chuck_bot + dz) for r, dz in prong]
        G["claw"].append(loft_tube(f"prong_{k}", pts, radii, (-sa, ca, 0), chrome, segs=10))
    # tip depth below the pivot -> the hidden cable mirrors it above (bbox stays centred)
    tip_z = min(world_bbox(o)[0].z for o in G["claw"])
    cable_top = claw_origin.z + (claw_origin.z - tip_z)
    G["claw"].append(cylinder("cable", 0.003, cable_top - chuck_top, dark, I4, segs=8, center=(0, 0, (cable_top + chuck_top) / 2)))
    info["claw_origin"] = claw_origin
    info["claw_tip"] = Vector((0, 0, tip_z))

    # --- turntable -------------------------------------------------------------------------
    disc_r, disc_t = 0.24, 0.04
    disc_top = base_top + 0.06
    G["disc"].append(cylinder("disc_rim", disc_r, disc_t, accent, I4, segs=48, center=(0, 0, disc_top - disc_t / 2), bevel=0.006, bevel_seg=2))
    G["disc"].append(cylinder("disc_plate", disc_r - 0.018, 0.004, floor_m, I4, segs=48, center=(0, 0, disc_top)))
    info["disc_top"] = disc_top + 0.002

    # --- canopy + marquee ------------------------------------------------------------------
    G["body"].append(wbox("canopy", W + 0.04, D + 0.04, s.top_h, paint, (0, 0, top0 + s.top_h / 2), bevel=0.02, seg=4))
    yM = -(D / 2 + 0.02)
    MF, _ = seg_frame((yM, top0), (yM, H))
    mq_w, mq_h = W - 0.16, s.top_h - 0.05
    G["body"].append(box("mq_surround", mq_w + 0.04, mq_h + 0.03, 0.008, dark, at(MF, 0, s.top_h / 2, 0.001), bevel=0.003, seg=1))
    mq = quad("marquee", mq_w, mq_h, marquee_m, at(MF, 0, s.top_h / 2, 0.010) @ rot("X", 4))  # top edge 4° forward
    G["marquee"].append(mq)
    for yy in (s.top_h / 2 - mq_h / 2 - 0.006, s.top_h / 2 + mq_h / 2 + 0.006):
        G["chrome"].append(box("mq_retainer", mq_w + 0.04, 0.012, 0.010, chrome, at(MF, 0, yy, 0.010), bevel=0.002, seg=1))
    for xx in (-mq_w / 2 - 0.014, mq_w / 2 + 0.014):
        G["chrome"].append(box("mq_clip", 0.012, mq_h + 0.02, 0.010, chrome, at(MF, xx, s.top_h / 2, 0.010), bevel=0.002, seg=1))
    # brand-coloured light seam along the canopy's bottom edge
    G["led"].append(wbox("seam_f", W + 0.04 - 0.09, 0.006, 0.008, led, (0, yM, top0 + 0.011)))
    for sx in (-1, 1):
        G["led"].append(wbox(f"seam_s{sx}", 0.006, D + 0.04 - 0.09, 0.008, led, (sx * (W / 2 + 0.02), 0, top0 + 0.011)))

    info["marquee_frame"] = (MF, s.top_h / 2, mq_w, mq_h)
    info["base_top"] = base_top
    info["floor_top"] = floor_top
    for skin in cg.side_surface_art(G["body"][:1], art):
        G[skin.name] = [skin]
    return G, info


# --------------------------------------------------------------------------------------
# finishing
# --------------------------------------------------------------------------------------


def finish(G, pivots, wear):
    from afterimage_detail import enrich
    enrich(G)
    for objs in G.values():
        for ob in objs:
            if ob.modifiers:
                apply_modifiers(ob)
    joined = {}
    for key, objs in G.items():
        if objs:
            joined[key] = join_objects(objs, key)
    if wear and "body" in joined:
        box_project_uv(joined["body"], scale=0.35)
    all_objs = list(joined.values())
    with bpy.context.temp_override(active_object=all_objs[0], selected_objects=all_objs, selected_editable_objects=all_objs):
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # moving parts: origin = pivot (mesh data shifted, object location set — NOT applied)
    resolved = {}
    for name, pivot in pivots.items():
        ob = joined[name]
        if pivot is None:
            lo, hi = world_bbox(ob)
            pivot = (lo + hi) / 2
        ob.data.transform(Matrix.Translation(-pivot))
        ob.location = pivot
        resolved[name] = Vector(pivot)
    bpy.context.view_layer.update()
    return all_objs, resolved


# --------------------------------------------------------------------------------------
# preview dressing (after export)
# --------------------------------------------------------------------------------------


def dress_for_preview(s, info, figure):
    MF, my, mq_w, mq_h = info["marquee_frame"]
    cu = bpy.data.curves.new("mq_text", "FONT")
    cu.body = s.marquee_text.upper()
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    cu.size = min(mq_h * 0.62, mq_w / (0.66 * max(1, len(cu.body))))
    cu.extrude = 0.0012
    cu.space_character = 1.1
    txt = bpy.data.objects.new("mq_text", cu)
    cg.COLL.objects.link(txt)
    txt.matrix_world = at(MF, 0, my - 0.003, 0.0125) @ rot("X", 4)
    cu.materials.append(material("preview_text", s.paint, rough=0.5))
    mqm = bpy.data.materials.get("claw_marquee")
    if mqm:
        b = mqm.node_tree.nodes["Principled BSDF"]
        b.inputs["Emission Color"].default_value = (1.0, 0.97, 0.9, 1.0)
        b.inputs["Emission Strength"].default_value = 0.9

    # interior light where the lamp bar sits (emission alone barely lights Eevee)
    ld = bpy.data.lights.new("interior", "AREA")
    ld.color = (1.0, 0.95, 0.88)
    ld.energy = 45
    ld.shape = "RECTANGLE"
    ld.size = s.W - 0.2
    ld.size_y = 0.08
    ld.use_shadow = True
    lo = bpy.data.objects.new("interior", ld)
    cg.COLL.objects.link(lo)
    lo.location = (0, s.D / 2 - 0.12, s.H - s.top_h - 0.07)
    lo.rotation_euler = (math.radians(-25), 0, 0)

    if figure and os.path.exists(figure):
        try:
            before = set(bpy.data.objects)
            bpy.ops.import_scene.gltf(filepath=os.path.abspath(figure))
            new = [o for o in bpy.data.objects if o not in before]
            rig = bpy.data.objects.new("figure_rig", None)
            cg.COLL.objects.link(rig)
            for o in new:
                if o.parent is None:
                    o.parent = rig
            bpy.context.view_layer.update()
            pts = [o.matrix_world @ Vector(c) for o in new if o.type == "MESH" for c in o.bound_box]
            if pts:
                zmin, zmax = min(p.z for p in pts), max(p.z for p in pts)
                cx = (min(p.x for p in pts) + max(p.x for p in pts)) / 2
                cy = (min(p.y for p in pts) + max(p.y for p in pts)) / 2
                k = 0.62 / max(1e-6, zmax - zmin)
                rig.scale = (k, k, k)
                rig.location = (-cx * k, -cy * k, info["disc_top"] - zmin * k)
                print(f"[claw] preview figure {figure}: scaled x{k:.3f} to 0.62 m on the turntable")
        except Exception as e:  # preview only — never fail the export because of the figure
            print(f"[claw] preview figure skipped: {e}")


# --------------------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------------------


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--spec", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--preview", default=None, help="directory for preview.png (3/4) and preview-front.png")
    ap.add_argument("--figure", default=None, help="optional GLB placed on the turntable in the preview (0.62 m tall)")
    ap.add_argument("--blend", default=None, help="save a .blend for debugging")
    args = ap.parse_args(argv)

    with open(args.spec, "r", encoding="utf-8") as fh:
        spec = Spec(json.load(fh))

    bpy.ops.wm.read_factory_settings(use_empty=True)
    cg.COLL = bpy.data.collections.new("claw")
    bpy.context.scene.collection.children.link(cg.COLL)
    bpy.context.scene.unit_settings.system = "METRIC"

    wear_img = make_wear_image(128, base=0.42, amp=spec.wear) if spec.wear > 0 else None
    G, info = build(spec, wear_img)
    objs, pivots = finish(G, {"carriage": None, "claw": info["claw_origin"], "disc": None, **info["pivots"]}, wear=wear_img is not None)

    total = 0
    for ob in objs:
        n = tri_count(ob)
        total += n
        lo, hi = world_bbox(ob)
        print(f"[claw]   {ob.name:<10} {n:>6} tris   bbox(Y-up) x {lo.x:+.3f}..{hi.x:+.3f}  y {lo.z:.3f}..{hi.z:.3f}  z {-hi.y:+.3f}..{-lo.y:+.3f}")
    print(f"[claw] total {total} tris, {len(objs)} meshes, {len([m for m in bpy.data.materials if m.name.startswith('claw_')])} materials")

    lo = Vector((min(world_bbox(o)[0][i] for o in objs) for i in range(3)))
    hi = Vector((max(world_bbox(o)[1][i] for o in objs) for i in range(3)))
    f3 = lambda v: f"({v[0]:+.4f}, {v[1]:+.4f}, {v[2]:+.4f})"
    print(f"[claw] whole bbox (Y-up)  min ({lo.x:+.4f}, {lo.z:+.4f}, {-hi.y:+.4f})  max ({hi.x:+.4f}, {hi.z:+.4f}, {-lo.y:+.4f})")
    print(f"[claw] base top            y = {info['base_top']:.3f}")
    print(f"[claw] floor top           y = {info['floor_top']:.3f}")
    print(f"[claw] disc top centre     {f3(yup((0, 0, info['disc_top'])))}")
    for k in ("carriage", "claw", "disc", *info["pivots"]):
        ob = bpy.data.objects[k]
        mlo, mhi = Vector(ob.bound_box[0]), Vector(ob.bound_box[6])
        print(f"[claw] {k:<8} origin       {f3(yup(pivots[k]))}   local bbox centre offset {f3(yup((mlo + mhi) / 2))}")
    print(f"[claw] claw tip at rest    {f3(yup(info['claw_tip']))}")
    gi0, gi1 = info["glass_inner"]
    print(f"[claw] glass interior      x {gi0.x:+.4f}..{gi1.x:+.4f}  y {gi0.z:.4f}..{gi1.z:.4f}  z {-gi1.y:+.4f}..{-gi0.y:+.4f}   (Y-up; z = front)")
    mq = bpy.data.objects["marquee"]
    mlo, mhi = gltf_bbox(mq)
    c = tuple((a + b) / 2 for a, b in zip(mlo, mhi))
    print(f"[claw] marquee centre      {f3(c)}  size {mhi[0] - mlo[0]:.3f} x {mhi[1] - mlo[1]:.3f} (tilt 4°, z-depth {mhi[2] - mlo[2]:.4f})")

    export_glb(objs, args.out)
    print(f"[claw] exported {args.out} ({os.path.getsize(args.out) / 1024:.0f} KB)")

    if args.preview:
        os.makedirs(args.preview, exist_ok=True)
        dress_for_preview(spec, info, args.figure)
        cam = build_studio(spec)
        H = spec.H
        render_preview(cam, os.path.join(args.preview, "preview.png"), (-2.55, -3.05, 1.6), (0.0, -0.05, H * 0.5), spec)
        render_preview(cam, os.path.join(args.preview, "preview-front.png"), (0.0, -3.9, 1.35), (0.0, 0.0, H * 0.5), spec)
        print(f"[claw] previews in {args.preview}")

    if args.blend:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(args.blend))


if __name__ == "__main__":
    main()
