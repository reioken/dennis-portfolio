import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { convexScreenGeometry } from '../../src/components/hall/convexGlass.mjs';

test('monitor lens preserves its rim and bows out in physical units under GLB scaling', () => {
  for (const scale of [new THREE.Vector3(1,1,1), new THREE.Vector3(.00002,.00004,.00001)]) {
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(.6/scale.x,.4/scale.y));
    mesh.scale.copy(scale);mesh.rotation.set(-.2,.4,.1);mesh.position.set(3,1.4,-.3);
    mesh.updateMatrixWorld(true);
    const original=Array.from(mesh.geometry.getAttribute('position').array);
    const result=convexScreenGeometry(mesh), p=result.getAttribute('position'), uv=result.getAttribute('uv');
    const normal=new THREE.Vector3(0,0,1).transformDirection(mesh.matrixWorld);
    const centre=new THREE.Vector3().applyMatrix4(mesh.matrixWorld);
    let highest=0;
    for(let i=0;i<p.count;i++) {
      const point=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);
      const depth=point.sub(centre).dot(normal);highest=Math.max(highest,depth);
      if(uv.getX(i)===0||uv.getX(i)===1||uv.getY(i)===0||uv.getY(i)===1) assert.ok(Math.abs(depth)<1e-6,'rim remains seated in bezel');
      assert.ok(Number.isFinite(depth));
    }
    assert.ok(Math.abs(highest-.4*.028)<1e-6,'bulge is independent of quantization scale');
    assert.deepEqual(Array.from(mesh.geometry.getAttribute('position').array),original,'shared source geometry untouched');
    const n=result.getAttribute('normal');
    assert.ok(n.getZ(Math.floor(n.count/2))>.99,'centre normal faces viewer');
  }
});
