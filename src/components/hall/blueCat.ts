import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

type Mood = 'idle' | 'walk' | 'settle' | 'sleep' | 'wake' | 'happy' | 'arch' | 'sit' | 'sitidle' | 'sitarch' | 'stand' | 'jump' | 'perch' | 'perchidle' | 'unperch' | 'turn';
type Region = 'head' | 'back' | 'tail';
type AfterTurn = 'walk' | 'arrive' | 'jump';
type Arrival = 'idle' | 'home' | 'sit' | 'jump' | 'perch';
type Plan = { kind: 'home' } | { kind: 'station'; index: number } | { kind: 'perch' };
/** What the hall tells Blue every frame so he can accompany the visitor. */
export interface BlueScene { focus: number; pose: 'hall' | 'zoom' | 'play' | 'screen'; stationX: number[]; inHall: boolean; }

const HOME = new THREE.Vector3(-1.65, 0, .18);
/** Cat bed: inner half-extents across and along Blue, bolster tube radius, superellipse exponent, plinth and cushion heights, centre offset behind the body origin. */
const BED = { x: .20, z: .27, tube: .07, n: 2.7, base: .03, cushion: .06, back: .06 };
/** How high the cushion carries Blue's body origin at the centre of the bed. */
const HOME_LIFT = .085;
const SPOTS = [new THREE.Vector3(-1.35, 0, .62), new THREE.Vector3(-.8, 0, .76), new THREE.Vector3(-1.95, 0, .6), new THREE.Vector3(-1.1, 0, .42), new THREE.Vector3(-1.55, 0, .76)];
const BOUNDS = { minX: -2.05, maxX: 40, minZ: .12, maxZ: 1.5 };
/** The claw cabinet: top surface, its front edge, where Blue takes off, lands and lies (root-local, station 0 at x 0). */
/** The lying spot keeps the marquee's front face (z .42) .25 m ahead of the body origin, which is where the perch clip puts the elbows and wrists. */
const LEDGE = { top: 1.95, takeoff: new THREE.Vector3(0, 0, .80), landing: new THREE.Vector3(0, 1.95, .17), spot: new THREE.Vector3(0, 1.95, .17) };
/** Sitting spot beside a cabinet: in the gap in front of the arcades, on the side Blue arrives from. */
const STATION_LANE_Z = .8, STATION_SIDE_X = .92;
/** Metres per second the in-place walk clip covers at time scale 1 (37 cm stride over a 1.1 s cycle; the roam plays it at 0.62 as a slow prowl). */
const STRIDE_SPEED = .34;
const ROAM_SPEED = .21, TRAVEL_SPEED = .34;
/** Beyond this distance a goal is worth trotting to; the in-place trot clip covers TROT_SPEED at time scale 1. */
const FAR_DISTANCE = 1.5, RUN_SPEED = .9, TROT_SPEED = .9;
/** Heading errors above this (4.6°) are answered with a turn-in-place clip, warped to the angle and played faster the smaller it is; anything less is invisible and eases in during the next clip. */
const TURN_MIN = .08, TURN_RADIUS = .45;
/** Authored turn clips: nominal angle and how far the runtime may stretch or shrink that angle before it chains another turn. */
const TURN_CLIPS = [{ name: '45', angle: Math.PI / 4, scale: [.12, 1.35] }, { name: '90', angle: Math.PI / 2, scale: [.6, 1.5] }];
/** Eyelid caps close over the eyeballs by these angles about the eye's lateral axis (upper lid down, lower lid up). */
const LID_CLOSE_UPPER = 1.30, LID_CLOSE_LOWER = .72;
/** Heading Blue settles into on the cushion, so the lying pose reads from the frontal hall camera. */
const REST_YAW = .95;
const REST_FORWARD = new THREE.Vector3(Math.sin(REST_YAW), 0, Math.cos(REST_YAW));
const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, 1);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const step = (x: number, a: number, b: number) => THREE.MathUtils.smoothstep(x, a, b);
const flat = (a: THREE.Vector3, b: THREE.Vector3) => Math.hypot(a.x - b.x, a.z - b.z);
const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
/** Rotation vector (axis × angle, shortest arc) of a unit quaternion, and back. */
const toRotVec = (q: THREE.Quaternion, out: THREE.Vector3) => {
  let { x, y, z, w } = q;
  if (w < 0) { x = -x; y = -y; z = -z; w = -w; }
  const sin = Math.sqrt(Math.max(0, 1 - w * w));
  if (sin < 1e-6) return out.set(0, 0, 0);
  const angle = 2 * Math.acos(Math.min(1, w));
  return out.set(x, y, z).multiplyScalar(angle / sin);
};
const fromRotVec = (v: THREE.Vector3, out: THREE.Quaternion) => {
  const angle = v.length();
  if (angle < 1e-8) return out.set(0, 0, 0, 1);
  return out.setFromAxisAngle(tmpAxis.copy(v).divideScalar(angle), angle);
};
const tmpAxis = new THREE.Vector3();
/** Critically damped decay of an offset and its velocity towards zero (Bollo's inertialization curve). */
const decayCritical = (x: THREE.Vector3, v: THREE.Vector3, settle: number, dt: number) => {
  const omega = 4 / Math.max(settle, 1e-4), e = Math.exp(-omega * dt);
  const j1x = v.x + x.x * omega, j1y = v.y + x.y * omega, j1z = v.z + x.z * omega;
  x.set((x.x + j1x * dt) * e, (x.y + j1y * dt) * e, (x.z + j1z * dt) * e);
  v.set((v.x - j1x * omega * dt) * e, (v.y - j1y * omega * dt) * e, (v.z - j1z * omega * dt) * e);
};
/** Settle time of an inertialized interrupt and the rest transitions that keep their long crossfades instead. */
const INERTIA_SETTLE = .22;
const SOFT: Mood[] = ['settle', 'sleep', 'wake', 'sit', 'sitidle', 'sitarch', 'perch', 'perchidle'];
/** Spring lag per tail bone (stiffness falls towards the tip) and for the ears; damping ratio below 1 leaves a little overshoot. */
const TAIL_SPRING = [{ k: 420, zeta: .75 }, { k: 260, zeta: .65 }, { k: 170, zeta: .6 }, { k: 110, zeta: .55 }, { k: 75, zeta: .5 }];
const EAR_SPRING = { k: 520, zeta: .5 };

/** Blue has his own clock: navigation and tab pauses never advance his route. */
export class BlueCat {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  private model: THREE.Object3D;
  private mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private idle: THREE.AnimationAction;
  private walk: THREE.AnimationAction;
  private trot?: THREE.AnimationAction;
  private trotMix = 0;
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
  /** Playback rate of the current turn clip: small adjustments play fast, wide turns a little slower. */
  private turnRate = 1;
  private afterTurn: AfterTurn = 'walk';
  private planChanged = false;
  private yawRate = 0;
  private lastYaw = 0;
  /** Asleep in the bed until the visitor does something: hovers on him, pets him or picks a station. */
  private undisturbed = true;
  private hoverSince = -Infinity;
  private flick?: THREE.AnimationAction;
  private regions: [THREE.Object3D, Region][] = [];
  private purr = 0;
  private forward = new THREE.Vector3();
  private heading = new THREE.Vector3();
  private targetRotation = new THREE.Quaternion();
  private projection = new THREE.Vector3();
  private bounds = new THREE.Box3();
  private button: HTMLButtonElement;
  private eyelids: THREE.Mesh[] = [];
  /** Separate eyeball meshes under the head bone: they sink into the head a little as the lids close over them. */
  private eyeballs: { node: THREE.Object3D; rest: THREE.Vector3; axis: THREE.Vector3 }[] = [];
  /**
   * Eyelid caps hinged on each eye's lateral axis; `close` is the signed angle at a full blink. The packer's
   * quantization recentres every mesh and moves the offset onto its node, so a cap's node origin is the cap's own
   * bounding-box centre, not the eye's: the lid is rotated rigidly about the eyeball's rest position instead.
   */
  private lids: { node: THREE.Object3D; rest: THREE.Quaternion; restPos: THREE.Vector3; centre: THREE.Vector3; close: number }[] = [];
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
  /** Post-mixer pose pipeline: every bone's inertial offset and velocity, last two written poses, and spring states. */
  private bones: THREE.Object3D[] = [];
  private inertia = new Map<THREE.Object3D, { offset: THREE.Vector3; velocity: THREE.Vector3; last: THREE.Quaternion; before: THREE.Quaternion }>();
  private inertiaActive = false;
  private pendingInertia = false;
  private lastDt = 1 / 60;
  private springs = new Map<THREE.Object3D, { current: THREE.Quaternion; velocity: THREE.Vector3; k: number; c: number; index: number }>();
  private tail: THREE.Object3D[] = [];
  private lastPosition = new THREE.Vector3();
  private bodyVelocity = new THREE.Vector3();
  private bodyAccel = new THREE.Vector3();
  private earKick = 0;
  private tmpV2 = new THREE.Vector3();
  private tmpQ3 = new THREE.Quaternion();
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
    const fur = this.furGrain();
    gltf.scene.traverse(node => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (mesh.morphTargetDictionary?.BlueBlink !== undefined) this.eyelids.push(mesh);
      mesh.frustumCulled = false; // Rest-pose bounds exclude the moving tail and paws.
      for (const mat of (Array.isArray(mesh.material) ? mesh.material : [mesh.material])) {
        const m = mat as THREE.MeshPhysicalMaterial;
        // Three materials: the eyeballs (glossy, coated), the face (keeps its cleaned sculpt normal map) and the
        // body coat (even black with the tiled fur grain).
        const eyes = /amber/i.test(m.name), face = /face/i.test(m.name);
        m.metalness = 0;
        m.roughness = eyes ? .2 : face ? .8 : .82;
        m.envMapIntensity = eyes ? 1.0 : .9;
        if (eyes) {
          m.clearcoat = 1; m.clearcoatRoughness = .12;
        } else if (face) {
          m.normalScale.set(.85, .85);
        } else {
          m.normalMap = fur;
          m.normalScale.set(.32, .32);
        }
        if (m.isMeshPhysicalMaterial) {
          m.sheen = eyes ? 0 : face ? .55 : .7;
          m.sheenRoughness = .62;
          m.sheenColor.setRGB(.40, .37, .48);
          m.specularIntensity = eyes ? 1 : .32;
        }
        m.needsUpdate = true;
        for (const value of Object.values(m)) if (value instanceof THREE.Texture) { value.anisotropy = 8; this.textures.add(value); }
      }
    });
    // GLTFLoader sanitizes node names (dots are dropped), so Blender's `Eye.L` arrives as `EyeL`; look for both.
    const named = (name: string) => gltf.scene.getObjectByName(name) ?? gltf.scene.getObjectByName(name.replace(/\./g, ''));
    for (const name of ['Eye.L', 'Eye.R']) {
      const node = named(name);
      if (node) this.eyeballs.push({ node, rest: node.position.clone(), axis: new THREE.Vector3(0, 0, 1).applyQuaternion(node.quaternion).normalize() });
    }
    for (const [name, close] of [['Lid.U.L', LID_CLOSE_UPPER], ['Lid.U.R', LID_CLOSE_UPPER], ['Lid.D.L', -LID_CLOSE_LOWER], ['Lid.D.R', -LID_CLOSE_LOWER]] as [string, number][]) {
      const node = named(name), eye = this.eyeballs[name.endsWith('L') ? 0 : 1];
      if (node && eye) this.lids.push({ node, rest: node.quaternion.clone(), restPos: node.position.clone(), centre: eye.rest.clone(), close });
    }
    this.neck = gltf.scene.getObjectByName('Neck');
    this.head = gltf.scene.getObjectByName('Head');
    this.chest = gltf.scene.getObjectByName('Chest');
    for (const name of ['EarL', 'EarR', 'Ear.L', 'Ear.R']) {
      const ear = gltf.scene.getObjectByName(name);
      if (ear) this.ears.push(ear);
    }
    gltf.scene.traverse(node => { if ((node as THREE.Bone).isBone) this.bones.push(node); });
    for (const bone of this.bones) {
      this.baseQuat.set(bone, [bone.quaternion.clone(), bone.quaternion.clone()]);
      this.inertia.set(bone, { offset: new THREE.Vector3(), velocity: new THREE.Vector3(), last: bone.quaternion.clone(), before: bone.quaternion.clone() });
    }
    for (let i = 1; i <= 5; i++) {
      const bone = gltf.scene.getObjectByName(`Tail${i}`);
      if (!bone) continue;
      this.tail.push(bone);
      const { k, zeta } = TAIL_SPRING[i - 1];
      this.springs.set(bone, { current: bone.quaternion.clone(), velocity: new THREE.Vector3(), k, c: 2 * Math.sqrt(k) * zeta, index: i });
    }
    for (const ear of this.ears) this.springs.set(ear, { current: ear.quaternion.clone(), velocity: new THREE.Vector3(), k: EAR_SPRING.k, c: 2 * Math.sqrt(EAR_SPRING.k) * EAR_SPRING.zeta, index: 0 });
    this.lastPosition.copy(this.body.position);
    this.mixer = new THREE.AnimationMixer(gltf.scene);
    for (const clip of gltf.animations) {
      if (clip.name.startsWith('turn')) this.turnYaw.set(clip.name, this.extractRootYaw(clip));
      if (clip.name.startsWith('jump')) this.jumpMove.set(clip.name, this.extractRootMove(clip));
      // The tail flick plays on top of whatever pose he is in, so it is stored relative to its own first frame.
      if (clip.name === 'flick') THREE.AnimationUtils.makeClipAdditive(clip, 0, clip);
      this.actions.set(clip.name, this.mixer.clipAction(clip));
    }
    this.idle = this.actions.get('idle')!;
    this.walk = this.actions.get('walk')!;
    this.trot = this.actions.get('trot');
    if (this.trot) { this.trot.play(); this.trot.setEffectiveWeight(0); }
    this.flick = this.actions.get('flick');
    if (this.flick) { this.flick.setLoop(THREE.LoopOnce, 1); this.flick.clampWhenFinished = false; }
    for (const [name, region] of [['Head', 'head'], ['Neck', 'head'], ['Chest', 'back'], ['Spine', 'back'], ['Pelvis', 'back'], ['Tail2', 'tail'], ['Tail3', 'tail'], ['Tail4', 'tail'], ['Tail5', 'tail']] as [string, Region][]) {
      const bone = gltf.scene.getObjectByName(name);
      if (bone) this.regions.push([bone, region]);
    }
    this.idle.play();
    this.walk.play();
    this.walk.setEffectiveWeight(0);
    this.startAsleep();
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

  /** Blue starts the visit asleep in his bed and only gets up once the visitor does something. */
  private startAsleep() {
    const sleep = this.actions.get('sleep');
    if (!sleep) return;
    this.mood = 'sleep'; this.age = 0; this.dwell = Infinity; this.undisturbed = true;
    this.visits = 0; this.plannedVisits = 2 + Math.floor(Math.random() * 3);
    sleep.reset().setLoop(THREE.LoopRepeat, Infinity).play(); sleep.setEffectiveWeight(1);
    this.layer = sleep; this.loco = 0; this.idle.setEffectiveWeight(0);
    this.blink = 1; this.ground = 1; this.faceYaw = REST_YAW;
  }

  /** Something happened: a sleeping cat wakes up (and stays awake for a while). */
  disturb() {
    this.undisturbed = false;
    if (this.mood === 'sleep') { this.dwell = 0; this.enter('wake'); }
  }

  /** Which part of Blue a pointer hit landed on, by the nearest of a few bones. */
  private region(hit: THREE.Intersection | null): Region {
    if (!hit) return 'head';
    let best: Region = 'back', bestDistance = Infinity;
    for (const [bone, region] of this.regions) {
      bone.getWorldPosition(this.tmpV);
      const distance = this.tmpV.distanceTo(hit.point);
      if (distance < bestDistance) { bestDistance = distance; best = region; }
    }
    return best;
  }

  private length(name: string) {
    return this.actions.get(name)?.getClip().duration ?? 1;
  }

  /**
   * Fine fur grain as a tiling tangent-space normal map: two octaves of hashed noise, stretched 2:1 so it reads as
   * hair rather than sand, converted to normals from its gradients. Tiled seven times over the atlas.
   */
  private furGrain() {
    const size = 256, canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!, image = ctx.createImageData(size, size);
    const hash = (x: number, y: number, seed: number) => { const v = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453; return v - Math.floor(v); };
    const smooth = (t: number) => t * t * (3 - 2 * t);
    const noise = (x: number, y: number, seed: number) => {
      const x0 = Math.floor(x), y0 = Math.floor(y), fx = smooth(x - x0), fy = smooth(y - y0);
      const wrap = (v: number, n: number) => ((v % n) + n) % n;
      const a = hash(wrap(x0, size), wrap(y0, size), seed), b = hash(wrap(x0 + 1, size), wrap(y0, size), seed);
      const c = hash(wrap(x0, size), wrap(y0 + 1, size), seed), d = hash(wrap(x0 + 1, size), wrap(y0 + 1, size), seed);
      return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    };
    const height = new Float32Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      // Stretched along y so the grain reads as strands; two octaves keep it from looking like a grid.
      height[y * size + x] = noise(x * .3, y * .1, 1) * .7 + noise(x * .7, y * .24, 2) * .3;
    }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const at = (dx: number, dy: number) => height[((y + dy + size) % size) * size + (x + dx + size) % size];
      const gx = (at(1, 0) - at(-1, 0)) * 1.4, gy = (at(0, 1) - at(0, -1)) * 1.4;
      const length = Math.hypot(gx, gy, 1), i = (y * size + x) * 4;
      image.data[i] = Math.round((-gx / length * .5 + .5) * 255);
      image.data[i + 1] = Math.round((-gy / length * .5 + .5) * 255);
      image.data[i + 2] = Math.round((1 / length * .5 + .5) * 255);
      image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(7, 7);
    texture.anisotropy = 8;
    this.textures.add(texture);
    return texture;
  }

  private makeBasket() {
    const basket = new THREE.Group();
    basket.name = 'Blue-basket';
    // The bed lies along Blue's resting heading, its centre a little behind his body origin, with a low lip at the
    // front so the sphinx paws and the head rest on it instead of poking through a bolster.
    basket.position.copy(HOME).addScaledVector(REST_FORWARD, -BED.back);
    basket.rotation.y = REST_YAW;
    const superellipse = (a: number, b: number, angle: number) => {
      const c = Math.cos(angle), sn = Math.sin(angle);
      return new THREE.Vector2(a * Math.sign(c) * Math.pow(Math.abs(c), 2 / BED.n), b * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / BED.n));
    };
    const grid = (nu: number, nv: number, closedU: boolean, at: (u: number, v: number) => [number, number, number, number, number]) => {
      const vertices: number[] = [], uvs: number[] = [], indices: number[] = [];
      const cols = closedU ? nu : nu + 1;
      for (let i = 0; i < cols; i++) for (let j = 0; j <= nv; j++) {
        const [x, y, z, s, t] = at(i / nu, j / nv);
        vertices.push(x, y, z); uvs.push(s, t);
      }
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
        const a = i * (nv + 1) + j, b = ((i + 1) % cols) * (nv + 1) + j;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices); geometry.computeVertexNormals();
      return geometry;
    };
    const canvasTexture = (size: number, paint: (ctx: CanvasRenderingContext2D) => void, repeatX: number, repeatY: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      paint(canvas.getContext('2d')!);
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(repeatX, repeatY);
      this.textures.add(texture);
      return texture;
    };
    const weave = canvasTexture(32, ctx => {
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        const thread = ((x >> 2) + (y >> 2)) % 2 ? Math.sin(x * Math.PI / 4) : Math.sin(y * Math.PI / 4);
        const value = Math.round(128 + thread * 22);
        ctx.fillStyle = `rgb(${value},${value},${value})`; ctx.fillRect(x, y, 1, 1);
      }
    }, 40, 6);
    const quilt = canvasTexture(128, ctx => {
      ctx.fillStyle = 'rgb(128,128,128)'; ctx.fillRect(0, 0, 128, 128);
      ctx.strokeStyle = 'rgba(70,70,70,.9)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let k = -128; k <= 256; k += 64) {
        ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k + 128, 128); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(k + 128, 0); ctx.lineTo(k, 128); ctx.stroke();
      }
      // Soft puff between the seams: a pale centre in every diamond.
      for (let y = 0; y < 128; y += 64) for (let x = 0; x < 128; x += 64) {
        const g = ctx.createRadialGradient(x + 32, y + 32, 2, x + 32, y + 32, 30);
        g.addColorStop(0, 'rgba(180,180,180,.55)'); g.addColorStop(1, 'rgba(128,128,128,0)');
        ctx.fillStyle = g; ctx.fillRect(x, y, 64, 64);
      }
    }, 4, 5.5);
    const velvet = new THREE.MeshPhysicalMaterial({ color: '#4a4157', roughness: .85, sheen: .6, sheenRoughness: .55, sheenColor: new THREE.Color('#9d8fb8'), bumpMap: weave, bumpScale: .0012 });
    const piping = new THREE.MeshStandardMaterial({ color: '#8f86a3', roughness: .55 });
    const cushionMaterial = new THREE.MeshPhysicalMaterial({ color: '#645c78', roughness: .92, sheen: .35, sheenColor: new THREE.Color('#b7aacf'), bumpMap: quilt, bumpScale: .0035 });
    const base = new THREE.MeshStandardMaterial({ color: '#2b2733', roughness: .95 });
    // The bolster narrows and sinks towards the front lip (local +z is Blue's forward).
    const lip = (z: number) => step(z / (BED.z + BED.tube), .35, .97);
    const bolster = grid(96, 18, true, (u, v) => {
      const angle = u * Math.PI * 2, theta = v * Math.PI * 2;
      const centre = superellipse(BED.x + BED.tube, BED.z + BED.tube, angle);
      const out = centre.clone().normalize();
      const r = BED.tube * (1 - lip(centre.y) * .5);
      return [centre.x + Math.cos(theta) * r * out.x, BED.base + r + Math.sin(theta) * r, centre.y + Math.cos(theta) * r * out.y, u * 12, v];
    });
    basket.add(new THREE.Mesh(bolster, velvet));
    const seam = grid(96, 8, true, (u, v) => {
      const angle = u * Math.PI * 2, theta = v * Math.PI * 2;
      const centre = superellipse(BED.x + BED.tube, BED.z + BED.tube, angle);
      const out = centre.clone().normalize();
      const r = BED.tube * (1 - lip(centre.y) * .5), rope = .0055;
      return [centre.x + Math.cos(theta) * rope * out.x, BED.base + 2 * r - .003 + Math.sin(theta) * rope, centre.y + Math.cos(theta) * rope * out.y, u, v];
    });
    basket.add(new THREE.Mesh(seam, piping));
    // Quilted cushion: a slab whose top dips towards the middle so the cat sinks in a little.
    const cushion = grid(64, 10, true, (u, v) => {
      const angle = u * Math.PI * 2, radial = v;
      const edge = superellipse(BED.x + .012, BED.z + .012, angle);
      const x = edge.x * radial, z = edge.y * radial;
      const top = BED.base + BED.cushion - .012 * (1 - step(radial, .2, .9)) - .02 * step(radial, .93, 1);
      return [x, top, z, x / (2 * BED.x) + .5, z / (2 * BED.z) + .5];
    });
    basket.add(new THREE.Mesh(cushion, cushionMaterial));
    const outline = new THREE.Shape();
    for (let i = 0; i <= 96; i++) {
      const point = superellipse(BED.x + 2 * BED.tube + .008, BED.z + 2 * BED.tube + .008, i / 96 * Math.PI * 2);
      if (i === 0) outline.moveTo(point.x, -point.y); else outline.lineTo(point.x, -point.y);
    }
    const plinth = new THREE.Mesh(new THREE.ExtrudeGeometry(outline, { depth: BED.base, bevelEnabled: true, bevelThickness: .006, bevelSize: .006, bevelSegments: 3 }), base);
    plinth.rotation.x = -Math.PI / 2;
    basket.add(plinth);
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
    // Interrupts switch in one frame and carry the outgoing pose and velocity over as a decaying offset (the
    // inertializer needs the whole jump at once); the slow rest transitions keep their crossfades.
    const instant = !(SOFT.includes(previous) && SOFT.includes(mood));
    if (instant) this.pendingInertia = true;
    if (this.layer) {
      if (instant) { this.layer.setEffectiveWeight(0); this.layer.stop(); }
      else this.layer.fadeOut(this.fade);
    }
    if (next) {
      next.reset();
      const once = mood !== 'sleep' && mood !== 'sitidle' && mood !== 'perchidle' && mood !== 'happy';
      next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
      next.clampWhenFinished = true;
      next.setEffectiveTimeScale(1);
      next.play();
      if (instant) next.setEffectiveWeight(1); else next.fadeIn(this.fade);
    }
    if (instant) this.loco = next ? 0 : 1;
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
    // A 10° adjustment is two quick steps, a 130° turn a little longer than the authored 90°.
    this.turnRate = THREE.MathUtils.clamp(1 / Math.sqrt(this.turnScale), .85, 2);
    this.turnClip = `turn${error > 0 ? 'L' : 'R'}${pick.name}`;
    this.turnApplied = 0;
    this.afterTurn = then;
    this.speed = 0;
    this.enter('turn');
    this.layer?.setEffectiveTimeScale(this.turnRate);
  }

  /** Clip time of the running turn (the clip may play faster than real time). */
  private get turnTime() { return Math.min(this.age * this.turnRate, this.length(this.turnClip)); }

  /** Apply this frame's slice of the turn clip's root yaw to the body. */
  private applyTurn() {
    const yaw = (this.turnYaw.get(this.turnClip) ?? (() => 0))(this.turnTime) * this.turnScale;
    this.body.rotateY(yaw - this.turnApplied);
    this.turnApplied = yaw;
  }

  /**
   * Touch reactions by body part: the head gets the purr (lean in, slow blink), the back an arched stretch when he
   * is standing or a lean when he sits or lies, the tail a lash with the ears back on top of any pose.
   */
  readonly pet = (arg?: Event | THREE.Intersection) => {
    const hit = arg && 'point' in arg ? arg : null;
    if (arg && !hit) (arg as Event).stopPropagation();
    if (!this.root.visible) return;
    if (this.mood === 'jump' || this.mood === 'stand' || this.mood === 'unperch') return;
    const region = this.region(hit);
    this.undisturbed = false;
    if (region === 'tail') {
      if (this.flick) this.flick.reset().play();
      this.slowBlink = 0;
    } else if (region === 'back' && (this.mood === 'sit' || this.mood === 'sitidle')) {
      // A stroke along the back while seated: the back rounds up into the hand.
      this.enter('sitarch');
    } else if (this.mood === 'perch' || this.mood === 'perchidle' || this.mood === 'sit' || this.mood === 'sitidle' || this.mood === 'sitarch') {
      // Seated or on the ledge Blue answers with closed eyes and a head push instead of standing up.
      this.purr = 2.6;
      this.slowBlink = 1;
    } else if (this.mood === 'settle' || this.mood === 'sleep') { this.dwell = 0; this.enter('wake'); this.pendingHappy = true; }
    else if (this.mood === 'wake') this.pendingHappy = true;
    else if (region === 'back' && (this.mood === 'idle' || this.mood === 'walk' || this.mood === 'happy')) this.enter('arch');
    else if (this.mood !== 'arch') this.enter('happy');
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
    if (hover && !this.hover) { this.slowBlink = 1; this.hoverSince = this.clock; }
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
    this.undisturbed = false;
    if (this.mood === 'sleep') this.dwell = 0;
    if (plan.kind === 'station') this.spotSide = this.body.position.x > stationX[plan.index] - stationX[0] ? 1 : -1;
    if (reduce) { this.snap(stationX); return; }
    switch (this.mood) {
      case 'happy': case 'arch': case 'jump': case 'stand': case 'unperch': case 'wake': return; // finish, then resume
      case 'turn': this.planChanged = true; return;
      case 'perch': case 'perchidle': if (plan.kind !== 'perch') this.enter('unperch'); return;
      case 'sit': case 'sitidle': case 'sitarch': if (plan.kind !== 'station' || flat(this.body.position, this.stationSpot(plan.index, stationX)) > .04) this.enter('stand'); return;
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
    else { this.elevation = 0; this.body.position.copy(HOME); this.body.rotation.y = REST_YAW; this.enter('sleep'); this.dwell = Infinity; }
    const current: THREE.AnimationAction | undefined = this.layer;
    if (current) { current.fadeIn(0); current.setEffectiveWeight(1); this.loco = 0; }
  }

  /** Continue the current plan from wherever Blue is. */
  private resume(stationX: number[]) {
    const plan = this.plan, at = this.body.position;
    const takeoff = this.local(LEDGE.takeoff), spot = this.local(LEDGE.spot);
    if (this.elevation > 0) {
      if (plan.kind !== 'perch') return this.startJump(at, takeoff, false);
      if (flat(at, spot) < .03) { this.goal.copy(spot); this.arrival = 'perch'; return this.arrive(stationX); }
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
    // Far goals are trotted to; nobody gets teleported.
    if (this.elevation === 0 && flat(goal, this.body.position) > FAR_DISTANCE) this.travelSpeed = RUN_SPEED;
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
      case 'sit': case 'sitarch': this.enter('sitidle'); break;
      case 'stand': this.enter('idle'); this.resume(stationX); break;
      case 'perch': this.enter('perchidle'); break;
      case 'unperch': this.enter('idle'); this.resume(stationX); break;
      case 'jump': this.elevation = this.jumpTo.y; this.body.position.copy(this.jumpTo); this.earKick = 1; this.enter('idle'); this.resume(stationX); break;
      case 'happy': case 'arch': this.enter('idle'); this.resume(stationX); break;
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
    const running = this.travelSpeed >= RUN_SPEED;
    const accel = running ? .9 : this.travelSpeed > ROAM_SPEED ? .42 : .28, decel = running ? 1.0 : this.travelSpeed > ROAM_SPEED ? .5 : .36;
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
    const awake = this.mood === 'idle' || this.mood === 'walk' || this.mood === 'sitidle' || this.mood === 'sitarch' || this.mood === 'perchidle' || this.mood === 'sit' || this.mood === 'arch';
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
    // Being petted: the head pushes up into the hand and rolls into it, the chest leans along; big enough to read at hall size.
    const petted = this.purr > 0 ? Math.sin(Math.min(1, this.purr / 2.6) * Math.PI) : 0;
    const push = .28 * petted, tilt = .18 * petted;
    // From the ledge the camera sits only a few degrees below him; tuck the chin so the look-down reads.
    const ledgeBias = this.mood === 'perchidle' ? .22 * this.gazeWeight : 0;
    // Curving while walking: the chest rolls into the turn and the head looks along the path ahead of the body.
    const curve = reduce || this.mood !== 'walk' ? 0 : THREE.MathUtils.clamp(this.yawRate, -1.2, 1.2);
    const lead = curve * .22;
    const yaw = this.gazeYaw * this.gazeWeight + lead, pitch = this.gazePitch * this.gazeWeight - push - ledgeBias;
    this.overlay(this.chest, curve * .04, -push * .25, -curve * .05 + tilt * .3);
    this.overlay(this.neck, yaw * .38, -pitch * .35, tilt * .3);
    this.overlay(this.head, yaw * .62, -pitch * .65, tilt);
    const earBack = this.purr > 0 ? .28 : 0;
    for (const ear of this.ears) this.overlay(ear, 0, -this.perk * .22 + earBack, ear === this.ears[0] ? this.perk * .06 : -this.perk * .06);
  }

  /** Additive rotation in bone space (X pitch, Y yaw, Z roll) on the working pose. */
  private overlay(bone: THREE.Object3D | undefined, yaw: number, pitch: number, roll: number) {
    if (!bone) return;
    this.tmpQ.setFromAxisAngle(UP, yaw);
    this.tmpQ2.setFromAxisAngle(FORWARD, roll);
    this.tmpQ.multiply(this.tmpQ2);
    this.tmpQ2.set(Math.sin(pitch / 2), 0, 0, Math.cos(pitch / 2));
    bone.quaternion.multiply(this.tmpQ.multiply(this.tmpQ2));
  }

  /* ---------- post-mixer pose pipeline ---------- */

  /**
   * After the mixer: recover the mixer's pose for every bone (bones a clip does not key keep last frame's mixer
   * value, not what we wrote), carry an interrupted pose over with a decaying offset, spring-lag the tail and
   * ears, then the attention overlays, then remember what was written.
   */
  private pose(dt: number, camera: THREE.Camera, reduce: boolean) {
    for (const bone of this.bones) {
      const [base, applied] = this.baseQuat.get(bone)!;
      if (bone.quaternion.equals(applied)) bone.quaternion.copy(base); else base.copy(bone.quaternion);
    }
    const step = Math.min(dt, 1 / 30);
    if (!reduce) {
      this.inertialize(step);
      this.secondary(step);
    }
    this.attend(dt, camera, reduce);
    for (const bone of this.bones) {
      const state = this.inertia.get(bone)!;
      state.before.copy(state.last); state.last.copy(bone.quaternion);
      this.baseQuat.get(bone)![1].copy(bone.quaternion);
    }
    this.lastDt = Math.max(dt, 1e-4);
  }

  /** Inertialization: on a switch, the offset from the new pose back to the old one (and its velocity) decays to zero. */
  private inertialize(dt: number) {
    if (this.pendingInertia) {
      this.pendingInertia = false; this.inertiaActive = true;
      for (const bone of this.bones) {
        const state = this.inertia.get(bone)!;
        // offset: rotation from the mixer's new pose to the pose we last showed; velocity: how that shown pose was moving.
        this.tmpQ.copy(state.last).multiply(this.tmpQ2.copy(bone.quaternion).invert());
        toRotVec(this.tmpQ, state.offset);
        this.tmpQ.copy(state.last).multiply(this.tmpQ2.copy(state.before).invert());
        toRotVec(this.tmpQ, state.velocity).divideScalar(this.lastDt);
        state.velocity.clampLength(0, 12);
      }
    }
    if (!this.inertiaActive) return;
    let remaining = 0;
    for (const bone of this.bones) {
      const state = this.inertia.get(bone)!;
      decayCritical(state.offset, state.velocity, INERTIA_SETTLE, dt);
      const size = state.offset.lengthSq();
      if (size < 1e-8) continue;
      remaining += size;
      bone.quaternion.premultiply(fromRotVec(state.offset, this.tmpQ));
    }
    if (remaining === 0) this.inertiaActive = false;
  }

  /** Tail and ears follow their authored pose through springs and react to how the body moves. */
  private secondary(dt: number) {
    // Body motion in Blue's own frame: forward acceleration pulls the tail back and down, turning swings it outward.
    const forwardAccel = this.bodyAccel.dot(this.heading.copy(FORWARD).applyQuaternion(this.body.quaternion));
    const lateralAccel = this.bodyAccel.dot(this.tmpV2.set(this.heading.z, 0, -this.heading.x));
    const yawRate = this.yawRate;
    const substeps = 2, h = dt / substeps;
    for (const [bone, spring] of this.springs) {
      const target = bone.quaternion;
      if (dt > .2) { spring.current.copy(target); spring.velocity.set(0, 0, 0); continue; }
      const tailWeight = spring.index ? Math.max(0, 1 - (spring.index - 1) * .3) : 0;
      for (let i = 0; i < substeps; i++) {
        // Rotation from the current spring pose to the mixer's target, expressed in the parent frame.
        this.tmpQ.copy(target).multiply(this.tmpQ2.copy(spring.current).invert());
        toRotVec(this.tmpQ, this.tmpV);
        const a = this.tmpV.multiplyScalar(spring.k).addScaledVector(spring.velocity, -spring.c);
        if (tailWeight > 0) {
          // Deflections the body motion asks for, as torques in the bone's own frame, rotated into the parent frame.
          this.tmpV2.set(THREE.MathUtils.clamp(-forwardAccel * .12, -.35, .35), THREE.MathUtils.clamp(yawRate * .28 - lateralAccel * .1, -.45, .45), 0)
            .multiplyScalar(spring.k * tailWeight).applyQuaternion(spring.current);
          a.add(this.tmpV2);
        } else if (this.earKick > 0) {
          this.tmpV2.set(7 * this.earKick, 0, 0).applyQuaternion(spring.current);
          spring.velocity.add(this.tmpV2);
        }
        spring.velocity.addScaledVector(a, h);
        spring.current.premultiply(fromRotVec(this.tmpV.copy(spring.velocity).multiplyScalar(h), this.tmpQ3)).normalize();
      }
      bone.quaternion.copy(spring.current);
    }
    this.earKick = 0;
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
        case 'turn': if (this.age * this.turnRate > this.length(this.turnClip)) this.advance(stationX); else this.applyTurn(); break;
        case 'sitarch': if (this.age > this.length('sitarch')) this.advance(stationX); break;
        case 'sleep':
          if (this.undisturbed && this.hover && this.clock - this.hoverSince > .35) this.disturb();
          else if (this.age > this.dwell) { if (this.plan.kind === 'station') this.enter('sitidle'); else this.enter('wake'); }
          break;
        case 'arch': if (this.age > this.length('arch')) this.advance(stationX); break;
        case 'wake': if (this.age > this.length('wake')) this.advance(stationX); break;
        case 'sit': if (this.age > this.length('sit')) this.advance(stationX); break;
        case 'sitidle': if (this.age > this.dwell) this.enter('sleep'); break;
        case 'stand': if (this.age > this.length('stand')) this.advance(stationX); break;
        case 'perch': if (this.age > this.length('perch')) this.advance(stationX); break;
        case 'unperch': if (this.age > this.length('unperch')) this.advance(stationX); break;
        case 'jump': if (this.age > this.length(this.jumpClip)) this.advance(stationX); else this.fly(); break;
      }
    }
    // A petted cat never spins towards the visitor: the head overlay does the looking.
    if (this.mood === 'happy' && this.age > 5) this.advance(stationX);
    // Settling clips absorb the small remainder the turn clip left: onto the cushion, towards the cabinet, or facing the viewer on the ledge.
    if (this.faceYaw !== null && !reduce && (this.mood === 'settle' || this.mood === 'sit' || this.mood === 'perch')) {
      this.targetRotation.setFromAxisAngle(UP, this.faceYaw);
      this.body.quaternion.rotateTowards(this.targetRotation, Math.min(this.body.quaternion.angleTo(this.targetRotation) * 2, .25) * dt);
    }
    // Measured yaw rate (smoothed) drives the lean and head lead while walking a curve.
    this.yawRate = THREE.MathUtils.damp(this.yawRate, wrap(this.yaw - this.lastYaw) / Math.max(dt, 1e-4), 8, dt);
    this.lastYaw = this.yaw;
    if (this.mood !== 'walk') this.speed = Math.max(0, this.speed - .5 * dt);
    this.purr = Math.max(0, this.purr - dt);
    if (reduce && this.mood !== 'happy' && this.mood !== 'sleep' && this.layer && this.plan.kind === 'home') this.enter('idle');
    // Locomotion pair: idle and walk share one layer whose split follows the actual ground speed, so feet never slide.
    const locoGoal = this.layer ? 0 : 1;
    this.loco = THREE.MathUtils.clamp(this.loco + Math.sign(locoGoal - this.loco) * dt / this.fade, 0, 1);
    this.walkMix = THREE.MathUtils.damp(this.walkMix, step(this.speed, .01, .08), 12, dt);
    this.trotMix = this.trot ? THREE.MathUtils.damp(this.trotMix, step(this.speed, .42, .62), 8, dt) : 0;
    this.idle.setEffectiveWeight(this.loco * (1 - this.walkMix));
    this.walk.setEffectiveWeight(this.loco * this.walkMix * (1 - this.trotMix));
    this.walk.setEffectiveTimeScale(Math.min(this.speed, .5) / STRIDE_SPEED);
    if (this.trot) { this.trot.setEffectiveWeight(this.loco * this.walkMix * this.trotMix); this.trot.setEffectiveTimeScale(Math.max(this.speed, .3) / TROT_SPEED); }
    this.mixer.update(reduce && this.mood !== 'happy' ? 0 : dt);
    // Body velocity and (smoothed) acceleration for the secondary motion; a teleport or a long pause resets them.
    this.tmpV.subVectors(this.body.position, this.lastPosition);
    if (this.tmpV.length() > .5 || dt > .2) { this.bodyVelocity.set(0, 0, 0); this.bodyAccel.set(0, 0, 0); }
    else {
      this.tmpV.divideScalar(Math.max(dt, 1e-4));
      this.tmpV2.subVectors(this.tmpV, this.bodyVelocity).divideScalar(Math.max(dt, 1e-4));
      this.bodyAccel.lerp(this.tmpV2, 1 - Math.exp(-10 * dt));
      this.bodyVelocity.copy(this.tmpV);
    }
    this.lastPosition.copy(this.body.position);
    this.pose(dt, camera, reduce);
    // Facial blendshape closes the textured eyes together with the surrounding skin.
    this.blinkAge += dt;
    if (this.blinkAge > this.blinkPeriod) { this.blinkAge = 0; this.blinkPeriod = rand(3.2, 6.5); }
    this.slowBlink = Math.max(0, this.slowBlink - dt / .9);
    const resting = this.mood === 'sleep' || this.mood === 'settle' || this.mood === 'wake';
    // Eyes open in the first half second of waking, well before the body is up.
    const eyeGoal = this.mood === 'wake' ? 1 - step(this.age, .05, .4) : resting ? 1 : this.mood === 'happy' || this.purr > .4 ? .94 : !reduce && (this.blinkAge > this.blinkPeriod - .24 || this.slowBlink > .45) ? 1 : 0;
    this.blink = THREE.MathUtils.damp(this.blink, eyeGoal, this.mood === 'wake' ? 12 : resting || this.slowBlink > 0 || this.purr > 0 ? 7 : 20, dt);
    // Pose-space floor correctives: sphinx rest, upright sit and the ledge perch each keep their underside above the surface.
    const settled = this.mood === 'sleep' ? 1 : this.mood === 'settle' ? step(this.age, .35, 1.5) : this.mood === 'wake' ? 1 - step(this.age, .4, 1.4) : 0;
    const seated = this.mood === 'sitidle' || this.mood === 'sitarch' ? 1 : this.mood === 'sit' ? step(this.age, .15, .75) : this.mood === 'stand' ? 1 - step(this.age, .1, .8) : 0;
    const perched = this.mood === 'perchidle' ? 1 : this.mood === 'perch' ? step(this.age, .4, 1.8) : this.mood === 'unperch' ? 1 - step(this.age, .2, 1.6) : 0;
    this.ground = THREE.MathUtils.damp(this.ground, settled, 14, dt);
    this.seatGround = THREE.MathUtils.damp(this.seatGround, seated, 14, dt);
    this.perchGround = THREE.MathUtils.damp(this.perchGround, perched, 14, dt);
    for (const eye of this.eyeballs) eye.node.position.copy(eye.rest).addScaledVector(eye.axis, -this.blink * .006);
    for (const lid of this.lids) {
      // Hinge about the lid's own lateral axis, then express that rotation in the head frame (rest · hinge · rest⁻¹)
      // and swing the node's origin around the eye centre with it.
      this.tmpQ.setFromAxisAngle(tmpAxis.set(1, 0, 0), this.blink * lid.close);
      lid.node.quaternion.copy(lid.rest).multiply(this.tmpQ);
      this.tmpQ2.copy(lid.node.quaternion).multiply(this.tmpQ3.copy(lid.rest).invert());
      lid.node.position.copy(lid.restPos).sub(lid.centre).applyQuaternion(this.tmpQ2).add(lid.centre);
    }
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
      this.body.position.y = this.elevation + (this.elevation === 0 ? step(.55 - homeDistance, 0, .25) * HOME_LIFT : 0);
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
