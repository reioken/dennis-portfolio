"""
terminal_v3_gen.py — a standing desktop terminal built as ONE cabinet (Blender 5.x, headless).

Dennis, 2026-09-19: the detailed pass on the old terminal looked pieced together. This one is built the way a real
upright is: two side panels with T-molding, and between them a single carcass whose front panels ARE the surface.
Nothing is laid on top of a panel; every detail is cut into it as a recess of a rectilinear height field:

    toe kick (steel) · pedestal with a flush service door (shadow gap, stamped vent slots, cam lock)
    shelf with one recessed light line in its front edge and a keyboard well · display panel with the screen
    recessed behind glass · speaker panel leaning over the player (stamped slots) · plain fascia and roof

No nameplate: the hall writes the name on the wall above. Native height 1.95 m, the hall's station height.
Mesh names, UV sets and the baked mask follow hero_gen.py (screen, glass, side_art_l/r, trackball, tbtn_0/1).

    blender --background --python scripts/models/blender/terminal_v3_gen.py -- \
        --spec .source-assets/models-in/mach-riftback/spec.json \
        --out  .source-assets/models-in/mach-riftback-v3/mach-riftback-v3.glb [--no-bake] [--preview <dir>]
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
from cabinet_gen import at, box, cylinder, grey, material, seg_frame, sphere  # noqa: E402

H, W, D = 1.95, 0.95, 0.78
T = 0.019  # side panel
INSET = 0.02  # front panels sit this far behind the side panels' edge
IW = W - 2 * T


# --------------------------------------------------------------------------------------
# profile
# --------------------------------------------------------------------------------------


def base_profile(tilt=10.0, top=H):
    """Side profile (y, z), clockwise from the bottom front; sharp corners, named."""
    yf = -D / 2
    a = math.radians(7.0)
    A = (yf + 0.08, 0.0)
    B = (yf + 0.08, 0.10)
    C = (yf + 0.03, 0.10)
    Dp = (yf + 0.03, 0.93)
    E = (yf, 0.93)
    F = (yf, 0.99)
    G = (yf + 0.25 * math.cos(a), 0.99 + 0.25 * math.sin(a))
    Hp = (G[0] + (1.66 - G[1]) * math.tan(math.radians(tilt)), 1.66)
    J = (Hp[0] - 0.20 * math.tan(math.radians(30.0)), 1.86)
    K = (J[0], top)
    L = (D / 2 - 0.05, top)
    Mp = (D / 2, top - 0.05)
    N = (D / 2, 0.0)
    names = "ABCDEFGHJKLMN"
    pts = [A, B, C, Dp, E, F, G, Hp, J, K, L, Mp, N]
    return pts, dict(zip(names, pts))


def fillet(pts, radii, k=6):
    """Round chosen corners of a polygon: radii = {index: radius}."""
    out = []
    n = len(pts)
    for i, p in enumerate(pts):
        r = radii.get(i, 0.0)
        if r <= 0:
            out.append(p)
            continue
        p0, p1 = Vector(pts[i - 1]), Vector(pts[(i + 1) % n])
        pc = Vector(p)
        d0, d1 = (p0 - pc).normalized(), (p1 - pc).normalized()
        half = math.acos(max(-1.0, min(1.0, d0.dot(d1)))) / 2
        cut = min(r / math.tan(half), (p0 - pc).length * 0.45, (p1 - pc).length * 0.45)
        rr = cut * math.tan(half)
        centre = pc + (d0 + d1).normalized() * (rr / math.sin(half))
        s, e = pc + d0 * cut, pc + d1 * cut
        a0 = math.atan2(s.y - centre.y, s.x - centre.x)
        a1 = math.atan2(e.y - centre.y, e.x - centre.x)
        da = (a1 - a0 + math.pi) % (2 * math.pi) - math.pi
        for j in range(k + 1):
            t = a0 + da * j / k
            out.append((centre.x + rr * math.cos(t), centre.y + rr * math.sin(t)))
    return out


# --------------------------------------------------------------------------------------
# a panel as a rectilinear height field: recesses are part of the surface
# --------------------------------------------------------------------------------------


def panel(name, frame, length, base_mat, recesses=(), width=IW):
    """One carcass panel in `frame` (x across, y along the profile segment, z out). `recesses` are
    (cx, cy, w, h, depth, material) in panel coordinates, later ones win. Walls take the deeper cell's material."""
    xs = {-width / 2, width / 2}
    ys = {0.0, length}
    rects = []
    for cx, cy, w, h, depth, mat in recesses:
        x0, x1 = max(-width / 2, cx - w / 2), min(width / 2, cx + w / 2)
        y0, y1 = max(0.0, cy - h / 2), min(length, cy + h / 2)
        xs.update((x0, x1))
        ys.update((y0, y1))
        rects.append((x0, x1, y0, y1, depth, mat))
    xs, ys = sorted(xs), sorted(ys)
    mats = [base_mat]

    def cell(i, j):
        mx, my = (xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2
        depth, mat = 0.0, base_mat
        for x0, x1, y0, y1, d, m in rects:
            if x0 < mx < x1 and y0 < my < y1:
                depth, mat = d, m
        return depth, mat

    grid = [[cell(i, j) for j in range(len(ys) - 1)] for i in range(len(xs) - 1)]
    bm = bmesh.new()
    cache = {}

    def vert(x, y, z):
        key = (round(x, 5), round(y, 5), round(z, 5))
        if key not in cache:
            cache[key] = bm.verts.new((x, y, z))
        return cache[key]

    def face(corners, mat):
        if mat not in mats:
            mats.append(mat)
        try:
            f = bm.faces.new([vert(*c) for c in corners])
        except ValueError:
            return
        f.material_index = mats.index(mat)

    nx, ny = len(xs) - 1, len(ys) - 1
    for i in range(nx):
        for j in range(ny):
            d, m = grid[i][j]
            x0, x1, y0, y1 = xs[i], xs[i + 1], ys[j], ys[j + 1]
            face([(x0, y0, -d), (x1, y0, -d), (x1, y1, -d), (x0, y1, -d)], m)
            if i + 1 < nx:
                d2, m2 = grid[i + 1][j]
                if abs(d2 - d) > 1e-6:  # wall on x = x1
                    wm = m2 if d2 > d else m
                    quad = [(x1, y0, -d), (x1, y0, -d2), (x1, y1, -d2), (x1, y1, -d)]
                    face(quad if d2 > d else quad[::-1], wm)
            if j + 1 < ny:
                d2, m2 = grid[i][j + 1]
                if abs(d2 - d) > 1e-6:  # wall on y = y1
                    wm = m2 if d2 > d else m
                    quad = [(x0, y1, -d), (x1, y1, -d), (x1, y1, -d2), (x0, y1, -d2)]
                    face(quad[::-1] if d2 > d else quad, wm)
    bm.faces.ensure_lookup_table()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.faces[0].normal_update()
    if bm.faces[0].normal.z < 0:
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


def offset_edges(pts, dists):
    """cabinet_gen.offset_polygon with one inward distance per edge (edge i runs from pts[i] to pts[i + 1])."""
    n = len(pts)
    lines = []
    for i in range(n):
        (y0, z0), (y1, z1) = pts[i], pts[(i + 1) % n]
        dy, dz = y1 - y0, z1 - z0
        length = math.hypot(dy, dz)
        ny, nz = dz / length, -dy / length
        lines.append(((y0 + ny * dists[i], z0 + nz * dists[i]), (dy, dz)))
    out = []
    for i in range(n):
        (p0, d0), (p1, d1) = lines[(i - 1) % n], lines[i]
        det = d0[0] * (-d1[1]) - d0[1] * (-d1[0])
        if abs(det) < 1e-9:
            out.append(p1)
            continue
        rx, rz = p1[0] - p0[0], p1[1] - p0[1]
        t = (rx * (-d1[1]) - rz * (-d1[0])) / det
        out.append((p0[0] + d0[0] * t, p0[1] + d0[1] * t))
    return out


def ring(cx, cy, w, h, gap, depth, mat):
    """Shadow gap around a w x h rectangle."""
    return [
        (cx, cy + h / 2 + gap / 2, w + 2 * gap, gap, depth, mat),
        (cx, cy - h / 2 - gap / 2, w + 2 * gap, gap, depth, mat),
        (cx - w / 2 - gap / 2, cy, gap, h, depth, mat),
        (cx + w / 2 + gap / 2, cy, gap, h, depth, mat),
    ]


def slots(cx, cy, w, n, pitch, slot_h, depth, mat):
    return [(cx, cy + (i - (n - 1) / 2) * pitch, w, slot_h, depth, mat) for i in range(n)]


# --------------------------------------------------------------------------------------
# the machine
# --------------------------------------------------------------------------------------


def build(s, M):
    sharp, P = base_profile(s.screen_tilt if s.screen_tilt else 10.0)
    names = "ABCDEFGHJKLMN"
    idx = {n: i for i, n in enumerate(names)}
    KF = 6
    tilt = s.screen_tilt if s.screen_tilt else 10.0
    # The side panels stand proud of the FRONT panels only. Their top edge is level with the roof, so nothing
    # stands up like ears beside it (radius 0.03 keeps the rounded corner on the carcass's own arc).
    low, _ = base_profile(tilt, top=H - INSET + 0.0015)
    outer = fillet(low, {idx["F"]: 0.02, idx["J"]: 0.02, idx["K"]: 0.03, idx["L"]: 0.02}, k=KF)
    carcass = fillet(sharp, {idx["K"]: 0.045, idx["L"]: 0.03}, k=KF)
    inner = cg.offset_polygon(carcass, INSET)
    Pi = dict(zip(names[: idx["K"] + 1], inner))
    M["door"] = material("mach_metal_door", grey(0.34), rough=0.5, metal=1.0)
    parts = {k: [] for k in ("body", "trim", "metal", "controls")}
    pivots = {}
    body, controls, metal = parts["body"], parts["controls"], parts["metal"]

    # side panels; the T-molding runs up the front edge and ends where the roof begins
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

    # pedestal: one panel, the service door is a shadow gap in it, the vents are stamped into the door
    pF, pL = seg("C", "D")
    dw, dh, dy = 0.60, 0.50, 0.36
    rec = [(0, dy, dw, dh, 0.0012, M["door"])]
    rec += ring(0, dy, dw, dh, 0.003, 0.006, M["hole"])
    rec += slots(0, dy - 0.12, 0.40, 9, 0.014, 0.006, 0.007, M["hole"])
    rec += [(dw / 2 - 0.035, dy + 0.02, 0.014, 0.085, 0.006, M["hole"])]  # finger pull
    # speaker slots in the panel above the door, left and right
    for sx in (-1, 1):
        rec += slots(sx * 0.27, pL - 0.085, 0.22, 5, 0.012, 0.005, 0.006, M["hole"])
    body.append(panel("pedestal", pF, pL, M["panel"], rec))
    lx, ly = dw / 2 - 0.035, dy + 0.13
    metal.append(cylinder("lock_collar", 0.013, 0.004, M["chrome"], at(pF, lx, ly, 0.0008), segs=24, bevel=0.0012, bevel_seg=2))
    metal.append(cylinder("lock_core", 0.008, 0.003, M["metal"], at(pF, lx, ly, 0.0035), segs=20, bevel=0.0008, bevel_seg=1))
    controls.append(box("lock_slot", 0.002, 0.009, 0.001, M["hole"], at(pF, lx, ly, 0.0052)))

    # shelf: underside, front edge with the ONE light line, top with the keyboard well
    body.append(panel("shelf_under", *seg("D", "E"), M["paint"]))
    eF, eL = seg("E", "F")
    body.append(panel("shelf_edge", eF, eL, M["deck"], [(0, eL / 2, IW - 0.08, 0.006, 0.003, M["seam"])]))
    cF, cL = seg("F", "G")
    kb_w, kb_d, kx, ky = 0.60, 0.135, -0.10, cL * 0.52
    body.append(panel("shelf_top", cF, cL, M["deck"], [(kx, ky, kb_w + 0.016, kb_d + 0.016, 0.005, M["black"])]))
    rows, cols = 4, 14
    px, py = (kb_w - 0.04) / (cols - 1), (kb_d - 0.03) / (rows - 1)
    for r in range(rows):
        for c in range(cols):
            if r == 0 and 4 <= c <= 9:
                continue
            key = box(f"key_{r}_{c}", px - 0.006, py - 0.006, 0.008, M["key"], at(cF, kx - kb_w / 2 + 0.02 + c * px, ky - kb_d / 2 + 0.015 + r * py, -0.001))
            hg.chamfer(key, 0.0014)
            controls.append(key)
    space = box("space_bar", 6 * px - 0.006, py - 0.006, 0.008, M["key"], at(cF, kx - kb_w / 2 + 0.02 + 6.5 * px, ky - kb_d / 2 + 0.015, -0.001))
    hg.chamfer(space, 0.0014)
    controls.append(space)
    # trackball and its two buttons: moving controls, origin at the pivot (see machine_gen.py)
    tx, ty = 0.335, cL * 0.56
    tb = cg.control_group(parts, pivots, "trackball", cF, tx, ty, 0.010)
    tb.append(cylinder("tb_ring", 0.044, 0.006, M["ring"], at(cF, tx, ty, 0.003), segs=32, bevel=0.002, bevel_seg=2))
    tb.append(sphere("tb_ball", 0.030, M["ball"], at(cF, tx, ty, 0.010), segs=24, rings=14))
    for i, x in enumerate((0.30, 0.37)):
        btn = cg.control_group(parts, pivots, f"tbtn_{i}", cF, x, cL * 0.2, 0.0)
        btn.append(cylinder(f"tbtn_ring_{i}", 0.013, 0.004, M["ring"], at(cF, x, cL * 0.2, 0.002), segs=20))
        btn.append(cylinder(f"tbtn_cap_{i}", 0.0098, 0.007, M["brand_lit"] if i == 0 else M["accent"], at(cF, x, cL * 0.2, 0.0055), segs=20, bevel=0.003, bevel_seg=2))

    # display panel: the screen sits in a recess behind its glass
    bF, bL = seg("G", "H")
    sw = 0.86
    sh = sw / 1.6
    cy = bL / 2
    body.append(panel("display", bF, bL, M["black"], [(0, cy, sw + 0.008, sh + 0.008, 0.012, M["black"])]))
    scr = cg.quad("screen", sw, sh, M["screen"], at(bF, 0, cy, -0.010))
    gl = cg.quad("glass", sw + 0.006, sh + 0.006, M["glass"], at(bF, 0, cy, -0.002))
    controls.append(cylinder("power_led", 0.0025, 0.0012, M["brand_lit"], at(bF, IW / 2 - 0.04, (cy - sh / 2) / 2, 0.0004), segs=12))

    # speaker panel leaning over the player, fascia, roof, back
    hF, hL = seg("H", "J")
    rec = []
    for sx in (-1, 1):
        rec += slots(sx * 0.24, hL / 2, 0.30, 7, 0.013, 0.005, 0.007, M["hole"])
    body.append(panel("speakers", hF, hL, M["panel"], rec))
    body.append(panel("fascia", *seg("J", "K"), M["paint"]))
    for i in range(idx["K"], len(inner) - 1):  # roof corner arcs, roof, back
        body.append(panel(f"carcass_{i}", *seg_frame(inner[i], inner[i + 1]), M["paint"]))

    arts = mg.side_art(W, 0, 0, 0, 0, M["art"], profile=outer)
    for ob in arts:  # a concave n-gon: the exporter's fan triangulation would throw a spike across the top corner
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        bmesh.ops.triangulate(bm, faces=bm.faces[:], ngon_method="EAR_CLIP")
        bm.to_mesh(ob.data)
        bm.free()
    return parts, scr, gl, arts, pivots


def finish(parts, named, pivots):
    """cabinet_gen.finish without the add-on detail pass: nothing gets laid on top of this machine."""
    for group in parts.values():
        for ob in group:
            if ob.modifiers:
                cg.apply_modifiers(ob)
    joined = {key: cg.join_objects(objs, key) for key, objs in parts.items() if objs}
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
    raw.update(height=H, width=W, depth=D, screenTilt=10)
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
    hg.unwrap_atlas(targets)
    print(f"[v3] {spec.name}: {sum(cg.tri_count(ob) for ob in objs)} tris, {len(objs)} meshes ({', '.join(ob.name for ob in objs)})")

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    if not args.no_bake:
        hg.bake_mask(objs, args.size, os.path.abspath(args.out)[:-4] + "-mask.png")
    cg.export_glb(objs, args.out)
    print(f"[v3] exported {args.out} ({os.path.getsize(args.out) / 1024:.0f} KB)")

    if args.preview:
        os.makedirs(args.preview, exist_ok=True)
        scm = bpy.data.materials.get("mach_screen")
        if scm:
            b = scm.node_tree.nodes["Principled BSDF"]
            b.inputs["Emission Color"].default_value = (0.10, 0.14, 0.25, 1.0)
            b.inputs["Emission Strength"].default_value = 1.5
        cam = cg.build_studio(spec)
        f = 1.05
        cg.render_preview(cam, os.path.join(args.preview, "v3-3q.png"), (-2.15 * f, -2.75 * f, 1.55 * f), (0.0, -0.05, H * 0.5), spec)
        cg.render_preview(cam, os.path.join(args.preview, "v3-front.png"), (0.0, -3.6 * f, 1.35 * f), (0.0, 0.0, H * 0.5), spec)
        cg.render_preview(cam, os.path.join(args.preview, "v3-side.png"), (-3.4 * f, -0.3, 1.2 * f), (0.0, 0.0, H * 0.5), spec)


if __name__ == "__main__":
    main()
