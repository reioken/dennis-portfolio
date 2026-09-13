import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='.source-assets/polish-2026-09-11/figure-flicker';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
const rows=[];
try {
 for(const variant of (process.env.FIGURE_VARIANTS||'baseline,mip,aa,both').split(',')) {
  const width=Number(process.env.FIGURE_WIDTH)||1366;
  const context=await browser.newContext({viewport:{width,height:width<600?844:900},reducedMotion:'reduce'});
  if(process.env.FIGURE_MODEL)await context.route('**/models/dennis.glb*',async route=>route.fulfill({contentType:'model/gltf-binary',body:await fs.readFile(process.env.FIGURE_MODEL)}));
  await context.route('**/Stage3D.*.js',async route=>{
   const response=await route.fetch();let body=await response.text();
   body=body.replace('this.scene.background=','window.__hall=this,this.scene.background=');
   if(['aa','both'].includes(variant))body=body.replace(/antialias:!1,powerPreference:/,'antialias:!0,powerPreference:');
   await route.fulfill({response,body});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:4322/about/',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__hall?.readyDone&&!document.documentElement.classList.contains('gl-pending'));
  await page.evaluate(variant=>{
   const s=window.__hall;s.stop();s.reduce=true;
   const figure=s.machines[0].model;window.__figure=figure;
   if(['mip','both'].includes(variant))figure.traverse(o=>{const m=o.material;if(m?.map){m.map.generateMipmaps=true;m.map.minFilter=1008;m.map.anisotropy=4;m.map.needsUpdate=true;}});
   figure.traverse(o=>{const m=o.material;if(!m)return;
    if(variant==='rough'){m.roughness=1;m.roughnessMap=null;m.normalMap=null;}
    if(variant==='flat'){m.map=null;m.roughness=1;m.roughnessMap=null;m.normalMap=null;}
    if(variant==='unlit'){m.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight=diffuseColor.rgb;\n#include <opaque_fragment>');};}
    if(variant==='noenv')m.envMapIntensity=0;
    m.needsUpdate=true;
   });
  },variant);
  for(const perfLevel of [1,2]) {
   const state=await page.evaluate(perfLevel=>{
    const s=window.__hall;s.perfLevel=perfLevel;if(s.mirror)s.mirror.visible=false;window.__figure.rotation.y=0;s.renderFrame();
    const materials=[];window.__figure.traverse(o=>{if(o.material)materials.push({name:o.material.name,minFilter:o.material.map?.minFilter,mipmaps:o.material.map?.generateMipmaps,anisotropy:o.material.map?.anisotropy})});
    return {antialias:s.renderer.getContext().getContextAttributes().antialias,samples:s.renderer.getContext().getParameter(s.renderer.getContext().SAMPLES),materials};
   },perfLevel);
   if(variant==='current') {
    assert.equal(state.antialias,true,'Direct rendering must retain edge smoothing');
    assert.ok(state.samples>0,'This test GPU must provide multisampling');
    assert.equal(state.materials[0].minFilter,1008,'The padded atlas must retain trilinear filtering');
    assert.equal(state.materials[0].mipmaps,true);
   }
   for(const angle of [0,.008,.016]) {
    await page.evaluate(angle=>{window.__figure.rotation.y=angle;window.__hall.renderFrame();},angle);
    await page.screenshot({path:`${out}/${variant}-${width}-${perfLevel}-${angle}.png`});
   }
   assert.deepEqual(errors,[]);
   rows.push({variant,width,perfLevel,...state,errors});
  }
  await context.close();
 }
}finally{await browser.close();}
console.log(JSON.stringify(rows,null,2));await fs.writeFile(`${out}/${process.env.FIGURE_REPORT||'comparison'}.json`,JSON.stringify(rows,null,2));
