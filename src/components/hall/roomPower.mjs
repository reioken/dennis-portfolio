/** One startup lighting cue in the real scene, with no loading gate. */
/** The cue was authored on a 6800 ms timeline; it plays back compressed (2026-09-19: the cue was 6.8 s of a 12.6 s cold start). 1 restores the authored length. */
export const ROOM_POWER_SCALE = .6;
export const ROOM_POWER_MS = 6800 * ROOM_POWER_SCALE;
const ramp = (time, start, end) => {
  const t = Math.max(0, Math.min(1, (time - start) / (end - start)));
  return t * t * (3 - 2 * t);
};

// Fast electrical strikes followed by a longer phosphor afterglow. Stable in time,
// so dropped frames cannot change the pattern or trigger random bright flashes.
const ignition = time => {
  const strike = (start, attack, hold, decay, strength) =>
    ramp(time,start,start+attack) * (1-ramp(time,start+attack+hold,start+attack+hold+decay)) * strength;
  return Math.max(strike(610,45,70,290,.16),strike(1540,35,135,390,.25));
};
const settle = (time,start,end) => {
  const t=Math.max(0,Math.min(1,(time-start)/(end-start)));
  return t*t*t*(t*(t*6-15)+10);
};

/** A fixture belongs to a circuit, not to a frame. Adjacent banks do not start in unison. */
export function roomCircuitOffset(x,originX) {
  const bank=Math.round((x-originX)/2.4);
  const phase=((bank*0.61803398875)%1+1)%1;
  return Math.min(650,Math.abs(bank)*135)+phase*160;
}

export function roomPowerLevels(realElapsed, offset=0) {
  if (realElapsed >= ROOM_POWER_MS) return { ambient: 1, room: 1, circuit: 1, screen: 1 };
  // Authored time from here on.
  const elapsed=realElapsed/ROOM_POWER_SCALE;
  const time=elapsed-offset;
  const warm=settle(time,2450,5650);
  // One small local ballast dip during warm-up, rather than wobbling the entire room.
  const dip=ramp(time,3260,3370)*(1-ramp(time,3490,3890))*.12;
  return {
    ambient: Math.max(ramp(elapsed,0,800)*.014,settle(elapsed,2800,6600)),
    room: Math.max(ramp(elapsed,0,1200)*.006,settle(elapsed,3100,6800)),
    circuit: Math.max(ignition(time),warm*(1-dip)),
    // Displays wake cleanly after the fixtures; screen content never flickers like a fluorescent tube.
    screen: settle(time,3050,5780),
  };
}

/** Temporarily power the actual lights and emitting surfaces for this render.
 * All values are restored, so camera focus and screen transitions keep ownership.
 */
export function collectRoomPowerTargets(scene) {
  const targets = [];
  scene.traverse(object => { if (object.isLight || object.material) targets.push(object); });
  return targets;
}

export function withRoomPower(scene, elapsed, originX, draw, preparing=false, targets) {
  if (!preparing && elapsed >= ROOM_POWER_MS) return draw();
  const restore = [], materials = new Map();
  const levelsAt = offset => {
    if (!preparing) return roomPowerLevels(elapsed,offset);
    const time=(elapsed % 3000)-offset;
    return {ambient:ramp(elapsed,0,800)*.014,room:ramp(elapsed,0,1200)*.006,circuit:ignition(time),screen:0};
  };
  const {room} = levelsAt(0);
  const environment = scene.environmentIntensity;
  scene.environmentIntensity = environment * room;
  restore.push(() => { scene.environmentIntensity = environment; });
  if (scene.fog?.color) {
    const color = scene.fog.color.clone();
    scene.fog.color.multiplyScalar(room);
    restore.push(() => scene.fog.color.copy(color));
  }
  for (const object of targets ?? collectRoomPowerTargets(scene)) {
    const x = object.matrixWorld.elements[12];
    const delay = roomCircuitOffset(x,originX);
    const levels = levelsAt(delay);
    if (object.isLight) {
      const intensity = object.intensity;
      const ambient = object.isAmbientLight || object.isHemisphereLight;
      object.intensity *= ambient ? levels.ambient : levels.circuit;
      restore.push(() => { object.intensity = intensity; });
      // White practical lights start with a faint warm tint and settle to their actual color.
      // Saturated project lights retain their identity throughout.
      if (!ambient && object.color && Math.max(object.color.r,object.color.g,object.color.b)-Math.min(object.color.r,object.color.g,object.color.b)<.22) {
        const color=object.color.clone();
        const cold=1-settle(elapsed/ROOM_POWER_SCALE-delay,2200,5200);
        object.color.g *= 1-cold*.035;
        object.color.b *= 1-cold*.10;
        restore.push(()=>object.color.copy(color));
      }
    }
    const list = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
    for (const material of list) {
      const screen = /screen|display/i.test(object.name);
      const emitter = /marquee|lamp|led|glow|light|pilaster|neon/i.test(object.name);
      // Unlit artwork and mascot sprites should receive light, not behave like lamps.
      const surface = Math.max(levels.ambient,levels.circuit*.38);
      const power = screen ? levels.screen : emitter || material.emissiveIntensity > 0 ? levels.circuit : surface;
      materials.set(material, Math.max(materials.get(material) ?? 0, power));
    }
  }
  const scaledUniforms = new Set();
  for (const [material, power] of materials) {
    const uniform=material.userData?.hallPower;
    if(uniform&&!scaledUniforms.has(uniform)){const value=uniform.value;uniform.value*=room;scaledUniforms.add(uniform);restore.push(()=>{uniform.value=value;});}
    if(material.lightMap){const intensity=material.lightMapIntensity;material.lightMapIntensity*=room;restore.push(()=>{material.lightMapIntensity=intensity;});}
    if (material.isMeshBasicMaterial || material.isSpriteMaterial) {
      const color = material.color.clone();
      material.color.multiplyScalar(power);
      restore.push(() => material.color.copy(color));
    }
    if (typeof material.emissiveIntensity === 'number') {
      const intensity = material.emissiveIntensity;
      material.emissiveIntensity *= power;
      restore.push(() => { material.emissiveIntensity = intensity; });
    }
    if (material.envMap && typeof material.envMapIntensity === 'number') {
      const intensity = material.envMapIntensity;
      material.envMapIntensity *= room;
      restore.push(() => { material.envMapIntensity = intensity; });
    }
  }
  try { return draw(); }
  finally { for (let i=restore.length-1; i>=0; i--) restore[i](); }
}
