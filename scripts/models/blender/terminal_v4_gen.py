"""
terminal_v4_gen.py — the v3 terminal (one carcass, details cut into its panels) taken towards a photograph.

Dennis, 2026-09-19: v3 is good, but not high quality enough: photoreal, still cheap to draw, more interesting.
Everything new is either baked or free at runtime:

    rounded carcass edges (shelf, hood) so the long edges catch a highlight
    display panel = ONE sheet of gloss black acrylic; the screen sits behind it (no matte bezel to light up grey)
    control deck = brushed bronze plate with an engraved inlay line; it mirrors the screen towards the player
    a hidden light under the shelf washes the pedestal and the service door (baked into the brand channel)
    a dim glow behind the speaker slots and under the keys (same channel): the dark upper half gets depth
    paint and panel albedo lifted to what black laminate really reflects (nothing real is 1 % black)

Mesh names, UV sets and the baked mask follow hero_gen.py; the profile and the panel builder are v3's.

    blender --background --python scripts/models/blender/terminal_v4_gen.py -- \
        --spec .source-assets/models-in/mach-riftback/spec.json \
        --out  .source-assets/models-in/mach-riftback-v4/mach-riftback-v4.glb [--size 1024] [--no-bake] [--preview <dir>]
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
import machine_gen as mg  # noqa: E402
import hero_gen as hg  # noqa: E402
import terminal_v3_gen as v3  # noqa: E402
from cabinet_gen import at, box, cylinder, grey, hex_rgb, material, seg_frame, sphere  # noqa: E402
from terminal_v3_gen import H, W, D, T, INSET, IW, ring, slots  # noqa: E402

hg.DIM_LED = True
hg.SUPERSAMPLE = 2
hg.WEAR_PER_PART = True
EDGE_RADIUS = 0.006  # the carcass's long convex edges
WEIGHT = "bevel_weight_edge"


def panel(name, frame, length, base_mat, recesses=(), width=IW, round_start=False, round_end=False):
    """v3.panel, plus a bevel weight on the border edge that meets the neighbouring panel in a convex corner."""
    ob = v3.panel(name, frame, length, base_mat, recesses, width)
    me = ob.data
    attr = me.attributes.new(WEIGHT, "FLOAT", "EDGE")
    for e in me.edges:
        a, b = (me.vertices[i].co for i in e.vertices)
        if abs(a.z) > 1e-6 or abs(b.z) > 1e-6:
            continue
        if (round_start and abs(a.y) < 1e-6 and abs(b.y) < 1e-6) or (round_end and abs(a.y - length) < 1e-6 and abs(b.y - length) < 1e-6):
            attr.data[e.index].value = 1.0
    return ob


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
    tilt = s.screen_tilt if s.screen_tilt else 10.0
    sharp, P = v3.base_profile(tilt)
    names = "ABCDEFGHJKLMN"
    idx = {n: i for i, n in enumerate(names)}
    KF = 6
    low, _ = v3.base_profile(tilt, top=H - INSET + 0.0015)
    outer = v3.fillet(low, {idx["F"]: 0.02, idx["J"]: 0.02, idx["K"]: 0.03, idx["L"]: 0.02}, k=KF)
    carcass = v3.fillet(sharp, {idx["K"]: 0.045, idx["L"]: 0.03}, k=KF)
    inner = cg.offset_polygon(carcass, INSET)
    Pi = dict(zip(names[: idx["K"] + 1], inner))
    M["door"] = material("mach_metal_door", grey(0.11), rough=0.5, metal=1.0)  # black textured steel, like a real coin door
    M["bezel"] = material("mach_bezel_gloss", grey(0.012), rough=0.12, coat=0.4)
    M["deck"] = material("mach_deck_satin", grey(0.035), rough=0.42)  # Dennis: no second colour on the front; black like real control panels
    M["led"] = material("mach_led", grey(0.004), rough=0.9, emit=s.brand, emit_strength=0.3)
    parts = {k: [] for k in ("body", "trim", "metal", "controls")}
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

    # pedestal: what every real upright has there, a coin door: two coin mechs (entry bezel, lit reject button,
    # return pocket with its flap) and a cam lock. Dennis: ONE door; a second box with a keyhole below it looked wrong.
    pF, pL = seg("C", "D")
    dw = 0.30
    uh, uy = 0.30, 0.50
    rec = [(0, uy, dw, uh, 0.002, M["door"])]
    rec += ring(0, uy, dw, uh, 0.003, 0.007, M["hole"])
    for sx in (-1, 1):
        rec += [(sx * 0.068, uy - 0.085, 0.062, 0.042, 0.016, M["hole"])]  # coin return pocket
    body.append(panel("pedestal", pF, pL, M["panel"], rec))
    for sx in (-1, 1):
        x, y = sx * 0.068, uy + 0.035
        metal.append(box(f"coin_bezel_{sx}", 0.052, 0.088, 0.006, M["dark_metal"], at(pF, x, y, 0.001), bevel=0.002, seg=2))
        controls.append(box(f"coin_slot_{sx}", 0.0035, 0.028, 0.001, M["hole"], at(pF, x, y + 0.022, 0.0037)))
        controls.append(box(f"coin_reject_{sx}", 0.026, 0.026, 0.004, M["accent"], at(pF, x, y - 0.02, 0.0045), bevel=0.0012, seg=1))
        metal.append(box(f"coin_flap_{sx}", 0.058, 0.038, 0.0018, M["dark_metal"], at(pF, x, uy - 0.083, -0.0075, hg.rot_x(-14)), bevel=0.0006, seg=1))
    for nm, y in (("u", uy + uh / 2 - 0.028),):
        metal.append(cylinder(f"lock_collar_{nm}", 0.011, 0.004, M["chrome"], at(pF, 0, y, 0.0002), segs=24, bevel=0.0012, bevel_seg=2))
        metal.append(cylinder(f"lock_core_{nm}", 0.007, 0.003, M["metal"], at(pF, 0, y, 0.0028), segs=20, bevel=0.0008, bevel_seg=1))
        controls.append(box(f"lock_slot_{nm}", 0.0018, 0.008, 0.001, M["hole"], at(pF, 0, y, 0.0045)))
    # leg levellers under the front corners
    for sx in (-1, 1):
        metal.append(cylinder(f"leveller_{sx}", 0.019, 0.012, M["metal"], Matrix.Translation((sx * (W / 2 - 0.09), -D / 2 + 0.14, 0.006)), segs=20, bevel=0.002, bevel_seg=1))

    # shelf: the underside hides the light that washes the pedestal; the front edge carries the ONE visible line
    uF, uL = seg("D", "E")
    body.append(panel("shelf_under", uF, uL, M["paint"], [(0, uL / 2, IW - 0.10, 0.020, 0.004, M["seam"])], round_end=True))
    eF, eL = seg("E", "F")
    body.append(panel("shelf_edge", eF, eL, M["deck"], [(0, eL / 2, IW - 0.08, 0.006, 0.003, M["seam"])], round_start=True, round_end=True))
    cF, cL = seg("F", "G")
    kb_w, kb_d, kx, ky = 0.60, 0.135, -0.10, cL * 0.52
    rec = ring(0, cL / 2, IW - 0.026, cL - 0.026, 0.0016, 0.001, M["hole"])  # engraved inlay line around the plate
    rec += [(kx, ky, kb_w + 0.016, kb_d + 0.016, 0.006, M["led"])]
    body.append(panel("shelf_top", cF, cL, M["deck"], rec, round_start=True))
    rows, cols = 4, 14
    px, py = (kb_w - 0.04) / (cols - 1), (kb_d - 0.03) / (rows - 1)
    for r in range(rows):
        for c in range(cols):
            if r == 0 and 4 <= c <= 9:
                continue
            key = box(f"key_{r}_{c}", px - 0.0035, py - 0.0035, 0.008, M["key"], at(cF, kx - kb_w / 2 + 0.02 + c * px, ky - kb_d / 2 + 0.015 + r * py, -0.0015))
            hg.chamfer(key, 0.0014)
            controls.append(key)
    space = box("space_bar", 6 * px - 0.0035, py - 0.0035, 0.008, M["key"], at(cF, kx - kb_w / 2 + 0.02 + 6.5 * px, ky - kb_d / 2 + 0.015, -0.0015))
    hg.chamfer(space, 0.0014)
    controls.append(space)
    # the keys stand in a black tray; only its rim lets the light out
    controls.append(box("key_tray", kb_w + 0.011, kb_d + 0.011, 0.001, M["hole"], at(cF, kx, ky, -0.0052)))
    tx, ty = 0.335, cL * 0.56
    tb = cg.control_group(parts, pivots, "trackball", cF, tx, ty, 0.010)
    tb.append(cylinder("tb_ring", 0.052, 0.006, M["ring"], at(cF, tx, ty, 0.003), segs=32, bevel=0.002, bevel_seg=2))
    tb.append(sphere("tb_ball", 0.038, M["ball"], at(cF, tx, ty, 0.006), segs=32, rings=18))  # a 3 inch arcade trackball
    for i, x in enumerate((0.30, 0.37)):
        btn = cg.control_group(parts, pivots, f"tbtn_{i}", cF, x, cL * 0.2, 0.0)
        btn.append(cylinder(f"tbtn_ring_{i}", 0.0165, 0.004, M["ring"], at(cF, x, cL * 0.2, 0.002), segs=20))
        btn.append(cylinder(f"tbtn_cap_{i}", 0.0125, 0.007, M["brand_lit"] if i == 0 else M["accent"], at(cF, x, cL * 0.2, 0.0055), segs=20, bevel=0.003, bevel_seg=2))

    # carriage bolts hold a real control panel down: four low domed heads
    for sx in (-1, 1):
        for y in (0.03, cL - 0.03):
            metal.append(cylinder(f"deck_bolt_{sx}_{int(y * 1000)}", 0.0065, 0.0024, M["dark_metal"], at(cF, sx * (IW / 2 - 0.035), y, 0.0012), segs=20, bevel=0.0016, bevel_seg=2))

    # display: one gloss acrylic sheet, the screen in a recess behind its glass
    bF, bL = seg("G", "H")
    # Dennis: the screen looked set INTO a hole. A real monitor sits deep behind a sloped shroud that catches its light.
    sw = 0.74
    sh = sw / 1.6
    cy = bL / 2
    ow, oh, deep = sw + 0.09, sh + 0.09, 0.05
    body.append(panel("display", bF, bL, M["bezel"], [(0, cy, ow, oh, deep + 0.004, M["hole"])]))
    body.append(shroud("shroud", at(bF, 0, cy, 0), ow, oh, sw + 0.004, sh + 0.004, deep, M["black"]))
    scr = cg.quad("screen", sw, sh, M["screen"], at(bF, 0, cy, -deep + 0.001))
    gl = cg.quad("glass", sw + 0.004, sh + 0.004, M["glass"], at(bF, 0, cy, -deep + 0.006))
    controls.append(cylinder("power_led", 0.0025, 0.0012, M["brand_lit"], at(bF, IW / 2 - 0.04, (cy - sh / 2) / 2, 0.0004), segs=12))

    # speaker panel leaning over the player: stamped slots with a dim glow behind them
    hF, hL = seg("H", "J")
    rec = []
    for sx in (-1, 1):
        rec += slots(sx * 0.24, hL / 2, 0.30, 7, 0.013, 0.005, 0.008, M["led"])
    body.append(panel("speakers", hF, hL, M["panel"], rec, round_end=True))
    body.append(panel("fascia", *seg("J", "K"), M["paint"], round_start=True))
    for i in range(idx["K"], len(inner) - 1):
        body.append(panel(f"carcass_{i}", *seg_frame(inner[i], inner[i + 1]), M["paint"]))

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
        m.operation = kind
        m.use_clamp = True
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
    edge = mul(ramp(dot.outputs["Value"], 0.995, 0.90), ramp(noise(22.0, 6.0), 0.38, 0.62), exposed)

    # hands: the front of the deck and the shelf edge, polished in patches
    hands = mul(ramp(pos.outputs["Y"], -0.27, -0.35), ramp(pos.outputs["Z"], 0.925, 0.95), ramp(noise(6.0, 4.0), 0.36, 0.6), 0.55)
    # Zones only. Dennis disliked the wear drawn here (soft streaks and cloudy lines: a 1 K bake cannot be sharp).
    # The hall now thresholds these zones against a tiling chip height and lays hairline scratches over them
    # (scripts/assets/hero-wear-texture.py, heroMaterial.ts), so a zone says how MUCH wear, not what it looks like.
    shoes = mul(front, ramp(pos.outputs["Z"], 0.40, 0.08), ramp(noise(4.0, 4.0), 0.4, 0.75), 0.32)
    knees = mul(front, ramp(pos.outputs["Z"], 0.95, 0.75), ramp(pos.outputs["Z"], 0.35, 0.55), ramp(noise(5.0, 4.0), 0.45, 0.8), 0.13)
    rubbed = most(edge, hands, shoes, knees)

    crevice = mul(ramp(ao.outputs["AO"], 0.85, 0.35), ramp(noise(7.0, 5.0), 0.3, 0.7))
    low = mul(ramp(pos.outputs["Z"], 0.32, 0.02), ramp(noise(3.5, 7.0, 0.7), 0.42, 0.66), 0.8)
    dust = mul(up, ramp(noise(4.0, 5.0), 0.3, 0.75), 0.38)
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
    print(f"[v4] key shadow {path} ({os.path.getsize(path) / 1024:.0f} KB), mean {vis.mean():.2f}")


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
    # black laminate reflects 3-4 %, not 1 %: below that no light in the hall can show its surface
    raw.update(height=H, width=W, depth=D, screenTilt=10, paint="#2a2620", panel="#30291b")
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
    print(f"[v4] {spec.name}: {sum(cg.tri_count(ob) for ob in objs)} tris, {len(objs)} meshes ({', '.join(ob.name for ob in objs)})")

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    if not args.no_bake:
        hg.bake_mask(objs, args.size, os.path.abspath(args.out)[:-4] + "-mask.png")
        bake_key_shadow(objs, args.size // 2, os.path.abspath(args.out)[:-4] + "-light.png")
    cg.export_glb(objs, args.out)
    print(f"[v4] exported {args.out} ({os.path.getsize(args.out) / 1024:.0f} KB)")

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


if __name__ == "__main__":
    main()
