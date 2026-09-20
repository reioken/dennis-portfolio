"""
hero_terminal_gen.py — the hall's hero TERMINAL: one recipe, a different machine per product (Blender 5.x, headless).

Riftback (approved by Dennis on 2026-09-20) is the reference for the level of detail: one carcass between two side
panels, every detail cut into a panel, rounded long edges, a gloss acrylic display sheet with the monitor deep behind
a sloped shroud, a hidden light under the shelf, real arcade parts, wear as ZONES that the hall turns into chipped
paint and hairlines. Dennis: build the others the same way, same height, but each its own piece: the machine follows
what the product is, and no two wear alike.

A product's spec.json may carry a "hero" block that overrides CFG below (profile, width, screen, pedestal, where the
speakers and the light line sit, how it has aged). Without one the result is Riftback.

    blender --background --python scripts/models/blender/hero_terminal_gen.py -- \
        --spec .source-assets/models-in/mach-nexus/spec.json \
        --out  .source-assets/models-in/mach-nexus-v2/mach-nexus-v2.glb [--size 1024] [--no-bake] [--preview <dir>]
"""

import argparse
import json
import math
import os
import sys
import zlib

import bpy
import bmesh
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cabinet_gen as cg  # noqa: E402
import machine_gen as mg  # noqa: E402
import hero_gen as hg  # noqa: E402
import terminal_v3_gen as v3  # noqa: E402
from cabinet_gen import at, box, cylinder, grey, hex_rgb, material, seg_frame, sphere  # noqa: E402
from terminal_v3_gen import H, T, INSET, ring, slots  # noqa: E402

# Riftback's recipe. "controls": keyboard | transport | selectors | arcade | kiosk. Kiosk pedestals: printer | tray |
# nfc | intercom. "speakers" takes "drivers" [[x, y, r], ...] and "coin_door"; "pc_bay" takes "bay": "rack".
# "controls": keyboard | transport. "pedestal": coin_door | pc_bay | speakers. "speakers": hood | pedestal. "light_line": shelf | hood.
CFG = {
    "width": 0.95, "depth": 0.78, "tilt": 10.0,
    "shelf_z": 0.93, "shelf_edge": 0.06, "deck_len": 0.25, "deck_tilt": 7.0, "display_top": 1.66,
    "hood_drop": 0.20, "hood_angle": 30.0,
    "screen_w": 0.74, "screen_aspect": 1.6,
    "pedestal": "coin_door", "speakers": "hood", "light_line": "shelf", "controls": "keyboard", "knobs": 1,
    "kb_w": 0.60, "kb_x": -0.10, "trackball_x": 0.335,
    "paint": "#2a2620", "panel": "#30291b", "door": 0.11,
    # how it has aged: zone strengths for the bake (0 = none). Riftback is the battered veteran.
    "wear": {"edge": 1.0, "hands": 0.55, "shoes": 0.32, "knees": 0.13, "crevice": 1.0, "low": 0.8, "dust": 0.38, "corners": 0.0, "door": 0.0, "door_z": 0.60},
    # Moves every baked wear zone. Riftback (approved as it is) keeps the empty seed; every other machine names its own,
    # or the same patches would sit in the same places on every machine.
    "seed": "",
}
W = D = IW = None


def configure(overrides):
    global W, D, IW
    wear = dict(CFG["wear"])
    wear.update((overrides or {}).get("wear", {}))
    CFG.update(overrides or {})
    CFG["wear"] = wear
    hg.WEAR_SEED = CFG["seed"]
    W, D = CFG["width"], CFG["depth"]
    IW = W - 2 * T


def base_profile(top=H):
    """Side profile (y, z), clockwise from the bottom front; v3's, with every length taken from CFG."""
    c = CFG
    yf = -D / 2
    a = math.radians(c["deck_tilt"])
    A = (yf + 0.08, 0.0)
    B = (yf + 0.08, 0.10)
    C = (yf + 0.03, 0.10)
    Dp = (yf + 0.03, c["shelf_z"])
    E = (yf, c["shelf_z"])
    F = (yf, c["shelf_z"] + c["shelf_edge"])
    G = (yf + c["deck_len"] * math.cos(a), F[1] + c["deck_len"] * math.sin(a))
    Hp = (G[0] + (c["display_top"] - G[1]) * math.tan(math.radians(c["tilt"])), c["display_top"])
    J = (Hp[0] - c["hood_drop"] * math.tan(math.radians(c["hood_angle"])), c["display_top"] + c["hood_drop"])
    K = (J[0], top)
    L = (D / 2 - 0.05, top)
    Mp = (D / 2, top - 0.05)
    N = (D / 2, 0.0)
    pts = [A, B, C, Dp, E, F, G, Hp, J, K, L, Mp, N]
    return pts, dict(zip("ABCDEFGHJKLMN", pts))

hg.DIM_LED = True
hg.SUPERSAMPLE = 2
hg.WEAR_PER_PART = True
EDGE_RADIUS = 0.006  # the carcass's long convex edges
WEIGHT = "bevel_weight_edge"


def panel(name, frame, length, base_mat, recesses=(), width=None, round_start=False, round_end=False):
    """v3.panel, plus a bevel weight on the border edge that meets the neighbouring panel in a convex corner."""
    ob = v3.panel(name, frame, length, base_mat, recesses, width or IW)
    me = ob.data
    attr = me.attributes.new(WEIGHT, "FLOAT", "EDGE")
    for e in me.edges:
        a, b = (me.vertices[i].co for i in e.vertices)
        if abs(a.z) > 1e-6 or abs(b.z) > 1e-6:
            continue
        if (round_start and abs(a.y) < 1e-6 and abs(b.y) < 1e-6) or (round_end and abs(a.y - length) < 1e-6 and abs(b.y - length) < 1e-6):
            attr.data[e.index].value = 1.0
    return ob


def coin_mechs(metal, controls, M, pF, uy):
    """Two coin mechs on a door centred at uy: entry bezel, slot, lit reject button, return flap."""
    for sx in (-1, 1):
        x, y = sx * 0.068, uy + 0.035
        metal.append(box(f"coin_bezel_{sx}", 0.052, 0.088, 0.006, M["dark_metal"], at(pF, x, y, 0.001), bevel=0.002, seg=2))
        controls.append(box(f"coin_slot_{sx}", 0.0035, 0.028, 0.001, M["hole"], at(pF, x, y + 0.022, 0.0037)))
        controls.append(box(f"coin_reject_{sx}", 0.026, 0.026, 0.004, M["accent"], at(pF, x, y - 0.02, 0.0045), bevel=0.0012, seg=1))
        metal.append(box(f"coin_flap_{sx}", 0.058, 0.038, 0.0018, M["dark_metal"], at(pF, x, uy - 0.083, -0.0075, hg.rot_x(-14)), bevel=0.0006, seg=1))


def knob(metal, controls, M, frame, x, y, turn, k):
    """A turned metal knob with its skirt and a pointer line."""
    metal.append(cylinder(f"knob_skirt_{k}", 0.040, 0.004, M["dark_metal"], at(frame, x, y, 0.002), segs=48, bevel=0.0012, bevel_seg=1))
    metal.append(cylinder(f"knob_{k}", 0.031, 0.026, M["chrome"], at(frame, x, y, 0.017), segs=48, bevel=0.003, bevel_seg=3))
    a = math.radians(turn)
    controls.append(box(f"knob_mark_{k}", 0.0022, 0.016, 0.0006, M["hole"], at(frame, x - math.sin(a) * 0.016, y + math.cos(a) * 0.016, 0.0303, Matrix.Rotation(a, 4, "Z"))))


def joystick(parts, pivots, M, frame, name, x, y):
    """A ball-top arcade stick as it is really fitted: the mounting plate's four carriage bolts through the panel,
    the chrome dust washer, a rubber dust boot over the shaft, the steel shaft and the ball. Named sticks move
    (the hall tilts them); the bolts belong to the panel and stay put."""
    group = cg.control_group(parts, pivots, name, frame, x, y, 0.0) if name else parts["controls"]
    tag = name or "stick_p2"
    for k in range(4):  # the plate under the panel is bolted through it: four domed heads on a 64 mm square
        a = math.radians(45 + 90 * k)
        parts["metal"].append(dome_head(f"{tag}_bolt_{k}", frame, x + math.cos(a) * 0.045, y + math.sin(a) * 0.045, 0.0, 0.0058, 0.0032, M["dark_metal"], steps=16))
    group.append(cylinder(f"{tag}_washer", 0.030, 0.003, M["ring"], at(frame, x, y, 0.0015), segs=36, bevel=0.001, bevel_seg=1))
    group.append(lathe(f"{tag}_boot", at(frame, x, y, 0.003), [
        (M["rubber"], [(0.0215, 0.0), (0.0185, 0.013), (0.0125, 0.028), (0.0068, 0.040)]),
    ], steps=20))
    group.append(cylinder(f"{tag}_shaft", 0.0055, 0.062, M["metal"], at(frame, x, y, 0.033), segs=16))
    group.append(sphere(f"{tag}_ball", 0.0185, M["ball"], at(frame, x, y, 0.070), segs=28, rings=16))


def cut_holes(ob, frame, circles):
    """Round holes through a panel (x, y, radius in the panel's frame): one exact boolean per circle."""
    for i, (x, y, r) in enumerate(circles):
        cutter = cylinder(f"cutter_{i}", r, 0.2, None, at(frame, x, y, 0.0), segs=64)
        m = ob.modifiers.new(f"Hole{i}", "BOOLEAN")
        m.operation = "DIFFERENCE"
        m.solver = "EXACT"
        m.object = cutter
        cg.apply_modifiers(ob)
        bpy.data.objects.remove(cutter)


def lathe(name, frame, segments, steps=48):
    """A turned part: every segment is a (material, [(radius, height), ...]) profile spun about the panel's normal."""
    bm = bmesh.new()
    mats = []
    for mat, prof in segments:
        if mat not in mats:
            mats.append(mat)
        before = set(bm.faces)
        verts = [bm.verts.new((r, 0.0, z)) for r, z in prof]
        edges = [bm.edges.new((verts[i], verts[i + 1])) for i in range(len(verts) - 1)]
        bmesh.ops.spin(bm, geom=verts + edges, cent=(0, 0, 0), axis=(0, 0, 1), angle=math.tau, steps=steps, use_duplicate=False)
        for f in set(bm.faces) - before:
            f.material_index = mats.index(mat)
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    if sum(f.normal.z * f.calc_area() for f in bm.faces) < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    cg.COLL.objects.link(ob)
    ob.matrix_world = frame
    return ob


def dish_cap(name, frame, x, y, z, r, h, mat, steps=24):
    """A button cap as the real moulded part: a rolled rim and a face dished a few tenths of a millimetre towards
    the middle, so it catches a curved highlight instead of the flat disc a cylinder gives."""
    return lathe(name, at(frame, x, y, z), [
        (mat, [(0.0, h - 0.0006), (r * 0.62, h - 0.0004), (r - 0.0022, h), (r, h - 0.0038), (r, 0.0004)]),
    ], steps=steps)


def dome_head(name, frame, x, y, z, r, h, mat, steps=14):
    """The domed head of a bolt or a screw, turned instead of stacked out of a bevelled cylinder (a third of
    the triangles, and the dome is the real shape)."""
    return lathe(name, at(frame, x, y, z), [(mat, [(0.0, h), (r * 0.62, h * 0.84), (r, h * 0.22), (r, 0.0)])], steps=steps)


def cap_face(h):
    """Height of the dished face at the middle of a `dish_cap` of height h (where a printed mark lies)."""
    return h - 0.0005


def keycap(name, w, d, h, mat, frame, x, y, z):
    """A moulded keycap: the top face is smaller than the base (draft) and dished, as on any real keyboard."""
    t = min(0.0016, w * 0.11, d * 0.11)
    bm = bmesh.new()
    lo = [(-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2)]
    hi = [(-w / 2 + t, -d / 2 + t), (w / 2 - t, -d / 2 + t), (w / 2 - t, d / 2 - t), (-w / 2 + t, d / 2 - t)]
    vb = [bm.verts.new((px, py, 0.0)) for px, py in lo]
    vt = [bm.verts.new((px, py, h)) for px, py in hi]
    mid = bm.verts.new((0.0, 0.0, h - 0.0004))
    bm.faces.new(vb)
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((vb[i], vb[j], vt[j], vt[i]))
        bm.faces.new((vt[i], vt[j], mid))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    cg.COLL.objects.link(ob)
    ob.matrix_world = at(frame, x, y, z)
    hg.chamfer(ob, 0.0007)
    return ob


# A believable keyboard, row by row from the front: the modifiers are wide, the space bar spans the middle, and the
# rows are staggered because of them. Units of one key pitch; every row adds up to 14. No legends (Dennis: no text).
KEY_ROWS = (
    (1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.5),
    (2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.75),
    (1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25),
    (1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5),
)


def door_hardware(metal, controls, M, frame, cx, cy, dw, dh, zd, bolts=True, pull=0.0, hinge=0.05):
    """What holds a real door shut: two butt hinges on its left edge, bolts through the frame's four corners and,
    on a door whose lock is not the handle, a small finger pull on the latch side."""
    hx = cx - dw / 2 - 0.003
    for sy in (-1, 1):
        y = cy + sy * (dh / 2 - hinge * 0.85)
        metal.append(box("hinge_leaf", 0.017, hinge, 0.0026, M["dark_metal"], at(frame, hx, y, zd + 0.0013), bevel=0.0008, seg=1))
        metal.append(cylinder("hinge_pin", 0.0033, hinge * 0.78, M["dark_metal"], at(frame, hx - 0.0055, y, zd + 0.0034, hg.rot_x(90)), segs=12))
    if bolts:
        for sx in (-1, 1):
            for sy in (-1, 1):
                metal.append(dome_head("frame_bolt", frame, cx + sx * (dw / 2 + 0.016), cy + sy * (dh / 2 + 0.016), 0.0, 0.0046, 0.0028, M["dark_metal"]))
    if pull:
        metal.append(box("door_pull", 0.011, pull, 0.0065, M["dark_metal"], at(frame, cx + dw / 2 - 0.024, cy, zd + 0.0033), bevel=0.0024, seg=2))


def screw(metal, controls, M, frame, x, y, z, r=0.0038, turn=0.5):
    """One small dark fastener: a turned pan head. No driver slot — at 4 mm across, a slot cut into the dome is
    below what the 1 K atlas can hold, and laid on top it reads as two dark specks (Dennis hates dots)."""
    metal.append(dome_head("fastener", frame, x, y, z, r, 0.0022, M["dark_metal"], steps=12))


def catmull(points, per=6):
    """Sample a Catmull-Rom spline through `points`: a cable drapes, it does not kink."""
    P = [points[0]] + list(points) + [points[-1]]
    out = []
    for i in range(len(P) - 3):
        p0, p1, p2, p3 = (Vector(p) for p in P[i : i + 4])
        for k in range(per):
            t = k / per
            out.append(tuple(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t)))
    out.append(tuple(P[-1]))
    return out


def power_cable(parts, M):
    """The mains lead: a strain-relief bush low on the back panel, the cable curving down to the floor and a tail
    lying behind the machine, shaped by the machine's own seed.

    It stops about a hand's width behind the carcass on purpose: the hall centres every model on its bounding box
    (hallScene.loadModel), so a lead running the whole 1.2 m to the wall would push the machine that far forward
    and widen the close-up's framing with it.
    """
    h = zlib.crc32(("cable" + (CFG["seed"] or "riftback")).encode())
    s = 1.0 if (h >> 3) & 1 else -1.0
    x0 = s * min(W / 2 - 0.12, 0.10 + 0.24 * ((h >> 5) & 7) / 7.0)
    back = D / 2 - 0.02  # the back panel sits INSET behind the side panels' edge
    swing = 0.026 + 0.030 * ((h >> 9) & 7) / 7.0
    reach = 0.19 + 0.06 * ((h >> 13) & 7) / 7.0
    z = 0.0053
    pts = catmull([
        (x0, back + 0.004, 0.128),
        (x0, back + 0.055, 0.126),
        (x0 - s * 0.008, back + 0.090, 0.072),
        (x0 - s * 0.036, back + 0.098, 0.014),
        (x0 - s * 0.090, back + 0.080 + swing, z),
        (x0 - s * reach * 0.72, back + 0.046 + swing, z),
        (x0 - s * reach, back + 0.082, z),
    ], per=4)
    parts["cable"].append(cg.tube_along("mains_cable", pts, 0.0052, M["rubber"], resolution=1))
    parts["metal"].append(cylinder("cable_bush", 0.0108, 0.018, M["dark_metal"], Matrix.Translation((x0, back + 0.005, 0.128)) @ hg.rot_x(90), segs=16, bevel=0.0024, bevel_seg=2))


def shroud(name, frame, ow, oh, iw, ih, depth, mat):
    """The monitor shroud of a real cabinet: four sloped walls from the opening in the panel down to the tube."""
    bm = bmesh.new()
    outer = [bm.verts.new((sx * ow / 2, sy * oh / 2, -0.0004)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    inner = [bm.verts.new((sx * iw / 2, sy * ih / 2, -depth)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    for i in range(4):
        j = (i + 1) % 4
        f = bm.faces.new((outer[i], outer[j], inner[j], inner[i]))
        f.normal_update()
        if f.normal.z < 0:
            f.normal_flip()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    cg.COLL.objects.link(ob)
    ob.matrix_world = frame
    return ob


def build(s, M):
    sharp, P = base_profile()
    names = "ABCDEFGHJKLMN"
    idx = {n: i for i, n in enumerate(names)}
    KF = 6
    low, _ = base_profile(top=H - INSET + 0.0015)
    outer = v3.fillet(low, {idx["F"]: 0.02, idx["J"]: 0.02, idx["K"]: 0.03, idx["L"]: 0.02}, k=KF)
    carcass = v3.fillet(sharp, {idx["K"]: 0.045, idx["L"]: 0.03}, k=KF)
    inner = cg.offset_polygon(carcass, INSET)
    Pi = dict(zip(names[: idx["K"] + 1], inner))
    M["door"] = material("mach_metal_door", grey(CFG["door"]), rough=0.5, metal=1.0)  # black textured steel, like a real coin door
    M["bezel"] = material("mach_bezel_gloss", grey(0.012), rough=0.12, coat=0.4)
    M["deck"] = material("mach_deck_satin", grey(0.035), rough=0.42)  # Dennis: no second colour on the front; black like real control panels
    M["paper"] = material("mach_paper", (0.62, 0.6, 0.55), rough=0.9)
    M["cone"] = material("mach_cone", grey(0.035), rough=0.85)
    M["rubber"] = material("mach_rubber", grey(0.012), rough=0.7)
    if CFG.get("chrome"):  # a product's own metal (Lowlight: champagne) instead of plain chrome
        M["chrome"] = material("mach_chrome_tint", hex_rgb(CFG["chrome"]), rough=0.3, metal=1.0)
    M["led"] = material("mach_led", grey(0.004), rough=0.9, emit=s.brand, emit_strength=0.3)
    parts = {k: [] for k in ("body", "trim", "metal", "controls", "cable")}
    pivots = {}
    body, controls, metal = parts["body"], parts["controls"], parts["metal"]

    for sx, nm in ((-1, "side_l"), (1, "side_r")):
        x0, x1 = (-W / 2, -W / 2 + T) if sx < 0 else (W / 2 - T, W / 2)
        body.append(cg.prism_yz(nm, outer, x0, x1, M["paint"], bevel=0.003, seg=2))
        x = sx * (W / 2 - T / 2)
        pts = [(x, y, z) for y, z in outer[: idx["K"] + 3 * KF + 1]]
        parts["trim"].append(cg.tube_along(f"tmolding_{nm}", pts, 0.0072, M["trim"], resolution=2))

    def seg(a, b):
        return seg_frame(Pi[a], Pi[b])

    # toe kick: recessed steel, four evenly spaced screws on its centre line
    kF, kL = seg("A", "B")
    body.append(panel("kick", kF, kL, M["kick"]))
    for i in range(4):
        x = IW * (-0.375 + 0.25 * i)
        metal.append(cylinder("kick_screw", 0.0042, 0.002, M["metal"], at(kF, x, kL / 2, 0.001), segs=16, bevel=0.0008, bevel_seg=1))
    body.append(panel("kick_top", *seg("B", "C"), M["paint"]))

    pF, pL = seg("C", "D")
    rec = []
    if CFG["speakers"] == "pedestal":  # two stamped grilles under the shelf
        for sx in (-1, 1):
            rec += slots(sx * (IW / 2 - 0.19), pL - 0.085, 0.24, 5, 0.012, 0.005, 0.007, M["hole"])
    ped_kind = CFG["pedestal"]
    if ped_kind in ("printer", "tray", "nfc", "intercom"):
        # kiosk pedestals: what a self-service terminal of that kind carries, above one small service door
        dw, dh, dy = min(0.30, IW - 0.12), 0.32, 0.25
        rec += [(0, dy, dw, dh, 0.002, M["door"])] + ring(0, dy, dw, dh, 0.003, 0.007, M["hole"])
        fy = 0.60
        if ped_kind == "printer":  # the briefing comes out on paper
            rec += [(0, fy, 0.17, 0.011, 0.02, M["hole"])]
        elif ped_kind == "tray":  # cards: a slot to take them in, a pocket to hand them out
            rec += [(0, fy + 0.07, 0.095, 0.0045, 0.012, M["hole"]), (0, fy - 0.03, 0.21, 0.085, 0.045, M["hole"])]
        elif ped_kind == "nfc":  # hold the phone against the reader
            rec += [(0, fy, 0.105, 0.105, 0.003, M["bezel"])] + ring(0, fy, 0.105, 0.105, 0.003, 0.004, M["led"])
            rec += slots(0, fy - 0.115, 0.12, 4, 0.011, 0.0045, 0.006, M["hole"])
        else:  # intercom: someone answers
            rec += slots(0, fy + 0.04, 0.15, 9, 0.011, 0.0045, 0.007, M["hole"])
        body.append(panel("pedestal", pF, pL, M["panel"], rec))
        if ped_kind == "printer":
            controls.append(box("paper", 0.155, 0.05, 0.0006, M["paper"], at(pF, 0, fy - 0.022, 0.004, hg.rot_x(-16))))
            metal.append(box("printer_lip", 0.19, 0.012, 0.004, M["dark_metal"], at(pF, 0, fy + 0.013, 0.002), bevel=0.0012, seg=1))
            # the tear-off edge the slip is pulled against, and the two screws that hold the bezel
            metal.append(box("tear_bar", 0.175, 0.0035, 0.0055, M["metal"], at(pF, 0, fy + 0.0088, 0.0035, hg.rot_x(-32)), bevel=0.0008, seg=1))
            for sx in (-1, 1):
                screw(metal, controls, M, pF, sx * 0.082, fy + 0.013, 0.0035, r=0.0030, turn=0.9 * sx)
            controls.append(cylinder("feed_button", 0.008, 0.003, M["brand_lit"], at(pF, 0.125, fy, 0.0015), segs=20, bevel=0.001, bevel_seg=1))
        elif ped_kind == "tray":
            metal.append(box("card_bezel", 0.13, 0.03, 0.004, M["dark_metal"], at(pF, 0, fy + 0.07, -0.0015), bevel=0.0015, seg=1))
            controls.append(box("card_slot", 0.095, 0.0045, 0.001, M["hole"], at(pF, 0, fy + 0.07, 0.0008)))
            for sx in (-1, 1):
                screw(metal, controls, M, pF, sx * 0.055, fy + 0.07, 0.0005, r=0.0028, turn=0.3 * sx)
            metal.append(box("tray_flap", 0.20, 0.075, 0.002, M["dark_metal"], at(pF, 0, fy - 0.026, -0.012, hg.rot_x(-18)), bevel=0.0006, seg=1))
            # the rubber lip along the tray's mouth: what a card slides over on the way out
            controls.append(box("tray_lip", 0.205, 0.009, 0.005, M["rubber"], at(pF, 0, fy - 0.064, -0.0095, hg.rot_x(-18)), bevel=0.0018, seg=2))
        elif ped_kind == "intercom":
            metal.append(cylinder("call_ring", 0.027, 0.004, M["chrome"], at(pF, 0, fy - 0.08, 0.0002), segs=36, bevel=0.0012, bevel_seg=2))
            controls.append(cylinder("call_button", 0.021, 0.006, M["brand_lit"], at(pF, 0, fy - 0.08, 0.003), segs=32, bevel=0.002, bevel_seg=2))
            for sx in (-1, 1):  # the intercom grille is a screwed-on plate
                screw(metal, controls, M, pF, sx * 0.086, fy + 0.04, 0.0, r=0.0032, turn=0.4 * sx)
        elif ped_kind == "nfc":  # the reader is a screwed-down plate, like every terminal's
            for sx in (-1, 1):
                for sy in (-1, 1):
                    screw(metal, controls, M, pF, sx * 0.066, fy + sy * 0.066, 0.0, r=0.0030, turn=0.6 * sx + sy)
        door_hardware(metal, controls, M, pF, 0, dy, dw, dh, -0.002, pull=0.055, hinge=0.042)
        locks = [(dw / 2 - 0.03, dy + dh / 2 - 0.03)]
    elif ped_kind == "coin_door":
        # what every real coin-op upright has there: two coin mechs (entry bezel, lit reject button, return pocket
        # with its flap) and a cam lock. Dennis: ONE door; a second box with a keyhole below it looked wrong.
        dw, uh, uy = 0.30, 0.30, 0.50
        rec += [(0, uy, dw, uh, 0.002, M["door"])]
        rec += ring(0, uy, dw, uh, 0.003, 0.007, M["hole"])
        for sx in (-1, 1):
            rec += [(sx * 0.068, uy - 0.085, 0.062, 0.042, 0.016, M["hole"])]  # coin return pocket
        body.append(panel("pedestal", pF, pL, M["panel"], rec))
        coin_mechs(metal, controls, M, pF, uy)
        # a coin door is hung on two butt hinges and its frame is bolted through the pedestal; the lock is the handle
        door_hardware(metal, controls, M, pF, 0, uy, dw, uh, -0.002, hinge=0.046)
        locks = [(0, uy + uh / 2 - 0.028)]
    elif CFG["pedestal"] == "speakers":
        # music lives in the pedestal: a baffle with two woofers and two tweeters, the drivers exposed like a studio
        # monitor's. Round holes are cut through the panel; each driver is turned on a lathe (frame, surround, cone, cap).
        drivers = CFG.get("drivers") or [[sx * (IW / 2 - 0.30), 0.33, 0.175] for sx in (-1, 1)] + [[sx * (IW / 2 - 0.30), 0.655, 0.040] for sx in (-1, 1)]
        coin_y = 0.50
        if CFG.get("coin_door"):  # a jukebox takes coins: the door sits between the drivers
            rec += [(0, coin_y, 0.30, 0.30, 0.002, M["door"])] + ring(0, coin_y, 0.30, 0.30, 0.003, 0.007, M["hole"])
            for sx in (-1, 1):
                rec += [(sx * 0.068, coin_y - 0.085, 0.062, 0.042, 0.016, M["hole"])]
        ped = panel("pedestal", pF, pL, M["panel"], rec)
        cut_holes(ped, pF, [tuple(d) for d in drivers])
        body.append(ped)
        if CFG.get("coin_door"):
            coin_mechs(metal, controls, M, pF, coin_y)
            door_hardware(metal, controls, M, pF, 0, coin_y, 0.30, 0.30, -0.002, hinge=0.046)
        for di, (dx_, dy_, dr_) in enumerate(drivers):
            if dr_ < 0.07:
                tr = dr_
                body.append(lathe(f"tweeter_{di}", at(pF, dx_, dy_, 0), [
                    (M["chrome"], [(tr + 0.016, 0.0), (tr + 0.014, 0.004), (tr + 0.002, 0.004), (tr, 0.0)]),
                    (M["rubber"], [(tr, 0.0), (tr - 0.006, -0.010), (tr * 0.6, -0.012)]),
                    (M["cone"], [(tr * 0.6, -0.012), (tr * 0.5, -0.004), (tr * 0.3, 0.002), (0.0, 0.004)]),
                ], steps=40))
                continue
            wr, wx, wy, sx = dr_, dx_, dy_, di
            cap = wr * 0.33
            body.append(lathe(f"woofer_{di}", at(pF, wx, wy, 0), [
                (M["chrome"], [(wr + 0.026, 0.0), (wr + 0.024, 0.005), (wr + 0.003, 0.005), (wr + 0.001, 0.001)]),
                (M["rubber"], [(wr + 0.001, 0.001), (wr - 0.006, 0.009), (wr - 0.015, 0.012), (wr - 0.024, 0.009), (wr - 0.030, 0.0)]),
                (M["cone"], [(wr - 0.030, 0.0), (wr * 0.62, -wr * 0.2), (cap, -wr * 0.34)]),
                (M["rubber"], [(cap, -wr * 0.34), (cap * 0.9, -wr * 0.29), (cap * 0.65, -wr * 0.235), (cap * 0.35, -wr * 0.205), (0.0, -wr * 0.197)]),
            ], steps=56))
            for k in range(4):  # the four screws of a driver frame
                a = math.radians(45 + 90 * k)
                metal.append(cylinder(f"woofer_screw_{di}_{k}", 0.0042, 0.002, M["dark_metal"], at(pF, wx + math.cos(a) * (wr + 0.014), wy + math.sin(a) * (wr + 0.014), 0.0055), segs=12, bevel=0.0008, bevel_seg=1))
        locks = [(0, coin_y + 0.122)] if CFG.get("coin_door") else []
    else:
        # a desktop product lives on a PC: a ventilated bay door with the fan's glow behind its slots, and above it
        # what the front of a PC offers: a lit power button, two USB ports, a headphone jack
        dw, dh, dy = min(0.64, IW - 0.24), 0.44, 0.34
        rec += [(0, dy, dw, dh, 0.002, M["door"])]
        rec += ring(0, dy, dw, dh, 0.003, 0.007, M["hole"])
        if CFG.get("bay") == "rack":  # a host that serves the house: one wide intake and a row of status lamps
            rec += slots(0, dy - 0.05, dw * 0.82, 12, 0.019, 0.006, 0.010, M["hole"])
        else:
            for sx in (-1, 1):
                rec += slots(sx * dw * 0.24, dy - 0.02, dw * 0.36, 17, 0.0165, 0.007, 0.010, M["led"])
        px_, py_ = IW / 2 - 0.16, dy + dh / 2 + 0.04
        rec += [(px_ - 0.055, py_, 0.0135, 0.0058, 0.006, M["hole"]), (px_ - 0.030, py_, 0.0135, 0.0058, 0.006, M["hole"])]  # USB
        body.append(panel("pedestal", pF, pL, M["panel"], rec))
        metal.append(cylinder("power_ring", 0.012, 0.003, M["chrome"], at(pF, px_ + 0.02, py_, 0.0002), segs=28, bevel=0.001, bevel_seg=2))
        controls.append(cylinder("power_button", 0.0085, 0.003, M["brand_lit"], at(pF, px_ + 0.02, py_, 0.0016), segs=24, bevel=0.0012, bevel_seg=2))
        metal.append(cylinder("jack_collar", 0.0045, 0.002, M["metal"], at(pF, px_ - 0.008, py_, 0.0002), segs=16))
        controls.append(cylinder("jack_hole", 0.0019, 0.001, M["hole"], at(pF, px_ - 0.008, py_, 0.0014), segs=12))
        if CFG.get("bay") == "rack":
            for k in range(5):
                controls.append(cylinder(f"status_{k}", 0.004, 0.002, M["brand_lit"] if k % 2 == 0 else M["accent"], at(pF, -dw / 2 + 0.05 + k * 0.03, dy + dh / 2 - 0.035, 0.0024), segs=14))
        door_hardware(metal, controls, M, pF, 0, dy, dw, dh, -0.002, pull=0.085, hinge=0.055)
        locks = [(dw / 2 - 0.03, dy + dh / 2 - 0.03)]
    for i, (x, y) in enumerate(locks):
        metal.append(cylinder(f"lock_collar_{i}", 0.011, 0.004, M["chrome"], at(pF, x, y, 0.0002), segs=24, bevel=0.0012, bevel_seg=2))
        metal.append(cylinder(f"lock_core_{i}", 0.007, 0.003, M["metal"], at(pF, x, y, 0.0028), segs=20, bevel=0.0008, bevel_seg=1))
        controls.append(box(f"lock_slot_{i}", 0.0018, 0.008, 0.001, M["hole"], at(pF, x, y, 0.0045)))
    # leg levellers under the front corners
    for sx in (-1, 1):
        metal.append(cylinder(f"leveller_{sx}", 0.019, 0.012, M["metal"], Matrix.Translation((sx * (W / 2 - 0.09), -D / 2 + 0.14, 0.006)), segs=20, bevel=0.002, bevel_seg=1))

    # shelf: the underside hides the light that washes the pedestal; the front edge carries the ONE visible line
    uF, uL = seg("D", "E")
    body.append(panel("shelf_under", uF, uL, M["paint"], [(0, uL / 2, IW - 0.10, 0.020, 0.004, M["seam"])], round_end=True))
    eF, eL = seg("E", "F")
    line = [(0, eL / 2, IW - 0.08, 0.006, 0.003, M["seam"])] if CFG["light_line"] == "shelf" else []
    body.append(panel("shelf_edge", eF, eL, M["deck"], line, round_start=True, round_end=True))
    cF, cL = seg("F", "G")
    if CFG["controls"] == "keyboard":
        kb_w, kb_d, kx, ky = CFG["kb_w"], 0.135, CFG["kb_x"], cL * 0.52
        rec = ring(0, cL / 2, IW - 0.026, cL - 0.026, 0.0016, 0.001, M["hole"])  # engraved inlay line around the plate
        rec += [(kx, ky, kb_w + 0.016, kb_d + 0.016, 0.006, M["led"])]
        body.append(panel("shelf_top", cF, cL, M["deck"], rec, round_start=True))
        # a keyboard, not a grid of identical squares: wide modifiers, a space bar, and the row stagger they cause
        u, py, gap = kb_w / 14.0, kb_d / 4.0, 0.0035
        for r, row in enumerate(KEY_ROWS):
            cum = 0.0
            for c, units in enumerate(row):
                nm = "space_bar" if (r == 0 and units > 4) else f"key_{r}_{c}"
                controls.append(keycap(nm, units * u - gap, py - gap, 0.008, M["key"], cF, kx - kb_w / 2 + (cum + units / 2) * u, ky - kb_d / 2 + (r + 0.5) * py, -0.0055))
                cum += units
        # the keys stand in a black tray; only its rim lets the light out
        controls.append(box("key_tray", kb_w + 0.011, kb_d + 0.011, 0.001, M["hole"], at(cF, kx, ky, -0.0052)))
        tx, ty = CFG["trackball_x"], cL * 0.56
        tb = cg.control_group(parts, pivots, "trackball", cF, tx, ty, 0.010)
        tb.append(cylinder("tb_ring", 0.052, 0.006, M["ring"], at(cF, tx, ty, 0.003), segs=32, bevel=0.002, bevel_seg=2))
        tb.append(sphere("tb_ball", 0.038, M["ball"], at(cF, tx, ty, 0.006), segs=32, rings=18))  # a 3 inch arcade trackball
        for i, x in enumerate((tx - 0.035, tx + 0.035)):
            btn = cg.control_group(parts, pivots, f"tbtn_{i}", cF, x, cL * 0.2, 0.0)
            btn.append(cylinder(f"tbtn_ring_{i}", 0.0165, 0.004, M["ring"], at(cF, x, cL * 0.2, 0.002), segs=20))
            btn.append(dish_cap(f"tbtn_cap_{i}", cF, x, cL * 0.2, 0.002, 0.0125, 0.007, M["brand_lit"] if i == 0 else M["accent"]))
            # what the button does is printed on its cap, as on real hardware: a dark chevron, previous / next
            way = -1 if i == 0 else 1
            for side in (-1, 1):
                stroke = box(f"tbtn_mark_{i}_{side}", 0.0078, 0.0019, 0.0005, M["hole"], at(cF, x - way * 0.0008, cL * 0.2 + side * 0.0024, 0.002 + cap_face(0.007) + 0.00025, Matrix.Rotation(math.radians(-way * side * 38), 4, "Z")))
                btn.append(stroke)

    elif CFG["controls"] == "arcade":
        # a game cabinet's panel: a ball-top joystick, six buttons in two rows, start buttons. The hall binds joy,
        # btn_0..5 (both rows read previous / fullscreen / next) and start_0/1; the arrows are printed on the caps.
        rec = ring(0, cL / 2, IW - 0.026, cL - 0.026, 0.0016, 0.001, M["hole"])
        body.append(panel("shelf_top", cF, cL, M["deck"], rec, round_start=True))
        jx = -IW * 0.27
        joystick(parts, pivots, M, cF, "joy", jx, cL * 0.5)
        if CFG.get("second_stick"):  # a head-to-head cabinet: the second player's stick (not wired)
            joystick(parts, pivots, M, cF, None, IW * 0.40, cL * 0.5)
        caps = [M["brand_lit"], M["ivory"], M["brand_lit"], M["accent"], M["ivory"], M["accent"]]
        bx0 = -IW * 0.05 if CFG.get("second_stick") else IW * 0.02
        for i in range(6):
            col, row = i % 3, i // 3
            x, y = bx0 + col * 0.072 + row * 0.012, cL * (0.34 + 0.34 * row) + col * 0.006
            btn = cg.control_group(parts, pivots, f"btn_{i}", cF, x, y, 0.0)
            btn.append(cylinder(f"btn_ring_{i}", 0.0175, 0.004, M["ring"], at(cF, x, y, 0.002), segs=24))
            btn.append(dish_cap(f"btn_cap_{i}", cF, x, y, 0.002, 0.0135, 0.007, caps[i]))
            if col != 1:
                way = -1 if col == 0 else 1
                for side in (-1, 1):
                    btn.append(box(f"btn_mark_{i}_{side}", 0.0084, 0.002, 0.0005, M["hole"], at(cF, x - way * 0.0009, y + side * 0.0026, 0.002 + cap_face(0.007) + 0.00025, Matrix.Rotation(math.radians(-way * side * 38), 4, "Z"))))
        for i in range(2):
            x, y = IW * 0.5 - 0.075 - i * 0.055, cL * 0.82
            st = cg.control_group(parts, pivots, f"start_{i}", cF, x, y, 0.0)
            st.append(cylinder(f"start_ring_{i}", 0.0125, 0.003, M["chrome"], at(cF, x, y, 0.0015), segs=20))
            st.append(dish_cap(f"start_cap_{i}", cF, x, y, 0.0015, 0.0095, 0.006, M["ivory"], steps=20))
        for k, kx_ in enumerate([IW * 0.5 - 0.10][: CFG["knobs"]]):
            knob(metal, controls, M, cF, kx_, cL * 0.36, -60, k)
    elif CFG["controls"] == "kiosk":
        # a phone app's kiosk: the screen is the interface; two buttons page it (kbtn_0 / kbtn_1)
        rec = ring(0, cL / 2, IW - 0.026, cL - 0.026, 0.0016, 0.001, M["hole"])
        body.append(panel("shelf_top", cF, cL, M["deck"], rec, round_start=True))
        for i, x in enumerate((-IW * 0.2, IW * 0.2)):
            btn = cg.control_group(parts, pivots, f"kbtn_{i}", cF, x, cL * 0.5, 0.0)
            btn.append(cylinder(f"kbtn_ring_{i}", 0.026, 0.005, M["chrome"], at(cF, x, cL * 0.5, 0.0025), segs=32, bevel=0.0012, bevel_seg=2))
            btn.append(dish_cap(f"kbtn_cap_{i}", cF, x, cL * 0.5, 0.0025, 0.020, 0.009, M["brand_lit"] if i == 0 else M["accent"], steps=28))
            way = -1 if i == 0 else 1
            for side in (-1, 1):
                btn.append(box(f"kbtn_mark_{i}_{side}", 0.012, 0.0028, 0.0005, M["hole"], at(cF, x - way * 0.0013, cL * 0.5 + side * 0.0037, 0.0025 + cap_face(0.009) + 0.00025, Matrix.Rotation(math.radians(-way * side * 38), 4, "Z"))))
    else:
        # a listening console: previous / play / next as three big arcade buttons, a volume knob, and the six
        # preset buttons on the front lip. Names as the hall binds them (tbtn_0, start_0, tbtn_1, sel_0..5).
        rec = ring(0, cL / 2, IW - 0.026, cL - 0.026, 0.0016, 0.001, M["hole"])
        body.append(panel("shelf_top", cF, cL, M["deck"], rec, round_start=True))
        if CFG["controls"] == "transport":
            for name, x, r in (("tbtn_0", -0.27, 0.030), ("start_0", 0.0, 0.044), ("tbtn_1", 0.27, 0.030)):
                btn = cg.control_group(parts, pivots, name, cF, x, cL * 0.5, 0.0)
                btn.append(cylinder(f"{name}_ring", r + 0.009, 0.005, M["chrome"], at(cF, x, cL * 0.5, 0.0025), segs=40, bevel=0.0015, bevel_seg=2))
                btn.append(dish_cap(f"{name}_cap", cF, x, cL * 0.5, 0.003, r, 0.011, M["accent"] if name == "start_0" else M["ivory"], steps=36))
                if name != "start_0":
                    way = -1 if name == "tbtn_0" else 1
                    for side in (-1, 1):
                        btn.append(box(f"{name}_mark_{side}", 0.017, 0.0036, 0.0006, M["hole"], at(cF, x - way * 0.002, cL * 0.5 + side * 0.0052, 0.003 + cap_face(0.011) + 0.0003, Matrix.Rotation(math.radians(-way * side * 38), 4, "Z"))))
        for k, kx_ in enumerate([IW / 2 - 0.13, -(IW / 2 - 0.13), IW / 2 - 0.24][: CFG["knobs"]]):
            knob(metal, controls, M, cF, kx_, cL * 0.5, (-40, 25, 70)[k], k)
        for i in range(6):
            x = (i - 2.5) * 0.105
            sel = cg.control_group(parts, pivots, f"sel_{i}", eF, x, eL * 0.5, 0.0)
            sel.append(cylinder(f"sel_ring_{i}", 0.017, 0.004, M["chrome"], at(eF, x, eL * 0.5, 0.002), segs=28, bevel=0.001, bevel_seg=1))
            sel.append(dish_cap(f"sel_cap_{i}", eF, x, eL * 0.5, 0.002, 0.0125, 0.008, M["ivory"], steps=24))
    # carriage bolts hold a real control panel down: four low domed heads
    for sx in (-1, 1):
        for y in (0.03, cL - 0.03):
            metal.append(cylinder(f"deck_bolt_{sx}_{int(y * 1000)}", 0.0065, 0.0024, M["dark_metal"], at(cF, sx * (IW / 2 - 0.035), y, 0.0012), segs=20, bevel=0.0016, bevel_seg=2))

    # display: one gloss acrylic sheet, the screen in a recess behind its glass
    bF, bL = seg("G", "H")
    # Dennis: the screen looked set INTO a hole. A real monitor sits deep behind a sloped shroud that catches its light.
    sw = min(CFG["screen_w"], IW - 0.14, (bL - 0.11) * CFG["screen_aspect"])  # recess and shroud must fit the panel
    sh = sw / CFG["screen_aspect"]
    cy = bL / 2
    ow, oh, deep = sw + 0.09, sh + 0.09, 0.05
    body.append(panel("display", bF, bL, M["bezel"], [(0, cy, ow, oh, deep + 0.004, M["hole"])]))
    body.append(shroud("shroud", at(bF, 0, cy, 0), ow, oh, sw + 0.004, sh + 0.004, deep, M["black"]))
    scr = cg.quad("screen", sw, sh, M["screen"], at(bF, 0, cy, -deep + 0.001))
    gl = cg.quad("glass", sw + 0.004, sh + 0.004, M["glass"], at(bF, 0, cy, -deep + 0.006))
    controls.append(cylinder("power_led", 0.0025, 0.0012, M["brand_lit"], at(bF, IW / 2 - 0.04, (cy - sh / 2) / 2, 0.0004), segs=12))
    # what holds the acrylic sheet down on a real cabinet: six small black screws in the margins beside the opening
    # (the generator clamps sw so the side margin is never narrower than 25 mm)
    mx, my = (IW - ow) / 2, cy - oh / 2
    sx_ = ow / 2 + mx / 2
    for sx in (-1, 1):
        for y in (0.026, cy, bL - 0.026):
            screw(metal, controls, M, bF, sx * sx_, y, 0.0, r=0.0036, turn=0.8 * sx + y)
    if CFG["controls"] == "kiosk" and my > 0.034:
        # a self-service terminal watches the person in front of it: the sensor sits above the portrait screen
        camy = cy + oh / 2 + my / 2
        metal.append(cylinder("cam_bezel", 0.0115, 0.0035, M["dark_metal"], at(bF, 0, camy, 0.0012), segs=24, bevel=0.0012, bevel_seg=2))
        controls.append(cylinder("cam_lens", 0.0068, 0.0024, M["bezel"], at(bF, 0, camy, 0.0022), segs=24, bevel=0.0008, bevel_seg=1))
        controls.append(cylinder("cam_led", 0.0022, 0.0012, M["brand_lit"], at(bF, 0.024, camy, 0.0008), segs=12))

    # speaker panel leaning over the player: stamped slots with a dim glow behind them
    hF, hL = seg("H", "J")
    rec = []
    if CFG["speakers"] == "hood":
        for sx in (-1, 1):
            rec += slots(sx * IW * 0.265, hL / 2, IW * 0.33, 7, 0.013, 0.005, 0.008, M["led"])
    if CFG["light_line"] == "hood":  # the ONE visible line sits under the hood and washes the acrylic sheet
        rec += [(0, hL * 0.3, IW - 0.12, 0.008, 0.004, M["seam"])]
    speaker_material = M["panel"]
    if CFG.get("speaker_wear") is False:
        speaker_material = speaker_material.copy()
        speaker_material.name = M["panel"].name + "_unworn"
    body.append(panel("speakers", hF, hL, speaker_material, rec, round_end=True))
    body.append(panel("fascia", *seg("J", "K"), M["paint"], round_start=True))
    for i in range(idx["K"], len(inner) - 1):
        body.append(panel(f"carcass_{i}", *seg_frame(inner[i], inner[i + 1]), M["paint"]))

    power_cable(parts, M)

    arts = mg.side_art(W, 0, 0, 0, 0, M["art"], profile=outer)
    for ob in arts:
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        bmesh.ops.triangulate(bm, faces=bm.faces[:], ngon_method="EAR_CLIP")
        bm.to_mesh(ob.data)
        bm.free()
    return parts, scr, gl, arts, pivots


def round_carcass(ob):
    """Weld the panels into one skin and round the weighted corner edges."""
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=2e-5)
    bm.to_mesh(me)
    bm.free()
    cg.mark_sharp_by_angle(me, 30.0)
    m = ob.modifiers.new("Round", "BEVEL")
    m.limit_method = "WEIGHT"
    m.width = EDGE_RADIUS
    m.segments = 4
    m.harden_normals = True
    m.use_clamp_overlap = False
    cg.apply_modifiers(ob)


def wear_story(nt, out, seed=0.0):
    """hero_gen.wear_shader plus what years in an arcade leave behind. Emission = 0.5 + rubbed - dirt.

    rubbed: exposed edges · hands on the front of the deck and the shelf edge · shoe streaks low on the front ·
            a few long scratches across the pedestal and the door
    dirt:   crevices · boots and mops near the floor · faint run marks down the vertical panels · dust that
            settles on everything facing up"""
    N = nt.nodes
    geo = N.new("ShaderNodeNewGeometry")
    tc = N.new("ShaderNodeTexCoord")

    def noise(scale, detail, rough=0.6, stretch=(1.0, 1.0, 1.0), rot=(0.0, 0.0, 0.0)):
        mp = N.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = stretch
        mp.inputs["Rotation"].default_value = rot
        mp.inputs["Location"].default_value = (seed, seed * 1.7, seed * 0.31)  # its own pattern per part
        nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
        n = N.new("ShaderNodeTexNoise")
        n.inputs["Scale"].default_value = scale
        n.inputs["Detail"].default_value = detail
        n.inputs["Roughness"].default_value = rough
        nt.links.new(mp.outputs["Vector"], n.inputs["Vector"])
        return n.outputs["Fac"]

    def ramp(src, lo, hi):
        r = N.new("ShaderNodeMapRange")
        r.inputs["From Min"].default_value = lo
        r.inputs["From Max"].default_value = hi
        r.clamp = True
        nt.links.new(src, r.inputs["Value"])
        return r.outputs["Result"]

    def op(kind, a, b):
        m = N.new("ShaderNodeMath")
        m.operation = kind.replace("_RAW", "")
        m.use_clamp = not kind.endswith("_RAW")
        for sock, val in ((m.inputs[0], a), (m.inputs[1], b)):
            if isinstance(val, (int, float)):
                sock.default_value = val
            else:
                nt.links.new(val, sock)
        return m.outputs["Value"]

    def mul(*vals):
        acc = vals[0]
        for v in vals[1:]:
            acc = op("MULTIPLY", acc, v)
        return acc

    def most(*vals):
        acc = vals[0]
        for v in vals[1:]:
            acc = op("MAXIMUM", acc, v)
        return acc

    pos = N.new("ShaderNodeSeparateXYZ")
    nt.links.new(geo.outputs["Position"], pos.inputs["Vector"])
    nrm = N.new("ShaderNodeSeparateXYZ")
    nt.links.new(geo.outputs["Normal"], nrm.inputs["Vector"])
    up = ramp(nrm.outputs["Z"], 0.55, 0.9)
    front = ramp(nrm.outputs["Y"], -0.5, -0.85)  # the machine faces -Y

    bev = N.new("ShaderNodeBevel")
    bev.samples = 8
    bev.inputs["Radius"].default_value = 0.006
    dot = N.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    nt.links.new(bev.outputs["Normal"], dot.inputs[0])
    nt.links.new(geo.outputs["Normal"], dot.inputs[1])
    ao = N.new("ShaderNodeAmbientOcclusion")
    ao.inputs["Distance"].default_value = 0.06
    ao.samples = 16
    exposed = ramp(ao.outputs["AO"], 0.55, 0.9)
    wz = CFG["wear"]
    yf, sz = -D / 2, CFG["shelf_z"]
    edge = mul(ramp(dot.outputs["Value"], 0.995, 0.90), ramp(noise(22.0, 6.0), 0.38, 0.62), exposed, wz["edge"])

    # hands: the front of the deck and the shelf edge, polished in patches
    hands = mul(ramp(pos.outputs["Y"], yf + 0.12, yf + 0.04), ramp(pos.outputs["Z"], sz - 0.005, sz + 0.02), ramp(noise(6.0, 4.0), 0.36, 0.6), wz["hands"])
    # Zones only. Dennis disliked the wear drawn here (soft streaks and cloudy lines: a 1 K bake cannot be sharp).
    # The hall now thresholds these zones against a tiling chip height and lays hairline scratches over them
    # (scripts/assets/hero-wear-texture.py, heroMaterial.ts), so a zone says how MUCH wear, not what it looks like.
    if CFG["seed"]:  # kick marks: a broken horizontal band just above the floor, never a round patch
        shoes = mul(front, ramp(pos.outputs["Z"], 0.30, 0.16), ramp(pos.outputs["Z"], 0.10, 0.13), ramp(noise(5.0, 4.0, 0.6, stretch=(0.35, 0.35, 5.0)), 0.42, 0.7), wz["shoes"])
    else:  # Riftback, as approved
        shoes = mul(front, ramp(pos.outputs["Z"], 0.40, 0.08), ramp(noise(4.0, 4.0), 0.4, 0.75), wz["shoes"])
    knees = mul(front, ramp(pos.outputs["Z"], sz + 0.02, sz - 0.18), ramp(pos.outputs["Z"], 0.35, 0.55), ramp(noise(5.0, 4.0), 0.45, 0.8), wz["knees"])
    # Motifs. The worn patch at knee height is Riftback's; other machines wear where THEY are used: at the corners
    # where bags and hips pass, or around the coin door / the tray where hands go.
    ax = op("ABSOLUTE", pos.outputs["X"], 0.0)
    corners = mul(front, ramp(ax, IW / 2 - 0.12, IW / 2 - 0.015), ramp(pos.outputs["Z"], 0.12, 0.3), ramp(pos.outputs["Z"], sz + 0.02, sz - 0.12), ramp(noise(7.0, 4.0), 0.35, 0.7), wz["corners"])
    dz = op("ABSOLUTE", op("SUBTRACT_RAW", pos.outputs["Z"], wz["door_z"]), 0.0)
    near = op("MAXIMUM", ax, dz)
    door = mul(front, ramp(near, 0.30, 0.17), ramp(noise(9.0, 4.0), 0.4, 0.72), wz["door"])
    rubbed = most(edge, hands, shoes, knees, corners, door)

    crevice = mul(ramp(ao.outputs["AO"], 0.85, 0.35), ramp(noise(7.0, 5.0), 0.3, 0.7), wz["crevice"])
    low = mul(ramp(pos.outputs["Z"], 0.32, 0.02), ramp(noise(3.5, 7.0, 0.7), 0.42, 0.66), wz["low"])
    dust = mul(up, ramp(noise(4.0, 5.0), 0.3, 0.75), wz["dust"])
    dirt = most(crevice, low, dust)

    val = op("SUBTRACT", op("ADD", 0.5, op("MULTIPLY", rubbed, 0.5)), op("MULTIPLY", dirt, 0.5))
    e = N.new("ShaderNodeEmission")
    nt.links.new(val, e.inputs["Color"])
    nt.links.new(e.outputs["Emission"], out.inputs["Surface"])


hg.wear_shader = wear_story


def importance(ob, poly):
    """How much of the atlas a face deserves: the camera stands in front, the side art covers the outer sides."""
    n = (ob.matrix_world.to_3x3() @ poly.normal).normalized()
    c = ob.matrix_world @ poly.center
    if n.y > 0.5 or (n.z < -0.5 and c.z < 0.05):  # back, underside
        return 0.0
    if abs(n.x) > 0.9 and abs(c.x) > W / 2 - 1e-3:  # under the side art
        return 0.0
    if abs(n.x) > 0.9 and abs(c.x) > W / 2 - T - 1e-3:  # inside of a side panel: only its front strip shows
        return 0.25
    if n.z > 0.9 and c.z > H - 0.1:  # roof
        return 0.15
    return 1.0


def unwrap_atlas_weighted(targets):
    """hero_gen.unwrap_atlas, with every UV island scaled by what the player can see of it before packing."""
    for ob in bpy.data.objects:
        ob.select_set(False)
    for ob in targets:
        ob.select_set(True)
        ob.data.uv_layers.active = ob.data.uv_layers["atlas"]
    bpy.context.view_layer.objects.active = targets[0]
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.0, area_weight=0.0, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    for ob in targets:  # mesh API only: a bmesh round trip would drop the hardened normals
        me = ob.data
        uvd = me.uv_layers["atlas"].data
        parent = list(range(len(me.polygons)))

        def find(i):
            while parent[i] != i:
                parent[i] = parent[parent[i]]
                i = parent[i]
            return i

        edges = {}
        for poly in me.polygons:
            loops = list(poly.loop_indices)
            for a, b in zip(loops, loops[1:] + loops[:1]):
                va, vb = me.loops[a].vertex_index, me.loops[b].vertex_index
                ua, ub = uvd[a].uv.copy(), uvd[b].uv.copy()
                if va > vb:
                    va, vb, ua, ub = vb, va, ub, ua
                for other, oa, ob_ in edges.setdefault((va, vb), []):
                    if (ua - oa).length < 1e-5 and (ub - ob_).length < 1e-5:  # the same edge in UV space = one island
                        parent[find(poly.index)] = find(other)
                edges[(va, vb)].append((poly.index, ua, ub))
        islands = {}
        for poly in me.polygons:
            islands.setdefault(find(poly.index), []).append(poly)
        for polys in islands.values():
            area = sum(p.area for p in polys) or 1e-9
            weight = sum(importance(ob, p) * p.area for p in polys) / area
            k = 0.22 + 0.78 * weight
            for p in polys:
                for li in p.loop_indices:
                    uvd[li].uv = uvd[li].uv * k
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.select_all(action="SELECT")
    bpy.ops.uv.pack_islands(margin=0.006, rotate=True)
    bpy.ops.object.mode_set(mode="OBJECT")


def bake_key_shadow(objs, size, path):
    """How much of the hall's key light reaches each texel (hallLighting.ts: a 1.8 x 0.7 m panel, 0.45 m to the
    left, 3.2 m up, 2.1 m in front, aimed at the machine's middle). The hall draws no shadows; without this the
    bezel under the hood shines as if the hood were not there. Written as a grey PNG: 255 = fully lit."""
    import numpy as np

    sc = bpy.context.scene
    targets = [ob for ob in objs if ob.name not in hg.SKIP_BAKE]
    others = [ob for ob in objs if ob.name in hg.SKIP_BAKE]
    glass = [ob for ob in others if ob.name == "glass"]
    for ob in glass:
        ob.hide_render = True
    data = bpy.data.lights.new("hall_key", "AREA")
    data.shape = "RECTANGLE"
    data.size, data.size_y = 1.8, 0.7
    data.energy = 2000.0
    lamp = bpy.data.objects.new("hall_key", data)
    sc.collection.objects.link(lamp)
    lamp.location = (-0.45, -2.1, 3.2)
    cg.look_at(lamp, (0.0, 0.0, 1.0))
    size_out, size = size, size * 2  # baked at twice the size and averaged down: a clean shadow edge
    image = bpy.data.images.new("hero_key_bake", size, size, alpha=False, float_buffer=True, is_data=True)
    m_white = hg.bake_material("bake_white_key", image, hg.white)

    def run(shadow):
        data.use_shadow = shadow
        saved = []
        for ob in targets + others:
            for slot in ob.material_slots:
                saved.append((slot, slot.material))
                slot.material = m_white
        image.pixels.foreach_set(np.zeros(size * size * 4, dtype=np.float32))
        sc.cycles.samples = 256
        for ob in bpy.data.objects:
            ob.select_set(False)
        for ob in targets:
            ob.select_set(True)
            ob.data.uv_layers.active = ob.data.uv_layers["atlas"]
        bpy.context.view_layer.objects.active = targets[0]
        bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT"}, margin=6, margin_type="EXTEND", use_clear=False, target="IMAGE_TEXTURES")
        for slot, mat in saved:
            slot.material = mat
        out = np.empty(size * size * 4, dtype=np.float32)
        image.pixels.foreach_get(out)
        return out.reshape(size, size, 4)[:, :, 0].copy()

    lit, free = run(True), run(False)
    vis = hg.downsample(np.where(free > 1e-4, np.clip(lit / np.maximum(free, 1e-4), 0.0, 1.0), 1.0), 2)
    bpy.data.objects.remove(lamp)
    for ob in glass:
        ob.hide_render = False
    grey8 = (vis * 255.0 + 0.5).astype(np.uint8)
    rgba = np.stack([grey8, grey8, grey8, np.full_like(grey8, 255)], axis=-1)
    hg.write_png_rgba(path, rgba)
    print(f"[hero] key shadow {path} ({os.path.getsize(path) / 1024:.0f} KB), mean {vis.mean():.2f}")


def finish(parts, named, pivots):
    for group in parts.values():
        for ob in group:
            if ob.modifiers:
                cg.apply_modifiers(ob)
    joined = {key: cg.join_objects(objs, key) for key, objs in parts.items() if objs}
    round_carcass(joined["body"])
    objs = list(joined.values()) + list(named)
    with bpy.context.temp_override(active_object=objs[0], selected_objects=objs, selected_editable_objects=objs):
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for key, pivot in pivots.items():
        ob = joined[key]
        p = Vector(pivot)
        ob.data.transform(Matrix.Translation(-p))
        ob.location = p
    bpy.context.view_layer.update()
    return objs


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--spec", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--size", type=int, default=1024)
    ap.add_argument("--preview", default=None)
    ap.add_argument("--no-bake", action="store_true")
    args = ap.parse_args(argv)
    with open(args.spec, "r", encoding="utf-8") as fh:
        raw = json.load(fh)
    configure(raw.get("hero"))
    # black laminate reflects 3-4 %, not 1 %: below that no light in the hall can show its surface
    raw.update(height=H, width=W, depth=D, screenTilt=CFG["tilt"], paint=CFG["paint"], panel=CFG["panel"])
    spec = mg.Spec(raw)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    cg.COLL = bpy.data.collections.new("machine")
    bpy.context.scene.collection.children.link(cg.COLL)
    bpy.context.scene.unit_settings.system = "METRIC"

    M = mg.make_materials(spec, None)
    parts, scr, gl, arts, pivots = build(spec, M)
    objs = finish(parts, [scr, gl, *arts], pivots)
    targets = [ob for ob in objs if ob.name not in hg.SKIP_BAKE]
    for ob in targets:
        hg.ensure_uv_order(ob)
        hg.box_project_unit(ob)
    unwrap_atlas_weighted(targets)
    print(f"[hero] {spec.name}: {sum(cg.tri_count(ob) for ob in objs)} tris, {len(objs)} meshes ({', '.join(ob.name for ob in objs)})")

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    if not args.no_bake:
        hg.bake_mask(objs, args.size, os.path.abspath(args.out)[:-4] + "-mask.png")
        bake_key_shadow(objs, args.size // 2, os.path.abspath(args.out)[:-4] + "-light.png")
        # rounded edges. Must run AFTER bake_mask: its floor plane would bevel the carcass's bottom edges away.
        # hero_claw_gen.py / hero_booth_gen.py / hero_tv_gen.py rebake the same way with this one line.
        hg.bake_bevel_normal(objs, args.size, os.path.abspath(args.out)[:-4] + "-normal.png")
    cg.export_glb(objs, args.out)
    print(f"[hero] exported {args.out} ({os.path.getsize(args.out) / 1024:.0f} KB)")

    if args.preview:
        os.makedirs(args.preview, exist_ok=True)
        scm = bpy.data.materials.get("mach_screen")
        if scm:
            b = scm.node_tree.nodes["Principled BSDF"]
            b.inputs["Emission Color"].default_value = (0.10, 0.14, 0.25, 1.0)
            b.inputs["Emission Strength"].default_value = 1.5
        cam = cg.build_studio(spec)
        f = 1.05
        cg.render_preview(cam, os.path.join(args.preview, "v4-3q.png"), (-2.15 * f, -2.75 * f, 1.55 * f), (0.0, -0.05, H * 0.5), spec)
        cg.render_preview(cam, os.path.join(args.preview, "v4-front.png"), (0.0, -3.6 * f, 1.35 * f), (0.0, 0.0, H * 0.5), spec)
        # from behind and to the side: the mains lead on the floor and the back of the carcass
        cg.render_preview(cam, os.path.join(args.preview, "v4-rear.png"), (-1.35 * f, 1.75 * f, 0.72 * f), (0.0, 0.32, 0.16), spec)


if __name__ == "__main__":
    main()
