"""VGM Battle versus cabinet: a wide two-player upright. Challenger A (violet) on the left,
challenger B (cyan) on the right, one amber call button between them, woofers in the base."""
import sys, math, json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import bpy
import cabinet_gen as cg
import machine_gen as mg

root=Path(__file__).resolve().parents[3]
out=root/'.source-assets/models-in/cab-vgm-battle'
out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
cg.COLL=bpy.data.collections.new('VGM Battle cabinet')
bpy.context.scene.collection.children.link(cg.COLL)
VIOLET,CYAN,AMBER='#7c4dff','#22d3ee','#fbbf24'
H,W,D=1.92,1.06,.82
spec=mg.Spec(dict(name='cab-vgm-battle',title='VGM Battle',variant='terminal',height=H,width=W,depth=D,
 brand=VIOLET,brand2=CYAN,paint='#100e18',panel='#0f0e17',tmolding=VIOLET,accent=AMBER,wear=.14))
M=mg.make_materials(spec,None)
M['paint']=cg.material('vgm_shell',cg.hex_rgb('#100e18'),rough=.5,coat=.22)
M['panel']=cg.material('vgm_baffle',cg.hex_rgb('#0f0e17'),rough=.7)
M['cone']=cg.material('vgm_speaker_fibre',cg.hex_rgb('#1b1926'),rough=.84)
M['rubber']=cg.material('vgm_rubber',cg.hex_rgb('#09080d'),rough=.8)
lit=lambda n,c,e=.5:cg.material(n,cg.hex_rgb(c),rough=.28,emit=cg.hex_rgb(c),emit_strength=e)
M['a']=lit('vgm_violet_lit',VIOLET);M['b']=lit('vgm_cyan_lit',CYAN);M['call']=lit('vgm_amber_lit',AMBER,.6)
M['ball_a']=cg.material('vgm_ball_violet',cg.hex_rgb(VIOLET),rough=.22,coat=.45)
M['ball_b']=cg.material('vgm_ball_cyan',cg.hex_rgb(CYAN),rough=.22,coat=.45)
M['seam_b']=cg.material('vgm_seam_cyan',cg.hex_rgb(CYAN),rough=.3,emit=cg.hex_rgb(CYAN),emit_strength=1.1)
parts=mg.new_parts();pivots={}

# Upright silhouette (y, z), clockwise from the bottom-front: recessed base, deep control deck,
# reclined screen, overhanging speaker brow and a forward-leaning marquee.
yf=-D/2;a=math.radians(20)
A=(yf+.10,0);B=(yf+.10,.80);C=(yf,.80);Dp=(yf,.92)
E=(yf+.30*math.cos(a),.92+.30*math.sin(a))
F=(E[0]+(1.575-E[1])*math.tan(math.radians(8)),1.575)
G=(yf+.05,1.71);Hm=(G[0]-(H-G[1])*math.tan(math.radians(6)),H)
J=(D/2-.07,H);K=(D/2,H-.2);L=(D/2,0)
outer=[A,B,C,Dp,E,F,G,Hm,J,K,L]
t,inset=.022,.014;iw=W-2*t
inner=mg.shell_and_sides(parts,M,outer,W,t=t,inset=inset,bevel_side=.006,bevel_shell=.012,tm_r=.0075)
P=dict(zip('ABCDEFGHJKL',inner))

# Base: the music lives here. One baffle (front_art slot) with a woofer per challenger.
lf,ll=cg.seg_frame(P['A'],P['B'])
parts['body'].append(cg.box('lower_panel',iw-.04,ll-.16,.012,M['panel'],cg.at(lf,0,ll/2+.05,.006),bevel=.008,seg=3))
for sx,ring in ((-1,M['a']),(1,M['b'])):
    x=sx*.255
    for name,r,z,mat in (('woofer_glow',.176,.016,ring),('woofer_mount',.168,.020,M['dark_metal']),('woofer_surround',.150,.025,M['rubber']),('woofer_cone',.128,.029,M['cone']),('woofer_cap',.052,.038,M['rubber'])):
        parts['speaker'].append(cg.cylinder(name,r,.008,mat,cg.at(lf,x,.47,z),segs=56,bevel=.003,bevel_seg=3))
parts['metal'].append(cg.box('kick',iw-.02,.11,.008,M['kick'],cg.at(lf,0,.065,.004),bevel=.003,seg=2))

# Deck lip: a split light seam, violet under A and cyan under B.
lipf,lipl=cg.seg_frame(P['C'],P['D'])
parts['metal'].append(cg.box('lip_band',iw-.02,lipl-.004,.004,M['dark_metal'],cg.at(lipf,0,lipl/2,.002)))
for sx,mat in ((-1,M['seam']),(1,M['seam_b'])):
    parts['controls'].append(cg.box('seam',iw/2-.05,.007,.005,mat,cg.at(lipf,sx*(iw/4),lipl/2,.0065)))

# Control deck: mirrored stick + three buttons per side, the call button in the middle.
cp,cl=cg.seg_frame(P['D'],P['E'])
pt=.03;top=pt+.002
parts['controls'].append(cg.box('cp_plate',iw-.02,cl+.02,pt,M['deck'],cg.at(cp,0,cl/2-.004,pt/2+.002),bevel=.007,seg=3))
parts['metal'].append(cg.box('cp_lip',iw-.016,.012,.006,M['dark_metal'],cg.at(cp,0,-.008,top-.012),bevel=.0015,seg=1))
def stick(group,x,ball):
    y=cl*.52
    group.append(cg.cylinder('joy_washer',.036,.003,M['ring'],cg.at(cp,x,y,top+.0015),segs=24))
    group.append(cg.cylinder('joy_shaft',.007,.078,M['metal'],cg.at(cp,x,y,top+.039),segs=12))
    group.append(cg.sphere('joy_ball',.0215,ball,cg.at(cp,x,y,top+.092),segs=24,rings=12))
stick(cg.control_group(parts,pivots,'joy',cp,-.40,cl*.52,top),-.40,M['ball_a'])
stick(parts['controls'],.40,M['ball_b'])  # challenger B's stick is scenery; the hall drives one `joy`
for k in range(6):
    side=-1 if k<3 else 1;c=k%3
    x=side*(.30-c*.062) if side<0 else .176+c*.062
    y=cl*(.60,.68,.60)[c]
    btn=cg.control_group(parts,pivots,f'btn_{k}',cp,x,y,top)
    btn.append(cg.cylinder(f'btn_ring_{k}',.021,.006,M['ring'],cg.at(cp,x,y,top+.003),segs=24))
    btn.append(cg.cylinder(f'btn_cap_{k}',.0165,.010,M['a'] if side<0 else M['b'],cg.at(cp,x,y,top+.008),segs=24,bevel=.0045,bevel_seg=2))
call=cg.control_group(parts,pivots,'start_0',cp,0,cl*.50,top)
call.append(cg.cylinder('start_ring_0',.046,.008,M['ring'],cg.at(cp,0,cl*.50,top+.004),segs=6))  # hexagonal socket, the product's VS badge
call.append(cg.cylinder('start_cap_0',.030,.014,M['call'],cg.at(cp,0,cl*.50,top+.011),segs=40,bevel=.006,bevel_seg=3))

# Screen: 16:10, the two players sit side by side on it.
bz,bl=cg.seg_frame(P['E'],P['F'])
sw=iw-.13;sh=sw/1.6
if sh>bl-.07: sh=bl-.07;sw=sh*1.6
screen,glass=mg.display_unit(parts,M,bz,bl/2,sw,sh,iw-.03,bl-.03,corner=.016)
for sx,mat in ((-1,M['seam']),(1,M['seam_b'])):
    parts['trim'].append(cg.box('edge_light',.007,sh*.86,.006,mat,cg.at(bz,sx*(sw/2+.030),bl/2,.0125),bevel=.002,seg=2))

# Brow: grilles under the marquee.
sp,sl=cg.seg_frame(P['F'],P['G'])
for sx in (-1,1):
    mg.grille_unit(parts,M,sp,sx*(iw/2-.17),sl/2,.22,min(.085,sl-.04),cols=8,rows=3,tag=f'_{sx}')

mq,ml=cg.seg_frame(P['G'],P['H'])
marquee=mg.marquee_unit(parts,M,mq,ml/2,iw-.08,ml-.055)

arts=cg.side_surface_art(parts['body'][:2],M['art'])
objects=cg.finish(parts,[screen,glass,marquee,*arts],wear=False,pivots=pivots)
cg.export_glb(objects,str(out/'cab-vgm-battle.glb'))
bpy.ops.wm.save_as_mainfile(filepath=str(out/'cab-vgm-battle.blend'))
(out/'spec.json').write_text(json.dumps({'name':'cab-vgm-battle','variant':'versus-upright','height':H,'width':W,'depth':D,'controls':list(pivots),'triangles':sum(cg.tri_count(o) for o in objects)},indent=2))
print('VGM_BATTLE_COMPLETE',flush=True)
