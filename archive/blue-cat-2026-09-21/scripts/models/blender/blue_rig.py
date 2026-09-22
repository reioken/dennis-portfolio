"""Build Blue's quadruped skin and in-place clips from the inspected Meshy mesh.

blender --background --python scripts/models/blender/blue_rig.py
Retains the source UV atlas. Outputs a reusable Blender master and skinned GLB.
"""
import bpy, math, json, struct, numpy as np
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion
ROOT=Path(__file__).resolve().parents[3]
WORK=ROOT/'.source-assets/blue/v3'
bpy.ops.wm.open_mainfile(filepath=str(WORK/'blue-normalized.blend'))
mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH')
mesh.name='BlueCoat'
# Reunite UV-seam vertices before skinning; UVs remain on face corners.
bpy.context.view_layer.objects.active=mesh
mesh.select_set(True)
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=.000001);bpy.ops.object.mode_set(mode='OBJECT')

# Meshy washed the amber irises toward ivory. Correct their material tint while
# retaining the original pupil, iris texture and tiny reflected highlights.
amber=mesh.data.materials[0].copy();amber.name='Blue amber eyes'
bs=amber.node_tree.nodes['Principled BSDF']
original=bs.inputs['Base Color'].links[0].from_socket
for link in list(bs.inputs['Base Color'].links):amber.node_tree.links.remove(link)
multiply=amber.node_tree.nodes.new('ShaderNodeMixRGB');multiply.blend_type='MULTIPLY'
multiply.inputs[0].default_value=1; multiply.inputs[2].default_value=(1,.58,.18,1)
amber.node_tree.links.new(original,multiply.inputs[1]);amber.node_tree.links.new(multiply.outputs[0],bs.inputs['Base Color'])
mesh.data.materials.append(amber)
for polygon in mesh.data.polygons:
    p=sum((mesh.data.vertices[i].co for i in polygon.vertices),Vector())/len(polygon.vertices)
    if p.y<-.328 and math.hypot(abs(p.x)-.0345,p.z-.403)<.0145:polygon.material_index=1

V=lambda p:Vector(p)
clamp=lambda t:max(0.,min(1.,t))
def smooth(t):
    t=clamp(t);return t*t*(3-2*t)
heads={};parents={}
def joint(name,p,parent=None):heads[name]=V(p);parents[name]=parent
joint('Root',(0,0,0))
joint('Pelvis',(0,.095,.255),'Root')
joint('Spine',(0,-.04,.264),'Pelvis')
joint('Chest',(0,-.19,.266),'Spine')
joint('Neck',(0,-.246,.328),'Chest')
joint('Head',(0,-.29,.384),'Neck')
for s,x in [('L',.064),('R',-.064)]:
    joint('Ear.'+s,(x,-.272,.446),'Head')
    joint('FrontUpper.'+s,(x,-.222,.225),'Chest')
    joint('FrontLower.'+s,(x,-.192,.115),'FrontUpper.'+s)
    joint('FrontPaw.'+s,(x,-.244,.023),'FrontLower.'+s)
    joint('HindUpper.'+s,(x,.111,.235),'Pelvis')
    joint('HindLower.'+s,(x,.193,.117),'HindUpper.'+s)
    joint('HindPaw.'+s,(x,.155,.023),'HindLower.'+s)
tail=[(0,.167,.266),(0,.235,.233),(0,.301,.238),(0,.348,.280),(0,.35,.341),(0,.328,.367)]
for i,p in enumerate(tail):joint('Tail'+str(i),p,'Pelvis' if i==0 else 'Tail'+str(i-1))
data=bpy.data.armatures.new('BlueQuadruped')
arm=bpy.data.objects.new('BlueRig',data);bpy.context.collection.objects.link(arm)
bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.object.mode_set(mode='EDIT')
for name,p in heads.items():
    b=data.edit_bones.new(name);b.head=p;b.tail=p+V((0,0,.025))
    if parents[name]:b.parent=data.edit_bones[parents[name]]
bpy.ops.object.mode_set(mode='OBJECT')
arm.show_in_front=True

def blend(a,b,t):
    t=clamp(t);out={n:w*(1-t) for n,w in a.items()}
    for n,w in b.items():out[n]=out.get(n,0)+w*t
    return out
def segment(p,a,b):
    d=b-a;t=clamp((p-a).dot(d)/d.length_squared)
    return ((p-a-d*t).length,t)
def weights(p):
    x,y,z=p
    w=blend({'Pelvis':1},{'Spine':1},smooth((.1-y)/.14))
    w=blend(w,{'Chest':1},smooth((-y-.04)/.14))
    # Restrict each leg to its own anatomical region; the belly stays on the spine.
    for leg,mask in [('Front',smooth((-.125-y)/.045)),('Hind',smooth((y-.035)/.075))]:
        side='L' if x>=0 else 'R'
        legmix=mask*(1-smooth((z-.145)/.11))
        if legmix:
            low=blend({leg+'Paw.'+side:1},{leg+'Lower.'+side:1},smooth((z-.034)/.045))
            low=blend(low,{leg+'Upper.'+side:1},smooth((z-.102)/.068))
            w=blend(w,low,legmix)
    neck=smooth((z-.24)/.09)*smooth((-.20-y)/.07)
    w=blend(w,{'Neck':1},neck)
    head=smooth((z-.30)/.055)*smooth((-.22-y)/.055)
    if y<-.32:head=1
    w=blend(w,{'Head':1},head)
    ear=smooth((z-.43)/.025)*smooth((abs(x)-.025)/.03)
    if ear:w=blend(w,{'Ear.'+('L' if x>0 else 'R'):1},ear)
    tailmix=smooth((y-.16)/.047)*smooth((z-.17)/.05)
    if tailmix:
        dist,i,t=min(((*segment(p,V(tail[i]),V(tail[i+1]))[:1],i,segment(p,V(tail[i]),V(tail[i+1]))[1]) for i in range(len(tail)-1)),key=lambda a:a[0])
        w=blend(w,{'Tail'+str(i):1-t,'Tail'+str(i+1):t},tailmix)
    w=dict(sorted(w.items(),key=lambda kv:kv[1],reverse=True)[:4]);total=sum(w.values())
    return {n:v/total for n,v in w.items() if v>.00001}
# Diffuse weights along the actual surface to remove hard classification seams.
names=list(heads);wi={n:i for i,n in enumerate(names)}
warray=np.zeros((len(mesh.data.vertices),len(names)),dtype=np.float32)
for v in mesh.data.vertices:
    for n,w in weights(v.co).items():warray[v.index,wi[n]]=w
edges=np.array([list(e.vertices) for e in mesh.data.edges]);degree=np.bincount(edges.ravel(),minlength=len(warray)).clip(1)
for iteration in range(18):
    sums=np.zeros_like(warray)
    np.add.at(sums,edges[:,0],warray[edges[:,1]])
    np.add.at(sums,edges[:,1],warray[edges[:,0]])
    warray=warray*.35+(sums/degree[:,None])*.65
for n in names:mesh.vertex_groups.new(name=n)
for v in mesh.data.vertices:
    ids=np.argsort(warray[v.index])[-4:];ws=warray[v.index,ids];ws/=max(ws.sum(),.000001)
    for i,w in zip(ids,ws):
        if w>.00001:mesh.vertex_groups[names[i]].add([v.index],float(w),'REPLACE')
mod=mesh.modifiers.new('Blue skin','ARMATURE');mod.object=arm;mesh.parent=arm

# The iris and surrounding skin close together, so no floating eyelid surface is needed.
mesh.shape_key_add(name='Basis');closed=mesh.shape_key_add(name='BlueBlink')
for v in closed.data:
    p=v.co
    side=1 if p.x>0 else -1
    dx=p.x-side*.0345;dz=p.z-.403
    radius=math.hypot(dx,dz)
    influence=(1-smooth((radius-.014)/.017))*smooth((-.312-p.y)/.022)
    p.z-=dz*.965*influence
lids=[]
rest={n:data.bones[n].matrix_local.copy() for n in heads}
restq={n:m.to_quaternion() for n,m in rest.items()}
def ik(a,c,l1,l2,bend):
    d=c-a;distance=min(d.length,l1+l2-.00001);axis=d.normalized()
    along=(l1*l1-l2*l2+distance*distance)/(2*max(distance,.00001))
    height=math.sqrt(max(0,l1*l1-along*along))
    b=V(bend);b=(b-axis*b.dot(axis)).normalized()
    return a+axis*along+b*height
def q(axis,angle):return Quaternion(V(axis),angle)
def poses(label,t,duration):
    sleep=1 if label=='sleep' else smooth(t/duration) if label=='settle' else 1-smooth(t/duration) if label=='wake' else 0
    walk=label=='walk';happy=label=='happy'
    phase=t/1.2*math.tau;wave=t/duration*math.tau
    breath=math.sin(t*math.tau/(4 if sleep else 3.8))*.0015
    bob=-.017+(1-math.cos(phase*2))*.0018 if walk else breath
    p={n:v.copy() for n,v in heads.items()};rot={n:Quaternion() for n in heads}
    for name in ['Pelvis','Spine','Chest','Neck','Head']:
        p[name].z+=bob-sleep*(.115 if name=='Pelvis' else .13)
        if name in ['Neck','Head']:p[name].y-=sleep*.03
    rot['Pelvis']=q((0,1,0),math.sin(phase)*.015 if walk else 0)
    rot['Spine']=q((0,0,1),math.sin(phase)*.016 if walk else 0)
    rot['Head']=q((1,0,0),sleep*.32 + (math.sin(wave*2)*.06-.07 if happy else math.sin(wave)*.015)) @ q((0,1,0),math.sin(wave*2)*.11 if happy else math.sin(wave)*.025)
    if happy:p['Head'].z+=.009
    for side in ['L','R']:
        name='Ear.'+side
        p[name]=p['Head']+rot['Head']@(heads[name]-heads['Head'])
        rot[name]=rot['Head']@q((1,0,0),.14 if happy else math.sin(wave)*.018)
    for side in ['L','R']:
        for leg,parent,bend in [('Front','Chest',(0,1,0)),('Hind','Pelvis',(0,1,0))]:
            up,low,paw=[leg+part+'.'+side for part in ['Upper','Lower','Paw']]
            a=heads[up]+p[parent]-heads[parent]
            c=heads[paw].copy()
            if walk:
                # Four-beat walking gait: each paw spends 65% of its cycle planted.
                offset={('Hind','L'):0,('Front','L'):.25,('Hind','R'):.5,('Front','R'):.75}[(leg,side)]
                cycle=(t/1.2+offset)%1
                stride=.19*1.2*.65
                if cycle<.65:c.y+=-stride/2+stride*cycle/.65
                else:
                    u=(cycle-.65)/.35;c.y+=stride/2-stride*smooth(u);c.z+=math.sin(math.pi*u)*.028
            if sleep:
                c.y+=sleep*(-.055 if leg=='Front' else -.038)
                c.x+=sleep*(.015 if side=='L' else -.015)
            b=ik(a,c,(heads[low]-heads[up]).length,(heads[paw]-heads[low]).length,bend)
            p[up],p[low],p[paw]=a,b,c
            rot[up]=(heads[low]-heads[up]).rotation_difference(b-a)
            rot[low]=(heads[paw]-heads[low]).rotation_difference(c-b)
    upright=[(0,.167,.266),(0,.205,.326),(0,.211,.402),(0,.192,.458),(0,.146,.479),(0,.112,.454)]
    sleepy=[(0,.167,.145),(.08,.225,.11),(.15,.23,.06),(.19,.17,.045),(.18,.10,.045),(.14,.06,.05)]
    for i in range(len(tail)):
        name='Tail'+str(i)
        p[name]=heads[name].lerp(V(upright[i]),.9 if happy else 0).lerp(V(sleepy[i]),sleep)
        p[name].z+=bob
        p[name].x+=math.sin(wave-i*.4)*(.013 if happy else .006)*(i/5)*(1-sleep)
    for i in range(1,len(tail)):
        previous='Tail'+str(i-1);name='Tail'+str(i)
        p[name]=p[previous]+(p[name]-p[previous]).normalized()*(heads[name]-heads[previous]).length
    for i in range(len(tail)-1):rot['Tail'+str(i)]=(heads['Tail'+str(i+1)]-heads['Tail'+str(i)]).rotation_difference(p['Tail'+str(i+1)]-p['Tail'+str(i)])
    rot['Tail5']=rot['Tail4']
    return {n:Matrix.Translation(p[n])@rot[n].to_matrix().to_4x4()@restq[n].to_matrix().to_4x4() for n in heads}

# Pose-space floor contact correction keeps folded limbs above the cushion.
corrective=mesh.shape_key_add(name='BlueGround')
sleepmats=poses('sleep',0,4)
skin={n:sleepmats[n]@rest[n].inverted() for n in heads}
for v,cv in zip(mesh.data.vertices,corrective.data):
    matrix=Matrix(((0,0,0,0),)*4)
    for g in v.groups:
        matrix+=skin[mesh.vertex_groups[g.group].name]*g.weight
    posed=matrix@v.co
    if posed.z<.002:cv.co+=matrix.to_3x3().inverted_safe()@V((0,0,.002-posed.z))

arm.animation_data_create();scene=bpy.context.scene;scene.render.fps=30
clips=[]
for label,duration in [('idle',4),('walk',1.2),('settle',2),('sleep',4),('wake',2),('happy',4)]:
    action=bpy.data.actions.new(label);arm.animation_data.action=action
    frames=round(duration*30)
    for frame in range(frames+1):
        mats=poses(label,frame/30,duration)
        for n,pb in arm.pose.bones.items():
            parent=parents[n]
            basis=rest[n].inverted()@(rest[parent]@mats[parent].inverted() if parent else Matrix.Identity(4))@mats[n]
            pb.rotation_mode='QUATERNION';pb.matrix_basis=basis
            pb.keyframe_insert('location',frame=frame);pb.keyframe_insert('rotation_quaternion',frame=frame)
    action.use_fake_user=True;clips.append(action)
arm.animation_data.action=None
for a in clips:
    track=arm.animation_data.nla_tracks.new();track.name=a.name
    strip=track.strips.new(a.name,0,a);track.mute=True
for pb in arm.pose.bones:pb.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(WORK/'blue-rigged-master.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in [arm,mesh,*lids]:o.select_set(True)
bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(WORK/'blue-rigged.glb'),export_format='GLB',use_selection=True,
    export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,
    export_morph=True,export_skins=True,export_all_influences=False)
# The glTF exporter omits the linked MixRGB constant; retain it as the standard
# baseColorFactor instead of baking or altering the source atlas.
path=WORK/'blue-rigged.glb';raw=path.read_bytes();old_length=struct.unpack_from('<I',raw,12)[0]
document=json.loads(raw[20:20+old_length])
for material in document['materials']:
    if material.get('name')=='Blue amber eyes':material['pbrMetallicRoughness']['baseColorFactor']=[1,.58,.18,1]
encoded=json.dumps(document,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
body=struct.pack('<II',len(encoded),0x4e4f534a)+encoded+raw[20+old_length:]
path.write_bytes(struct.pack('<III',0x46546c67,2,12+len(body))+body)
(WORK/'rig-report.json').write_text(json.dumps({'bones':list(heads),'clips':[{'name':a.name,'frames':list(a.frame_range)} for a in clips],
    'vertices':len(mesh.data.vertices),'eyelids':[o.name for o in lids]},indent=2))
print('BLUE_RIG_EXPORTED',flush=True)


