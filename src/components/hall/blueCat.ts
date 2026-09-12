import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

type Mood = 'idle' | 'walk' | 'settle' | 'sleep' | 'wake' | 'happy';
const HOME = new THREE.Vector3(-1.65, 0, .18);
const STOPS = [new THREE.Vector3(-1.35, 0, .62), new THREE.Vector3(-.78, 0, .78), new THREE.Vector3(-1.95, 0, .62), HOME];

/** Blue has his own clock: navigation and tab pauses never advance his route. */
export class BlueCat {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  private mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private action?: THREE.AnimationAction;
  private mood: Mood = 'idle';
  private age = 0;
  private stop = 0;
  private forward = new THREE.Vector3();
  private targetRotation = new THREE.Quaternion();
  private axis = new THREE.Vector3(0, 1, 0);
  private projection = new THREE.Vector3();
  private bounds = new THREE.Box3();
  private button: HTMLButtonElement;
  private eyelids: THREE.Object3D[] = [];
  private blink = 0;
  private blinkAge = 0;
  private ground = 0;
  private textures = new Set<THREE.Texture>();
  private shadow: THREE.Mesh;

  constructor(gltf: GLTF, private container: HTMLElement, private stationX: number) {
    this.root.name = 'Blue';
    this.root.position.x = stationX;
    this.body.name = 'Blue-pet-target';
    this.body.userData.blue = true;
    this.body.position.copy(HOME);
    this.body.rotation.y = .35;
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
        const m = mat as THREE.MeshStandardMaterial;
        m.metalness = 0;
        m.roughness = .88;
        m.envMapIntensity = .7;
        for (const value of Object.values(m)) if (value instanceof THREE.Texture) this.textures.add(value);
      }
    });
    this.mixer = new THREE.AnimationMixer(gltf.scene);
    for (const clip of gltf.animations) this.actions.set(clip.name, this.mixer.clipAction(clip));
    this.play('idle', 0);
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
    basket.add(new THREE.Mesh(bolster, fabric));    return basket;
  }

  private play(name: Mood, fade = .35) {
    const next = this.actions.get(name);
    if (!next || next === this.action) return;
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1);
    next.setLoop(name === 'settle' || name === 'wake' ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = true;
    next.play();
    if (this.action) next.crossFadeFrom(this.action, fade, false);
    this.action = next;
  }

  private enter(mood: Mood) {
    this.mood = mood;
    this.age = 0;
    this.play(mood, mood === 'happy' ? .22 : .4);
  }

  readonly pet = (event?: Event) => {
    event?.stopPropagation();
    if (!this.root.visible) return;
    this.enter('happy');
    this.container.dispatchEvent(new CustomEvent('hall:blue-petted', { bubbles: true }));
  };

  hit(ray: THREE.Raycaster) {
    if (!this.root.visible) return null;
    this.root.updateWorldMatrix(true, true);
    this.bounds.setFromObject(this.body);
    if (!ray.ray.intersectsBox(this.bounds)) return null;
    return ray.intersectObject(this.body, true)[0] ?? null;
  }

  update(dt: number, camera: THREE.Camera, active: boolean, reduce: boolean) {
    const compact = this.container.clientWidth < 600;
    this.root.scale.setScalar(compact ? .75 : 1);
    this.root.position.set(this.stationX + (compact ? .4 : 0), 0, compact ? .05 : 0);
    this.root.visible = active;
    this.button.hidden = !active;
    if (!active) return false;
    this.age += dt;
    if (!reduce) {
      if (this.mood === 'idle' && this.age > 5) this.enter('walk');
      if (this.mood === 'walk') {
        const goal = STOPS[this.stop];
        this.forward.subVectors(goal, this.body.position);
        this.forward.y = 0;
        const distance = this.forward.length();
        if (distance < .025) {
          this.body.position.x = goal.x;
          this.body.position.z = goal.z;
          if (this.stop === STOPS.length - 1) { this.stop = 0; this.enter('settle'); }
          else { this.stop++; this.enter('idle'); }
        } else {
          this.targetRotation.setFromAxisAngle(this.axis, Math.atan2(this.forward.x, this.forward.z));
          this.body.quaternion.rotateTowards(this.targetRotation, dt * 2.1);
          const alignment = Math.max(0, 1 - this.body.quaternion.angleTo(this.targetRotation) / .8);
          const speed = Math.min(.19, distance * 1.2) * alignment;
          this.body.position.addScaledVector(this.forward.normalize(), speed * dt);
          this.action?.setEffectiveTimeScale(Math.max(.25, speed / .19));
        }
      }
      if (this.mood === 'settle' && this.age > 2) this.enter('sleep');
      if (this.mood === 'sleep' && this.age > 18) this.enter('wake');
      if (this.mood === 'wake' && this.age > 2) this.enter('idle');
    }
    if (this.mood === 'happy' && this.age > 4.5) this.enter('idle');
    if (this.mood === 'happy' && !reduce) {
      this.targetRotation.setFromAxisAngle(this.axis, Math.atan2(camera.position.x - this.root.position.x - this.body.position.x, camera.position.z - this.body.position.z));
      this.body.quaternion.rotateTowards(this.targetRotation, dt * 1.8);
    }
    if (reduce && this.mood !== 'happy') this.play('idle');
    this.mixer.update(reduce && this.mood !== 'happy' ? 0 : dt);
    // Facial blendshape closes the textured eyes together with the surrounding skin.
    this.blinkAge += dt;
    const eyeGoal = this.mood === 'sleep' || this.mood === 'settle' ? 1 : this.mood === 'happy' ? .94 : !reduce && this.blinkAge % 5.1 > 4.85 ? 1 : 0;
    this.blink = THREE.MathUtils.damp(this.blink, eyeGoal, 20, dt);
    const settled = this.mood === 'sleep' ? 1 : this.mood === 'settle' ? THREE.MathUtils.smoothstep(this.age, 0, 2) : this.mood === 'wake' ? 1 - THREE.MathUtils.smoothstep(this.age, 0, 2) : 0;
    this.ground = THREE.MathUtils.damp(this.ground, settled, 14, dt);
    for (const lid of this.eyelids) {
      const mesh = lid as THREE.Mesh;
      if (mesh.morphTargetInfluences && mesh.morphTargetDictionary) mesh.morphTargetInfluences[mesh.morphTargetDictionary.BlueBlink] = this.blink;
      if (mesh.morphTargetInfluences && mesh.morphTargetDictionary?.BlueGround !== undefined) mesh.morphTargetInfluences[mesh.morphTargetDictionary.BlueGround] = this.ground;
    }
    // Blend the last few centimetres onto the cushion, including after petting there.
    const homeDistance = Math.hypot(this.body.position.x - HOME.x, this.body.position.z - HOME.z);
    this.body.position.y = THREE.MathUtils.smoothstep(.4 - homeDistance, 0, .22) * .095;
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
    return !reduce || this.mood === 'happy';
  }

  dispose() {
    this.button.removeEventListener('click', this.pet);
    this.button.remove();
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
    this.textures.forEach(texture => texture.dispose());
  }
}



