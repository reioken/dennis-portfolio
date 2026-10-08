"""Polish actual Tripo geometry, retaining the generated hardware and shelf silhouettes.
blender -b -P scripts/models/blender/bedroom_tv_tripo_polish.py -- SOURCE_ROOT OUTPUT_DIR
Material regions come from the verified 4K maps; clean plastic/metal replaces their baked illumination.
Original GLBs and texture maps remain untouched. Output pieces retain canonical Tripo units for assembly.
"""
import bpy, bmesh, sys, os, math, json
import numpy as np
from mathutils import Vector
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from hifi_paint import face_samples,paint,bake_clean
from bedroom_tv_common import material, MAT, select_only

argv=sys.argv[sys.argv.index('--')+1:]
SRC,DST=[os.path.abspath(x) for x in argv[:2]]
ONLY=set(argv[2:])
os.makedirs(DST,exist_ok=True)
PALETTE={
 'silver':(0xbec2c8,.49,.08), 'chrome':(0xc7ccd2,.28,.82), 'graphite':(0x34353a,.49,.02),
 'black':(0x1b1d24,.5,0), 'darkgrey':(0x626774,.48,.04), 'grey':(0xa6aab3,.45,0),
 'white':(0xdedfd9,.42,0), 'purple':(0x4e458f,.38,.02), 'purple-dark':(0x2e2858,.42,0),
 'red':(0xb33647,.35,0), 'green':(0x389d83,.35,0), 'yellow':(0xe5ba4d,.38,0),
 'blue':(0x426eae,.37,0), 'magenta':(0x853e61,.4,0), 'gold':(0xb8a575,.42,.17),
 'paper':(0xd0c8b8,.69,0), 'lcd':(0x89965d,.62,0),
}
PARTS={
 'crt':(22000,['silver','black','darkgrey','white']),
 'gamecube':(14000,['purple','purple-dark','black','silver','white']),
 'snes':(15000,['grey','darkgrey','black','white','red','yellow','blue','green']),
 'n64':(14000,['graphite','black','darkgrey','white','red']),
 'gameboy':(11000,['white','darkgrey','black','magenta','lcd','blue']),
 'ds':(15000,['silver','grey','darkgrey','black','white','green']),
 'stand':(14000,['graphite','chrome','black']),
 'gamecube-controller':(11000,['purple','purple-dark','grey','white','black','green','red','yellow']),
 'snes-controller':(10000,['grey','darkgrey','black','white','red','yellow','blue','green']),
 'n64-controller':(12000,['grey','darkgrey','white','black','red','green','blue','yellow']),
 'gamecube-stack':(9000,['black','white','paper']),
 'retro-games':(11000,['grey','black','paper','gold']),
 'melee-case':(3000,['black','white','paper']),
 'snes-cartridge':(4500,['grey','darkgrey','black','white']),
 'n64-cartridge':(4500,['grey','darkgrey','black','white']),
}
REPORT=[]
for name,(target,keys) in PARTS.items():
    if ONLY and name not in ONLY:continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for key,(colour,rough,metal) in PALETTE.items(): MAT[key]=material('bedroom-'+key,colour,rough,metal)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC,'textured',name+'.glb'),merge_vertices=True)
    objects=[o for o in bpy.data.objects if o.type=='MESH']
    if len(objects)!=1:raise RuntimeError(name+': expected one source mesh')
    o=objects[0];select_only(o)
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    o.name=name
    original=len(o.data.polygons)
    centre,normal,rgb=face_samples(o.data,os.path.join(SRC,'tex',name+'-median.png'))
    # Classify colours rather than carry AI's highlights and grey stains onto the plastic.
    colours=np.array([[(PALETTE[k][0]>>s)&255 for s in (16,8,0)] for k in keys],np.float32)
    # Chroma keeps coloured keys distinct even where the source is shaded.
    rgbn=rgb/np.maximum(rgb.mean(1)[:,None],35)
    cn=colours/np.maximum(colours.mean(1)[:,None],35)
    distance=((rgb[:,None,:]-colours[None,:,:])**2).mean(2)+((rgbn[:,None,:]-cn[None,:,:])**2).mean(2)*9000
    cls=distance.argmin(1)
    height=centre[:,2].max();z=centre[:,2]/height
    if name=='stand':
        # Generated shelf laminates are horizontal; cylindrical posts retain a satin metal finish.
        cls[:]=keys.index('graphite')
        cls[rgb.mean(1)>135]=keys.index('chrome')
        cls[z<.035]=keys.index('black')
        shelf=(np.abs(normal[:,2])>.5)
        cls[shelf & (z>.06)]=keys.index('graphite')
    if name=='crt':
        # All light areas form one silver moulding, avoiding triangular patches on the bezel.
        cls[:]=keys.index('silver')
        screen=(centre[:,1]<-.395)&(np.abs(centre[:,0])<.380)&(centre[:,2]>.190)&(centre[:,2]<.688)
        cls[screen]=keys.index('black')
        vents=(rgb.mean(1)<100)&(centre[:,1]>-.32)
        cls[vents]=keys.index('darkgrey')
    if name=='gamecube':
        dark=(rgb.mean(1)<105)&((centre[:,1]<-.450)|(np.abs(centre[:,0])>.41))
        cls[:]=keys.index('purple')
        plate=(centre[:,1]<-.455)&(np.abs(centre[:,0])<.395)&(centre[:,2]>.105)&(centre[:,2]<.454)
        disc=(centre[:,0]**2+(centre[:,1]-.02)**2<.278**2)&(centre[:,2]>.541)
        cls[plate|disc]=keys.index('silver')
        cls[dark]=keys.index('black')
    if name=='gamecube-controller':
        # Pale highlights on indigo plastic are still indigo, not white paint flecks.
        coloured=np.isin(cls,[keys.index(k)for k in ['green','red','yellow']])
        saved=cls.copy();cls[:]=keys.index('purple');cls[coloured]=saved[coloured]
        x,zz=centre[:,0],centre[:,2]
        for cx,cz,rx,rz,key in [(-.265,.585,.096,.10,'grey'),(-.135,.305,.062,.067,'black'),
                              (.26,.642,.085,.04,'white'),(.387,.546,.034,.062,'white'),
                              (0,.516,.030,.033,'grey')]:
            region=((x-cx)/rx)**2+((zz-cz)/rz)**2<1
            cls[region & (centre[:,1]<-.065)]=keys.index(key)
        cls[(zz>.721)&(np.abs(x)>.20)]=keys.index('white')
    if name=='ds':
        cls[rgb.mean(1)>145]=keys.index('silver')
        cls[(np.abs(centre[:,0])<.233)&(centre[:,2]>.273)&(centre[:,2]<.589)]=keys.index('black')
    if name=='n64':cls[rgb.mean(1)>75]=keys.index('graphite')
    if name in ['melee-case','gamecube-stack']:
        cls[:]=keys.index('black')
        # Artwork and spines are applied to the cleaned generated cases in the assembly stage.
    if name in ['snes-cartridge','n64-cartridge']:cls[:]=keys.index('grey')
    # Large repaired front panels are retopologized in the assembly stage; keep source curvature here.
    paint(o.data,cls,[(*PALETTE[key],key) for key in keys])
    # Weld split UV patches before any smoothing or reduction, then recompute the actual surface normals.
    bm=bmesh.new();bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=1e-5)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(o.data);bm.free()
    if o.data.has_custom_normals:bpy.ops.mesh.customdata_custom_splitnormals_clear()
    hi=o.copy();hi.data=o.data.copy();bpy.context.collection.objects.link(hi);hi.name=name+'-high'
    smooth=o.modifiers.new('volume-preserving surface polish','LAPLACIANSMOOTH')
    smooth.iterations=3 if 'controller' in name else 2
    smooth.lambda_factor=.32;smooth.lambda_border=0;smooth.use_volume_preserve=True;smooth.use_normalized=True
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    dec=o.modifiers.new('web topology','DECIMATE');dec.ratio=target/len(o.data.polygons);dec.use_collapse_triangulate=True
    bpy.ops.object.modifier_apply(modifier=dec.name)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(55))
    # Tiny detached fragments from generation should not survive as floating bright dots.
    bm=bmesh.new();bm.from_mesh(o.data)
    loose=[v for v in bm.verts if not v.link_faces]
    if loose:bmesh.ops.delete(bm,geom=loose,context='VERTS')
    bm.to_mesh(o.data);bm.free()
    tri=o.modifiers.new('triangles','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=tri.name)
    prefs=bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type='OPTIX';prefs.get_devices()
    for device in prefs.devices:device.use=device.type!='CPU'
    # Transfer fine material boundaries from the full mesh, avoiding coloured low-poly triangles.
    bake_clean([o],hi,'bedroom-'+name,2048 if name in ['crt','gamecube','snes','ds','gameboy'] else 1024,
               ao_strength=.15,cage=.008,device='GPU',ao_samples=16)
    o.data.materials[0].name='bedroom-source-'+name
    bpy.data.objects.remove(hi,do_unlink=True)
    for layer in list(o.data.color_attributes):o.data.color_attributes.remove(layer)
    o['source']='Tripo H3.1 / '+name;o['polish']='weld, volume-preserving smooth, clean PBR, normals, topology reduction'
    bpy.ops.export_scene.gltf(filepath=os.path.join(DST,name+'.glb'),export_format='GLB',export_yup=True,export_apply=True,use_selection=True)
    bb=[o.matrix_world@Vector(c) for c in o.bound_box]
    row={'id':name,'sourceTriangles':original,'polishedTriangles':len(o.data.polygons),
         'min':[min(p[i] for p in bb) for i in range(3)],'max':[max(p[i] for p in bb) for i in range(3)],
         'materials':{keys[i]:int(np.sum(cls==i)) for i in range(len(keys))}}
    REPORT.append(row);print('POLISH',json.dumps(row),flush=True)
report_path=os.path.join(DST,'polish.json')
if ONLY and os.path.exists(report_path):
    with open(report_path)as f:prior=json.load(f)
    REPORT=[r for r in prior if r['id'] not in ONLY]+REPORT
with open(report_path,'w')as f:json.dump(REPORT,f,indent=2)
