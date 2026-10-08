// Derive the corrected assembly from the preserved v2 placement/art pipeline; v2 source remains reproducible.
import {readFile,writeFile} from 'node:fs/promises';
const file='scripts/models/blender/bedroom_tv_tripo_assemble.py';
let code=await readFile(file,'utf8');
code=code.replace('All shelf/hardware/controller/case geometry is imported from the recorded Tripo jobs.','All fifteen bodies originate in recorded Tripo jobs; damaged shells and controls receive local Blender retopology.');
code=code.replace('import bpy,bmesh,sys,os,math,json','import bpy,bmesh,sys,os,math,json,re\nimport numpy as np');
code=code.replace("os.path.join(SRC,'polished',name+'.glb')","os.path.join(SRC,'corrected',name+'.glb')");
code=code.replace("    o.name=outname\n",()=>`    o.name=outname
    # Identical clean material zones share one static batch across the whole corner.
    for slot in o.material_slots:
        base=re.sub(r'\\.\\d{3}$','',slot.material.name)
        canonical=bpy.data.materials.get(base)
        if canonical is not None:slot.material=canonical
`);
const start=code.indexOf("gc,_=load('gamecube','nintendo-gamecube')"),end=code.indexOf("snes,_=load('snes','nintendo-snes')",start);
if(start<0||end<0)throw Error('GameCube assembly region missing');
code=code.slice(0,start)+`gc,_=load('gamecube','nintendo-gamecube')
place(gc,(.21,.21,.145),-.36,.067,shelf(-.36,.067,1),angle=3)
`+code.slice(end);
code=code.replace("filepath=os.path.join(SRC,'bedroom-tv-v2.blend')","filepath=os.path.join(SRC,'bedroom-tv-v3.blend')");
code=code.replace("elif row is not None:uv.append((u,(rows-1-row+v)/rows))","elif row is not None:uv.append((.003+u*.994,(rows-1-row+.025+v*.950)/rows))");
// Every original cover gets its own full source resolution, avoiding the square atlas downsample.
const ids=['melee','wind-waker','ocarina','yoshi','smash64','link-past','links-awakening','mario-ds'];
code=code.replace("image_mat('covers','.source-assets/bedroom-tv/covers.png')",ids.map(id=>`image_mat('cover-${id}','.source-assets/bedroom-tv/${id}-Named_Boxarts.png')`).join('\n'));
code=code.replace("    bvh=tree(o);verts=[];uv=[];faces=[]",`    if mat=='covers' and tile is not None:
        mat=['cover-melee','cover-wind-waker','cover-ocarina','cover-yoshi','cover-smash64','cover-link-past','cover-links-awakening','cover-mario-ds'][tile]
        tile=None
    bvh=tree(o);verts=[];uv=[];faces=[]`);
code=code.replace("    o.data.update()\n    o['tripoReference']",`    o.data.update()
    o.data.validate(clean_customdata=False)
    repair_print(o,name,pieces)
    template=o.copy();template.data=o.data.copy()
    children=[]
    for p in pieces:
        if p.parent==o:
            child=p.copy();child.data=p.data.copy();children.append(child)
    source_templates[name]=(template,children,hi-lo)
    o['tripoReference']`);
code=code.replace('def load(name,outname):',`source_templates={}
def load(name,outname):
    if name in source_templates:
        template,children,dims=source_templates[name]
        o=template.copy();o.data=template.data.copy();o.name=outname;bpy.context.collection.objects.link(o)
        for child in children:
            p=child.copy();p.data=child.data.copy();p.parent=o;bpy.context.collection.objects.link(p);pieces.append(p)
        o['tripoReference']=name;pieces.append(o);provenance.append({'assembly':outname,'source':name})
        return o,dims.copy()
`);
code=code.replace("    tri=o.modifiers.new('triangles','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=tri.name)","    tri=o.modifiers.new('triangles','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=tri.name)\n    o.data.validate(clean_customdata=False)");
code=code.replace('from bedroom_tv_common import *','from bedroom_tv_common import *\nfrom bedroom_tv_artist_repairs import repair_print');
code=code.replace('all_triangles=True)','all_triangles=False)');
code=code.replace("pieces=[];provenance=[]",`MAT['letter-blue']=material('bedroom-letter-blue',0x35405d,.54,0)
MAT['darkgrey']=material('bedroom-clean-darkgrey',0x70747a,.49,0)
pieces=[];provenance=[]`);
code=code.replace("if c.y<-.390 and not glass:remove.append(f)","if c.y<-.375:remove.append(f)");
code=code.replace("screen=patch(crt,'crt-screen',-.369,.369,.210,.675,'crt-image',nx=32,ny=24)",`screenverts=[];screenuv=[];screenfaces=[]
for j in range(33):
    v=j/32;z=.210+.465*v
    for i in range(49):
        u=i/48;x=-.369+.738*u
        y=-.457+.008*((x/.369)**2+((z-.4425)/.2325)**2)
        screenverts.append((x,y,z));screenuv.append((u,v))
for j in range(32):
    for i in range(48):
        a=j*49+i;screenfaces.append((a,a+1,a+50,a+49))
screen=mesh('crt-screen',screenverts,screenfaces,'crt-image',screenuv)
for p in screen.data.polygons:p.use_smooth=True
screen.parent=crt;pieces.append(screen)`);
code=code.replace("ring_loop(.959,.775,.038,-.380,.400)","ring_loop(.959,.775,.038,-.380,.400),ring_loop(.950,.802,.038,-.330,.411),ring_loop(.940,.790,.038,-.240,.425),ring_loop(.900,.760,.038,-.180,.425)");
// Printing must remain outside the complete surface, including triangles between sample rays.
const patchStart=code.indexOf('def patch('),patchEnd=code.indexOf('def place(',patchStart);
code=code.slice(0,patchStart)+`def patch(o,name,x0,x1,a0,a1,mat,tile=None,axis='front',row=None,rows=8,nx=16,ny=12):
    if mat=='covers' and tile is not None:
        mat=['cover-melee','cover-wind-waker','cover-ocarina','cover-yoshi','cover-smash64','cover-link-past','cover-links-awakening','cover-mario-ds'][tile]
    bvh=tree(o);samples=[]
    for a in np.linspace(a0,a1,17):
        for x in np.linspace(x0,x1,21):
            origin=Vector((x,-2,a)) if axis=='front' else Vector((x,a,2))
            hit,*_=bvh.ray_cast(origin,Vector((0,1,0)) if axis=='front' else Vector((0,0,-1)))
            if hit is not None:samples.append((x,a,hit.y if axis=='front' else hit.z))
    samples=np.array(samples)
    if len(samples)<50:raise RuntimeError('Missing print surface '+name)
    def D(x,a):return np.stack([np.ones_like(x),x,a],axis=-1)
    coeff=np.linalg.lstsq(D(samples[:,0],samples[:,1]),samples[:,2],rcond=None)[0]
    coords=np.array([v.co[:]for v in o.data.vertices]);X=coords[:,0];A=coords[:,2 if axis=='front' else 1];depth=coords[:,1 if axis=='front' else 2]
    zone=(X>=x0)&(X<=x1)&(A>=a0)&(A<=a1)
    residual=np.concatenate([depth[zone]-D(X[zone],A[zone])@coeff,samples[:,2]-D(samples[:,0],samples[:,1])@coeff])
    shift=(residual.min()-.001 if axis=='front' else residual.max()+.001)
    verts=[];uv=[];faces=[]
    for j in range(ny+1):
        v=j/ny;a=a0+(a1-a0)*v
        for i in range(nx+1):
            u=i/nx;x=x0+(x1-x0)*u;d=float(D(x,a)@coeff)+shift
            if name=='gameboy-lcd':d=float(np.array([1,x,a])@np.array(o['bezelPlane']))+.002
            if name=='ds-upper-screen':d=float(np.array([1,x,a])@np.array(o['dsFrontPlane']))+.001
            if name=='ds-touch-screen':d=o['dsLowerHeight']
            verts.append((x,d,a) if axis=='front' else (x,a,d))
            uv.append((.003+u*.994,(rows-1-row+.025+v*.950)/rows) if row is not None else (u,v))
    for j in range(ny):
        for i in range(nx):
            a=j*(nx+1)+i;faces.append((a,a+1,a+nx+2,a+nx+1))
    p=mesh(name,verts,faces,mat,uv);p.parent=o;pieces.append(p);return p

`+code.slice(patchEnd);
code=code.replace("-.212,.212,.277,.587,'ds-top-image'","-.206,.206,.345,.606,'ds-top-image'");
code=code.replace("-.179,.179,.583,.815,'gb-image'","-.175,.175,.560,.876,'gb-image'");
code=code.replace("-.334,.334,.253,.550,'covers'","-.320,.320,.200,.580,'covers'");
code=code.replace("for cx in [-.306,.306]:","for cx in [-.306,.338]:");
code=code.replace("rb('crt-speaker-grille',cx-.091,cx+.091","rb('crt-speaker-grille',cx-(.091 if cx<0 else .071),cx+(.091 if cx<0 else .071)");
code=code.replace("cx+(col-6.5)*.0118","cx+(col-6.5)*(.0118 if cx<0 else .009)");
code=code.replace("-.216,.216,-.214,.105,'ds-touch-image'","-.205,.205,-.235,.032,'ds-touch-image'");
code=code.replace("(-.37,.02,-.390,-.165,[('SUPER NINTENDO',-.175,-.280,.025),('ENTERTAINMENT SYSTEM',-.175,-.312,.010)])","(-.37,.10,-.465,-.330,[('SUPER NINTENDO',-.145,-.400,.025),('ENTERTAINMENT SYSTEM',-.145,-.432,.010)])");
code=code.replace('scene.cycles.samples=48','scene.cycles.samples=64');
code=code.replace("    scene.render.filepath=os.path.join(RENDER,name+'.png');bpy.ops.render.render(write_still=True)","    if os.environ.get('BEDROOM_RENDER_ASSEMBLY')!='0':\n        scene.render.filepath=os.path.join(RENDER,name+'.png');bpy.ops.render.render(write_still=True)");
code=code.replace("'assembly',(1.2,-3.8,1.65)","'assembly',(1.2,-3.8,1.65)");
await writeFile('scripts/models/blender/bedroom_tv_corrected_assemble.py',code);
console.log('Corrected placement pipeline: all 15 corrected pieces, full original artwork resolution, shared clean materials');

