"""Close-up of every one of the fifteen piece types, rendered from the saved v4 assembly (not standalone builds).
blender -b V4_BLEND -P THIS -- OUT_DIR
Each view shows the named body plus every object whose centre lies inside its bounds (prints, labels, screens)."""
import bpy, sys, os, json, math
from mathutils import Vector
OUT = os.path.abspath(sys.argv[sys.argv.index('--') + 1]); os.makedirs(OUT, exist_ok=True)
PIECES = ['tv-stand', 'bedroom-crt', 'nintendo-gamecube', 'nintendo-snes', 'nintendo-64', 'nintendo-gameboy', 'nintendo-ds',
          'gamecube-controller', 'snes-controller', 'n64-controller', 'bedroom-retro-games',
          'bedroom-melee-case', 'bedroom-yoshi-cartridge', 'bedroom-ocarina-cartridge', 'bedroom-mario64-cartridge', 'bedroom-case-stack-0', 'bedroom-mariokart64-cartridge', 'bedroom-smash64-cartridge']
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 48; sc.cycles.use_denoising = True; sc.cycles.device = 'GPU'
sc.render.resolution_x = sc.render.resolution_y = 1100
meshes = [o for o in bpy.data.objects if o.type == 'MESH' and o.name != 'studio-floor']
def box(o):
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    return Vector([min(p[i] for p in pts) for i in range(3)]), Vector([max(p[i] for p in pts) for i in range(3)])
cam = sc.camera; cam.data.type = 'PERSP'; cam.data.lens = 85
rows = []
for name in PIECES:
    o = bpy.data.objects[name]; lo, hi = box(o)
    show = {o.name} if name == 'tv-stand' else {m.name for m in meshes if all(lo[i] - .002 <= ((box(m)[0] + box(m)[1]) / 2)[i] <= hi[i] + .002 for i in range(3))}
    for m in meshes: m.hide_render = m.name not in show
    c = (lo + hi) / 2; r = max((hi - lo).length / 2, .03)
    d = Vector((.42, -1, .62)).normalized(); cam.location = c + d * r * 3.4
    cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(OUT, name + '.png'); bpy.ops.render.render(write_still=True)
    rows.append({'piece': name, 'objects': sorted(show), 'triangles': sum(len(bpy.data.objects[n].data.polygons) for n in show)})
for m in meshes: m.hide_render = False
json.dump({'blend': bpy.data.filepath, 'pieces': rows}, open(os.path.join(OUT, 'review.json'), 'w'), indent=2)
