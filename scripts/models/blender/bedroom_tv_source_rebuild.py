"""TV corner v4: keep the recorded Tripo geometry, replace only its AI paint with clean material regions.
v3 replaced several sources with flat, smoothed retopology (controllers lost their depth, the N64 shell melted).
Here the actual 190k-face Tripo surface is welded; its 4K paint is read only to classify faces into a small
clean palette. The label field is cleaned on the face graph (majority filter, crease snapping, island merge),
garbled generated lettering is ironed out and reprinted as clean projected text, and the mesh is reduced.
blender -b -P THIS -- SOURCE_ROOT OUT_DIR [ids]   (writes OUT_DIR/<id>.glb + <id>.json, canonical frame)
Imported by bedroom_tv_v4_swap.py, which places the results into the v3 assembly.
"""
import bpy, bmesh, sys, os, math, json
import numpy as np
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hifi_paint import face_samples
from bedroom_tv_common import material, MAT, select_only, text
from hifi_gen import box, cyl, bevel_edges, along, boolean

# name: (hex, roughness, metal). One material per key across the corner keeps static batches low.
PALETTE = {
    'graphite': (0x2f3036, .5, 0), 'charcoal': (0x303136, .52, 0), 'black': (0x17181d, .5, 0),
    'darkgrey': (0x55575e, .5, 0), 'grey': (0x9d9ea1, .52, 0), 'lightgrey': (0xc4c5c6, .5, 0),
    'white': (0xd9dad6, .47, 0), 'indigo': (0x343079, .42, 0), 'indigo-dark': (0x2c2963, .45, 0),
    'zviolet': (0x6a5fd0, .4, 0), 'red': (0xc5303f, .4, 0), 'teal': (0x14a58c, .4, 0),
    'green': (0x1f8a45, .4, 0), 'blue': (0x2147b0, .4, 0), 'yellow': (0xf5b400, .4, 0),
    'paper': (0xcac3b2, .72, 0), 'gold': (0xb59a52, .38, .35), 'silver': (0xa9acb1, .4, .15), 'magenta': (0x9a2c58, .4, 0),
}

def lab(rgb255):
    s = np.clip(rgb255 / 255, 0, 1)
    l = np.where(s <= .04045, s / 12.92, ((s + .055) / 1.055) ** 2.4)
    M = np.array([[.4124, .3576, .1805], [.2126, .7152, .0722], [.0193, .1192, .9505]])
    xyz = l @ M.T / np.array([.9505, 1, 1.089])
    f = np.where(xyz > .008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[:, 1] - 16, 500 * (f[:, 0] - f[:, 1]), 200 * (f[:, 1] - f[:, 2])], 1)

def hexrgb(h): return np.array([(h >> 16) & 255, (h >> 8) & 255, h & 255], np.float32)

# Per piece: palette keys the AI paint may map to, each with the colour the AI painted it (matching only;
# output uses PALETTE), the target face count, and how much lightness counts against chroma.
PIECES = {
    'n64-controller': dict(target=40000, keys={
        'grey': 0xb4b4b6, 'darkgrey': 0x606064, 'yellow': 0xf2c21a, 'blue': 0x1c48c0, 'green': 0x14904a,
        'red': 0xe0242c, 'lightgrey': 0xe6e6e6}, lightness=.35),
    'gamecube-controller': dict(target=40000, keys={
        'indigo': 0x463f96, 'lightgrey': 0xc0c0c4, 'teal': 0x10a890, 'red': 0xe02a30, 'yellow': 0xf6b818,
        'darkgrey': 0x48484e, 'zviolet': 0x6658d8}, lightness=.3),
    'n64': dict(target=50000, keys={'charcoal': 0x3c3c40, 'black': 0x111114, 'grey': 0xa0a0a4}, lightness=.8),
    'snes': dict(target=50000, keys={'lightgrey': 0xc8c8c8, 'darkgrey': 0x6a6a70, 'black': 0x202024}, lightness=.8),
    'retro-games': dict(target=30000, keys={'paper': 0xd0c8b8, 'charcoal': 0x5a5a60, 'grey': 0xa0a0a4}, lightness=.8),
    'ds': dict(target=60000, keys={'silver': 0xb4b6ba, 'black': 0x18181c, 'darkgrey': 0x505258}, lightness=.7),
    'gamecube': dict(target=50000, keys={'indigo': 0x4a4396, 'lightgrey': 0xc4c4c8, 'black': 0x18181c,
        'darkgrey': 0x505058}, lightness=.45),
    'crt': dict(target=60000, keys={'silver': 0xb8b9bc, 'black': 0x1a1a1e, 'darkgrey': 0x5a5b60,
        'red': 0xc0303a, 'yellow': 0xe0b830, 'white': 0xe8e8e8}, lightness=.6),
    'gameboy': dict(target=40000, keys={'white': 0xd8d6cc, 'darkgrey': 0x6a6a72, 'black': 0x1e1e22,
        'magenta': 0x9a2c58, 'blue': 0x34407a}, lightness=.5),
    'snes-cartridge': dict(target=10000, keys={'grey': 0xa8a8ac, 'darkgrey': 0x5c5c60}, lightness=.8),
    'n64-cartridge': dict(target=10000, keys={'charcoal': 0x505054, 'gold': 0xb59a52}, lightness=.8),
}

def adjacency(bm):
    pairs = []
    for e in bm.edges:
        lf = e.link_faces
        if len(lf) == 2: pairs.append((lf[0].index, lf[1].index))
    return np.array(pairs, np.int64)

def majority(labels, pairs, k, iterations=3):
    for _ in range(iterations):
        votes = np.zeros((len(labels), k), np.float32)
        np.add.at(votes, (pairs[:, 0], labels[pairs[:, 1]]), 1)
        np.add.at(votes, (pairs[:, 1], labels[pairs[:, 0]]), 1)
        votes[np.arange(len(labels)), labels] += 1.5
        labels = votes.argmax(1)
    return labels

def components(n, pairs):
    parent = np.arange(n)
    def find(a):
        root = a
        while parent[root] != root: root = parent[root]
        while parent[a] != root: parent[a], a = root, parent[a]
        return root
    for a, b in pairs:
        ra, rb = find(a), find(b)
        if ra != rb: parent[ra] = rb
    roots = np.array([find(i) for i in range(n)])
    _, comp, size = np.unique(roots, return_inverse=True, return_counts=True)
    return comp, size

def merge_islands(labels, pairs, minimum, k):
    """Regions smaller than `minimum` faces take the label most of their border touches."""
    same = labels[pairs[:, 0]] == labels[pairs[:, 1]]
    comp, size = components(len(labels), pairs[same])
    small = size[comp] < minimum
    if not small.any(): return labels, 0
    border = pairs[~same]
    votes = np.zeros((len(size), k), np.float32)
    for a, b in ((0, 1), (1, 0)):
        sel = small[border[:, a]]
        np.add.at(votes, (comp[border[sel, a]], labels[border[sel, b]]), 1)
    out = labels.copy()
    idx = np.where(small)[0]
    has = votes[comp[idx]].sum(1) > 0
    out[idx[has]] = votes[comp[idx[has]]].argmax(1)
    return out, int(len(np.unique(comp[small])))

def snap_to_creases(labels, pairs, normal, angle=32, largest=25000, share=.5):
    """Generated paint drifts off the moulded edges. Split the surface at creases sharper than `angle`;
    every enclosed patch (key cap, gate, port ring) takes its majority colour, so boundaries follow geometry."""
    cosang = (normal[pairs[:, 0]] * normal[pairs[:, 1]]).sum(1)
    smooth = pairs[cosang > math.cos(math.radians(angle))]
    comp, size = components(len(labels), smooth)
    votes = np.zeros((len(size), labels.max() + 1), np.float32)
    np.add.at(votes, (comp, labels), 1)
    best = votes.argmax(1); frac = votes.max(1) / size
    ok = (size < largest) & (frac > share) & (size > 3)
    out = labels.copy(); sel = ok[comp]; out[sel] = best[comp[sel]]
    return out

def iron(o, region, iterations=150):
    """Smooth vertices inside region(x,y,z)->bool hard, removing illegible generated relief lettering."""
    co = np.array([v.co[:] for v in o.data.vertices])
    inside = np.where(region(co[:, 0], co[:, 1], co[:, 2]))[0]
    if len(inside) == 0: return 0
    vg = o.vertex_groups.new(name='iron'); vg.add([int(i) for i in inside], 1.0, 'REPLACE')
    m = o.modifiers.new('iron', 'SMOOTH'); m.factor = 1.0; m.iterations = iterations; m.vertex_group = 'iron'
    select_only(o); bpy.ops.object.modifier_apply(modifier=m.name)
    o.vertex_groups.remove(o.vertex_groups['iron'])
    return len(inside)

def flatten(o, region, up=.8, axis=2):
    """Planar mouldings: project vertices in region whose normal points along +axis (or -Y for axis 1)
    onto their least-squares plane, solving for that axis."""
    me = o.data
    co = np.array([v.co[:] for v in me.vertices]); nrm = np.array([v.normal[:] for v in me.vertices])
    facing = nrm[:, 2] > up if axis == 2 else -nrm[:, 1] > up
    sel = np.where(region(co[:, 0], co[:, 1], co[:, 2]) & facing)[0]
    if len(sel) < 10: return 0
    a, b = [i for i in range(3) if i != axis]
    A = np.stack([np.ones(len(sel)), co[sel, a], co[sel, b]], 1)
    k = np.linalg.lstsq(A, co[sel, axis], rcond=None)[0]
    for i, v in zip(sel, A @ k): me.vertices[int(i)].co[axis] = float(v)
    me.update(); return len(sel)

def cap(o, key, cx, cy, rx, ry, shape='rect', lift=.0012):
    """A clean planar top over a generated moulding whose few large triangles shade unevenly (N64 lid, keys).
    The plane is fitted to the source vertices under it and lifted just above the highest one."""
    co = np.array([v.co[:] for v in o.data.vertices]); x, y, z = co.T
    inside = (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1) if shape == 'disc' else ((np.abs(x - cx) < rx) & (np.abs(y - cy) < ry))
    inside &= z > z.max() * .5
    A = np.stack([np.ones(inside.sum()), x[inside], y[inside]], 1)
    k = np.linalg.lstsq(A, z[inside], rcond=None)[0]; lift += (z[inside] - A @ k).max()
    MAT[key] = mat_for(key)
    if shape == 'disc':
        ring = [(cx + rx * math.cos(t), cy + ry * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 33)[:-1]]
        pts = [(cx, cy)] + ring; faces = [(0, i + 1, (i + 1) % 32 + 1) for i in range(32)]
    else:
        r = min(rx, ry) * .18; ring = []
        for qx, qy, a0 in [(1, 1, 0), (-1, 1, 90), (-1, -1, 180), (1, -1, 270)]:
            for t in np.linspace(math.radians(a0), math.radians(a0 + 90), 5):
                ring.append((cx + qx * (rx - r) + r * math.cos(t), cy + qy * (ry - r) + r * math.sin(t)))
        pts = [(cx, cy)] + ring; faces = [(0, i + 1, (i + 1) % len(ring) + 1) for i in range(len(ring))]
    verts = [(px, py, float(k[0] + k[1] * px + k[2] * py + lift)) for px, py in pts]
    m = bpy.data.meshes.new('cap'); m.from_pydata(verts, [], faces); m.update()
    t = bpy.data.objects.new('cap', m); bpy.context.collection.objects.link(t); m.materials.append(MAT[key])
    return t

def load_source(src, name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(src, 'textured', name + '.glb'), merge_vertices=True)
    new = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
    select_only(new[0])
    for o in new: o.select_set(True)
    if len(new) > 1: bpy.ops.object.join()
    o = bpy.context.object
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM'); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for e in [x for x in bpy.data.objects if x not in before and x != o]: bpy.data.objects.remove(e, do_unlink=True)
    # Canonical frame as v2/v3: centred X/Y, lowest point Z=0.
    co = np.array([v.co[:] for v in o.data.vertices])
    lo, hi = co.min(0), co.max(0)
    shift = Vector((-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]))
    for v in o.data.vertices: v.co += shift
    return o

def mat_for(key):
    name = 'bedroom-v4-' + key
    m = bpy.data.materials.get(name)
    if m is None:
        c, r, me = PALETTE[key]; m = material(name, c, r, me)
    return m

def classify(o, src, name, spec):
    keys = list(spec['keys'])
    c, n, rgb = face_samples(o.data, os.path.join(src, 'tex', name + '-median.png'))
    # face_samples applies an sRGB encode to already-encoded byte pixels; undo it (see surface_correct).
    s = rgb / 255; rgb = np.where(s <= .04045, s / 12.92, ((s + .055) / 1.055) ** 2.4) * 255
    L = lab(rgb); P = lab(np.array([hexrgb(spec['keys'][k]) for k in keys]))
    w = np.array([spec.get('lightness', .5), 1, 1])  # shading in the paint mostly moves lightness
    d = (((L[:, None, :] - P[None]) * w) ** 2).sum(2)
    return np.argmin(d, 1).astype(np.int64), keys, c, n

def _lay_on_surface(o, t, x, a, axis, offset):
    """Move flat object t (lying in XY, facing +Z) onto o's surface at a ray hit, then wrap it to the surface."""
    from mathutils.bvhtree import BVHTree
    from mathutils import Matrix
    bvh = BVHTree.FromObject(o, bpy.context.evaluated_depsgraph_get())
    origin, direction = (Vector((x, -5, a)), Vector((0, 1, 0))) if axis == 'front' else (Vector((x, a, 5)), Vector((0, 0, -1)))
    hit, normal, *_ = bvh.ray_cast(origin, direction)
    if hit is None: raise RuntimeError('print surface missing at %s %s' % (x, a))
    if normal.dot(direction) > 0: normal = -normal
    # Rotate +Z onto the surface normal while keeping the print's X as horizontal as possible.
    zaxis = normal.normalized(); xaxis = Vector((1, 0, 0)) - zaxis * zaxis.x; xaxis.normalize()
    R = Matrix((xaxis, zaxis.cross(xaxis), zaxis)).transposed().to_4x4()
    t.matrix_world = Matrix.Translation(hit + zaxis * offset) @ R
    select_only(t); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    sw = t.modifiers.new('onto', 'SHRINKWRAP'); sw.target = o; sw.wrap_method = 'NEAREST_SURFACEPOINT'
    sw.wrap_mode = 'OUTSIDE_SURFACE'; sw.offset = offset
    bpy.ops.object.modifier_apply(modifier=sw.name)
    return t

FONTS = {'bold': 'C:/Windows/Fonts/arialbd.ttf', 'narrow': 'C:/Windows/Fonts/ARIALNB.TTF'}

def print_text(o, words, x, a, size, key, axis='front', rotation=0, offset=.0022, font=None):
    """Clean printed lettering on the actual surface. The point is found by a ray (front: along +Y at x/z;
    top: down at x/y); the text is laid in that surface's tangent plane, then wrapped to the nearest surface."""
    MAT[key] = mat_for(key)
    if font and os.path.exists(FONTS[font]):
        # Glyph outlines become mesh here; only geometry is exported, never the font file.
        curve = bpy.data.curves.new('print', 'FONT'); curve.body = words; curve.size = size; curve.align_x = 'CENTER'
        curve.font = bpy.data.fonts.load(FONTS[font], check_existing=True); curve.resolution_u = 8
        t = bpy.data.objects.new('print', curve); bpy.context.collection.objects.link(t)
        t.rotation_euler = (0, 0, rotation); curve.materials.append(MAT[key])
        select_only(t); bpy.ops.object.convert(target='MESH'); bpy.ops.object.transform_apply(rotation=True)
    else:
        t = text('print', words, 0, 0, 0, size, key, top=True, rotation=rotation)  # lies in XY, faces +Z
    return _lay_on_surface(o, t, x, a, axis, offset)

def print_disc(o, x, a, r, key, axis='top', offset=.0022, sx=1.0):
    """A flat coloured dot on the surface (emblem pieces), same placement as print_text."""
    MAT[key] = mat_for(key)
    bpy.ops.mesh.primitive_circle_add(vertices=24, radius=r, fill_type='NGON', location=(0, 0, 0))
    t = bpy.context.object; t.scale.x = sx; t.data.materials.append(MAT[key])
    select_only(t); bpy.ops.object.transform_apply(scale=True)
    return _lay_on_surface(o, t, x, a, axis, offset)

def build(src, name, log=print):
    spec = PIECES[name]; fix = FIXES.get(name, {})
    o = load_source(src, name); o.name = name
    raw_faces = len(o.data.polygons)
    labels, keys, centre, normal = classify(o, src, name, spec)
    K = {k: i for i, k in enumerate(keys)}
    # Slots first: bmesh clamps material indices to the existing slot count.
    o.data.materials.clear()
    for k in keys: o.data.materials.append(mat_for(k))
    # Weld the generated patches now; face order survives remove_doubles (no faces are removed).
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.faces.ensure_lookup_table(); bm.edges.ensure_lookup_table()
    pairs = adjacency(bm)
    labels = majority(labels, pairs, len(keys), 2)
    if 'rules' in fix: labels = fix['rules'](labels, K, centre, normal)
    labels = snap_to_creases(labels, pairs, normal, fix.get('crease', 32))
    labels, merged = merge_islands(labels, pairs, fix.get('island', 60), len(keys))
    labels = majority(labels, pairs, len(keys), 1)
    if 'final' in fix: labels = fix['final'](labels, K, centre, normal)
    for f in bm.faces: f.material_index = int(labels[f.index])
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(o.data); bm.free()
    for layer in list(o.data.color_attributes): o.data.color_attributes.remove(layer)
    while o.data.uv_layers: o.data.uv_layers.remove(o.data.uv_layers[0])
    for region in fix.get('iron', []): log('IRON %d vertices' % iron(o, region))
    for f in fix.get('flatten', []): log('FLAT %d vertices' % flatten(o, *f))
    select_only(o)
    ratio = min(1, spec['target'] / len(o.data.polygons))
    if ratio < 1:
        d = o.modifiers.new('reduce', 'DECIMATE'); d.ratio = ratio; d.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=d.name)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(38))
    caps = [cap(o, *c[:5], **(c[5] if len(c) > 5 else {})) for c in fix.get('caps', [])]
    if 'post' in fix: caps += fix['post'](o)
    if caps:  # join first, so lettering lands on the clean caps
        select_only(o)
        for t in caps: t.select_set(True)
        bpy.context.view_layer.objects.active = o; bpy.ops.object.join()
    prints = [print_text(o, *p[:5], **(p[5] if len(p) > 5 else {})) for p in fix.get('prints', [])]
    prints += [print_disc(o, *p[:4], **(p[4] if len(p) > 4 else {})) for p in fix.get('discs', [])]
    if prints:
        select_only(o)
        for t in prints: t.select_set(True)
        bpy.context.view_layer.objects.active = o; bpy.ops.object.join()
    counts = np.bincount([p.material_index for p in o.data.polygons], minlength=len(o.data.materials))
    info = {'id': name, 'sourceFaces': raw_faces, 'faces': len(o.data.polygons), 'mergedIslands': merged,
            'prints': len(prints), 'regions': {o.data.materials[i].name: int(counts[i]) for i in range(len(counts))}}
    log('REBUILD ' + json.dumps(info))
    o['tripoReference'] = name
    o['v4Rebuild'] = 'Recorded Tripo surface kept; AI paint only classifies clean material regions'
    return o, info

# ---- per-piece corrections, canonical Tripo coordinates (X right, Y back, Z up; the front faces -Y) ----
def _disc(x, z, cx, cz, r): return (x - cx) ** 2 + (z - cz) ** 2 < r * r

def _n64c_rules(l, K, c, n):
    x, y, z = c.T
    stick = _disc(x, z, 0, .51, .065) & (y < -.05)
    l[(l == K['lightgrey']) & ~stick] = K['grey']
    shoulder = (np.abs(x) > .16) & (np.abs(x) < .44) & (y > .14) & (z > .55)
    l[shoulder & (l == K['lightgrey'])] = K['darkgrey']
    return l

def _n64c_final(l, K, c, n):
    x, y, z = c.T
    # The analogue gate is a clean dark octagon around the stick, not the paint's ragged blot.
    dx, dz = np.abs(x) / .094, np.abs(z - .445) / .075
    gate = (np.maximum(np.maximum(dx, dz), (dx + dz) / 1.35) < 1) & (y < -.02)
    l[gate & (l != K['lightgrey'])] = K['darkgrey']
    # L/R shoulder keys: whole moulding dark grey (the paint streaked body grey across them).
    shoulder = (np.abs(x) > .2) & (np.abs(x) < .43) & (y > .165) & (z > .55)
    l[shoulder] = K['darkgrey']
    return l

def _n64c_iron(x, y, z):
    logo = (np.abs(x) < .105) & (z > .683) & (z < .73)
    keys = _disc(x, z, 0, .578, .03) | _disc(x, z, .181, .578, .03) | _disc(x, z, .257, .525, .03)
    return (y < .05) & (logo | keys)

def _gcc_final(l, K, c, n):
    x, y, z = c.T
    front = y < 0
    # Yellow belongs to the C-stick cap only; its octagonal gate is body indigo.
    l[(l == K['yellow']) & ~(_disc(x, z, .156, .376, .066) & front)] = K['indigo']
    # The generated logo/START lettering was painted light grey; it is reprinted, so its faces are body.
    text = ((np.abs(x) < .14) & (z > .64) & (z < .72)) | ((np.abs(x) < .065) & (z > .553) & (z < .595))
    l[text & (y < .15) & (l == K['lightgrey'])] = K['indigo']
    return l

def _gcc_iron(x, y, z):
    logo = (np.abs(x) < .135) & (z > .645) & (z < .715)
    start = (np.abs(x) < .062) & (z > .556) & (z < .592)
    keys = (_disc(x, z, .273, .56, .03) | _disc(x, z, .183, .50, .022) | _disc(x, z, .385, .592, .016)
            | _disc(x, z, .257, .651, .016))
    return (y < .15) & (logo | start | keys)

def _n64_final(l, K, c, n):
    x, y, z = c.T
    badge = (np.abs(x) < .096) & (z > .133) & (z < .24) & (y < -.3)
    l[badge] = K['black']
    l[(l == K['black']) & (n[:, 2] > .6) & (z > .19)] = K['charcoal']
    # Light grey belongs to the port rings and the cartridge slot insert only; elsewhere on the top it was
    # generated lettering paint (MEMORY EXPANSION, POWER, RESET), now reprinted.
    slot = (np.abs(x) < .26) & (y > -.02) & (y < .22)
    l[(l == K['grey']) & (z > .19) & ~slot] = K['charcoal']
    return l

def _n64_iron(x, y, z):
    top = z > .19
    logo = (np.abs(x) < .07) & (y > .25) & (y < .286)
    power = (np.abs(x + .234) < .04) & (y > -.30) & (y < -.262)
    onoff = (np.abs(x + .298) < .015) & (y > -.26) & (y < -.20)
    reset = (np.abs(x - .229) < .04) & (y > -.29) & (y < -.255)
    lid = (np.abs(x) < .1) & (y > -.33) & (y < -.20)
    badge = (np.abs(x) < .088) & (z > .14) & (z < .235) & (y < -.2)
    return (top & (logo | power | onoff | reset | lid)) | badge

def _snes_iron(x, y, z):
    top = z > .2
    logo = (x > -.32) & (x < -.03) & (y > -.42) & (y < -.33)
    keys = (np.abs(y + .236) < .016) & ((np.abs(x + .238) < .06) | (np.abs(x) < .07) | (np.abs(x - .234) < .06))
    emblem = (x - .261) ** 2 + (y - .248) ** 2 < .05 ** 2
    return top & (logo | keys | emblem)

def _snes_final(l, K, c, n):
    x, y, z = c.T
    # dark paint dashes on the upper rims are AI shading, not parts; side vents (|n.x| high, lower) stay dark
    rim = (z > .2) & (n[:, 2] > .25) & ((np.abs(x) > .40) | (np.abs(y) > .40))
    l[rim & (l != K['lightgrey'])] = K['lightgrey']
    top = (z > .2) & (n[:, 2] > .5)
    logo = (x > -.33) & (x < -.02) & (y > -.46) & (y < -.33)
    l[(z > .2) & logo & (l == K['black'])] = K['lightgrey']
    return l

def _single(key):
    def f(l, K, c, n): l[:] = K[key]; return l
    return f

def _pile_final(l, K, c, n):
    x, y, z = c.T
    # Two stacked SNES boxes, an N64 cartridge standing at the right, one lying left, a SNES cartridge
    # lying label-down. Each object gets one clean shell colour; labels are applied in the assembly.
    l[:] = K['paper']
    upright = (x > .19) & (np.abs(y) < .06)
    lying64 = (x < -.096) & (y < -.105)
    snescart = (x >= -.096) & (y < -.105)
    l[upright | lying64] = K['charcoal']
    l[snescart] = K['grey']
    # Box footprint (top-view quad, corners measured on the ortho map) stays paper.
    quad = np.array([(-.472, .449), (.215, .426), (.188, -.124), (-.481, -.018)])
    inside = np.ones(len(x), bool)
    for i in range(4):
        (ax, ay), (bx, by) = quad[i], quad[(i + 1) % 4]
        inside &= (bx - ax) * (y - ay) - (by - ay) * (x - ax) <= .004
    l[inside & ~upright] = K['paper']
    return l

def _cart_label_iron(x0, x1, z0, z1):
    return lambda x, y, z: (y < 0) & (x > x0) & (x < x1) & (z > z0) & (z < z1)

def _ds_iron(x, y, z):
    keys = (x > .31) & (x < .45) & (y > .045) & (y < .08)
    mic = (np.abs(x + .009) < .03) & (y > -.325) & (y < -.295)
    return (z < .2) & (keys | mic)

GC_PORTS = [-.225, -.075, .075, .225]

def _gc_iron(x, y, z):
    top = z > .5
    disc = (x + .002) ** 2 + (y + .057) ** 2 < .2 ** 2
    logo = (np.abs(x - .2) < .07) & (np.abs(y - .227) < .012)
    # embossed POWER / RESET / OPEN beside the keys (generated as garbled relief)
    labels = (((x + .262) ** 2 + (y - .185) ** 2 < .035 ** 2) | ((x + .262) ** 2 + (y + .282) ** 2 < .035 ** 2)
              | ((x - .262) ** 2 + (y + .282) ** 2 < .035 ** 2))
    front = y < -.4
    dots = np.zeros(len(x), bool)
    for px in GC_PORTS: dots |= (np.abs(x - px) < .03) & (z > .395) & (z < .425)
    slots = (np.abs(np.abs(x) - .151) < .05) & (z > .175) & (z < .2)
    return (top & (disc | logo | labels)) | (front & (dots | slots))

def _gc_front_plate(o):
    """The light-grey port fascia, authored: the generated one is too sparse to stay flat. It sits on the
    Tripo front at its measured place (77 % of the width, as on the real console), with four port holes,
    socket interiors and two recessed memory-card doors."""
    co = np.array([v.co[:] for v in o.data.vertices]); x, y, z = co.T
    front = y[(np.abs(x) < .3) & (z > .15) & (z < .43)].min()
    for k in ['lightgrey', 'black', 'darkgrey']: MAT[k] = mat_for(k)
    y0, y1 = front - .009, front + .012
    plate = box('gc-fascia', -.312, .312, y0, y1, .126, .449, 'lightgrey')
    bevel_edges(plate, along(1), .012, 4)
    bevel_edges(plate, lambda e: all(abs(v.co.y - y0) < 1e-5 for v in e.verts), .0035, 2)
    for px in GC_PORTS:
        boolean(plate, cyl('cut', .043, px, .349, y0 - .02, y1 + .02, 'black', verts=40))
    for sx in (-.1825, .1775):
        boolean(plate, box('cut', sx - .107, sx + .107, y0 - .02, y0 + .004, .207, .249, 'lightgrey'))
    parts = [plate]
    for px in GC_PORTS:
        ring = cyl('gc-port', .043, px, .349, y0 + .003, y1, 'black', verts=40)
        boolean(ring, cyl('cut', .034, px, .349, y0, y1 + .03, 'black', verts=40))
        parts += [ring, cyl('gc-port-floor', .036, px, .349, y0 + .022, y0 + .026, 'black', verts=40),
                  box('gc-port-key', px - .011, px + .011, y0 + .016, y0 + .024, .345, .353, 'black')]
    for p in parts:
        select_only(p); bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
    return parts

def _gc_panel(x, y, z):
    inside = (np.abs(x) < .305) & (z > .14) & (z < .44) & (y < -.4)
    for px in GC_PORTS: inside &= (x - px) ** 2 + (z - .349) ** 2 > .052 ** 2
    inside &= ~((np.abs(np.abs(x) - .151) < .118) & (z > .2) & (z < .255))
    return inside

def _gc_final(l, K, c, n):
    x, y, z = c.T
    panel = (np.abs(x) < .312) & (z > .135) & (z < .447) & (y < -.42) & (n[:, 1] < -.7)
    # The authored fascia covers the panel; generated grey that pokes out around it reads as spikes, so it is body colour.
    l[(y < -.40) & (l == K['lightgrey'])] = K['indigo']
    return l

FIXES = {
    'gamecube': dict(iron=[_gc_iron], final=_gc_final, post=_gc_front_plate,
        caps=[('black', -.002, -.057, .213, .213, dict(shape='disc')), ('indigo', .2, .227, .07, .013, dict(shape='disc'))],
        prints=[('N I N T E N D O', -.002, -.03, .028, 'lightgrey', dict(axis='top', font='bold')),
                ('GAMECUBE', -.002, -.085, .06, 'lightgrey', dict(axis='top', font='bold')),
                ('Nintendo', .2, .219, .022, 'indigo-dark', dict(axis='top', font='bold')),
                ('SLOT-A', -.151, .18, .016, 'darkgrey', dict(font='bold')), ('SLOT-B', .151, .18, .016, 'darkgrey', dict(font='bold'))],
        discs=[(px + (j - i / 2) * .016, .41, .0045, 'black', dict(axis='front')) for i, px in enumerate(GC_PORTS) for j in range(i + 1)]),
    'ds': dict(iron=[_ds_iron], prints=[
        ('SELECT', .339, .074, .013, 'darkgrey', dict(axis='top', font='bold')),
        ('START', .417, .074, .013, 'darkgrey', dict(axis='top', font='bold')),
        ('MIC.', .005, -.318, .013, 'darkgrey', dict(axis='top', font='bold')),
    ]),
    'snes-cartridge': dict(final=_single('grey'), iron=[_cart_label_iron(-.37, .37, .365, .612)]),
    'n64-cartridge': dict(final=_single('charcoal'), iron=[_cart_label_iron(-.228, .228, .118, .588)]),
    'retro-games': dict(final=_pile_final, iron=[_cart_label_iron(.255, .425, .045, .215)]),
    'snes': dict(iron=[_snes_iron], final=_snes_final, prints=[
        ('Nintendo', -.215, -.357, .022, 'black', dict(axis='top', font='bold')),
        ('SUPER NINTENDO', -.175, -.391, .04, 'black', dict(axis='top', font='narrow')),
        ('ENTERTAINMENT SYSTEM', -.175, -.409, .0125, 'black', dict(axis='top', font='bold')),
        ('POWER', -.238, -.243, .016, 'lightgrey', dict(axis='top', font='bold')),
        ('EJECT', 0, -.243, .016, 'lightgrey', dict(axis='top', font='bold')),
        ('RESET', .234, -.243, .016, 'lightgrey', dict(axis='top', font='bold')),
        ('PAL VERSION', 0, .045, .012, 'lightgrey', dict(axis='top')),
    ], discs=[(.237, .248, .019, 'green', dict(sx=1.2)), (.285, .248, .019, 'red', dict(sx=1.2)),
              (.261, .272, .019, 'blue', dict(sx=1.2)), (.261, .224, .019, 'yellow', dict(sx=1.2))]),
    'n64': dict(final=_n64_final, iron=[_n64_iron], crease=28, prints=[
        ('Nintendo', 0, .26, .022, 'grey', dict(axis='top', font='bold')),
        ('POWER', -.234, -.287, .014, 'grey', dict(axis='top')),
        ('ON', -.300, -.218, .011, 'grey', dict(axis='top')), ('OFF', -.300, -.246, .011, 'grey', dict(axis='top')),
        ('RESET', .229, -.281, .014, 'grey', dict(axis='top')),
        ('MEMORY EXPANSION', 0, -.318, .013, 'grey', dict(axis='top')),
        ('NINTENDO64', 0, .205, .024, 'white'),
    ], caps=[('charcoal', 0, .263, .068, .021, dict(shape='disc')), ('charcoal', 0, -.272, .098, .066), ('charcoal', .229, -.246, .029, .042, dict(shape='disc'))]),
    'gamecube-controller': dict(final=_gcc_final, iron=[_gcc_iron], prints=[
        ('N I N T E N D O', 0, .689, .019, 'lightgrey'),
        ('GAMECUBE', 0, .655, .037, 'lightgrey'),
        ('START/PAUSE', 0, .567, .016, 'lightgrey'),
        ('A', .273, .551, .03, 'indigo-dark'), ('B', .183, .493, .022, 'indigo-dark'),
    ]),
    'n64-controller': dict(rules=_n64c_rules, final=_n64c_final, iron=[_n64c_iron], prints=[
        ('Nintendo', 0, .697, .036, 'darkgrey'),
        ('START', 0, .572, .013, 'black'),
        ('B', .181, .568, .03, 'black'), ('A', .257, .515, .03, 'black'),
    ]),
}

if __name__ == '__main__' and '--' in sys.argv:
    argv = sys.argv[sys.argv.index('--') + 1:]
    SRC, OUT = [os.path.abspath(p) for p in argv[:2]]; only = argv[2:]
    os.makedirs(OUT, exist_ok=True)
    for name in (only or list(PIECES)):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        o, info = build(SRC, name)
        select_only(o)
        bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, name + '.glb'), export_format='GLB', use_selection=True, export_yup=True)
        with open(os.path.join(OUT, name + '.json'), 'w') as f: json.dump(info, f, indent=2)
