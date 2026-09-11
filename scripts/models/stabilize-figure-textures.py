"""Rebake approved material onto spaced UV charts; never generate new artwork."""
import bpy, math, json
from pathlib import Path

project = Path(__file__).resolve().parents[2]
source = project / '.source-assets/dennis/meshy-v3'
output = source / 'stable-atlas'
output.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source / 'dennis-tattoos-production.blend'))
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 1
scene.cycles.device = 'CPU'
ob = bpy.data.objects['Mesh_0']
bpy.ops.object.select_all(action='DESELECT')
ob.select_set(True)
bpy.context.view_layer.objects.active = ob
mesh = ob.data
before = {'vertices':len(mesh.vertices), 'polygons':len(mesh.polygons)}
material = ob.data.materials[0]
nt = material.node_tree
pbs = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
surface = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
original_surface = surface.inputs['Surface'].links[0].from_socket
old_uv = mesh.uv_layers.active.name
source_uv = nt.nodes.new('ShaderNodeUVMap')
source_uv.uv_map = old_uv
for node in nt.nodes:
    if node.type == 'TEX_IMAGE':
        nt.links.new(source_uv.outputs['UV'], node.inputs['Vector'])
    if node.type == 'NORMAL_MAP':
        node.uv_map = old_uv
mesh.uv_layers.new(name='StableAtlas')
mesh.uv_layers.active_index = len(mesh.uv_layers)-1
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(80), island_margin=0.001,
                         margin_method='FRACTION', area_weight=0.0, scale_to_bounds=True)
bpy.ops.object.mode_set(mode='OBJECT')
mesh.uv_layers.active.active_render = True
mesh.calc_loop_triangles()
uv_data=mesh.uv_layers.active.data
uv_area=0.0
for tri in mesh.loop_triangles:
    a,b,c=[uv_data[i].uv for i in tri.loops]
    uv_area+=abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))*0.5
print('ATLAS_COVERAGE',uv_area,flush=True)
assert uv_area>0.15, 'UV charts collapsed; reject before baking'
print('ATLAS_READY', before, flush=True)

def bake(name, socket=None, normal=False):
    image = bpy.data.images.new(name, width=4096, height=4096, alpha=False)
    image.colorspace_settings.name = 'Non-Color' if normal or name=='stable-orm' else 'sRGB'
    target = nt.nodes.new('ShaderNodeTexImage')
    target.image = image
    for node in nt.nodes: node.select=False
    target.select=True
    nt.nodes.active=target
    emitter=None
    if not normal:
        emitter=nt.nodes.new('ShaderNodeEmission')
        nt.links.new(socket, emitter.inputs['Color'])
        nt.links.new(emitter.outputs[0], surface.inputs['Surface'])
    else:
        nt.links.new(original_surface, surface.inputs['Surface'])
    bpy.ops.object.bake(type='NORMAL' if normal else 'EMIT', normal_space='TANGENT',
                       margin=24, margin_type='EXTEND', use_clear=True)
    image.filepath_raw=str(output/(name+'.png'))
    image.file_format='PNG'
    image.save()
    nt.links.new(original_surface, surface.inputs['Surface'])
    if emitter: nt.nodes.remove(emitter)
    nt.nodes.remove(target)
    print('BAKED',name,flush=True)
    return image

albedo=bake('stable-albedo', pbs.inputs['Base Color'].links[0].from_socket)
packed=nt.nodes.new('ShaderNodeCombineColor')
packed.inputs[0].default_value=1
for index, channel in [(1,'Roughness'),(2,'Metallic')]:
    socket=pbs.inputs[channel]
    if socket.is_linked: nt.links.new(socket.links[0].from_socket, packed.inputs[index])
    else: packed.inputs[index].default_value=socket.default_value
orm=bake('stable-orm',packed.outputs[0])
normal=bake('stable-normal',normal=True)

# The normal bake already includes the authored normal strength.
replacement=bpy.data.materials.new('Dennis approved tattoos — stable filtering')
replacement.use_nodes=True
nodes=replacement.node_tree.nodes
links=replacement.node_tree.links
shader=nodes.get('Principled BSDF')
shader.inputs['Roughness'].default_value=1
shader.inputs['Metallic'].default_value=0
uv=nodes.new('ShaderNodeUVMap');uv.uv_map='StableAtlas'
for img,kind in [(albedo,'albedo'),(orm,'orm'),(normal,'normal')]:
    tex=nodes.new('ShaderNodeTexImage');tex.image=img
    links.new(uv.outputs[0],tex.inputs['Vector'])
    if kind=='albedo':links.new(tex.outputs['Color'],shader.inputs['Base Color'])
    elif kind=='normal':
        nm=nodes.new('ShaderNodeNormalMap');nm.uv_map='StableAtlas'
        links.new(tex.outputs['Color'],nm.inputs['Color']);links.new(nm.outputs[0],shader.inputs['Normal'])
    else:
        split=nodes.new('ShaderNodeSeparateColor');links.new(tex.outputs['Color'],split.inputs[0])
        links.new(split.outputs[1],shader.inputs['Roughness']);links.new(split.outputs[2],shader.inputs['Metallic'])
ob.data.materials[0]=replacement
mesh.uv_layers.remove(mesh.uv_layers[old_uv])
assert before=={'vertices':len(mesh.vertices),'polygons':len(mesh.polygons)}
bpy.data.objects['Dennis_new_clean'].select_set(True)
bpy.ops.export_scene.gltf(filepath=str(output/'dennis-stable.glb'),export_format='GLB',
                         use_selection=True,export_apply=False,export_attributes=False)
(output/'bake-report.json').write_text(json.dumps({'source':str(source/'dennis-tattoos-production.blend'),
    'geometry':before,'size':4096,'margin':24,'island_margin':0.001,'uv_coverage':uv_area,'artwork':'reprojected approved textures'},indent=2))
print('STABLE_ATLAS_COMPLETE',flush=True)
