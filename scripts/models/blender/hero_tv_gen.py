"""
hero_tv_gen.py — the ceiling track, the trolley and the hanging TV as real hardware (Blender 5.x, headless).

Dennis, 2026-09-20: "Oben die Rails bei dem TV sollten auch neu gemacht werden, viel realistischer, bessere Qualität,
genau so wie der Fernseher selbst. Alles auf dem selben Level wie die neuen Arcades."

Until now hallScene.buildTv drew all of it from boxes. This file builds the parts the scene assembles:

    rail      ONE metre of track, tiled along the hall: two slotted strut channels, each hung from its outer side by an
              angle bracket and a threaded rod going up into the dark (nothing crosses above: the trolley runs there)
    carriage  the trolley: deck plate, cheek plates, axle bolts, a drive motor with its gearbox, a cable clamp
    wheel     one flanged steel wheel, axle along X, origin at its centre (the scene places four and turns them)
    arm       the drop tube with its flange and the tilt bracket
    tv        the display: back shell, a slim chamfered bezel around the opening, a chin with stamped speaker slots,
              the mount plate. The picture, the LED and the light stay the scene's.

Coordinates: Blender Z-up, the viewer looks along +Y (front = -Y). Every part is modelled around its own origin in the
scene's terms (see buildTv): rail and carriage around the track's centre line, arm and tv around the hang pivot.
All parts are baked together (AO, the screen's light on the bezel, wear zones) at their working distances; the rail
stands 3 m aside for the bake so the trolley does not shade one particular metre of it.

    blender --background --python scripts/models/blender/hero_tv_gen.py -- \\
        --out .source-assets/models-in/tv-rig-v1/tv-rig-v1.glb [--size 1024] [--no-bake]
"""

import argparse
import math
import os
import sys

import bpy
from mathutils import Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cabinet_gen as cg  # noqa: E402
import claw_gen as cl  # noqa: E402
import hero_gen as hg  # noqa: E402
import hero_terminal_gen as ht  # noqa: E402
from cabinet_gen import cylinder, grey, material  # noqa: E402

# buildTv's numbers
TV_W, TV_H, TV_CY = 1.85, 1.15625, -0.76
RAIL_GAP = 0.09  # rails at +-0.09 from the centre line
WHEEL_R = 0.055


def T(x, y, z):
    return Matrix.Translation((x, y, z))


def build():
    steel = material("rig_metal", grey(0.30), rough=0.38, metal=1.0)
    zinc = material("rig_metal_zinc", grey(0.55), rough=0.42, metal=1.0)
    dark = material("rig_paint", grey(0.02), rough=0.5)
    shell = material("rig_shell", grey(0.015), rough=0.55)
    bezel = material("rig_bezel_gloss", grey(0.012), rough=0.2)
    hole = material("rig_hole", grey(0.004), rough=0.9)
    rubber = material("rig_rubber", grey(0.012), rough=0.7)
    b = cl.wbox
    G = {k: [] for k in ("rail", "carriage", "wheel", "arm", "tv")}

    # --- one metre of track (origin: centre line, top of the rails at z = +0.025) ---------------------------------------
    for sy in (-1, 1):
        y = sy * RAIL_GAP
        G["rail"].append(b(f"channel_{sy}", 1.0, 0.041, 0.05, steel, (0, y, 0), bevel=0.003, seg=1))
        G["rail"].append(b(f"channel_lip_{sy}", 1.0, 0.018, 0.004, hole, (0, y, -0.0235)))  # the strut's open slot, underneath
        for i in range(5):  # the slotted holes of a strut channel, along its outer side
            G["rail"].append(b(f"slot_{sy}_{i}", 0.05, 0.002, 0.012, hole, (-0.4 + i * 0.2, y + sy * 0.0206, 0)))
        # a strut channel comes in lengths and is spliced: half a splice plate with its two bolts at each end of
        # the metre, so the two halves meet as one plate over the joint wherever the rail tiles
        for sx in (-1, 1):
            G["rail"].append(b(f"splice_{sy}_{sx}", 0.088, 0.004, 0.038, zinc, (sx * 0.455, y + sy * 0.0225, 0), bevel=0.0015, seg=1))
            for dx in (0.016, 0.052):  # turned heads, not bevelled cylinders: the rail is instanced along the whole hall
                G["rail"].append(ht.dome_head(f"splice_bolt_{sy}_{sx}_{dx}", T(sx * (0.5 - dx), y + sy * 0.0245, 0) @ cl.rot("X", -sy * 90), 0, 0, 0, 0.0055, 0.004, zinc, steps=8))
    # the supply the trolley drags: a cable clipped along the outer face of the near channel, level across the joints
    cy_, cz_ = -(RAIL_GAP + 0.042), -0.034
    G["rail"].append(cylinder("track_cable", 0.005, 1.0, rubber, T(0, cy_, cz_) @ cl.rot("Y", 90), segs=10))
    G["rail"].append(b("cable_clip", 0.012, 0.030, 0.008, zinc, (0.25, cy_ + 0.011, cz_ + 0.004), bevel=0.0015, seg=1))
    G["rail"].append(b("cable_clip_web", 0.012, 0.005, 0.026, zinc, (0.25, -(RAIL_GAP + 0.0225), cz_ + 0.017), bevel=0.0012, seg=1))
    # hung from the OUTSIDE: the trolley runs on top of the channels and its deck spans them, so nothing may cross above
    for sy in (-1, 1):
        yo = sy * (RAIL_GAP + 0.0205)
        G["rail"].append(b(f"hanger_{sy}", 0.05, 0.07, 0.006, zinc, (0, yo + sy * 0.035, -0.012), bevel=0.0015, seg=1))
        G["rail"].append(b(f"hanger_web_{sy}", 0.05, 0.006, 0.04, zinc, (0, yo + sy * 0.003, 0.0), bevel=0.0015, seg=1))
        for dx in (-0.014, 0.014):
            G["rail"].append(cylinder(f"hanger_bolt_{sy}_{dx}", 0.005, 0.005, zinc, T(dx, yo + sy * 0.0075, 0.0) @ cl.rot("X", 90), segs=6))
        yr = yo + sy * 0.055
        G["rail"].append(cylinder(f"rod_{sy}", 0.005, 0.9, zinc, T(0, yr, -0.012 + 0.45), segs=10))
        G["rail"].append(cylinder(f"rod_nut_{sy}", 0.0095, 0.009, zinc, T(0, yr, -0.004), segs=6))
        G["rail"].append(cylinder(f"rod_nut_b_{sy}", 0.0095, 0.009, zinc, T(0, yr, -0.0195), segs=6))

    # --- trolley (origin: centre line, axle height z = 0) -----------------------------------------------------------------
    G["carriage"].append(b("deck", 0.46, 0.30, 0.012, dark, (0, 0, -0.045), bevel=0.003, seg=1))
    for sy in (-1, 1):
        G["carriage"].append(b(f"cheek_{sy}", 0.44, 0.008, 0.10, dark, (0, sy * (RAIL_GAP + 0.045), -0.005), bevel=0.002, seg=1))
        for sx in (-1, 1):
            G["carriage"].append(cylinder(f"axle_{sx}{sy}", 0.009, 0.05, zinc, T(sx * 0.17, sy * (RAIL_GAP + 0.03), 0) @ cl.rot("X", 90), segs=6))
    G["carriage"].append(b("motor", 0.11, 0.075, 0.075, dark, (0.11, 0, -0.09), bevel=0.006, seg=2))
    G["carriage"].append(cylinder("motor_can", 0.03, 0.09, steel, T(0.215, 0, -0.09) @ cl.rot("Y", 90), segs=20, bevel=0.003, bevel_seg=1))
    G["carriage"].append(b("gearbox", 0.05, 0.10, 0.05, steel, (0.03, 0, -0.085), bevel=0.004, seg=1))
    G["carriage"].append(b("cable_clamp", 0.03, 0.05, 0.02, zinc, (-0.17, 0.11, -0.06), bevel=0.002, seg=1))
    pts = [(-0.17, 0.11, -0.07), (-0.22, 0.13, -0.16), (-0.12, 0.10, -0.24), (-0.03, 0.04, -0.20), (0.0, 0.035, -0.12)]
    G["carriage"].append(cl.loft_tube("cable", pts, [0.006] * len(pts), (0, 0, 1), rubber, segs=8))

    # --- one wheel: axle along X, flanged like a crane wheel --------------------------------------------------------------
    wheel = ht.lathe("wheel_tread", Matrix.Rotation(math.radians(90), 4, "Y"), [
        (steel, [(0.0, -0.016), (0.02, -0.016), (WHEEL_R + 0.008, -0.014), (WHEEL_R + 0.008, -0.009), (WHEEL_R, -0.008), (WHEEL_R, 0.014), (0.02, 0.016), (0.0, 0.016)]),
    ], steps=28)
    G["wheel"].append(wheel)
    G["wheel"].append(cylinder("wheel_hub", 0.014, 0.036, zinc, cl.rot("Y", 90), segs=6))

    # --- drop tube (origin: the hang pivot; the scene's arm ran from 0 to -0.30) -------------------------------------------
    G["arm"].append(cylinder("tube", 0.024, 0.30, steel, T(0, 0, -0.15), segs=24))
    G["arm"].append(cylinder("flange", 0.06, 0.008, zinc, T(0, 0, -0.004), segs=28, bevel=0.002, bevel_seg=1))
    for k in range(4):
        a = math.radians(45 + 90 * k)
        G["arm"].append(cylinder(f"flange_bolt_{k}", 0.006, 0.006, zinc, T(math.cos(a) * 0.044, math.sin(a) * 0.044, -0.011), segs=6))
    G["arm"].append(b("tilt_bracket", 0.16, 0.05, 0.07, dark, (0, 0.0, -0.30), bevel=0.006, seg=2))
    G["arm"].append(cylinder("tilt_pin", 0.008, 0.19, zinc, T(0, 0, -0.30) @ cl.rot("Y", 90), segs=10))

    # --- the display (origin: the hang pivot; centre of the picture at z = TV_CY, picture plane y = -0.045) -------------------
    bw, bh = TV_W + 0.06, TV_H + 0.06 + 0.035  # a slim bezel, and a chin under the picture
    cz = TV_CY - 0.0175
    G["tv"].append(b("back", bw - 0.02, 0.06, bh - 0.02, shell, (0, 0.0, cz), bevel=0.02, seg=3))
    F = T(0, -0.03, cz) @ cl.rot("X", 90)
    G["tv"].append(cg.frame_plate("bezel", bw, bh, TV_W, TV_H, 0.018, -0.002, 0.014, bezel, F, bevel=0.004, seg=2, inner_bevel=0.002, hole_dy=0.0175))
    for i in range(18):  # the chin's speaker slots
        G["tv"].append(b(f"chin_slot_{i}", 0.05, 0.002, 0.004, hole, (-0.72 + i * 0.085, -0.0485, TV_CY - TV_H / 2 - 0.036)))
    G["tv"].append(b("mount_plate", 0.44, 0.012, 0.30, zinc, (0, 0.036, TV_CY + 0.30), bevel=0.003, seg=1))
    G["tv"].append(b("mount_spine", 0.09, 0.03, 0.62, dark, (0, 0.045, TV_CY + 0.43), bevel=0.006, seg=2))
    for sx in (-1, 1):
        for dz in (-0.1, 0.1):
            G["tv"].append(cylinder(f"vesa_{sx}{dz}", 0.007, 0.006, zinc, T(sx * 0.15, 0.044, TV_CY + 0.30 + dz) @ cl.rot("X", 90), segs=6))
    # vents on the back's top edge
    for i in range(14):
        G["tv"].append(b(f"vent_{i}", 0.06, 0.03, 0.002, hole, (-0.6 + i * 0.092, 0.0, cz + (bh - 0.02) / 2 + 0.0005)))
    return G


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--size", type=int, default=1024)
    ap.add_argument("--no-bake", action="store_true")
    args = ap.parse_args(argv)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    cg.COLL = bpy.data.collections.new("tv_rig")
    bpy.context.scene.collection.children.link(cg.COLL)
    bpy.context.scene.unit_settings.system = "METRIC"

    ht.configure({"width": 2.0, "depth": 0.4, "shelf_z": 9.0, "seed": "tvrig",
                  "wear": {"edge": 0.55, "hands": 0.0, "shoes": 0.0, "knees": 0.0, "crevice": 0.8, "low": 0.0, "dust": 0.7, "corners": 0.0, "door": 0.0, "door_z": 0.0}})
    ht.importance = lambda ob, poly: 1.0
    hg.SKIP_BAKE = ("screen",)

    G = build()
    for objs in G.values():
        for ob in objs:
            if ob.modifiers:
                cg.apply_modifiers(ob)
    joined = {key: cg.join_objects(objs, key) for key, objs in G.items()}
    objs = list(joined.values())
    with bpy.context.temp_override(active_object=objs[0], selected_objects=objs, selected_editable_objects=objs):
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # working distances for the bake: the track 3 m aside, trolley on the centre line, wheel beside it, arm and tv hanging
    joined["rail"].location = (3.0, 0.0, 4.02)
    joined["carriage"].location = (0.0, 0.0, 4.02)
    joined["wheel"].location = (1.2, 0.0, 4.02)
    joined["arm"].location = (0.0, 0.0, 3.98)
    joined["tv"].location = (0.0, 0.0, 3.98)
    screen = cg.quad("screen", TV_W, TV_H, material("mach_screen", grey(0.006), rough=0.5), T(0, -0.046, 3.98 + TV_CY) @ cl.rot("X", 90))
    bpy.context.view_layer.update()

    for ob in objs:
        hg.ensure_uv_order(ob)
        hg.box_project_unit(ob)
    ht.unwrap_atlas_weighted(objs)
    print(f"[hero] tv rig: {sum(cg.tri_count(ob) for ob in objs)} tris, {len(objs)} meshes ({', '.join(ob.name for ob in objs)})")
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    if not args.no_bake:
        hg.bake_mask(objs + [screen], args.size, os.path.abspath(args.out)[:-4] + "-mask.png")
        # rounded edges. The screen stand-in rides along so SKIP_BAKE hides it: a lit plane a few millimetres in
        # front of the bezel would bend its edge normals towards itself. 1.2 mm: the chin's slots are 4 mm.
        hg.bake_bevel_normal(objs + [screen], args.size, os.path.abspath(args.out)[:-4] + "-normal.png", radius=0.0012)
    for ob in objs:  # exported around their own origins: the scene places them
        ob.location = (0.0, 0.0, 0.0)
    bpy.context.view_layer.update()
    cg.export_glb(objs, args.out)
    print(f"[hero] exported {args.out} ({os.path.getsize(args.out) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
