"""Inspect actual downloaded Tripo GLBs; render evidence outside the checkout.
blender -b -P scripts/models/blender/bedroom_tv_tripo_audit.py -- SOURCE_DIR OUTPUT_DIR
"""
import bpy, sys, os, json, math
from mathutils import Vector

src, dst = [os.path.abspath(x) for x in sys.argv[sys.argv.index('--') + 1:]]
os.makedirs(dst, exist_ok=True)
rows = []
for filename in sorted(os.listdir(src)):
    if not filename.endswith('.glb'): continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(src, filename), merge_vertices=True)
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    bb = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    lo, hi = Vector([min(p[i] for p in bb) for i in range(3)]), Vector([max(p[i] for p in bb) for i in range(3)])
    centre = (lo + hi) / 2
    row = {'id':filename[:-4], 'min':list(lo), 'max':list(hi), 'dimensions':list(hi-lo),
           'triangles':sum(len(o.data.polygons) for o in meshes), 'uv':sum(len(o.data.uv_layers) for o in meshes),
           'images':[{'name':i.name,'size':list(i.size)} for i in bpy.data.images]}
    rows.append(row)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'; scene.cycles.samples = 16
    prefs = bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type = 'OPTIX'; prefs.get_devices()
        for device in prefs.devices: device.use = device.type != 'CPU'
        scene.cycles.device = 'GPU'
    except: scene.cycles.device = 'CPU'
    scene.render.resolution_x = 640; scene.render.resolution_y = 640; scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = 'AgX'
    scene.world = bpy.data.worlds.new('studio'); scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.16,.19,.24,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .35
    for name, loc, energy, size in [('key',(-2,-3,4),500,3),('fill',(3,-1,2),260,2),('rim',(-1,2,3),420,2)]:
        light = bpy.data.lights.new(name,'AREA'); light.energy=energy; light.shape='DISK'; light.size=size
        obj=bpy.data.objects.new(name,light);scene.collection.objects.link(obj);obj.location=loc
        obj.rotation_euler=(centre-obj.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(location=centre+Vector((1.6,-2.8,1.2)))
    cam=bpy.context.object;cam.rotation_euler=(centre-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.type='ORTHO';cam.data.ortho_scale=max(hi-lo)*1.45;scene.camera=cam
    scene.render.filepath=os.path.join(dst,filename[:-4]+'.png')
    bpy.ops.render.render(write_still=True)
    print('AUDIT',json.dumps(row),flush=True)
with open(os.path.join(dst,'audit.json'),'w') as f:json.dump(rows,f,indent=2)
