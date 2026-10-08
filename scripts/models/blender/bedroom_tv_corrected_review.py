"""Render each of the 15 corrected pieces, including the final printing, from the assembled Blender source."""
import bpy,os,sys,json,hashlib
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:];src,out=[os.path.abspath(p)for p in args[:2]];only=set(args[2:]);os.makedirs(out,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=src)
with open(src,'rb')as f:blendhash=hashlib.sha256(f.read()).hexdigest()
scene=bpy.context.scene;scene.cycles.samples=64;scene.render.resolution_x=1200;scene.render.resolution_y=1200
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
for d in prefs.devices:d.use=d.type!='CPU'
scene.cycles.device='GPU'
meshes=[o for o in bpy.data.objects if o.type=='MESH'];cam=scene.camera
groups={
 'stand':lambda n:n=='tv-stand',
 'crt':lambda n:n=='bedroom-crt' or n.startswith('crt-'),
 'gamecube':lambda n:n=='nintendo-gamecube',
 'snes':lambda n:n=='nintendo-snes' or n.startswith('snes-clean-print') or n.startswith('snes-port-'),
 'n64':lambda n:n=='nintendo-64' or n.startswith(('n64-clean-print','n64-port-','n64-top-','n64-expansion-','n64-side-vent','n64-cartridge-well')),
 'gameboy':lambda n:n=='nintendo-gameboy' or n.startswith('gameboy-'),
 'ds':lambda n:n=='nintendo-ds' or n.startswith('ds-'),
 'gamecube-controller':lambda n:n.startswith('gamecube-controller'),
 'snes-controller':lambda n:n.startswith('snes-controller'),
 'n64-controller':lambda n:n.startswith('n64-controller'),
 'gamecube-stack':lambda n:n=='bedroom-gamecube-stack' or (n.startswith('gamecube-spine-') and not '.' in n) or n=='top-game-cover',
 'retro-games':lambda n:n=='bedroom-retro-games' or n.startswith('retro-'),
 'melee-case':lambda n:n in ['bedroom-melee-case','melee-original-cover'],
 'snes-cartridge':lambda n:n.startswith('bedroom-yoshi-cartridge'),
 'n64-cartridge':lambda n:n.startswith('bedroom-smash64-cartridge'),
}
rows=[]
for name,predicate in groups.items():
 if only and name not in only:continue
 selected=[o for o in meshes if predicate(o.name)]
 if not selected:raise RuntimeError('Missing review piece '+name)
 for o in meshes:o.hide_render=o not in selected
 bb=[o.matrix_world@Vector(c) for o in selected for c in o.bound_box]
 lo=Vector([min(p[i]for p in bb)for i in range(3)]);hi=Vector([max(p[i]for p in bb)for i in range(3)]);centre=(lo+hi)/2
 direction=Vector((.70,-2.5,1.3 if name in ['crt','gamecube','melee-case','snes-cartridge','n64-cartridge','stand']else 3.0))
 cam.location=centre+direction;cam.rotation_euler=(centre-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=max(hi-lo)*1.22
 scene.render.filepath=os.path.join(out,name+'.png');bpy.ops.render.render(write_still=True)
 rows.append({'id':name,'sourceBlendSha256':blendhash,'objects':[o.name for o in selected],'triangles':sum(len(o.data.polygons)for o in selected)})
with open(os.path.join(out,'review.json'),'w')as f:json.dump(rows,f,indent=2)
