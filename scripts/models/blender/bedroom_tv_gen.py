"""The rounded graphite bedroom TV stand, built one piece at a time (Dennis, 2026-10-07).
blender -b -P scripts/models/blender/bedroom_tv_gen.py -- public/models/bedroom-tv-v1.glb [render directory]
Each assembly is a named mesh: stand, CRT, GameCube, PAL SNES, N64, Game Boy, DS, controllers, games, cables.
No generative surface paint: clean moulded shells, real game-cover textures, readable printing, actual seams.
"""
import bpy,math,os,sys,json
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from bedroom_tv_common import *
from bedroom_tv_consoles import build_consoles,build_handhelds,build_controllers,build_games
args=sys.argv[sys.argv.index('--')+1:];DST=os.path.abspath(args[0]);RENDER=args[1] if len(args)>1 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
palette={
 'silver':(0xbfc3cb,.34,.38),'rear':(0x9298a3,.48,.12),'chrome':(0xd1d7df,.23,.85),
 'graphite':(0x333238,.42,.08),'edge':(0x53545a,.35,.25),'rubber':(0x15161a,.65,0),
 'black':(0x252631,.36,.05),'ink':(0x39394b,.6,0),'white':(0xe1e3e4,.45,0),
 'grey':(0xb7b8c3,.42,0),'darkgrey':(0x777986,.5,0),'purple':(0x4d428c,.38,.06),
 'purple-dark':(0x332b65,.48,0),'green':(0x399d81,.35,0),'red':(0xa72943,.38,0),
 'yellow':(0xe3b44a,.4,0),'blue':(0x476aa8,.38,0),'magenta':(0x812748,.38,0),
 'lcd':(0x879750,.7,0),'paper':(0xd2c9b4,.7,0),'gold':(0xbdb089,.4,.25),
 'led':(0x76dd9c,.3,0),
}
for key,(c,r,m) in palette.items():MAT[key]=material('bedroom-'+key,c,r,m)
MAT['led'].node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value=(.04,.35,.12,1)
MAT['led'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value=1
image_mat('covers','.source-assets/bedroom-tv/covers.png')
image_mat('crt-image','.source-assets/bedroom-tv/melee-Named_Snaps.png',.65)
image_mat('gb-image','.source-assets/bedroom-tv/links-awakening-Named_Snaps.png',.05)
gb=MAT['gb-image'];nodes=gb.node_tree.nodes;links=gb.node_tree.links
tex=next(n for n in nodes if n.type=='TEX_IMAGE');ramp=nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].color=(.029,.049,.016,1);ramp.color_ramp.elements[1].color=(.37,.45,.16,1)
links.new(tex.outputs['Color'],ramp.inputs['Fac'])
links.new(ramp.outputs['Color'],nodes['Principled BSDF'].inputs['Base Color'])
image_mat('ds-top-image','.source-assets/bedroom-tv/ds-top.png',.3)
image_mat('ds-touch-image','.source-assets/bedroom-tv/ds-touch.png',.3)

def stand():
    before=set(bpy.data.objects)
    for i,z in enumerate([.10,.405,.715]):
        # Broad corner curves, fine bevel on the laminate edge, its seam visible at eye height.
        rb('shelf-'+str(i),-.59,.59,-.25,.235,z,z+.022,'graphite',.105,.003)
        rb('shelf-rim-'+str(i),-.591,.591,-.251,.236,z+.004,z+.008,'edge',.105,.0007)
    for x in [-.535,.535]:
        for y in [-.177,.164]:
            cyl('post',.0185,0,0,.027,.738,'chrome',verts=32,axis='Z',at=(x,y))
            for z in [.106,.414,.724]:
                disk('shelf-collar',x,y,z,.023,.017,'silver')
            disk('foot-cap',x,y,.03,.023,.018,'rubber')
            disk('post-end',x,y,.735,.0185,.008,'silver')
    # A shallow wing for the two handhelds, matching the right-hand corner of the mockup.
    rb('handheld-wing',.31,.60,-.20,.20,.738,.752,'graphite',.095,.002)
    group_piece('tv-stand',before)

def crt():
    before=set(bpy.data.objects)
    x=-.135;base=.748;zc=base+.226;front_y=-.204
    def loop(w,h,r,y,z):return [(x+a,y,z+b) for a,b in rounded_loop(w,h,r)]
    shell=loft('crt-deep-shell',[
        loop(.518,.432,.033,-.177,zc),loop(.520,.433,.036,-.135,zc),
        loop(.452,.371,.047,.157,zc-.005),loop(.354,.292,.046,.244,zc-.012),
        loop(.342,.279,.041,.254,zc-.012)],'rear')
    # A genuine open bezel around the tube, not a picture pasted on a solid box.
    outer=loop(.531,.439,.037,front_y,zc)
    inner=loop(.432,.331,.024,front_y-.006,zc+.026)
    n=len(outer);verts=outer+inner;faces=[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh('crt-front-bezel',verts,faces,'silver')
    # The rolled outer edge, and the recessed dark tube surround.
    loft('crt-front-roll',[loop(.516,.424,.031,-.182,zc),outer],'silver',caps=False)
    rimouter=inner;riminner=loop(.410,.307,.023,front_y+.009,zc+.026)
    mesh('crt-tube-surround',rimouter+riminner,faces,'black')
    # Convex CRT face: curved perimeter as well as the curved glass in depth.
    w,h=.401,.299;cy=front_y+.005;cz=zc+.026;verts=[];uv=[];faces=[];nx,ny=28,22
    for j in range(ny+1):
        v=j/ny;zz=(v-.5)*h
        for i in range(nx+1):
            u=i/nx;xx=(u-.5)*w
            # Gently pinched tube corners; the active image fills this same curved mesh.
            xx*=1-.032*(abs(v-.5)*2)**8
            zz2=zz*(1-.032*(abs(u-.5)*2)**8)
            bulge=.014*(1-(xx/(w*.51))**2)*(1-(zz2/(h*.51))**2)
            verts.append((x+xx,cy-bulge,cz+zz2));uv.append((u,v))
    for j in range(ny):
        for i in range(nx):a=j*(nx+1)+i;faces.append((a,a+1,a+nx+2,a+nx+1))
    mesh('crt-screen',verts,faces,'crt-image',uv)
    # The bezel slopes back from the tube. Put controls on that face, clear of its inner lip.
    front_y-=.012
    # Twin perforated grilles are recessed on the wide lower chin.
    for gx in [x-.216,x+.216]:
        rb('speaker-inset',gx-.028,gx+.028,front_y-.0007,front_y+.003,base+.032,base+.085,'darkgrey',.007,.0004,axis=1)
        for col in range(9):
            for row in range(7):disk('speaker-hole',gx+(col-4)*.0056,front_y-.0018,base+.043+row*.0055,.00085,.0006,'rubber',axis='Y',verts=8)
    disk('power-button',x-.115,front_y-.003,base+.055,.009,.005,'silver',axis='Y')
    disk('power-light',x-.096,front_y-.002,base+.055,.0018,.001,'led',axis='Y',verts=12)
    for i in range(5):disk('tv-key',x-.054+i*.019,front_y-.002,base+.055,.0037,.0035,'silver',axis='Y',verts=16)
    text('tv-brand','SONY',x,front_y-.0008,base+.091,.009,'ink')
    text('tv-series','TRINITRON',x+.165,front_y-.0008,base+.416,.004,'ink')
    # Recessed front AV sockets and three plugs.
    rb('AV-well',x+.07,x+.139,front_y-.001,front_y+.006,base+.042,base+.064,'black',.008,.0005,axis=1)
    for i,mat in enumerate(['yellow','white','red']):
        xx=x+.083+i*.021
        disk('rca-collar',xx,front_y-.003,base+.053,.005,.003,'chrome',axis='Y',verts=16)
        disk('rca-plug',xx,front_y-.013,base+.053,.0044,.02,mat,axis='Y',verts=16)
        wire('rca-lead',[(xx,front_y-.024,base+.053),(xx+.008,front_y-.038,base+.036),(xx+.026,front_y-.033,.748),(xx+.09,-.135,.748),(x+.265,.22,.722)],.0014)
    # Shell separation, vents down both sides and rear, screws and rubber feet.
    for side in [-1,1]:
        for i in range(11):
            y=-.077+i*.015
            # Vertical side vents conform to the tapered body.
            xx=x+side*(.258-(y+.135)*.116)
            box('side-vent',xx-.0005,xx+.0005,y-.0012,y+.0012,base+.175,base+.302,'rubber')
        for yy in [-.12,.13]:
            rb('tv-foot',x+side*.171-.014,x+side*.171+.014,yy-.027,yy+.027,base-.009,base+.006,'rubber',.009,.002)
    for i in range(18):box('back-vent',x-.127+i*.015,x-.122+i*.015,.253,.254,base+.18,base+.26,'rubber')
    # Preserve the tube as its own mesh so the hall can give it the CRT shader.
    screen=bpy.data.objects['crt-screen'];before.add(screen)
    group_piece('bedroom-crt',before);PARTS.append(screen)

stand();crt();build_consoles();build_handhelds();build_controllers();build_games()
for o in PARTS:
    select_only(o);tri=o.modifiers.new('triangles','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=tri.name)
print('TRIANGLES',sum(len(o.data.polygons) for o in PARTS))
for o in PARTS:print('PIECE',o.name,len(o.data.polygons))
os.makedirs(os.path.dirname(DST),exist_ok=True)
for o in bpy.context.selected_objects:o.select_set(False)
for o in PARTS:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=DST,export_format='GLB',export_yup=True,export_apply=True,use_selection=True,export_image_format='WEBP',export_image_quality=92)
if RENDER:
    os.makedirs(RENDER,exist_ok=True)
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=48
    scene.cycles.use_denoising=True;scene.render.resolution_x=1600;scene.render.resolution_y=1400;scene.render.resolution_percentage=100
    scene.world=bpy.data.worlds.new('studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.09,.10,.14,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
    rb('studio-floor',-200,200,-200,200,-.012,-.002,'graphite',.001,.001)
    def area(name,loc,power,size,target):
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size
        o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
    area('key',(-2,-3,4),350,3,(0,0,.6));area('fill',(2,-1,2),170,2,(0,0,.7));area('rim',(0,3,3),400,2,(0,0,.7))
    bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=1.57
    scene.view_settings.view_transform='AgX'
    for name,loc,target,scale in [('assembly',(1.7,-3.4,1.75),(0,0,.62),1.57),('front',(0,-4,1.48),(0,0,.65),1.55),('detail',(.9,-2,1.25),(-.04,-.02,.49),1.15)]:
        cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=scale
        scene.render.filepath=os.path.join(RENDER,name+'.png');bpy.ops.render.render(write_still=True)
print('DONE',DST)
