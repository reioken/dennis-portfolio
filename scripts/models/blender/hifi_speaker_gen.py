# The hi-fi's bookshelf speaker, modelled clean (Dennis, 2026-10-07: "do the same for the speakers", after the unit).
# The Tripo speaker's proportions (0.765 wide, 0.98 tall, 0.884 deep in its units) and its grille opening, which
# hifi.ts fills with its drawn perforated-steel grille; a rounded silver cabinet, the opening as a shallow recess, the
# chrome badge under it, four rubber feet, a bass port and terminals at the back. Flat materials, no textures.
#   blender -b -P scripts/models/blender/hifi_speaker_gen.py -- .source-assets/hifi/speaker-gen.glb
# Axes as Blender's (X right, Y to the back, Z up), exported Y-up.
import bpy, sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hifi_gen import MAT, material, box, cyl, bevel_edges, along, boolean, rounded_box, soften, finish, join, export
argv = sys.argv[sys.argv.index('--') + 1:]
DST = argv[0]

HALF, FRONT, BACK, HEIGHT = 0.3825, -0.442, 0.442, 0.98
# the grille's opening: hifi.ts's grillePanel (W 0.645, H 0.823 round y 0.5395, corners 0.032)
OPEN = dict(half=0.3225, z0=0.128, z1=0.951, r=0.032, depth=0.009)

bpy.ops.wm.read_factory_settings(use_empty=True)
# silver like the unit (Dennis: "they need to be silver also")
MAT.update(dict(shell=material('hifi-speaker', 0xc3c6cc, 0.38, 0.55), recess=material('hifi-speaker-recess', 0x101114, 0.7, 0.0),
                chrome=material('hifi-speaker-badge', 0xd3d6dc, 0.28, 0.9), rubber=material('hifi-speaker-rubber', 0x1a1b1f, 0.8, 0.0)))

shell = rounded_box('speaker', -HALF, HALF, FRONT, BACK, 0.012, HEIGHT, 'shell', 0.085, 0.045)
# the front and back rims rounded too, as on a moulded cabinet
bevel_edges(shell, lambda e: along(0)(e) and all(abs(v.co.y - FRONT) < 1e-4 or abs(v.co.y - BACK) < 1e-4 for v in e.verts), 0.03, 6)
cut = box('opening', -OPEN['half'], OPEN['half'], FRONT - 0.02, FRONT + OPEN['depth'], OPEN['z0'], OPEN['z1'], 'recess')
bevel_edges(cut, along(1), OPEN['r'], 6)
boolean(shell, cut)
# the bass port and the speaker terminals at the back
boolean(shell, cyl('port', 0.05, 0, 0.72, BACK - 0.06, BACK + 0.02, 'recess', verts=48))
plate = box('terminals', -0.09, 0.09, BACK - 0.004, BACK + 0.006, 0.18, 0.3, 'recess')
posts = [cyl(f'post{i}', 0.014, x, 0.24, BACK, BACK + 0.03, 'chrome', verts=24) for i, x in enumerate((-0.045, 0.045))]
soften(shell, 0.002)
badge = box('badge', -0.075, 0.075, FRONT - 0.004, FRONT + 0.002, 0.052, 0.1, 'chrome')
bevel_edges(badge, lambda e: True, 0.0015, 2)
feet = [cyl(f'foot{i}', 0.04, 0, 0, 0.0, 0.0125, 'rubber', verts=32, axis='Z', at=(sx * (HALF - 0.1), sy * (BACK - 0.1)))
        for i, (sx, sy) in enumerate([(-1, -1), (1, -1), (-1, 1), (1, 1)])]
join(shell, [plate, badge] + posts + feet)
finish(shell)
export([shell], DST)
