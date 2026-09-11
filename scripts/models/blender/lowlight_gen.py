"""Lowlight listening console: full side artwork, speakers, named physical controls."""
import sys, math, json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import bpy
from mathutils import Matrix
import cabinet_gen as cg
import machine_gen as mg

root=Path(__file__).resolve().parents[3]
out=root/'.source-assets/models-in/mach-lowlight'
out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
cg.COLL=bpy.data.collections.new('Lowlight console')
bpy.context.scene.collection.children.link(cg.COLL)
spec=mg.Spec(dict(name='mach-lowlight',title='Lowlight',variant='jukebox',height=1.65,width=1.02,depth=.60,
 brand='#d8c3a5',brand2='#b9a8ce',paint='#15131b',panel='#121219',tmolding='#b3a08c',accent='#d8c3a5',wear=.10))
M=mg.make_materials(spec,None)
M['paint']=cg.material('lowlight_anodized_shell',cg.hex_rgb('#15131b'),rough=.58,metal=.12,coat=.12)
M['panel']=cg.material('lowlight_satin_baffle',cg.hex_rgb('#121219'),rough=.72)
M['deck']=cg.material('lowlight_control_surface',cg.hex_rgb('#17151d'),rough=.54,metal=.1,coat=.08)
M['chrome']=cg.material('lowlight_brushed_champagne',cg.hex_rgb('#a69583'),rough=.38,metal=.8)
M['cone']=cg.material('lowlight_speaker_fibre',cg.hex_rgb('#1c1a22'),rough=.84)
M['rubber']=cg.material('lowlight_rubber_surround',cg.hex_rgb('#09090c'),rough=.8)
M['seam']=cg.material('lowlight_led_lilac',cg.hex_rgb('#b9a8ce'),rough=.5,emit=cg.hex_rgb('#b9a8ce'),emit_strength=.45)
parts=mg.new_parts();pivots={}
W=spec.W
# Continuous side shells frame a modestly reclined display and a tactile control ledge.
profile=[(-.255,0),(-.255,.10),(-.285,.13),(-.285,.77),(-.335,.81),(-.335,.855),(-.205,.89),(-.115,1.46),(-.13,1.65),(.23,1.65),(.285,1.59),(.285,.04),(.25,0)]
mg.shell_and_sides(parts,M,profile,W,t=.022,inset=.014,bevel_side=.009,bevel_shell=.014,tm_r=.004)
front,_=cg.seg_frame((-.288,.10),(-.288,.77))
parts['body'].append(cg.box('speaker_baffle',.90,.58,.016,M['panel'],cg.at(front,0,.335,.012),bevel=.017,seg=4))
for x in [-.235,.235]:
    for name,r,z,mat in [('woofer_mount',.185,.024,M['chrome']),('woofer_recess',.174,.031,M['rubber']),('woofer_cone',.151,.036,M['cone']),('woofer_dustcap',.067,.047,M['rubber'])]:
        parts['speaker'].append(cg.cylinder(name,r,.009,mat,cg.at(front,x,.28,z),segs=64,bevel=.003,bevel_seg=3))
    for k in range(3):
        # Thin acoustic ribs, sufficiently broad to avoid subpixel sparkle.
        parts['speaker'].append(cg.box('acoustic_rib',.29,.009,.008,M['rubber'],cg.at(front,x,.21+k*.073,.055),bevel=.003,seg=3))
    parts['speaker'].append(cg.cylinder('tweeter_rim',.038,.009,M['chrome'],cg.at(front,x,.525,.026),segs=40,bevel=.003,bevel_seg=3))
    parts['speaker'].append(cg.cylinder('tweeter',.030,.012,M['rubber'],cg.at(front,x,.525,.031),segs=40,bevel=.005,bevel_seg=3))

deck,dl=cg.seg_frame((-.335,.855),(-.205,.89))
parts['controls'].append(cg.box('selector_plate',.89,dl+.03,.018,M['deck'],cg.at(deck,0,dl/2,.009),bevel=.009,seg=4))
for name,x,r in [('tbtn_0',-.28,.028),('start_0',0,.045),('tbtn_1',.28,.028)]:
    cap=cg.control_group(parts,pivots,name,deck,x,dl*.52,.021)
    cap.append(cg.cylinder(name+'_ring',r+.008,.008,M['ring'],cg.at(deck,x,dl*.52,.025),segs=48,bevel=.002,bevel_seg=2))
    cap.append(cg.cylinder(name+'_cap',r,.017,M['accent'] if name=='start_0' else M['ivory'],cg.at(deck,x,dl*.52,.035),segs=48,bevel=.005,bevel_seg=3))
# Six selectors sit on the front lip; they select the six marketing images directly.
lip,_=cg.seg_frame((-.338,.777),(-.338,.845))
for i in range(6):
    x=(i-2.5)*.103
    cap=cg.control_group(parts,pivots,'sel_'+str(i),lip,x,.028,.010)
    cap.append(cg.cylinder('selector_ring',.019,.006,M['ring'],cg.at(lip,x,.028,.013),segs=32))
    cap.append(cg.cylinder('selector_cap',.014,.010,M['ivory'],cg.at(lip,x,.028,.019),segs=32,bevel=.003,bevel_seg=3))

screen_frame,sl=cg.seg_frame((-.205,.89),(-.115,1.46))
screen,glass=mg.display_unit(parts,M,screen_frame,sl/2,.82,.5125,.885,.561,corner=.018)
title_frame,tl=cg.seg_frame((-.115,1.46),(-.13,1.65))
marquee=mg.marquee_unit(parts,M,title_frame,tl*.48,.80,.104)
# Small light accents reflect the brand without filling the room with white bloom.
for x in [-.455,.455]:
    parts['trim'].append(cg.box('edge_light',.008,.43,.006,M['seam'],cg.at(screen_frame,x,sl/2,.007),bevel=.002,seg=2))
parts['metal'].append(cg.box('plinth_champagne',.94,.05,.009,M['chrome'],cg.at(front,0,-.053,.004),bevel=.005,seg=3))
arts=cg.side_surface_art(parts['body'][:2],M['art'])
objects=cg.finish(parts,[screen,glass,marquee,*arts],wear=False,pivots=pivots)
cg.export_glb(objects,str(out/'mach-lowlight.glb'))
bpy.ops.wm.save_as_mainfile(filepath=str(out/'mach-lowlight.blend'))
(out/'spec.json').write_text(json.dumps({'name':'mach-lowlight','variant':'listening-console','height':1.65,'width':1.02,'depth':.62,'controls':list(pivots),'triangles':sum(cg.tri_count(o) for o in objects)},indent=2))
print('LOWLIGHT_COMPLETE',flush=True)
