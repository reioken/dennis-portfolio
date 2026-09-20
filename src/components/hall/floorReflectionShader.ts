import * as THREE from 'three';
import {Reflector} from 'three/examples/jsm/objects/Reflector.js';
import {FullScreenQuad} from 'three/examples/jsm/postprocessing/Pass.js';
import type {HallLighting} from './hallLighting';

export function createHallFloor(maps:Record<string,THREE.Texture>,lighting:HallLighting,lite:boolean,aspect:number,state:()=>{dirty:boolean;ready:boolean;quality:number},captured:()=>void){
 const material=new THREE.MeshStandardMaterial({...maps,color:0x454b57,roughness:.44,metalness:0,normalScale:new THREE.Vector2(.12,.12),envMapIntensity:.3});
 lighting.decorate(material,'floor');
 if(lite){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(90,24),material);mesh.rotation.x=-Math.PI/2;return {mesh,dispose:()=>{mesh.geometry.dispose();material.dispose();}};}
 const width=768,height=Math.max(320,Math.min(640,Math.round(width/Math.max(1,aspect))));
 const mirror=new Reflector(new THREE.PlaneGeometry(90,24),{textureWidth:width,textureHeight:height,multisample:0,clipBias:.003});
 const originalMaterial=mirror.material as THREE.ShaderMaterial,originalRender=mirror.onBeforeRender;
 const capture=mirror.getRenderTarget();
 const targets=Array.from({length:3},()=>new THREE.WebGLRenderTarget(width,height,{type:THREE.HalfFloatType,depthBuffer:false}));
 const [temporary,soft,broad]=targets;
 const blur=new THREE.ShaderMaterial({uniforms:{t:{value:capture.texture},step:{value:new THREE.Vector2()}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`uniform sampler2D t;uniform vec2 step;varying vec2 vUv;void main(){vec4 c=texture2D(t,vUv)*.227027;c+=texture2D(t,vUv+step*1.384615)*.316216;c+=texture2D(t,vUv-step*1.384615)*.316216;c+=texture2D(t,vUv+step*3.230769)*.070270;c+=texture2D(t,vUv-step*3.230769)*.070270;gl_FragColor=c;}`,depthTest:false,depthWrite:false,toneMapped:false});
 const quad=new FullScreenQuad(blur),matrix=originalMaterial.uniforms.textureMatrix;
 const before=material.onBeforeCompile.bind(material),oldKey=material.customProgramCacheKey.bind(material);
 material.onBeforeCompile=(shader,renderer)=>{before(shader,renderer);Object.assign(shader.uniforms,{floorProjection:matrix,floorSoft:{value:soft.texture},floorBroad:{value:broad.texture}});
 shader.vertexShader='uniform mat4 floorProjection;varying vec4 vFloorProjection;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvFloorProjection=floorProjection*vec4(transformed,1.0);');
 shader.fragmentShader='uniform sampler2D floorSoft;uniform sampler2D floorBroad;varying vec4 vFloorProjection;\n'+shader.fragmentShader;
 // The slab tile repeats every 2 m. Everything larger is analytic and in world space (vHallWorld comes from
 // HallLighting.decorate, applied above), so it cannot tile: slow cloudiness in the sealer over five to seventy
 // metres, and the lane people walk in front of the machines, which is scuffed dull and breaks up the reflection.
 shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
  float floorWander=sin(vHallWorld.x*.0917+.9)*.5+sin(vHallWorld.x*.2310-1.8)*.31+sin(vHallWorld.x*.5310+vHallWorld.z*.37+2.4)*.19;
  floorWander+=sin(vHallWorld.z*.3110+vHallWorld.x*.1130-.7)*.24;
  float floorCloud=clamp(.5+.42*floorWander,0.,1.);
  float floorLane=exp(-pow((vHallWorld.z-1.35)/1.45,2.))*(.62+.38*sin(vHallWorld.x*1.2310+1.1));
  float floorPath=clamp(floorLane*(.55+.45*floorCloud),0.,1.);
  roughnessFactor=clamp(roughnessFactor*(1.+.52*floorPath)+.11*(floorCloud-.5),.04,1.);
  diffuseColor.rgb*=1.+.12*(floorCloud-.5)-.07*floorPath;`);
 shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
  vec2 reflectionUv=vFloorProjection.xy/max(vFloorProjection.w,.0001);
  vec3 worldNormal=inverseTransformDirection(normal,viewMatrix);
  reflectionUv+=worldNormal.xz*.0025;
  float valid=step(.0,vFloorProjection.w)*smoothstep(.0,.045,reflectionUv.x)*smoothstep(.0,.045,1.-reflectionUv.x)*smoothstep(.0,.045,reflectionUv.y)*smoothstep(.0,.045,1.-reflectionUv.y);
  vec3 reflected=mix(texture2D(floorSoft,reflectionUv).rgb,texture2D(floorBroad,reflectionUv).rgb,smoothstep(.22,.58,roughnessFactor));
  float grazing=1.-clamp(dot(normal,geometryViewDir),0.,1.);
  float fresnel=.04+.96*pow(grazing,5.);
  float contribution=fresnel*valid*(1.-roughnessFactor*.45);
  outgoingLight=outgoingLight*(1.-contribution)+reflected*contribution;
  #include <opaque_fragment>`);
 };material.customProgramCacheKey=()=>oldKey()+'-rough-planar-v3';
 (mirror as unknown as THREE.Mesh).material=material;
 const previousCamera=new THREE.Matrix4();let last=-1;
 mirror.onBeforeRender=(renderer,scene,camera,geometry,mat,group)=>{const flags=state(),moved=!previousCamera.equals(camera.matrixWorld);if(last>=0&&!moved&&!flags.dirty)return;if(flags.ready&&!moved&&performance.now()-last<(flags.quality===2?45:85))return;
 previousCamera.copy(camera.matrixWorld);last=performance.now();captured();
 originalRender.call(mirror,renderer,scene,camera,geometry,mat,group);
 const previous=renderer.getRenderTarget();
 const filter=(input:THREE.Texture,output:THREE.WebGLRenderTarget,radius:number)=>{blur.uniforms.t.value=input;blur.uniforms.step.value.set(radius/width,0);renderer.setRenderTarget(temporary);quad.render(renderer);blur.uniforms.t.value=temporary.texture;blur.uniforms.step.value.set(0,radius/height);renderer.setRenderTarget(output);quad.render(renderer);};
 filter(capture.texture,soft,1.15);filter(soft.texture,broad,3.5);renderer.setRenderTarget(previous);
 };
 mirror.rotation.x=-Math.PI/2;mirror.name='hall-stone-floor';
 return {mesh:mirror,targets,dispose:()=>{mirror.dispose();originalMaterial.dispose();material.dispose();targets.forEach(t=>t.dispose());blur.dispose();quad.dispose();}};
}
