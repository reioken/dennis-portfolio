import * as THREE from 'three';
import { convexScreenGeometry } from './convexGlass.mjs';

/** Fine static surface relief. Marks change reflections, not the screen's contrast. */
export function makeGlassWear() {
  const size=512, canvas=document.createElement('canvas'); canvas.width=size; canvas.height=size;
  const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#202020'; ctx.fillRect(0,0,size,size);
  let seed=871;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  // Dust is concentrated in the gasket, with a clear viewing area.
  for(let edge=0;edge<4;edge++){
    ctx.save(); ctx.translate(size/2,size/2);ctx.rotate(edge*Math.PI/2);ctx.translate(-size/2,-size/2);
    const dust=ctx.createLinearGradient(0,0,0,22);dust.addColorStop(0,'#707070');dust.addColorStop(1,'#202020');
    ctx.fillStyle=dust;ctx.fillRect(0,0,size,22);ctx.restore();
  }
  for(let i=0;i<38;i++){
    const x=random()*size,y=random()*size;
    ctx.strokeStyle=`rgba(210,210,210,${.15+random()*.25})`;ctx.lineWidth=.4+random()*.35;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(random()-.5)*32,y+4+random()*17);ctx.stroke();
  }
  // A few partial cleaning arcs near a corner, not an all-over frosted layer.
  for(let i=0;i<5;i++){
    ctx.strokeStyle='rgba(150,150,150,.10)';ctx.lineWidth=.65;
    ctx.beginPath();ctx.ellipse(size*.86,size*.8,22+i*3,33+i*3,-.4,.2,2.8);ctx.stroke();
  }
  const roughness=new THREE.CanvasTexture(canvas);roughness.anisotropy=4;
  return {roughness};
}

export function clearScreenGlass(wear: ReturnType<typeof makeGlassWear>, mesh?: THREE.Mesh, enclosure=false) {
  if (mesh && !enclosure) mesh.geometry = convexScreenGeometry(mesh);
  // The GLB optimizer removes unused glass UVs. Restore a projection for each pane.
  if(mesh && !mesh.geometry.getAttribute('uv')) {
    const geometry=mesh.geometry;geometry.computeBoundingBox();
    const bounds=geometry.boundingBox!,size=bounds.getSize(new THREE.Vector3()).max(new THREE.Vector3(.0001,.0001,.0001));
    const positions=geometry.getAttribute('position'),normals=geometry.getAttribute('normal');
    const uv=new Float32Array(positions.count*2);
    for(let i=0;i<positions.count;i++) {
      const nx=Math.abs(normals?.getX(i)??0),ny=Math.abs(normals?.getY(i)??0),nz=Math.abs(normals?.getZ(i)??1);
      const x=(positions.getX(i)-bounds.min.x)/size.x,y=(positions.getY(i)-bounds.min.y)/size.y,z=(positions.getZ(i)-bounds.min.z)/size.z;
      uv[i*2]=nx>nz&&nx>ny?z:x;uv[i*2+1]=ny>nx&&ny>nz?z:y;
    }
    geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  }
  const mat=new THREE.MeshPhysicalMaterial({color:enclosure?0x11171d:0x000000,transparent:true,opacity:.06,
    roughness:enclosure?.8:.65,roughnessMap:wear.roughness,metalness:0,specularIntensity:enclosure?.7:.5,
    clearcoat:enclosure?.45:.22,clearcoatRoughness:enclosure?.12:.085,envMapIntensity:enclosure?.7:1.15,depthWrite:false,
    side:enclosure?THREE.DoubleSide:THREE.FrontSide,forceSinglePass:true});
  // Keep reflected light visible without adding an opaque diffuse veil.
  mat.blending=THREE.CustomBlending;
  mat.blendSrc=THREE.OneFactor;
  mat.blendDst=THREE.OneMinusSrcAlphaFactor;
  // A flat pane facing a dark room reflects nothing: the enclosure carries two soft diagonal sheen bands.
  // They ride on the emissive term, so the room's power cue dims them with every other lit surface.
  if (enclosure) { mat.emissive=new THREE.Color(0xcfe2ff); mat.emissiveIntensity=1; }
  mat.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphamap_fragment>',`
      #include <alphamap_fragment>
      float glassMarks = texture2D(roughnessMap, vRoughnessMapUv).g;
      float glassEdge = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 4.0);
      diffuseColor.a = 0.018 + glassEdge * 0.12 + max(0.0, glassMarks - 0.16) * 0.12;
    `);
    if (enclosure) shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>', `
      #include <emissivemap_fragment>
      float sheenAxis = vRoughnessMapUv.x * .8 + vRoughnessMapUv.y;
      float glassSheen = smoothstep(.78,.86,sheenAxis) * (1.0 - smoothstep(.96,1.04,sheenAxis))
        + .55 * smoothstep(1.12,1.15,sheenAxis) * (1.0 - smoothstep(1.19,1.22,sheenAxis));
      // One pane at a time: only the outer face of the pane the viewer looks through. Side panes seen from the
      // front stay clear, otherwise their bands cross the front pane's.
      float glassFacing = abs(dot(normalize(vNormal), normalize(vViewPosition)));
      glassSheen *= smoothstep(.6,.9,glassFacing) * (gl_FrontFacing ? 1.0 : 0.0);
      totalEmissiveRadiance *= glassSheen * .075;
    `).replace('#include <opaque_fragment>', `
      #include <opaque_fragment>
      gl_FragColor.rgb = (outgoingLight - totalEmissiveRadiance) * (0.3 + glassEdge * 0.5) + totalEmissiveRadiance;
      gl_FragColor.a = clamp(0.03 + glassEdge * 0.2 + max(0.0, glassMarks - 0.16) * 0.06 + glassSheen * 0.03, 0.03, 0.3);
    `);
    else shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>', `
      #include <opaque_fragment>
      // Preserve grazing highlights while keeping the front-facing display
      // readable. A constant reflection gain made broad lamp reflections
      // overwhelm screenshots, especially on the shallow laptop screens.
      gl_FragColor.rgb *= 0.12 + glassEdge * 0.24;
      gl_FragColor.a = clamp(0.035 + glassEdge * 0.24 + max(0.0, glassMarks - 0.16) * 0.045, 0.035, 0.32);
    `);
  };
  mat.customProgramCacheKey=()=> enclosure ? 'clear-worn-enclosure-v5' : 'convex-screen-glass-v4';
  return mat;
}

/** Tiny edge chips and lower-body scuffs, placed in object space and stable while the camera moves. */
export function addPanelWear(mesh: THREE.Mesh, material: THREE.MeshStandardMaterial) {
  mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox;if(!box)return;
  // Named GLB inserts may keep a rotated local frame; scuffs belong at the physical bottom.
  const rotation=new THREE.Matrix4().makeRotationFromQuaternion(mesh.getWorldQuaternion(new THREE.Quaternion()));
  const basis=new THREE.Matrix3().setFromMatrix4(rotation);
  const orientedBox=box.clone().applyMatrix4(rotation);
  const size=orientedBox.getSize(new THREE.Vector3());
  const active=new THREE.Vector3(Number(size.x>.002),Number(size.y>.002),Number(size.z>.002));
  const span=size.clone().max(new THREE.Vector3(.0001,.0001,.0001));
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{wearOrigin:{value:orientedBox.min},wearSpan:{value:span},wearAxes:{value:active},wearBasis:{value:basis}});
    shader.vertexShader='uniform vec3 wearOrigin; uniform vec3 wearSpan; uniform mat3 wearBasis; varying vec3 vWearPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWearPosition=(wearBasis*position-wearOrigin)/wearSpan;');
    shader.fragmentShader='uniform vec3 wearAxes; varying vec3 vWearPosition;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      #include <map_fragment>
      vec3 panelP=clamp(vWearPosition,0.0,1.0);
      vec3 edgeDistances=min(panelP,1.0-panelP)+(1.0-wearAxes);
      float edgeDistance=min(edgeDistances.x,min(edgeDistances.y,edgeDistances.z));
      float edgeWear=1.0-smoothstep(0.002,0.014,edgeDistance);
      vec3 cell=floor(panelP*vec3(197.0,241.0,211.0));
      float wearNoise=fract(sin(dot(cell,vec3(12.9898,78.233,37.719)))*43758.5453);
      float chips=edgeWear*smoothstep(.90,.99,wearNoise);
      float lowerScuff=(1.0-smoothstep(.02,.20,panelP.y))*smoothstep(.984,.998,wearNoise);
      float wearAmount=max(chips*.24,lowerScuff*.12);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.13,.135,.14),wearAmount);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.72,wearAmount);');
  };
  material.customProgramCacheKey=()=> 'maintained-panel-wear-v1';
}
