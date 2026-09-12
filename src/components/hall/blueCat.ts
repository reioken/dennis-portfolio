import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

type Mood = 'idle' | 'walk' | 'settle' | 'sleep' | 'wake' | 'happy' | 'sit' | 'sitidle' | 'stand' | 'jump' | 'perch' | 'perchidle' | 'unperch' | 'turn';
type AfterTurn = 'walk' | 'arrive' | 'jump';
type Arrival = 'idle' | 'home' | 'sit' | 'jump' | 'perch';
type Plan = { kind: 'home' } | { kind: 'station'; index: number } | { kind: 'perch' };
/** What the hall tells Blue every frame so he can accompany the visitor. */
export interface BlueScene { focus: number; pose: 'hall' | 'zoom' | 'play' | 'screen'; stationX: number[]; inHall: boolean; }

const HOME = new THREE.Vector3(-1.65, 0, .18);
const SPOTS = [new THREE.Vector3(-1.35, 0, .62), new THREE.Vector3(-.8, 0, .76), new THREE.Vector3(-1.95, 0, .6), new THREE.Vector3(-1.1, 0, .42), new THREE.Vector3(-1.55, 0, .76)];
const BOUNDS = { minX: -2.05, maxX: 40, minZ: .12, maxZ: 1.5 };
/** The claw cabinet: top surface, its front edge, where Blue takes off, lands and lies (root-local, station 0 at x 0). */
/** The lying spot keeps the marquee's front face (z .42) .25 m ahead of the body origin, which is where the perch clip puts the elbows and wrists. */
const LEDGE = { top: 1.95, takeoff: new THREE.Vector3(0, 0, 1.05), landing: new THREE.Vector3(0, 1.95, .02), spot: new THREE.Vector3(0, 1.95, .17) };
/** Sitting spot beside a cabinet: in the gap in front of the arcades, on the side Blue arrives from. */
const STATION_LANE_Z = .8, STATION_SIDE_X = .92;
/** Metres per second the in-place walk clip covers at time scale 1 (stride × stance ÷ cycle). */
const STRIDE_SPEED = .19;
const ROAM_SPEED = .21, TRAVEL_SPEED = .34;
/** Heading errors above this are answered with a turn-in-place clip; smaller ones are absorbed while walking, whose yaw rate follows a turning radius. */
const TURN_MIN = .35, TURN_RADIUS = .45;
/** Authored turn clips: nominal angle and how far the runtime may stretch or shrink that angle before it chains another turn. */
const TURN_CLIPS = [{ name: '45', angle: Math.PI / 4, scale: [.5, 1.3] }, { name: '90', angle: Math.PI / 2, scale: [.65, 1.25] }];
/** Further away than this, Blue is placed just outside the frame and strolls in past the arcades. */
const TELEPORT_DISTANCE = 3.4, TELEPORT_RUNWAY = 2.6;
/** Heading Blue settles into on the cushion, so the lying pose reads from the frontal hall camera. */
const REST_YAW = .95;
const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, 1);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const step = (x: number, a: number, b: number) => THREE.MathUtils.smoothstep(x, a, b);
const flat = (a: THREE.Vector3, b: THREE.Vector3) => Math.hypot(a.x - b.x, a.z - b.z);
const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

/** Blue has his own clock: navigation and tab pauses never advance his route. */
export class BlueCat {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  private model: THREE.Object3D;
  private mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private idle: THREE.AnimationAction;
  private walk: THREE.AnimationAction;
  /** Current layered action (everything except the idle/walk locomotion pair). */
  private layer?: THREE.AnimationAction;
  private fade = .5;
  private loco = 1;
  private walkMix = 0;
  private mood: Mood = 'idle';
  private age = 0;
  private clock = 0;
  private frame = 0;
  private dwell = 4;
  private speed = 0;
  private travelSpeed = ROAM_SPEED;
  private goal = HOME.clone();
  private arrival: Arrival = 'idle';
  private visits = 0;
  private plannedVisits = 2;
  private pendingHappy = false;
  private plan: Plan = { kind: 'home' };
  private spotSide = -1;
  private faceYaw: number | null = null;
  private shift = new THREE.Vector3();
  private scale = 1;
  private elevation = 0;
  private jumpFrom = new THREE.Vector3();
  private jumpTo = new THREE.Vector3();
  private jumpUp = true;
  private jumpClip = 'jumpup';
  private jumpAir = 0;
  /** Root motion: yaw curve of each turn clip, displacement curve of each jump clip (authored, before warping). */
  private turnYaw = new Map<string, (t: number) => number>();
  private jumpMove = new Map<string, { at: (t: number) => THREE.Vector3; total: THREE.Vector3 }>();
  private turnClip = '';
  private turnApplied = 0;
  private turnScale = 1;
  private afterTurn: AfterTurn = 'walk';
  private planChanged = false;
  private yawRate = 0;
  private lastYaw = 0;
  private purr = 0;
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
  private seatGround = 0;
  private perchGround = 0;
  private textures = new Set<THREE.Texture>();
  private shadow: THREE.Mesh;
  // Attention overlay: neck, head and ears follow the pointer after the clips have been applied.
  private neck?: THREE.Object3D;
  private head?: THREE.Object3D;
  private chest?: THREE.Object3D;
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
    this.model = gltf.scene;
    this.body.add(this.model);
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
    this.chest = gltf.scene.getObjectByName('Chest');
    for (const name of ['EarL', 'EarR', 'Ear.L', 'Ear.R']) {
      const ear = gltf.scene.getObjectByName(name);
      if (ear) this.ears.push(ear);
    }
    for (const bone of [this.neck, this.head, this.chest, ...this.ears]) if (bone) this.baseQuat.set(bone, [bone.quaternion.clone(), bone.quaternion.clone()]);
    this.mixer = new THREE.AnimationMixer(gltf.scene);
    for (const clip of gltf.animations) {
      if (clip.name.startsWith('turn')) this.turnYaw.set(clip.name, this.extractRootYaw(clip));
      if (clip.name.startsWith('jump')) this.jumpMove.set(clip.name, this.extractRootMove(clip));
      this.actions.set(clip.name, this.mixer.clipAction(clip));
    }
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

  /**
   * Root motion for the turn clips: the Root bone carries the authored yaw. It is taken out of the clip so the
   * skeleton plays in the turning frame, and the body group is rotated by the same curve instead.
   */
  private extractRootYaw(clip: THREE.AnimationClip): (t: number) => number {
    const track = clip.tracks.find(t => t.name === 'Root.quaternion') as THREE.QuaternionKeyframeTrack | undefined;
    clip.tracks = clip.tracks.filter(t => !t.name.startsWith('Root.'));
    clip.resetDuration();
    if (!track) return () => 0;
    const interpolant = track.InterpolantFactoryMethodLinear(new Float32Array(4));
    const rest = new THREE.Quaternion().fromArray(interpolant.evaluate(0) as Float32Array).invert();
    const q = new THREE.Quaternion();
    return t => {
      q.fromArray(interpolant.evaluate(t) as Float32Array).multiply(rest);
      return Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.z * q.z));
    };
  }

  /**
   * Root motion for the jump clips: the Root bone carries the authored trajectory (1.95 m up and about a metre
   * forward onto the cabinet, or the reverse). The runtime replays it on the body, warped to the real end points.
   */
  private extractRootMove(clip: THREE.AnimationClip): { at: (t: number) => THREE.Vector3; total: THREE.Vector3 } {
    const track = clip.tracks.find(t => t.name === 'Root.position') as THREE.VectorKeyframeTrack | undefined;
    clip.tracks = clip.tracks.filter(t => !t.name.startsWith('Root.'));
    clip.resetDuration();
    const out = new THREE.Vector3();
    if (!track) return { at: () => out.set(0, 0, 0), total: new THREE.Vector3() };
    const interpolant = track.InterpolantFactoryMethodLinear(new Float32Array(3));
    const start = new THREE.Vector3().fromArray(interpolant.evaluate(0) as Float32Array);
    const at = (t: number) => out.fromArray(interpolant.evaluate(t) as Float32Array).sub(start);
    return { at, total: at(clip.duration).clone() };
  }

  private length(name: string) {
    return this.actions.get(name)?.getClip().duration ?? 1;
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

  /* ---------- animation layers ---------- */

  /** Switch mood. Layered clips fade in over the idle/walk pair; the pair fades back when they end. */
  private enter(mood: Mood) {
    const previous = this.mood;
    this.mood = mood;
    this.age = 0;
    if (mood === 'idle') this.dwell = rand(3, 6.5);
    if (mood === 'sleep') this.dwell = previous === 'sitidle' ? rand(14, 22) : rand(14, 24);
    if (mood === 'sitidle') this.dwell = rand(18, 36);
    if (mood === 'settle') { this.visits = 0; this.plannedVisits = 2 + Math.floor(Math.random() * 3); }
    if (mood !== 'wake') this.pendingHappy = false;
    const resting = (m: Mood) => m === 'sit' || m === 'sitidle' || m === 'sleep' || m === 'settle';
    this.fade = mood === 'happy' ? .35 : mood === 'jump' ? .25 : mood === 'turn' || previous === 'turn' ? .2 : previous === 'settle' && mood === 'sleep' ? .3
      : resting(previous) && resting(mood) ? 1.2 : mood === 'stand' || mood === 'unperch' ? .3 : .5;
    const next = mood === 'idle' || mood === 'walk' ? undefined : this.actions.get(mood === 'turn' ? this.turnClip : mood === 'jump' ? this.jumpClip : mood);
    if (next === this.layer) return;
    if (this.layer) this.layer.fadeOut(this.fade);
    if (next) {
      next.reset();
      const once = mood !== 'sleep' && mood !== 'sitidle' && mood !== 'perchidle' && mood !== 'happy';
      next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
      next.clampWhenFinished = true;
      next.setEffectiveTimeScale(1);
      next.play();
      next.fadeIn(this.fade);
    }
    this.layer = next;
  }

  /** Heading in radians from the quaternion: Euler `rotation.y` folds past ±90°, so it must never be read as the yaw. */
  get yaw() {
    const q = this.body.quaternion;
    return Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.z * q.z));
  }

  /** Signed yaw from the current heading to a direction, positive to Blue's left. */
  private headingError(dx: number, dz: number) {
    return wrap(Math.atan2(dx, dz) - this.yaw);
  }

  /**
   * Answer a heading error with an authored turn-in-place instead of spinning: the closest clip is picked and its
   * yaw curve is stretched a little so the body ends up facing the goal; larger errors chain a second turn.
   */
  private startTurn(error: number, then: AfterTurn) {
    const magnitude = Math.abs(error);
    const pick = TURN_CLIPS.find(c => magnitude <= c.angle * c.scale[1]) ?? TURN_CLIPS[TURN_CLIPS.length - 1];
    this.turnScale = THREE.MathUtils.clamp(magnitude / pick.angle, pick.scale[0], pick.scale[1]);
    this.turnClip = `turn${error > 0 ? 'L' : 'R'}${pick.name}`;
    this.turnApplied = 0;
    this.afterTurn = then;
    this.speed = 0;
    this.enter('turn');
  }

  /** Apply this frame's slice of the turn clip's root yaw to the body. */
  private applyTurn() {
    const yaw = (this.turnYaw.get(this.turnClip) ?? (() => 0))(Math.min(this.age, this.length(this.turnClip))) * this.turnScale;
    this.body.rotateY(yaw - this.turnApplied);
    this.turnApplied = yaw;
  }

  readonly pet = (event?: Event) => {
    event?.stopPropagation();
    if (!this.root.visible) return;
    if (this.mood === 'jump') return;
    if (this.mood === 'perch' || this.mood === 'perchidle' || this.mood === 'unperch') {
      // On the ledge Blue answers with closed eyes and a head push instead of standing up.
      this.purr = 2.6;
      this.slowBlink = 1;
    } else if (this.mood === 'settle' || this.mood === 'sleep') { this.enter('wake'); this.pendingHappy = true; }
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

  /* ---------- plans ---------- */

  private wanted(scene?: BlueScene): Plan {
    if (!scene || scene.focus === 0) return scene && scene.pose !== 'hall' ? { kind: 'perch' } : { kind: 'home' };
    return { kind: 'station', index: scene.focus };
  }

  /** Cabinet-relative points expressed in Blue's root space (the root shifts and shrinks on compact layouts). */
  private local(point: THREE.Vector3) {
    return point.clone().sub(this.shift).divideScalar(this.scale);
  }

  private stationSpot(index: number, stationX: number[]) {
    return this.local(new THREE.Vector3(stationX[index] - stationX[0] + this.spotSide * STATION_SIDE_X, 0, STATION_LANE_Z));
  }

  private replan(plan: Plan, stationX: number[], reduce: boolean) {
    this.plan = plan;
    if (plan.kind === 'station') this.spotSide = this.body.position.x > stationX[plan.index] - stationX[0] ? 1 : -1;
    if (reduce) { this.snap(stationX); return; }
    switch (this.mood) {
      case 'happy': case 'jump': case 'stand': case 'unperch': case 'wake': return; // finish, then resume
      case 'turn': this.planChanged = true; return;
      case 'perch': case 'perchidle': if (plan.kind !== 'perch') this.enter('unperch'); return;
      case 'sit': case 'sitidle': if (plan.kind !== 'station' || flat(this.body.position, this.stationSpot(plan.index, stationX)) > .04) this.enter('stand'); return;
      case 'sleep': case 'settle': this.enter('wake'); return;
      default: this.resume(stationX);
    }
  }

  /** Reduced motion: no travelling or jumping, Blue is simply where the plan puts him. */
  private snap(stationX: number[]) {
    this.speed = 0; this.loco = 1; this.walkMix = 0;
    const previous = this.layer;
    if (previous) { previous.fadeOut(0); this.layer = undefined; }
    this.mood = 'idle'; this.age = 0;
    if (this.plan.kind === 'perch') { this.body.position.copy(this.local(LEDGE.spot)); this.elevation = this.body.position.y; this.body.rotation.y = 0; this.enter('perchidle'); }
    else if (this.plan.kind === 'station') { this.elevation = 0; this.body.position.copy(this.stationSpot(this.plan.index, stationX)); this.body.rotation.y = -this.spotSide * .6; this.enter('sitidle'); }
    else { this.elevation = 0; this.body.position.copy(HOME); this.body.rotation.y = REST_YAW; }
    const current: THREE.AnimationAction | undefined = this.layer;
    if (current) { current.fadeIn(0); current.setEffectiveWeight(1); this.loco = 0; }
  }

  /** Continue the current plan from wherever Blue is. */
  private resume(stationX: number[]) {
    const plan = this.plan, at = this.body.position;
    const takeoff = this.local(LEDGE.takeoff), spot = this.local(LEDGE.spot);
    if (this.elevation > 0) {
      if (plan.kind !== 'perch') return this.startJump(at, takeoff, false);
      if (flat(at, spot) < .03) return this.enter('perch');
      return this.travelTo(spot, .12, 'perch');
    }
    if (plan.kind === 'perch') {
      if (flat(at, takeoff) < .05) return this.startJump(at, this.local(LEDGE.landing), true);
      return this.travelTo(takeoff, TRAVEL_SPEED, 'jump');
    }
    if (plan.kind === 'station') {
      const spot = this.stationSpot(plan.index, stationX);
      if (flat(at, spot) < .05) return this.enter('sit');
      return this.travelTo(spot, TRAVEL_SPEED, 'sit');
    }
    if (flat(at, HOME) > 1.4) { this.visits = this.plannedVisits; return this.travelTo(HOME, TRAVEL_SPEED, 'home'); }
    this.enter('idle');
  }

  private travelTo(goal: THREE.Vector3, speed: number, arrival: Arrival) {
    this.goal.copy(goal);
    this.travelSpeed = speed;
    this.arrival = arrival;
    const away = goal.x - this.body.position.x;
    if (this.elevation === 0 && Math.abs(away) > TELEPORT_DISTANCE) {
      // Far stations: appear just outside the frame and stroll in past the arcades instead of crossing the whole hall.
      this.body.position.set(goal.x - Math.sign(away) * TELEPORT_RUNWAY, 0, STATION_LANE_Z);
      this.body.rotation.set(0, Math.atan2(Math.sign(away), 0), 0);
      this.speed = speed * .6;
    }
    this.enter('walk');
  }

  private startJump(from: THREE.Vector3, to: THREE.Vector3, up: boolean) {
    this.jumpFrom.copy(from); this.jumpTo.copy(to); this.jumpUp = up;
    this.jumpClip = up ? 'jumpup' : 'jumpdown';
    this.jumpAir = 0;
    this.speed = 0;
    const error = this.headingError(to.x - from.x, to.z - from.z);
    if (Math.abs(error) > TURN_MIN) { this.startTurn(error, 'jump'); return; }
    this.body.rotation.set(0, this.yaw + error, 0);
    this.enter('jump');
  }

  private startWalk() {
    if (this.visits >= this.plannedVisits) { this.goal.copy(HOME); this.arrival = 'home'; }
    else {
      let spot = SPOTS[Math.floor(Math.random() * SPOTS.length)];
      if (spot.distanceTo(this.body.position) < .3) spot = SPOTS[(SPOTS.indexOf(spot) + 1) % SPOTS.length];
      this.goal.copy(spot); this.arrival = 'idle';
    }
    this.travelSpeed = ROAM_SPEED;
    this.enter('walk');
  }

  private arrive(stationX: number[]) {
    this.body.position.x = this.goal.x;
    this.body.position.z = this.goal.z;
    this.speed = 0;
    const facing = this.arrival === 'home' ? REST_YAW : this.arrival === 'sit' ? -this.spotSide * .55 : this.arrival === 'perch' ? 0 : null;
    if (facing !== null) {
      // Face the cushion, the cabinet or the viewer with real steps before lying down; a small remainder eases in during the clip.
      const error = wrap(facing - this.yaw);
      if (Math.abs(error) > TURN_MIN) { this.startTurn(error, 'arrive'); return; }
      this.faceYaw = facing;
    }
    switch (this.arrival) {
      case 'home': this.enter('settle'); break;
      case 'sit': this.enter('sit'); break;
      case 'perch': this.enter('perch'); break;
      case 'jump': this.startJump(this.body.position, this.local(LEDGE.landing), true); break;
      default: this.visits++; this.enter('idle'); this.resumeIfNeeded(stationX);
    }
  }

  private resumeIfNeeded(stationX: number[]) {
    if (this.plan.kind !== 'home') this.resume(stationX);
  }

  /** A layered once-clip has finished: continue the plan. */
  private advance(stationX: number[]) {
    switch (this.mood) {
      case 'settle': this.enter('sleep'); break;
      case 'wake': if (this.pendingHappy) this.enter('happy'); else { this.enter('idle'); this.resume(stationX); } break;
      case 'sit': this.enter('sitidle'); break;
      case 'stand': this.enter('idle'); this.resume(stationX); break;
      case 'perch': this.enter('perchidle'); break;
      case 'unperch': this.enter('idle'); this.resume(stationX); break;
      case 'jump': this.elevation = this.jumpTo.y; this.body.position.copy(this.jumpTo); this.enter('idle'); this.resume(stationX); break;
      case 'happy': this.enter('idle'); this.resume(stationX); break;
      case 'turn': {
        const next = this.afterTurn;
        if (this.planChanged) { this.planChanged = false; this.enter('idle'); this.resume(stationX); }
        else if (next === 'walk') this.enter('walk');
        else if (next === 'arrive') this.arrive(stationX);
        else this.startJump(this.body.position, this.jumpTo, this.jumpUp);
        break;
      }
    }
  }

  private locomote(dt: number, stationX: number[]) {
    this.forward.subVectors(this.goal, this.body.position);
    this.forward.y = 0;
    const distance = this.forward.length();
    if (distance < .015 && this.speed < .03) { this.arrive(stationX); return; }
    const error = this.headingError(this.forward.x, this.forward.z), angle = Math.abs(error);
    // Standing and pointing the wrong way: step around with a turn clip. Under way, the yaw rate follows a turning
    // radius, and a goal far off the heading brakes to a stop first so the turn clip can take over.
    if (this.speed < .04 && angle > TURN_MIN) { this.startTurn(error, 'walk'); return; }
    this.targetRotation.setFromAxisAngle(UP, Math.atan2(this.forward.x, this.forward.z));
    this.body.quaternion.rotateTowards(this.targetRotation, Math.min(angle * 4, THREE.MathUtils.clamp(this.speed / TURN_RADIUS, .3, 1)) * dt);
    const aligned = 1 - step(angle, .45, 1.1);
    const accel = this.travelSpeed > ROAM_SPEED ? .42 : .28, decel = this.travelSpeed > ROAM_SPEED ? .5 : .36;
    const wanted = Math.min(this.travelSpeed, Math.sqrt(2 * decel * Math.max(0, distance - .01))) * aligned;
    this.speed = this.speed < wanted ? Math.min(wanted, this.speed + accel * dt) : Math.max(wanted, this.speed - decel * dt);
    this.heading.copy(FORWARD).applyQuaternion(this.body.quaternion);
    this.body.position.addScaledVector(this.heading, this.speed * dt);
    if (this.elevation === 0) {
      this.body.position.x = THREE.MathUtils.clamp(this.body.position.x, BOUNDS.minX, BOUNDS.maxX);
      this.body.position.z = THREE.MathUtils.clamp(this.body.position.z, BOUNDS.minZ, BOUNDS.maxZ);
    }
  }

  /**
   * Replay the jump clip's authored trajectory on the body, warped so the forward and vertical distances match the
   * actual take-off and landing points (the compact layout scales the cabinet differently from Blue).
   */
  private fly() {
    const motion = this.jumpMove.get(this.jumpClip);
    if (!motion) return;
    const from = this.jumpFrom, to = this.jumpTo;
    const sample = motion.at(Math.min(this.age, this.length(this.jumpClip)));
    const forward = Math.abs(motion.total.z) > 1e-3 ? sample.z / motion.total.z : 0;
    const rise = Math.abs(motion.total.y) > 1e-3 ? sample.y / motion.total.y : 0;
    const dx = to.x - from.x, dz = to.z - from.z;
    this.body.position.set(from.x + dx * forward, from.y + (to.y - from.y) * rise, from.z + dz * forward);
    this.jumpAir = rise;
  }

  /* ---------- attention overlay ---------- */

  private attend(dt: number, camera: THREE.Camera, reduce: boolean) {
    if (!this.head) return;
    const awake = this.mood === 'idle' || this.mood === 'walk' || this.mood === 'sitidle' || this.mood === 'perchidle' || this.mood === 'sit';
    let wanted = 0;
    if (!reduce && awake) {
      if (this.hover || this.purr > 0) wanted = 1;
      else if (this.gazeValid && this.clock - this.gazeAt < 6) wanted = this.mood === 'walk' ? .55 : 1;
      else if (this.mood === 'perchidle') wanted = .75; // looks down at the visitor from the ledge
      else if (this.mood !== 'walk' && !this.gazeValid) wanted = .3;
    }
    this.gazeWeight = THREE.MathUtils.damp(this.gazeWeight, wanted, 4, dt);
    this.perk = THREE.MathUtils.damp(this.perk, !reduce && this.hover && awake ? 1 : 0, 6, dt);
    if (wanted > 0) {
      const target = this.hover || !this.gazeValid || this.purr > 0 ? camera.position : this.gazePoint;
      this.head.getWorldPosition(this.tmpV);
      this.tmpV.subVectors(target, this.tmpV);
      this.body.getWorldQuaternion(this.tmpQ).invert();
      this.tmpV.applyQuaternion(this.tmpQ);
      const yaw = THREE.MathUtils.clamp(Math.atan2(this.tmpV.x, this.tmpV.z), -.75, .75);
      const pitch = THREE.MathUtils.clamp(Math.atan2(this.tmpV.y, Math.hypot(this.tmpV.x, this.tmpV.z)), this.elevation > 0 ? -.55 : -.3, .42);
      this.gazeYaw = THREE.MathUtils.damp(this.gazeYaw, yaw, 7, dt);
      this.gazePitch = THREE.MathUtils.damp(this.gazePitch, pitch, 7, dt);
    }
    const push = this.purr > 0 ? .12 * Math.sin(Math.min(1, this.purr / 2.6) * Math.PI) : 0;
    // From the ledge the camera sits only a few degrees below him; tuck the chin so the look-down reads.
    const ledgeBias = this.mood === 'perchidle' ? .22 * this.gazeWeight : 0;
    // Curving while walking: the chest rolls into the turn and the head looks along the path ahead of the body.
    const curve = reduce || this.mood !== 'walk' ? 0 : THREE.MathUtils.clamp(this.yawRate, -1.2, 1.2);
    const lead = curve * .22;
    const yaw = this.gazeYaw * this.gazeWeight + lead, pitch = this.gazePitch * this.gazeWeight - push - ledgeBias;
    this.overlay(this.chest, curve * .04, 0, -curve * .05);
    this.overlay(this.neck, yaw * .38, -pitch * .35, 0);
    this.overlay(this.head, yaw * .62, -pitch * .65, 0);
    const earBack = this.purr > 0 ? .18 : 0;
    for (const ear of this.ears) this.overlay(ear, 0, -this.perk * .22 + earBack, ear === this.ears[0] ? this.perk * .06 : -this.perk * .06);
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

  /* ---------- per frame ---------- */

  update(dt: number, camera: THREE.Camera, active: boolean, reduce: boolean, scene?: BlueScene) {
    const compact = this.container.clientWidth < 600;
    this.scale = compact ? .75 : 1;
    this.root.scale.setScalar(this.scale);
    this.shift.set(compact ? .4 : 0, 0, compact ? .05 : 0);
    this.root.position.set(this.stationX + this.shift.x, 0, this.shift.z);
    this.root.visible = active;
    this.button.hidden = !active;
    if (!active) return false;
    this.age += dt;
    this.clock += dt;
    this.frame++;
    const stationX = scene?.stationX ?? [this.stationX];
    const plan = this.wanted(scene);
    if (plan.kind !== this.plan.kind || (plan.kind === 'station' && this.plan.kind === 'station' && plan.index !== this.plan.index)) this.replan(plan, stationX, reduce);
    if (!reduce) {
      switch (this.mood) {
        case 'idle': if (this.plan.kind === 'home' && this.age > this.dwell) this.startWalk(); break;
        case 'walk': this.locomote(dt, stationX); break;
        case 'settle': if (this.age > this.length('settle')) this.advance(stationX); break;
        case 'turn': if (this.age > this.length(this.turnClip)) this.advance(stationX); else this.applyTurn(); break;
        case 'sleep':
          if (this.age > this.dwell) { if (this.plan.kind === 'station') this.enter('sitidle'); else this.enter('wake'); }
          break;
        case 'wake': if (this.age > this.length('wake')) this.advance(stationX); break;
        case 'sit': if (this.age > this.length('sit')) this.advance(stationX); break;
        case 'sitidle': if (this.age > this.dwell) this.enter('sleep'); break;
        case 'stand': if (this.age > this.length('stand')) this.advance(stationX); break;
        case 'perch': if (this.age > this.length('perch')) this.advance(stationX); break;
        case 'unperch': if (this.age > this.length('unperch')) this.advance(stationX); break;
        case 'jump': if (this.age > this.length(this.jumpClip)) this.advance(stationX); else this.fly(); break;
      }
    }
    if (this.mood === 'happy') {
      if (this.age > 5) this.advance(stationX);
      else if (!reduce) {
        // A petted cat only shifts a little towards the visitor; the head overlay does the actual looking.
        this.targetRotation.setFromAxisAngle(UP, Math.atan2(camera.position.x - this.root.position.x - this.body.position.x, camera.position.z - this.body.position.z));
        const angle = this.body.quaternion.angleTo(this.targetRotation);
        if (angle < .7) this.body.quaternion.rotateTowards(this.targetRotation, Math.min(angle * 2, .6) * dt);
      }
    }
    // Settling clips absorb the small remainder the turn clip left: onto the cushion, towards the cabinet, or facing the viewer on the ledge.
    if (this.faceYaw !== null && !reduce && (this.mood === 'settle' || this.mood === 'sit' || this.mood === 'perch')) {
      this.targetRotation.setFromAxisAngle(UP, this.faceYaw);
      this.body.quaternion.rotateTowards(this.targetRotation, Math.min(this.body.quaternion.angleTo(this.targetRotation) * 2, .45) * dt);
    }
    // Measured yaw rate (smoothed) drives the lean and head lead while walking a curve.
    this.yawRate = THREE.MathUtils.damp(this.yawRate, wrap(this.yaw - this.lastYaw) / Math.max(dt, 1e-4), 8, dt);
    this.lastYaw = this.yaw;
    if (this.mood !== 'walk') this.speed = Math.max(0, this.speed - .5 * dt);
    this.purr = Math.max(0, this.purr - dt);
    if (reduce && this.mood !== 'happy' && this.layer && this.plan.kind === 'home') this.enter('idle');
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
    const eyeGoal = resting ? 1 : this.mood === 'happy' || this.purr > .4 ? .94 : !reduce && (this.blinkAge > this.blinkPeriod - .24 || this.slowBlink > .45) ? 1 : 0;
    this.blink = THREE.MathUtils.damp(this.blink, eyeGoal, resting || this.slowBlink > 0 || this.purr > 0 ? 7 : 20, dt);
    // Pose-space floor correctives: sphinx rest, upright sit and the ledge perch each keep their underside above the surface.
    const settled = this.mood === 'sleep' ? 1 : this.mood === 'settle' ? step(this.age, .5, 2.2) : this.mood === 'wake' ? 1 - step(this.age, .5, 1.9) : 0;
    const seated = this.mood === 'sitidle' ? 1 : this.mood === 'sit' ? step(this.age, .3, 1.6) : this.mood === 'stand' ? 1 - step(this.age, .2, 1.5) : 0;
    const perched = this.mood === 'perchidle' ? 1 : this.mood === 'perch' ? step(this.age, .4, 1.8) : this.mood === 'unperch' ? 1 - step(this.age, .2, 1.6) : 0;
    this.ground = THREE.MathUtils.damp(this.ground, settled, 14, dt);
    this.seatGround = THREE.MathUtils.damp(this.seatGround, seated, 14, dt);
    this.perchGround = THREE.MathUtils.damp(this.perchGround, perched, 14, dt);
    for (const mesh of this.eyelids) {
      const dict = mesh.morphTargetDictionary, influences = mesh.morphTargetInfluences;
      if (!dict || !influences) continue;
      influences[dict.BlueBlink] = this.blink;
      if (dict.BlueGround !== undefined) influences[dict.BlueGround] = this.ground;
      if (dict.BlueSit !== undefined) influences[dict.BlueSit] = this.seatGround;
      if (dict.BluePerch !== undefined) influences[dict.BluePerch] = this.perchGround;
    }
    // Blend the last few centimetres onto the cushion, including after petting there.
    if (this.mood !== 'jump') {
      const homeDistance = flat(this.body.position, HOME);
      this.body.position.y = this.elevation + (this.elevation === 0 ? step(.4 - homeDistance, 0, .22) * .095 : 0);
    }
    const groundY = this.mood === 'jump' ? (this.jumpAir < .5 ? this.jumpFrom.y : this.jumpTo.y) : this.elevation;
    this.shadow.position.set(this.body.position.x, groundY + .003, this.body.position.z);
    this.shadow.rotation.z = -this.yaw;
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 1 - step(this.body.position.y - groundY, .05, .6) * .7;
    this.body.updateWorldMatrix(true, true);
    this.projection.set(0, .27, 0).applyMatrix4(this.body.matrixWorld).project(camera);
    const inView = Math.abs(this.projection.x) < .94 && Math.abs(this.projection.y) < .94 && this.projection.z > -1 && this.projection.z < 1;
    this.button.hidden = !inView;
    if (inView) {
      this.button.style.left = `${(this.projection.x * .5 + .5) * 100}%`;
      this.button.style.top = `${(-this.projection.y * .5 + .5) * 100}%`;
      this.button.setAttribute('aria-label', document.documentElement.dataset.lang === 'en' ? 'Pet Blue the cat' : 'Blue streicheln');
    }
    if (reduce) return this.mood === 'happy' || this.gazeWeight > .001 || this.perk > .001;
    // Beside an open panel only calm moods are throttled, so reading stays smooth while Blue keeps breathing.
    const calm = this.mood === 'perchidle' || this.mood === 'sitidle' || this.mood === 'sleep';
    if (scene && !scene.inHall && calm && this.gazeWeight < .05 && this.perk < .05 && this.purr <= 0) return this.frame % 3 === 0;
    return true;
  }

  dispose() {
    this.button.removeEventListener('click', this.pet);
    this.button.remove();
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
    this.textures.forEach(texture => texture.dispose());
  }
}
