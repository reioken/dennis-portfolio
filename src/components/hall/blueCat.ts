import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

type Mood = 'idle' | 'walk' | 'settle' | 'sleep' | 'wake' | 'happy';
const HOME = new THREE.Vector3(-1.65, 0, .18);
const SPOTS = [new THREE.Vector3(-1.35, 0, .62), new THREE.Vector3(-.8, 0, .76), new THREE.Vector3(-1.95, 0, .6), new THREE.Vector3(-1.1, 0, .42), new THREE.Vector3(-1.55, 0, .76)];
const BOUNDS = { minX: -2.05, maxX: -.7, minZ: .12, maxZ: 1.5 };
/** Metres per second the in-place walk clip covers at time scale 1 (stride × stance ÷ cycle). */
const STRIDE_SPEED = .19;
const MAX_SPEED = .21, ACCEL = .28, DECEL = .36, TURN_RATE = 2.4;
/** Heading Blue settles into on the cushion, so the lying pose reads from the frontal hall camera. */
const REST_YAW = .95;
const CLIP = { settle: 2.4, wake: 2.4 };
const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, 1);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const step = (x: number, a: number, b: number) => THREE.MathUtils.smoothstep(x, a, b);

/** Blue has his own clock: navigation and tab pauses never advance his route. */
export class BlueCat {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  private mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private idle: THREE.AnimationAction;
  private walk: THREE.AnimationAction;
  /** Current settle / sleep / wake / happy action layered over the locomotion pair. */
  private layer?: THREE.AnimationAction;
  private fade = .5;
  private loco = 1;
  private walkMix = 0;
  private mood: Mood = 'idle';
  private age = 0;
  private clock = 0;
  private dwell = 4;
  private speed = 0;
  private goal = HOME.clone();
  private visits = 0;
  private plannedVisits = 2;
  private pendingHappy = false;
  private forward = new THREE.Vector3();
  private heading = new THREE.Vector3();
  private targetRotation = new THREE.Quaternion();
  private projection = new THREE.Vector3();
  private bounds = new THREE.Box3();
  private button: HTMLButtonElement;
  private eyelids: THREE.Mesh[] = [];
  private blink = 0;
  private blinkAge = 0;
  private blinkPeriod = 5.1;
  private slowBlink = 0;
  private ground = 0;
  private textures = new Set<THREE.Texture>();
  private shadow: THREE.Mesh;
  // Attention overlay: neck, head and ears follow the pointer after the clips have been applied.
  private neck?: THREE.Object3D;
  private head?: THREE.Object3D;
  private ears: THREE.Object3D[] = [];
  private gazePoint = new THREE.Vector3();
  private gazeValid = false;
  private gazeAt = -Infinity;
  private hover = false;
  private gazeYaw = 0;
  private gazePitch = 0;
  private gazeWeight = 0;
  private perk = 0;
  private baseQuat = new Map<THREE.Object3D, [THREE.Quaternion, THREE.Quaternion]>();
  private tmpV = new THREE.Vector3();
  private tmpQ = new THREE.Quaternion();
  private tmpQ2 = new THREE.Quaternion();

  constructor(gltf: GLTF, private container: HTMLElement, private stationX: number) {
    this.root.name = 'Blue';
    this.root.position.x = stationX;
    this.body.name = 'Blue-pet-target';
    this.body.userData.blue = true;
    this.body.position.copy(HOME);
    this.body.rotation.y = REST_YAW;
    this.body.add(gltf.scene);
    this.root.add(this.body, this.makeBasket());
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(32, 32, 3, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(0,0,0,.32)');
    gradient.addColorStop(.5, 'rgba(0,0,0,.16)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
    const shadowMap = new THREE.CanvasTexture(canvas);
    this.textures.add(shadowMap);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(.48, .78), new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false, toneMapped: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.root.add(this.shadow);
    gltf.scene.traverse(node => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (mesh.morphTargetDictionary?.BlueBlink !== undefined) this.eyelids.push(mesh);
      mesh.frustumCulled = false; // Rest-pose bounds exclude the moving tail and paws.
      for (const mat of (Array.isArray(mesh.material) ? mesh.material : [mesh.material])) {
        const m = mat as THREE.MeshPhysicalMaterial;
        const eyes = /amber/i.test(m.name);
        m.metalness = 0;
        m.roughness = eyes ? .32 : .8;
        m.envMapIntensity = eyes ? 1.3 : .8;
        if (m.normalScale) m.normalScale.setScalar(eyes ? .3 : .35);
        if (m.isMeshPhysicalMaterial) {
          // Velvet response lets the black coat read as fur under the rect lights instead of a flat silhouette.
          m.sheen = eyes ? 0 : .55;
          m.sheenRoughness = .6;
          m.sheenColor.setRGB(.36, .34, .44);
          m.specularIntensity = eyes ? 1 : .35;
        }
        for (const value of Object.values(m)) if (value instanceof THREE.Texture) { value.anisotropy = 8; this.textures.add(value); }
      }
    });
    this.neck = gltf.scene.getObjectByName('Neck');
    this.head = gltf.scene.getObjectByName('Head');
    for (const name of ['EarL', 'EarR', 'Ear.L', 'Ear.R']) {
      const ear = gltf.scene.getObjectByName(name);
      if (ear) this.ears.push(ear);
    }
    for (const bone of [this.neck, this.head, ...this.ears]) if (bone) this.baseQuat.set(bone, [bone.quaternion.clone(), bone.quaternion.clone()]);
    this.mixer = new THREE.AnimationMixer(gltf.scene);
    for (const clip of gltf.animations) this.actions.set(clip.name, this.mixer.clipAction(clip));
    this.idle = this.actions.get('idle')!;
    this.walk = this.actions.get('walk')!;
    this.idle.play();
    this.walk.play();
    this.walk.setEffectiveWeight(0);
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'hall__blue-pet';
    this.button.setAttribute('aria-label', 'Blue streicheln');
    this.button.addEventListener('click', this.pet);
    this.container.appendChild(this.button);
  }

  private makeBasket() {
    const basket = new THREE.Group();
    basket.name = 'Blue-basket';
    basket.position.copy(HOME);
    const weaveCanvas = document.createElement('canvas');
    weaveCanvas.width = weaveCanvas.height = 32;
    const context = weaveCanvas.getContext('2d')!;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const thread = ((x >> 2) + (y >> 2)) % 2 ? Math.sin(x * Math.PI / 4) : Math.sin(y * Math.PI / 4);
      const value = Math.round(128 + thread * 28);
      context.fillStyle = `rgb(${value},${value},${value})`; context.fillRect(x, y, 1, 1);
    }
    const bump = new THREE.CanvasTexture(weaveCanvas);
    bump.wrapS = bump.wrapT = THREE.RepeatWrapping; bump.repeat.set(30, 12);
    this.textures.add(bump);
    const fabric = new THREE.MeshStandardMaterial({ color: '#514757', roughness: 1, bumpMap: bump, bumpScale: .0012 });
    const cushion = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20), fabric);
    cushion.scale.set(.365, .055, .265); cushion.position.y = .055;
    basket.add(cushion);
    const vertices: number[] = [], uvs: number[] = [], indices: number[] = [];
    for (let i = 0; i <= 96; i++) {
      const u = i / 96 * Math.PI * 2;
      const front = THREE.MathUtils.smoothstep(Math.sin(u), .3, .95);
      for (let j = 0; j <= 12; j++) {
        const v = j / 12 * Math.PI * 2;
        vertices.push(Math.cos(u) * (.405 + Math.cos(v) * .06), .09 - front * .045 + Math.sin(v) * (.06 - front * .027), Math.sin(u) * (.30 + Math.cos(v) * .052));
        uvs.push(i / 96, j / 12);
        if (i < 96 && j < 12) {
          const a = i * 13 + j, b = a + 13;
          indices.push(a, a + 1, b, b, a + 1, b + 1);
        }
      }
    }
    const bolster = new THREE.BufferGeometry();
    bolster.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    bolster.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    bolster.setIndex(indices); bolster.computeVertexNormals();
    basket.add(new THREE.Mesh(bolster, fabric));
    return basket;
  }

  /** Switch mood. Settle/sleep/wake/happy fade in over the idle/walk pair; the pair fades back when they end. */
  private enter(mood: Mood) {
    const previous = this.mood;
    this.mood = mood;
    this.age = 0;
    if (mood === 'idle') this.dwell = rand(3, 6.5);
    if (mood === 'sleep') this.dwell = rand(14, 24);
    if (mood === 'settle') { this.visits = 0; this.plannedVisits = 2 + Math.floor(Math.random() * 3); }
    if (mood !== 'wake') this.pendingHappy = false;
    this.fade = mood === 'happy' ? .35 : previous === 'settle' && mood === 'sleep' ? .3 : .5;
    const next = mood === 'idle' || mood === 'walk' ? undefined : this.actions.get(mood);
    if (next === this.layer) return;
    if (this.layer) this.layer.fadeOut(this.fade);
    if (next) {
      next.reset();
      next.setLoop(mood === 'settle' || mood === 'wake' ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
      next.clampWhenFinished = true;
      next.play();
      next.fadeIn(this.fade);
    }
    this.layer = next;
  }

  readonly pet = (event?: Event) => {
    event?.stopPropagation();
    if (!this.root.visible) return;
    if (this.mood === 'settle' || this.mood === 'sleep') { this.enter('wake'); this.pendingHappy = true; }
    else if (this.mood === 'wake') this.pendingHappy = true;
    else this.enter('happy');
    this.container.dispatchEvent(new CustomEvent('hall:blue-petted', { bubbles: true }));
  };

  hit(ray: THREE.Raycaster) {
    if (!this.root.visible) return null;
    this.root.updateWorldMatrix(true, true);
    this.bounds.setFromObject(this.body);
    if (!ray.ray.intersectsBox(this.bounds)) return null;
    return ray.intersectObject(this.body, true)[0] ?? null;
  }

  /** Pointer attention: where the cursor is in the scene and whether it rests on Blue. */
  look(ray: THREE.Ray | null, hover: boolean) {
    if (hover && !this.hover) this.slowBlink = 1;
    this.hover = hover;
    if (!ray || !this.head) { this.gazeValid = false; return; }
    this.head.getWorldPosition(this.tmpV);
    const along = this.tmpV.sub(ray.origin).dot(ray.direction);
    this.gazePoint.copy(ray.direction).multiplyScalar(Math.max(along, .5)).add(ray.origin);
    this.gazeValid = true;
    this.gazeAt = this.clock;
  }

  private startWalk() {
    if (this.visits >= this.plannedVisits) this.goal.copy(HOME);
    else {
      let spot = SPOTS[Math.floor(Math.random() * SPOTS.length)];
      if (spot.distanceTo(this.body.position) < .3) spot = SPOTS[(SPOTS.indexOf(spot) + 1) % SPOTS.length];
      this.goal.copy(spot);
    }
    this.enter('walk');
  }

  private locomote(dt: number) {
    this.forward.subVectors(this.goal, this.body.position);
    this.forward.y = 0;
    const distance = this.forward.length();
    if (distance < .015 && this.speed < .03) {
      this.body.position.x = this.goal.x;
      this.body.position.z = this.goal.z;
      this.speed = 0;
      if (this.goal.equals(HOME)) this.enter('settle');
      else { this.visits++; this.enter('idle'); }
      return;
    }
    this.targetRotation.setFromAxisAngle(UP, Math.atan2(this.forward.x, this.forward.z));
    const angle = this.body.quaternion.angleTo(this.targetRotation);
    // Turns ease out into alignment instead of stopping dead at a fixed angular rate.
    this.body.quaternion.rotateTowards(this.targetRotation, THREE.MathUtils.clamp(angle * 4, .25, TURN_RATE) * dt);
    const aligned = 1 - step(angle, .35, 1.3);
    const wanted = Math.min(MAX_SPEED, Math.sqrt(2 * DECEL * Math.max(0, distance - .01))) * aligned;
    this.speed = this.speed < wanted ? Math.min(wanted, this.speed + ACCEL * dt) : Math.max(wanted, this.speed - DECEL * dt);
    this.heading.copy(FORWARD).applyQuaternion(this.body.quaternion);
    this.body.position.addScaledVector(this.heading, this.speed * dt);
    this.body.position.x = THREE.MathUtils.clamp(this.body.position.x, BOUNDS.minX, BOUNDS.maxX);
    this.body.position.z = THREE.MathUtils.clamp(this.body.position.z, BOUNDS.minZ, BOUNDS.maxZ);
  }

  private attend(dt: number, camera: THREE.Camera, reduce: boolean) {
    if (!this.head) return;
    const awake = this.mood === 'idle' || this.mood === 'walk';
    let wanted = 0;
    if (!reduce && awake) {
      if (this.hover) wanted = 1;
      else if (this.gazeValid && this.clock - this.gazeAt < 6) wanted = this.mood === 'walk' ? .55 : 1;
      else if (this.mood === 'idle' && !this.gazeValid) wanted = .3;
    }
    this.gazeWeight = THREE.MathUtils.damp(this.gazeWeight, wanted, 4, dt);
    this.perk = THREE.MathUtils.damp(this.perk, !reduce && this.hover && awake ? 1 : 0, 6, dt);
    if (wanted > 0) {
      const target = this.hover || !this.gazeValid ? camera.position : this.gazePoint;
      this.head.getWorldPosition(this.tmpV);
      this.tmpV.subVectors(target, this.tmpV);
      this.body.getWorldQuaternion(this.tmpQ).invert();
      this.tmpV.applyQuaternion(this.tmpQ);
      const yaw = THREE.MathUtils.clamp(Math.atan2(this.tmpV.x, this.tmpV.z), -.75, .75);
      const pitch = THREE.MathUtils.clamp(Math.atan2(this.tmpV.y, Math.hypot(this.tmpV.x, this.tmpV.z)), -.3, .42);
      this.gazeYaw = THREE.MathUtils.damp(this.gazeYaw, yaw, 7, dt);
      this.gazePitch = THREE.MathUtils.damp(this.gazePitch, pitch, 7, dt);
    }
    const yaw = this.gazeYaw * this.gazeWeight, pitch = this.gazePitch * this.gazeWeight;
    this.overlay(this.neck, yaw * .38, -pitch * .35, 0);
    this.overlay(this.head, yaw * .62, -pitch * .65, 0);
    for (const ear of this.ears) this.overlay(ear, 0, -this.perk * .22, ear === this.ears[0] ? this.perk * .06 : -this.perk * .06);
  }

  /** Post-mixer additive rotation in bone space (X pitch, Y yaw, Z roll). Re-uses the last mixer pose if the mixer wrote nothing. */
  private overlay(bone: THREE.Object3D | undefined, yaw: number, pitch: number, roll: number) {
    if (!bone) return;
    const stored = this.baseQuat.get(bone)!;
    const [base, applied] = stored;
    if (bone.quaternion.equals(applied)) bone.quaternion.copy(base); else base.copy(bone.quaternion);
    this.tmpQ.setFromAxisAngle(UP, yaw);
    this.tmpQ2.setFromAxisAngle(FORWARD, roll);
    this.tmpQ.multiply(this.tmpQ2);
    this.tmpQ2.set(Math.sin(pitch / 2), 0, 0, Math.cos(pitch / 2));
    bone.quaternion.multiply(this.tmpQ.multiply(this.tmpQ2));
    applied.copy(bone.quaternion);
  }

  update(dt: number, camera: THREE.Camera, active: boolean, reduce: boolean) {
    const compact = this.container.clientWidth < 600;
    this.root.scale.setScalar(compact ? .75 : 1);
    this.root.position.set(this.stationX + (compact ? .4 : 0), 0, compact ? .05 : 0);
    this.root.visible = active;
    this.button.hidden = !active;
    if (!active) return false;
    this.age += dt;
    this.clock += dt;
    if (!reduce) {
      switch (this.mood) {
        case 'idle': if (this.age > this.dwell) this.startWalk(); break;
        case 'walk': this.locomote(dt); break;
        case 'settle':
          this.targetRotation.setFromAxisAngle(UP, REST_YAW);
          this.body.quaternion.rotateTowards(this.targetRotation, THREE.MathUtils.clamp(this.body.quaternion.angleTo(this.targetRotation) * 2.5, .15, 1.2) * dt);
          if (this.age > CLIP.settle) this.enter('sleep');
          break;
        case 'sleep': if (this.age > this.dwell) this.enter('wake'); break;
        case 'wake': if (this.age > CLIP.wake) this.enter(this.pendingHappy ? 'happy' : 'idle'); break;
      }
    }
    if (this.mood === 'happy') {
      if (this.age > 5) this.enter('idle');
      else if (!reduce) {
        this.targetRotation.setFromAxisAngle(UP, Math.atan2(camera.position.x - this.root.position.x - this.body.position.x, camera.position.z - this.body.position.z));
        const angle = this.body.quaternion.angleTo(this.targetRotation);
        this.body.quaternion.rotateTowards(this.targetRotation, THREE.MathUtils.clamp(angle * 3, .2, 1.8) * dt);
      }
    }
    if (this.mood !== 'walk') this.speed = Math.max(0, this.speed - DECEL * dt);
    if (reduce && this.mood !== 'happy' && this.layer) this.enter('idle');
    // Locomotion pair: idle and walk share one layer whose split follows the actual ground speed, so feet never slide.
    const locoGoal = this.layer ? 0 : 1;
    this.loco = THREE.MathUtils.clamp(this.loco + Math.sign(locoGoal - this.loco) * dt / this.fade, 0, 1);
    this.walkMix = THREE.MathUtils.damp(this.walkMix, step(this.speed, .01, .08), 12, dt);
    this.idle.setEffectiveWeight(this.loco * (1 - this.walkMix));
    this.walk.setEffectiveWeight(this.loco * this.walkMix);
    this.walk.setEffectiveTimeScale(this.speed / STRIDE_SPEED);
    this.mixer.update(reduce && this.mood !== 'happy' ? 0 : dt);
    this.attend(dt, camera, reduce);
    // Facial blendshape closes the textured eyes together with the surrounding skin.
    this.blinkAge += dt;
    if (this.blinkAge > this.blinkPeriod) { this.blinkAge = 0; this.blinkPeriod = rand(3.2, 6.5); }
    this.slowBlink = Math.max(0, this.slowBlink - dt / .9);
    const resting = this.mood === 'sleep' || this.mood === 'settle' || this.mood === 'wake';
    const eyeGoal = resting ? 1 : this.mood === 'happy' ? .94 : !reduce && (this.blinkAge > this.blinkPeriod - .24 || this.slowBlink > .45) ? 1 : 0;
    this.blink = THREE.MathUtils.damp(this.blink, eyeGoal, resting || this.slowBlink > 0 ? 7 : 20, dt);
    const settled = this.mood === 'sleep' ? 1 : this.mood === 'settle' ? step(this.age, .5, 2.2) : this.mood === 'wake' ? 1 - step(this.age, .5, 1.9) : 0;
    this.ground = THREE.MathUtils.damp(this.ground, settled, 14, dt);
    for (const mesh of this.eyelids) {
      if (mesh.morphTargetInfluences && mesh.morphTargetDictionary) mesh.morphTargetInfluences[mesh.morphTargetDictionary.BlueBlink] = this.blink;
      if (mesh.morphTargetInfluences && mesh.morphTargetDictionary?.BlueGround !== undefined) mesh.morphTargetInfluences[mesh.morphTargetDictionary.BlueGround] = this.ground;
    }
    // Blend the last few centimetres onto the cushion, including after petting there.
    const homeDistance = Math.hypot(this.body.position.x - HOME.x, this.body.position.z - HOME.z);
    this.body.position.y = step(.4 - homeDistance, 0, .22) * .095;
    this.shadow.position.set(this.body.position.x, .003, this.body.position.z);
    this.shadow.rotation.z = -this.body.rotation.y;
    this.body.updateWorldMatrix(true, true);
    this.projection.set(0, .27, 0).applyMatrix4(this.body.matrixWorld).project(camera);
    const inView = Math.abs(this.projection.x) < .94 && Math.abs(this.projection.y) < .94 && this.projection.z > -1 && this.projection.z < 1;
    this.button.hidden = !inView;
    if (inView) {
      this.button.style.left = `${(this.projection.x * .5 + .5) * 100}%`;
      this.button.style.top = `${(-this.projection.y * .5 + .5) * 100}%`;
      this.button.setAttribute('aria-label', document.documentElement.dataset.lang === 'en' ? 'Pet Blue the cat' : 'Blue streicheln');
    }
    return !reduce || this.mood === 'happy' || this.gazeWeight > .001 || this.perk > .001;
  }

  dispose() {
    this.button.removeEventListener('click', this.pet);
    this.button.remove();
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
    this.textures.forEach(texture => texture.dispose());
  }
}
