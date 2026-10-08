"""Individually modelled Nintendo hardware and the shelf's games. Uses bedroom_tv_common's metre space."""
from bedroom_tv_common import *

def cartridge(name,x,y,z,w,h,d,tile,mat='grey'):
    rb(name,x-w/2,x+w/2,y-d/2,y+d/2,z,z+h,mat,.009,.0015,axis=1)
    rb('cart-label-recess',x-w*.37,x+w*.37,y-d/2-.0005,y-d/2+.001,z+h*.20,z+h*.82,'darkgrey',.003,.0004,axis=1)
    front('cart-label',x,y-d/2-.001,z+h*.51,w*.69,h*.55,'covers',tile)
    for side in [-1,1]:
        for i in range(3):box('cart-grip',x+side*w*.43-.0015,x+side*w*.43+.0015,y-d/2-.0005,y-d/2+.0005,z+h*.23+i*.011,z+h*.23+i*.011+.003,mat)
    return None

def build_consoles():
    # ---------- indigo GameCube: disc lid, four controller sockets, two memory slots and rear handle ----------
    before=set(bpy.data.objects);x,y,z=-.365,.028,.429
    rb('cube-base',x-.097,x+.097,y-.085,y+.087,z,z+.016,'purple-dark',.012,.003)
    rb('cube-shell',x-.10,x+.10,y-.087,y+.089,z+.014,z+.124,'purple',.013,.003)
    rb('cube-front',x-.097,x+.097,y-.089,y-.085,z+.025,z+.104,'grey',.004,.0015,axis=1)
    disk('cube-disc-seam',x,y+.004,z+.125,.076,.0018,'rubber',verts=48)
    disk('cube-disc-lid',x,y+.004,z+.127,.073,.0025,'purple-dark',verts=48)
    disk('cube-lid-medallion',x,y+.004,z+.1287,.027,.0005,'black',verts=40)
    text('cube-disc-print','NINTENDO',x,y+.005,z+.129,.005,'white',top=True)
    text('cube-disc-print-2','GAMECUBE',x,y-.003,z+.129,.006,'white',top=True)
    for xx,yy,r in [(x-.079,y+.063,.009),(x+.077,y+.062,.010),(x-.080,y-.056,.006)]:disk('cube-top-key',xx,yy,z+.127,r,.004,'purple')
    text('cube-power-print','POWER',x-.079,y+.077,z+.127,.0038,'white',top=True)
    disk('cube-power-led',x-.078,y+.042,z+.128,.0018,.001,'yellow',verts=12)
    for i in range(4):
        xx=x-.066+i*.044
        disk('cube-port-rim',xx,y-.0895,z+.077,.0145,.002,'silver',axis='Y')
        disk('cube-controller-port',xx,y-.091,z+.077,.0115,.001,'rubber',axis='Y')
        # Socket tongue and three visible contacts.
        rb('cube-port-tongue',xx-.006,xx+.006,y-.092,y-.091,z+.073,z+.075,'darkgrey',.001,.0002)
        for dx in [-.003,0,.003]:disk('cube-port-contact',xx+dx,y-.092,z+.078,.00055,.0003,'gold',axis='Y',verts=8)
        text('port-number',str(i+1),xx,y-.092,z+.093,.0035,'ink')
    for xx in [x-.044,x+.044]:
        rb('memory-slot',xx-.030,xx+.030,y-.090,y-.087,z+.037,z+.046,'rubber',.002,.0005,axis=1)
        rb('memory-slot-flap',xx-.029,xx+.029,y-.091,y-.090,z+.0375,z+.044,'silver',.001,.0002,axis=1)
    text('cube-face-logo','NINTENDO GAMECUBE',x,y-.0905,z+.056,.006,'ink')
    for side in [-1,1]:
        for i in range(9):box('cube-vent',x+side*.1002-.0004,x+side*.1002+.0004,y-.032+i*.009,y-.028+i*.009,z+.035,z+.088,'purple-dark')
    wire('cube-handle',[(x-.075,y+.084,z+.064),(x-.070,y+.115,z+.068),(x,y+.124,z+.072),(x+.070,y+.115,z+.068),(x+.075,y+.084,z+.064)],.009,'black')
    for xx in [x-.08,x+.08]:
        for yy in [y-.064,y+.064]:disk('cube-foot',xx,yy,z,.01,.004,'rubber',verts=16)
    # Player-one plug is physically connected to the controller below.
    rb('cube-controller-plug',x-.076,x-.056,y-.115,y-.089,z+.065,z+.088,'black',.004,.001)
    group_piece('nintendo-gamecube',before)

    # ---------- PAL SNES: stepped moulding, cartridge well, two broad sliders and two controller ports ----------
    before=set(bpy.data.objects);x,y,z=.294,.035,.429
    rb('snes-base',x-.140,x+.140,y-.104,y+.108,z,z+.023,'darkgrey',.025,.005)
    rb('snes-lower-shell',x-.142,x+.142,y-.105,y+.110,z+.018,z+.043,'grey',.025,.003)
    rb('snes-upper-shell',x-.140,x+.140,y-.096,y+.110,z+.041,z+.066,'grey',.024,.004)
    rb('snes-cartridge-deck',x-.097,x+.097,y+.005,y+.103,z+.064,z+.078,'darkgrey',.017,.003)
    rb('snes-cartridge-slot',x-.063,x+.063,y+.029,y+.043,z+.077,z+.079,'rubber',.004,.0005)
    rb('snes-eject',x-.039,x+.039,y-.031,y-.011,z+.066,z+.071,'darkgrey',.004,.001)
    text('snes-eject-print','EJECT',x,y-.026,z+.0715,.004,'ink',top=True)
    for xx,label in [(x-.103,'POWER'),(x+.103,'RESET')]:
        rb('snes-slider-well',xx-.012,xx+.012,y-.036,y-.001,z+.064,z+.067,'ink',.004,.0005)
        rb('snes-slider',xx-.011,xx+.011,y-.025,y-.002,z+.066,z+.074,'purple-dark',.003,.001)
        text('snes-control-label',label,xx,y-.047,z+.067,.0035,'ink',top=True)
    text('snes-logo','SUPER NINTENDO',x-.067,y-.076,z+.067,.006,'ink',top=True)
    text('snes-logo-sub','ENTERTAINMENT SYSTEM',x-.067,y-.084,z+.067,.003,'ink',top=True)
    for i,mat in enumerate(['blue','green','yellow','red']):disk('snes-colour-logo',x+.068+(i%2)*.007,y-.072+(i//2)*.007,z+.0675,.0035,.0005,mat,verts=12)
    for xx in [x-.064,x+.064]:
        rb('snes-port-frame',xx-.032,xx+.032,y-.106,y-.103,z+.019,z+.037,'darkgrey',.005,.001,axis=1)
        rb('snes-port',xx-.028,xx+.028,y-.107,y-.106,z+.023,z+.033,'rubber',.003,.0005,axis=1)
        for i in range(7):disk('snes-port-contact',xx-.020+i*.0065,y-.1075,z+.028,.0008,.0005,'silver',axis='Y',verts=8)
    text('snes-front-brand','Nintendo',x,y-.1065,z+.045,.005,'ink')
    disk('snes-power-led',x-.115,y-.1065,z+.046,.0018,.001,'red',axis='Y',verts=12)
    # Yoshi's Island is the cartridge currently inserted, its label facing the room.
    cartridge('snes-yoshi-cartridge',x,y+.035,z+.073,.128,.061,.016,3)
    for i in range(12):box('snes-rear-vent',x-.08+i*.014,x-.074+i*.014,y+.075,y+.104,z+.079,z+.0798,'ink')
    group_piece('nintendo-snes',before)

    # ---------- N64: rounded swept shell, expansion bay and four unmistakable front ports ----------
    before=set(bpy.data.objects);x,y,z=.24,.025,.124
    loop=rounded_loop(.282,.216,.048,8)
    loft('n64-shell',[
        [(x+a*.93,y+b*.95,z+.006) for a,b in loop],
        [(x+a,y+b,z+.025) for a,b in loop],
        [(x+a*.98,y+b*.97,z+.055) for a,b in loop],
        [(x+a*.89,y+b*.87,z+.069+.013*(1-abs(a)/.141)) for a,b in loop]],'black')
    rb('n64-cart-well',x-.078,x+.078,y+.030,y+.065,z+.072,z+.076,'rubber',.012,.001)
    rb('n64-cart-flap',x-.068,x+.068,y+.038,y+.056,z+.075,z+.077,'darkgrey',.005,.0005)
    cartridge('n64-smash-cartridge',x,y+.047,z+.067,.116,.072,.019,4)
    rb('n64-expansion-bay',x-.037,x+.037,y-.047,y-.002,z+.080,z+.082,'rubber',.009,.001)
    for side in [-1,1]:
        xx=x+side*.093
        rb('n64-key-recess',xx-.018,xx+.018,y-.048,y+.015,z+.066,z+.069,'rubber',.01,.001)
        rb('n64-power-reset',xx-.014,xx+.014,y-.038,y-.006,z+.068,z+.074,'darkgrey',.007,.001)
        text('n64-key-label','POWER' if side<0 else 'RESET',xx,y-.052,z+.070,.0035,'white',top=True)
    for i in range(4):
        xx=x-.093+i*.062
        disk('n64-port-ring',xx,y-.114,z+.032,.017,.003,'grey',axis='Y',verts=28)
        disk('n64-port',xx,y-.116,z+.032,.0137,.0018,'rubber',axis='Y',verts=28)
        rb('n64-port-tab',xx-.007,xx+.007,y-.118,y-.116,z+.029,z+.032,'darkgrey',.001,.0003)
        for dx in [-.004,0,.004]:disk('n64-port-pin',xx+dx,y-.118,z+.035,.0008,.0006,'silver',axis='Y',verts=8)
        text('n64-port-number',str(i+1),xx,y-.114,z+.008,.0035,'white')
    # The coloured N mark, followed by the small Nintendo wordmark.
    for dx,dy,mat in [(-.004,0,'blue'),(.004,0,'green'),(0,.004,'yellow'),(0,-.004,'red')]:rb('n64-emblem',x+dx-.003,x+dx+.003,y-.090+dy-.003,y-.090+dy+.003,z+.066,z+.067,mat,.0005,.0002)
    text('n64-wordmark','NINTENDO 64',x,y-.075,z+.082,.0048,'white',top=True)
    disk('n64-led',x-.123,y-.106,z+.046,.0016,.001,'red',axis='Y',verts=12)
    for i in range(10):box('n64-vent',x-.10+i*.020,x-.095+i*.020,y+.081,y+.090,z+.063,z+.064,'rubber')
    group_piece('nintendo-64',before)

def dpad(x,y,z,size,mat='rubber',front_face=False):
    if front_face:
        rb('dpad-horizontal',x-size/2,x+size/2,y-.0015,y+.0015,z-size/6,z+size/6,mat,.0008,.0005,axis=1)
        rb('dpad-vertical',x-size/6,x+size/6,y-.0015,y+.0015,z-size/2,z+size/2,mat,.0008,.0005,axis=1)
    else:
        rb('dpad-horizontal',x-size/2,x+size/2,y-size/6,y+size/6,z,z+.003,mat,.001,.0005)
        rb('dpad-vertical',x-size/6,x+size/6,y-size/2,y+size/2,z,z+.003,mat,.001,.0005)

def build_handhelds():
    # ---------- original DMG Game Boy, propped upright on the right wing ----------
    before=set(bpy.data.objects);x,y,z=.476,.061,.758
    rb('gameboy-back',x-.041,x+.041,y-.012,y+.013,z,z+.141,'darkgrey',.009,.002,axis=1)
    rb('gameboy-front',x-.042,x+.042,y-.014,y-.010,z+.001,z+.142,'grey',.009,.0015,axis=1)
    rb('gameboy-screen-bezel',x-.036,x+.036,y-.0155,y-.014,z+.071,z+.131,'darkgrey',.007,.0005,axis=1)
    front('gameboy-lcd',x+.004,y-.016,z+.101,.043,.039,'gb-image')
    disk('gameboy-battery-led',x-.029,y-.016,z+.102,.0013,.001,'red',axis='Y',verts=12)
    text('gameboy-bezel-text','DOT MATRIX WITH STEREO SOUND',x,y-.016,z+.124,.0023,'white')
    text('gameboy-brand','Nintendo GAME BOY',x-.032,y-.015,z+.064,.004,'blue',align='LEFT')
    dpad(x-.023,y-.017,z+.042,.022,front_face=True)
    for dx,dz in [(0,0),(.014,.007)]:
        disk('gameboy-action',x+.016+dx,y-.017,z+.042+dz,.006,.004,'magenta',axis='Y',verts=24)
    for xx,label in [(x-.009,'SELECT'),(x+.009,'START')]:
        rb('gameboy-system-key',xx-.005,xx+.005,y-.017,y-.015,z+.021,z+.024,'darkgrey',.001,.0004,axis=1)
        text('gameboy-system-print',label,xx,y-.015,z+.014,.0024,'blue')
    for i in range(6):
        wire('gameboy-speaker-slot',[(x+.013+i*.0037,y-.0157,z+.012),(x+.011+i*.0037,y-.0157,z+.023)],.0006,'rubber')
    rb('gameboy-power-slider',x-.043,x-.041,y-.006,y+.006,z+.113,z+.123,'rubber',.001,.0004)
    rb('gameboy-link-port',x+.041,x+.043,y-.005,y+.007,z+.097,z+.109,'rubber',.001,.0003)
    for xx in [x-.025,x+.025]:disk('gameboy-back-screw',xx,y+.0135,z+.129,.002,.001,'ink',axis='Y',verts=12)
    rb('gameboy-support',x-.032,x+.032,y+.006,y+.039,z-.004,z+.017,'black',.004,.001)
    group_piece('nintendo-gameboy',before)

    # ---------- original silver DS, open with visible hinge, two screens, speakers and stylus ----------
    before=set(bpy.data.objects);x,y,z=.30,-.067,.757
    rb('ds-lower-back',x-.070,x+.070,y-.042,y+.041,z,z+.010,'darkgrey',.010,.002)
    rb('ds-lower-front',x-.071,x+.071,y-.043,y+.041,z+.009,z+.016,'silver',.01,.0015)
    rb('ds-touch-bezel',x-.034,x+.034,y-.030,y+.023,z+.015,z+.0168,'black',.002,.0003)
    top_art('ds-touch-screen',x,y-.004,z+.017,.058,.044,'ds-touch-image',None)
    dpad(x-.052,y+.002,z+.016,.019)
    for dx,dy,label in [(-.008,0,'Y'),(0,.008,'X'),(0,-.008,'B'),(.008,0,'A')]:
        disk('ds-action',x+.052+dx,y+.001+dy,z+.018,.0032,.003,'darkgrey',verts=16)
        text('ds-button-print',label,x+.052+dx,y+dy-.001,z+.0198,.0023,'white',top=True)
    for yy,label in [(y-.020,'START'),(y-.030,'SELECT')]:
        disk('ds-system-key',x+.048,yy,z+.0175,.002,.002,'darkgrey',verts=12)
        text('ds-key-label',label,x+.057,yy,z+.017,.002,'ink',top=True)
    # Hinge has a thicker central cylinder, with separated end bearings.
    for xx,w in [(x,.086),(x-.058,.022),(x+.058,.022)]:
        o=disk('ds-hinge',0,0,0,.0065,w,'silver',axis='Y',verts=24)
        o.rotation_euler.z=math.pi/2;o.location=(xx,y+.037,z+.018)
        select_only(o);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    # Lid standing at 105 degrees; build upright then tilt around the hinge axis.
    lid_before=set(bpy.data.objects);lid_y=y+.036;lid_z=z+.021
    rb('ds-lid-back',x-.071,x+.071,lid_y-.001,lid_y+.008,lid_z,lid_z+.078,'silver',.009,.0015,axis=1)
    rb('ds-lid-face',x-.070,x+.070,lid_y-.002,lid_y,lid_z+.002,lid_z+.077,'grey',.009,.0007,axis=1)
    rb('ds-upper-screen-rim',x-.035,x+.035,lid_y-.0025,lid_y-.002,lid_z+.015,lid_z+.066,'black',.003,.0004,axis=1)
    front('ds-top-screen',x,lid_y-.003,lid_z+.0405,.058,.043,'ds-top-image')
    for side in [-1,1]:
        for col in range(3):
            for row in range(5):disk('ds-speaker-hole',x+side*.052+(col-1)*.003,lid_y-.0025,lid_z+.034+row*.003,.0007,.0005,'rubber',axis='Y',verts=8)
    text('ds-logo','Nintendo DS',x,lid_y-.0025,lid_z+.006,.0035,'ink')
    pivot=Vector((x,lid_y,lid_z));from mathutils import Matrix
    rot=Matrix.Rotation(math.radians(-14),4,'X')
    for o in [o for o in bpy.data.objects if o not in lid_before]:
        for v in o.data.vertices:v.co=pivot+rot@(v.co-pivot)
    # Stylus, status lamps and the GBA cartridge slot on the lower front edge.
    wire('ds-stylus',[(x-.039,y-.050,z+.008),(x+.039,y-.050,z+.009)],.0015,'darkgrey')
    rb('ds-gba-slot',x-.025,x+.025,y-.0435,y-.042,z+.002,z+.007,'rubber',.002,.0003,axis=1)
    for xx,mat in [(x+.063,'green'),(x+.056,'yellow')]:disk('ds-status-led',xx,y+.038,z+.020,.001,.001,mat,verts=12)
    group_piece('nintendo-ds',before)

def controller_shape(name,points,x,y,z,w,d,mat):
    # Smooth Catmull-Rom outline: the grips are moulded into the shell, not separate spheres.
    pts=[];N=len(points)
    for i in range(N):
        p0,p1,p2,p3=[Vector(points[k%N]) for k in [i-1,i,i+1,i+2]]
        for j in range(5):
            t=j/5;v=.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t);pts.append(v)
    loops=[]
    for zz,s in [(z,.88),(z+.005,1),(z+.011,1),(z+.016,.91),(z+.018,.76)]:loops.append([(x+p.x*w*s,y+p.y*d*s,zz) for p in pts])
    return loft(name,loops,mat)

def stick(x,y,z,r=.009,mat='grey'):
    disk('stick-socket',x,y,z,r*1.5,.0015,'rubber',verts=24)
    disk('stick-octagonal-gate',x,y,z+.001,r*1.25,.002,'darkgrey',verts=8)
    disk('stick-shaft',x,y,z+.006,r*.25,.01,mat,verts=12)
    disk('stick-cap',x,y,z+.012,r,.006,mat,verts=24)
    for rr in [.40,.67]:
        # Grip rings: fine dark grooves on the concave thumb pad.
        points=[(x+math.cos(i*math.tau/32)*r*rr,y+math.sin(i*math.tau/32)*r*rr,z+.0151) for i in range(33)]
        wire('thumb-groove',points,.00028,'darkgrey')

def build_controllers():
    before=set(bpy.data.objects);x,y,z=-.345,-.175,.429
    points=[(-.50,.17),(-.38,.39),(-.13,.42),(0,.30),(.13,.42),(.38,.39),(.50,.17),(.43,-.12),(.32,-.52),(.21,-.53),(.15,-.13),(-.15,-.13),(-.21,-.53),(-.32,-.52),(-.43,-.12)]
    controller_shape('gc-controller-shell',points,x,y,z,.145,.091,'purple')
    stick(x-.036,y+.019,z+.022,.0085)
    dpad(x-.016,y-.015,z+.023,.017)
    stick(x+.021,y-.025,z+.021,.007,'yellow')
    disk('gc-A',x+.038,y+.011,z+.023,.0085,.004,'green')
    disk('gc-B',x+.021,y+.005,z+.023,.0048,.003,'red')
    for xx,yy,sx,sy in [(x+.034,y+.029,.008,.0035),(x+.056,y+.017,.0035,.008)]:sphere('gc-X-Y',xx,yy,z+.023,sx,sy,.0025,'grey')
    disk('gc-start',x,y+.013,z+.022,.003,.003,'grey',verts=16)
    text('gc-controller-brand','Nintendo',x,y+.024,z+.022,.004,'white',top=True)
    for xx in [x-.051,x+.051]:rb('gc-shoulder',xx-.012,xx+.012,y+.035,y+.043,z+.009,z+.020,'grey',.004,.001)
    rb('gc-Z',x+.041,x+.058,y+.032,y+.039,z+.020,z+.025,'blue',.003,.0007)
    group_piece('gamecube-controller',before)

    before=set(bpy.data.objects);x,y,z=.455,-.180,.430
    sphere('snes-controller-lower',x,y,z+.009,.073,.029,.010,'darkgrey')
    sphere('snes-controller-upper',x,y,z+.014,.073,.029,.010,'grey')
    for xx in [x-.043,x+.043]:disk('snes-controller-pad',xx,y,z+.023,.022,.001,'darkgrey',verts=32)
    dpad(x-.043,y,z+.024,.021)
    for dx,dy,mat,label in [(-.010,0,'blue','Y'),(0,.010,'green','X'),(0,-.010,'yellow','B'),(.010,0,'red','A')]:
        disk('snes-action',x+.043+dx,y+dy,z+.025,.0043,.003,mat,verts=20)
        text('snes-button-print',label,x+.043+dx,y+dy-.0014,z+.0268,.003,'white',top=True)
    for xx in [x-.010,x+.010]:rb('snes-start-select',xx-.006,xx+.006,y-.007,y-.002,z+.023,z+.026,'rubber',.002,.0005)
    text('snes-controller-logo','SUPER NINTENDO',x,y+.010,z+.024,.0035,'ink',top=True)
    for xx in [x-.044,x+.044]:rb('snes-shoulder',xx-.021,xx+.021,y+.022,y+.031,z+.012,z+.020,'darkgrey',.003,.001)
    group_piece('snes-controller',before)

    before=set(bpy.data.objects);x,y,z=.43,-.178,.124
    points=[(-.48,.25),(-.35,.39),(-.15,.38),(0,.24),(.15,.38),(.35,.39),(.48,.25),(.46,-.06),(.36,-.49),(.25,-.52),(.19,-.14),(.10,-.13),(.075,-.59),(-.075,-.59),(-.10,-.13),(-.19,-.14),(-.25,-.52),(-.36,-.49),(-.46,-.06)]
    controller_shape('n64-controller-shell',points,x,y,z,.169,.105,'grey')
    dpad(x-.047,y+.013,z+.020,.023)
    stick(x,y-.006,z+.025,.0095,'grey')
    disk('n64-start',x,y+.027,z+.022,.0035,.003,'red',verts=16)
    for xx,yy,mat in [(x+.027,y+.011,'blue'),(x+.019,y+.025,'green')]:disk('n64-A-B',xx,yy,z+.021,.005,.004,mat,verts=20)
    for dx,dy in [(0,.009),(0,-.009),(-.009,0),(.009,0)]:disk('n64-C',x+.055+dx,y+.019+dy,z+.021,.0035,.003,'yellow',verts=16)
    text('n64-controller-brand','Nintendo',x,y+.039,z+.020,.004,'ink',top=True)
    for xx in [x-.045,x+.045]:rb('n64-shoulder',xx-.024,xx+.024,y+.037,y+.045,z+.008,z+.018,'darkgrey',.005,.001)
    group_piece('n64-controller',before)

    before=set(bpy.data.objects)
    wire('gc-cable',[(-.431,-.089,.506),(-.46,-.16,.46),(-.44,-.235,.434),(-.41,-.21,.432),(-.345,-.138,.441)],.0017)
    wire('snes-cable',[(.230,-.072,.458),(.208,-.159,.435),(.28,-.218,.431),(.39,-.221,.433),(.455,-.150,.442)],.0015)
    wire('n64-cable',[(.147,-.080,.156),(.10,-.17,.138),(.19,-.24,.127),(.33,-.218,.126),(.43,-.137,.138)],.0017)
    wire('tv-power',[(-.135,.252,.86),(-.19,.276,.5),(-.24,.281,.1),(-.43,.263,.031),(-.68,.246,.025)],.003)
    wire('cube-AV',[(-.365,.117,.481),(-.41,.237,.43),(-.41,.27,.59),(-.11,.25,.73)],.002)
    group_piece('bedroom-cables',before)

def gamebox(name,x,y,z,w,h,d,tile,mat='black',face=True):
    rb(name,x-w/2,x+w/2,y-d/2,y+d/2,z,z+h,mat,.0025,.0007,axis=1)
    if face:front(name+'-cover',x,y-d/2-.0006,z+h/2,w-.002,h-.002,'covers',tile)
    return None

def build_games():
    before=set(bpy.data.objects)
    # The favourite gets the most legible place: front-facing, uncrowded, beside the GameCube.
    gamebox('melee-case',-.082,-.159,.429,.112,.159,.011,0)
    gamebox('wind-waker-case',.070,-.092,.429,.105,.153,.011,1)
    # Additional upright cases show the thickness, clear protective lips and printed spines.
    for i,title in enumerate(['MELEE','WIND WAKER','ZELDA','MARIO']):
        x=-.154+i*.012
        rb('gc-case-spine',x-.005,x+.005,-.090,.046,.429,.585,'black',.001,.0003)
        rb('spine-paper',x-.0038,x+.0038,-.0908,-.0901,.447,.570,'paper',.0003,.0001,axis=1)
        # Rotated print on the front narrow spine; screen/cases use original art, small spines plain type.
        o=text('gc-spine-title',title,0,0,0,.004,'ink',align='LEFT')
        from mathutils import Matrix
        for v in o.data.vertices:
            co=v.co.copy();v.co=(x+co.z-.001,-.091, .456+co.x)
        text('gc-spine-header','GC',x,-.091,.576,.0038,'white')
    # Flat cardboard boxes, broad upper cover and readable front edge.
    for i,(tile,title,colour) in enumerate([(5,'ZELDA • A LINK TO THE PAST','gold'),(3,"YOSHI'S ISLAND",'paper'),(2,'ZELDA • OCARINA OF TIME','gold')]):
        x,y,z=-.356,.025,.124+i*.038
        rb('retro-game-box',x-.129,x+.129,y-.094,y+.082,z,z+.035,colour,.002,.001)
        top_art('retro-game-box-top',x,y-.006,z+.0355,.253,.169,'covers',tile)
        front('retro-game-box-edge',x,y-.0947,z+.0175,.251,.033,'covers',tile)
        # Packaging edges: a folded end flap and a hairline along the front, not solid toy blocks.
        rb('box-end-flap',x+.128,x+.1295,y-.092,y+.08,z+.003,z+.033,colour,.001,.0002,axis=0)
    # Smash 64 stands facing the room on the lower shelf, alongside its inserted cartridge.
    gamebox('smash64-box',-.100,-.110,.124,.145,.119,.026,4,'paper')
    # Zelda cartridges in a short rack; every front label is actually textured.
    cartridge('ocarina-cartridge',.028,-.014,.124,.097,.069,.017,2,'gold')
    cartridge('link-past-cartridge',.012,.052,.124,.104,.060,.018,5)
    cartridge('yoshi-spare-cartridge',-.010,.101,.124,.102,.058,.018,3)
    rb('cartridge-rack',-.064,.079,-.034,.129,.122,.134,'darkgrey',.005,.001)
    # A couple of handheld boxes and a DS case lying in a neat stack on the far right back.
    for i,tile in enumerate([7,6]):
        rb('handheld-box',.350,.480,.046,.145,.124+i*.017,.140+i*.017,'black' if i==0 else 'paper',.002,.0005)
        top_art('handheld-box-art',.415,.0955,.1405+i*.017,.126,.095,'covers',tile)
    group_piece('bedroom-games',before)
