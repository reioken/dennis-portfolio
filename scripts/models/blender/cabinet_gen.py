"""
cabinet_gen.py — procedural arcade-cabinet generator for Blender 5.x (headless).

Builds ONE cabinet from a JSON spec, applies all modifiers, exports a game-ready GLB
and (optionally) renders studio previews with Eevee.

    blender --background --python scripts/models/blender/cabinet_gen.py -- \
        --spec .source-assets/models-in/cabinet-proto/spec.json \
        --out  .source-assets/models-in/cabinet-proto/cabinet-proto.glb \
        [--preview .source-assets/models-in/cabinet-proto] \
        [--variant upright|cocktail|kiosk] [--blend debug.blend]

Coordinate conventions
----------------------
Blender is Z-up; the cabinet is built with its FRONT facing -Y, standing on z = 0 and
centred on x = 0 / y = 0. The glTF exporter (export_yup=True, default) turns that into
glTF Y-up with the front facing +Z, which is what the three.js hall scene expects.

Front panels are built in a local "panel frame" derived from one segment of the side
profile:  local X = cabinet X (player's right),  local Y = up along the panel,
local Z = out of the panel (towards the player). Every part on a panel (buttons, bezel,
coin door ...) is authored in that frame, so tilting a panel in the spec moves the parts.

Mesh names the three.js scene relies on (do NOT reuse these words elsewhere; the loader
matches by lowercase substring):
    screen       curved CRT quad, UV 0..1 upright (u left->right, v bottom->top)
    glass        transparent quad in front of the screen (alpha 0.15)
    marquee      front face of the header, UV 0..1
    side_art_l / side_art_r   decal slots on the side panels, UV 0..1 (front of the
                 cabinet is u=1 on the left panel and u=0 on the right panel, so
                 artwork reads correctly from outside on both sides)

Moving controls are their OWN objects (the scene lights and animates them, hallScene.ts
CTL_NAME); their object origin is the pivot, every other node is exported at identity:
    joy          washer + shaft + ball, origin where the shaft enters the panel plate
                 (rotate about the origin to tilt the stick)
    btn_0..btn_5 ring + cap, origin = cap rest position on the plate (translate along the
                 negative plate normal to press); index order = the build order, row by row
                 left to right
    start_0/1    1P / 2P start buttons, same convention
    controls     everything else that used to share the mesh (cp_plate, bezel, mq_surround)
NOTE optimize.mjs quantizes positions; gltf-transform then moves every mesh node's
translation to the mesh bbox centre (see claw_gen.py). The pivot above is exact in the
Blender export under .source-assets/models-in/ and has to be recovered from the bbox after
that step.

Spec fields (all optional except name; metres / degrees / sRGB hex)
    name               output basename
    paint              cabinet paint colour            "#0E1A22"
    tmolding           T-molding colour                "#58C2BA"
    buttons            list of 6 button colours
    height width depth overall size                    1.9 / 0.76 / 0.8
    screenTilt         bezel lean, negative = leans back    -8
    marqueeTilt        header lean, positive = top forward   6
    controlPanelAngle  control-panel slope from horizontal  22
    wear               roughness-noise amplitude 0..1 (0 = flat roughness)  0.3
    accent             optional accent colour for start buttons / instruction card
"""

import argparse
import json
import math
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy
import bmesh
from mathutils import Matrix, Vector

# --------------------------------------------------------------------------------------
# helpers: colour, materials
# --------------------------------------------------------------------------------------


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgb(h, default=(0.5, 0.5, 0.5)):
    """'#RRGGBB' -> linear (r, g, b)."""
    if not h:
        return default
    h = h.lstrip("#")
    if len(h) != 6:
        return default
    return tuple(srgb_to_linear(int(h[i : i + 2], 16) / 255.0) for i in (0, 2, 4))


def grey(v):
    return (v, v, v)


_MATS = {}


def tiny_tex(name, srgb, size=4):
    """4x4 base-colour placeholder (sRGB floats). Two pixels differ by 1 LSB on purpose:
    gltf-transform's `prune` folds single-colour textures into factors and then drops the
    UVs of texture-less materials, and its `palette` step rewrites those UVs — a real
    texture keeps the 0..1 UVs of screen / marquee / side_art intact through the pipeline."""
    import numpy as np

    px = np.ones((size, size, 4), dtype=np.float32)
    px[..., 0], px[..., 1], px[..., 2] = srgb
    px[0, 0, :3] = np.clip(np.array(srgb) + (1.0 / 255.0 if max(srgb) < 0.5 else -1.0 / 255.0), 0, 1)
    img = bpy.data.images.new(name, size, size, alpha=False, float_buffer=False)
    img.colorspace_settings.name = "sRGB"
    img.pixels.foreach_set(px.ravel())
    img.pack()
    return img


def material(name, color, rough=0.5, metal=0.0, coat=0.0, coat_rough=0.15, emit=None, emit_strength=0.0, alpha=1.0, rough_tex=None, spec=0.5, base_tex=None):
    """Principled-only material (glTF friendly). Cached by name.

    `spec` is the Specular IOR Level (0.5 = default dielectric); lower values export as
    KHR_materials_specular and keep matte plastics from turning grey under studio lights.
    `base_tex` plugs an image into Base Color (see tiny_tex for why the UV meshes need one)."""
    if name in _MATS:
        return _MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    if base_tex is not None:
        bt = nt.nodes.new("ShaderNodeTexImage")
        bt.image = base_tex
        bt.interpolation = "Closest"
        bt.location = (-600, 300)
        nt.links.new(bt.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Specular IOR Level"].default_value = spec
    bsdf.inputs["Coat Weight"].default_value = coat
    bsdf.inputs["Coat Roughness"].default_value = coat_rough
    if emit is not None:
        bsdf.inputs["Emission Color"].default_value = (*emit, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    else:
        bsdf.inputs["Emission Strength"].default_value = 0.0
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        m.surface_render_method = "BLENDED"
        m.use_backface_culling = False
    if rough_tex is not None:
        # Image (G channel) -> Roughness. The glTF exporter turns this into a
        # metallicRoughnessTexture; the tile repeats via the box-projected UVs.
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = rough_tex
        tex.interpolation = "Linear"
        tex.location = (-600, 0)
        sep = nt.nodes.new("ShaderNodeSeparateColor")
        sep.location = (-300, 0)
        nt.links.new(tex.outputs["Color"], sep.inputs["Color"])
        nt.links.new(sep.outputs["Green"], bsdf.inputs["Roughness"])
    if any(word in name for word in ("paint", "panel")):
        bsdf.inputs["Roughness"].default_value = max(rough, 0.48)
        bsdf.inputs["Coat Weight"].default_value = 0.16
    if "trim" in name:
        bsdf.inputs["Metallic"].default_value = 0.5
        bsdf.inputs["Roughness"].default_value = 0.3
    m.diffuse_color = (*color, 1.0)
    _MATS[name] = m
    return m


def make_wear_image(size=128, base=0.45, amp=0.3, seed=7):
    """Tileable value-noise roughness tile packed as an ORM image (R=1, G=rough, B=0)."""
    import numpy as np

    rng = np.random.default_rng(seed)

    def value_noise(cells):
        g = rng.random((cells, cells))
        ys, xs = np.mgrid[0:size, 0:size] / size * cells
        x0 = np.floor(xs).astype(int)
        y0 = np.floor(ys).astype(int)
        fx = xs - x0
        fy = ys - y0
        fx = fx * fx * (3 - 2 * fx)
        fy = fy * fy * (3 - 2 * fy)
        x1 = (x0 + 1) % cells
        y1 = (y0 + 1) % cells
        a = g[y0, x0]
        b = g[y0, x1]
        c = g[y1, x0]
        d = g[y1, x1]
        return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy

    n = 0.55 * value_noise(3) + 0.3 * value_noise(7) + 0.15 * value_noise(19)
    n = (n - n.min()) / max(1e-6, n.max() - n.min())
    rough = np.clip(base + (n - 0.5) * amp * 0.5, 0.05, 0.95)
    px = np.ones((size, size, 4), dtype=np.float32)
    px[..., 1] = rough
    px[..., 2] = 0.0
    img = bpy.data.images.new("cab_wear_orm", size, size, alpha=False, float_buffer=False)
    img.colorspace_settings.name = "Non-Color"
    img.pixels.foreach_set(px.ravel())
    img.pack()
    return img


# --------------------------------------------------------------------------------------
# helpers: scene / objects
# --------------------------------------------------------------------------------------

COLL = None


def new_object(name, me, mat=None, matrix=None):
    ob = bpy.data.objects.new(name, me)
    me.name = name
    COLL.objects.link(ob)
    if mat is not None:
        me.materials.append(mat)
    if matrix is not None:
        ob.matrix_world = matrix
    return ob


def bm_to_object(name, bm, mat=None, matrix=None, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    return new_object(name, me, mat, matrix)



def side_surface_art(objects, mat):
    """Copy the evaluated side skin, including bevels; one continuous UV projection per side."""
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    skins = {-1: [], 1: []}
    for ob in objects:
        evaluated = ob.evaluated_get(depsgraph)
        me = evaluated.to_mesh()
        normal_matrix = ob.matrix_world.to_3x3().inverted().transposed()
        for poly in me.polygons:
            normal = (normal_matrix @ poly.normal).normalized()
            if abs(normal.x) < 0.45:
                continue
            sx = 1 if normal.x > 0 else -1
            skins[sx].append([ob.matrix_world @ me.vertices[i].co + normal * .0008 for i in poly.vertices])
        evaluated.to_mesh_clear()
    points = [p for faces in skins.values() for face in faces for p in face]
    y0, y1 = min(p.y for p in points), max(p.y for p in points)
    z0, z1 = min(p.z for p in points), max(p.z for p in points)
    result = []
    for sx, name in ((-1, "side_art_l"), (1, "side_art_r")):
        bm = bmesh.new()
        uv = bm.loops.layers.uv.new("UVMap")
        for face in skins[sx]:
            f = bm.faces.new([bm.verts.new(p) for p in face])
            for loop in f.loops:
                p = loop.vert.co
                u = (p.y-y0)/(y1-y0) if sx > 0 else (y1-p.y)/(y1-y0)
                loop[uv].uv = (u, (p.z-z0)/(z1-z0))
        result.append(bm_to_object(name, bm, mat, None, smooth=False))
    return result

def add_bevel(ob, width, segments=2, angle=30.0, harden=True):
    m = ob.modifiers.new("Bevel", "BEVEL")
    m.width = width
    m.segments = max(3, segments)
    m.limit_method = "ANGLE"
    m.angle_limit = math.radians(angle)
    m.harden_normals = harden
    m.miter_outer = "MITER_ARC"
    return m


def apply_modifiers(ob):
    with bpy.context.temp_override(object=ob, active_object=ob, selected_objects=[ob], selected_editable_objects=[ob]):
        for m in list(ob.modifiers):
            bpy.ops.object.modifier_apply(modifier=m.name)


def mark_sharp_by_angle(me, angle=40.0):
    """Smooth faces + sharp edges above `angle` (split normals without a modifier)."""
    bm = bmesh.new()
    bm.from_mesh(me)
    lim = math.radians(angle)
    for e in bm.edges:
        if len(e.link_faces) == 2:
            e.smooth = e.calc_face_angle(0.0) < lim
        else:
            e.smooth = False
    for f in bm.faces:
        f.smooth = True
    bm.to_mesh(me)
    bm.free()


def join_objects(objs, name):
    objs = [o for o in objs if o is not None]
    target = objs[0]
    if len(objs) > 1:
        with bpy.context.temp_override(active_object=target, selected_objects=objs, selected_editable_objects=objs):
            bpy.ops.object.join()
    target.name = name
    target.data.name = name
    # the hall scene binds exact names — a stray "joy.001" would silently break it
    if target.name != name or target.data.name != name:
        raise RuntimeError(f"name {name!r} already taken (got {target.name!r} / {target.data.name!r})")
    return target


def control_group(parts, pivots, key, frame, x=0.0, y=0.0, z=0.0):
    """Own part group for a moving control (joystick, button ...). Everything appended to the
    returned list is joined into ONE object named `key` whose origin ends up at (x, y, z) in
    the panel frame `frame` (see finish()). `key` must be unique among the part groups."""
    if key in parts:
        raise RuntimeError(f"control group {key!r} defined twice")
    parts[key] = []
    pivots[key] = at(frame, x, y, z).to_translation()
    return parts[key]


def box_project_uv(ob, scale=0.35, layer="UVMap"):
    """World-space box projection so a small roughness tile repeats evenly."""
    me = ob.data
    if layer not in me.uv_layers:
        me.uv_layers.new(name=layer)
    uv = me.uv_layers[layer]
    mw = ob.matrix_world
    for poly in me.polygons:
        n = (mw.to_3x3() @ poly.normal).normalized()
        ax = max(range(3), key=lambda i: abs(n[i]))
        for li in poly.loop_indices:
            p = mw @ me.vertices[me.loops[li].vertex_index].co
            if ax == 0:
                u, v = p.y, p.z
            elif ax == 1:
                u, v = p.x, p.z
            else:
                u, v = p.x, p.y
            uv.data[li].uv = (u / scale, v / scale)


def tri_count(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


# --------------------------------------------------------------------------------------
# helpers: primitives (all authored in a local frame: X right, Y up, Z out)
# --------------------------------------------------------------------------------------


def box(name, w, h, t, mat, matrix, bevel=0.0, seg=2, center=(0.0, 0.0, 0.0)):
    """Axis-aligned box: w along X, h along Y, t along Z, centred at `center`."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(w, h, t), verts=bm.verts)
    bmesh.ops.translate(bm, vec=center, verts=bm.verts)
    ob = bm_to_object(name, bm, mat, matrix, smooth=bevel > 0)
    if bevel > 0:
        add_bevel(ob, bevel, seg)
    return ob


def cylinder(name, r, depth, mat, matrix, segs=24, center=(0.0, 0.0, 0.0), bevel=0.0, bevel_seg=2, r2=None):
    """Cylinder along local Z, base at z = center.z - depth/2."""
    segs = max(32, segs)
    bevel_seg = max(3, bevel_seg)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=r, radius2=r if r2 is None else r2, depth=depth)
    if bevel > 0:
        top = [e for e in bm.edges if all(v.co.z > 0 for v in e.verts)]
        bmesh.ops.bevel(bm, geom=top, offset=bevel, segments=bevel_seg, affect="EDGES", profile=0.5)
    bmesh.ops.translate(bm, vec=center, verts=bm.verts)
    ob = bm_to_object(name, bm, mat, matrix)
    mark_sharp_by_angle(ob.data, 40.0)
    return ob


def disc(name, r, mat, matrix, segs=8, center=(0.0, 0.0, 0.0)):
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=True, cap_tris=True, segments=segs, radius=r)
    bmesh.ops.translate(bm, vec=center, verts=bm.verts)
    return bm_to_object(name, bm, mat, matrix)


def sphere(name, r, mat, matrix, center=(0.0, 0.0, 0.0), segs=18, rings=10):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=max(32, segs), v_segments=max(18, rings), radius=r)
    bmesh.ops.translate(bm, vec=center, verts=bm.verts)
    return bm_to_object(name, bm, mat, matrix)


def quad(name, w, h, mat, matrix, z=0.0, uv_flip_u=False):
    """Single quad in the local XY plane, normal +Z, UV 0..1 (u right, v up)."""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    pts = [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]
    vs = [bm.verts.new((x, y, z)) for x, y in pts]
    f = bm.faces.new(vs)
    for lp in f.loops:
        u = (lp.vert.co.x + w / 2) / w
        v = (lp.vert.co.y + h / 2) / h
        lp[uvl].uv = (1 - u if uv_flip_u else u, v)
    return bm_to_object(name, bm, mat, matrix, smooth=False)


def curved_screen(name, w, h, bulge, mat, matrix, nx=14, ny=10, z=0.0):
    """Subdivided quad bulged towards +Z (CRT), UV 0..1 upright."""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    grid = []
    for j in range(ny + 1):
        row = []
        for i in range(nx + 1):
            u = i / nx
            v = j / ny
            x = (u - 0.5) * w
            y = (v - 0.5) * h
            # spherical-ish bulge, zero at the rim
            d = 1.0 - ((u - 0.5) * 2) ** 2 * 0.5 - ((v - 0.5) * 2) ** 2 * 0.5
            row.append(bm.verts.new((x, y, z + bulge * max(0.0, d))))
        grid.append(row)
    for j in range(ny):
        for i in range(nx):
            f = bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
            for lp in f.loops:
                lp[uvl].uv = ((lp.vert.co.x + w / 2) / w, (lp.vert.co.y + h / 2) / h)
    return bm_to_object(name, bm, mat, matrix, smooth=True)


def rounded_rect(hw, hh, r, k=4):
    """Counter-clockwise outline of a rounded rectangle (k segments per corner)."""
    r = min(r, hw, hh)
    pts = []
    for cx, cy, a0 in ((hw - r, -hh + r, -90), (hw - r, hh - r, 0), (-hw + r, hh - r, 90), (-hw + r, -hh + r, 180)):
        for i in range(k + 1):
            a = math.radians(a0 + 90 * i / k)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def frame_plate(name, w, h, hole_w, hole_h, front_z, back_z, recess, mat, matrix, bevel=0.004, seg=2, inner_bevel=0.003, hole_dy=0.0, corner=0.0):
    """Rectangular plate with a recessed window (screen bezel). Window corners are rounded
    by `corner` (CRT look). Plate centred on the origin; window centre shifted by `hole_dy`."""
    bm = bmesh.new()

    def loop(pts, z, dy=0.0):
        vs = [bm.verts.new((x, y + dy, z)) for x, y in pts]
        es = [bm.edges.new((vs[i], vs[(i + 1) % len(vs)])) for i in range(len(vs))]
        return vs, es

    rect4 = [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]
    hole = rounded_rect(hole_w / 2, hole_h / 2, corner, 4) if corner > 0 else [(-hole_w / 2, -hole_h / 2), (hole_w / 2, -hole_h / 2), (hole_w / 2, hole_h / 2), (-hole_w / 2, hole_h / 2)]
    fo, fo_e = loop(rect4, front_z)
    fi, fi_e = loop(hole, front_z, hole_dy)
    ri, _ = loop(hole, front_z - recess, hole_dy)
    bo, _ = loop(rect4, back_z)
    bmesh.ops.bridge_loops(bm, edges=fo_e + fi_e)  # front frame
    n = len(fi)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((fi[i], fi[j], ri[j], ri[i]))  # recess wall
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((bo[j], bo[i], fo[i], fo[j]))  # outer side wall (back stays open: it is buried in the shell)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    front = [f for f in bm.faces if all(abs(v.co.z - front_z) < 1e-6 for v in f.verts)]
    if front and sum(f.normal.z for f in front) < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    outer = [e for e in bm.edges if all(v in fo for v in e.verts)]
    inner = [e for e in bm.edges if all(v in fi for v in e.verts)]
    bmesh.ops.bevel(bm, geom=outer, offset=bevel, segments=seg, affect="EDGES", profile=0.5)
    bmesh.ops.bevel(bm, geom=inner, offset=inner_bevel, segments=1, affect="EDGES", profile=0.5)
    ob = bm_to_object(name, bm, mat, matrix)
    mark_sharp_by_angle(ob.data, 35.0)
    return ob


def prism_yz(name, profile, x0, x1, mat, bevel=0.0, seg=3):
    """Extrude a (y, z) polygon along X from x0 to x1. Caps triangulated."""
    bm = bmesh.new()
    a = [bm.verts.new((x0, y, z)) for y, z in profile]
    b = [bm.verts.new((x1, y, z)) for y, z in profile]
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


def tube_along(name, points, radius, mat, resolution=1):
    """Round tube through 3D points (poly curve with bevel) -> mesh."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_mode = "ROUND"
    cu.bevel_depth = radius
    cu.bevel_resolution = resolution
    cu.fill_mode = "FULL"
    cu.use_fill_caps = True
    sp = cu.splines.new("POLY")
    sp.points.add(len(points) - 1)
    for p, co in zip(sp.points, points):
        p.co = (co[0], co[1], co[2], 1.0)
    tmp = bpy.data.objects.new(name + "_curve", cu)
    COLL.objects.link(tmp)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    bpy.data.objects.remove(tmp)
    bpy.data.curves.remove(cu)
    me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    return new_object(name, me, mat)


# --------------------------------------------------------------------------------------
# geometry helpers: profile offset, panel frames
# --------------------------------------------------------------------------------------


def offset_polygon(pts, d):
    """Offset a simple polygon inward by d (pts clockwise in (y, z))."""
    n = len(pts)
    lines = []
    for i in range(n):
        (y0, z0), (y1, z1) = pts[i], pts[(i + 1) % n]
        dy, dz = y1 - y0, z1 - z0
        L = math.hypot(dy, dz)
        # clockwise -> outward normal is (-dz, dy); inward is (dz, -dy)
        ny, nz = dz / L, -dy / L
        lines.append(((y0 + ny * d, z0 + nz * d), (dy, dz)))
    out = []
    for i in range(n):
        (p0, d0) = lines[(i - 1) % n]
        (p1, d1) = lines[i]
        # intersect p0 + s*d0 = p1 + t*d1
        det = d0[0] * (-d1[1]) - d0[1] * (-d1[0])
        if abs(det) < 1e-9:
            out.append(p1)
            continue
        rx, rz = p1[0] - p0[0], p1[1] - p0[1]
        s = (rx * (-d1[1]) - rz * (-d1[0])) / det
        out.append((p0[0] + d0[0] * s, p0[1] + d0[1] * s))
    return out


def seg_frame(P0, P1, x=0.0):
    """Panel frame for profile segment P0->P1 ((y,z), P1 'above' P0).

    Columns: X = cabinet X, Y = along the segment (up), Z = outward normal.
    Origin at P0 (x, P0.y, P0.z)."""
    dy, dz = P1[0] - P0[0], P1[1] - P0[1]
    L = math.hypot(dy, dz)
    ay, az = dy / L, dz / L
    M = Matrix(((1.0, 0.0, 0.0, x), (0.0, ay, -az, P0[0]), (0.0, az, ay, P0[1]), (0.0, 0.0, 0.0, 1.0)))
    return M, L


def at(frame, x=0.0, y=0.0, z=0.0, rot=None):
    m = frame @ Matrix.Translation((x, y, z))
    if rot is not None:
        m = m @ rot
    return m


# --------------------------------------------------------------------------------------
# the upright cabinet
# --------------------------------------------------------------------------------------


class Spec:
    def __init__(self, d):
        self.name = d.get("name", "cabinet")
        self.paint = hex_rgb(d.get("paint"), (0.05, 0.08, 0.1))
        ph = (d.get("paint") or "#0E1A22").lstrip("#")
        self.paint_srgb = tuple(int(ph[i : i + 2], 16) / 255.0 for i in (0, 2, 4)) if len(ph) == 6 else (0.06, 0.1, 0.13)
        self.tmolding = hex_rgb(d.get("tmolding"), (0.3, 0.7, 0.65))
        self.accent = hex_rgb(d.get("accent"), hex_rgb("#F4F1EA"))
        self.buttons = [hex_rgb(c) for c in d.get("buttons", ["#58C2BA"] * 6)]
        while len(self.buttons) < 6:
            self.buttons.append(self.buttons[-1])
        self.H = float(d.get("height", 1.9))
        self.W = float(d.get("width", 0.76))
        self.D = float(d.get("depth", 0.8))
        self.screen_tilt = float(d.get("screenTilt", -8.0))
        self.marquee_tilt = float(d.get("marqueeTilt", 6.0))
        self.cp_angle = float(d.get("controlPanelAngle", 22.0))
        self.wear = float(d.get("wear", 0.3))
        self.variant = d.get("variant", "upright")


def upright_profile(s):
    """Side profile (y, z), clockwise from the bottom-front. Named points returned too."""
    H, D = s.H, s.D
    sd = D / 0.8
    y_front = -D / 2  # control-panel lip = front-most point
    y_lower = y_front + 0.09 * sd  # lower front is recessed
    z_cp = 0.41 * H  # control-panel box bottom
    cp_lip_h = 0.12
    cp_depth = 0.27 * sd
    a = math.radians(s.cp_angle)
    A = (y_lower, 0.0)
    B = (y_lower, z_cp)
    C = (y_front, z_cp)
    Dp = (y_front, z_cp + cp_lip_h)
    E = (y_front + cp_depth * math.cos(a), Dp[1] + cp_depth * math.sin(a))
    z_bezel_top = H - 0.345
    F = (E[0] + (z_bezel_top - E[1]) * math.tan(math.radians(-s.screen_tilt)), z_bezel_top)
    G = (y_front + 0.045 * sd, z_bezel_top + 0.135)
    Hm = (G[0] - (H - G[1]) * math.tan(math.radians(s.marquee_tilt)), H)
    J = (D / 2 - 0.07 * sd, H)
    K = (D / 2, H - 0.2)
    L = (D / 2, 0.0)
    pts = [A, B, C, Dp, E, F, G, Hm, J, K, L]
    names = dict(A=A, B=B, C=C, D=Dp, E=E, F=F, G=G, H=Hm, J=J, K=K, L=L)
    return pts, names


def build_upright(s, wear_img):
    W, H, D = s.W, s.H, s.D
    t = 0.019  # side panel thickness
    inset = 0.013  # front panels sit this far behind the side-panel edge
    iw = W - 2 * t  # inner width

    paint = material("cab_paint", s.paint, rough=0.45, coat=0.3, rough_tex=wear_img)
    trim = material("cab_tmolding", s.tmolding, rough=0.35)
    metal = material("cab_metal", grey(0.62), rough=0.4, metal=1.0)
    dark_metal = material("cab_metal_dark", grey(0.12), rough=0.5, metal=1.0)
    black = material("cab_bezel", grey(0.01), rough=0.62, spec=0.3)
    panel = material("cab_panel", grey(0.025), rough=0.6, spec=0.35)
    ring = material("cab_button_ring", grey(0.02), rough=0.4)
    ball = material("cab_joystick_ball", hex_rgb("#C8202A"), rough=0.25, coat=0.4)
    grille = material("cab_grille", grey(0.16), rough=0.5, metal=0.7)
    hole = material("cab_grille_hole", grey(0.004), rough=0.9)
    screen_m = material("cab_screen", grey(0.006), rough=0.5, spec=0.4, emit=grey(0.0), emit_strength=0.0, base_tex=tiny_tex("cab_screen_tex", (0.07, 0.07, 0.07)))
    # black base: only the specular sheen shows through the 15 % alpha (a white base would
    # render as a milky film in Eevee and three.js alike)
    glass_m = material("cab_glass", grey(0.0), rough=0.08, alpha=0.15)
    marquee_m = material("cab_marquee", grey(0.95), rough=0.4, emit=grey(1.0), emit_strength=1.0, base_tex=tiny_tex("cab_marquee_tex", (0.98, 0.98, 0.98)))
    art_m = material("cab_side_art", s.paint, rough=0.45, base_tex=tiny_tex("cab_side_art_tex", s.paint_srgb))
    card_m = material("cab_card", s.accent, rough=0.6)

    outer, P = upright_profile(s)
    inner = offset_polygon(outer, inset)
    Pi = dict(zip("ABCDEFGHJKL", inner))

    parts = {"body": [], "trim": [], "metal": [], "controls": [], "coin": [], "speaker": [], "card": []}
    pivots = {}  # control name -> world pivot (Blender axes), see control_group()

    # --- side panels + inner body -------------------------------------------------
    parts["body"].append(prism_yz("side_l", outer, -W / 2, -W / 2 + t, paint, bevel=0.004, seg=3))
    parts["body"].append(prism_yz("side_r", outer, W / 2 - t, W / 2, paint, bevel=0.004, seg=3))
    parts["body"].append(prism_yz("shell", inner, -W / 2 + t, W / 2 - t, paint, bevel=0.010, seg=4))

    # --- T-molding along the side-panel edge (front, top, back; not the bottom) ---
    edge = outer[:]  # A..L, skip L->A (bottom)
    for sx, nm in ((-1, "tmolding_l"), (1, "tmolding_r")):
        x = sx * (W / 2 - t / 2)
        pts = [(x, y, z + (0.004 if i in (0, len(edge) - 1) else 0.0)) for i, (y, z) in enumerate(edge)]
        parts["trim"].append(tube_along(nm, pts, 0.0075, trim, resolution=2))

    # --- control panel (segment D -> E, angled) -----------------------------------
    cpF, cpL = seg_frame(Pi["D"], Pi["E"])
    cp_w = iw - 0.02
    plate_t = 0.03
    cp = box("cp_plate", cp_w, cpL + 0.02, plate_t, panel, at(cpF, 0, cpL / 2 - 0.004, plate_t / 2 + 0.002), bevel=0.007, seg=3)
    parts["controls"].append(cp)
    top = plate_t + 0.002  # surface height of the plate in the frame
    # front lip strip (metal) under the panel edge
    parts["metal"].append(box("cp_lip", cp_w + 0.004, 0.012, 0.006, dark_metal, at(cpF, 0, -0.008, top - 0.012), bevel=0.0015, seg=1))
    # joystick — own object "joy", origin where the shaft enters the plate surface
    jx, jy = -0.17, cpL * 0.52
    joy = control_group(parts, pivots, "joy", cpF, jx, jy, top)
    joy.append(cylinder("joy_washer", 0.036, 0.003, ring, at(cpF, jx, jy, top + 0.0015), segs=24))
    joy.append(cylinder("joy_shaft", 0.007, 0.078, metal, at(cpF, jx, jy, top + 0.039), segs=12))
    joy.append(sphere("joy_ball", 0.0215, ball, at(cpF, jx, jy, top + 0.092), segs=24, rings=12))
    # 6 buttons, 2 rows x 3, slight arc — own objects "btn_k", origin = cap rest position on the plate
    bx0, dx = 0.045, 0.058
    rows = (cpL * 0.62, cpL * 0.40)
    arc = (0.0, 0.012, 0.0)
    k = 0
    for r, by in enumerate(rows):
        for c in range(3):
            x = bx0 + c * dx
            y = by + arc[c]
            col = s.buttons[k % len(s.buttons)]
            bm_ = material(f"cab_button_{k}", col, rough=0.28, emit=col, emit_strength=0.45)
            btn = control_group(parts, pivots, f"btn_{k}", cpF, x, y, top)
            btn.append(cylinder(f"btn_ring_{k}", 0.019, 0.006, ring, at(cpF, x, y, top + 0.003), segs=20))
            btn.append(cylinder(f"btn_cap_{k}", 0.015, 0.010, bm_, at(cpF, x, y, top + 0.008), segs=20, bevel=0.0045, bevel_seg=2))
            k += 1
    # 1P / 2P start buttons at the front-left — own objects "start_i"
    for i, x in enumerate((-0.30, -0.255)):
        sm = material(f"cab_start_{i}", s.accent, rough=0.3, emit=s.accent, emit_strength=0.3)
        st = control_group(parts, pivots, f"start_{i}", cpF, x, 0.045, top)
        st.append(cylinder(f"start_ring_{i}", 0.0125, 0.005, ring, at(cpF, x, 0.045, top + 0.0025), segs=16))
        st.append(cylinder(f"start_cap_{i}", 0.0095, 0.008, sm, at(cpF, x, 0.045, top + 0.0065), segs=16, bevel=0.003, bevel_seg=1))

    # --- bezel + screen + glass (segment E -> F) -----------------------------------
    bzF, bzL = seg_frame(Pi["E"], Pi["F"])
    bz_w, bz_h = iw - 0.03, bzL - 0.05
    sc_h = bz_h * 0.78
    sc_w = min(bz_w - 0.07, sc_h * 4 / 3)
    sc_cy = bzL / 2 + 0.03  # window sits a little high; instruction card below it
    # depth stack in the panel frame (z = 0 is the shell surface, nothing may go below it
    # or the shell occludes it): screen base 0.001 + bulge 0.008 -> apex 0.009,
    # glass 0.011, bezel front 0.012 with a 12 mm recess down to the shell.
    bz_front, bz_back, recess = 0.012, -0.004, 0.012
    parts["controls"].append(
        frame_plate("bezel", bz_w, bz_h, sc_w, sc_h, bz_front, bz_back, recess, black, at(bzF, 0, bzL / 2, 0), bevel=0.005, seg=3, hole_dy=sc_cy - bzL / 2, corner=0.035)
    )
    scr = curved_screen("screen", sc_w + 0.02, sc_h + 0.02, 0.008, screen_m, at(bzF, 0, sc_cy, 0.001), nx=18, ny=14)
    gl = quad("glass", sc_w + 0.006, sc_h + 0.006, glass_m, at(bzF, 0, sc_cy, bz_front - 0.001))
    # instruction card under the window
    # own mesh "card": the hall scene lays the game's controls on it as a texture
    parts["card"].append(box("card", 0.16, 0.042, 0.002, card_m, at(bzF, -bz_w / 2 + 0.13, sc_cy - sc_h / 2 - 0.04, bz_front + 0.001)))
    # bezel is oversized relative to the plate zone: overlapping the shell slightly is fine (recessed body)

    # --- speaker grilles on the overhang panel (segment F -> G) --------------------
    spF, spL = seg_frame(Pi["F"], Pi["G"])
    g_w, g_h = 0.17, min(0.095, spL - 0.05)
    for sx in (-1, 1):
        cx = sx * (iw / 2 - 0.13)
        parts["speaker"].append(box(f"grille_{sx}", g_w, g_h, 0.006, grille, at(spF, cx, spL / 2, 0.003), bevel=0.002, seg=1))
        cols, rws = 7, 3
        for r in range(rws):
            for c in range(cols):
                x = cx - g_w / 2 + 0.018 + c * (g_w - 0.036) / (cols - 1)
                y = spL / 2 - g_h / 2 + 0.017 + r * (g_h - 0.034) / max(1, rws - 1)
                parts["speaker"].append(disc(f"hole_{sx}_{r}_{c}", 0.0065, hole, at(spF, x, y, 0.0065), segs=8))

    # --- marquee (segment G -> H) ---------------------------------------------------
    mqF, mqL = seg_frame(Pi["G"], Pi["H"])
    mq_w, mq_h = iw - 0.06, mqL - 0.05
    mq = quad("marquee", mq_w, mq_h, marquee_m, at(mqF, 0, mqL / 2, 0.006))
    # lightbox surround (dark) + metal retainer strips top/bottom + side clips
    parts["controls"].append(box("mq_surround", mq_w + 0.03, mq_h + 0.03, 0.008, black, at(mqF, 0, mqL / 2, 0.001), bevel=0.003, seg=1))
    for yy in (mqL / 2 - mq_h / 2 - 0.004, mqL / 2 + mq_h / 2 + 0.004):
        parts["metal"].append(box("mq_retainer", mq_w + 0.03, 0.012, 0.007, metal, at(mqF, 0, yy, 0.0085), bevel=0.002, seg=1))
    for xx in (-mq_w / 2 - 0.006, mq_w / 2 + 0.006):
        parts["metal"].append(box("mq_clip", 0.012, mq_h + 0.02, 0.007, metal, at(mqF, xx, mqL / 2, 0.0085), bevel=0.002, seg=1))

    # --- lower front: coin door + kick plate (segment A -> B, vertical) ------------
    lfF, lfL = seg_frame(Pi["A"], Pi["B"])
    parts["front_art"] = [quad("front_art", iw - .024, lfL - .035, art_m, at(lfF, 0, lfL / 2, .0008))]
    door_w, door_h = 0.24, 0.32
    dcy = lfL * 0.60
    parts["coin"].append(box("door_frame", door_w + 0.024, door_h + 0.024, 0.006, dark_metal, at(lfF, 0, dcy, 0.001), bevel=0.002, seg=1))
    door = box("coin_door", door_w, door_h, 0.012, metal, at(lfF, 0, dcy, 0.004), bevel=0.004, seg=2)
    parts["coin"].append(door)
    dz = 0.010  # door face height in frame
    for sx in (-1, 1):
        x = sx * 0.055
        # coin-slot faceplate with slot and coin-return button
        parts["coin"].append(box(f"slot_plate_{sx}", 0.05, 0.08, 0.008, dark_metal, at(lfF, x, dcy + 0.085, dz + 0.004), bevel=0.0015, seg=1))
        parts["coin"].append(box(f"slot_{sx}", 0.005, 0.034, 0.003, hole, at(lfF, x, dcy + 0.095, dz + 0.0085)))
        parts["coin"].append(cylinder(f"coin_return_{sx}", 0.0085, 0.005, ring, at(lfF, x, dcy + 0.06, dz + 0.0105), segs=14))
        # coin entry (raised)
        parts["coin"].append(box(f"slot_lip_{sx}", 0.03, 0.008, 0.003, metal, at(lfF, x, dcy + 0.118, dz + 0.0095), bevel=0.001, seg=1))
    # lock
    parts["coin"].append(cylinder("lock", 0.0075, 0.006, dark_metal, at(lfF, door_w / 2 - 0.028, dcy + door_h / 2 - 0.03, dz + 0.003), segs=14))
    # coin-return cup at the bottom of the door
    parts["coin"].append(box("cup", 0.13, 0.055, 0.02, metal, at(lfF, 0, dcy - door_h / 2 + 0.05, dz + 0.01), bevel=0.004, seg=2))
    parts["coin"].append(box("cup_hole", 0.105, 0.028, 0.004, hole, at(lfF, 0, dcy - door_h / 2 + 0.045, dz + 0.019)))
    # kick plate
    kick_m = material("cab_kick", grey(0.3), rough=0.5, metal=1.0)
    parts["metal"].append(box("kick", iw - 0.02, 0.14, 0.008, kick_m, at(lfF, 0, 0.08, 0.004), bevel=0.003, seg=2))

    # --- side-art decal slots --------------------------------------------------------
    ya0, ya1 = min(y for y, z in outer), max(y for y, z in outer)
    za0, za1 = min(z for y, z in outer), max(z for y, z in outer)
    arts = []
    for sx, nm in ((-1, "side_art_l"), (1, "side_art_r")):
        bm = bmesh.new()
        uvl = bm.loops.layers.uv.new("UVMap")
        x = sx * (W / 2 + 0.0015)
        corners = list(outer)
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
        arts.append(bm_to_object(nm, bm, art_m, None, smooth=False))

    frames = {"marquee": (mqF, mqL), "bezel": (bzF, bzL), "cp": (cpF, cpL)}
    return parts, scr, gl, mq, arts, frames, pivots


def gltf_bbox(ob):
    """World bounding box of an object in glTF axes (x, y=up, z=front)."""
    pts = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    xs = [p.x for p in pts]
    ys = [p.z for p in pts]
    zs = [-p.y for p in pts]
    return (min(xs), min(ys), min(zs)), (max(xs), max(ys), max(zs))


# --------------------------------------------------------------------------------------
# finishing: apply modifiers, join, UVs, export
# --------------------------------------------------------------------------------------


def finish(parts, named, wear=True, pivots=None):
    from afterimage_detail import enrich
    enrich(parts, sys.modules[__name__])
    for group in parts.values():
        for ob in group:
            if ob.modifiers:
                apply_modifiers(ob)
    joined = {}
    for key, objs in parts.items():
        if objs:
            joined[key] = join_objects(objs, key)
    # box-projected UVs on painted parts (roughness tile) — keep others UV-less
    if wear and "body" in joined:
        box_project_uv(joined["body"], scale=0.35)
    all_objs = list(joined.values()) + list(named)
    # bake object transforms so every node is identity: three.js' Box3.setFromObject
    # (non-precise) over-estimates rotated nodes, which would skew the hall loader's
    # height normalisation and centring.
    with bpy.context.temp_override(active_object=all_objs[0], selected_objects=all_objs, selected_editable_objects=all_objs):
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # moving controls (control_group): origin = pivot — mesh data shifted, object location
    # set and NOT applied, so the node is exported as a pure translation with identity rotation
    for key, pivot in (pivots or {}).items():
        ob = joined[key]
        p = Vector(pivot)
        ob.data.transform(Matrix.Translation(-p))
        ob.location = p
    bpy.context.view_layer.update()
    return all_objs


def export_glb(objs, path):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    for ob in bpy.data.objects:
        ob.select_set(False)
    for ob in objs:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_animations=False,
        export_skins=False,
        export_morph=False,
        export_lights=False,
        export_cameras=False,
        export_extras=False,
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_vertex_color="NONE",
        export_attributes=False,
    )


# --------------------------------------------------------------------------------------
# preview studio (Eevee)
# --------------------------------------------------------------------------------------


def look_at(ob, target):
    d = Vector(target) - ob.location
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def build_studio(s):
    sc = bpy.context.scene
    studio = bpy.data.collections.new("studio")
    sc.collection.children.link(studio)

    # floor
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=12.0)
    me = bpy.data.meshes.new("floor")
    bm.to_mesh(me)
    bm.free()
    floor = bpy.data.objects.new("floor", me)
    studio.objects.link(floor)
    me.materials.append(material("studio_floor", grey(0.022), rough=0.38))
    floor.location.z = -0.0005

    # backdrop wall behind the cabinet (catches the rim light softly)
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=10.0)
    me = bpy.data.meshes.new("backdrop")
    bm.to_mesh(me)
    bm.free()
    wall = bpy.data.objects.new("backdrop", me)
    studio.objects.link(wall)
    me.materials.append(material("studio_wall", grey(0.016), rough=0.7))
    wall.rotation_euler = (math.radians(90), 0, 0)
    wall.location = (0, 3.2, 5.0)

    def light(name, kind, color, energy, loc, size=1.0, target=(0, 0, s.H * 0.55)):
        ld = bpy.data.lights.new(name, kind)
        ld.color = color
        ld.energy = energy
        if kind == "AREA":
            ld.shape = "SQUARE"
            ld.size = size
        ld.use_shadow = True
        ob = bpy.data.objects.new(name, ld)
        studio.objects.link(ob)
        ob.location = loc
        look_at(ob, target)
        return ob

    light("key", "AREA", (1.0, 0.80, 0.60), 520, (-2.0, -2.4, 2.9), size=1.6)
    light("rim", "AREA", (0.62, 0.80, 1.0), 380, (1.9, 1.7, 2.6), size=1.0)
    light("fill", "AREA", (0.75, 0.82, 0.95), 70, (2.4, -2.2, 1.2), size=2.5)
    light("marquee_kick", "AREA", (1.0, 0.85, 0.7), 40, (0.0, -1.2, s.H + 0.4), size=0.8, target=(0, 0, s.H - 0.15))

    world = bpy.data.worlds.new("studio_world")
    sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.012, 0.014, 0.018, 1.0)
    bg.inputs[1].default_value = 1.0

    cam_d = bpy.data.cameras.new("cam")
    cam_d.lens = 42
    cam = bpy.data.objects.new("cam", cam_d)
    studio.objects.link(cam)
    sc.camera = cam
    return cam


def dress_for_preview(s, frames):
    """Preview-only dressing applied AFTER export: marquee lettering and an 'active CRT'
    shader on the screen, so renders show the cabinet the way the hall scene will."""
    mqF, mqL = frames["marquee"]
    cu = bpy.data.curves.new("mq_text", "FONT")
    cu.body = s.name.replace("-", " ").upper()
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    mq_w = s.W - 2 * 0.019 - 0.06
    cu.size = min(0.075, mqL * 0.42, mq_w / (0.66 * max(1, len(cu.body))))
    cu.extrude = 0.0012
    cu.space_character = 1.08
    txt = bpy.data.objects.new("mq_text", cu)
    COLL.objects.link(txt)
    txt.matrix_world = at(mqF, 0, mqL / 2 - 0.004, 0.0078)
    cu.materials.append(material("preview_text", s.paint, rough=0.5))
    mqm = bpy.data.materials.get("cab_marquee")
    if mqm:
        b = mqm.node_tree.nodes["Principled BSDF"]
        b.inputs["Emission Color"].default_value = (1.0, 0.96, 0.88, 1.0)
        b.inputs["Emission Strength"].default_value = 0.9

    scm = bpy.data.materials.get("cab_screen")
    if scm:
        nt = scm.node_tree
        b = nt.nodes["Principled BSDF"]
        tc = nt.nodes.new("ShaderNodeTexCoord")
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(tc.outputs["UV"], sep.inputs["Vector"])
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].color = (0.12, 0.55, 0.5, 1.0)
        ramp.color_ramp.elements[1].color = (0.01, 0.04, 0.12, 1.0)
        nt.links.new(sep.outputs["Y"], ramp.inputs["Fac"])
        scan = nt.nodes.new("ShaderNodeMath")
        scan.operation = "SINE"
        mul = nt.nodes.new("ShaderNodeMath")
        mul.operation = "MULTIPLY"
        mul.inputs[1].default_value = 900.0
        nt.links.new(sep.outputs["Y"], mul.inputs[0])
        nt.links.new(mul.outputs[0], scan.inputs[0])
        mad = nt.nodes.new("ShaderNodeMath")
        mad.operation = "MULTIPLY_ADD"
        mad.inputs[1].default_value = 0.12
        mad.inputs[2].default_value = 0.88
        nt.links.new(scan.outputs[0], mad.inputs[0])
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1.0
        nt.links.new(ramp.outputs["Color"], mix.inputs[6])
        nt.links.new(mad.outputs[0], mix.inputs[7])
        nt.links.new(mix.outputs[2], b.inputs["Emission Color"])
        b.inputs["Emission Strength"].default_value = 1.6


def render_preview(cam, path, loc, target, s):
    sc = bpy.context.scene
    cam.location = loc
    look_at(cam, target)
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.resolution_x = 900
    sc.render.resolution_y = 700
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGB"
    ee = sc.eevee
    for attr, val in (("taa_render_samples", 96), ("use_raytracing", True), ("use_shadows", True), ("shadow_ray_count", 2), ("shadow_step_count", 4), ("use_fast_gi", True)):
        if hasattr(ee, attr):
            setattr(ee, attr, val)
    if hasattr(ee, "ray_tracing_options"):
        ee.ray_tracing_options.resolution_scale = "1"
    vs = sc.view_settings
    vs.view_transform = "AgX"
    try:
        vs.look = "AgX - Medium High Contrast"
    except Exception:
        pass
    vs.exposure = 0.35
    sc.render.filepath = os.path.abspath(path)
    bpy.ops.render.render(write_still=True)


# --------------------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------------------


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--spec", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--preview", default=None, help="directory for preview-3q.png / preview-front.png")
    ap.add_argument("--variant", default=None, choices=["upright", "cocktail", "kiosk"])
    ap.add_argument("--blend", default=None, help="save a .blend for debugging")
    args = ap.parse_args(argv)

    with open(args.spec, "r", encoding="utf-8") as fh:
        spec = Spec(json.load(fh))
    if args.variant:
        spec.variant = args.variant

    bpy.ops.wm.read_factory_settings(use_empty=True)
    global COLL
    COLL = bpy.data.collections.new("cabinet")
    bpy.context.scene.collection.children.link(COLL)
    bpy.context.scene.unit_settings.system = "METRIC"

    wear_img = make_wear_image(128, base=0.45, amp=spec.wear) if spec.wear > 0 else None

    if spec.variant == "upright":
        parts, scr, gl, mq, arts, frames, pivots = build_upright(spec, wear_img)
    elif spec.variant == "cocktail":
        # TODO(cocktail): low table body, screen facing up under a glass top, two control
        # panels at the short ends, marquee replaced by an edge-lit top rim.
        raise SystemExit("variant 'cocktail' is a stub — only 'upright' is implemented yet")
    elif spec.variant == "kiosk":
        # TODO(kiosk): slim pedestal, portrait screen, no control panel, small header.
        raise SystemExit("variant 'kiosk' is a stub — only 'upright' is implemented yet")

    objs = finish(parts, [scr, gl, mq, *arts], wear=wear_img is not None, pivots=pivots)

    # stats
    total = 0
    for ob in objs:
        n = tri_count(ob)
        total += n
        print(f"[cabinet]   {ob.name:<12} {n:>6} tris")
    print(f"[cabinet] total {total} tris, {len(objs)} meshes, {len(bpy.data.materials)} materials")
    for ob in (scr, mq, gl, *arts):
        lo, hi = gltf_bbox(ob)
        print(f"[cabinet]   {ob.name:<12} glTF bbox x {lo[0]:+.3f}..{hi[0]:+.3f}  y {lo[1]:.3f}..{hi[1]:.3f}  z {lo[2]:+.3f}..{hi[2]:+.3f}")
    for key, p in pivots.items():
        print(f"[cabinet]   {key:<12} origin glTF ({p.x:+.4f}, {p.z:.4f}, {-p.y:+.4f})")

    export_glb(objs, args.out)
    print(f"[cabinet] exported {args.out} ({os.path.getsize(args.out) / 1024:.0f} KB)")

    if args.preview:
        os.makedirs(args.preview, exist_ok=True)
        dress_for_preview(spec, frames)
        cam = build_studio(spec)
        H = spec.H
        render_preview(cam, os.path.join(args.preview, "preview-3q.png"), (-2.15, -2.75, 1.55), (0.0, -0.05, H * 0.5), spec)
        render_preview(cam, os.path.join(args.preview, "preview-front.png"), (0.0, -3.45, 1.35), (0.0, 0.0, H * 0.5), spec)
        print(f"[cabinet] previews in {args.preview}")

    if args.blend:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(args.blend))


if __name__ == "__main__":
    main()
