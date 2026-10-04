"""Complete Marquee navigation hardware. Blender 5.2, no runtime primitive assembly."""
import bpy
import math
import os
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
NAME = 'navigation-marquee-v1'
SOURCE = os.path.join(ROOT, '.source-assets/models-in', NAME)
os.makedirs(SOURCE, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def rgb(value):
    return tuple((v/12.92 if v < .04045 else ((v+.055)/1.055)**2.4) for v in [int(value[i:i+2],16)/255 for i in (0,2,4)])

def material(name, color, rough=.4, metal=0, coat=0, scan=None):
    m=bpy.data.materials.new(name); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*rgb(color),1)
    p.inputs['Roughness'].default_value=rough
    p.inputs['Metallic'].default_value=metal
    p.inputs['Coat Weight'].default_value=coat
    p.inputs['Coat Roughness'].default_value=.16
    if scan:
        tex=m.node_tree.nodes.new('ShaderNodeTexImage')
        image=bpy.data.images.load(os.path.join(ROOT,f'public/textures/hardware/{scan}-normal.webp'))
        image.colorspace_settings.name='Non-Color'; image.scale(1024,1024); image.pack(); tex.image=image
        normal=m.node_tree.nodes.new('ShaderNodeNormalMap'); normal.inputs['Strength'].default_value=.52 if scan=='powdercoat-v1' else .42
        m.node_tree.links.new(tex.outputs['Color'],normal.inputs['Color'])
        m.node_tree.links.new(normal.outputs['Normal'],p.inputs['Normal'])
        # Keep the scanned variation, calibrated to this finish's physical roughness.
        scan_image=bpy.data.images.load(os.path.join(ROOT,f'public/textures/hardware/{scan}-orm.webp'))
        scan_image.colorspace_settings.name='Non-Color'; scan_image.scale(1024,1024)
        samples=np.asarray(scan_image.pixels[:],dtype=np.float32).reshape(-1,4)
        values=np.clip(samples[:,1]/max(float(samples[:,1].mean()),.01)*rough,.08,.9)
        samples[:,:3]=values[:,None]; samples[:,3]=1
        rough_image=bpy.data.images.new(name+'_roughness',1024,1024)
        rough_image.colorspace_settings.name='Non-Color'; rough_image.pixels.foreach_set(samples.ravel()); rough_image.pack()
        rough_tex=m.node_tree.nodes.new('ShaderNodeTexImage'); rough_tex.image=rough_image
        channels=m.node_tree.nodes.new('ShaderNodeSeparateColor')
        m.node_tree.links.new(rough_tex.outputs['Color'],channels.inputs['Color'])
        m.node_tree.links.new(channels.outputs['Green'],p.inputs['Roughness'])
    return m

def resin_detail(mat):
    # Fine moulded PBT grain: real 1K normal/roughness detail, not glossy lacquer.
    rng=np.random.default_rng(42)
    grain=rng.normal(0,1,(1024,1024)).astype(np.float32)
    pixels=np.ones((1024,1024,4),np.float32)
    pixels[:,:,0]=.5+(np.roll(grain,1,axis=1)-grain)*.014
    pixels[:,:,1]=.5+(np.roll(grain,1,axis=0)-grain)*.014
    pixels[:,:,2]=1
    image=bpy.data.images.get('satin_resin_normal_1k')
    if image is None:
        image=bpy.data.images.new('satin_resin_normal_1k',1024,1024)
        image.colorspace_settings.name='Non-Color';image.pixels.foreach_set(pixels.ravel());image.pack()
    nodes=mat.node_tree.nodes;links=mat.node_tree.links;p=nodes.get('Principled BSDF')
    tex=nodes.new('ShaderNodeTexImage');tex.image=image
    normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.22
    links.new(tex.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],p.inputs['Normal'])
    rough=bpy.data.images.get('satin_resin_roughness_1k')
    if rough is None:
        pixels[:,:,:3]=np.clip(.46+grain[:,:,None]*.018,.38,.54)
        rough=bpy.data.images.new('satin_resin_roughness_1k',1024,1024)
        rough.colorspace_settings.name='Non-Color';rough.pixels.foreach_set(pixels.ravel());rough.pack()
    tex=nodes.new('ShaderNodeTexImage');tex.image=rough
    channels=nodes.new('ShaderNodeSeparateColor');links.new(tex.outputs['Color'],channels.inputs['Color'])
    links.new(channels.outputs['Green'],p.inputs['Roughness'])

paint=material('marquee_powdercoat','17121f',.42,.12,.18,'powdercoat-v1')
trim=material('satin_nickel','81748c',.29,.9,0,'brushed-v1')
chrome=material('polished_chrome','c7c6d3',.17,.98)
plate=material('brushed_joystick_plate','9d97aa',.28,.88,0,'brushed-v1')
rubber=material('rubber_seal','090812',.8)
pearl=material('ivory_opal_key','e9dbc7',.48,0,.08)
purple=material('lavender_opal_key','9871cb',.48,0,.08)
resin_detail(pearl); resin_detail(purple)
ball_mat=material('lavender_balltop','b99bdd',.15,.06,.95)
light=material('marquee_light','b5a0ec',.26)
p=light.node_tree.nodes.get('Principled BSDF'); p.inputs['Emission Color'].default_value=(*rgb('b5a0ec'),1); p.inputs['Emission Strength'].default_value=2

def finish(o,name,mat,bevel=0):
    o.name=name
    if mat: o.data.materials.append(mat)
    bpy.context.view_layer.objects.active=o
    if bevel:
        mod=o.modifiers.new('Manufactured radii','BEVEL'); mod.width=bevel; mod.segments=5
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for f in o.data.polygons: f.use_smooth=True
    mod=o.modifiers.new('Weighted face normals','WEIGHTED_NORMAL'); mod.keep_sharp=True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return o

def box(name,loc,size,mat,bevel=.008):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,bevel)

def cylinder(name,loc,r,depth,mat,bevel=.003):
    bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=r,depth=depth,location=loc)
    return finish(bpy.context.object,name,mat,bevel)

def torus(name,loc,r,t,mat):
    bpy.ops.mesh.primitive_torus_add(major_segments=64,minor_segments=12,location=loc,major_radius=r,minor_radius=t)
    return finish(bpy.context.object,name,mat)

def group(name,loc=(0,0,0),parent=None):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.location=loc; o.parent=parent; return o

deck=group('deck_frame',(0,0,.18)); deck.rotation_euler.x=math.radians(10)
def attach(o,parent=deck):
    o.parent=parent; return o

def recess(subject,cutter):
    bpy.context.view_layer.objects.active=subject
    mod=subject.modifiers.new('Machined opening','BOOLEAN'); mod.operation='DIFFERENCE'; mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name); bpy.data.objects.remove(cutter,do_unlink=True)

def ring(name,loc,w,h,depth,border,mat,parent=deck):
    o=box(name,loc,(w,h,depth),mat,min(.035,h/8))
    cutter=box('cut',loc,(w-border*2,h-border*2,depth+.15),None,.025)
    recess(o,cutter); return attach(o,parent)

def screw(x,y,z,parent=deck,r=.013):
    attach(cylinder('screw_countersink',(x,y,z-.002),r*1.4,.006,rubber),parent)
    attach(cylinder('screw_head',(x,y,z+.001),r,.006,chrome,.001),parent)
    attach(box('milled_screw_slot',(x,y,z+.0045),(r*1.3,.0025,.001),rubber,.0006),parent)

def surface(name,loc,w,h,parent=deck):
    m=material(name+'_ink','ffffff',.4)
    image=bpy.data.images.new(name+'_uv',4,4); image.generated_color=(.01,.01,.02,1); image.pack()
    tex=m.node_tree.nodes.new('ShaderNodeTexImage'); tex.image=image
    m.node_tree.links.new(tex.outputs['Color'],m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
    if name=='display_main':
        nx,ny=40,12
        verts=[]
        for j in range(ny+1):
            for i in range(nx+1):
                u,v=i/nx,j/ny
                verts.append(((u-.5)*w,(v-.5)*h,.011*(1-(2*u-1)**2)*(1-(2*v-1)**2)))
        faces=[]
        for j in range(ny):
            for i in range(nx):
                a=j*(nx+1)+i;faces.append((a,a+1,a+nx+2,a+nx+1))
        data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
        o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.location=loc
        uv=data.uv_layers.new(name='UVMap')
        for polygon in data.polygons:
            for idx in polygon.loop_indices:
                vi=data.loops[idx].vertex_index
                uv.data[idx].uv=(vi%(nx+1)/nx,vi//(nx+1)/ny)
    else:
        bpy.ops.mesh.primitive_plane_add(size=1,location=loc); o=bpy.context.object; o.scale=(w,h,1)
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return attach(finish(o,name,m),parent)

def sculpted_cap(name,width,mat,parent):
    # Rounded in plan AND in profile: an injection-moulded lens, not a bevelled cube.
    rings=[(.005,width-.028,.370,.037),(.016,width-.008,.397,.044),(.052,width-.008,.397,.044),(.069,width-.034,.371,.051),(.078,width-.061,.344,.054)]
    verts=[]
    for z,w,h,r in rings:
        for cx,cy,start in [(w/2-r,h/2-r,0),(-w/2+r,h/2-r,90),(-w/2+r,-h/2+r,180),(w/2-r,-h/2+r,270)]:
            for step in range(12):
                a=math.radians(start+step*90/11)
                verts.append((cx+math.cos(a)*r,cy+math.sin(a)*r,z))
    n=48;faces=[tuple(range(n-1,-1,-1))]
    for row in range(len(rings)-1):
        for i in range(n):faces.append((row*n+i,row*n+(i+1)%n,(row+1)*n+(i+1)%n,(row+1)*n+i))
    faces.append(tuple(range((len(rings)-1)*n,len(rings)*n)))
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o)
    return attach(finish(o,name,mat),parent)

def glow(name,loc,w,h,parent=deck):
    image=bpy.data.images.get('light_diffusion')
    if image is None:
        size=128;y,x=np.mgrid[0:size,0:size].astype(np.float32)/(size-1)*2-1
        pixels=np.ones((size,size,4),np.float32)
        pixels[:,:,3]=np.maximum(0,1-x*x)**2*np.maximum(0,1-y*y)**3
        image=bpy.data.images.new('light_diffusion',size,size);image.pixels.foreach_set(pixels.ravel());image.pack()
    m=material(name+'_material','ffffff',.5)
    p=m.node_tree.nodes.get('Principled BSDF');t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=image
    m.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color']);m.node_tree.links.new(t.outputs['Alpha'],p.inputs['Alpha'])
    bpy.ops.mesh.primitive_plane_add(size=1,location=loc);o=bpy.context.object;o.scale=(w,h,1)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return attach(finish(o,name,m),parent)

# A real sloping enclosure with separate folded lower shell, service seam and metal end caps.
profile=[(-.35,.02),(-.39,.07),(-.39,.11),(-.32,.125),(.34,.242),(.39,.22),(.39,.035)]
verts=[(x,y,z) for x in [-1.97,1.97] for y,z in profile]; n=len(profile)
faces=[tuple(range(n)),tuple(range(2*n-1,n-1,-1))]+[(i+n,(i+1)%n+n,(i+1)%n,i) for i in range(n)]
mesh=bpy.data.meshes.new('folded_shell'); mesh.from_pydata(verts,[],faces); mesh.update()
shell=bpy.data.objects.new('housing_cast_shell',mesh); bpy.context.collection.objects.link(shell); finish(shell,shell.name,paint,.02)
for x in [-1.982,1.982]:
    attach(box('metal_end_cap',(x,0,-.015),(.026,.756,.115),trim,.012))
attach(box('deck_gasket',(0,0,-.022),(3.90,.716,.012),rubber,.025))
attach(box('continuous_deck',(0,0,-.007),(3.89,.70,.028),paint,.025))
box('front_light_channel',(0,-.394,.072),(3.74,.009,.015),rubber,.005)
box('front_light_diffuser',(0,-.400,.072),(3.66,.007,.006),light,.002)
glow('glow_underlight',(0,-.43,.020),3.94,.40,None)
for x in [-1.72,1.72]:
    for y in [-.24,.24]: cylinder('rubber_foot',(x,y,.013),.075,.024,rubber)
for x in [-1.89,1.89]: screw(x,.27,.012)

# The marquee is lifted and tilted toward the viewer, like a small arcade cabinet header.
marquee=group('marquee_frame',(-.08,.025,.035),deck); marquee.rotation_euler.x=math.radians(17)
attach(box('marquee_back', (0,0,-.005),(1.86,.59,.105),paint,.045),marquee)
ring('marquee_outer_nickel',(0,0,.049),1.82,.553,.038,.016,trim,marquee)
ring('marquee_inner_seal',(0,0,.061),1.77,.500,.013,.020,rubber,marquee)
ring('marquee_luminous_reveal',(0,0,.057),1.73,.460,.009,.005,light,marquee)
surface('display_main',(0,0,.063),1.698,.424,marquee)

# Joystick gate, dust seal, polished steel shaft and independently tilting ball-top assembly.
attach(box('joystick_plate_gasket',(-1.44,0,.014),(.78,.59,.02),rubber,.03))
attach(box('joystick_brushed_plate',(-1.44,0,.029),(.75,.56,.022),plate,.025))
attach(cylinder('joystick_dust_washer',(-1.44,.035,.048),.139,.017,rubber))
attach(torus('joystick_gate_rim',(-1.44,.035,.064),.123,.009,chrome))
attach(cylinder('joystick_inner_gate',(-1.44,.035,.061),.099,.012,rubber))
stick=group('ctl_joystick',(-1.44,.035,.058),deck)
attach(cylinder('joystick_shaft',(0,0,.113),.028,.215,chrome),stick)
attach(torus('balltop_locknut',(0,0,.214),.035,.007,trim),stick)
bpy.ops.mesh.primitive_uv_sphere_add(segments=64,ring_count=40,radius=.121,location=(0,0,.297))
attach(finish(bpy.context.object,'joystick_balltop',ball_mat),stick)
surface('display_prev',(-1.633,-.19,.042),.306,.089)
surface('display_next',(-1.246,-.19,.042),.306,.089)

# Two large illuminated rectangular switch assemblies. Labels travel with their caps.
def key(name,x,w,mat):
    attach(box(name+'_recess',(x,0,.018),(w+.05,.47,.035),rubber,.044))
    ring(name+'_collar',(x,0,.037),w+.025,.448,.025,.009,trim)
    attach(box(name+'_light',(x,0,.048),(w-.003,.422,.020),light,.047))
    moving=group(name,(x,0,.05),deck)
    attach(box(name+'_skirt',(0,0,.012),(w-.025,.404,.05),rubber,.042),moving)
    sculpted_cap(name+'_cap',w,mat,moving)
    # A shallow double-mould seam wraps the key below the top bevel.
    ring(name+'_cap_seam',(0,0,.019),w-.010,.395,.003,.003,rubber,moving)
    surface('display_action' if name=='ctl_open' else 'display_directory',(0,0,.079),w-.082,.277,moving)
    glow('glow_'+name,(x,0,.025),w+.26,.69)
    return moving
key('ctl_open',1.20,.44,pearl)
key('ctl_directory',1.697,.40,purple)

# Recessed channel selectors in the front fascia, separate from the main controls.
rail=group('station_rail',(0,-.49,.085)); rail.rotation_euler.x=math.radians(40)
attach(box('station_rail_shell',(0,0,-.018),(3.88,.235,.085),paint,.026),rail)
ring('station_rail_lip',(0,0,.025),3.77,.196,.018,.012,trim,rail)
attach(box('station_rail_recess',(0,0,.022),(3.74,.17,.012),rubber,.012),rail)
for i in range(13):
    x=(i-6)*.281
    attach(box(f'station_socket_{i}',(x,0,.030),(.268,.167,.019),rubber,.010),rail)
    selector=group(f'ctl_station_{i}',(x,0,.056),rail)
    attach(box(f'station_key_skirt_{i}',(0,0,-.009),(.235,.126,.036),rubber,.006),selector)
    attach(box(f'station_cap_{i}',(0,0,0),(.247,.139,.034),paint,.008),selector)
    surface(f'display_station_{i}',(0,-.010,.018),.16,.098,selector)
    attach(box(f'station_lamp_{i}',(0,.053,.019),(.196,.008,.004),light,.002),selector)

# Material scans use a consistent real-world scale. Authored print UVs remain untouched.
for o in bpy.context.scene.objects:
    if o.type!='MESH' or o.name.startswith(('display_','glow_')): continue
    if o.name=='housing_cast_shell':
        for p in o.data.polygons:
            if p.area>.03: p.use_smooth=False
    if not o.data.uv_layers: o.data.uv_layers.new(name='UVMap')
    uv=o.data.uv_layers.active.data
    for poly in o.data.polygons:
        axis=max(range(3),key=lambda a:abs(poly.normal[a])); axes=[a for a in range(3) if a!=axis]
        for idx in poly.loop_indices:
            co=o.data.vertices[o.data.loops[idx].vertex_index].co
            uv[idx].uv=(co[axes[0]]*6,co[axes[1]]*6)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SOURCE,NAME+'.blend'))
out=os.path.join(ROOT,'public/models',NAME+'.glb')
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True)
print(f'MARQUEE_EXPORTED {out} {os.path.getsize(out)} bytes')
