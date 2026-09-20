"""
hero_gen.py — the detailed pass for a hall TERMINAL (Blender 5.x, headless).

Builds the parametric terminal of machine_gen.py, adds construction detail (service door with louvres,
hinges and lock, rivets, bezel screws, chamfered keys), gives every hardware mesh two UV sets and bakes ONE mask atlas in Cycles:

    R  ambient occlusion
    G  irradiance from the machine's own screen
    B  irradiance from its brand lights (marquee, seam, LED strip, lit buttons)
    A  wear: 0.5 neutral, above = rubbed edges, below = dirt in crevices and scuffs near the floor

UV sets (both inside 0..1 so the quantizer needs no texture transform):
    UVMap  box projection, 4 m per UV unit (+0.5): the hall tiles its scanned materials over it
    atlas  unique unwrap of all hardware for the mask (exported as TEXCOORD_1)

    blender --background --python scripts/models/blender/hero_gen.py -- \
        --spec .source-assets/models-in/mach-riftback/spec.json \
        --out  .source-assets/models-in/mach-riftback-v2/mach-riftback-v2.glb \
        [--size 1024] [--preview <dir>]

Writes <out>.glb and <out minus .glb>-mask.png; scripts/models/hero-attach-mask.mjs puts the mask into the
GLB as the occlusion texture (TEXCOORD_1) before optimize/pack.
"""

import argparse
import json
import math
import os
import struct
import sys
import zlib

import bpy
import numpy as np
from mathutils import Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cabinet_gen as cg  # noqa: E402
import machine_gen as mg  # noqa: E402
from cabinet_gen import at, box, cylinder, grey, material, seg_frame  # noqa: E402

UV_METRES = 4.0
SCREEN_RADIANCE = 12.0
SKIP_BAKE = ("screen", "glass", "marquee", "side_art_l", "side_art_r")
BRAND_EMITTERS = ("mach_seam", "mach_brand_lit", "mach_accent", "mach_led")
SCREEN_EMITTERS = ("mach_screen",)  # the G channel's light source; the claw machine bakes its interior lamps here
DIM_LED = False  # terminal_v4_gen.py: mach_led is a faint glow behind slots, not a strip


# --------------------------------------------------------------------------------------
# geometry
# --------------------------------------------------------------------------------------


def rot_x(deg):
    return Matrix.Rotation(math.radians(deg), 4, "X")


def rot_y(deg):
    return Matrix.Rotation(math.radians(deg), 4, "Y")


def chamfer(ob, width):
    m = ob.modifiers.new("Chamfer", "BEVEL")
    m.width = width
    m.segments = 1
    m.limit_method = "ANGLE"
    m.angle_limit = math.radians(30)


def add_detail(s, M, parts):
    W, D = s.W, s.D
    t, inset = 0.019, 0.013
    iw = W - 2 * t
    outer, P = mg.terminal_profile(s)
    Pi = dict(zip("ABCDEFGHJKLM", cg.offset_polygon(outer, inset)))
    metal, controls, body = parts["metal"], parts["controls"], parts["body"]
    M["door"] = material("mach_metal_door", grey(0.2), rough=0.5, metal=1.0)
    M["led"] = material("mach_led", s.brand, rough=0.3, emit=s.brand, emit_strength=2.0)
    M["rubber"] = material("mach_rubber", grey(0.012), rough=0.8)

    # the five flat vent strips give way to a real service door
    parts["controls"] = controls = [ob for ob in controls if not ob.name.startswith("vent_")]
    for ob in controls:
        if ob.name.startswith("key_") or ob.name == "space_bar":
            chamfer(ob, 0.0012)

    # --- service door on the pedestal (frame C -> D) -------------------------------------
    pF, pL = seg_frame(Pi["C"], Pi["D"])
    dw, dh, dy, z0 = 0.58, 0.34, 0.235, 0.0112  # above the front_art insert (0.0108)
    bar = 0.022
    for nm, w, h, x, y in (
        ("door_frame_t", dw + 2 * bar, bar, 0, dy + dh / 2 + bar / 2),
        ("door_frame_b", dw + 2 * bar, bar, 0, dy - dh / 2 - bar / 2),
        ("door_frame_l", bar, dh, -dw / 2 - bar / 2, dy),
        ("door_frame_r", bar, dh, dw / 2 + bar / 2, dy),
    ):
        metal.append(box(nm, w, h, 0.009, M["dark_metal"], at(pF, x, y, z0 + 0.0045), bevel=0.002, seg=1))
    metal.append(box("door_leaf", dw - 0.004, dh - 0.004, 0.005, M["door"], at(pF, 0, dy, z0 + 0.0035), bevel=0.0015, seg=1))
    # louvres: a dark opening with seven slats facing down and out, so they mirror the floor and not the ceiling lamps
    lw, lh, ly = 0.40, 0.125, dy - 0.075
    controls.append(box("louvre_well", lw, lh, 0.002, M["hole"], at(pF, 0, ly, z0 + 0.0062)))
    for i in range(7):
        y = ly - lh / 2 + 0.012 + i * (lh - 0.024) / 6
        metal.append(box(f"louvre_{i}", lw - 0.004, 0.017, 0.0022, M["door"], at(pF, 0, y, z0 + 0.0105, rot_x(38)), bevel=0.0006, seg=1))
    for sx in (-1, 1):
        metal.append(box(f"louvre_side_{sx}", 0.008, lh + 0.012, 0.009, M["dark_metal"], at(pF, sx * (lw / 2 + 0.004), ly, z0 + 0.0105), bevel=0.0015, seg=1))
    # two compact butt hinges on the left edge, dark like the frame
    hx = -dw / 2 - 0.002
    for y in (dy - dh / 2 + 0.06, dy + dh / 2 - 0.06):
        metal.append(box("hinge_leaf", 0.016, 0.05, 0.003, M["dark_metal"], at(pF, hx, y, z0 + 0.0102), bevel=0.001, seg=1))
        metal.append(cylinder("hinge_pin", 0.0032, 0.05, M["dark_metal"], at(pF, hx, y, z0 + 0.0125, rot_x(90)), segs=12))
    # cam lock with its key slot, and a pull lip
    lx, lyk = dw / 2 - 0.045, dy + 0.06
    metal.append(cylinder("lock_collar", 0.015, 0.006, M["chrome"], at(pF, lx, lyk, z0 + 0.009), segs=24, bevel=0.0015, bevel_seg=2))
    metal.append(cylinder("lock_core", 0.0095, 0.004, M["metal"], at(pF, lx, lyk, z0 + 0.013), segs=20, bevel=0.001, bevel_seg=1))
    controls.append(box("lock_slot", 0.0022, 0.011, 0.0012, M["hole"], at(pF, lx, lyk, z0 + 0.0153)))
    metal.append(box("door_pull", 0.012, 0.09, 0.008, M["dark_metal"], at(pF, dw / 2 - 0.012, dy - 0.06, z0 + 0.010), bevel=0.003, seg=2))
    for x in (-dw / 2 + 0.03, dw / 2 - 0.03):
        for y in (dy - dh / 2 - bar / 2, dy + dh / 2 + bar / 2):
            metal.append(cylinder("frame_screw", 0.0042, 0.0022, M["chrome"], at(pF, x, y, z0 + 0.0101), segs=16, bevel=0.0007, bevel_seg=1))
            controls.append(box("frame_screw_slot", 0.0052, 0.0009, 0.0004, M["hole"], at(pF, x, y, z0 + 0.0114, Matrix.Rotation(0.6, 4, "Z"))))


    # --- kick plate rivets and rubber feet -------------------------------------------------
    kF, kL = seg_frame(Pi["A"], Pi["B"])
    span = iw - 0.30
    for i in range(4):
        x = -span / 2 + i * span / 3
        y = kL / 2
        metal.append(cylinder("rivet", 0.0048, 0.003, M["metal"], at(kF, x, y, 0.0095), segs=16, bevel=0.0018, bevel_seg=2))
    for sx in (-1, 1):
        for y in (-D / 2 + 0.11, D / 2 - 0.07):
            body.append(cylinder("foot", 0.024, 0.012, M["rubber"], Matrix.Translation((sx * (W / 2 - 0.07), y, 0.006)), segs=20))

    # --- display bezel screws ----------------------------------------------------------------
    bF, bL = seg_frame(Pi["G"], Pi["H"])
    bw, bh, cy = iw - 0.03, bL - 0.04, bL / 2 + 0.004
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * (bw / 2 - 0.014), cy + sy * (bh / 2 - 0.014)
            metal.append(cylinder("bezel_screw", 0.0036, 0.0018, M["metal"], at(bF, x, y, 0.0128), segs=16, bevel=0.0006, bevel_seg=1))
            controls.append(box("bezel_screw_slot", 0.0046, 0.0008, 0.0004, M["hole"], at(bF, x, y, 0.0139, Matrix.Rotation(0.5 * sx + sy, 4, "Z"))))
    # power LED and a recessed service switch on the bezel's lower rail
    controls.append(cylinder("power_led", 0.0028, 0.002, M["led"], at(bF, bw / 2 - 0.05, cy - bh / 2 + 0.010, 0.0128), segs=12))

    # --- vent slots on the roof ---------------------------------------
    hF, hL = seg_frame(Pi["H"], Pi["J"])
    roof_y0, roof_y1 = P["J"][0], P["K"][0]
    for i in range(6):
        y = roof_y0 + 0.07 + i * 0.03
        if y < roof_y1 - 0.05:
            controls.append(box(f"roof_vent_{i}", 0.30, 0.009, 0.004, M["hole"], Matrix.Translation((0, y, s.H - inset + 0.0005))))


# --------------------------------------------------------------------------------------
# UVs
# --------------------------------------------------------------------------------------


def ensure_uv_order(ob):
    """UVMap (tiling) must be the first layer = TEXCOORD_0, atlas the second."""
    me = ob.data
    if "UVMap" not in me.uv_layers:
        me.uv_layers.new(name="UVMap")
    if me.uv_layers[0].name != "UVMap":
        raise RuntimeError(f"{ob.name}: first UV layer is {me.uv_layers[0].name}")
    if "atlas" not in me.uv_layers:
        me.uv_layers.new(name="atlas")


def box_project_unit(ob):
    me = ob.data
    uv = me.uv_layers["UVMap"]
    mw = ob.matrix_world
    nm = mw.to_3x3()
    for poly in me.polygons:
        n = (nm @ poly.normal).normalized()
        ax = max(range(3), key=lambda i: abs(n[i]))
        for li in poly.loop_indices:
            p = mw @ me.vertices[me.loops[li].vertex_index].co
            u, v = ((p.y, p.z), (p.x, p.z), (p.x, p.y))[ax]
            uv.data[li].uv = (u / UV_METRES + 0.5, v / UV_METRES + 0.5)


def unwrap_atlas(targets):
    for ob in bpy.data.objects:
        ob.select_set(False)
    for ob in targets:
        ob.select_set(True)
        ob.data.uv_layers.active = ob.data.uv_layers["atlas"]
    bpy.context.view_layer.objects.active = targets[0]
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.0, area_weight=0.0, scale_to_bounds=False)
    bpy.ops.uv.select_all(action="SELECT")
    bpy.ops.uv.pack_islands(margin=0.008, rotate=True)
    bpy.ops.object.mode_set(mode="OBJECT")


# --------------------------------------------------------------------------------------
# baking
# --------------------------------------------------------------------------------------


def bake_material(name, image, build):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    build(nt, out)
    img = nt.nodes.new("ShaderNodeTexImage")
    img.image = image
    uvn = nt.nodes.new("ShaderNodeUVMap")
    uvn.uv_map = "atlas"
    nt.links.new(uvn.outputs["UV"], img.inputs["Vector"])
    nt.nodes.active = img
    img.select = True
    return m


def white(nt, out):
    d = nt.nodes.new("ShaderNodeBsdfDiffuse")
    d.inputs["Color"].default_value = (0.7, 0.7, 0.7, 1)
    nt.links.new(d.outputs["BSDF"], out.inputs["Surface"])


def emitter(strength):
    def build(nt, out):
        # front faces only: the back of the screen quad must not light the shell behind it
        e = nt.nodes.new("ShaderNodeEmission")
        geo = nt.nodes.new("ShaderNodeNewGeometry")
        m = nt.nodes.new("ShaderNodeMath")
        m.operation = "SUBTRACT"
        m.inputs[0].default_value = 1.0
        nt.links.new(geo.outputs["Backfacing"], m.inputs[1])
        k = nt.nodes.new("ShaderNodeMath")
        k.operation = "MULTIPLY"
        k.inputs[1].default_value = strength
        nt.links.new(m.outputs["Value"], k.inputs[0])
        nt.links.new(k.outputs["Value"], e.inputs["Strength"])
        nt.links.new(e.outputs["Emission"], out.inputs["Surface"])
    return build


def wear_shader(nt, out):
    """Emission = 0.5 + rubbed edges - dirt. Pointiness finds convex edges; the AO node finds crevices."""
    N = nt.nodes
    geo = N.new("ShaderNodeNewGeometry")
    tc = N.new("ShaderNodeTexCoord")

    def noise(scale, detail, rough=0.6):
        n = N.new("ShaderNodeTexNoise")
        n.inputs["Scale"].default_value = scale
        n.inputs["Detail"].default_value = detail
        n.inputs["Roughness"].default_value = rough
        nt.links.new(tc.outputs["Object"], n.inputs["Vector"])
        return n

    def ramp(src, lo, hi):
        r = N.new("ShaderNodeMapRange")
        r.inputs["From Min"].default_value = lo
        r.inputs["From Max"].default_value = hi
        r.clamp = True
        nt.links.new(src, r.inputs["Value"])
        return r.outputs["Result"]

    def math_node(op, a, b):
        m = N.new("ShaderNodeMath")
        m.operation = op
        m.use_clamp = True
        for sock, val in ((m.inputs[0], a), (m.inputs[1], b)):
            if isinstance(val, (int, float)):
                sock.default_value = val
            else:
                nt.links.new(val, sock)
        return m.outputs["Value"]

    # Rounded-normal trick: where the bevelled normal leaves the true normal there is an edge. Pointiness is
    # useless here: the carcass panels are open quads, whose border vertices all count as sharp.
    bev = N.new("ShaderNodeBevel")
    bev.samples = 8
    bev.inputs["Radius"].default_value = 0.006
    dot = N.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    nt.links.new(bev.outputs["Normal"], dot.inputs[0])
    nt.links.new(geo.outputs["Normal"], dot.inputs[1])
    edge = ramp(dot.outputs["Value"], 0.995, 0.90)
    breakup = ramp(noise(22.0, 6.0).outputs["Fac"], 0.38, 0.62)
    edge = math_node("MULTIPLY", edge, breakup)

    ao = N.new("ShaderNodeAmbientOcclusion")
    ao.inputs["Distance"].default_value = 0.06
    ao.samples = 16
    crevice = ramp(ao.outputs["AO"], 0.85, 0.35)
    grime = ramp(noise(7.0, 5.0).outputs["Fac"], 0.3, 0.7)
    crevice = math_node("MULTIPLY", crevice, grime)
    sep = N.new("ShaderNodeSeparateXYZ")
    nt.links.new(geo.outputs["Position"], sep.inputs["Vector"])
    low = ramp(sep.outputs["Z"], 0.32, 0.02)  # boots and mops near the floor
    scuff = ramp(noise(3.5, 7.0, 0.7).outputs["Fac"], 0.42, 0.66)
    low = math_node("MULTIPLY", low, scuff)
    dirt = math_node("MAXIMUM", crevice, math_node("MULTIPLY", low, 0.8))

    # rubbed only where the edge is exposed; a bevelled normal also turns in concave corners, which are dirt
    exposed = ramp(ao.outputs["AO"], 0.55, 0.9)
    edge = math_node("MULTIPLY", edge, exposed)
    val = math_node("ADD", 0.5, math_node("MULTIPLY", edge, 0.5))
    val = math_node("SUBTRACT", val, math_node("MULTIPLY", dirt, 0.5))
    e = N.new("ShaderNodeEmission")
    nt.links.new(val, e.inputs["Color"])
    nt.links.new(e.outputs["Emission"], out.inputs["Surface"])


def run_bake(targets, others, image, kind, mapper, samples):
    """Swap every slot through `mapper(original material)`, bake all targets into `image`, restore."""
    saved = []
    for ob in targets + others:
        for slot in ob.material_slots:
            saved.append((slot, slot.material))
            slot.material = mapper(slot.material, ob in targets)
    px = np.zeros(image.size[0] * image.size[1] * 4, dtype=np.float32)
    image.pixels.foreach_set(px)
    sc = bpy.context.scene
    sc.cycles.samples = samples
    for ob in bpy.data.objects:
        ob.select_set(False)
    for ob in targets:
        ob.select_set(True)
        ob.data.uv_layers.active = ob.data.uv_layers["atlas"]
    bpy.context.view_layer.objects.active = targets[0]
    kw = dict(type=kind, margin=3 * SUPERSAMPLE, margin_type="EXTEND", use_clear=False, target="IMAGE_TEXTURES")
    if kind == "DIFFUSE":
        kw["pass_filter"] = {"DIRECT", "INDIRECT"}
    bpy.ops.object.bake(**kw)
    for slot, mat in saved:
        slot.material = mat
    out = np.empty(image.size[0] * image.size[1] * 4, dtype=np.float32)
    image.pixels.foreach_get(out)
    return out.reshape(image.size[1], image.size[0], 4)[:, :, 0].copy()


def write_png(path, pix, color_type):
    """color_type 6 = RGBA, 2 = RGB."""
    h, w, _ = pix.shape
    raw = b"".join(b"\x00" + pix[y].tobytes() for y in range(h - 1, -1, -1))  # Blender rows start at the bottom

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    with open(path, "wb") as fh:
        fh.write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, color_type, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def write_png_rgba(path, rgba):
    write_png(path, rgba, 6)


def write_png_rgb(path, rgb):
    write_png(path, rgb, 2)


def downsample(a, k):
    """Box filter by k: a bake at k times the size, averaged down, loses most of its sampling noise."""
    if k == 1:
        return a
    h, w = a.shape[0] // k, a.shape[1] // k
    return a.reshape(h, k, w, k).mean(axis=(1, 3))


WEAR_SEED = ""  # hero_terminal_gen.py: one per machine
WEAR_PER_PART = False  # terminal_v4_gen.py: wear_shader(nt, out, seed)
SUPERSAMPLE = 1  # terminal_v4_gen.py bakes at twice the size


def use_cycles_gpu():
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for kind in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = kind
            prefs.get_devices()
            for d in prefs.devices:
                d.use = d.type == kind
            if any(d.use for d in prefs.devices):
                sc.cycles.device = "GPU"
                print(f"[hero] Cycles on {kind}")
                break
        except Exception:
            continue


def bake_mask(objs, size, path):
    ss = SUPERSAMPLE
    size_out, size = size, size * ss
    sc = bpy.context.scene
    use_cycles_gpu()
    world = bpy.data.worlds.new("bake_world")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.0
    sc.world = world
    # a floor so the AO and the light passes know the machine stands on something
    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, -0.0005))
    floor = bpy.context.active_object

    targets = [ob for ob in objs if ob.name not in SKIP_BAKE]
    others = [ob for ob in objs if ob.name in SKIP_BAKE]
    # the glass pane would swallow the screen's light as an opaque stand-in
    glass = [ob for ob in others if ob.name == "glass"]
    for ob in glass:
        ob.hide_render = True
    image = bpy.data.images.new("hero_mask_bake", size, size, alpha=False, float_buffer=True, is_data=True)
    m_white = bake_material("bake_white", image, white)
    m_wear = bake_material("bake_wear", image, wear_shader)
    wear_variants = {}

    def wear_for(m):
        """WEAR_PER_PART: every original material bakes its own wear pattern, so zones do not run on across parts."""
        if not WEAR_PER_PART or m is None:
            return m_wear
        if m.name not in wear_variants:
            seed = (zlib.crc32((m.name + WEAR_SEED).encode()) % 997) / 9.0
            wear_variants[m.name] = bake_material("bake_wear_" + m.name, image, lambda nt, out, seed=seed: wear_shader(nt, out, seed))
        return wear_variants[m.name]

    m_emit = bake_material("bake_emit", image, emitter(SCREEN_RADIANCE * 3.0))
    m_screen = bake_material("bake_screen", image, emitter(SCREEN_RADIANCE))
    # glow behind slots and under keys: a hint of light, not a lamp (its walls would saturate otherwise)
    m_dim = bake_material("bake_emit_dim", image, emitter(SCREEN_RADIANCE * 0.12))
    floor.data.materials.append(m_white)

    ao = run_bake(targets, others, image, "AO", lambda m, t: m_white, 96)
    wear = run_bake(targets, others, image, "EMIT", lambda m, t: wear_for(m) if t else m_white, 32)
    screen = run_bake(targets, others, image, "DIFFUSE", lambda m, t: m_screen if (m and m.name in SCREEN_EMITTERS) else m_white, 384)
    brand = run_bake(targets, others, image, "DIFFUSE", lambda m, t: m_dim if (m and m.name == "mach_led" and DIM_LED) else m_emit if (m and (m.name in BRAND_EMITTERS)) else (m_screen if (m and m.name == "mach_marquee") else m_white), 384)
    bpy.data.objects.remove(floor)
    for ob in glass:
        ob.hide_render = False

    def factor(x):
        # irradiance as a fraction of the emitter's radiance (a form factor), square-rooted for 8-bit precision;
        # the hall squares it again and multiplies by the live colour of the screen / the brand
        return np.sqrt(np.clip(x / SCREEN_RADIANCE, 0.0, 1.0))

    print(f"[hero] bake ranges: ao {ao.min():.2f}..{ao.max():.2f}  wear {wear.min():.2f}..{wear.max():.2f}  screen p99 {np.percentile(screen, 99):.3f}  brand p99 {np.percentile(brand, 99):.3f}")
    ao, wear, screen, brand = (downsample(x, ss) for x in (ao, wear, screen, brand))
    rgba = np.stack([np.clip(ao, 0, 1), factor(screen), factor(brand), np.clip(wear, 2 / 255, 1)], axis=-1)
    write_png_rgba(path, (rgba * 255.0 + 0.5).astype(np.uint8))
    print(f"[hero] mask {path} ({os.path.getsize(path) / 1024:.0f} KB)")


# Metres. Every real edge is rounded by about this much and catches a highlight. It has to stay BELOW the
# smallest feature it runs along, or the Bevel node's rays cross the part and the normal flips: at 3 mm the
# keyboard's chamfered keys (1.2 mm) and the coin slots lost their separation.
BEVEL_RADIUS = 0.0015
BEVEL_SAMPLES = 8
BEVEL_CYCLES_SAMPLES = 48


def bevel_normal_shader(radius, samples):
    """A diffuse surface whose shading normal is the Bevel node's rounded normal: baked as a tangent-space
    normal map it gives every slot, screw and seam a rounded edge without a single extra triangle."""

    def build(nt, out):
        bev = nt.nodes.new("ShaderNodeBevel")
        bev.samples = samples
        bev.inputs["Radius"].default_value = radius
        d = nt.nodes.new("ShaderNodeBsdfDiffuse")
        d.inputs["Color"].default_value = (0.5, 0.5, 0.5, 1)
        nt.links.new(bev.outputs["Normal"], d.inputs["Normal"])
        nt.links.new(d.outputs["BSDF"], out.inputs["Surface"])

    return build


def bake_bevel_normal(objs, size, path, radius=BEVEL_RADIUS, samples=BEVEL_SAMPLES):
    """Bake the rounded-edge normal into the unique `atlas` UV set as an 8-bit tangent-space normal map.

    Written as <out>-normal.png; hero-attach-mask.mjs puts it into the GLB as the normalTexture on TEXCOORD_1 and
    heroMaterial.ts perturbs the shading normal with it AFTER the tiling scan. Call this after bake_mask (which
    builds the bake world and its floor plane and removes it again): a floor under the machine would round its
    bottom edges away.

    Cycles takes the tangent frame from the ACTIVE RENDER UV layer, not the active one, so `atlas` is made the
    render layer for the bake and put back afterwards. The stand-ins (screen, glass, marquee, side art) are hidden:
    the Bevel node traces real rays, and the acrylic sheet a few millimetres in front of the bezel would bend its
    edge normals towards itself."""
    ss = SUPERSAMPLE
    size_out, size = size, size * ss
    sc = bpy.context.scene
    use_cycles_gpu()
    sc.render.bake.normal_space = "TANGENT"
    sc.render.bake.normal_r, sc.render.bake.normal_g, sc.render.bake.normal_b = "POS_X", "POS_Y", "POS_Z"
    targets = [ob for ob in objs if ob.name not in SKIP_BAKE]
    others = [ob for ob in objs if ob.name in SKIP_BAKE]
    hidden = [(ob, ob.hide_render) for ob in others]
    for ob in others:
        ob.hide_render = True

    image = bpy.data.images.new("hero_bevel_bake", size, size, alpha=False, float_buffer=True, is_data=True)
    # empty texels must decode to a flat normal, not to (-1, -1, -1)
    flat = np.tile(np.array([0.5, 0.5, 1.0, 1.0], dtype=np.float32), size * size)
    image.pixels.foreach_set(flat)
    m_bevel = bake_material("bake_bevel", image, bevel_normal_shader(radius, samples))

    saved, render_uv = [], []
    for ob in targets:
        for slot in ob.material_slots:
            saved.append((slot, slot.material))
            slot.material = m_bevel
        layers = ob.data.uv_layers
        render_uv.append((ob, next((l.name for l in layers if l.active_render), layers[0].name)))
        layers["atlas"].active_render = True
        layers.active = layers["atlas"]
    sc.cycles.samples = BEVEL_CYCLES_SAMPLES
    for ob in bpy.data.objects:
        ob.select_set(False)
    for ob in targets:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = targets[0]
    bpy.ops.object.bake(type="NORMAL", margin=3 * ss, margin_type="EXTEND", use_clear=False, target="IMAGE_TEXTURES")

    for slot, mat in saved:
        slot.material = mat
    for ob, name in render_uv:
        ob.data.uv_layers[name].active_render = True
    for ob, was in hidden:
        ob.hide_render = was

    out = np.empty(size * size * 4, dtype=np.float32)
    image.pixels.foreach_get(out)
    rgb = out.reshape(size, size, 4)[:, :, :3]
    rgb = np.stack([downsample(rgb[:, :, i].copy(), ss) for i in range(3)], axis=-1)
    # a box filter averages the VECTORS; they have to come back to unit length or the edges read flat
    v = rgb * 2.0 - 1.0
    n = np.linalg.norm(v, axis=-1, keepdims=True)
    v = np.where(n > 1e-4, v / np.maximum(n, 1e-6), np.array([0.0, 0.0, 1.0], dtype=np.float32))
    tilt = np.degrees(np.arccos(np.clip(v[:, :, 2], -1.0, 1.0)))
    print(f"[hero] bevel normal: {(tilt > 5.0).mean() * 100:.1f} % of the atlas tilted > 5 deg, max {tilt.max():.0f} deg")
    write_png_rgb(path, ((v * 0.5 + 0.5) * 255.0 + 0.5).astype(np.uint8))
    print(f"[hero] bevel normal {path} ({os.path.getsize(path) / 1024:.0f} KB, r={radius}, {size_out} px)")


# --------------------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------------------


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
        spec = mg.Spec(json.load(fh))
    if spec.variant != "terminal":
        raise SystemExit("hero_gen.py covers the terminal so far")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    cg.COLL = bpy.data.collections.new("machine")
    bpy.context.scene.collection.children.link(cg.COLL)
    bpy.context.scene.unit_settings.system = "METRIC"

    M = mg.make_materials(spec, None)
    parts, scr, gl, mq, arts, extra, mq_frame, pivots = mg.build_terminal(spec, M)
    add_detail(spec, M, parts)
    objs = cg.finish(parts, [scr, gl, mq, *arts, *extra], wear=False, pivots=pivots)

    targets = [ob for ob in objs if ob.name not in SKIP_BAKE]
    for ob in targets:
        ensure_uv_order(ob)
        box_project_unit(ob)
    unwrap_atlas(targets)
    total = sum(cg.tri_count(ob) for ob in objs)
    print(f"[hero] {spec.name}: {total} tris, {len(objs)} meshes, {len(targets)} baked")

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    if not args.no_bake:
        bake_mask(objs, args.size, os.path.abspath(args.out)[:-4] + "-mask.png")
    cg.export_glb(objs, args.out)
    print(f"[hero] exported {args.out} ({os.path.getsize(args.out) / 1024:.0f} KB)")

    if args.preview:
        os.makedirs(args.preview, exist_ok=True)
        mg.dress_for_preview(spec, mq_frame)
        cam = cg.build_studio(spec)
        f = max(spec.H / 1.9, spec.W / 0.9)
        cg.render_preview(cam, os.path.join(args.preview, "preview-3q.png"), (-2.15 * f, -2.75 * f, 1.55 * f), (0.0, -0.05, spec.H * 0.5), spec)
        cg.render_preview(cam, os.path.join(args.preview, "preview-front.png"), (0.0, -3.45 * f, 1.35 * f), (0.0, 0.0, spec.H * 0.5), spec)


if __name__ == "__main__":
    main()
