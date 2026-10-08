"""Render the saved assembled source without rebuilding or modifying it."""
import bpy,sys,os
from mathutils import Vector
source,out=sys.argv[sys.argv.index('--')+1:];bpy.ops.wm.open_mainfile(filepath=os.path.abspath(source));os.makedirs(out,exist_ok=True)
scene=bpy.context.scene;cam=scene.camera;scene.render.resolution_x=1600;scene.render.resolution_y=1600;scene.cycles.samples=96
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
for d in prefs.devices:d.use=d.type!='CPU'
scene.cycles.device='GPU'
for name,loc,target,scale in [('assembly',(1.2,-3.8,1.65),(0,0,.62),1.47),('front',(0,-4,1.24),(0,0,.61),1.44),('games',(.65,-2,1.2),(-.03,0,.42),.89)]:
 cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=scale
 scene.render.filepath=os.path.abspath(os.path.join(out,name+'.png'));bpy.ops.render.render(write_still=True)
