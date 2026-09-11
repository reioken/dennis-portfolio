import * as THREE from 'three';

/** A shallow monitor lens with an unchanged rim, including quantized GLB frames.
 * @param {THREE.Mesh} mesh
 */
export function convexScreenGeometry(mesh) {
  const source = mesh.geometry;
  const p = source.getAttribute('position'), normals = source.getAttribute('normal');
  if (!p || !normals || p.count < 4) return source;
  const normal = new THREE.Vector3().fromBufferAttribute(normals, 0).normalize();
  const u = new THREE.Vector3(Math.abs(normal.x) < .9 ? 1 : 0, Math.abs(normal.x) < .9 ? 0 : 1, 0);
  u.addScaledVector(normal, -u.dot(normal)).normalize();
  const v = new THREE.Vector3().crossVectors(normal, u).normalize();
  let u0=Infinity, u1=-Infinity, v0=Infinity, v1=-Infinity, depth=0;
  const point=new THREE.Vector3();
  for(let i=0;i<p.count;i++) {
    point.fromBufferAttribute(p,i);
    const x=point.dot(u), y=point.dot(v);
    u0=Math.min(u0,x);u1=Math.max(u1,x);v0=Math.min(v0,y);v1=Math.max(v1,y);
    depth+=point.dot(normal)/p.count;
  }
  mesh.updateWorldMatrix(true,false);
  const basis=new THREE.Matrix3().setFromMatrix4(mesh.matrixWorld);
  const width=(u1-u0)*u.clone().applyMatrix3(basis).length();
  const height=(v1-v0)*v.clone().applyMatrix3(basis).length();
  // About 1 cm on a cabinet CRT, proportional to the physical screen size.
  const bulge=Math.min(width,height)*.028/Math.max(1e-8,normal.clone().applyMatrix3(basis).length());
  const geometry=new THREE.PlaneGeometry(1,1,32,24);
  const positions=geometry.getAttribute('position'), uv=geometry.getAttribute('uv');
  for(let i=0;i<positions.count;i++) {
    const x=uv.getX(i), y=uv.getY(i);
    const bow=bulge*(1-(2*x-1)**2)*(1-(2*y-1)**2);
    point.copy(u).multiplyScalar(u0+x*(u1-u0)).addScaledVector(v,v0+y*(v1-v0)).addScaledVector(normal,depth+bow);
    positions.setXYZ(i,point.x,point.y,point.z);
  }
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return geometry;
}
