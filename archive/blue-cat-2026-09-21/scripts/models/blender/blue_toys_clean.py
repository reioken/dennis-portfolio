import bpy,sys,json
from pathlib import Path
from mathutils import Vector
root=Path(sys.argv[sys.argv.index('--')+1])
report=[]
for name,size in [('ball',.11),('mouse',.18)]:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 bpy.ops.import_scene.gltf(filepath=str(root/(name+'-meshy.glb')))
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
 points=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
 lo=Vector(tuple(min(p[i] for p in points) for i in range(3)));hi=Vector(tuple(max(p[i] for p in points) for i in range(3)))
 scale=size/max(hi-lo);center=(lo+hi)/2
 for o in meshes:
  o.select_set(True);bpy.context.view_layer.objects.active=o
  # Bake transforms, then normalize the Meshy geometry itself; retain its UV atlas.
  bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
  for v in o.data.vertices:
   v.co=(v.co-center)*scale
   if name=='mouse':v.co.z-=(lo.z-center.z)*scale+.06
  for p in o.data.polygons:p.use_smooth=True
  for m in o.data.materials:
   if m and m.use_nodes:
    for n in m.node_tree.nodes:
     if n.type=='BSDF_PRINCIPLED':n.inputs['Roughness'].default_value=.95;n.inputs['Metallic'].default_value=0
 report.append({'name':name,'triangles':sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons),'size':size})
 bpy.ops.export_scene.gltf(filepath=str(root/(name+'-clean.glb')),export_format='GLB',export_yup=True,export_animations=False)
(root/'model-report.json').write_text(json.dumps(report,indent=2));print(report)