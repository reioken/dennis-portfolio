import bpy, math, os
from mathutils import Vector
out=os.path.abspath('.source-assets/hall-light-bakes');os.makedirs(out,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=48;s.cycles.use_denoising=True
s.world.color=(0,0,0);s.view_settings.view_transform='Raw'
def plane(name,vertices):
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],[(0,3,2,1)] if name=='wall' else [(0,1,2,3)]);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o)
 uv=mesh.uv_layers.new(name='UVMap')
 for l in mesh.loops:uv.data[l.index].uv=[(0,0),(1,0),(1,1),(0,1)][l.vertex_index]
 return o
floor=plane('floor',[(-3.5,-1.8,0),(3.5,-1.8,0),(3.5,4.2,0),(-3.5,4.2,0)])
wall=plane('wall',[(-3.5,-1.6,0),(3.5,-1.6,0),(3.5,-1.6,5),(-3.5,-1.6,5)])
bpy.ops.mesh.primitive_cube_add(size=1,location=(0,0,.9));cab=bpy.context.object;cab.scale=(.96,.72,1.8);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
for o in [floor,wall,cab]:
 mat=bpy.data.materials.new(o.name+'-mat');mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.35,.35,.35,1);bs.inputs['Roughness'].default_value=.8;o.data.materials.append(mat)
def area(name,position,target,energy,size):
 d=bpy.data.lights.new(name,'AREA');d.energy=energy;d.shape='RECTANGLE';d.size=size;d.size_y=.7;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=position;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();return o
area('screen',(0,.42,1.35),(0,1.4,0),24,.8)
area('backwash',(0,-.55,1.8),(0,-1.6,1.9),15,1.1)
for o in [floor,wall]:
 for kind in ['bounce','contact']:
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
  img=bpy.data.images.new(o.name+'-'+kind,512,512,float_buffer=True);img.colorspace_settings.name='Non-Color'
  nodes=o.active_material.node_tree.nodes;n=nodes.new('ShaderNodeTexImage');n.image=img;nodes.active=n
  if kind=='contact':bpy.ops.object.bake(type='AO',margin=8)
  else:bpy.ops.object.bake(type='DIFFUSE',pass_filter={'DIRECT','INDIRECT'},margin=8)
  px=list(img.pixels);peak=max(px[i] for i in range(0,len(px),4));scale=max(1,peak)
  for i in range(0,len(px),4):
   v=max(0,min(1,(px[i]+px[i+1]+px[i+2])/3/scale));px[i:i+4]=[v,v,v,1]
  img.pixels=px;img.filepath_raw=os.path.join(out,o.name+'-'+kind+'-v1.png');img.file_format='PNG';img.save();print('BAKED',img.filepath_raw,'peak',peak,flush=True)
