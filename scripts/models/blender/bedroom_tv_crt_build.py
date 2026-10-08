"""The bedroom CRT, modelled in Blender after the Sony Trinitron reference (references/crt.png).
The Tripo CRT shell is hollow behind a few flat repair quads and its generated front is lumpy, so the set gets a
clean body built to the reference's proportions (measured on the photo): front 0.50 x 0.445 m with large rounded
corners; screen opening with 8 % side margins, 13 % above and a 16 % control chin; a deep dark tube surround,
curved glass with a black tube border around the picture; a strongly tapered rear housing with top and side vents;
perforated speaker grilles, power key and standby LED, five keys with printed labels, the front AV panel and
Trinitron/SONY printing. Dennis (Oct 8, v5): "tv looks weird ... shape and screen to edge ratio".
Local frame: x right, front face at y = 0, the housing extends to +y, bottom at z = 0.
build() returns (objects, jacks) where jacks maps 'yellow'/'white'/'red' to the jack centres.
"""
import bpy, math, os
import numpy as np
from mathutils import Vector
from bedroom_tv_common import MAT, select_only, mesh, loft, rounded_loop
from hifi_gen import material, cyl, box, bevel_edges

W, H, D = .50, .47, .46
CHIN, TOP, SIDE = .092, .034, .038
SCREEN = dict(w=W - 2 * SIDE, h=H - CHIN - TOP)
SCREEN['zc'] = CHIN + SCREEN['h'] / 2
FONTS = {'serif': 'C:/Windows/Fonts/timesbd.ttf', 'bold': 'C:/Windows/Fonts/arialbd.ttf', 'italic': 'C:/Windows/Fonts/arialbi.ttf'}

def mats():
    for key, colour, rough, metal in [('crt-silver', 0xa7a9ad, .4, .32), ('crt-grille', 0x86888d, .5, .25),
                                      ('crt-surround', 0x2a2b30, .5, 0), ('crt-dark', 0x121316, .6, 0),
                                      ('crt-tube', 0x0b0c0e, .12, 0), ('crt-print', 0x2b2f38, .6, 0), ('crt-key', 0xb4b6ba, .38, .3)]:
        if key not in MAT: MAT[key] = bpy.data.materials.get(key) or material(key, colour, rough, metal)
    for key, colour in [('yellow', 0xe2b62a), ('white', 0xe6e6e2), ('red', 0xc0303c)]:
        k = 'crt-jack-' + key
        if k not in MAT: MAT[k] = bpy.data.materials.get(k) or material(k, colour, .4, 0)

def ring(w, h, r, y, zc, n=8): return [(x, y, zc + a) for x, a in rounded_loop(w, h, r, n)]

def front_text(words, x, z, size, key, font='bold', y=-.0006):
    curve = bpy.data.curves.new('crt-print', 'FONT'); curve.body = words; curve.size = size; curve.align_x = 'CENTER'
    if os.path.exists(FONTS[font]): curve.font = bpy.data.fonts.load(FONTS[font], check_existing=True)
    curve.resolution_u = 6
    t = bpy.data.objects.new('crt-print', curve); bpy.context.collection.objects.link(t)
    t.location = (x, y, z); t.rotation_euler = (math.pi / 2, 0, 0); curve.materials.append(MAT[key])
    select_only(t); bpy.ops.object.convert(target='MESH'); bpy.ops.object.transform_apply(location=True, rotation=True)
    return t

def dot_grid(name, x0, x1, z0, z1, cols, rows, r, y, key):
    verts, faces = [], []
    for i in range(cols):
        for j in range(rows):
            cx, cz = x0 + (x1 - x0) * (i + .5) / cols, z0 + (z1 - z0) * (j + .5) / rows
            base = len(verts)
            verts += [(cx + r * math.cos(a), y, cz + r * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 7)[:-1]]
            faces.append(tuple(base + k for k in reversed(range(6))))
    return mesh(name, verts, faces, key)

def key(name, x, z, r, depth, mat):
    o = cyl(name, r, x, z, -depth, .001, mat, verts=28)
    bevel_edges(o, lambda e: all(abs(v.co.y + depth) < 1e-5 for v in e.verts), min(r * .35, depth * .6), 2)
    return o

def glass_y(x, z):
    """Trinitron face plate: vertically flat, gently cylindrical across (7 mm at the centre)."""
    u = 2 * x / SCREEN['w']
    return .024 - .007 * max(0, 1 - u * u)

def build():
    mats(); parts = []
    # bezel: chamfered front frame with large rounded corners, then the step to the tapered rear housing
    bezel = [ring(W - .014, H - .014, .022, 0, H / 2), ring(W, H, .028, .008, H / 2), ring(W, H, .028, .052, H / 2),
             ring(W - .014, H - .012, .026, .06, H / 2 - .003)]
    rear = [ring(.476, .448, .03, .07, .224), ring(.45, .42, .036, .2, .21), ring(.35, .32, .04, .37, .165),
            ring(.28, .25, .04, D, .13)]
    parts.append(loft('crt-bezel', bezel, 'crt-silver', caps=False))
    parts.append(loft('crt-housing', [bezel[-1]] + rear, 'crt-silver', caps=False))
    back = rear[-1]; parts.append(mesh('crt-back', back, [tuple(range(len(back)))], 'crt-silver'))
    # front face: frame around the screen opening, control chin below it
    s = SCREEN
    opening = ring(s['w'] + .012, s['h'] + .012, .016, 0, s['zc'])
    parts.append(loft('crt-front', [bezel[0], opening], 'crt-silver', caps=False))
    recess = [opening, ring(s['w'] + .002, s['h'] + .002, .014, .006, s['zc']), ring(s['w'] - .006, s['h'] - .006, .012, .02, s['zc'])]
    parts.append(loft('crt-screen-surround', recess, 'crt-surround', caps=False))
    # black tube border on the curved glass, overlapping the picture's corners
    outer = [(x, glass_y(x, z) - .0004, z) for x, _, z in ring(s['w'] - .006, s['h'] - .006, .012, 0, s['zc'])]
    inner_w, inner_h = s['w'] - .022, s['h'] - .02
    inner = [(x, glass_y(x, z) - .0004, z) for x, _, z in ring(inner_w, inner_h, .016, 0, s['zc'])]
    n = len(outer)
    parts.append(mesh('crt-tube-border', outer + inner, [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)], 'crt-tube'))
    # the lit picture (runtime shades it as a tube with scanlines)
    verts, uv, faces = [], {}, []
    nx, ny = 48, 36
    for j in range(ny + 1):
        for i in range(nx + 1):
            u, v = i / nx, j / ny; x = (u - .5) * (inner_w + .004); z = s['zc'] + (v - .5) * (inner_h + .004)
            uv[len(verts)] = (u, v); verts.append((x, glass_y(x, z), z))
    for j in range(ny):
        for i in range(nx):
            a = j * (nx + 1) + i; faces.append((a, a + 1, a + nx + 2, a + nx + 1))
    glass = mesh('crt-screen', verts, faces, 'crt-image', uv)
    for p in glass.data.polygons: p.use_smooth = True
    parts.append(glass)
    # speaker grilles fill the chin's outer fifths, inside the front's rounded corners (reference layout)
    for cx in (-.178, .178):
        g = box('crt-grille', cx - .05, cx + .05, -.0012, .003, .016, .078, 'crt-grille')
        bevel_edges(g, lambda e: abs((e.verts[1].co - e.verts[0].co).y) > .9 * (e.verts[1].co - e.verts[0].co).length, .003, 3)
        parts += [g, dot_grid('crt-grille-holes', cx - .046, cx + .046, .02, .074, 26, 15, .00085, -.0014, 'crt-dark')]
    # power key, standby LED and the five front keys with their printing, under the SONY logo
    parts.append(front_text('SONY', 0, .064, .017, 'crt-print', 'serif'))
    parts += [key('crt-power', -.098, .036, .0072, .004, 'crt-key'), key('crt-led', -.083, .039, .0014, .0008, 'crt-jack-red')]
    parts.append(front_text('POWER', -.098, .022, .0036, 'crt-print'))
    for x in (-.058, -.038, -.018, .006, .026):
        parts.append(key('crt-key', x, .03, .0043, .0026, 'crt-key'))
    parts += [front_text('TV/VIDEO', -.058, .0385, .0032, 'crt-print'), front_text('–  VOLUME  +', -.028, .0385, .0032, 'crt-print'),
              front_text('–  CHANNEL  +', .016, .0385, .0032, 'crt-print')]
    parts.append(front_text('Trinitron', -.19, H - TOP / 2 - .003, .0085, 'crt-print', 'italic'))
    # AV panel: video (yellow), audio L (white), audio R (red)
    panel = box('crt-av-panel', .046, .106, -.0015, .004, .019, .041, 'crt-dark')
    bevel_edges(panel, lambda e: abs((e.verts[1].co - e.verts[0].co).y) > .9 * (e.verts[1].co - e.verts[0].co).length, .002, 2)
    parts.append(panel)
    jacks = {}
    for x, colour in [(.058, 'yellow'), (.076, 'white'), (.094, 'red')]:
        parts += [cyl('crt-jack', .0048, x, .03, -.0042, -.001, 'crt-jack-' + colour, verts=24),
                  cyl('crt-jack-hole', .0022, x, .03, -.0046, -.003, 'crt-dark', verts=16)]
        jacks[colour] = Vector((x, -.0046, .03))
    parts.append(front_text('VIDEO  L-AUDIO-R', .076, .012, .0034, 'crt-print'))
    # top vents follow the sloped roof; side vents follow the tapered walls
    def roof(y): return float(np.interp(y, [.07, .2, .37, D], [.448, .42, .345, .255]))
    verts, faces = [], []
    for row in range(3):
        for i in range(22):
            x = -.15 + i * .0143; y0 = .10 + row * .05; y1 = y0 + .036
            b = len(verts); verts += [(x - .0033, y0, roof(y0) + .0008), (x + .0033, y0, roof(y0) + .0008), (x + .0033, y1, roof(y1) + .0008), (x - .0033, y1, roof(y1) + .0008)]
            faces.append((b, b + 1, b + 2, b + 3))
    parts.append(mesh('crt-top-vents', verts, faces, 'crt-dark'))
    def side(y): return float(np.interp(y, [.07, .2, .37, D], [.238, .225, .175, .14])) + .0008
    verts, faces = [], []
    for sign in (-1, 1):
        for row in range(4):
            for i in range(8):
                y0 = .225 + i * .016; y1 = y0 + .007; z0 = .11 + row * .05; z1 = z0 + .034
                b = len(verts)
                quad = [(sign * side(y0), y0, z0), (sign * side(y1), y1, z0), (sign * side(y1), y1, z1), (sign * side(y0), y0, z1)]
                verts += quad if sign > 0 else list(reversed(quad)); faces.append((b, b + 1, b + 2, b + 3))
    parts.append(mesh('crt-side-vents', verts, faces, 'crt-dark'))
    for p in parts:
        select_only(p); bpy.ops.object.shade_smooth_by_angle(angle=math.radians(32))
    return parts, jacks
