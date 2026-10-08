"""Local artist retopology on the generated shells; replace damaged printing panels, retain silhouettes."""
import bpy,bmesh,numpy as np,warnings
from mathutils import Vector
from bedroom_tv_common import mesh,MAT,text,select_only,rb,disk,rounded_loop,boolean
from mathutils.bvhtree import BVHTree

def retopologize_controller_front(o,name):
    return reconstruct_controller_shell(o,name)

def reconstruct_controller_shell(o,name):
    # A new continuous skin follows the generated outline. Projecting the old
    # overlapping triangles cannot remove folds, so sample the silhouette instead.
    points=np.array([v.co[:]for v in o.data.vertices]);normals=np.array([v.normal[:]for v in o.data.vertices]);X,Y,Z=points.T
    tree=BVHTree.FromPolygons([v.co for v in o.data.vertices],[p.vertices for p in o.data.polygons],all_triangles=False)
    def design(x,z):return np.stack([np.ones_like(x),x,z,x*x,x*z,z*z],axis=-1)
    if name=='gamecube-controller':
        excluded=((X+.284)**2+(Z-.553)**2<.125**2)|((X-.219)**2+(Z-.353)**2<.110**2)|((X+.153)**2+(Z-.350)**2<.105**2)|((abs(X)<.21)&(Z>.49))|((X>.11)&(Z>.43))
    else:
        excluded=((X+.300)**2+(Z-.583)**2<.130**2)|((abs(X)<.13)&(Z>.35)&(Z<.64))|((X>.11)&(Z>.48))|((abs(X)<.21)&(Z>.66))
    coeff=[]
    for front in [True,False]:
        take=((normals[:,1]<-.6)&~excluded&(Z<.72)) if front else normals[:,1]>.6
        sample=points[take];D=design(sample[:,0],sample[:,2]);depth=sample[:,1];keep=np.ones(len(sample),bool)
        for _ in range(5):
            c=np.linalg.lstsq(D[keep],depth[keep],rcond=None)[0];residual=depth-D@c
            keep=abs(residual-np.median(residual))<max(.009,np.std(residual)*1.4)
        coeff.append(c)
    step=.004
    xs=np.arange(X.min()-step,X.max()+step*1.5,step);zs=np.arange(Z.min()-step,Z.max()+step*1.5,step)
    mask=np.zeros((len(zs),len(xs)),bool)
    for j,z in enumerate(zs):
        for i,x in enumerate(xs):mask[j,i]=tree.ray_cast(Vector((x,-2,z)),Vector((0,1,0)))[0] is not None
    # Close tiny silhouette gaps from reconstructed lettering, without closing
    # the large open spaces between the three N64 handles.
    for _ in range(2):
        count=sum(np.roll(np.roll(mask,a,0),b,1) for a,b in [(1,0),(-1,0),(0,1),(0,-1)])
        mask|=count>=3
    inner=mask.copy()
    for a,b in [(1,0),(-1,0),(0,1),(0,-1)]:inner&=np.roll(np.roll(mask,a,0),b,1)
    boundary=np.argwhere(mask&~inner);inside=np.argwhere(mask);distance=np.zeros(mask.shape)
    for start in range(0,len(inside),256):
        batch=inside[start:start+256];d=np.sqrt(((batch[:,None,:]-boundary[None,:,:])**2).sum(axis=2).min(axis=1))+.5
        distance[batch[:,0],batch[:,1]]=d
    vertices=[];lookup={}
    for j,i in zip(*np.where(mask)):
        x,z=xs[i],zs[j];front=float(design(x,z)@coeff[0]);back=float(design(x,z)@coeff[1])
        midpoint=(front+back)/2;half=max(.018,(back-front)/2)
        t=min(1,distance[j,i]*step/.018);rounding=np.sqrt(max(0,1-(1-t)**2))
        lookup[j,i]=len(vertices);vertices.extend([(x,midpoint-half*rounding,z),(x,midpoint+half*rounding,z)])
    faces=[]
    for j,i in lookup:
        if all(k in lookup for k in [(j,i+1),(j+1,i),(j+1,i+1)]):
            ids=[lookup[j,i],lookup[j,i+1],lookup[j+1,i+1],lookup[j+1,i]]
            faces.extend([tuple(reversed(ids)),tuple(k+1 for k in ids)])
    # Connect every boundary edge, producing a closed printable shell.
    edges={}
    for f in faces[::2]:
        for a,b in zip(f,f[1:]+f[:1]):
            key=tuple(sorted((a,b)));edges[key]=edges.get(key,0)+1
    for (a,b),count in edges.items():
        if count==1:faces.append((a,b,b+1,a+1))
    original=o.data;data=bpy.data.meshes.new(name+'-continuous-retopology');data.from_pydata(vertices,[],faces);data.update()
    for m in original.materials:data.materials.append(m)
    o.data=data;body=bpy.data.materials['bedroom-clean-purple' if name=='gamecube-controller' else 'bedroom-clean-grey'];index=list(data.materials).index(body)
    for f in data.polygons:f.material_index=index
    bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
    select_only(o);mod=o.modifiers.new('Round sampled silhouette','SMOOTH');mod.factor=.6;mod.iterations=22;bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=o.modifiers.new('Retopology detail budget','DECIMATE');mod.ratio=min(1,30000/(len(o.data.polygons)*2));mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
    for f in data.polygons:f.use_smooth=True
    o['retopologizedFront']=True;o['continuousShellRepair']='Continuous front/back skin sampled from generated controller silhouette.'

def orient_surface_control(p,tree,x,y,z):
    hit,normal,*_=tree.ray_cast(Vector((x,-2,z)),Vector((0,1,0)))
    if normal is None:return
    if normal.y>0:normal=-normal
    rotation=Vector((0,-1,0)).rotation_difference(normal)
    centre=Vector((x,y,z))
    for v in p.data.vertices:v.co=centre+rotation@(v.co-centre)
    p.data.update()

def repair_n64_front_field(o,pieces):
    tree=BVHTree.FromPolygons([v.co for v in o.data.vertices],[f.vertices for f in o.data.polygons],all_triangles=False)
    points=np.array([v.co[:]for v in o.data.vertices]);minimum=points.min(axis=0);maximum=points.max(axis=0)
    xs=np.arange(minimum[0]-.006,maximum[0]+.009,.006);ys=np.arange(minimum[1]-.006,maximum[1]+.009,.006);height=np.full((len(ys),len(xs)),np.nan)
    for j,y in enumerate(ys):
        for i,x in enumerate(xs):
            hit,*_=tree.ray_cast(Vector((x,y,2)),Vector((0,0,-1)))
            if hit is not None:height[j,i]=hit.z
    mask=np.isfinite(height)&((height>.19)|(ys[:,None]>-.12))
    windows=np.lib.stride_tricks.sliding_window_view(np.pad(height,5,constant_values=np.nan),(11,11))
    with warnings.catch_warnings():
        warnings.simplefilter('ignore',RuntimeWarning) # Empty windows are outside the sampled silhouette.
        filtered=np.nanmedian(windows,axis=(-2,-1))
    # Low-pass only the manufactured front platform; the generated outline,
    # cartridge well, vents and rear shell remain the source of the proportions.
    filtered=np.nan_to_num(filtered,nan=0)
    for _ in range(14):
        values=np.where(mask,filtered,0);weights=mask.astype(float)
        summed=values*4;count=weights*4
        for a,b in [(1,0),(-1,0),(0,1),(0,-1)]:
            summed+=np.roll(np.roll(values,a,0),b,1);count+=np.roll(np.roll(weights,a,0),b,1)
        filtered=np.where(mask,summed/np.maximum(count,1),0)
    def H(x,y):
        i=max(0,min(len(xs)-1,int(round((x-xs[0])/.006))));j=max(0,min(len(ys)-1,int(round((y-ys[0])/.006))))
        # Retain the detailed cartridge well and ventilation strip in the rear.
        w=max(0,min(1,(-.10-y)/.04))
        return float(filtered[j,i]*w+np.nan_to_num(height[j,i])* (1-w))
    verts=[];lookup={};faces=[]
    for j,i in zip(*np.where(mask)):
        lookup[j,i]=len(verts);verts.extend([(xs[i],ys[j],H(xs[i],ys[j])),(xs[i],ys[j],float(minimum[2]))])
    for j,i in lookup:
        if all(k in lookup for k in [(j,i+1),(j+1,i),(j+1,i+1)]):
            ids=tuple(lookup[k]for k in [(j,i),(j,i+1),(j+1,i+1),(j+1,i)])
            faces.extend([ids,tuple(reversed([k+1 for k in ids]))])
    edges={}
    for f in faces[::2]:
        for a,b in zip(f,f[1:]+f[:1]):
            key=tuple(sorted((a,b)));edges[key]=edges.get(key,0)+1
    for (a,b),count in edges.items():
        if count==1:faces.append((a,b,b+1,a+1))
    original=o.data;data=bpy.data.meshes.new('n64-continuous-generated-shell');data.from_pydata(verts,[],faces);data.update()
    for m in original.materials:data.materials.append(m)
    o.data=data;index=list(data.materials).index(MAT['n64-body'])
    for f in data.polygons:f.material_index=index
    bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
    select_only(o);mod=o.modifiers.new('Continuous N64 shell','SMOOTH');mod.factor=.55;mod.iterations=20;bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=o.modifiers.new('N64 retopology detail budget','DECIMATE');mod.ratio=min(1,60000/(len(o.data.polygons)*2));mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
    for f in o.data.polygons:f.use_smooth=True
    o['continuousShellRepair']='Continuous top and lower shell sampled from the original Tripo console; clean front platform and controls.'
    target=BVHTree.FromPolygons([v.co for v in o.data.vertices],[f.vertices for f in o.data.polygons],all_triangles=False)
    for p in pieces:
        if p.parent!=o or p.get('surfacePrintAxis') not in ['top','front']:continue
        top=p['surfacePrintAxis']=='top'
        for v in p.data.vertices:
            hit,*_=target.ray_cast(Vector((v.co.x,v.co.y,2)) if top else Vector((v.co.x,-2,v.co.z)),Vector((0,0,-1)) if top else Vector((0,1,0)))
            if hit is not None:
                if top:v.co.z=hit.z+.0015
                else:v.co.y=hit.y-.0015
        p.data.update()
    for x,word in [(-.232,'POWER'),(.232,'RESET')]:
        y=-.247;h=H(x,y)
        for p in [rb('n64-top-key-recess',x-.047,x+.047,y-.035,y+.035,h+.002,h+.004,'black',.015,.001),rb('n64-top-key',x-.036,x+.036,y-.027,y+.027,h+.005,h+.015,'n64-body',.011,.003),text('n64-top-control-label',word,x,-.291,H(x,-.291)+.003,.013,'white',top=True)]:
            if p.type=='MESH' and p.name.startswith('n64-top-control-label'):
                for v in p.data.vertices:
                    hit,*_=target.ray_cast(Vector((v.co.x,v.co.y,2)),Vector((0,0,-1)))
                    if hit is not None:v.co.z=hit.z+.0015
                p.data.update()
            p.parent=o;pieces.append(p)
    h=H(0,-.26)
    for p in [rb('n64-expansion-recess',-.097,.097,-.316,-.201,h+.002,h+.004,'black',.012,.001),rb('n64-expansion-lid',-.091,.091,-.310,-.207,h+.005,h+.010,'n64-body',.008,.002),text('n64-top-control-label','MEMORY EXPANSION',0,-.295,h+.011,.013,'white',top=True)]:p.parent=o;pieces.append(p)
    # The side and front ventilation slots are reconstructed as regular recesses.
    for side in [-1,1]:
        for y in np.linspace(.045,.270,14):
            z=.17;hit,*_=target.ray_cast(Vector((side*2,y,z)),Vector((-side,0,0)))
            if hit is None:continue
            p=rb('n64-side-vent',hit.x+side*.0005-.001,hit.x+side*.0005+.001,y-.005,y+.005,z-.055,z+.055,'black',.004,.0005,axis=0);p.parent=o;pieces.append(p)
            for v in p.data.vertices:
                surface,*_=target.ray_cast(Vector((side*2,v.co.y,v.co.z)),Vector((-side,0,0)))
                if surface is not None:v.co.x=surface.x+(v.co.x-hit.x)
            p.data.update()
    for x in np.linspace(-.220,.220,19):
        y=-.045;hit,*_=target.ray_cast(Vector((x,y,2)),Vector((0,0,-1)))
        if hit is None:continue
        p=rb('n64-top-vent',x-.004,x+.004,y-.023,y+.023,hit.z+.001,hit.z+.002,'black',.004,.0005);p.parent=o;pieces.append(p)
        for v in p.data.vertices:
            surface,*_=target.ray_cast(Vector((v.co.x,v.co.y,2)),Vector((0,0,-1)))
            if surface is not None:v.co.z=surface.z+(v.co.z-hit.z)
        p.data.update()
    verts=[];faces=[]
    for j in range(9):
        for i in range(41):
            x=-.24+i*.48/40;y=.031+j*.075/8;hit,*_=target.ray_cast(Vector((x,y,2)),Vector((0,0,-1)))
            verts.append((x,y,hit.z+.003 if hit is not None else H(x,y)+.003))
    for j in range(8):
        for i in range(40):
            k=j*41+i;faces.append((k,k+1,k+42,k+41))
    p=mesh('n64-cartridge-well',verts,faces,'black');p.parent=o;pieces.append(p)

def repair_n64_top(o,pieces):
    repair_n64_front_field(o,pieces)

def repair_gameboy_speaker(o,pieces):
    clean_panel(o,'gameboy',(.035,.298,.063,.235),'beige',[],pieces,depth_tolerance=.15,fill_recesses=True)
    tree=BVHTree.FromPolygons([v.co for v in o.data.vertices],[f.vertices for f in o.data.polygons],all_triangles=False)
    for i in range(6):
        x=.070+i*.035;z=.132+i*.007;hit,*_=tree.ray_cast(Vector((x,-2,z)),Vector((0,1,0)))
        if hit is None:continue
        p=rb('gameboy-speaker-slot',x-.005,x+.005,hit.y-.003,hit.y-.001,z-.031,z+.031,'darkgrey',.005,.001,axis=1)
        for v in p.data.vertices:
            xx,zz=v.co.x-x,v.co.z-z;v.co.x=x+xx*np.cos(.16)-zz*np.sin(.16);v.co.z=z+xx*np.sin(.16)+zz*np.cos(.16)
        p.parent=o;pieces.append(p)

def finished_control(p):
    select_only(p)
    bevel=p.modifiers.new('Moulded control edge','BEVEL');bevel.width=.003;bevel.segments=3
    bevel.limit_method='ANGLE';bevel.angle_limit=.5
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    for f in p.data.polygons:f.use_smooth=True
    weighted=p.modifiers.new('Area weighted control normals','WEIGHTED_NORMAL');weighted.keep_sharp=True;weighted.weight=50
    bpy.ops.object.modifier_apply(modifier=weighted.name)

def seal_generated_relief(o,pieces,budget=60000):
    # The generated decals are disconnected overlapping relief, even after projection.
    # Reconstruct the continuous shell from that corrected surface before printing it.
    select_only(o)
    source=BVHTree.FromPolygons([v.co for v in o.data.vertices],[p.vertices for p in o.data.polygons],all_triangles=False)
    materials=[p.material_index for p in o.data.polygons]
    mod=o.modifiers.new('Continuous corrected shell','REMESH');mod.mode='VOXEL';mod.voxel_size=.002;mod.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=o.modifiers.new('Remove reconstruction stair steps','SMOOTH');mod.factor=.6;mod.iterations=3
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for p in o.data.polygons:
        result=source.find_nearest(p.center)
        if result[2] is not None:p.material_index=materials[result[2]]
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
    mod=o.modifiers.new('Preserve corrected detail budget','DECIMATE');mod.ratio=min(1,budget/len(o.data.polygons));mod.use_collapse_triangulate=True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.shade_smooth_by_angle(angle=1.4)
    target=BVHTree.FromPolygons([v.co for v in o.data.vertices],[p.vertices for p in o.data.polygons],all_triangles=False)
    for p in pieces:
        if p.parent!=o or 'surfacePrintAxis' not in p:continue
        top=p['surfacePrintAxis']=='top'
        for v in p.data.vertices:
            origin=Vector((v.co.x,v.co.y,2)) if top else Vector((v.co.x,-2,v.co.z))
            hit,*_=target.ray_cast(origin,Vector((0,0,-1)) if top else Vector((0,1,0)))
            if hit is not None:
                if top:v.co.z=hit.z+.0015
                else:v.co.y=hit.y-.0015
        p.data.update()
    o['continuousShellRepair']='Fine voxel reconstruction of corrected Tripo surface; nearest-source PBR zones; detached relief removed.'

def restore_dpad(o,name,pieces,x,z,size,key,bodykey):
    half=size/2;arm=size/6
    clean_panel(o,name,(x-half-.024,x+half+.024,z-half-.024,z+half+.024),bodykey,[],pieces,depth_tolerance=.14)
    tree=BVHTree.FromPolygons([v.co for v in o.data.vertices],[f.vertices for f in o.data.polygons],all_triangles=False)
    hit,*_=tree.ray_cast(Vector((x,-2,z)),Vector((0,1,0)))
    if hit is None:return
    outline=[(-arm,-half),(arm,-half),(arm,-arm),(half,-arm),(half,arm),(arm,arm),(arm,half),(-arm,half),(-arm,arm),(-half,arm),(-half,-arm),(-arm,-arm)]
    vv=[(x+xx,hit.y+d,z+zz)for d in [-.030,-.004]for xx,zz in outline];N=len(outline)
    ff=[tuple(reversed(range(N))),tuple(range(N,2*N))]+[(i,(i+1)%N,(i+1)%N+N,i+N)for i in range(N)]
    p=mesh(name+'-dpad',vv,ff,key);finished_control(p);p.parent=o;pieces.append(p)
    for dx,dz,rot in [(0,size*.31,0),(size*.31,0,-np.pi/2),(0,-size*.31,np.pi),(-size*.31,0,np.pi/2)]:
        a=size*.055;triangle=[(-a,-a),(a,-a),(0,a)]
        verts=[(x+dx+xx*np.cos(rot)-zz*np.sin(rot),hit.y-.031,z+dz+xx*np.sin(rot)+zz*np.cos(rot))for xx,zz in triangle]
        p=mesh(name+'-direction',verts,[(0,1,2)],'black' if key=='black' else 'darkgrey');p.parent=o;pieces.append(p)

def restore_thumbstick(o,name,pieces,x,z,r,key,bodykey,headfactor=.62):
    clean_panel(o,name,(x-r-.025,x+r+.025,z-r-.025,z+r+.025),bodykey,[],pieces,depth_tolerance=.16)
    tree=BVHTree.FromPolygons([v.co for v in o.data.vertices],[f.vertices for f in o.data.polygons],all_triangles=False)
    hit,*_=tree.ray_cast(Vector((x,-2,z)),Vector((0,1,0)))
    if hit is None:return
    rim=disk(name+'-stick-gate',x,hit.y-.005,z,r,.010,bodykey,axis='Y',verts=8)
    cut=disk('stick-gate-cut',x,hit.y-.005,z,r*.80,.040,'black',axis='Y',verts=8);boolean(rim,cut)
    additions=[rim,disk(name+'-stick-recess',x,hit.y-.006,z,r*.80,.002,'black',axis='Y',verts=8),disk(name+'-stick-stem',x,hit.y-.025,z,r*.27,.052,key,axis='Y',verts=48),disk(name+'-stick-head',x,hit.y-.054,z,r*headfactor,.025,key,axis='Y',verts=64)]
    for p in additions:
        if p in additions[:2]:
            for v in p.data.vertices:
                surface,*_=tree.ray_cast(Vector((v.co.x,-2,v.co.z)),Vector((0,1,0)))
                if surface is not None:v.co.y=surface.y+(v.co.y-hit.y)
            p.data.update()
        elif o.get('retopologizedFront'):orient_surface_control(p,tree,x,hit.y,z)
        p.parent=o;pieces.append(p)
        for f in p.data.polygons:f.use_smooth=abs(f.normal.y)<.99
    for radius in [r*headfactor*.71,r*headfactor*.47]:
        bpy.ops.mesh.primitive_torus_add(major_segments=64,minor_segments=8,location=(x,hit.y-.067,z),rotation=(np.pi/2,0,0),major_radius=radius,minor_radius=.0012)
        p=bpy.context.object;p.name=name+'-stick-grip-ring';p.data.materials.append(MAT[key]);select_only(p);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        for f in p.data.polygons:f.use_smooth=True
        if o.get('retopologizedFront'):orient_surface_control(p,tree,x,hit.y,z)
        p.parent=o;pieces.append(p)

def repair_ds(o,pieces):
    MAT['ds-silver']=bpy.data.materials['bedroom-clean-silver']
    # Retain the generated outer shell and hinge; replace the damaged inner faceplates.
    for v in o.data.vertices:
        if abs(v.co.x)<.468 and v.co.y<.145 and .148<v.co.z<.225:v.co.z=.163
    o.data.update()
    upper=rb('ds-upper-faceplate',-.453,.453,-.004,.006,.244,.669,'ds-silver',.028,.002,axis=1)
    cut=rb('ds-screen-cut',-.212,.212,-.020,.030,.339,.612,'black',.006,.001,axis=1);boolean(upper,cut)
    for v in upper.data.vertices:v.co.y+=.50*v.co.z-.084
    for f in upper.data.polygons:f.use_smooth=False
    upper.parent=o;pieces.append(upper)
    for xcentre in [-.328,.328]:
        for column in range(4):
            for row in range(4):
                x=xcentre+(column-1.5)*.026;z=.366+row*.027
                p=disk('ds-speaker-hole',x,.5*z-.089,z,.004,.002,'black',axis='Y',verts=16)
                p.parent=o;pieces.append(p)
    lower=rb('ds-lower-faceplate',-.470,.470,-.329,.143,.163,.172,'ds-silver',.027,.002)
    cut=rb('ds-screen-cut',-.214,.214,-.246,.039,.155,.185,'black',.006,.001);boolean(lower,cut)
    for f in lower.data.polygons:f.use_smooth=False
    lower.parent=o;pieces.append(lower)
    for x,y,label in [(.332,-.042,'X'),(.278,-.096,'Y'),(.386,-.096,'A'),(.332,-.150,'B')]:
        p=disk('ds-button',x,y,.181,.025,.017,'ds-silver',verts=64);finished_control(p);p.parent=o;pieces.append(p)
        p=text('ds-control-print',label,x,y-.009,.191,.024,'darkgrey',top=True);p.parent=o;pieces.append(p)
    # The DS directions share the retained left recess, with a newly bevelled moulding.
    half=.075;arm=.025;loop=[(-arm,-half),(arm,-half),(arm,-arm),(half,-arm),(half,arm),(arm,arm),(arm,half),(-arm,half),(-arm,arm),(-half,arm),(-half,-arm),(-arm,-arm)]
    N=len(loop);vv=[(-.332+x,-.096+y,z)for z in [.170,.190]for x,y in loop]
    p=mesh('ds-dpad',vv,[tuple(reversed(range(N))),tuple(range(N,2*N))]+[(i,(i+1)%N,(i+1)%N+N,i+N)for i in range(N)],'ds-silver');finished_control(p);p.parent=o;pieces.append(p)
    for x,word in [(.288,'SELECT'),(.386,'START')]:
        p=rb('ds-select-start',x-.035,x+.035,.056,.078,.173,.181,'ds-silver',.008,.001);p.parent=o;pieces.append(p)
        p=text('ds-control-print',word,x,.087,.173,.011,'darkgrey',top=True);p.parent=o;pieces.append(p)
    o['dsFrontPlane']=[-.089,0,.5];o['dsLowerHeight']=.173

def paint_outline(o,loop,key,top=False,centre=(0,0),minimum_height=0):
    outline=[(x+centre[0],a+centre[1])for x,a in loop]
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
    for i,(x,a) in enumerate(outline):
        xx,aa=outline[(i+1)%len(outline)];dx,da=xx-x,aa-a
        plane=Vector((-da,dx,0)) if top else Vector((-da,0,dx))
        at=Vector((x,a,0)) if top else Vector((x,0,a))
        xmin=min(p[0]for p in outline);xmax=max(p[0]for p in outline);amin=min(p[1]for p in outline);amax=max(p[1]for p in outline)
        faces=[]
        for f in bm.faces:
            c=f.calc_center_median()
            if not ((f.normal.z>0 and c.z>minimum_height) if top else f.normal.y<0):continue
            xs=[v.co.x for v in f.verts];aa=[v.co.y if top else v.co.z for v in f.verts]
            if max(xs)>=xmin-.012 and min(xs)<=xmax+.012 and max(aa)>=amin-.012 and min(aa)<=amax+.012:faces.append(f)
        edges=set(e for f in faces for e in f.edges);verts=set(v for e in edges for v in e.verts)
        bmesh.ops.bisect_plane(bm,geom=list(verts)+list(edges)+faces,dist=.000001,plane_co=at,plane_no=plane)
    index=next(i for i,m in enumerate(o.data.materials)if m.name=='bedroom-clean-'+key)
    for f in bm.faces:
        c=f.calc_center_median();a=c.y if top else c.z
        inside=all((outline[(i+1)%len(outline)][0]-x)*(a-b)-(outline[(i+1)%len(outline)][1]-b)*(c.x-x)>=-.00001 for i,(x,b) in enumerate(outline))
        if inside and ((f.normal.z>0 and c.z>minimum_height) if top else f.normal.y<0):f.material_index=index
    bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free();o.data.update()

def repair_stand(o):
    # Deck sizes, tubular post centres and the side wing follow the generated stand.
    MAT['stand-deck']=bpy.data.materials['bedroom-clean-graphite']
    bm=bmesh.new();bm.from_mesh(o.data)
    bands=[(.052,.096),(.284,.347),(.580,.642)]
    remove=[f for f in bm.faces if f.calc_center_median().z>.047]
    bmesh.ops.delete(bm,geom=remove,context='FACES');bm.to_mesh(o.data);bm.free()
    # Straighten the original tubular post geometry without changing its placement or radius.
    for v in o.data.vertices:
        if .096<v.co.z<.580:
            cx=-.451 if v.co.x<0 else .353;cy=-.183 if v.co.y<0 else .254
            delta=Vector((v.co.x-cx,v.co.y-cy,0))
            if .006<delta.length<.045:
                delta.normalize();v.co.x=cx+delta.x*.023;v.co.y=cy+delta.y*.023
    o.data.update()
    if o.data.has_custom_normals:
        select_only(o);bpy.ops.mesh.customdata_custom_splitnormals_clear()
    added=[]
    for low,high in [(.052,.094),(.290,.345),(.590,.632)]:
        added.append(rb('stand-laminate-retopology',-.489,.393,-.294,.294,low,high,'stand-deck',.043,.002))
    added.append(rb('stand-side-wing-retopology',.300,.490,-.246,.202,.597,.626,'stand-deck',.090,.002))
    MAT['stand-post']=bpy.data.materials['bedroom-clean-chrome']
    for x in [-.451,.353]:
        for y in [-.183,.254]:
            added.append(disk('stand-post-retopology',x,y,.344,.023,.577,'stand-post',verts=64))
    for p in added:
        for f in p.data.polygons:f.use_smooth=False
    select_only(o)
    for p in added:p.select_set(True)
    bpy.ops.object.join()
    o['artistRepair']='Retopologized laminate decks and round chrome posts; generated feet retained.'

def clean_panel(o,name,bounds,base,lines,pieces,top=False,depth_tolerance=.045,fill_recesses=False):
    x0,x1,a0,a1=bounds
    points=np.array([v.co[:]for v in o.data.vertices]);normal=np.array([v.normal[:]for v in o.data.vertices])
    X=points[:,0];A=points[:,1 if top else 2];Depth=points[:,2 if top else 1]
    surface=(normal[:,2]>.45) if top else (normal[:,1]<-.45)
    domain=(X>x0-.025)&(X<x1+.025)&(A>a0-.025)&(A<a1+.025)
    rim=domain&surface&((X<x0+.01)|(X>x1-.01)|(A<a0+.009)|(A>a1-.009))
    sample=points[rim]
    if len(sample)<15:raise RuntimeError('Insufficient panel rim '+name)
    def D(x,a):return np.stack([np.ones_like(x),x,a],axis=-1)
    sampleA=sample[:,1 if top else 2];sampleDepth=sample[:,2 if top else 1]
    design=D(sample[:,0],sampleA);coeff=np.linalg.lstsq(design,sampleDepth,rcond=None)[0]
    for _ in range(3):
        residual=sampleDepth-design@coeff;keep=abs(residual-np.median(residual))<max(.004,np.std(residual)*1.5)
        if keep.sum()>15:coeff=np.linalg.lstsq(design[keep],sampleDepth[keep],rcond=None)[0]
    # Project damaged relief onto the fitted shell. Deleting generated glyph faces
    # opened the shell because those glyphs share topology with the body.
    for v in ([] if o.get('retopologizedFront') else o.data.vertices):
        a=v.co.y if top else v.co.z;depth=v.co.z if top else v.co.y
        if x0-.020<v.co.x<x1+.020 and a0-.020<a<a1+.020:
            expected=float(D(v.co.x,a)@coeff)
            inner_tolerance=.070 if fill_recesses else .006
            outward=depth>expected-inner_tolerance if top else depth<expected+inner_tolerance
            if abs(depth-expected)<depth_tolerance and outward:
                blend=max(0,min(1,(v.co.x-x0+.020)/.020,(x1+.020-v.co.x)/.020,(a-a0+.020)/.020,(a1+.020-a)/.020))
                if top:v.co.z=depth+(expected-depth)*blend
                else:v.co.y=depth+(expected-depth)*blend
    o.data.update()
    bm=bmesh.new();bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
    bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.000001)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free();o.data.update()
    if o.data.has_custom_normals:
        select_only(o);bpy.ops.mesh.customdata_custom_splitnormals_clear()
    matindex=next((i for i,m in enumerate(o.data.materials)if m==MAT[base]),0)
    for f in o.data.polygons:
        c=f.center;a=c.y if top else c.z;depth=c.z if top else c.y
        if x0-.025<c.x<x1+.025 and a0-.025<a<a1+.025 and abs(depth-float(D(c.x,a)@coeff))<.03:f.material_index=matindex
    select_only(o);bpy.ops.object.shade_smooth_by_angle(angle=.75)
    tree=BVHTree.FromPolygons([v.co for v in o.data.vertices],[f.vertices for f in o.data.polygons],all_triangles=False)
    for words,x,a,size,key in lines:
        p=text(name+'-clean-print',words,x,a if top else 0,0 if top else a,size,key,top=top)
        for v in p.data.vertices:
            aa=v.co.y if top else v.co.z
            origin=Vector((v.co.x,aa,2)) if top else Vector((v.co.x,-2,aa))
            direction=Vector((0,0,-1)) if top else Vector((0,1,0))
            hit,*_=tree.ray_cast(origin,direction)
            if hit is not None:
                if top:v.co.z=hit.z+.0015
                else:v.co.y=hit.y-.0015
        p.data.update();p['surfacePrintAxis']='top' if top else 'front';p.parent=o;pieces.append(p)

def repair_print(o,name,pieces):
    if name=='stand':repair_stand(o);return
    if name=='ds':repair_ds(o,pieces);seal_generated_relief(o,pieces,45000);return
    if 'controller' in name:
        bodymaterial=bpy.data.materials['bedroom-clean-purple' if name=='gamecube-controller' else 'bedroom-clean-grey']
        bodyindex=next(i for i,m in enumerate(o.data.materials)if m==bodymaterial)
        for f in o.data.polygons:
            if not (name=='gamecube-controller' and abs(f.center.x)>.23 and f.center.z>.72):f.material_index=bodyindex
        if name in ['gamecube-controller','n64-controller']:retopologize_controller_front(o,name)
    bands={
      'gameboy':((-.255,.248,.490,.555),'beige',[('Nintendo GAME BOY',-.018,.513,.030,'letter-blue')]),
      'gamecube-controller':((-.190,.185,.550,.720),'purple',[('NINTENDO',0,.690,.022,'white'),('GAMECUBE',0,.648,.030,'white'),('START/PAUSE',0,.583,.012,'white')]),
      'snes-controller':((-.190,.180,.333,.435),'grey',[('Nintendo',-.010,.396,.024,'black'),('SUPER NINTENDO',-.010,.358,.023,'black')]),
      'n64-controller':((-.175,.175,.678,.753),'grey',[('Nintendo',0,.707,.030,'darkgrey')])
    }
    base={'beige':'bedroom-clean-beige','purple':'bedroom-clean-purple','grey':'bedroom-clean-grey'}
    for key,materialname in base.items():
        if bpy.data.materials.get(materialname):MAT[key]=bpy.data.materials.get(materialname)
    if name in bands:
        bounds,key,lines=bands[name];clean_panel(o,name,bounds,key,lines,pieces,depth_tolerance=.08)
    if name=='snes-controller':
        clean_panel(o,name,(-.115,.125,.118,.160),'grey',[('SELECT',-.060,.139,.015,'darkgrey'),('START',.051,.139,.015,'darkgrey')],pieces)
        clean_panel(o,name,(-.115,.125,.173,.240),'grey',[],pieces,depth_tolerance=.12,fill_recesses=True)
        tree=BVHTree.FromPolygons([v.co for v in o.data.vertices],[f.vertices for f in o.data.polygons],all_triangles=False)
        for x in [-.060,.051]:
            z=.202;hit,*_=tree.ray_cast(Vector((x,-2,z)),Vector((0,1,0)))
            if hit is None:continue
            p=rb('snes-controller-select-start',x-.031,x+.031,hit.y-.016,hit.y-.003,z-.010,z+.010,'darkgrey',.009,.002,axis=1)
            for v in p.data.vertices:
                xx,zz=v.co.x-x,v.co.z-z;v.co.x=x+xx*np.cos(.55)-zz*np.sin(.55);v.co.z=z+xx*np.sin(.55)+zz*np.cos(.55)
            finished_control(p);p.parent=o;pieces.append(p)
    if name=='gameboy':
        repair_gameboy_speaker(o,pieces)
        clean_panel(o,name,(-.145,.105,.169,.205),'beige',[('SELECT',-.087,.188,.012,'letter-blue'),('START',.032,.188,.012,'letter-blue')],pieces,depth_tolerance=.08)
        clean_panel(o,name,(.05,.292,.263,.448),'beige',[],pieces,depth_tolerance=.12)
        clean_panel(o,name,(-.143,.109,.206,.247),'beige',[],pieces,depth_tolerance=.12)
        tree=BVHTree.FromPolygons([v.co for v in o.data.vertices],[f.vertices for f in o.data.polygons],all_triangles=False)
        for x in [-.086,.031]:
            z=.222;hit,*_=tree.ray_cast(Vector((x,-2,z)),Vector((0,1,0)))
            if hit is None:continue
            p=rb('gameboy-select-start',x-.037,x+.037,hit.y-.020,hit.y-.003,z-.011,z+.011,'darkgrey',.010,.002,axis=1)
            for v in p.data.vertices:
                xx,zz=v.co.x-x,v.co.z-z;v.co.x=x+xx*np.cos(.32)-zz*np.sin(.32);v.co.z=z+xx*np.sin(.32)+zz*np.cos(.32)
            finished_control(p);p.parent=o;pieces.append(p)
    if name=='snes':
        clean_panel(o,name,(-.445,.445,-.483,-.321),'grey',[('SUPER NINTENDO',-.105,-.423,.027,'black'),('ENTERTAINMENT SYSTEM',-.105,-.454,.011,'black')],pieces,top=True,depth_tolerance=.15)
        # The cartridge panel has one exact rounded paint boundary, independent of source UV pixels.
        grey=next(i for i,m in enumerate(o.data.materials)if m.name=='bedroom-clean-grey')
        for f in o.data.polygons:
            if f.center.z>.20 and f.center.y>-.07:f.material_index=grey
        paint_outline(o,rounded_loop(.740,.390,.035,n=5),'darkgrey',top=True,centre=(0,.165),minimum_height=.20)
        # Push the old ports behind the new fascia while keeping a closed source
        # volume. Deleting their faces makes voxel reconstruction lose the shell.
        for v in o.data.vertices:
            if v.co.y<-.449 and abs(v.co.x)<.445 and .045<v.co.z<.215:v.co.y=-.447
        o.data.update()
        plate=rb('snes-port-fascia',-.450,.450,-.503,-.449,.056,.201,'grey',.062,.003,axis=1)
        for i,x in enumerate([-.251,.251]):
            cutter=rb('snes-port-cut',x-.097,x+.097,-.508,-.435,.105,.162,'black',.022,.001,axis=1);boolean(plate,cutter)
            p=rb('snes-port-interior',x-.094,x+.094,-.460,-.449,.108,.159,'black',.020,.001,axis=1);p.parent=o;pieces.append(p)
            for j in range(7):
                p=disk('snes-port-contact',x+(j-3)*.018,-.462,.135,.004,.002,'chrome',axis='Y',verts=12);p.parent=o;pieces.append(p)
            p=text('snes-port-number',str(i+1),-.390 if i==0 else .390,-.504,.117,.028,'black');p.parent=o;pieces.append(p)
        for f in plate.data.polygons:f.use_smooth=False
        plate.parent=o;pieces.append(plate)
    if name=='n64':
        graphite=next(i for i,m in enumerate(o.data.materials)if m.name=='bedroom-clean-graphite')
        for f in o.data.polygons:f.material_index=graphite
        MAT['n64-body']=bpy.data.materials['bedroom-clean-graphite']
        for v in o.data.vertices:
            x,y,z=v.co
            if abs(x)<.094 and .135<z<.251 and -.50<y<-.31:v.co.y=-.372+.18*x*x
        o.data.update()
        p=text('n64-clean-print','NINTENDO 64',0,-.374,.194,.016,'white');p['surfacePrintAxis']='front';p.parent=o;pieces.append(p)
        clean_panel(o,name,(-.16,.16,.240,.335),'n64-body',[('Nintendo',0,.274,.028,'white')],pieces,top=True)
        repair_n64_top(o,pieces)
        # Restore the four recessed sockets on the retopologized generated shell.
        tree=BVHTree.FromPolygons([v.co for v in o.data.vertices],[f.vertices for f in o.data.polygons],all_triangles=False)
        for i,x in enumerate([-.236,-.129,.129,.236]):
            z=.115;hit,*_=tree.ray_cast(Vector((x,-2,z)),Vector((0,1,0)))
            if hit is None:continue
            for p in [disk('n64-port-rim',x,hit.y-.008,z,.043,.010,'n64-body',axis='Y',verts=64),disk('n64-port-interior',x,hit.y-.014,z,.032,.003,'black',axis='Y',verts=64)]:
                p.parent=o;pieces.append(p)
            for j in range(3):
                p=disk('n64-port-contact',x+(j-1)*.013,hit.y-.017,z+.004,.003,.001,'chrome',axis='Y',verts=12);p.parent=o;pieces.append(p)
    if name=='snes-controller':
        grey=next(i for i,m in enumerate(o.data.materials)if m.name=='bedroom-clean-grey')
        for f in o.data.polygons:
            if f.center.x>.095 and f.center.y<.025:f.material_index=grey
        paint_outline(o,[(.154*np.cos(a),.154*np.sin(a))for a in np.linspace(0,2*np.pi,41)[:-1]],'darkgrey',centre=(.278,.267))
    if name in ['gameboy','gamecube-controller','snes-controller','n64-controller']:
        x,z,size,key,bodykey={
          'gameboy':(-.176,.374,.151,'black','beige'),
          'gamecube-controller':(-.153,.350,.130,'grey','purple'),
          'snes-controller':(-.282,.267,.183,'darkgrey','grey'),
          'n64-controller':(-.300,.583,.160,'grey','grey'),
        }[name]
        if name=='snes-controller':MAT['darkgrey']=bpy.data.materials.get('bedroom-clean-darkgrey')
        restore_dpad(o,name,pieces,x,z,size,key,bodykey)
    if name=='gamecube-controller':
        restore_thumbstick(o,name,pieces,-.284,.553,.088,'grey','purple')
        MAT['yellow']=bpy.data.materials['bedroom-clean-yellow']
        restore_thumbstick(o,name,pieces,.219,.353,.076,'yellow','purple',headfactor=.42)
        tree=BVHTree.FromPolygons([v.co for v in o.data.vertices],[f.vertices for f in o.data.polygons],all_triangles=False)
        for x,word in [(-.315,'L'),(.315,'R')]:
            z=.739;hit,*_=tree.ray_cast(Vector((x,-2,z)),Vector((0,1,0)))
            if hit is None:continue
            p=rb('gamecube-controller-shoulder',x-.069,x+.069,hit.y-.012,hit.y+.020,z-.016,z+.029,'grey',.016,.003,axis=1);finished_control(p);p.parent=o;pieces.append(p)
            p=text('gamecube-controller-shoulder-print',word,x,hit.y-.013,z-.004,.016,'darkgrey');p.parent=o;pieces.append(p)
    if name=='n64-controller':restore_thumbstick(o,name,pieces,0,.482,.085,'grey','grey',headfactor=.52)
    caps={
      'gamecube-controller':[(.184,.499,.037,'red','B'),(.289,.550,.062,'green','A'),(0,.613,.022,'grey','START')],
      'snes-controller':[(.348,.246,.038,'red','A'),(.204,.269,.038,'green','Y'),(.280,.195,.038,'yellow','B'),(.283,.341,.038,'blue','X')],
      'n64-controller':[(.177,.580,.043,'blue','B'),(.258,.524,.043,'green','A'),(0,.578,.032,'red','START')],
      'gameboy':[(.127,.342,.042,'magenta','B'),(.225,.388,.042,'magenta','A')],
    }
    caps['n64-controller'] += [(.347,.643,.028,'yellow','^'),(.282,.613,.028,'yellow','<'),(.400,.597,.028,'yellow','>'),(.342,.562,.028,'yellow','v')]
    if name=='gamecube-controller':
        for x0,x1,z0,z1,xx,zz,letter in [(.197,.315,.607,.665,.256,.637,'X'),(.366,.419,.555,.647,.391,.599,'Y')]:
            clean_panel(o,name,(x0,x1,z0,z1),'purple',[],pieces,depth_tolerance=.07)
            tree=BVHTree.FromPolygons([v.co for v in o.data.vertices],[f.vertices for f in o.data.polygons],all_triangles=False)
            hit,*_=tree.ray_cast(Vector((xx,-2,zz)),Vector((0,1,0)))
            if hit is not None:
                p=rb(name+'-xy-button',x0,x1,hit.y-.020,hit.y-.003,z0,z1,'grey',.022,.002,axis=1);finished_control(p);p.parent=o;pieces.append(p)
                orient_surface_control(p,tree,xx,hit.y,zz)
                p=text(name+'-button-label',letter,xx,hit.y-.021,zz-.010,.024,'darkgrey');p.parent=o;pieces.append(p)
                orient_surface_control(p,tree,xx,hit.y,zz)
    for x,z,r,key,label in caps.get(name,[]):
        material=bpy.data.materials.get('bedroom-clean-'+key)
        if material:MAT[key]=material
        tree=BVHTree.FromPolygons([v.co for v in o.data.vertices],[f.vertices for f in o.data.polygons],all_triangles=False)
        hit,*_=tree.ray_cast(Vector((x,-2,z)),Vector((0,1,0)))
        if hit is None:continue
        # A smooth socket flange closes the cut; the moulded cap sits inside it.
        socket=disk(name+'-button-socket',x,hit.y+.009,z,r+.012,.016,'darkgrey',axis='Y',verts=64)
        cap=disk(name+'-button-cap',x,hit.y-.006,z,r,.025,key,axis='Y',verts=64)
        for p in [socket,cap]:
            p.parent=o;pieces.append(p)
            for f in p.data.polygons:f.use_smooth=abs(f.normal.y)<.99
            if o.get('retopologizedFront'):orient_surface_control(p,tree,x,hit.y,z)
        if label not in ['START']:
            xx,zz=x,z-.010
            if name=='gameboy':zz=z-.068
            if name=='snes-controller':xx,zz={'A':(.416,.292),'Y':(.151,.228),'B':(.248,.142),'X':(.330,.395)}[label]
            p=text(name+'-button-label',label,xx,hit.y-.020,zz,.024,'white' if name!='gameboy' else 'letter-blue')
            if o.get('retopologizedFront'):orient_surface_control(p,tree,x,hit.y,z)
            if name in ['gameboy','snes-controller']:p['surfacePrintAxis']='front'
            p.parent=o;pieces.append(p)
    if name=='gameboy':
        # Retopologize the continuous DMG screen surround and restore its native 160:144 proportions.
        points=np.array([v.co[:]for v in o.data.vertices]);normals=np.array([v.normal[:]for v in o.data.vertices]);X,Y,Z=points.T
        zone=(abs(X)<.28)&(Z>.54)&(Z<.915)&(normals[:,1]<-.45)
        rim=zone&((abs(X)>.23)|(Z>.89)|(Z<.555))
        sample=points[rim];D=lambda x,z:np.stack([np.ones_like(x),x,z],axis=-1)
        coeff=np.linalg.lstsq(D(sample[:,0],sample[:,2]),sample[:,1],rcond=None)[0]
        coeff[0]+=float(np.min(Y[zone]-D(X[zone],Z[zone])@coeff))-.008
        o['bezelPlane']=list(coeff)
        beige=next(i for i,m in enumerate(o.data.materials)if m.name=='bedroom-clean-beige')
        for f in o.data.polygons:
            c=f.center
            if abs(c.x)<.285 and .545<c.z<.915 and c.y<.10:f.material_index=beige
        outer=[(x,.727+a)for x,a in rounded_loop(.558,.376,.028,n=12)]
        inner=[(x,.718+a)for x,a in rounded_loop(.350,.316,.002,n=12)]
        vertices=[(x,float(D(x,z)@coeff),z)for x,z in outer+inner];N=len(outer)
        p=mesh('gameboy-screen-bezel',vertices,[(i,(i+1)%N,(i+1)%N+N,i+N)for i in range(N)],'darkgrey')
        p.parent=o;pieces.append(p)
        p=text('gameboy-bezel-print','DOT MATRIX WITH STEREO SOUND',0,0,.891,.009,'white')
        for v in p.data.vertices:v.co.y=float(D(v.co.x,v.co.z)@coeff)-.001
        p.parent=o;pieces.append(p)
    if name in ['snes','gameboy','snes-controller','snes-cartridge','n64-cartridge','melee-case','gamecube-stack','retro-games']:
        seal_generated_relief(o,pieces,60000 if name in ['snes','n64'] else 50000 if 'controller' in name or name=='gameboy' else 14000 if 'cartridge' in name else 8000 if name=='melee-case' else 26000)
    if name=='snes-controller':
        grey=next(i for i,m in enumerate(o.data.materials)if m.name=='bedroom-clean-grey')
        for f in o.data.polygons:f.material_index=grey
        paint_outline(o,[(.154*np.cos(a),.154*np.sin(a))for a in np.linspace(0,2*np.pi,49)[:-1]],'darkgrey',centre=(.278,.267))
    if name=='snes':
        grey=next(i for i,m in enumerate(o.data.materials)if m.name=='bedroom-clean-grey')
        for f in o.data.polygons:
            if f.normal.z>0 and f.center.z>.20 and f.center.y>-.065:f.material_index=grey
        paint_outline(o,rounded_loop(.740,.390,.035,n=5),'darkgrey',top=True,centre=(0,.165),minimum_height=.20)
    if name=='n64':
        for p in pieces:
            if p.parent==o and p.get('surfacePrintAxis')=='top':
                for v in p.data.vertices:
                    if v.co.y<-.13:v.co.z+=.006
                p.data.update()
