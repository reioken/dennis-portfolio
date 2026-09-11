import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';

// Exercise the production transition controller without requiring a GPU.
const source = fs.readFileSync(new URL('../../src/components/hall/screenDissolve.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText
  .replace("from 'three'", 'from ' + JSON.stringify(import.meta.resolve('three')));
const {ScreenDissolve} = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const texture = () => new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1);
function setup(dip=true) {
  const material=new THREE.MeshBasicMaterial();
  const controller=new ScreenDissolve(material,dip);
  const shader={uniforms:{},fragmentShader:'#include <map_fragment>'};
  material.onBeforeCompile(shader);
  return {material,controller,shader};
}

test('changing projects releases both images of an interrupted TV transition',()=>{
  const {controller,shader}=setup(), a=texture(), b=texture(), blank=texture();
  controller.set(a,0,0);controller.set(b,10,500);controller.tick(100);
  assert.ok(controller.uses(a));assert.ok(controller.uses(b));
  controller.set(blank,110,0);
  assert.equal(controller.uses(a),false);assert.equal(controller.uses(b),false);
  assert.equal(shader.uniforms.screenBlend.value,1);
  assert.equal(controller.tick(1000),false);
});

test('parking the TV settles its current image and releases the outgoing logo',()=>{
  const {controller,material,shader}=setup(), a=texture(), b=texture();
  controller.set(a,0,0);controller.set(b,10,500);controller.tick(100);
  controller.set(material.map,110,0);
  assert.equal(material.map,b);assert.equal(controller.uses(a),false);
  assert.equal(shader.uniforms.previousScreen.value,b);
  assert.equal(controller.tick(1000),false);
});

test('a completed TV transition retains only the incoming image',()=>{
  const {controller,shader}=setup(), a=texture(), b=texture();
  controller.set(a,0,0);controller.set(b,10,500);controller.tick(510);
  assert.equal(shader.uniforms.screenBlend.value,1);
  assert.equal(controller.uses(a),false);assert.equal(controller.uses(b),true);
});

test('TV fade-through-dark uses a distinct shader from cabinet crossfades',()=>{
  const tv=setup(), cabinet=setup(false);
  assert.notEqual(tv.material.customProgramCacheKey(),cabinet.material.customProgramCacheKey());
  assert.ok(tv.shader.fragmentShader.includes('mix(screenA, darkScreen'));
  assert.ok(tv.shader.fragmentShader.includes('mix(darkScreen, screenB'));
  assert.ok(!tv.shader.fragmentShader.includes('mix(screenA, screenB'));
});
