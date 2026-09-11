"""
machine_gen.py — procedural NON-GAME hall machines for Blender 5.x (headless).

Sister of cabinet_gen.py (same coordinate conventions, helpers and export settings): builds
ONE machine from a JSON spec — a desktop TERMINAL, a phone KIOSK or a JUKEBOX — applies all
modifiers, exports a game-ready GLB and (optionally) renders Eevee studio previews.

    blender --background --python scripts/models/blender/machine_gen.py -- \
        --spec .source-assets/models-in/mach-nexus/spec.json \
        --out  .source-assets/models-in/mach-nexus/mach-nexus.glb \
        [--preview .source-assets/models-in/mach-nexus] \
        [--variant terminal|kiosk|jukebox] [--blend debug.blend]

Coordinate conventions (identical to cabinet_gen.py)
----------------------------------------------------
Blender Z-up, FRONT facing -Y, standing on z = 0, centred on x = 0 / y = 0. The glTF export
is Y-up with the front facing +Z; every node transform is applied (identity) before export.
Front panels are authored in a "panel frame" (X = machine X, Y = up along the panel,
Z = out of the panel towards the player) derived from one segment of the side profile.

Mesh names the three.js hall scene binds (lowercase substring match — do not reuse them):
    screen        single flat quad, UV 0..1 (u left->right, v bottom->top), faces the player
    marquee       single flat quad for the name/logo texture, UV 0..1
    glass         transparent quad in front of the screen
    side_art_l/r  decal quads on the side panels (terminal, kiosk), UV 0..1, front = u 1 / 0
    pilaster_l/r  lit pilasters of the jukebox (emissive brand colour)
    body trim metal controls speaker   joined part groups (multi-material meshes)
Moving controls are their own objects with the origin at the pivot (cabinet_gen.control_group;
the quantize caveat there applies here too):
    trackball     terminal: ring + ball, origin = ball centre
    tbtn_0/1      terminal buttons next to it, origin = cap rest position on the ledge
    kbtn_0/1      kiosk buttons under the shelf, origin on the front panel
    sel_0..sel_5  jukebox selector buttons left to right, origin on the selector strip face

Spec fields (metres / degrees / sRGB hex; everything but name/variant optional)
    name         output basename                         "machine"
    variant      "terminal" | "kiosk" | "jukebox"       "terminal"
    title        text on the preview nameplate           = name
    brand        product primary colour (T-molding, seams, lit parts)
    brand2       product secondary colour (panels via darkening, accents)
    paint        body paint; default = near-black tinted towards `brand`
    tmolding     T-molding colour; default = brand
    panel        front-panel colour; default = brand2 darkened to 30 %
    accent       button / trackball accent; default = brand2
    height width depth   overall size; per-variant defaults (1.55/0.95/0.70,
                 1.95/0.50/0.42, 1.60/0.85/0.60)
    screenTilt   terminal display lean, positive = leans back   12
    wear         roughness-noise amplitude 0..1                  0.3
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
import cabinet_gen as cg  # noqa: E402
from cabinet_gen import (  # noqa: E402
    add_bevel,
    at,
    bm_to_object,
    box,
    build_studio,
    control_group,
    cylinder,
    disc,
    export_glb,
    finish,
    frame_plate,
    gltf_bbox,
    grey,
    hex_rgb,
    make_wear_image,
    material,
    offset_polygon,
    prism_yz,
    quad,
    render_preview,
    seg_frame,
    sphere,
    tiny_tex,
    tri_count,
    tube_along,
)

PART_KEYS = ("body", "trim", "metal", "controls", "speaker")
DEFAULTS = {
    "terminal": dict(height=1.55, width=0.95, depth=0.70),
    "kiosk": dict(height=1.95, width=0.50, depth=0.42),
    "jukebox": dict(height=1.60, width=0.85, depth=0.60),
}

# --------------------------------------------------------------------------------------
# colours / spec
# --------------------------------------------------------------------------------------


def srgb_tuple(h, default):
    h = (h or "").lstrip("#")
    if len(h) != 6:
        return default
    return tuple(int(h[i : i + 2], 16) / 255.0 for i in (0, 2, 4))


def to_hex(rgb):
    return "#%02X%02X%02X" % tuple(int(round(max(0.0, min(1.0, c)) * 255)) for c in rgb)


def derive_paint(brand_srgb):
    """Near-black tinted towards the brand (the cabinets' #0E1A22 for teal #58C2BA)."""
    return tuple(0.035 + 0.075 * c for c in brand_srgb)


def darken(srgb, k=0.30):
    return tuple(c * k for c in srgb)


class Spec:
    def __init__(self, d):
        self.name = d.get("name", "machine")
        self.title = d.get("title", self.name)
        self.variant = d.get("variant", "terminal")
        dv = DEFAULTS.get(self.variant, DEFAULTS["terminal"])
        brand = d.get("brand") or "#AC8BFD"
        brand2 = d.get("brand2") or brand
        self.brand_srgb = srgb_tuple(brand, (0.67, 0.55, 0.99))
        self.brand2_srgb = srgb_tuple(brand2, self.brand_srgb)
        self.paint_hex = d.get("paint") or to_hex(derive_paint(self.brand_srgb))
        self.panel_hex = d.get("panel") or to_hex(darken(self.brand2_srgb, 0.30))
        self.paint_srgb = srgb_tuple(self.paint_hex, (0.05, 0.05, 0.06))
        self.paint = hex_rgb(self.paint_hex)
        self.brand = hex_rgb(brand)
        self.tmolding = hex_rgb(d.get("tmolding") or brand)
        self.panel = hex_rgb(self.panel_hex)
        self.accent = hex_rgb(d.get("accent") or brand2)
        self.H = float(d.get("height", dv["height"]))
        self.W = float(d.get("width", dv["width"]))
        self.D = float(d.get("depth", dv["depth"]))
        self.screen_tilt = float(d.get("screenTilt", 12.0))
        self.wear = float(d.get("wear", 0.3))


def make_materials(s, wear_img):
    M = {}
    M["paint"] = material("mach_paint", s.paint, rough=0.45, coat=0.3, rough_tex=wear_img)
    M["panel"] = material("mach_panel", s.panel, rough=0.5, coat=0.15)
    M["trim"] = material("mach_tmolding", s.tmolding, rough=0.35)
    M["seam"] = material("mach_seam", s.brand, rough=0.3, emit=s.brand, emit_strength=1.2)
    M["metal"] = material("mach_metal", grey(0.62), rough=0.4, metal=1.0)
    M["chrome"] = material("mach_chrome", grey(0.85), rough=0.18, metal=1.0)
    M["dark_metal"] = material("mach_metal_dark", grey(0.12), rough=0.5, metal=1.0)
    M["kick"] = material("mach_kick", grey(0.3), rough=0.5, metal=1.0)
    M["black"] = material("mach_bezel", grey(0.01), rough=0.62, spec=0.3)
    M["deck"] = material("mach_deck", grey(0.025), rough=0.6, spec=0.35)
    M["ring"] = material("mach_ring", grey(0.02), rough=0.4)
    M["grille"] = material("mach_grille", grey(0.16), rough=0.5, metal=0.7)
    M["hole"] = material("mach_hole", grey(0.004), rough=0.9)
    M["key"] = material("mach_key", grey(0.06), rough=0.55, spec=0.35)
    M["ivory"] = material("mach_ivory", hex_rgb("#F4F1EA"), rough=0.3, emit=hex_rgb("#F4F1EA"), emit_strength=0.2)
    M["accent"] = material("mach_accent", s.accent, rough=0.3, emit=s.accent, emit_strength=0.4)
    M["brand_lit"] = material("mach_brand_lit", s.brand, rough=0.3, emit=s.brand, emit_strength=0.6)
    M["ball"] = material("mach_ball", s.accent, rough=0.2, coat=0.5)
    M["screen"] = material("mach_screen", grey(0.006), rough=0.5, spec=0.4, emit=grey(0.0), emit_strength=0.0, base_tex=tiny_tex("mach_screen_tex", (0.07, 0.07, 0.07)))
    M["glass"] = material("mach_glass", grey(0.0), rough=0.08, alpha=0.15)
    M["marquee"] = material("mach_marquee", grey(0.95), rough=0.4, emit=grey(1.0), emit_strength=1.0, base_tex=tiny_tex("mach_marquee_tex", (0.98, 0.98, 0.98)))
    M["art"] = material("mach_side_art", s.paint, rough=0.45, base_tex=tiny_tex("mach_side_art_tex", s.paint_srgb))
    pil = tuple(0.55 * b + 0.45 for b in s.brand)  # brand washed towards white: lit acrylic
    M["pilaster"] = material("mach_pilaster", pil, rough=0.22, coat=0.4, emit=s.brand, emit_strength=0.9)
    return M


# --------------------------------------------------------------------------------------
# shared builders
# --------------------------------------------------------------------------------------


def prism_xz(name, profile, y0, y1, mat, bevel=0.0, seg=3):
    """Extrude an (x, z) polygon (front-view silhouette) along Y from y0 to y1."""
    bm = bmesh.new()
    a = [bm.verts.new((x, y0, z)) for x, z in profile]
    b = [bm.verts.new((x, y1, z)) for x, z in profile]
    n = len(profile)
    caps = [bm.faces.new(a), bm.faces.new(list(reversed(b)))]
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[j], a[i], b[i], b[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bmesh.ops.triangulate(bm, faces=caps, quad_method="BEAUTY", ngon_method="BEAUTY")
    ob = bm_to_object(name, bm, mat, None, smooth=bevel > 0)
    if bevel > 0:
        add_bevel(ob, bevel, seg)
    return ob


def shell_and_sides(parts, M, outer, W, t=0.019, inset=0.013, bevel_side=0.004, bevel_shell=0.010, tm_r=0.0075):
    """Two painted side panels + inner shell along a side profile, T-molding tubes along the
    panel edge (front, top, back — not the bottom). Returns the inset (inner) profile."""
    inner = offset_polygon(outer, inset)
    parts["body"].append(prism_yz("side_l", outer, -W / 2, -W / 2 + t, M["paint"], bevel=bevel_side, seg=3))
    parts["body"].append(prism_yz("side_r", outer, W / 2 - t, W / 2, M["paint"], bevel=bevel_side, seg=3))
    parts["body"].append(prism_yz("shell", inner, -W / 2 + t, W / 2 - t, M["paint"], bevel=bevel_shell, seg=4))
    for sx, nm in ((-1, "tmolding_l"), (1, "tmolding_r")):
        x = sx * (W / 2 - t / 2)
        pts = [(x, y, z + (0.004 if i in (0, len(outer) - 1) else 0.0)) for i, (y, z) in enumerate(outer)]
        parts["trim"].append(tube_along(nm, pts, tm_r, M["trim"], resolution=2))
    return inner


def marquee_unit(parts, M, F, cy, w, h, z0=0.0):
    """Lit nameplate in panel frame F: quad `marquee` + dark surround + metal retainers."""
    mq = quad("marquee", w, h, M["marquee"], at(F, 0, cy, z0 + 0.006))
    parts["controls"].append(box("mq_surround", w + 0.03, h + 0.03, 0.008, M["black"], at(F, 0, cy, z0 + 0.001), bevel=0.003, seg=1))
    for yy in (cy - h / 2 - 0.004, cy + h / 2 + 0.004):
        parts["metal"].append(box("mq_retainer", w + 0.03, 0.012, 0.007, M["metal"], at(F, 0, yy, z0 + 0.0085), bevel=0.002, seg=1))
    for xx in (-w / 2 - 0.006, w / 2 + 0.006):
        parts["metal"].append(box("mq_clip", 0.012, h + 0.02, 0.007, M["metal"], at(F, xx, cy, z0 + 0.0085), bevel=0.002, seg=1))
    return mq


def display_unit(parts, M, F, cy, sw, sh, bw, bh, corner=0.012, bevel=0.005):
    """Flat display in panel frame F: bezel plate with a recessed window, `screen` quad and
    `glass` quad. Depth stack: shell 0 / screen 0.0025 / glass 0.0105 / bezel front 0.012."""
    bz_front, bz_back, recess = 0.012, -0.004, 0.010
    parts["controls"].append(frame_plate("bezel", bw, bh, sw + 0.006, sh + 0.006, bz_front, bz_back, recess, M["black"], at(F, 0, cy, 0), bevel=bevel, seg=3, corner=corner))
    scr = quad("screen", sw, sh, M["screen"], at(F, 0, cy, 0.0025))
    gl = quad("glass", sw + 0.004, sh + 0.004, M["glass"], at(F, 0, cy, bz_front - 0.0015))
    return scr, gl


def grille_unit(parts, M, F, cx, cy, gw, gh, cols, rows, z0=0.0, tag=""):
    parts["speaker"].append(box(f"grille{tag}", gw, gh, 0.006, M["grille"], at(F, cx, cy, z0 + 0.003), bevel=0.002, seg=1))
    for r in range(rows):
        for c in range(cols):
            x = cx - gw / 2 + 0.018 + c * (gw - 0.036) / max(1, cols - 1)
            y = cy - gh / 2 + 0.017 + r * (gh - 0.034) / max(1, rows - 1)
            parts["speaker"].append(disc(f"hole{tag}_{r}_{c}", 0.0065, M["hole"], at(F, x, y, z0 + 0.0065), segs=8))


def side_art(W, ya0, ya1, za0, za1, mat, dx=0.0015, profile=None):
    """Decal quads on both side panels; the front of the machine is u = 1 on the left panel
    and u = 0 on the right panel so artwork reads correctly from outside on both sides."""
    if profile:
        ya0, ya1 = min(y for y,z in profile), max(y for y,z in profile)
        za0, za1 = min(z for y,z in profile), max(z for y,z in profile)
    arts = []
    for sx, nm in ((-1, "side_art_l"), (1, "side_art_r")):
        bm = bmesh.new()
        uvl = bm.loops.layers.uv.new("UVMap")
        x = sx * (W / 2 + dx)
        corners = list(profile) if profile else [(ya0, za0), (ya1, za0), (ya1, za1), (ya0, za1)]
        if sx < 0:
            corners.reverse()
        vs = [bm.verts.new((x, y, z)) for y, z in corners]
        f = bm.faces.new(vs)
        f.normal_update()
        if f.normal.x * sx < 0:
            f.normal_flip()
        for lp in f.loops:
            y, z = lp.vert.co.y, lp.vert.co.z
            u = (y - ya0) / (ya1 - ya0) if sx > 0 else (ya1 - y) / (ya1 - ya0)
            lp[uvl].uv = (u, (z - za0) / (za1 - za0))
        arts.append(bm_to_object(nm, bm, mat, None, smooth=False))
    return arts


def new_parts():
    return {k: [] for k in PART_KEYS}


# --------------------------------------------------------------------------------------
# TERMINAL — pedestal + keyboard ledge + tilted 16:10 display, full-height side panels
# --------------------------------------------------------------------------------------


def terminal_profile(s):
    """Side profile (y, z), clockwise from the bottom-front. Named points returned too."""
    H, D = s.H, s.D
    yf = -D / 2  # ledge lip = front-most point
    kick_h, kick_in = 0.10, 0.06
    z_ped, lip_h = 0.70, 0.05
    ledge_d, ledge_a = 0.20, 8.0
    head_h = 0.17
    a = math.radians(ledge_a)
    A = (yf + kick_in, 0.0)
    B = (yf + kick_in, kick_h)
    C = (yf + 0.012, kick_h)
    Dp = (yf + 0.012, z_ped)
    E = (yf, z_ped)
    F = (yf, z_ped + lip_h)
    G = (yf + ledge_d * math.cos(a), F[1] + ledge_d * math.sin(a))
    z_head = H - head_h
    Hp = (G[0] + (z_head - G[1]) * math.tan(math.radians(s.screen_tilt)), z_head)
    J = (Hp[0] - head_h * math.tan(math.radians(4.0)), H)  # nameplate leans a touch forward
    K = (D / 2 - 0.06, H)
    L = (D / 2, H - 0.06)
    Mp = (D / 2, 0.0)
    pts = [A, B, C, Dp, E, F, G, Hp, J, K, L, Mp]
    names = dict(zip("ABCDEFGHJKLM", pts))
    return pts, names


def build_terminal(s, M):
    W, H, D = s.W, s.H, s.D
    t, inset = 0.019, 0.013
    iw = W - 2 * t
    outer, P = terminal_profile(s)
    parts = new_parts()
    pivots = {}
    inner = shell_and_sides(parts, M, outer, W, t, inset)
    Pi = dict(zip("ABCDEFGHJKLM", inner))

    # kick plate (A -> B)
    kF, kL = seg_frame(Pi["A"], Pi["B"])
    parts["metal"].append(box("kick", iw - 0.02, kL - 0.03, 0.008, M["kick"], at(kF, 0, kL / 2, 0.004), bevel=0.003, seg=2))

    # pedestal front (C -> D): panel plate, vent slots, two small speaker grilles
    pF, pL = seg_frame(Pi["C"], Pi["D"])
    parts["body"].append(box("ped_panel", iw - 0.04, pL - 0.05, 0.010, M["panel"], at(pF, 0, pL / 2, 0.005), bevel=0.005, seg=2))
    for i in range(5):
        parts["controls"].append(box(f"vent_{i}", 0.26, 0.006, 0.003, M["hole"], at(pF, 0, 0.09 + i * 0.02, 0.011)))
    for sx in (-1, 1):
        grille_unit(parts, M, pF, sx * (iw / 2 - 0.13), pL - 0.075, 0.14, 0.05, cols=5, rows=2, z0=0.010, tag=f"_{sx}")

    # ledge lip (E -> F): dark band with the brand light seam
    lF, lL = seg_frame(Pi["E"], Pi["F"])
    parts["metal"].append(box("lip_band", iw - 0.02, lL - 0.004, 0.004, M["dark_metal"], at(lF, 0, lL / 2, 0.002)))
    parts["controls"].append(box("seam", iw - 0.03, 0.007, 0.005, M["seam"], at(lF, 0, lL / 2, 0.0065)))

    # keyboard ledge (F -> G, angled)
    cF, cL = seg_frame(Pi["F"], Pi["G"])
    plate_t = 0.03
    parts["controls"].append(box("ledge", iw - 0.02, cL + 0.02, plate_t, M["deck"], at(cF, 0, cL / 2 - 0.004, plate_t / 2 + 0.002), bevel=0.007, seg=3))
    top = plate_t + 0.002
    parts["metal"].append(box("ledge_lip", iw - 0.016, 0.012, 0.006, M["dark_metal"], at(cF, 0, -0.008, top - 0.012), bevel=0.0015, seg=1))
    kb_w, kb_d, kx, ky = 0.60, 0.13, -0.09, cL * 0.5
    parts["controls"].append(box("kb_base", kb_w, kb_d, 0.014, M["black"], at(cF, kx, ky, top + 0.007), bevel=0.004, seg=2))
    rows, cols = 4, 14
    pitch_x = (kb_w - 0.06) / (cols - 1)
    pitch_y = (kb_d - 0.04) / (rows - 1)
    for r in range(rows):
        for c in range(cols):
            if r == 0 and 4 <= c <= 9:
                continue  # space bar
            x = kx - kb_w / 2 + 0.03 + c * pitch_x
            y = ky - kb_d / 2 + 0.02 + r * pitch_y
            parts["controls"].append(box(f"key_{r}_{c}", 0.030, 0.021, 0.006, M["key"], at(cF, x, y, top + 0.017)))
    xs = kx - kb_w / 2 + 0.03 + 6.5 * pitch_x
    parts["controls"].append(box("space_bar", 5 * pitch_x + 0.030, 0.021, 0.006, M["key"], at(cF, xs, ky - kb_d / 2 + 0.02, top + 0.017)))
    # trackball (own object, origin = ball centre) with chrome bezel + two brand-lit buttons
    tx, ty = 0.33, cL * 0.55
    tb = control_group(parts, pivots, "trackball", cF, tx, ty, top + 0.012)
    tb.append(cylinder("tb_ring", 0.046, 0.008, M["ring"], at(cF, tx, ty, top + 0.004), segs=24))
    parts["metal"].append(cylinder("tb_bezel", 0.040, 0.004, M["chrome"], at(cF, tx, ty, top + 0.010), segs=24))
    tb.append(sphere("tb_ball", 0.031, M["ball"], at(cF, tx, ty, top + 0.012), segs=24, rings=14))
    for i, x in enumerate((0.30, 0.36)):
        btn = control_group(parts, pivots, f"tbtn_{i}", cF, x, cL * 0.2, top)
        btn.append(cylinder(f"tbtn_ring_{i}", 0.0125, 0.005, M["ring"], at(cF, x, cL * 0.2, top + 0.0025), segs=16))
        btn.append(cylinder(f"tbtn_cap_{i}", 0.0095, 0.008, M["brand_lit"] if i == 0 else M["accent"], at(cF, x, cL * 0.2, top + 0.0065), segs=16, bevel=0.003, bevel_seg=1))

    # display (G -> H, tilted back by screenTilt)
    bF, bL = seg_frame(Pi["G"], Pi["H"])
    sw = 0.86
    sh = sw / 1.6
    scr, gl = display_unit(parts, M, bF, bL / 2 + 0.004, sw, sh, iw - 0.03, bL - 0.04, corner=0.012)

    # nameplate (H -> J)
    hF, hL = seg_frame(Pi["H"], Pi["J"])
    mq_w, mq_h = 0.70, hL - 0.045
    mq = marquee_unit(parts, M, hF, hL / 2, mq_w, mq_h)

    # side art: as wide as the panel allows at the top of the decal (front edge leans back)
    za0, za1 = 0.12, 1.02
    y_front_top = P["G"][0] + (za1 - P["G"][1]) * math.tan(math.radians(s.screen_tilt))
    arts = side_art(W, y_front_top + 0.03, D / 2 - 0.035, za0, za1, M["art"], profile=outer)

    return parts, scr, gl, mq, arts, [], (hF, hL / 2, mq_w, mq_h), pivots


# --------------------------------------------------------------------------------------
# KIOSK — slim tower, rounded top, portrait screen, shelf/dock
# --------------------------------------------------------------------------------------


def kiosk_profile(s):
    H, D = s.H, s.D
    yf = -D / 2
    kick_h, kick_in, r, k = 0.08, 0.05, 0.08, 6
    pts = [(yf + kick_in, 0.0), (yf + kick_in, kick_h), (yf, kick_h), (yf, H - r)]
    for i in range(1, k + 1):
        a = math.radians(180 - 90 * i / k)
        pts.append((yf + r + r * math.cos(a), H - r + r * math.sin(a)))
    for i in range(1, k + 1):
        a = math.radians(90 - 90 * i / k)
        pts.append((D / 2 - r + r * math.cos(a), H - r + r * math.sin(a)))
    pts.append((D / 2, 0.0))
    return pts


def build_kiosk(s, M):
    W, H, D = s.W, s.H, s.D
    t, inset = 0.016, 0.013
    iw = W - 2 * t
    outer = kiosk_profile(s)
    parts = new_parts()
    pivots = {}
    inner = shell_and_sides(parts, M, outer, W, t, inset)
    F, _ = seg_frame(inner[2], inner[3])  # vertical front, kick top -> rounded top
    fy = lambda z: z - inner[2][1]  # world z -> local y in F

    kF, kL = seg_frame(inner[0], inner[1])
    parts["metal"].append(box("kick", iw - 0.02, kL - 0.02, 0.008, M["kick"], at(kF, 0, kL / 2, 0.004), bevel=0.003, seg=2))

    # lower front panel (brand2 darkened)
    parts["body"].append(box("lower_panel", iw - 0.06, 0.56, 0.008, M["panel"], at(F, 0, fy(0.42), 0.004), bevel=0.004, seg=2))

    # portrait display + glass
    sw, sh, zs = 0.36, 0.64, 1.33
    scr, gl = display_unit(parts, M, F, fy(zs), sw, sh, iw - 0.03, sh + 0.08, corner=0.02)

    # lit header above the screen (just under the rounded top)
    mq_w, mq_h, zm = 0.42, 0.14, 1.775
    mq = marquee_unit(parts, M, F, fy(zm), mq_w, mq_h)

    # speaker grille between screen and shelf
    grille_unit(parts, M, F, 0.0, fy(0.925), 0.24, 0.05, cols=9, rows=2)

    # shelf with phone dock, brand-lit strip along the front edge, seam under the shelf
    zsh = 0.845
    parts["controls"].append(box("shelf", iw - 0.08, 0.03, 0.10, M["panel"], at(F, 0, fy(zsh), 0.05), bevel=0.006, seg=2))
    parts["controls"].append(box("shelf_strip", iw - 0.11, 0.006, 0.004, M["brand_lit"], at(F, 0, fy(zsh) - 0.007, 0.102)))
    parts["controls"].append(box("dock", 0.11, 0.03, 0.03, M["black"], at(F, 0, fy(zsh) + 0.030, 0.045), bevel=0.004, seg=2))
    parts["controls"].append(box("dock_slot", 0.09, 0.012, 0.014, M["hole"], at(F, 0, fy(zsh) + 0.040, 0.045)))
    parts["controls"].append(box("under_seam", iw - 0.06, 0.005, 0.004, M["seam"], at(F, 0, fy(zsh) - 0.03, 0.002)))
    for i, x in enumerate((-0.05, 0.05)):
        btn = control_group(parts, pivots, f"kbtn_{i}", F, x, fy(0.765), 0.0)  # own object, origin on the front panel
        btn.append(cylinder(f"kbtn_ring_{i}", 0.015, 0.005, M["ring"], at(F, x, fy(0.765), 0.0025), segs=16))
        btn.append(cylinder(f"kbtn_cap_{i}", 0.011, 0.008, M["accent"] if i else M["brand_lit"], at(F, x, fy(0.765), 0.0065), segs=16, bevel=0.003, bevel_seg=1))

    arts = side_art(W, -0.17, 0.17, 0.25, 1.55, M["art"], profile=outer)
    return parts, scr, gl, mq, arts, [], (F, fy(zm), mq_w, mq_h), pivots


# --------------------------------------------------------------------------------------
# JUKEBOX — arched front body, boxier rear, pilasters, chrome grille, display window
# --------------------------------------------------------------------------------------


def jukebox_arch(W, H, z0, n=18):
    """Front-view outline (x, z): flat bottom, vertical sides, half-ellipse arch (tangent at z0)."""
    hw, b = W / 2, H - z0
    pts = [(-hw, 0.0), (hw, 0.0), (hw, z0)]
    for i in range(1, n):
        tt = math.pi * i / n
        pts.append((hw * math.cos(tt), z0 + b * math.sin(tt)))
    pts.append((-hw, z0))
    return pts


def rounded_top_profile(hw, h, r, k=5):
    pts = [(-hw, 0.0), (hw, 0.0), (hw, h - r)]
    for i in range(1, k + 1):
        a = math.radians(90 * i / k)
        pts.append((hw - r + r * math.cos(a), h - r + r * math.sin(a)))
    for i in range(1, k + 1):
        a = math.radians(90 + 90 * i / k)
        pts.append((-hw + r + r * math.cos(a), h - r + r * math.sin(a)))
    return pts


def jukebox_seam_pts(W, H, z0, d, y, n=18, z_bot=0.13):
    hw, b = W / 2 - d, H - z0 - d
    pts = [(hw, y, z_bot), (hw, y, z0)]
    for i in range(1, n):
        tt = math.pi * i / n
        pts.append((hw * math.cos(tt), y, z0 + b * math.sin(tt)))
    pts += [(-hw, y, z0), (-hw, y, z_bot)]
    return pts


def build_jukebox(s, M):
    W, H, D = s.W, s.H, s.D
    z0 = H - 0.40  # arch springs here
    yf = -D / 2
    y_mid = yf + 0.30 * (D / 0.6)
    parts = new_parts()
    pivots = {}
    parts["body"].append(prism_xz("arch_body", jukebox_arch(W, H, z0, n=18), yf, y_mid, M["paint"], bevel=0.012, seg=4))
    parts["body"].append(prism_xz("rear_body", rounded_top_profile(W / 2 - 0.02, z0 + 0.06, 0.06), y_mid - 0.02, D / 2, M["paint"], bevel=0.010, seg=3))
    F, _ = seg_frame((yf, 0.0), (yf, 1.0))  # front face; local y == world z

    # chrome base band + kick
    parts["metal"].append(box("kick", W - 0.06, 0.05, 0.006, M["kick"], at(F, 0, 0.035, 0.003), bevel=0.002, seg=1))
    parts["metal"].append(box("base_band", W - 0.03, 0.05, 0.012, M["chrome"], at(F, 0, 0.085, 0.006), bevel=0.003, seg=1))

    # lower panel (brand2 darkened) with the chrome grille
    parts["body"].append(box("lower_panel", 0.64, 0.50, 0.010, M["panel"], at(F, 0, 0.42, 0.005), bevel=0.004, seg=2))
    gw, gh, gz = 0.56, 0.40, 0.43
    parts["speaker"].append(box("grille_back", gw, gh, 0.004, M["hole"], at(F, 0, gz, 0.012)))
    nb = 8
    for i in range(nb):
        z = gz - gh / 2 + 0.03 + i * (gh - 0.06) / (nb - 1)
        parts["speaker"].append(box(f"bar_{i}", gw, 0.018, 0.012, M["chrome"], at(F, 0, z, 0.020), bevel=0.004, seg=1))
    for sx in (-1, 1):
        parts["metal"].append(box(f"grille_post_{sx}", 0.02, gh + 0.04, 0.014, M["chrome"], at(F, sx * (gw / 2 + 0.012), gz, 0.021), bevel=0.003, seg=1))

    # chrome mid band + selector row (6 buttons)
    parts["metal"].append(box("mid_band", W - 0.10, 0.025, 0.012, M["chrome"], at(F, 0, 0.705, 0.006), bevel=0.003, seg=1))
    sz = 0.785
    parts["controls"].append(box("selector_strip", 0.52, 0.075, 0.010, M["black"], at(F, 0, sz, 0.005), bevel=0.004, seg=2))
    for i in range(6):
        x = -0.175 + i * 0.07
        col = M["accent"] if i % 2 else M["ivory"]
        sel = control_group(parts, pivots, f"sel_{i}", F, x, sz, 0.010)  # own object, origin on the strip face (z 0.010)
        sel.append(cylinder(f"sel_ring_{i}", 0.020, 0.006, M["ring"], at(F, x, sz, 0.013), segs=20))
        sel.append(cylinder(f"sel_cap_{i}", 0.016, 0.012, col, at(F, x, sz, 0.019), segs=20, bevel=0.005, bevel_seg=2))

    # display window + lit title strip on the arch
    sc_w, sc_h, sc_z = 0.50, 0.375, 1.06
    scr, gl = display_unit(parts, M, F, sc_z, sc_w, sc_h, sc_w + 0.07, sc_h + 0.07, corner=0.03)
    mq_w, mq_h, mq_z = 0.56, 0.13, 1.365
    mq = marquee_unit(parts, M, F, mq_z, mq_w, mq_h)

    # brand light seam around the arch + two lit pilasters with chrome caps
    parts["trim"].append(tube_along("arch_seam", jukebox_seam_pts(W, H, z0, 0.016, yf + 0.003), 0.007, M["seam"], resolution=2))
    px = W / 2 - 0.075
    pil = []
    for sx, nm in ((-1, "pilaster_l"), (1, "pilaster_r")):
        pil.append(cylinder(nm, 0.036, 1.0, M["pilaster"], Matrix.Translation((sx * px, yf + 0.012, 0.66)), segs=24))
        for j, z in enumerate((0.15, 1.17)):
            parts["metal"].append(cylinder(f"pil_cap_{nm}_{j}", 0.044, 0.026, M["chrome"], Matrix.Translation((sx * px, yf + 0.012, z)), segs=24, bevel=0.004, bevel_seg=1))

    arts = cg.side_surface_art(parts["body"][:2], M["art"])
    return parts, scr, gl, mq, arts, pil, (F, mq_z, mq_w, mq_h), pivots


# --------------------------------------------------------------------------------------
# preview dressing (after export)
# --------------------------------------------------------------------------------------


def dress_for_preview(s, mq_frame):
    mqF, mq_cy, mq_w, mq_h = mq_frame
    cu = bpy.data.curves.new("mq_text", "FONT")
    cu.body = s.title.upper()
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    cu.size = min(0.075, mq_h * 0.62, mq_w / (0.66 * max(1, len(cu.body))))
    cu.extrude = 0.0012
    cu.space_character = 1.08
    txt = bpy.data.objects.new("mq_text", cu)
    cg.COLL.objects.link(txt)
    txt.matrix_world = at(mqF, 0, mq_cy - 0.004, 0.0078)
    cu.materials.append(material("preview_text", s.paint, rough=0.5))
    mqm = bpy.data.materials.get("mach_marquee")
    if mqm:
        b = mqm.node_tree.nodes["Principled BSDF"]
        b.inputs["Emission Color"].default_value = (1.0, 0.96, 0.88, 1.0)
        b.inputs["Emission Strength"].default_value = 0.9
    scm = bpy.data.materials.get("mach_screen")
    if scm:
        nt = scm.node_tree
        b = nt.nodes["Principled BSDF"]
        tc = nt.nodes.new("ShaderNodeTexCoord")
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(tc.outputs["UV"], sep.inputs["Vector"])
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].color = (*[0.35 * c + 0.05 for c in s.brand], 1.0)
        ramp.color_ramp.elements[1].color = (0.01, 0.02, 0.05, 1.0)
        nt.links.new(sep.outputs["Y"], ramp.inputs["Fac"])
        nt.links.new(ramp.outputs["Color"], b.inputs["Emission Color"])
        b.inputs["Emission Strength"].default_value = 1.4


def quad_report(ob):
    """(w, h, centre in glTF axes, tilt from vertical in degrees) of a 4-vert quad."""
    vs = [ob.matrix_world @ v.co for v in ob.data.vertices]
    w = (vs[1] - vs[0]).length
    h = (vs[2] - vs[1]).length
    c = sum(vs, Vector()) / len(vs)
    up = (vs[2] - vs[1]).normalized()
    tilt = math.degrees(math.atan2(abs(up.y), max(1e-6, up.z)))
    return w, h, (c.x, c.z, -c.y), tilt


# --------------------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------------------


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--spec", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--preview", default=None, help="directory for preview-3q.png / preview-front.png")
    ap.add_argument("--variant", default=None, choices=list(DEFAULTS))
    ap.add_argument("--blend", default=None)
    args = ap.parse_args(argv)

    with open(args.spec, "r", encoding="utf-8") as fh:
        raw = json.load(fh)
    if args.variant:
        raw["variant"] = args.variant
    spec = Spec(raw)
    if spec.variant not in DEFAULTS:
        raise SystemExit(f"unknown variant {spec.variant!r}")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    cg.COLL = bpy.data.collections.new("machine")
    bpy.context.scene.collection.children.link(cg.COLL)
    bpy.context.scene.unit_settings.system = "METRIC"

    wear_img = make_wear_image(128, base=0.45, amp=spec.wear) if spec.wear > 0 else None
    M = make_materials(spec, wear_img)
    print(f"[machine] {spec.name}: variant {spec.variant}, paint {spec.paint_hex}, panel {spec.panel_hex}, {spec.H} x {spec.W} x {spec.D} m")

    builder = {"terminal": build_terminal, "kiosk": build_kiosk, "jukebox": build_jukebox}[spec.variant]
    parts, scr, gl, mq, arts, extra, mq_frame, pivots = builder(spec, M)
    objs = finish(parts, [scr, gl, mq, *arts, *extra], wear=wear_img is not None, pivots=pivots)

    total = 0
    for ob in objs:
        n = tri_count(ob)
        total += n
        print(f"[machine]   {ob.name:<12} {n:>6} tris")
    print(f"[machine] total {total} tris, {len(objs)} meshes, {len(bpy.data.materials)} materials")
    for ob in (scr, mq):
        w, h, c, tilt = quad_report(ob)
        print(f"[machine]   {ob.name:<8} quad {w:.3f} x {h:.3f} m  centre glTF ({c[0]:+.3f}, {c[1]:.3f}, {c[2]:+.3f})  tilt {tilt:.1f} deg")
    for ob in (gl, *arts, *extra):
        lo, hi = gltf_bbox(ob)
        print(f"[machine]   {ob.name:<12} glTF bbox x {lo[0]:+.3f}..{hi[0]:+.3f}  y {lo[1]:.3f}..{hi[1]:.3f}  z {lo[2]:+.3f}..{hi[2]:+.3f}")
    for key, p in pivots.items():
        print(f"[machine]   {key:<12} origin glTF ({p.x:+.4f}, {p.z:.4f}, {-p.y:+.4f})")

    export_glb(objs, args.out)
    print(f"[machine] exported {args.out} ({os.path.getsize(args.out) / 1024:.0f} KB)")

    if args.preview:
        os.makedirs(args.preview, exist_ok=True)
        dress_for_preview(spec, mq_frame)
        cam = build_studio(spec)
        H = spec.H
        f = max(H / 1.9, spec.W / 0.9)
        render_preview(cam, os.path.join(args.preview, "preview-3q.png"), (-2.15 * f, -2.75 * f, 1.55 * f), (0.0, -0.05, H * 0.5), spec)
        render_preview(cam, os.path.join(args.preview, "preview-front.png"), (0.0, -3.45 * f, 1.35 * f), (0.0, 0.0, H * 0.5), spec)
        print(f"[machine] previews in {args.preview}")

    if args.blend:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(args.blend))


if __name__ == "__main__":
    main()
