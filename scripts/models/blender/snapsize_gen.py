"""
snapsize_gen.py — the Snapsize "Compare rig" (Blender 5.x, headless): a hero station whose face is a wall of four
screens of different device formats, all showing the same page, like the add-on's Compare feature.

Bespoke geometry in the vgmbattle_gen.py manner, finished through the hero pipeline of hero_terminal_gen.py
(hero_booth_gen.py does the same): one carcass between two side panels, details cut into the panels, the mask /
key-light / bevel-normal bakes, two UV sets. So it sits in the same family as the other 2026-09-20 machines.

The screen wall (front, tilted 7 deg back): the desktop (1920 x 1080) on top, centred; laptop (1440 x 900), tablet
(768 x 1024) and phone (390 x 844) in a row below with their bottoms aligned. All four at ONE scale (PX metres per
CSS pixel: "exact sizes"). Each sits in its own gloss bezel in a pocket of the satin wall. The four screen faces are
ONE mesh named `screen` with a planar UV over the mesh's bounding rectangle, so the hall's single texture lands on
each screen where the composite puts it (screen-layout.json says where, in image space). The brand mark from the
add-on's icon frames the wall: a dashed lit outline with the diagonal resize arrow at the bottom-right corner.

    blender --background --python scripts/models/blender/snapsize_gen.py -- \
        --out .source-assets/models-in/mach-snapsize-v1/mach-snapsize-v1.glb [--size 1024] [--no-bake] \
        [--preview <dir>] [--composite <png>]
"""

import argparse
import json
import math
import os
import sys

import bpy
import bmesh
from mathutils import Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cabinet_gen as cg  # noqa: E402
import machine_gen as mg  # noqa: E402
import hero_gen as hg  # noqa: E402
import hero_terminal_gen as ht  # noqa: E402
import terminal_v3_gen as v3  # noqa: E402
from cabinet_gen import at, box, cylinder, grey, hex_rgb, material, seg_frame  # noqa: E402
from terminal_v3_gen import H, T, INSET, ring, slots  # noqa: E402

NAME = "mach-snapsize"
W, D = 1.24, 0.72
IW = W - 2 * T
LAVENDER, INDIGO = "#8e8cf5", "#5b5bd6"
PAINT, PANEL, WALL = "#1b1a2f", "#22203a", "#15142a"
SHELF_Z, DECK_LEN, DECK_TILT, WALL_TILT = 0.80, 0.21, 8.0, 7.0
WALL_TOP, HOOD_TOP, HOOD_ANGLE = 1.87, 1.92, 26.0
KF = 6

# The four windows of Compare, in CSS pixels, with the bezel margin and window corner radius of the device frame.
PX = 0.000352  # metres per CSS pixel: the desktop comes out 0.676 m wide, the phone 0.137 m
DEVICES = (
    ("desktop", 1920, 1080, 0.016, 0.005),
    ("laptop", 1440, 900, 0.014, 0.006),
    ("tablet", 768, 1024, 0.013, 0.014),
    ("phone", 390, 844, 0.010, 0.020),
)
GAP_X, GAP_Y, ROW_Y = 0.03, 0.03, 0.10  # between pockets; the lower row's screen bottoms sit at ROW_Y on the wall
OUTLINE = 0.024  # the dashed outline runs this far outside the pockets
POCKET, BEZEL_FRONT, BEZEL_RECESS = 0.012, 0.012, 0.010  # pocket depth; the bezel plate sits flush in it


def profile(top=H):
    """Side profile (y, z), clockwise from the bottom front: recessed kick, PC-bay pedestal, shelf edge, deck,
    the screen wall, a short hood leaning forward, and a fascia before the top."""
    yf = -D / 2
    a = math.radians(DECK_TILT)
    A = (yf + 0.08, 0.0)
    B = (yf + 0.08, 0.10)
    C = (yf + 0.03, 0.10)
    Dp = (yf + 0.03, SHELF_Z)
    E = (yf, SHELF_Z)
    F = (yf, SHELF_Z + 0.06)
    G = (yf + DECK_LEN * math.cos(a), F[1] + DECK_LEN * math.sin(a))
    Hp = (G[0] + (WALL_TOP - G[1]) * math.tan(math.radians(WALL_TILT)), WALL_TOP)
    J = (Hp[0] - (HOOD_TOP - WALL_TOP) * math.tan(math.radians(HOOD_ANGLE)), HOOD_TOP)
    K = (J[0], top)
    L = (D / 2 - 0.05, top)
    Mp = (D / 2, top - 0.05)
    N = (D / 2, 0.0)
    pts = [A, B, C, Dp, E, F, G, Hp, J, K, L, Mp, N]
    return pts, dict(zip("ABCDEFGHJKLMN", pts))


def layout():
    """Where the four screens sit on the wall (wall-panel coordinates: x across, y up from the deck)."""
    devs = [dict(name=n, sw=pw * PX, sh=ph * PX, bz=bz, cr=cr) for n, pw, ph, bz, cr in DEVICES]
    desk, row = devs[0], devs[1:]
    widths = [d["sw"] + 2 * d["bz"] for d in row]
    x = -(sum(widths) + GAP_X * (len(row) - 1)) / 2
    for d, w in zip(row, widths):
        d["cx"], d["cy"] = x + w / 2, ROW_Y + d["sh"] / 2
        x += w + GAP_X
    row_top = max(d["cy"] + d["sh"] / 2 + d["bz"] for d in row)
    desk["cx"], desk["cy"] = 0.0, row_top + GAP_Y + desk["bz"] + desk["sh"] / 2
    for d in devs:
        d["pw"], d["ph"] = d["sw"] + 2 * d["bz"], d["sh"] + 2 * d["bz"]
    return devs


def outline_rect(devs):
    x0 = min(d["cx"] - d["pw"] / 2 for d in devs) - OUTLINE
    x1 = max(d["cx"] + d["pw"] / 2 for d in devs) + OUTLINE
    y0 = min(d["cy"] - d["ph"] / 2 for d in devs) - OUTLINE
    y1 = max(d["cy"] + d["ph"] / 2 for d in devs) + OUTLINE
    return x0, y0, x1, y1


def dashes(rect, avoid, mat):
    """The icon's dashed resize outline as lit recesses: short dashes along the four edges, the corners left open
    (the arrow takes the bottom-right one)."""
    x0, y0, x1, y1 = rect
    dl, dw, pitch, inset = 0.026, 0.0055, 0.046, 0.032
    rec = []

    def edge(px, py, length, horizontal):
        n = max(2, int((length - 2 * inset - dl) // pitch) + 1)
        step = (length - 2 * inset - dl) / (n - 1)
        for i in range(n):
            t = inset + dl / 2 + i * step
            cx, cy = (px + t, py) if horizontal else (px, py + t)
            ax, ay, aw, ah = avoid
            if abs(cx - ax) < aw / 2 + dl / 2 and abs(cy - ay) < ah / 2 + dl / 2:
                continue
            rec.append((cx, cy, dl if horizontal else dw, dw if horizontal else dl, 0.0025, mat))

    edge(x0, y0, x1 - x0, True)
    edge(x0, y1, x1 - x0, True)
    edge(x0, y0, y1 - y0, False)
    edge(x1, y0, y1 - y0, False)
    return rec


def resize_arrow(parts, M, frame, corner):
    """The icon's diagonal resize arrow at the outline's bottom-right corner, pointing out of it: a lit inlay lying
    in a shallow square pocket (its strokes end 1 mm below the wall surface). Returns the pocket recess."""
    u = 0.0065  # metres per icon unit
    tipx, tipy = corner[0] + 0.012, corner[1] - 0.012
    shaft, leg, sw = 7 * u * math.sqrt(2), 5.8 * u, 0.0065
    z = -0.0025
    parts["controls"].append(box("arrow_shaft", shaft, sw, 0.003, M["seam"], at(frame, tipx - shaft / (2 * math.sqrt(2)), tipy + shaft / (2 * math.sqrt(2)), z, Matrix.Rotation(math.radians(-45), 4, "Z")), bevel=0.001, seg=1))
    parts["controls"].append(box("arrow_leg_v", sw, leg + sw, 0.003, M["seam"], at(frame, tipx, tipy + leg / 2, z), bevel=0.001, seg=1))
    parts["controls"].append(box("arrow_leg_h", leg + sw, sw, 0.003, M["seam"], at(frame, tipx - leg / 2, tipy, z), bevel=0.001, seg=1))
    size = 0.074
    return (tipx - size / 2 + 0.014, tipy + size / 2 - 0.014, size, size, 0.004, M["hole"])


def screen_meshes(devs, frame, M):
    """The four screen faces as ONE mesh `screen` (planar UV over its own bounding rectangle) and the cover glass
    as one mesh `glass`, both in the wall frame behind the bezels. Returns (screen, glass, layout in image space)."""
    xmin = min(d["cx"] - d["sw"] / 2 for d in devs)
    xmax = max(d["cx"] + d["sw"] / 2 for d in devs)
    ymin = min(d["cy"] - d["sh"] / 2 for d in devs)
    ymax = max(d["cy"] + d["sh"] / 2 for d in devs)
    bw, bh = xmax - xmin, ymax - ymin

    def sheet(name, mat, z, grow):
        bm = bmesh.new()
        uvl = bm.loops.layers.uv.new("UVMap")
        for d in devs:
            hw, hh = d["sw"] / 2 + grow, d["sh"] / 2 + grow
            vs = [bm.verts.new((d["cx"] + sx * hw, d["cy"] + sy * hh, 0.0)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
            f = bm.faces.new(vs)
            for lp in f.loops:
                lp[uvl].uv = ((lp.vert.co.x - xmin) / bw, (lp.vert.co.y - ymin) / bh)
        return cg.bm_to_object(name, bm, mat, at(frame, 0, 0, z), smooth=False)

    z_screen = -POCKET + BEZEL_FRONT - BEZEL_RECESS + 0.0005
    z_glass = -POCKET + BEZEL_FRONT - 0.0015
    scr = sheet("screen", M["screen"], z_screen, 0.0)
    gl = sheet("glass", M["glass"], z_glass, 0.002)
    # image space: origin top-left, y down, normalised to the bounding rectangle the hall fits its texture to
    screens = [dict(name=d["name"], x=round((d["cx"] - d["sw"] / 2 - xmin) / bw, 6), y=round((ymax - (d["cy"] + d["sh"] / 2)) / bh, 6), w=round(d["sw"] / bw, 6), h=round(d["sh"] / bh, 6)) for d in devs]
    return scr, gl, dict(aspect=round(bw / bh, 6), width_m=round(bw, 4), height_m=round(bh, 4), screens=screens)


def build(s, M):
    sharp, P = profile()
    names = "ABCDEFGHJKLMN"
    idx = {n: i for i, n in enumerate(names)}
    tm_r = 0.0072
    low, _ = profile(top=H - tm_r)  # the T-molding tube on the side panels' edge reaches exactly 1.95
    outer = v3.fillet(low, {idx["F"]: 0.02, idx["J"]: 0.02, idx["K"]: 0.03, idx["L"]: 0.02}, k=KF)
    carcass = v3.fillet(sharp, {idx["K"]: 0.045, idx["L"]: 0.03}, k=KF)
    inner = cg.offset_polygon(carcass, INSET)
    Pi = dict(zip(names[: idx["K"] + 1], inner))
    parts = {k: [] for k in ("body", "trim", "metal", "controls", "cable")}
    pivots = {}
    body, controls, metal = parts["body"], parts["controls"], parts["metal"]

    for sx, nm in ((-1, "side_l"), (1, "side_r")):
        x0, x1 = (-W / 2, -W / 2 + T) if sx < 0 else (W / 2 - T, W / 2)
        body.append(cg.prism_yz(nm, outer, x0, x1, M["paint"], bevel=0.003, seg=2))
        x = sx * (W / 2 - T / 2)
        pts = [(x, y, z) for y, z in outer[: idx["K"] + 3 * KF + 1]]
        parts["trim"].append(cg.tube_along(f"tmolding_{nm}", pts, tm_r, M["trim"], resolution=2))

    def seg(a, b):
        return seg_frame(Pi[a], Pi[b])

    # toe kick: recessed steel with four screws
    kF, kL = seg("A", "B")
    body.append(ht.panel("kick", kF, kL, M["kick"]))
    for i in range(4):
        metal.append(cylinder("kick_screw", 0.0042, 0.002, M["metal"], at(kF, IW * (-0.375 + 0.25 * i), kL / 2, 0.001), segs=16, bevel=0.0008, bevel_seg=1))
    body.append(ht.panel("kick_top", *seg("B", "C"), M["paint"]))

    # pedestal: a browser add-on lives on a PC. A ventilated bay door with the fan's glow behind its slots, and above
    # it what the front of a PC offers: a lit power button, two USB ports, a headphone jack. One door, hinged, locked.
    pF, pL = seg("C", "D")
    dw, dh, dy = min(0.72, IW - 0.30), 0.42, 0.33
    rec = [(0, dy, dw, dh, 0.002, M["door"])] + ring(0, dy, dw, dh, 0.003, 0.007, M["hole"])
    for sx in (-1, 1):
        rec += slots(sx * dw * 0.24, dy - 0.02, dw * 0.36, 17, 0.0165, 0.007, 0.010, M["led"])
    px_, py_ = IW / 2 - 0.16, dy + dh / 2 + 0.045
    rec += [(px_ - 0.055, py_, 0.0135, 0.0058, 0.006, M["hole"]), (px_ - 0.030, py_, 0.0135, 0.0058, 0.006, M["hole"])]
    body.append(ht.panel("pedestal", pF, pL, M["panel"], rec))
    metal.append(cylinder("power_ring", 0.012, 0.003, M["chrome"], at(pF, px_ + 0.02, py_, 0.0002), segs=28, bevel=0.001, bevel_seg=2))
    controls.append(cylinder("power_button", 0.0085, 0.003, M["brand_lit"], at(pF, px_ + 0.02, py_, 0.0016), segs=24, bevel=0.0012, bevel_seg=2))
    metal.append(cylinder("jack_collar", 0.0045, 0.002, M["metal"], at(pF, px_ - 0.008, py_, 0.0002), segs=16))
    controls.append(cylinder("jack_hole", 0.0019, 0.001, M["hole"], at(pF, px_ - 0.008, py_, 0.0014), segs=12))
    ht.door_hardware(metal, controls, M, pF, 0, dy, dw, dh, -0.002, pull=0.085, hinge=0.055)
    lx, ly = dw / 2 - 0.03, dy + dh / 2 - 0.03
    metal.append(cylinder("lock_collar_0", 0.011, 0.004, M["chrome"], at(pF, lx, ly, 0.0002), segs=24, bevel=0.0012, bevel_seg=2))
    metal.append(cylinder("lock_core_0", 0.007, 0.003, M["metal"], at(pF, lx, ly, 0.0028), segs=20, bevel=0.0008, bevel_seg=1))
    controls.append(box("lock_slot_0", 0.0018, 0.008, 0.001, M["hole"], at(pF, lx, ly, 0.0045)))
    for sx in (-1, 1):
        metal.append(cylinder(f"leveller_{sx}", 0.019, 0.012, M["metal"], Matrix.Translation((sx * (W / 2 - 0.09), -D / 2 + 0.14, 0.006)), segs=20, bevel=0.002, bevel_seg=1))

    # shelf: the hidden light under it washes the pedestal; the edge stays dark (the wall carries this machine's light)
    uF, uL = seg("D", "E")
    body.append(ht.panel("shelf_under", uF, uL, M["paint"], [(0, uL / 2, IW - 0.10, 0.020, 0.004, M["seam"])], round_end=True))
    eF, eL = seg("E", "F")
    body.append(ht.panel("shelf_edge", eF, eL, M["deck"], round_start=True, round_end=True))

    # deck: previous / fullscreen / next as three arcade buttons (btn_0..2, the hall maps k % 3), a turned knob, the
    # engraved inlay line and the four carriage bolts of a real control panel
    cF, cL = seg("F", "G")
    rec = ring(0, cL / 2, IW - 0.026, cL - 0.026, 0.0016, 0.001, M["hole"])
    body.append(ht.panel("shelf_top", cF, cL, M["deck"], rec, round_start=True))
    for i, x in enumerate((-0.14, 0.0, 0.14)):
        y = cL * 0.5
        big = i == 1
        rr, r, h = (0.037, 0.030, 0.011) if big else (0.029, 0.023, 0.010)
        btn = cg.control_group(parts, pivots, f"btn_{i}", cF, x, y, 0.0)
        btn.append(cylinder(f"btn_ring_{i}", rr, 0.005, M["chrome"], at(cF, x, y, 0.0025), segs=40, bevel=0.0015, bevel_seg=2))
        btn.append(ht.dish_cap(f"btn_cap_{i}", cF, x, y, 0.003, r, h, M["brand_lit"] if big else M["ivory"], steps=36))
        if not big:  # what the button does is printed on its cap: a dark chevron, previous / next
            way = -1 if i == 0 else 1
            for side in (-1, 1):
                btn.append(box(f"btn_mark_{i}_{side}", 0.014, 0.003, 0.0006, M["hole"], at(cF, x - way * 0.0016, y + side * 0.0043, 0.003 + ht.cap_face(h) + 0.0003, Matrix.Rotation(math.radians(-way * side * 38), 4, "Z"))))
    ht.knob(metal, controls, M, cF, IW / 2 - 0.15, cL * 0.5, -35, 0)
    for sx in (-1, 1):
        for y in (0.03, cL - 0.03):
            metal.append(cylinder(f"deck_bolt_{sx}_{int(y * 1000)}", 0.0065, 0.0024, M["dark_metal"], at(cF, sx * (IW / 2 - 0.035), y, 0.0012), segs=20, bevel=0.0016, bevel_seg=2))

    # the screen wall: four device frames in pockets of one satin panel, the dashed outline and the resize arrow
    bF, bL = seg("G", "H")
    devs = layout()
    rect = outline_rect(devs)
    if rect[3] > bL - 0.03:
        raise RuntimeError(f"screen wall too tall: outline top {rect[3]:.3f} on a {bL:.3f} panel")
    rec = []
    for d in devs:
        rec += [(d["cx"], d["cy"], d["pw"], d["ph"], POCKET, M["hole"])] + ring(d["cx"], d["cy"], d["pw"], d["ph"], 0.003, POCKET + 0.004, M["hole"])
    pocket = resize_arrow(parts, M, bF, (rect[2], rect[1]))
    rec += [pocket] + dashes(rect, pocket[:4], M["seam"])
    body.append(ht.panel("display", bF, bL, M["wall"], rec))
    for d in devs:
        controls.append(cg.frame_plate(f"bezel_{d['name']}", d["pw"] - 0.002, d["ph"] - 0.002, d["sw"] + 0.004, d["sh"] + 0.004, BEZEL_FRONT, -0.002, BEZEL_RECESS, M["bezel"], at(bF, d["cx"], d["cy"], -POCKET), bevel=0.003, seg=2, inner_bevel=0.002, corner=d["cr"]))
    scr, gl, layout_json = screen_meshes(devs, bF, M)
    # the monitor's power LED on the desktop's bottom bezel margin
    d0 = devs[0]
    controls.append(cylinder("power_led", 0.0025, 0.0012, M["brand_lit"], at(bF, d0["cx"] + d0["sw"] / 2 - 0.012, d0["cy"] - d0["sh"] / 2 - d0["bz"] / 2, 0.0006), segs=12))
    # what holds the wall panel on: six small dark fasteners in its margins
    for sx in (-1, 1):
        for y in (0.02, bL / 2, bL - 0.02):
            ht.screw(metal, controls, M, bF, sx * (IW / 2 - 0.018), y, 0.0, r=0.0036, turn=0.8 * sx + y)

    # hood and fascia (plain: the wall names the machine), then the top and the back
    hF, hL = seg("H", "J")
    body.append(ht.panel("hood", hF, hL, M["paint"], round_end=True))
    body.append(ht.panel("fascia", *seg("J", "K"), M["paint"], round_start=True))
    for i in range(idx["K"], len(inner) - 1):
        body.append(ht.panel(f"carcass_{i}", *seg_frame(inner[i], inner[i + 1]), M["paint"]))

    ht.power_cable(parts, M)

    arts = mg.side_art(W, 0, 0, 0, 0, M["art"], profile=outer)
    for ob in arts:
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        bmesh.ops.triangulate(bm, faces=bm.faces[:], ngon_method="EAR_CLIP")
        bm.to_mesh(ob.data)
        bm.free()
    return parts, scr, gl, arts, pivots, layout_json


def dress_screen(composite):
    """Preview only: the test composite on the screen, mapped through the screen's own UVs."""
    scm = bpy.data.materials.get("mach_screen")
    if not scm:
        return
    nt = scm.node_tree
    b = nt.nodes["Principled BSDF"]
    if composite and os.path.exists(composite):
        img = bpy.data.images.load(os.path.abspath(composite))
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = img
        tex.interpolation = "Linear"
        nt.links.new(tex.outputs["Color"], b.inputs["Base Color"])
        nt.links.new(tex.outputs["Color"], b.inputs["Emission Color"])
        b.inputs["Emission Strength"].default_value = 1.6
    else:
        b.inputs["Emission Color"].default_value = (0.10, 0.14, 0.25, 1.0)
        b.inputs["Emission Strength"].default_value = 1.5


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--size", type=int, default=1024)
    ap.add_argument("--preview", default=None)
    ap.add_argument("--composite", default=None)
    ap.add_argument("--no-bake", action="store_true")
    args = ap.parse_args(argv)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    cg.COLL = bpy.data.collections.new("machine")
    bpy.context.scene.collection.children.link(cg.COLL)
    bpy.context.scene.unit_settings.system = "METRIC"

    # a design tool's rig: tidy, used daily. Polished hands on the deck front, a little at the corners and around the
    # bay door, kicks low on the pedestal, dust on the top; no knee patch (nobody kneels here).
    ht.configure({"width": W, "depth": D, "shelf_z": SHELF_Z, "seed": "snapsize", "paint": PAINT, "panel": PANEL,
                  "wear": {"edge": 0.6, "hands": 0.6, "shoes": 0.25, "knees": 0.0, "crevice": 0.8, "low": 0.5, "dust": 0.35, "corners": 0.2, "door": 0.3, "door_z": 0.33}})
    spec = mg.Spec(dict(name=NAME, title="Snapsize", variant="terminal", height=H, width=W, depth=D, brand=LAVENDER, brand2=INDIGO,
                        tmolding=LAVENDER, accent=INDIGO, paint=PAINT, panel=PANEL, screenTilt=WALL_TILT))
    M = mg.make_materials(spec, None)
    M["door"] = material("mach_metal_door", grey(0.10), rough=0.5, metal=1.0)
    M["bezel"] = material("mach_bezel_gloss", grey(0.012), rough=0.12, coat=0.4)
    M["deck"] = material("mach_deck_satin", grey(0.035), rough=0.42)
    M["wall"] = material("mach_wall_satin", hex_rgb(WALL), rough=0.5)  # the hall's satin scan: black, a little glossier than paint
    M["rubber"] = material("mach_rubber", grey(0.012), rough=0.7)
    M["led"] = material("mach_led", grey(0.004), rough=0.9, emit=spec.brand, emit_strength=0.3)

    parts, scr, gl, arts, pivots, layout_json = build(spec, M)
    objs = ht.finish(parts, [scr, gl, *arts], pivots)
    targets = [ob for ob in objs if ob.name not in hg.SKIP_BAKE]
    for ob in targets:
        hg.ensure_uv_order(ob)
        hg.box_project_unit(ob)
    ht.unwrap_atlas_weighted(targets)
    total = sum(cg.tri_count(ob) for ob in objs)
    print(f"[hero] {NAME}: {total} tris, {len(objs)} meshes ({', '.join(ob.name for ob in objs)})")
    for ob in (scr, gl):
        lo, hi = cg.gltf_bbox(ob)
        print(f"[hero]   {ob.name:<8} glTF bbox x {lo[0]:+.3f}..{hi[0]:+.3f}  y {lo[1]:.3f}..{hi[1]:.3f}  z {lo[2]:+.3f}..{hi[2]:+.3f}")
    xs, zs = [], []
    for ob in objs:
        lo, hi = cg.gltf_bbox(ob)
        xs += [lo[0], hi[0]]
        zs += [lo[1], hi[1]]
    print(f"[hero]   overall width {max(xs) - min(xs):.4f} m, height {max(zs) - min(zs):.4f} m")

    out_dir = os.path.dirname(os.path.abspath(args.out))
    os.makedirs(out_dir, exist_ok=True)
    root = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
    for path in (os.path.join(root, ".source-assets", "models-in", NAME, "screen-layout.json"), os.path.join(out_dir, "screen-layout.json")):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(layout_json, fh, indent=2)
        print(f"[hero] screen layout {path}")
    with open(os.path.join(out_dir, "spec.json"), "w", encoding="utf-8") as fh:
        json.dump({"name": NAME, "variant": "compare-rig", "height": H, "width": W, "depth": D, "controls": list(pivots), "triangles": total}, fh, indent=2)

    if not args.no_bake:
        hg.bake_mask(objs, args.size, os.path.abspath(args.out)[:-4] + "-mask.png")
        ht.bake_key_shadow(objs, args.size // 2, os.path.abspath(args.out)[:-4] + "-light.png")
        # rounded edges. After bake_mask: its floor plane would bevel the carcass's bottom edges away.
        hg.bake_bevel_normal(objs, args.size, os.path.abspath(args.out)[:-4] + "-normal.png")
    cg.export_glb(objs, args.out)
    print(f"[hero] exported {args.out} ({os.path.getsize(args.out) / 1024:.0f} KB)")

    if args.preview:
        os.makedirs(args.preview, exist_ok=True)
        dress_screen(args.composite)
        cam = cg.build_studio(spec)
        f = 1.18
        cg.render_preview(cam, os.path.join(args.preview, "snapsize-3q.png"), (-2.15 * f, -2.75 * f, 1.55 * f), (0.0, -0.05, H * 0.5), spec)
        cg.render_preview(cam, os.path.join(args.preview, "snapsize-front.png"), (0.0, -3.6 * f, 1.35 * f), (0.0, 0.0, H * 0.5), spec)
        cg.render_preview(cam, os.path.join(args.preview, "snapsize-deck.png"), (-0.55, -1.45, 1.85), (0.0, -0.30, 0.93), spec)
        print(f"[hero] previews in {args.preview}")


if __name__ == "__main__":
    main()
