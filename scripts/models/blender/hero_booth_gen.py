"""
hero_booth_gen.py — the Kontakt station as a classic yellow phone booth, at the hero machines' level (Blender 5.x).

Dennis, 2026-09-20: "bei Contact will ich eine richtige Phone Booth, so classic gelbe wie damals. Mit Glas, Interior,
alles sieht gut aus. Aber Größe sollte angepasst sein, dass es nichts überdeckt."

A booth of the yellow post-office kind: moulded yellow shell with rounded corners, rubber-gasketed panes on three
sides, a glazed door with an aluminium pull and three hinges, a lamp under the roof, and inside a wall payphone (steel
housing, handset on its hook with a coiled cord, keypad, coin slot and return cup), a shelf and the directory binder.
It is 1.95 m tall like every station, so it covers neither the wall title nor the TV; the footprint shrinks with it.

Hero pipeline as for the machines: tiling UVs + atlas, mask bake (AO / lamp light / - / wear zones), key-light shadow.
The panes are ONE mesh named `glass` (the hall gives it its enclosure glass), everything else is baked.

    blender --background --python scripts/models/blender/hero_booth_gen.py -- \\
        --out .source-assets/models-in/phone-booth-v1/phone-booth-v1.glb [--size 1024] [--no-bake] [--preview <dir>]
"""

import argparse
import math
import os
import sys

import bpy
from mathutils import Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cabinet_gen as cg  # noqa: E402
import claw_gen as cl  # noqa: E402  (wbox, loft_tube, rot, T)
import hero_gen as hg  # noqa: E402
import hero_terminal_gen as ht  # noqa: E402
from cabinet_gen import box, cylinder, grey, hex_rgb, material  # noqa: E402

W, D, H = 0.90, 0.90, 1.95
POST = 0.07
ROOF = 0.20
PLINTH = 0.06
KICK = 0.32  # height of the solid panel under the panes


def build():
    yellow = material("booth_paint", hex_rgb("#d9a400"), rough=0.42, coat=0.3)
    inner = material("booth_inner", hex_rgb("#b9b6ab"), rough=0.6)
    rubber = material("booth_rubber", grey(0.012), rough=0.75)
    steel = material("booth_metal", grey(0.55), rough=0.34, metal=1.0)
    alu = material("booth_metal_alu", grey(0.72), rough=0.3, metal=1.0)
    dark = material("booth_dark", grey(0.03), rough=0.5)
    key = material("booth_key", grey(0.62), rough=0.45)
    hole = material("booth_hole", grey(0.004), rough=0.9)
    glass = material("booth_glass", (0.2, 0.26, 0.28), rough=0.05, alpha=0.12)
    lamp = material("booth_lamp", grey(1.0), rough=0.5, emit=(1.0, 0.93, 0.8), emit_strength=4.0)
    G = {k: [] for k in ("body", "metal", "phone", "glass", "lamp")}
    b = cl.wbox

    # shell ------------------------------------------------------------------------------------------------------
    G["body"].append(b("plinth", W + 0.02, D + 0.02, PLINTH, rubber, (0, 0, PLINTH / 2), bevel=0.006, seg=2))
    mat_w = W - 2 * POST
    G["body"].append(b("mat", mat_w, D - 2 * POST, 0.008, rubber, (0, 0, PLINTH + 0.004)))
    # a ribbed rubber mat, like every booth had: raised ridges across the floor that hold the wet off your shoes
    ribs = 15
    for i in range(ribs):
        x = (i - (ribs - 1) / 2) * (mat_w - 0.03) / (ribs - 1)
        G["body"].append(b(f"mat_rib_{i}", 0.010, D - 2 * POST - 0.03, 0.005, rubber, (x, 0, PLINTH + 0.0095), bevel=0.0018, seg=1))
    post_h = H - PLINTH - ROOF
    for sx in (-1, 1):
        for sy in (-1, 1):
            G["body"].append(b(f"post_{sx}{sy}", POST, POST, post_h, yellow, (sx * (W / 2 - POST / 2), sy * (D / 2 - POST / 2), PLINTH + post_h / 2), bevel=0.014, seg=3))
    G["body"].append(b("roof", W + 0.05, D + 0.05, ROOF, yellow, (0, 0, H - ROOF / 2), bevel=0.045, seg=5))
    G["body"].append(b("ceiling", W - 2 * POST, D - 2 * POST, 0.01, inner, (0, 0, H - ROOF - 0.005)))
    G["lamp"].append(b("lamp", 0.46, 0.14, 0.02, lamp, (0, 0.05, H - ROOF - 0.02), bevel=0.004, seg=1))
    G["metal"].append(b("lamp_frame", 0.50, 0.18, 0.012, alu, (0, 0.05, H - ROOF - 0.011), bevel=0.003, seg=1))
    # no vent on the roof: a phone booth has none. The roof stays a plain rounded box.

    span = W - 2 * POST
    pane_z0, pane_z1 = PLINTH + KICK, H - ROOF - 0.05
    pane_h, pane_zc = pane_z1 - pane_z0, (pane_z0 + pane_z1) / 2

    def side(name, x, y, along_x, glazed):
        """One wall between two posts: kick panel, head rail, and a gasketed pane or a solid inner wall."""
        sx, sy = (span, 0.03) if along_x else (0.03, span)
        G["body"].append(b(f"{name}_kick", sx, sy, KICK, yellow, (x, y, PLINTH + KICK / 2), bevel=0.004, seg=1))
        G["body"].append(b(f"{name}_head", sx, sy, 0.05, yellow, (x, y, H - ROOF - 0.025), bevel=0.004, seg=1))
        if not glazed:
            G["body"].append(b(f"{name}_wall", sx if along_x else 0.02, 0.02 if along_x else sy, pane_h, yellow, (x, y, pane_zc)))
            G["body"].append(b(f"{name}_lining", (sx - 0.02) if along_x else 0.006, 0.006 if along_x else (sy - 0.02), pane_h + KICK, inner, (x, y - 0.014 if along_x else y, pane_zc - KICK / 2 + 0.0)))
            return
        g = 0.022  # rubber gasket
        for dz, hh in ((pane_h / 2 - g / 2, g), (-pane_h / 2 + g / 2, g)):
            G["body"].append(b(f"{name}_gasket_h{dz:.2f}", sx if along_x else 0.026, 0.026 if along_x else sy, hh, rubber, (x, y, pane_zc + dz), bevel=0.003, seg=1))
        for ds in (-1, 1):
            off = ds * (span / 2 - g / 2)
            G["body"].append(b(f"{name}_gasket_v{ds}", g if along_x else 0.026, 0.026 if along_x else g, pane_h, rubber, (x + off if along_x else x, y if along_x else y + off, pane_zc), bevel=0.003, seg=1))
        pane = cg.quad(f"{name}_pane", span - 2 * g, pane_h - 2 * g, glass, Matrix.Translation((x, y, pane_zc)) @ (cl.rot("X", 90) if along_x else cl.rot("Z", 90 if x > 0 else -90) @ cl.rot("X", 90)))
        G["glass"].append(pane)

    side("left", -(W / 2 - 0.02), 0, False, True)
    side("right", W / 2 - 0.02, 0, False, True)
    side("back", 0, D / 2 - 0.02, True, False)

    # the door: a frame of its own, 12 mm proud of the posts, glazed, with hinges, pull and closer -----------------------
    yd = -(D / 2 - 0.012)
    stile, rail_t, rail_b = 0.055, 0.07, 0.30
    door_w, door_z0, door_z1 = span - 0.012, PLINTH + 0.012, H - ROOF - 0.012
    door_h, door_zc = door_z1 - door_z0, (door_z0 + door_z1) / 2
    for sx in (-1, 1):
        G["body"].append(b(f"door_stile_{sx}", stile, 0.034, door_h, yellow, (sx * (door_w / 2 - stile / 2), yd, door_zc), bevel=0.006, seg=2))
    G["body"].append(b("door_top", door_w - 2 * stile, 0.034, rail_t, yellow, (0, yd, door_z1 - rail_t / 2), bevel=0.004, seg=1))
    G["body"].append(b("door_bottom", door_w - 2 * stile, 0.034, rail_b, yellow, (0, yd, door_z0 + rail_b / 2), bevel=0.004, seg=1))
    G["metal"].append(b("door_kick", door_w - 2 * stile - 0.04, 0.003, rail_b - 0.08, alu, (0, yd - 0.018, door_z0 + rail_b / 2), bevel=0.001, seg=1))
    dpw, dph = door_w - 2 * stile, door_h - rail_t - rail_b
    dpz = door_z0 + rail_b + dph / 2
    g = 0.02
    for dz in (dph / 2 - g / 2, -dph / 2 + g / 2):
        G["body"].append(b(f"door_gasket_h{dz:.2f}", dpw, 0.024, g, rubber, (0, yd, dpz + dz), bevel=0.003, seg=1))
    for ds in (-1, 1):
        G["body"].append(b(f"door_gasket_v{ds}", g, 0.024, dph, rubber, (ds * (dpw / 2 - g / 2), yd, dpz), bevel=0.003, seg=1))
    G["glass"].append(cg.quad("door_pane", dpw - 2 * g, dph - 2 * g, glass, Matrix.Translation((0, yd, dpz)) @ cl.rot("X", 90)))
    hx = door_w / 2 - stile / 2
    G["metal"].append(cylinder("pull", 0.011, 0.34, alu, Matrix.Translation((hx, yd - 0.052, 1.08)), segs=20, bevel=0.003, bevel_seg=2))
    for dz in (-0.13, 0.13):
        G["metal"].append(cylinder(f"pull_post_{dz}", 0.007, 0.036, alu, Matrix.Translation((hx, yd - 0.034, 1.08 + dz)) @ cl.rot("X", 90), segs=14))
    for z in (0.35, 1.0, 1.6):
        G["metal"].append(cylinder(f"hinge_{z}", 0.011, 0.09, alu, Matrix.Translation((-door_w / 2 - 0.002, yd - 0.016, z)), segs=16, bevel=0.002, bevel_seg=1))
        # the knuckle's two leaves: one screwed to the door stile, one to the post behind it
        G["metal"].append(b(f"hinge_leaf_d_{z}", 0.038, 0.004, 0.082, alu, (-door_w / 2 + 0.018, yd - 0.018, z), bevel=0.0012, seg=1))
        G["metal"].append(b(f"hinge_leaf_p_{z}", 0.006, 0.040, 0.082, alu, (-door_w / 2 - 0.010, yd + 0.006, z), bevel=0.0012, seg=1))
    G["metal"].append(b("closer", 0.24, 0.045, 0.05, alu, (-door_w / 2 + 0.18, yd + 0.04, door_z1 - 0.03), bevel=0.006, seg=2))
    # the closer's arm: the main link off its spindle, the forearm bent back from the elbow, and the shoe that
    # holds it to the bracket under the roof — the piece that makes a booth door fall shut
    cz = door_z1 - 0.03
    P0 = (-door_w / 2 + 0.29, yd + 0.040)
    P1 = (P0[0] + 0.124, yd + 0.108)
    P2 = (P1[0] + 0.110, yd + 0.088)

    def link(name, a, bb, w, z):
        ang = math.atan2(bb[1] - a[1], bb[0] - a[0])
        m = Matrix.Translation(((a[0] + bb[0]) / 2, (a[1] + bb[1]) / 2, z)) @ Matrix.Rotation(ang, 4, "Z")
        return box(name, math.hypot(bb[0] - a[0], bb[1] - a[1]), w, w * 0.9, alu, m, bevel=w * 0.22, seg=1)

    G["metal"].append(cylinder("closer_spindle", 0.013, 0.030, alu, Matrix.Translation((P0[0], P0[1], cz)), segs=16, bevel=0.002, bevel_seg=1))
    G["metal"].append(link("closer_arm", P0, P1, 0.016, cz + 0.012))
    G["metal"].append(cylinder("closer_elbow", 0.011, 0.022, alu, Matrix.Translation((P1[0], P1[1], cz + 0.012)), segs=14, bevel=0.0018, bevel_seg=1))
    G["metal"].append(link("closer_forearm", P1, P2, 0.014, cz + 0.024))
    G["metal"].append(b("closer_shoe", 0.026, 0.034, 0.024, alu, (P2[0], P2[1], cz + 0.024), bevel=0.003, seg=1))
    G["metal"].append(b("closer_bracket", 0.030, 0.038, H - ROOF - 0.005 - (cz + 0.032), alu, (P2[0], P2[1], (cz + 0.036 + H - ROOF - 0.005) / 2), bevel=0.002, seg=1))

    # the payphone on the back wall ------------------------------------------------------------------------------------
    yb = D / 2 - 0.03 - 0.014  # face of the inner lining
    px, pz, pw, ph, pd = 0.0, 1.30, 0.30, 0.48, 0.13
    G["phone"].append(b("housing", pw, pd, ph, steel, (px, yb - pd / 2, pz), bevel=0.012, seg=3))
    yf = yb - pd  # front face of the housing (towards the door)
    G["phone"].append(b("coin_plate", 0.10, 0.004, 0.06, dark, (px + 0.07, yf - 0.002, pz + ph / 2 - 0.06), bevel=0.0015, seg=1))
    G["phone"].append(b("coin_slot", 0.004, 0.002, 0.032, hole, (px + 0.07, yf - 0.0045, pz + ph / 2 - 0.06)))
    G["phone"].append(b("display", 0.13, 0.004, 0.04, dark, (px + 0.055, yf - 0.002, pz + 0.085), bevel=0.0015, seg=1))
    for r in range(4):
        for c in range(3):
            G["phone"].append(b(f"key_{r}{c}", 0.026, 0.007, 0.02, key, (px + 0.02 + c * 0.035, yf - 0.0035, pz + 0.03 - r * 0.028), bevel=0.002, seg=1))
    # the coin box is a door of its own in the bottom of the housing, with the lock the collector opens it by
    G["phone"].append(b("coinbox_door", pw - 0.014, 0.005, 0.088, steel, (px, yf - 0.0025, pz - ph / 2 + 0.049), bevel=0.0025, seg=1))
    G["phone"].append(b("return_cup", 0.09, 0.03, 0.05, dark, (px + 0.07, yf - 0.012, pz - ph / 2 + 0.05), bevel=0.006, seg=2))
    G["phone"].append(b("return_hole", 0.07, 0.004, 0.028, hole, (px + 0.07, yf - 0.0275, pz - ph / 2 + 0.052)))
    G["phone"].append(cylinder("lock", 0.0105, 0.005, alu, Matrix.Translation((px - 0.065, yf - 0.0065, pz - ph / 2 + 0.049)) @ cl.rot("X", 90), segs=18, bevel=0.0015, bevel_seg=1))
    G["phone"].append(b("lock_keyway", 0.0022, 0.002, 0.0085, hole, (px - 0.065, yf - 0.0096, pz - ph / 2 + 0.049)))
    # handset on its hook, left of the keypad; the coiled cord falls in a loop to the housing's underside
    hxp, hz = px - 0.095, pz + 0.04
    G["phone"].append(b("hook", 0.05, 0.03, 0.02, dark, (hxp, yf - 0.015, hz + 0.085), bevel=0.004, seg=1))
    G["phone"].append(b("handset_grip", 0.034, 0.03, 0.17, dark, (hxp, yf - 0.035, hz), bevel=0.012, seg=3))
    for dz in (-0.095, 0.095):
        G["phone"].append(cylinder(f"handset_cap_{dz}", 0.029, 0.04, dark, Matrix.Translation((hxp, yf - 0.03, hz + dz)) @ cl.rot("X", 90), segs=24, bevel=0.006, bevel_seg=2))
    pts, radii = [], []
    for i in range(41):
        t = i / 40
        x = hxp + (px - 0.10 - hxp) * t + 0.012 * math.sin(t * 40)
        y = yf - 0.03 + 0.012 * math.cos(t * 40)
        z = (hz - 0.13) - 0.30 * math.sin(math.pi * t) * (1 - 0.25 * t) + (pz - ph / 2 - (hz - 0.13)) * t
        pts.append((x, y, z))
        radii.append(0.0032)
    G["phone"].append(cl.loft_tube("cord", pts, radii, (0, 1, 0), dark, segs=6))
    # shelf and the directory binder hanging under it
    G["metal"].append(b("shelf", 0.56, 0.20, 0.012, alu, (0, yb - 0.10, 0.93), bevel=0.003, seg=1))
    for sx in (-1, 1):
        G["metal"].append(b(f"shelf_arm_{sx}", 0.012, 0.18, 0.05, alu, (sx * 0.27, yb - 0.09, 0.90), bevel=0.002, seg=1))
    G["phone"].append(b("binder", 0.24, 0.05, 0.30, dark, (-0.12, yb - 0.05, 0.75), bevel=0.006, seg=2))
    G["metal"].append(b("binder_rail", 0.30, 0.012, 0.012, alu, (-0.12, yb - 0.05, 0.915)))
    return G


def finish(G):
    for objs in G.values():
        for ob in objs:
            if ob.modifiers:
                cg.apply_modifiers(ob)
    joined = {key: cg.join_objects(objs, key) for key, objs in G.items() if objs}
    objs = list(joined.values())
    with bpy.context.temp_override(active_object=objs[0], selected_objects=objs, selected_editable_objects=objs):
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.context.view_layer.update()
    return objs


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--size", type=int, default=1024)
    ap.add_argument("--preview", default=None)
    ap.add_argument("--no-bake", action="store_true")
    args = ap.parse_args(argv)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    cg.COLL = bpy.data.collections.new("booth")
    bpy.context.scene.collection.children.link(cg.COLL)
    bpy.context.scene.unit_settings.system = "METRIC"

    # a booth that stood outside for years: weathered edges, kicked door bottom, a worn zone around the pull, dust on the roof
    ht.configure({"width": W, "depth": D, "shelf_z": 1.0, "seed": "booth",
                  "wear": {"edge": 0.85, "hands": 0.0, "shoes": 0.5, "knees": 0.0, "crevice": 1.0, "low": 0.9, "dust": 0.6, "corners": 0.3, "door": 0.4, "door_z": 1.08}})
    ht.importance = lambda ob, poly: 0.0 if ((ob.matrix_world.to_3x3() @ poly.normal).z < -0.5 and (ob.matrix_world @ poly.center).z < 0.03) else 1.0
    hg.SCREEN_EMITTERS = ("booth_lamp",)
    hg.BRAND_EMITTERS = ("mach_led",)
    hg.SKIP_BAKE = ("glass",)

    objs = finish(build())
    targets = [ob for ob in objs if ob.name not in hg.SKIP_BAKE]
    for ob in targets:
        hg.ensure_uv_order(ob)
        hg.box_project_unit(ob)
    ht.unwrap_atlas_weighted(targets)
    print(f"[hero] booth: {sum(cg.tri_count(ob) for ob in objs)} tris, {len(objs)} meshes ({', '.join(ob.name for ob in objs)})")

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    if not args.no_bake:
        hg.bake_mask(objs, args.size, os.path.abspath(args.out)[:-4] + "-mask.png")
        ht.bake_key_shadow(objs, args.size // 2, os.path.abspath(args.out)[:-4] + "-light.png")
        # rounded edges, as on the terminals. After bake_mask: its floor plane would bevel the plinth away.
        hg.bake_bevel_normal(objs, args.size, os.path.abspath(args.out)[:-4] + "-normal.png")
    cg.export_glb(objs, args.out)
    print(f"[hero] exported {args.out} ({os.path.getsize(args.out) / 1024:.0f} KB)")

    if args.preview:
        os.makedirs(args.preview, exist_ok=True)

        class S:
            H, W, D = 1.95, 0.9, 0.9
            name = "booth"
        cam = cg.build_studio(S)
        cg.render_preview(cam, os.path.join(args.preview, "booth-3q.png"), (-2.3, -2.9, 1.6), (0.0, -0.05, H * 0.5), S)
        cg.render_preview(cam, os.path.join(args.preview, "booth-top.png"), (-0.75, -1.45, 1.90), (0.0, 0.10, 1.66), S)
        cg.render_preview(cam, os.path.join(args.preview, "booth-floor.png"), (-0.55, -1.35, 0.95), (0.0, 0.10, 0.20), S)


if __name__ == "__main__":
    main()
