import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ROOM_POWER_MS, withRoomPower, roomPowerLevels, roomCircuitOffset, collectRoomPowerTargets} from '../../src/components/hall/roomPower.mjs';

function fixture() {
  const scene=new THREE.Scene();scene.environmentIntensity=.38;scene.fog=new THREE.Fog('#111624',1,20);
  const light=new THREE.PointLight('#ffffff',5);scene.add(light);
  const material=new THREE.MeshBasicMaterial({color:'#8899aa'});
  const screen=new THREE.Mesh(new THREE.PlaneGeometry(),material);scene.add(screen);
  const glowing=new THREE.MeshStandardMaterial({emissive:'#9988aa',emissiveIntensity:2});
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(),glowing));scene.updateMatrixWorld(true);
  return {scene,light,material,glowing};
}

test('dim ignition attempts fall back before a slower stable warm-up',()=>{
  assert.equal(roomPowerLevels(0).circuit,0);
  for (const [peak,quiet] of [[780,1250],[1690,2250]]) {
    assert.ok(roomPowerLevels(peak).circuit>0);
    assert.ok(roomPowerLevels(peak).circuit<=.26);
    assert.equal(roomPowerLevels(quiet).circuit,0);
  }
  assert.ok(roomPowerLevels(3500).ambient<.1);
  assert.ok(roomPowerLevels(5200).circuit<1);
  assert.deepEqual(roomPowerLevels(ROOM_POWER_MS),{ambient:1,room:1,circuit:1,screen:1});
});

test('circuits ignite at different times but all settle before completion',()=>{
  assert.notEqual(roomPowerLevels(780).circuit,roomPowerLevels(780,460).circuit);
  assert.equal(roomPowerLevels(ROOM_POWER_MS,460).circuit,1);
});

test('power cue restores material and light values after each render, including failures',()=>{
  const {scene,light,material,glowing}=fixture();const color=material.color.clone(),fog=scene.fog.color.clone(),lightColor=light.color.clone();
  for(let i=0;i<3;i++){
    assert.throws(()=>withRoomPower(scene,800,0,()=>{assert.ok(glowing.emissiveIntensity<2);throw new Error('render failure');}));
    assert.equal(light.intensity,5);assert.ok(light.color.equals(lightColor));assert.equal(glowing.emissiveIntensity,2);
    assert.equal(scene.environmentIntensity,.38);assert.ok(material.color.equals(color));assert.ok(scene.fog.color.equals(fog));
  }
});

test('a completed cue renders without dimming or changing values',()=>{
  const {scene,light}=fixture();let draws=0;
  withRoomPower(scene,ROOM_POWER_MS+1,0,()=>{draws++;assert.equal(light.intensity,5);});
  assert.equal(draws,1);
});

test('screen power stays clean while fixtures strike and ambient light remains steady',()=>{
  assert.equal(roomPowerLevels(780).screen,0);
  assert.equal(roomPowerLevels(1690).screen,0);
  let previous=0;
  for(let time=0;time<=ROOM_POWER_MS;time+=20){
    const levels=roomPowerLevels(time);
    assert.ok(levels.ambient>=previous);previous=levels.ambient;
    for(const offset of [0,160,460,810])for(const value of Object.values(roomPowerLevels(time,offset)))assert.ok(value>=0&&value<=1);
  }
});

test('circuit timing is stable, asymmetric, and consistent within a cabinet',()=>{
  assert.equal(roomCircuitOffset(.12,0),roomCircuitOffset(-.12,0));
  assert.notEqual(roomCircuitOffset(2.4,0),roomCircuitOffset(-2.4,0));
  assert.equal(roomCircuitOffset(2.4,0),roomCircuitOffset(2.4,0));
});

test('long asset loads keep a quiet room and sleeping displays without becoming fully lit',()=>{
  const {scene,material,light}=fixture();scene.children.find(o=>o.material===material).name='screen';
  withRoomPower(scene,12000,0,()=>{
    assert.equal(material.color.r,0);
    assert.ok(scene.environmentIntensity<.01);
    assert.ok(light.intensity<5);
  },true);
});


test('cached fixtures follow moving world transforms without traversing the scene again',()=>{
  const {scene,light,material}=fixture();
  const targets=collectRoomPowerTargets(scene);
  for(const x of [0,2.4,-4.8]) {
    light.position.x=x;scene.updateMatrixWorld(true);
    let expected;
    withRoomPower(scene,3600,0,()=>{expected=[light.intensity,material.color.r];});
    const traverse=scene.traverse;
    scene.traverse=()=>{throw new Error('unexpected scene traversal');};
    try {
      withRoomPower(scene,3600,0,()=>assert.deepEqual([light.intensity,material.color.r],expected),false,targets);
      assert.throws(()=>withRoomPower(scene,3600,0,()=>{throw new Error('render');},false,targets));
      assert.equal(light.intensity,5);
    } finally {scene.traverse=traverse;}
  }
});

test('shared baked lighting fades once and restores after a failed render',()=>{
 const scene=new THREE.Scene(),power={value:.8};const materials=[0,1].map(()=>{const m=new THREE.MeshStandardMaterial();m.userData.hallPower=power;m.lightMap=new THREE.Texture();m.lightMapIntensity=2;scene.add(new THREE.Mesh(new THREE.PlaneGeometry(),m));return m;});scene.updateMatrixWorld(true);
 const factor=roomPowerLevels(4500).room;
 assert.throws(()=>withRoomPower(scene,4500,0,()=>{assert.ok(Math.abs(power.value-.8*factor)<1e-9);for(const m of materials)assert.ok(Math.abs(m.lightMapIntensity-2*factor)<1e-9);throw new Error('reflection render failed');}));
 assert.equal(power.value,.8);for(const m of materials)assert.equal(m.lightMapIntensity,2);
 withRoomPower(scene,0,0,()=>{assert.equal(power.value,0);});assert.equal(power.value,.8);
});
