"""Afterimage payphone: separate handset, keys, cord and machined housing."""
import os, sys, math
import bpy
from mathutils import Matrix
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import cabinet_gen as cg
bpy.ops.wm.read_factory_settings(use_empty=True)
cg.COLL=bpy.data.collections.new("payphone")
bpy.context.scene.collection.children.link(cg.COLL)
G={"body":[],"metal":[],"handset":[],"cord":[],"keys":[],"speaker":[]}
paint=cg.material("phone_paint",cg.hex_rgb("#151923"),rough=.52,metal=.35)
steel=cg.material("phone_brushed",cg.hex_rgb("#777E8A"),rough=.34,metal=.85)
rubber=cg.material("phone_rubber",cg.hex_rgb("#090B10"),rough=.48)
dark=cg.material("phone_recess",cg.hex_rgb("#040509"),rough=.85)
ice=cg.material("phone_letters",cg.hex_rgb("#C8DAF4"),rough=.4)
F=Matrix.Translation((0,-.18,.85)) @ Matrix.Rotation(math.pi/2,4,'X')
def box(group,name,w,h,d,x,y,z,mat,bevel=.003):
 o=cg.box(name,w,h,d,mat,cg.at(F,x,y,z),bevel=bevel,seg=4);G[group].append(o);return o
def label(text,x,y,z,size=.024):
 curve=bpy.data.curves.new("engraving","FONT");curve.body=text;curve.size=size;curve.align_x='CENTER';curve.align_y='CENTER';curve.extrude=.0002
 ob=bpy.data.objects.new("engraving",curve);cg.COLL.objects.link(ob);ob.matrix_world=cg.at(F,x,y,z);curve.materials.append(ice)
 bpy.context.view_layer.objects.active=ob;ob.select_set(True);bpy.ops.object.convert(target='MESH');ob.select_set(False);G["keys"].append(ob)
box("body","housing",.60,1.70,.30,0,0,-.15,paint,.028)
box("metal","faceplate",.52,1.53,.012,0,0,.008,steel,.012)
box("body","face_inset",.49,1.50,.012,0,0,.016,paint,.012)
box("body","header",.46,.13,.02,0,.66,.032,rubber,.008)
label("CONTACT",0,.66,.045,.044)
box("metal","keypad_frame",.22,.30,.014,.105,.24,.04,steel,.01)
box("body","keypad_gasket",.20,.28,.015,.105,.24,.05,dark,.009)
for row in range(4):
 for col in range(3):
  x=.105+(col-1)*.060;y=.24+(1.5-row)*.060
  key=f"key_{row*3+col}"
  box("keys",key,.048,.047,.016,x,y,.063,steel,.008)
  label("123456789*0#"[row*3+col],x,y,.073,.022)
box("metal","coin_plate",.205,.13,.015,.105,.465,.04,steel,.007)
box("body","coin_slot",.006,.071,.004,.115,.465,.05,dark,.001)
box("metal","return_rim",.18,.12,.03,.105,-.32,.04,steel,.006)
box("body","return_recess",.145,.084,.004,.105,-.32,.058,dark,.003)
box("metal","return_lip",.15,.009,.022,.105,-.36,.072,steel,.002)
box("body","cradle",.15,.41,.07,-.155,.20,.06,rubber,.028)
# Ergonomic curved handset with continuous rounded handle and earpieces.
points=[(-.16,-.33,1.33),(-.19,-.39,1.26),(-.205,-.40,1.15),(-.19,-.39,1.03),(-.16,-.33,.96)]
G["handset"].append(cg.tube_along("handset_handle",points,.034,rubber,resolution=4))
for z in (.96,1.33):
 G["handset"].append(cg.sphere("handset_earpiece",.061,rubber,Matrix.Translation((-.16,-.33,z)),segs=40,rings=24))
# Steel-reinforced spiral cord, geometry rather than a painted line.
pts=[]
for i in range(241):
 t=i/240
 pts.append((-.17+.020*math.cos(t*math.pi*48),-.32+.020*math.sin(t*math.pi*48),.91-t*.62))
pts += [(-.17,-.32,.28),(-.11,-.26,.25),(-.07,-.22,.3)]
G["cord"].append(cg.tube_along("coiled_cord",pts,.0045,steel,resolution=2))
box("body","speaker_plate",.205,.14,.016,.105,-.01,.04,rubber,.006)
for row in range(4):
 for col in range(8):
  G["speaker"].append(cg.disc("speaker_port",.004,dark,cg.at(F,.025+col*.023,.035-row*.023,.05),segs=12))
for x in (-.23,.23):
 for y in (-.71,.54,.73):
  G["metal"].append(cg.cylinder("housing_screw",.005,.003,steel,cg.at(F,x,y,.03),segs=32,bevel=.0007,bevel_seg=3))
  box("body","screw_slot",.006,.001,.001,x,y,.032,dark,.0002)
G["cord"].append(cg.cylinder("cord_strain_relief",.013,.034,rubber,Matrix.Translation((-.07,-.214,.30)) @ Matrix.Rotation(math.pi/2,4,"X"),segs=32,bevel=.003,bevel_seg=3))
art=cg.material("phone_art",cg.grey(.05),rough=.48,base_tex=cg.tiny_tex("phone_art_tex",(.05,.05,.05)))
G["front_art"]=[cg.quad("front_art",.43,.61,art,cg.at(F,0,-.39,.023))]
objs=cg.finish(G,cg.side_surface_art(G["body"][:1],art),wear=False)
out=os.path.abspath(".source-assets/models-afterimage/payphone")
os.makedirs(out,exist_ok=True)
cg.export_glb(objs,os.path.join(out,"payphone.glb"))
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out,"payphone.blend"))
print("Payphone:",sum(cg.tri_count(o) for o in objs),"triangles")

