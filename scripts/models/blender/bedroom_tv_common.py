"""Clean authored geometry for the bedroom corner. Blender: X right, Y back, Z up, metres.
Pieces are assembled before export; bevels, seams and printing survive close inspection.
"""
import bpy, math, os, bmesh
from mathutils import Vector
from hifi_gen import MAT, material, box, cyl, bevel_edges, vertical, along, boolean, select_only, finish

PARTS = []

def rb(name, x0,x1,y0,y1,z0,z1, mat, r=.005, edge=.001, axis=2):
    o=box(name,x0,x1,y0,y1,z0,z1,mat)
    bevel_edges(o,along(axis),r,12)
    lo,hi=(x0,x1) if axis==0 else (y0,y1) if axis==1 else (z0,z1)
    bevel_edges(o,lambda e: all(abs(v.co[axis]-lo)<1e-5 for v in e.verts) or all(abs(v.co[axis]-hi)<1e-5 for v in e.verts),edge,3)
    return o

def disk(name,x,y,z,r,depth,mat,axis='Z',verts=20):
    o=cyl(name,r,x,z,y-depth/2,y+depth/2,mat,verts=verts) if axis=='Y' else cyl(name,r,0,0,z-depth/2,z+depth/2,mat,verts=verts,axis='Z',at=(x,y))
    if r > .002:
        a=1 if axis=='Y' else 2;lo,hi=(y-depth/2,y+depth/2) if axis=='Y' else (z-depth/2,z+depth/2)
        bevel_edges(o,lambda e: all(abs(v.co[a]-lo)<1e-5 for v in e.verts) or all(abs(v.co[a]-hi)<1e-5 for v in e.verts),min(depth*.22,r*.12),1)
    return o

def sphere(name,x,y,z,sx,sy,sz,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,location=(x,y,z))
    o=bpy.context.object;o.name=name;o.scale=(sx,sy,sz)
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);o.data.materials.append(MAT[mat])
    return o

def mesh(name,verts,faces,mat,uv=None):
    m=bpy.data.meshes.new(name);m.from_pydata(verts,[],faces);m.update()
    o=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(o);m.materials.append(MAT[mat])
    if uv:
        layer=m.uv_layers.new(name='UVMap')
        for p in m.polygons:
            for idx in p.loop_indices: layer.data[idx].uv=uv[m.loops[idx].vertex_index]
    return o

def front(name,x,y,z,w,h,mat,tile=None):
    uv=[(0,0),(1,0),(1,1),(0,1)]
    if tile is not None:
        col,row=tile%4,tile//4
        uv=[((col+u)/4,(1-row*.5)+ (v-1)*.5) for u,v in uv]
        # inset one texel, so mipmapping never borrows the next cover's border
        uv=[(min((col+1)/4-1/2048,max(col/4+1/2048,u)), min(1-row*.5-1/1024,max(.5-row*.5+1/1024,v))) for u,v in uv]
    return mesh(name,[(x-w/2,y,z-h/2),(x+w/2,y,z-h/2),(x+w/2,y,z+h/2),(x-w/2,y,z+h/2)],[(0,1,2,3)],mat,uv)

def top_art(name,x,y,z,w,d,mat,tile):
    o=front(name,0,0,0,w,d,mat,tile)
    o.rotation_euler.x=-math.pi/2;o.location=(x,y,z)
    select_only(o);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    return o

def text(name,words,x,y,z,size,mat,top=False,align='CENTER',rotation=0):
    curve=bpy.data.curves.new(name,'FONT');curve.body=words;curve.size=size;curve.align_x=align
    curve.resolution_u=8;curve.extrude=0;curve.space_character=1.04
    o=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(o);o.location=(x,y,z)
    o.rotation_euler=(0,0,rotation) if top else (math.pi/2,0,rotation)
    curve.materials.append(MAT[mat]);select_only(o);bpy.ops.object.convert(target='MESH')
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    return o

def wire(name,points,r=.0018,mat='rubber'):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=1 if len(points)>20 else 6;c.bevel_depth=r;c.bevel_resolution=0
    s=c.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
    for v,co in zip(s.bezier_points,points):v.co=co;v.handle_left_type=v.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);c.materials.append(MAT[mat])
    select_only(o);bpy.ops.object.convert(target='MESH');return o

def rounded_loop(w,h,r,n=7):
    result=[]
    for cx,cy,start in [(w/2-r,h/2-r,0),(-w/2+r,h/2-r,90),(-w/2+r,-h/2+r,180),(w/2-r,-h/2+r,270)]:
        for i in range(n+1):
            a=math.radians(start+i*90/n);result.append((cx+math.cos(a)*r,cy+math.sin(a)*r))
    return result

def loft(name,loops,mat,caps=True):
    # Each loop is a list of xyz coordinates; vertices wind CCW viewed from the front.
    N=len(loops[0]);verts=[v for l in loops for v in l];faces=[]
    for k in range(len(loops)-1):
        for i in range(N):j=(i+1)%N;faces.append((k*N+i,k*N+j,(k+1)*N+j,(k+1)*N+i))
    if caps:faces.append(tuple(reversed(range(N))));faces.append(tuple((len(loops)-1)*N+i for i in range(N)))
    o=mesh(name,verts,faces,mat)
    bm=bmesh.new();bm.from_mesh(o.data)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
    return o

def group_piece(name,before):
    objs=[o for o in bpy.data.objects if o not in before and o.type=='MESH']
    if not objs:raise RuntimeError(name)
    for o in objs:finish(o)
    select_only(objs[0])
    for o in objs:o.select_set(True)
    bpy.ops.object.join();o=bpy.context.object;o.name=name
    bpy.context.scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    # One primitive per material, preserving separate hardware assemblies instead of hundreds of draw calls.
    PARTS.append(o);return o

def image_mat(name,path,emission=0):
    m=material(name,0xffffff,.45,0);p=m.node_tree.nodes['Principled BSDF']
    t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=bpy.data.images.load(os.path.abspath(path));t.image.pack()
    m.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color'])
    if emission:m.node_tree.links.new(t.outputs['Color'],p.inputs['Emission Color']);p.inputs['Emission Strength'].default_value=emission
    MAT[name]=m;return m
