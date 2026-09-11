import * as THREE from 'three';
import { addPanelWear } from './hardwareWear';

/** Small shared physical-detail maps, independent from printed illustration. */
export function makeSurfaceMaps() {
  const size = 128, rough = new Uint8Array(size * size * 4), normal = new Uint8Array(size * size * 4);
  let seed = 731;
  for (let i = 0; i < size * size; i++) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    const grain = (seed >>> 24) / 255;
    rough.set([190 + grain * 55, 190 + grain * 55, 190 + grain * 55, 255], i * 4);
    normal.set([123 + grain * 10, 123 + ((seed >>> 16) & 255) / 25.5, 255, 255], i * 4);
  }
  const create = (data: Uint8Array) => {
    const t = new THREE.DataTexture(data, size, size);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(12,12); t.magFilter=THREE.LinearFilter; t.minFilter=THREE.LinearMipmapLinearFilter;
    t.generateMipmaps=true; t.needsUpdate=true; return t;
  };
  return { roughness: create(rough), normal: create(normal) };
}

export function finishHardware(mesh: THREE.Mesh, maps: ReturnType<typeof makeSurfaceMaps>) {
  const original=mesh.material as THREE.MeshStandardMaterial;
  if (!original?.isMeshStandardMaterial) return;
  const name=original.name.toLowerCase();
  if (/screen|glass|marquee|lamp|led|letters|preview|side_art|front_art/.test(name)) return;
  const mat = original.clone() as THREE.MeshPhysicalMaterial;
  if (/paint|panel|deck|bezel/.test(name)) {
    mat.roughness=.64; mat.metalness=0;
    mat.roughnessMap=maps.roughness; mat.normalMap=maps.normal; mat.normalScale.set(.24,.24);
    if(mat.isMeshPhysicalMaterial){mat.clearcoat=.08;mat.clearcoatRoughness=.5;}
    mat.envMapIntensity=.25;
    addPanelWear(mesh,mat);
  } else if (/ball|button_\d|start_\d|accent|cap/.test(name)) {
    mat.roughness=.2; mat.metalness=0; mat.envMapIntensity=.95;
    if(mat.isMeshPhysicalMaterial){mat.clearcoat=.65;mat.clearcoatRoughness=.13;}
    if(mat.emissiveIntensity>0)mat.emissiveIntensity=Math.min(.15,mat.emissiveIntensity);
  } else if (/ring|washer|rubber|recess|hole/.test(name)) {
    mat.roughness=.72;mat.metalness=0;mat.envMapIntensity=.35;
  } else if (/metal|chrome|fastener|brushed|kick|grille/.test(name)) {
    mat.roughness=.34;mat.metalness=.88;mat.envMapIntensity=.6;
    if (!/chrome|fastener/.test(name)) mat.color.multiplyScalar(.45);
    mat.roughnessMap=maps.roughness;
  } else return;
  mesh.material=mat;
}

/** Side artwork uses the full shaped panel, including rounded edge geometry. */
export function artworkAspect(mesh: THREE.Mesh) {
  if(mesh.name.toLowerCase().startsWith('side_art')) {
    mesh.geometry.computeBoundingBox();
    const size=mesh.geometry.boundingBox?.getSize(new THREE.Vector3());
    if(size){const dimensions=[size.x,size.y,size.z].sort((a,b)=>a-b);return dimensions[1]/dimensions[2];}
  }
  const p=mesh.geometry.getAttribute('position'), uv=mesh.geometry.getAttribute('uv');
  if(!p||!uv)return .65;
  let width=0,height=0;
  for(let i=0;i<p.count;i++)for(let j=i+1;j<p.count;j++){
    const du=Math.abs(uv.getX(i)-uv.getX(j)),dv=Math.abs(uv.getY(i)-uv.getY(j));
    const length=new THREE.Vector3().fromBufferAttribute(p,i).distanceTo(new THREE.Vector3().fromBufferAttribute(p,j));
    if(du>.9&&dv<.02)width=Math.max(width,length);
    if(dv>.9&&du<.02)height=Math.max(height,length);
  }
  return width&&height?width/height:.65;
}