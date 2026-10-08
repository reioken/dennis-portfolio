"""Correct every non-GameCube Tripo piece: clean material regions, preserved detail, coherent surface normals.
No selected-to-active texture transfer: hardware uses physical PBR materials, printing is applied separately.
blender -b -P THIS_SCRIPT -- SOURCE_ROOT OUTPUT_DIR [IDs...]
"""
import bpy,bmesh,sys,os,math,json
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from hifi_paint import face_samples
from bedroom_tv_common import material,MAT,select_only
src,out=[os.path.abspath(p) for p in sys.argv[sys.argv.index('--')+1:][:2]]
only=set(sys.argv[sys.argv.index('--')+3:]);os.makedirs(out,exist_ok=True)
palette={'silver':(0xb8babd,.48,.08),'chrome':(0xb4b7bc,.31,.72),'graphite':(0x303137,.49,0),
 'black':(0x191a20,.5,0),'darkgrey':(0x70747a,.49,0),'grey':(0xbfc0bd,.47,0),
 'beige':(0xd1cfc4,.49,0),'white':(0xd9dad6,.47,0),'purple':(0x484477,.43,0),
 'red':(0xb93948,.4,0),'green':(0x319967,.43,0),'yellow':(0xdebc44,.43,0),
 'blue':(0x3c65a5,.43,0),'magenta':(0x923555,.44,0),'paper':(0xcac3b2,.72,0),'lcd':(0x87945c,.6,0)}
parts={'crt':42000,'snes':34000,'n64':34000,'gameboy':24000,'ds':34000,'stand':30000,
 'gamecube-controller':30000,'snes-controller':22000,'n64-controller':30000,
 'gamecube-stack':16000,'retro-games':22000,'melee-case':5000,'snes-cartridge':10000,'n64-cartridge':10000}
report=[]
keys=list(palette);idx={k:i for i,k in enumerate(keys)}
for name,target in parts.items():
 if only and name not in only:continue
 bpy.ops.wm.read_factory_settings(use_empty=True)
 for k,(c,r,m) in palette.items():MAT[k]=material('bedroom-clean-'+k,c,r,m)
 bpy.ops.import_scene.gltf(filepath=os.path.join(src,'textured',name+'.glb'),merge_vertices=True)
 o=[o for o in bpy.data.objects if o.type=='MESH'][0];select_only(o)
 bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM');bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 o.name=name;original=len(o.data.polygons)
 c,n,rgb=face_samples(o.data,os.path.join(src,'tex',name+'-median.png'))
 # Image.pixels from byte images already stores normalized source values. Undo the old helper's extra gamma.
 s=rgb/255;rgb=np.where(s<=.04045,s/12.92,((s+.055)/1.055)**2.4)*255
 x,y,z=c.T;mean=rgb.mean(1);chroma=rgb.max(1)-rgb.min(1)
 base={'crt':'silver','stand':'graphite','gameboy':'beige','ds':'silver','snes':'grey','n64':'graphite',
       'gamecube-controller':'purple','snes-controller':'grey','n64-controller':'grey',
       'gamecube-stack':'black','retro-games':'paper','melee-case':'black','snes-cartridge':'grey','n64-cartridge':'grey'}[name]
 classes=np.full(len(c),idx[base],np.int32)
 def zone(mask,key):classes[mask]=idx[key]
 def ellipse(cx,cz,rx,rz):return ((x-cx)/rx)**2+((z-cz)/rz)**2<1
 if name=='crt':
  zone((y<-.390)&(abs(x)<.381)&(z>.188)&(z<.690),'black')
 if name=='stand':
  # Posts between decks are metal; shelf tops/edges never inherit silver pixels from AI highlights.
  between=((z>.086)&(z<.305))|((z>.365)&(z<.602))
  zone((mean>100)&(abs(n[:,2])<.80)&(abs(x)>.295)&(z>.045),'chrome')
  zone(z<.038,'black')
 if name=='gameboy':
  zone((y<.08)&(z>.559)&(z<.875)&(abs(x)<.278)&(mean<195)&(chroma<45),'darkgrey')
  zone((z>.28)&(z<.46)&(x>.02)&(y<.04)&(rgb[:,0]>rgb[:,1]*1.4)&(chroma>45),'magenta')
  zone((y<.04)&(x<-.095)&(z>.26)&(z<.48)&(mean<105),'black')
  zone((y<.04)&(z>.13)&(z<.25)&(abs(x)<.18)&(mean<115),'darkgrey')
 if name=='ds':
  zone((y<-.100)&(abs(x)<.233)&(z>.260)&(z<.603),'black')
  # Silver DS keys stay silver; arbitrary world-coordinate cuts had painted stars onto its shell.
 if name=='snes':
  zone((z>.24)&(abs(x)<.37)&(y>-.04)&(y<.37)&(mean<115),'darkgrey')
  zone((y<-.452)&(mean<75)&(z>.09)&(z<.185),'black')
 if name=='n64':
  zone((z>.205)&(abs(x)<.255)&(y>.024)&(y<.130),'black')
  zone((y<-.332)&(mean<70)&(z>.07)&(z<.20),'black')
 if name=='gamecube-controller':
  front=(y<.12)&(z>.25)
  R,G,B=rgb.T
  zone(front&(chroma<40)&(mean>70)&(mean<220),'grey')
  zone(front&(x>.08)&(R>G*1.5)&(R>B*1.2)&(chroma>45),'red')
  zone(front&(x>.08)&(G>R*1.25)&(G>B*1.13)&(chroma>40),'green')
  zone(front&(x>.05)&(R>95)&(G>85)&(B<75)&(chroma>55),'yellow')
 if name=='snes-controller':
  front=y<.025;R,G,B=rgb.T
  zone(front&(mean<135)&(chroma<35)&(z>.095)&(z<.405),'darkgrey')
  zone(front&(x>.1)&(R>G*1.5)&(R>B*1.2)&(chroma>45),'red')
  zone(front&(x>.1)&(G>R*1.25)&(G>B*1.13)&(chroma>40),'green')
  zone(front&(x>.1)&(R>95)&(G>85)&(B<75)&(chroma>55),'yellow')
  zone(front&(x>.1)&(B>R*1.4)&(B>G*1.15)&(chroma>45),'blue')
 if name=='n64-controller':
  front=y<.16;R,G,B=rgb.T
  zone(front&(mean<95)&(chroma<30)&(z>.30),'darkgrey')
  zone(front&(abs(x)<.10)&(z>.52)&(R>G*1.5)&(R>B*1.2)&(chroma>45),'red')
  zone(front&(x>.1)&(G>R*1.25)&(G>B*1.13)&(chroma>40),'blue')
  zone(front&(x>.1)&(B>R*1.4)&(B>G*1.15)&(chroma>45),'green')
  zone(front&(x>.1)&(R>95)&(G>85)&(B<75)&(chroma>55),'yellow')
 if name=='retro-games':zone((y<-.05)&(z<.118),'grey')
 o.data.materials.clear()
 for k in keys:o.data.materials.append(MAT[k])
 for i,p in enumerate(o.data.polygons):p.material_index=int(classes[i])
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=1e-5)
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
 if o.data.has_custom_normals:bpy.ops.mesh.customdata_custom_splitnormals_clear()
 # Flatten broad generated laminate/insert faces geometrically, preserving bevels and curved silhouettes.
 if name in ['stand','melee-case','gamecube-stack','retro-games','snes-cartridge','n64-cartridge']:
  coords=np.array([v.co[:]for v in o.data.vertices]);vn=np.array([v.normal[:]for v in o.data.vertices])
  for axis in range(3):
   face=(abs(n[:,axis])>.97)
   values=c[face,axis]
   if len(values)<300:continue
   hist,edges=np.histogram(values,bins=np.arange(values.min()-.003,values.max()+.004,.0015))
   candidates=[]
   for j in np.argsort(hist)[::-1]:
    if hist[j]<max(120,len(values)*.02):break
    peak=(edges[j]+edges[j+1])/2
    if any(abs(peak-p)<.012 for p in candidates):continue
    local=values[abs(values-peak)<.003];candidates.append(float(np.median(local)))
   for peak in candidates:
    match=(abs(vn[:,axis])>.82)&(abs(coords[:,axis]-peak)<.006)
    for i in np.flatnonzero(match):o.data.vertices[int(i)].co[axis]=peak
  o.data.update()
 # Retain substantially more geometry at the controls and seams; avoid the old aggressive collapse/bake.
 smooth=o.modifiers.new('restrained shell relaxation','LAPLACIANSMOOTH');smooth.iterations=3 if 'controller' in name else 2
 smooth.lambda_factor=.20;smooth.lambda_border=0;smooth.use_volume_preserve=True;smooth.use_normalized=True
 bpy.ops.object.modifier_apply(modifier=smooth.name)
 dec=o.modifiers.new('preserve detail and material boundaries','DECIMATE');dec.ratio=min(1,target/len(o.data.polygons));dec.use_collapse_triangulate=True
 bpy.ops.object.modifier_apply(modifier=dec.name)
 if name=='snes-controller':
  # Establish one watertight continuous shell before the local lettering retopology.
  source_tree=BVHTree.FromPolygons([v.co for v in o.data.vertices],[p.vertices for p in o.data.polygons],all_triangles=False)
  source_materials=[p.material_index for p in o.data.polygons]
  remesh=o.modifiers.new('Continuous generated shell','REMESH');remesh.mode='VOXEL';remesh.voxel_size=.0035;remesh.use_smooth_shade=True
  bpy.ops.object.modifier_apply(modifier=remesh.name)
  for p in o.data.polygons:
   hit=source_tree.find_nearest(p.center)
   if hit and hit[2] is not None:p.material_index=source_materials[hit[2]]
  dec=o.modifiers.new('Retopology detail budget','DECIMATE');dec.ratio=min(1,45000/len(o.data.polygons));dec.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=dec.name)
 bpy.ops.object.shade_smooth_by_angle(angle=math.radians(58 if 'controller' in name else 70))
 # Coherent broad-face normals: generated printing and thousands of nearly planar triangles no longer shimmer.
 if name=='stand':
  normals=[n.vector.copy()for n in o.data.corner_normals]
  for p in o.data.polygons:
   normal=p.normal.copy();axis=max(range(3),key=lambda i:abs(normal[i]))
   flat=abs(normal[axis])>.94 or (name=='stand' and abs(normal.z)>.72)
   if flat:
    if name=='stand' and abs(normal.z)>.72:axis=2
    sign=math.copysign(1,normal[axis]);normal=Vector((0,0,0));normal[axis]=sign
    for li in p.loop_indices:normals[li]=normal
  o.data.normals_split_custom_set(normals)
 for layer in list(o.data.color_attributes):o.data.color_attributes.remove(layer)
 # No obsolete AI UV, paint texture, metal map or AO bake can leak into this corrected export.
 while o.data.uv_layers:o.data.uv_layers.remove(o.data.uv_layers[0])
 used={p.material_index for p in o.data.polygons};maps={old:new for new,old in enumerate(sorted(used))}
 mats=[o.data.materials[old]for old in sorted(used)];assigned=[maps[p.material_index]for p in o.data.polygons]
 o.data.materials.clear()
 for m in mats:o.data.materials.append(m)
 for p,mi in zip(o.data.polygons,assigned):p.material_index=mi
 o['source']='Tripo H3.1 '+name;o['correction']='clean direct PBR, semantic material zones, restrained smoothing, coherent normals, preserved details'
 select_only(o)
 o.data.validate(clean_customdata=False)
 bpy.ops.export_scene.gltf(filepath=os.path.join(out,name+'.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
 report.append({'id':name,'sourceTriangles':original,'correctedTriangles':len(o.data.polygons),'materials':[m.name for m in mats],'hardwareTextures':0})
 print('CORRECTED',json.dumps(report[-1]),flush=True)
report_path=os.path.join(out,'surface-correction.json')
if only and os.path.exists(report_path):
 with open(report_path)as f:previous=json.load(f)
 report=[r for r in previous if r['id'] not in only]+report
with open(report_path,'w')as f:json.dump(report,f,indent=2)
