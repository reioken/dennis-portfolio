"""Surface correction of the recorded Tripo GameCube, retaining its side vents, handle and lower shell.
Use: blender -b -P THIS_SCRIPT -- SOURCE_ROOT OUTPUT_DIR RENDER_DIR
No AI atlas or selected-to-active bake is used on the corrected plastic. Printed markings use curved vector geometry.
"""
import bpy,bmesh,sys,os,math,json
from mathutils import Vector
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from bedroom_tv_common import *
from hifi_gen import rounded_box,finish,soften

src,out,render=[os.path.abspath(p) for p in sys.argv[sys.argv.index('--')+1:]]
os.makedirs(out,exist_ok=True);os.makedirs(render,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
for key,c,r,m in [('gc-indigo',0x484477,.43,0),('gc-dark',0x18191f,.45,0),
                 ('gc-face',0xbfc1bd,.48,0),('gc-slot',0xc9cac6,.5,0),
                 ('gc-contact',0xb5b3a5,.39,.65),('gc-orange',0xe9a238,.38,0),('gc-print',0xe4e4e7,.5,0)]:
    MAT[key]=material('bedroom-'+key,c,r,m)
bpy.ops.import_scene.gltf(filepath=os.path.join(src,'raw','gamecube.glb'),merge_vertices=True)
body=[o for o in bpy.data.objects if o.type=='MESH'][0];select_only(body)
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM');bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
body.name='gamecube-tripo-shell';source_count=len(body.data.polygons)
body.data.materials.clear()
for key in ['gc-indigo','gc-dark']:body.data.materials.append(MAT[key])
bm=bmesh.new();bm.from_mesh(body.data)
bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=1e-5)
remove=[]
for f in bm.faces:
    c=f.calc_center_median()
    # The generated lid, print and front socket area are the damaged surfaces; side/rear geometry stays.
    top=c.z>.516 and c.y<.370
    face=c.y<-.437 and abs(c.x)<.440 and .025<c.z<.525
    if top or face:remove.append(f);continue
    f.material_index=1 if (c.z<.045 or (c.y>.372 and c.z>.395)) else 0
bmesh.ops.delete(bm,geom=remove,context='FACES')
loose=[v for v in bm.verts if not v.link_faces]
bmesh.ops.delete(bm,geom=loose,context='VERTS')
# Relax only retained surfaces before fitting broad plastic faces to planes. Vent structure stays intact.
for _ in range(3):bmesh.ops.smooth_vert(bm,verts=list(bm.verts),factor=.28,use_axis_x=True,use_axis_y=True,use_axis_z=True)
for v in bm.verts:
    x,y,z=v.co
    vent=abs(x)>.35 and -.195<y<.225 and .135<z<.437
    if .13<z<.485 and -.405<y<.337 and abs(x)>.417 and not vent:v.co.x=math.copysign(.429,x)
    if y<-.46 and abs(x)<.397 and .475<z<.515:v.co.y=-.486
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(body.data);bm.free()
select_only(body)
dec=body.modifiers.new('retain vent topology','DECIMATE');dec.ratio=min(1,26000/len(body.data.polygons));dec.use_collapse_triangulate=True
bpy.ops.object.modifier_apply(modifier=dec.name)
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
# Analytic normals remove low-frequency AI ripples from broad side planes, without flattening vents.
normals=[]
for loop in body.data.loops:
    v=body.data.vertices[loop.vertex_index];x,y,z=v.co;n=v.normal.copy()
    vent=abs(x)>.35 and -.195<y<.225 and .135<z<.437
    if abs(x)>.417 and .13<z<.48 and -.39<y<.32 and not vent:n=Vector((math.copysign(1,x),0,0))
    normals.append(n)
body.data.normals_split_custom_set_from_vertices([v.normal for v in body.data.vertices])
body.data.normals_split_custom_set(normals)

# Retopologized top moulding. Fine seams and the separate black nameplate have physical depth.
rounded_box('gamecube-top-moulding',-.434,.434,-.492,.372,.499,.568,'gc-indigo',.016,.006)
rounded_box('gamecube-disc-cover-seam',-.335,.335,-.381,.369,.566,.570,'gc-dark',.017,.001)
rounded_box('gamecube-disc-cover',-.332,.332,-.378,.366,.570,.574,'gc-indigo',.015,.0014)
disk('gamecube-nameplate-seam',0,.010,.575,.249,.003,'gc-dark',verts=128)
disk('gamecube-nameplate',0,.010,.577,.245,.004,'gc-dark',verts=128)
for key,x,y,r in [('power',-.372,.259,.049),('reset',-.372,-.321,.043),('open',.371,-.321,.049)]:
    disk('gamecube-'+key+'-seat',x,y,.570,r+.005,.007,'gc-dark',verts=64)
    disk('gamecube-'+key+'-key',x,y,.578,r,.008,'gc-face' if key=='power' else 'gc-indigo',verts=64)
disk('gamecube-power-led',-.305,.281,.577,.006,.002,'gc-orange',verts=32)
# Coplanar, geometric printing has no texture resolution limit or raised rectangular sticker edge.
text('gamecube-nameplate-nintendo','N I N T E N D O',0,.030,.57905,.026,'gc-print',top=True)
text('gamecube-nameplate-gamecube','GAMECUBE',0,-.018,.57905,.044,'gc-print',top=True)
for words,x,y in [('POWER',-.355,.187),('RESET',-.352,-.253),('OPEN',.354,-.253)]:
    text('gamecube-'+words.lower()+'-mark',words,x,y,.575,.017,'gc-dark',top=True)
text('gamecube-nintendo-mark','Nintendo',.216,.301,.576,.029,'gc-dark',top=True)

frame=rb('gamecube-front-shell-surface',-.434,.434,-.493,-.436,.028,.522,'gc-indigo',.010,.0015,axis=1)
plate=rb('gamecube-front-fascia',-.400,.400,-.498,-.449,.119,.449,'gc-face',.008,.0018,axis=1)
for index,x in enumerate([-.285,-.095,.095,.285]):
    cutter=cyl('socket-cut',.047,x,.338,-.510,-.430,'gc-dark',verts=64);boolean(plate,cutter)
    cutter=cyl('socket-shell-cut',.047,x,.338,-.510,-.430,'gc-dark',verts=64);boolean(frame,cutter)
    disk('gamecube-socket-well',x,-.457,.338,.045,.011,'gc-dark',axis='Y',verts=64)
    # Connector tongue and six distinct contact pins, visible inside rather than a painted black dot.
    rb('gamecube-socket-tongue',x-.024,x+.024,-.474,-.465,.325,.337,'gc-dark',.004,.001,axis=1)
    for j in range(3):
        for z in [.320,.342]:disk('gamecube-socket-contact',x+(j-1)*.012,-.477,z,.0025,.002,'gc-contact',axis='Y',verts=12)
    for j in range(index+1):disk('gamecube-player-number',x+(j-index/2)*.010,-.500,.408,.0028,.001,'gc-dark',axis='Y',verts=12)
for x,words in [(-.202,'SLOT A'),(.202,'SLOT B')]:
    rb('gamecube-card-cover-seam',x-.122,x+.122,-.501,-.497,.184,.222,'gc-dark',.004,.0006,axis=1)
    rb('gamecube-card-cover',x-.119,x+.119,-.502,-.498,.187,.219,'gc-slot',.003,.0006,axis=1)
    text('gamecube-slot-mark',words,x,-.504,.151,.017,'gc-face')
soften(plate,.0012,35)
allparts=[o for o in bpy.data.objects if o.type=='MESH']
for o in allparts:
    select_only(o)
    if o!=body:
        if o.data.has_custom_normals:bpy.ops.mesh.customdata_custom_splitnormals_clear()
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
        # Broad planar n-gons must stay planar after socket booleans and triangulation.
        for p in o.data.polygons:
            if max(abs(v)for v in p.normal)>.999:p.use_smooth=False
    tri=o.modifiers.new('triangles','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=tri.name)
    o['source']='recorded Tripo GameCube, hand-corrected surfaces and markings'
for o in allparts:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(out,'gamecube.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=96;scene.cycles.use_denoising=True;scene.cycles.device='GPU'
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
for d in prefs.devices:d.use=d.type!='CPU'
scene.render.resolution_x=1400;scene.render.resolution_y=1400;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.world=bpy.data.worlds.new('neutral studio');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.15,.17,.22,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35
for name,loc,power,size in [('key',(-2,-3,3),220,2),('fill',(2,-1,1.5),90,2),('rim',(0,2,3),180,2)]:
    bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.name=name;light.data.energy=power;light.data.shape='DISK';light.data.size=size
    light.rotation_euler=(Vector((0,0,.28))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=1.30
for name,loc in [('gamecube-three-quarter',(1.6,-2.8,1.7)),('gamecube-front',(0,-3,.85))]:
    cam.location=loc;cam.rotation_euler=(Vector((0,0,.29))-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=os.path.join(render,name+'.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(src,'gamecube-surface-correction.blend'))
with open(os.path.join(render,'gamecube-correction.json'),'w')as f:json.dump({'sourceTriangles':source_count,'correctedTriangles':sum(len(o.data.polygons)for o in allparts),'pipeline':'Tripo shell retained; hand-corrected top/front; flat PBR plastic; physical controls and curved vector lettering'},f,indent=2)
