"""
hero_claw_gen.py — the "Über mich" claw machine at the hero machines' level of detail (Blender 5.x, headless).

Dennis, 2026-09-20: the claw machine needs a much higher quality model, like the arcades, so that everything fits:
far more realistic, far more detail, and WITHOUT the "Über mich" sign on top (the wall names the station).

claw_gen.py stays the source of the moving parts and of the mesh-name contract with hallScene.buildKasse (glass, floor,
disc, carriage, claw, lamp, led, joy, btn ...). This file takes its machine and
    removes the marquee and lowers the header to a plain cap,
    opens the base's front and closes it with ONE panel whose details are cut into it (hero rule): a deep prize
    chute behind its flap, a coin door with two real coin mechs, a cam lock, stamped speaker slots,
    adds what a real crane has: a gantry motor with end stops and a cable loop, LED bars inside the front posts,
    post caps, kick-plate screws, leg levellers,
and then runs the hero pipeline: tiling UVs + visibility-free atlas, mask bake (AO / interior lamp light / brand
light / wear zones), key-light shadow bake.

    blender --background --python scripts/models/blender/hero_claw_gen.py -- \\
        --spec .source-assets/models-in/claw-v2/spec.json --out .source-assets/models-in/claw-v2/claw-v2.glb \\
        [--size 1024] [--no-bake] [--preview <dir>]
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
import claw_gen as cl  # noqa: E402
import hero_gen as hg  # noqa: E402
import hero_terminal_gen as ht  # noqa: E402  (panel builder, coin mechs, wear zones, atlas, key shadow)
from cabinet_gen import at, box, cylinder, grey, material, seg_frame  # noqa: E402
from hero_terminal_gen import ring, slots  # noqa: E402

REMOVE = ("mq_surround", "mq_retainer", "mq_clip", "canopy")


def open_front(ob, y_front):
    """Delete the faces of a box that look at the player, so a recessed panel can take their place."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    doomed = [f for f in bm.faces if f.normal.y < -0.9 and abs(f.calc_center_median().y - y_front) < 1e-3]
    bmesh.ops.delete(bm, geom=doomed, context="FACES")
    bm.to_mesh(ob.data)
    bm.free()


def build(s, wear_img):
    G, info = cl.build(s, wear_img)
    W, D, H = s.W, s.D, s.H
    base_top, top0 = s.base_h, H - s.top_h

    # --- what goes -----------------------------------------------------------------------------------------------
    for key in ("marquee", "front_art", "coin", "chute"):
        for ob in G.pop(key, []):
            bpy.data.objects.remove(ob)
    for key in list(G):
        keep = []
        for ob in G[key]:
            if ob.name.split(".")[0] in REMOVE or ob.name.startswith("chute_flap"):
                bpy.data.objects.remove(ob)
            else:
                keep.append(ob)
        G[key] = keep
    for key in ("metal", "controls"):
        G[key] = []

    M = {
        "paint": bpy.data.materials["claw_paint"], "hole": bpy.data.materials["claw_hole"], "dark": bpy.data.materials["claw_dark"],
        "accent": bpy.data.materials["claw_accent"], "chrome": bpy.data.materials["claw_chrome"], "metal": bpy.data.materials["claw_metal"],
        "glass": bpy.data.materials["claw_glass"], "lamp": bpy.data.materials["claw_lamp"],
        "dark_metal": material("claw_metal_dark", grey(0.12), rough=0.5, metal=1.0),
        "door": material("claw_metal_door", grey(0.10), rough=0.5, metal=1.0),
        "led": material("mach_led", grey(0.004), rough=0.9, emit=s.accent, emit_strength=0.3),
    }

    # --- header: no sign, no vents (a crane has none up there). A plain low cap; the brand seam under it stays -------
    cap_h = s.top_h
    G["body"].append(cl.wbox("cap", W + 0.04, D + 0.04, cap_h, M["paint"], (0, 0, top0 + cap_h / 2), bevel=0.014, seg=3))

    # --- base front: one panel, everything cut into it ------------------------------------------------------------
    base = next(ob for ob in G["body"] if ob.name.split(".")[0] == "base")
    open_front(base, -D / 2)
    F, _ = seg_frame((-D / 2, 0.0), (-D / 2, 1.0))
    y0 = 0.05
    Lp = base_top - y0 - 0.004  # the whole front: the ledge and the LED strip sit in front of it
    PF = at(F, 0, y0, -0.0005)
    hx, hy, ch_w, ch_h = -0.20, 0.31 - y0, 0.27, 0.23  # prize chute, left
    cx, cy, dw, dh = 0.215, 0.33 - y0, 0.30, 0.30  # coin door, right
    rec = [(hx, hy, ch_w + 0.05, ch_h + 0.05, 0.004, M["dark"]), (hx, hy, ch_w, ch_h, 0.085, M["hole"])]
    rec += [(cx, cy, dw, dh, 0.002, M["door"])] + ring(cx, cy, dw, dh, 0.003, 0.007, M["hole"])
    for sx in (-1, 1):
        rec += [(cx + sx * 0.068, cy - 0.085, 0.062, 0.042, 0.016, M["hole"])]
    rec += slots(hx, hy + ch_h / 2 + 0.07, 0.24, 4, 0.012, 0.005, 0.007, M["hole"])  # the machine's speaker
    G["body"].append(ht.panel("front", PF, Lp, M["paint"], rec, width=W - 0.026))
    ht.coin_mechs(G["metal"], G["controls"], M, at(PF, cx, 0, 0), cy)
    ht.door_hardware(G["metal"], G["controls"], M, PF, cx, cy, dw, dh, -0.002, hinge=0.046)
    ly = cy + dh / 2 - 0.028
    G["metal"].append(cylinder("lock_collar", 0.011, 0.004, M["chrome"], at(PF, cx, ly, 0.0002), segs=24, bevel=0.0012, bevel_seg=2))
    G["metal"].append(cylinder("lock_core", 0.007, 0.003, M["metal"], at(PF, cx, ly, 0.0028), segs=20, bevel=0.0008, bevel_seg=1))
    G["controls"].append(box("lock_slot", 0.0018, 0.008, 0.001, M["hole"], at(PF, cx, ly, 0.0045)))
    # the chute: a clear flap hinged at the top, ajar, and the push bar people reach for
    flap_h = ch_h - 0.008
    G["glass"].append(box("chute_flap", ch_w - 0.008, flap_h, 0.004, M["glass"], at(PF, hx, hy + ch_h / 2 - 0.002, -0.004) @ cl.rot("X", -5) @ cl.T(0, -flap_h / 2, 0)))
    G["metal"].append(box("push_bar", 0.20, 0.018, 0.006, M["dark_metal"], at(PF, hx, hy - ch_h / 2 + 0.02, 0.012), bevel=0.002, seg=1))
    for sx in (-1, 1):
        G["metal"].append(cylinder(f"flap_hinge_{sx}", 0.004, 0.014, M["metal"], at(PF, hx + sx * (ch_w / 2 - 0.02), hy + ch_h / 2 + 0.004, 0.002, cl.rot("Y", 90)), segs=12))
        # the knuckle's two leaves: one screwed to the frame above the opening, one to the flap
        G["metal"].append(box(f"flap_leaf_f_{sx}", 0.030, 0.014, 0.0026, M["dark_metal"], at(PF, hx + sx * (ch_w / 2 - 0.02), hy + ch_h / 2 + 0.013, 0.0015), bevel=0.0008, seg=1))
        G["metal"].append(box(f"flap_leaf_d_{sx}", 0.030, 0.016, 0.0024, M["dark_metal"], at(PF, hx + sx * (ch_w / 2 - 0.02), hy + ch_h / 2 - 0.008, -0.0035), bevel=0.0008, seg=1))
    # the stop the flap falls back against, and the staple the attendant padlocks it to
    G["metal"].append(box("flap_stop", 0.22, 0.010, 0.010, M["dark_metal"], at(PF, hx, hy - ch_h / 2 - 0.009, 0.004), bevel=0.0022, seg=2))
    G["metal"].append(cylinder("chute_lock_collar", 0.010, 0.004, M["chrome"], at(PF, hx + ch_w / 2 + 0.018, hy, 0.0002), segs=24, bevel=0.0012, bevel_seg=2))
    G["metal"].append(cylinder("chute_lock_core", 0.0065, 0.003, M["metal"], at(PF, hx + ch_w / 2 + 0.018, hy, 0.0026), segs=20, bevel=0.0008, bevel_seg=1))
    G["controls"].append(box("chute_lock_slot", 0.0018, 0.0075, 0.001, M["hole"], at(PF, hx + ch_w / 2 + 0.018, hy, 0.0042)))
    # kick plate screws, leg levellers
    for i in range(4):
        G["metal"].append(cylinder(f"kick_screw_{i}", 0.0042, 0.002, M["metal"], at(F, (W - 0.06) * (-0.375 + 0.25 * i), 0.105, 0.0055), segs=16, bevel=0.0008, bevel_seg=1))
    for sx in (-1, 1):
        for sy in (-1, 1):
            G["metal"].append(cylinder(f"leveller_{sx}{sy}", 0.02, 0.012, M["metal"], Matrix.Translation((sx * (W / 2 - 0.09), sy * (D / 2 - 0.09), 0.006)), segs=20, bevel=0.002, bevel_seg=1))

    # --- the glass box: post caps, LED bars inside the front posts (they bake into the lamp channel) ----------------
    post_r = 0.0225
    for sx in (-1, 1):
        for sy in (-1, 1):
            G["chrome"].append(cylinder(f"post_cap_{sx}{sy}", post_r + 0.004, 0.006, M["chrome"], Matrix.Translation((sx * (W / 2 - post_r), sy * (D / 2 - post_r), base_top + 0.033)), segs=24, bevel=0.0015, bevel_seg=1))
        G["lamp"].append(cl.wbox(f"post_light_{sx}", 0.012, 0.006, top0 - base_top - 0.16, M["lamp"], (sx * (W / 2 - 2 * post_r - 0.012), -(D / 2 - 2 * post_r - 0.004), (top0 + base_top) / 2)))

    # --- gantry: what drives it --------------------------------------------------------------------------------------
    rail_y, rail_z = 0.19, top0 - 0.038
    G["gantry"].append(cl.wbox("motor", 0.085, 0.06, 0.05, M["dark_metal"], (W / 2 - 0.13, rail_y, rail_z + 0.002), bevel=0.004, seg=1))
    G["gantry"].append(cylinder("motor_can", 0.021, 0.06, M["metal"], Matrix.Translation((W / 2 - 0.20, rail_y, rail_z + 0.002)) @ cl.rot("Y", 90), segs=20, bevel=0.002, bevel_seg=1))
    for sx in (-1, 1):
        for sy in (-1, 1):
            G["gantry"].append(cylinder(f"end_stop_{sx}{sy}", 0.016, 0.012, M["dark"], Matrix.Translation((sx * (W / 2 - 0.125), sy * rail_y, rail_z)) @ cl.rot("Y", 90), segs=16))
    loop = [(W / 2 - 0.16, rail_y - 0.03, rail_z + 0.03), (0.18, rail_y - 0.05, rail_z + 0.035), (0.08, 0.06, rail_z + 0.03), (0.02, 0.0, rail_z + 0.012)]
    G["gantry"].append(cl.loft_tube("cable_loop", loop, [0.004] * len(loop), (0, 0, 1), M["dark"], segs=8))
    # what actually pulls the bridge along the rear rail: a motor pulley on an extended shaft, an idler at the far
    # end, the two runs of the toothed belt between them, and the limit switch the bridge trips at the end
    bx0, bx1, by = -(W / 2 - 0.135), W / 2 - 0.13, rail_y + 0.065
    G["gantry"].append(cylinder("belt_shaft", 0.005, 0.075, M["metal"], Matrix.Translation((bx1, rail_y + 0.028, rail_z)) @ cl.rot("X", 90), segs=12))
    G["gantry"].append(cylinder("belt_drive", 0.0175, 0.011, M["chrome"], Matrix.Translation((bx1, by, rail_z)) @ cl.rot("X", 90), segs=20, bevel=0.0012, bevel_seg=1))
    G["gantry"].append(cylinder("belt_idler", 0.0155, 0.011, M["metal"], Matrix.Translation((bx0, by, rail_z)) @ cl.rot("X", 90), segs=20, bevel=0.0012, bevel_seg=1))
    G["gantry"].append(cl.wbox("idler_bracket", 0.024, 0.034, 0.046, M["dark"], (bx0 - 0.016, by, rail_z), bevel=0.002, seg=1))
    for dz in (0.0165, -0.0165):
        G["gantry"].append(cl.wbox(f"belt_run_{dz > 0}", bx1 - bx0, 0.010, 0.0026, M["dark"], ((bx0 + bx1) / 2, by, rail_z + dz)))
    G["gantry"].append(cl.wbox("limit_body", 0.030, 0.020, 0.022, M["dark"], (bx0 + 0.036, by, rail_z - 0.034), bevel=0.002, seg=1))
    G["gantry"].append(cl.wbox("limit_lever", 0.030, 0.004, 0.003, M["metal"], (bx0 + 0.062, by, rail_z - 0.026), bevel=0.001, seg=1))
    # the cable the bridge drags with it runs TIGHT along the rear rail (clipped to it), never hanging into the box
    fest = [(bx1 - 0.02, rail_y + 0.085, rail_z - 0.004), (bx1 - 0.20, rail_y + 0.086, rail_z - 0.004), (bx1 - 0.38, rail_y + 0.086, rail_z - 0.004), (bx1 - 0.56, rail_y + 0.085, rail_z - 0.004)]
    G["gantry"].append(cl.loft_tube("festoon", fest, [0.0042] * len(fest), (0, 0, 1), M["dark"], segs=8))

    info["M"] = M
    return G, info


def finish(G, pivots):
    for objs in G.values():
        for ob in objs:
            if ob.modifiers:
                cg.apply_modifiers(ob)
    joined = {key: cg.join_objects(objs, key) for key, objs in G.items() if objs}
    objs = list(joined.values())
    with bpy.context.temp_override(active_object=objs[0], selected_objects=objs, selected_editable_objects=objs):
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for name, pivot in pivots.items():
        ob = joined[name]
        if pivot is None:
            lo, hi = cl.world_bbox(ob)
            pivot = (lo + hi) / 2
        ob.data.transform(Matrix.Translation(-Vector(pivot)))
        ob.location = pivot
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
    s = cl.Spec(raw)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    cg.COLL = bpy.data.collections.new("claw")
    bpy.context.scene.collection.children.link(cg.COLL)
    bpy.context.scene.unit_settings.system = "METRIC"

    # wear zones and the atlas come from the terminal generator; tell it where this machine's shelf and front are
    ht.configure({"width": s.W, "depth": s.D, "shelf_z": s.base_h - 0.075, "seed": "claw",
                  "wear": {"edge": 0.7, "hands": 0.6, "shoes": 0.35, "knees": 0.0, "crevice": 0.9, "low": 0.6, "dust": 0.45, "corners": 0.0, "door": 0.35, "door_z": 0.31}})
    ht.importance = lambda ob, poly: 0.0 if ((ob.matrix_world.to_3x3() @ poly.normal).z < -0.5 and (ob.matrix_world @ poly.center).z < 0.05) else 1.0
    hg.SCREEN_EMITTERS = ("claw_lamp",)
    hg.BRAND_EMITTERS = ("claw_led", "claw_accent", "mach_led")
    hg.SKIP_BAKE = ("glass", "side_art_l", "side_art_r")

    G, info = build(s, None)
    pivots = dict(info["pivots"])
    for name in ("carriage", "claw", "disc"):
        pivots.setdefault(name, info.get("claw_origin") if name == "claw" else None)
    objs = finish(G, pivots)
    targets = [ob for ob in objs if ob.name not in hg.SKIP_BAKE]
    for ob in targets:
        hg.ensure_uv_order(ob)
        hg.box_project_unit(ob)
    ht.unwrap_atlas_weighted(targets)
    print(f"[hero] claw: {sum(cg.tri_count(ob) for ob in objs)} tris, {len(objs)} meshes ({', '.join(ob.name for ob in objs)})")

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
        cam = cg.build_studio(s)
        cg.render_preview(cam, os.path.join(args.preview, "claw-3q.png"), (-2.3, -2.9, 1.6), (0.0, -0.05, s.H * 0.5), s)


if __name__ == "__main__":
    main()
