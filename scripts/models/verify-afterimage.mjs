import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const baseline='.source-assets/afterimage-baseline-2026-09-10/models/';
const current='public/models/';
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const glb=p=>{const b=fs.readFileSync(p);assert.equal(b.toString('ascii',0,4),'glTF');return JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());};
const names=fs.readdirSync(current).filter(n=>/^(cab-|mach-).*\.glb$/.test(n)||n==='claw.glb'||n==='payphone.glb');
// Expected slots follow the current physical layouts, not whichever art nodes
// happen to survive an export. Kiosks, claw and telephone have no flat deck.
const terminals=new Set(['mach-nexus.glb','mach-riftback.glb','mach-riftcast.glb']);
const requiredArt=name=>[
 'front_art',
 'side_art_l','side_art_r',
 ...(name.startsWith('cab-')||terminals.has(name)||name==='mach-hookline.glb'?['deck_art']:[]),
];
const rows=[];
for(const name of names){
 const old=glb(baseline+name),model=glb(current+name);
 const before=new Set((old.nodes||[]).map(n=>n.name));
 const after=new Set((model.nodes||[]).map(n=>n.name));
 const bound=/^(screen|glass|marquee|side_art_[lr]|front_art|deck_art|joy|btn(?:_\d+)?|start_\d+|trackball|[tk]btn_\d+|sel_\d+|disc|claw|carriage|floor)$/;
 const required=[...before].filter(n=>bound.test(n));
 for(const n of required)assert.ok(after.has(n),name+' missing '+n);
 const artworkSlots=requiredArt(name);
 for(const slot of artworkSlots){
  const node=model.nodes.find(n=>n.name===slot);
  assert.ok(node,name+' missing required artwork slot '+slot);
  assert.ok(node.mesh!==undefined,name+' artwork slot has no mesh: '+slot);
  assert.ok(model.meshes[node.mesh]?.primitives?.length,name+' artwork slot has no geometry: '+slot);
 }
 for(const node of model.nodes||[]){
  if(!/^(screen|marquee|side_art_[lr]|front_art|deck_art)$/.test(node.name)||node.mesh===undefined)continue;
  for(const p of model.meshes[node.mesh].primitives){
   assert.ok(p.attributes.TEXCOORD_0!==undefined,name+' missing UVs for '+node.name);
   const uv=model.accessors[p.attributes.TEXCOORD_0];
   assert.equal(uv.type,'VEC2',name+' invalid UV type for '+node.name);
   assert.equal(uv.count,model.accessors[p.attributes.POSITION].count,name+' incomplete UVs for '+node.name);
  }
 }
 if(name.startsWith('cab-') || name.startsWith('mach-') && name!=='mach-hookline.glb') {
  const spec=JSON.parse(fs.readFileSync('.source-assets/models-afterimage/'+name.replace('.glb','')+'/spec.json','utf8'));
  for(const side of ['side_art_l','side_art_r']){
   const node=model.nodes.find(n=>n.name===side);
   const p=model.meshes[node.mesh].primitives[0];
   const position=model.accessors[p.attributes.POSITION];
   const divisor=position.normalized ? ({5120:127,5121:255,5122:32767,5123:65535}[position.componentType]??1) : 1;
   const extent=position.max.map((v,i)=>(v-position.min[i])/divisor*(node.scale?.[i]??1));
   assert.ok(Math.max(...extent)>=spec.height*.99,name+' artwork must cover the whole panel height');
  }
 }
 const triangles=(model.meshes||[]).reduce((sum,m)=>sum+m.primitives.reduce((n,p)=>n+(p.indices!==undefined?model.accessors[p.indices].count:model.accessors[p.attributes.POSITION].count)/3,0),0);
 assert.ok(triangles<50000,name+' geometry budget exceeded');
 rows.push({name,bytes:fs.statSync(current+name).size,triangles,retainedBindings:required.length,artworkSlots});
}
assert.equal(hash(current+'dennis.glb'),hash(baseline+'dennis.glb'),'Puppet model changed');
assert.equal(hash(current+'chars/nori.glb'),hash(baseline+'chars/nori.glb'),'Nori model changed');
const report={models:rows,puppetSha256:hash(current+'dennis.glb'),puppetUnchanged:true,noriUnchanged:true};
fs.writeFileSync('.source-assets/models-afterimage/verification.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
