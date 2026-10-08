"""Studio views of a saved TV-corner Blend (assembly, games close-up, the stand alone).
Vertex occlusion is shown as in the hall: each material's base colour is multiplied by the 'ao' colour attribute.
blender -b BLEND -P THIS -- OUT_DIR"""
import bpy, os, sys
from mathutils import Vector
OUT = os.path.abspath(sys.argv[sys.argv.index('--') + 1]); os.makedirs(OUT, exist_ok=True)
for m in bpy.data.materials:
    if not m.use_nodes: continue
    nt = m.node_tree; bsdf = nt.nodes.get('Principled BSDF')
    if not bsdf: continue
    attr = nt.nodes.new('ShaderNodeVertexColor'); attr.layer_name = 'ao'
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 1
    src = bsdf.inputs['Base Color']
    if src.links: nt.links.new(src.links[0].from_socket, mix.inputs['A'])
    else: mix.inputs['A'].default_value = src.default_value
    nt.links.new(attr.outputs['Color'], mix.inputs['B']); nt.links.new(mix.outputs['Result'], src)
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 64; sc.cycles.use_denoising = True; sc.cycles.device = 'GPU'
p = bpy.context.preferences.addons['cycles'].preferences; p.compute_device_type = 'OPTIX'; p.get_devices()
for d in p.devices: d.use = d.type != 'CPU'
sc.render.resolution_x = sc.render.resolution_y = 1400
cam = sc.camera
views = [('assembly', (1.2, -3.8, 1.65), (0, 0, .5), 1.4), ('games', (.65, -2, 1.2), (-.03, 0, .42), .89),
         ('lower', (.3, -2, .55), (0, 0, .2), .78), ('wing', (1.1, -1.6, 1.7), (.4, -.05, .75), .55)]
for name, loc, target, scale in views:
    cam.location = loc; cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler(); cam.data.ortho_scale = scale
    sc.render.filepath = os.path.join(OUT, name + '.png'); bpy.ops.render.render(write_still=True)
others = [o for o in bpy.data.objects if o.type == 'MESH' and o.name not in ('tv-stand', 'studio-floor')]
for o in others: o.hide_render = True
cam.location = (1.0, -3.2, 1.3); cam.rotation_euler = (Vector((0, 0, .4)) - cam.location).to_track_quat('-Z', 'Y').to_euler(); cam.data.ortho_scale = 1.45
sc.render.filepath = os.path.join(OUT, 'stand.png'); bpy.ops.render.render(write_still=True)
