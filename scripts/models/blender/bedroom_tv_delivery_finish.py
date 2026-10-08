"""Final physical ventilation cuts on the saved assembly; preserve every authored name and print surface."""
import bpy,sys,os,bmesh,json
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:];source,dest,report=[os.path.abspath(p)for p in args]
bpy.ops.wm.open_mainfile(filepath=source)
body=bpy.data.objects['nintendo-64'];vents=[o for o in bpy.data.objects if o.name.startswith('n64-top-vent')]
def hull(points):
    points=sorted(set(points))
    def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    lower=[];upper=[]
    for p in points:
        while len(lower)>1 and cross(lower[-2],lower[-1],p)<=0:lower.pop()
        lower.append(p)
    for p in reversed(points):
        while len(upper)>1 and cross(upper[-2],upper[-1],p)<=0:upper.pop()
        upper.append(p)
    return lower[:-1]+upper[:-1]
cutters=[]
for vent in vents:
    coords=[vent.matrix_world@v.co for v in vent.data.vertices];outline=hull([(p.x,p.y)for p in coords]);n=len(outline)
    bottom=min(p.z for p in coords)-.018;top=max(p.z for p in coords)+.012
    vertices=[(x,y,z)for z in [bottom,top]for x,y in outline]
    faces=[tuple(reversed(range(n))),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n)for i in range(n)]
    data=bpy.data.meshes.new('vent-volume');data.from_pydata(vertices,[],faces);data.update()
    cutter=bpy.data.objects.new('vent-volume',data);bpy.context.collection.objects.link(cutter);data.materials.append(vent.data.materials[0]);cutters.append(cutter)
for o in bpy.context.selected_objects:o.select_set(False)
for o in cutters:o.select_set(True)
bpy.context.view_layer.objects.active=cutters[0];bpy.ops.object.join();cutter=bpy.context.object
cutter.select_set(False);body.select_set(True);bpy.context.view_layer.objects.active=body
mod=body.modifiers.new('Physical upper ventilation','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter;mod.material_mode='TRANSFER';bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
for vent in vents:
    for v in vent.data.vertices:v.co.z-=.002
    vent.data.update()
for o in bpy.context.selected_objects:o.select_set(False)
pieces=[o for o in bpy.data.objects if o.type=='MESH' and o.name!='studio-floor']
for o in pieces:
    o.select_set(True);bpy.context.view_layer.objects.active=o
    mod=o.modifiers.new('Delivery triangles','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=mod.name);o.data.validate(clean_customdata=False)
bpy.ops.export_scene.gltf(filepath=dest,export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_image_format='WEBP',export_image_quality=91)
bpy.ops.wm.save_as_mainfile(filepath=source)
with open(report,'w')as f:json.dump({'physicalVentilationSlots':len(vents),'triangles':sum(len(o.data.polygons)for o in pieces),'model':dest,'source':source},f,indent=2)
