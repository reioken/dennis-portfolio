import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BlueToys, TOY_GRAVITY, type CatToy } from './blueToys';

type Mood = 'idle' | 'walk' | 'settle' | 'sleep' | 'wake' | 'happy' | 'arch' | 'sit' | 'sitidle' | 'sitarch' | 'stand' | 'jump' | 'perch' | 'perchidle' | 'unperch' | 'turn' | 'swat' | 'playready' | 'playjump';
type Region = 'head' | 'back' | 'tail';
type AfterTurn = 'walk' | 'arrive' | 'jump';
type Arrival = 'idle' | 'home' | 'sit' | 'jump' | 'perch' | 'settle' | 'toy';
type Plan = { kind: 'home' } | { kind: 'station'; index: number } | { kind: 'perch' };
/** What the hall tells Blue every frame so he can accompany the visitor. */
export interface BlueScene { focus: number; pose: 'hall' | 'zoom' | 'play' | 'screen'; stationX: number[]; inHall: boolean; }

/** Name suffix of the shipped Blue files (`blue-rigged-<build>.glb`, `blue-<build>-closed.webp`, `blue-<build>-mips.webp`).
 * Bump it whenever any of them changes: `/models/*` is edge-cached for a day and the three must come from one build. */
export const BLUE_ASSET_BUILD = 'v6h';
const HOME = new THREE.Vector3(-1.65, 0, .18);
/** Cat bed: inner half-extents across and along Blue, bolster tube radius, superellipse exponent, plinth and cushion heights, centre offset behind the body origin. */
const BED = { x: .20, z: .30, tube: .07, n: 2.7, base: .03, cushion: .06, back: .06 };   // z .30: the front lip sits 31 cm ahead of the resting origin, clear of the standing forepaws
/** How high the cushion carries Blue's body origin at the centre of the bed. */
const HOME_LIFT = .085;
const SPOTS = [new THREE.Vector3(-1.35, 0, .62), new THREE.Vector3(-.8, 0, .76), new THREE.Vector3(-1.95, 0, .6), new THREE.Vector3(-1.1, 0, .42), new THREE.Vector3(-1.55, 0, .76)];
const BOUNDS = { minX: -2.05, maxX: 40, minZ: .12, maxZ: 1.5 };
/** The claw cabinet: top surface, its front edge, where Blue takes off, lands and lies (root-local, station 0 at x 0). */
/** Measured cap edge after claw-v2 (8e82aa7c) is centred by buildKasse. `wrist` is the forewrist reach of the
 * authored sphinx lie (EDGE_Y in blue_animate.py): the elbows rest on the roof behind the edge, the wrists sit on
 * it and only the paws drape over. The tucked hind paws end 40 cm behind the edge, inside the body silhouette. */
const LEDGE = { top: 1.95, edge: .409942, wrist: .371, takeoff: new THREE.Vector3(0, 0, .80) };
/** Where `jumpup` catches the cap edge, as authored in blue_animate.py: at that moment the body origin is .299 m
 * behind the edge and .419 m below the roof (in Blue's own units), which is .1196 of the clip's forward travel and
 * .7851 of its rise. The desktop span is authored 1:1, but a compact layout scales Blue against a fixed cabinet,
 * so the flat per-axis warp would put the forepaws in the air beside the edge; `fly()` anchors this point instead. */
const JUMP_HOOK = { forward: .11958, rise: .78513, behind: .299, below: .419 };
/** Sitting spot at a cabinet: on the lane in front of it, a hand's width off centre towards the side Blue arrives from. */
const WHITE = new THREE.Color(1, 1, 1);
const STATION_LANE_Z = .8, STATION_SIDE_X = .12;
/** Metres per second the in-place walk clip covers at time scale 1 (37 cm stride over a 1.1 s cycle; the roam plays it at 0.62 as a slow prowl). */
const STRIDE_SPEED = .34;
const ROAM_SPEED = .21, TRAVEL_SPEED = .34;
/** Beyond this distance a goal is worth trotting to; the in-place trot clip covers TROT_SPEED at time scale 1. */
const FAR_DISTANCE = 1.5, RUN_SPEED = .9, TROT_SPEED = .9;
/** Errors above 8° use authored steps; smaller residuals ease into the following movement. */
const TURN_MIN = .14, TURN_RADIUS = .45;
/** Beyond this heading error Blue stops and steps around; below it he walks off in an arc instead, the way a cat
 * does when its goal is only a little off its nose (Dennis, 2026-09-20: turns read as rigid). */
const WALK_ARC_MAX = 1.75;
/** Matching root/foot trajectories at useful angles; never warp root yaw independently of planted feet. The 180°
 * pair is the turnaround he plays on the claw machine after landing, in one sweep instead of a 120+60 chain. */
const TURN_CLIPS = [15, 30, 45, 60, 90, 120, 180].map(degrees => ({ name: String(degrees), angle: degrees * Math.PI / 180 }));
/** Eyelid caps close over the eyeballs by these angles about the eye's lateral axis (upper lid down, lower lid up). */
const LID_CLOSE_UPPER = 1.30, LID_CLOSE_LOWER = .72;
/** Heading Blue settles into on the cushion, so the lying pose reads from the frontal hall camera. */
const REST_YAW = .95;
const REST_FORWARD = new THREE.Vector3(Math.sin(REST_YAW), 0, Math.cos(REST_YAW));
/** Where Blue stands on the floor just outside the bed's lowered front lip: the only way in or out. The `bedout`
 * and `bedin` clips carry him between here and HOME with every paw placed over the lip (authored 0.55 m, 0.085 m). */
const BED_EXIT = HOME.clone().addScaledVector(REST_FORWARD, .55);
const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, 1);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const step = (x: number, a: number, b: number) => THREE.MathUtils.smoothstep(x, a, b);
const flat = (a: THREE.Vector3, b: THREE.Vector3) => Math.hypot(a.x - b.x, a.z - b.z);
const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
/** Piecewise-linear remap that sends the authored fraction `a` to `b` and keeps 0 and 1 fixed. */
const anchor = (u: number, a: number, b: number) => (u <= a ? u / a * b : b + (u - a) / (1 - a) * (1 - b));
/** Pet angles ease towards the hand, with a hard angular-speed ceiling even if the target changes every frame. */
const followTouch = (current: number, target: number, dt: number) => current + THREE.MathUtils.clamp(THREE.MathUtils.damp(current, target, 8, dt) - current, -1.2 * dt, 1.2 * dt);
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
  toys?: BlueToys;
  private toy: CatToy | null = null;
  private playUntil = 0;
  private nextPlay = 0;
  private swatted = false;
  private playBeat = 0;
  private playEnergy = 0;
  private playAim = new THREE.Vector3();
  private playFrom = new THREE.Vector3();
  private playTo = new THREE.Vector3();
  private playHeight = 0;
  private playClip = 'pounce';
  private pawSide = 'R';
  private nextLeap = 0;
  private toyContacts = 0;
  private toyCatches = 0;
  private compactPlay = false;
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
  private containerWidth = 0;
  private buttonLeft = '';
  private buttonTop = '';
  private buttonEn: boolean | null = null;
  private dwell = 4;
  private speed = 0;
  private travelSpeed = ROAM_SPEED;
  private goal = HOME.clone();
  private arrival: Arrival = 'idle';
  private visits = 0;
  private plannedVisits = 2;
  private pendingHappy = false;
  private pendingPet: Region | null = null;
  private plan: Plan = { kind: 'home' };
  private spotSide = -1;
  private faceYaw: number | null = null;
  private shift = new THREE.Vector3();
  private scale = 1;
  private elevation = 0;
  /** On the cushion (body origin HOME_LIFT up); leaving means playing `bedout` first. */
  private inBed = false;
  /** What to do once a bed clip (played through the jump machinery) has ended. */
  private afterJump: ((stationX: number[]) => void) | null = null;
  private jumpFrom = new THREE.Vector3();
  private jumpTo = new THREE.Vector3();
  private jumpUp = true;
  private jumpClip = 'jumpup';
  private jumpAir = 0;
  private jumpYaw = 0;
  /** Root motion: yaw curve of each turn clip, displacement curve of each jump clip (authored, before warping). */
  private turnYaw = new Map<string, (t: number) => number>();
  private jumpMove = new Map<string, { at: (t: number) => THREE.Vector3; total: THREE.Vector3 }>();
  private turnClip = '';
  /** Forward/rise fractions at which the real jump has to reach the cap edge, when they differ from the authored ones. */
  private jumpHook: { forward: number; rise: number } | null = null;
  /** A turn clip has just finished: the residual heading error eases into the next clip instead of starting a
   * second turn, which is what made the half turn on the claw machine read as two moves with a pause. */
  private justTurned = false;
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
  private touchRegion: Region = 'head';
  private touchAmount = 0;
  private touchSide = 1;
  private touchPush = 0;
  private touchTilt = 0;
  private touchCurve = 0;
  private touchEar = 0;
  private lastFlick = -Infinity;
  private pickMeshes: THREE.SkinnedMesh[] = [];
  private pickInverse = new THREE.Matrix4();
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
  /** v4/v5: the blink swaps the coat's base colour for a copy with the lids painted shut while the lid morph squashes the eye. */
  private coat?: THREE.MeshPhysicalMaterial;
  private openMap: THREE.Texture | null = null;
  private closedMap: THREE.Texture | null = null;
  /** v6: the painted eye polygons' material (tinted amber) with its own texture; on a blink it shows the closed-eye
   * texture, untinted, while the coat keeps its atlas (the eye sockets there are painted with fur). */
  private eyesMaterial: THREE.MeshPhysicalMaterial | null = null;
  private eyesTint: THREE.Color | null = null;
  private eyesOpenMap: THREE.Texture | null = null;
  /** Resolves once the closed-eye texture and the coat's mip sheet are in (or have failed); the hall waits for it. */
  readonly ready: Promise<void>;
  /**
   * Uploads a pre-built mip chain as the texture's mip levels: the sheet stacks the levels from half the base size
   * down to 1×1 in one column. scripts/models/blue-v6-atlas.mjs separates the eye colours, pads the coat's
   * fragmented UV islands and filters in linear light. The tent filter softens subpixel hair highlights
   * without the majority-island selection and brightness caps that darkened the Phase 18 coat.
   */
  private static async attachMipSheet(texture: THREE.Texture, url: string): Promise<void> {
    try {
      if (typeof createImageBitmap !== 'function') return;
      const blob = await (await fetch(url)).blob();
      const options: ImageBitmapOptions = { colorSpaceConversion: 'none', premultiplyAlpha: 'none' };
      const sheet = await createImageBitmap(blob, options);
      const base = texture.image as (CanvasImageSource & { width: number; height: number }) | null;
      if (!base?.width || sheet.width * 2 !== base.width) { sheet.close(); return; }
      // Firefox's direct ImageBitmap -> WebGL upload blackened whole UV islands.
      // Copy the decoded pixels, including level 0, to independent canvas surfaces.
      // blue-coat.mjs compares the real About frame against this upload reference.
      const copy = (image: CanvasImageSource, width: number, height: number, top = 0) => {
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Blue texture canvas unavailable');
        context.drawImage(image, 0, top, width, height, 0, 0, width, height);
        return canvas;
      };
      const levels = [copy(base, base.width, base.height)];
      for (let w = sheet.width, top = 0; w >= 1; top += w, w >>= 1) levels.push(copy(sheet, w, w, top));
      sheet.close();
      texture.source = new THREE.Source(levels[0]);
      texture.mipmaps = levels as unknown as typeof texture.mipmaps;
      texture.generateMipmaps = false;
      texture.needsUpdate = true;
    } catch { /* the GPU's own chain stays */ }
  }
  private showingClosed = false;
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
  private spine?: THREE.Object3D;
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
    this.body.position.copy(HOME); this.body.position.y = HOME_LIFT; this.elevation = HOME_LIFT; this.inBed = true;
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
    // The asset version comes from the coat material's name (`Blue coat v6`). v6 is the first cat again: the v1 mesh
    // with its original Meshy atlas and painted amber eye polygons, lit the way it was on 2026-09-11.
    const materialNames: string[] = [];
    gltf.scene.traverse(node => { const mesh = node as THREE.Mesh; if (mesh.isMesh) for (const mat of (Array.isArray(mesh.material) ? mesh.material : [mesh.material])) materialNames.push(mat.name); });
    const original = materialNames.some(name => /coat v6/i.test(name));
    gltf.scene.traverse(node => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) this.pickMeshes.push(mesh as THREE.SkinnedMesh);
      if (mesh.morphTargetDictionary?.BlueBlink !== undefined) this.eyelids.push(mesh);
      mesh.frustumCulled = false; // Rest-pose bounds exclude the moving tail and paws.
      for (const mat of (Array.isArray(mesh.material) ? mesh.material : [mesh.material])) {
        const m = mat as THREE.MeshPhysicalMaterial;
        // v4 (one Meshy PBR material) keeps its own maps; v2 had three: the eyeballs (glossy, coated), the face (its
        // cleaned sculpt normal map) and the body coat (even black with the tiled fur grain).
        const v4 = /coat v\d+/i.test(m.name), eyes = /amber/i.test(m.name), face = /face/i.test(m.name);
        m.metalness = 0;
        m.roughness = eyes ? .2 : face ? .8 : .82;
        m.envMapIntensity = eyes ? 1.0 : .9;
        if (original) {
          // v1's runtime treated every material the same: roughness .88, environment .7, no sheen, the atlas as it
          // came from Meshy. The eye polygons carry the amber tint in their material colour; on a blink they show
          // the closed atlas too, with the tint lifted so the painted lids stay fur-coloured.
          if (v4) { this.coat = m; this.openMap = m.map; }
          if (eyes) { this.eyesMaterial = m; this.eyesTint = m.color.clone(); }
          m.roughness = .88;
          m.envMapIntensity = .7;
          m.normalMap = null;
        } else if (v4) {
          // Fur, not plastic: fully matte, the painted fur normal map at full strength, a soft velvet rim, almost no
          // specular and a dim environment reflection.
          this.coat = m; this.openMap = m.map;
          // Meshy's roughness map sits around 0.55 and multiplies the factor, which is where the plastic gloss came
          // from at the About close-up; the coat is uniformly matte instead.
          m.roughnessMap = null; m.metalnessMap = null;
          m.roughness = .94;
          m.envMapIntensity = .3;
          // The Meshy normal map is nearly flat on the stylised mesh; the tiled fur grain gives the surface its hair
          // direction instead (finer than on the old coat, stronger, so it reads at the About close-up).
          fur.repeat.set(14, 14);
          m.normalMap = fur;
          m.normalScale.set(.9, .9);
        } else if (eyes) {
          m.clearcoat = 1; m.clearcoatRoughness = .12;
        } else if (face) {
          m.normalScale.set(.85, .85);
        } else {
          m.normalMap = fur;
          m.normalScale.set(.32, .32);
        }
        if (m.isMeshPhysicalMaterial) {
          m.sheen = original ? .25 : eyes ? 0 : v4 ? .55 : face ? .55 : .7;
          m.sheenRoughness = original ? .8 : v4 ? .85 : .62;
          m.sheenColor.setRGB(.40, .37, .48);
          m.specularIntensity = original ? .3 : eyes ? 1 : v4 ? .08 : .32;
        }
        m.needsUpdate = true;
        for (const value of Object.values(m)) if (value instanceof THREE.Texture) { value.anisotropy = 8; this.textures.add(value); }
      }
    });
    const loads: Promise<unknown>[] = [];
    if (this.coat && this.openMap) {
      // The closed-eye texture has the lids painted shut and shares the glTF UV convention. v4/v5: a copy of the whole
      // coat atlas, named after the material version; v6: the eye polygons' own texture (nothing bright ever sits in
      // the coat atlas), named after the asset build.
      // Older builds derived the file names from the material version; every file that changes content now gets a
      // new name (BLUE_ASSET_BUILD), because /models/* is cached at the edge for a day and a stale GLB with a fresh
      // texture (or the reverse) must never meet.
      const build = original ? BLUE_ASSET_BUILD : this.coat.name.match(/v\d+/)?.[0] ?? 'v4';
      this.eyesOpenMap = this.eyesMaterial?.map && this.eyesMaterial.map !== this.openMap ? this.eyesMaterial.map : null;
      loads.push(new Promise<void>(resolve => new THREE.TextureLoader().load(`/models/blue-${build}-closed.webp`, texture => {
        texture.colorSpace = THREE.SRGBColorSpace; texture.flipY = false; texture.anisotropy = 8;
        this.closedMap = texture; this.textures.add(texture); resolve();
      }, undefined, () => resolve())));
      if (original) loads.push(BlueCat.attachMipSheet(this.openMap, `/models/blue-${build}-mips.webp`));
    }
    this.ready = Promise.all(loads).then(() => undefined);
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
    this.spine = gltf.scene.getObjectByName('Spine');
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
      if (clip.name.startsWith('jump') || clip.name.startsWith('bed')) this.jumpMove.set(clip.name, this.extractRootMove(clip));
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

  /** Use the skin weights of the actual surface hit. In a curl the head and tail bones
   * are neighbours in space; nearest-bone classification confuses their surfaces. */
  private region(hit: THREE.Intersection | null): Region {
    if (!hit) return 'head';
    const mesh = hit.object as THREE.SkinnedMesh;
    const joints = mesh.geometry?.getAttribute('skinIndex'), weights = mesh.geometry?.getAttribute('skinWeight');
    if (mesh.isSkinnedMesh && hit.face && joints && weights) {
      const scores = { head: 0, back: 0, tail: 0 };
      const vertices = [hit.face.a, hit.face.b, hit.face.c];
      const bary = hit.barycoord;
      for (let v = 0; v < 3; v++) for (let k = 0; k < 4; k++) {
        const name = mesh.skeleton.bones[joints.getComponent(vertices[v], k)]?.name ?? '';
        const part: Region = /^(Head|Neck|Ear)/.test(name) ? 'head' : /^Tail/.test(name) ? 'tail' : 'back';
        scores[part] += weights.getComponent(vertices[v], k) * (bary ? bary.getComponent(v) : 1 / 3);
      }
      return scores.head >= scores.back && scores.head >= scores.tail ? 'head' : scores.tail > scores.back ? 'tail' : 'back';
    }
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
    const next = mood === 'idle' || mood === 'walk' ? undefined : this.actions.get(mood === 'turn' ? this.turnClip : mood === 'jump' ? this.jumpClip : mood === 'playjump' ? this.playClip : mood === 'swat' && this.pawSide === 'L' ? 'swatL' : mood);
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
      next.reset().setEffectiveWeight(1);
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
   * Answer a heading error with the closest authored turn. Larger errors chain a
   * second turn; the small remainder eases into the next movement.
   */
  private startTurn(error: number, then: AfterTurn) {
    const magnitude = Math.abs(error);
    // Near-half turns are the turnaround, in one sweep. Everything else takes the single nearest clip and eases the
    // remainder into the next movement; chaining a second turn put a visible hesitation in the middle.
    const pick = magnitude >= 160 * Math.PI / 180 ? TURN_CLIPS[TURN_CLIPS.length - 1]
      // A tie keeps the smaller clip: undershooting and easing the rest into the next move reads far better than
      // turning too far and having to come back.
      : TURN_CLIPS.reduce((best, clip) => Math.abs(clip.angle - magnitude) < Math.abs(best.angle - magnitude) - 1e-6 ? clip : best);
    this.justTurned = false;
    // The authored feet counter-rotate by exactly the authored Root yaw. Warping only
    // the body slid every planted paw; use real small turns and ease the <8° remainder.
    this.turnScale = 1;
    this.turnRate = 1;
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
  readonly pet = (arg?: Event | THREE.Intersection, _stroke = false) => {
    const hit = arg && 'point' in arg ? arg : null;
    if (arg && !hit) (arg as Event).stopPropagation();
    // Pointer input is handled on pointerdown by the hall, with a real ray even on
    // the enlarged touch target. A keyboard click still comes straight here.
    if (arg instanceof MouseEvent && arg.detail > 0) return;
    if (!this.root.visible) return;
    const region = this.region(hit);
    this.touchRegion = region;
    if (hit) {
      this.tmpV.copy(hit.point); this.body.worldToLocal(this.tmpV);
      if (Math.abs(this.tmpV.x) > .008) this.touchSide = Math.sign(this.tmpV.x);
    }
    this.undisturbed = false;
    this.purr = region === 'tail' ? .65 : 1.15;
    // Every touch feeds the soft response. Whole-body clips have their own cadence:
    // rapid input must neither restart them nor cancel a planted step or landing.
    if (this.mood === 'jump' || this.mood === 'playjump' || this.mood === 'playready' || this.mood === 'swat' || this.mood === 'turn' || this.mood === 'walk' || this.mood === 'stand' || this.mood === 'unperch' || this.mood === 'sit' || this.mood === 'perch') {
      // Acknowledge the hand with head/ears without interrupting a mapped path.
    } else if (this.mood === 'settle' || this.mood === 'sleep') {
      this.dwell = 0; this.enter('wake'); this.pendingHappy = true; this.pendingPet = region;
    } else if (this.mood === 'wake') {
      this.pendingHappy = true; this.pendingPet = region;
    } else if (region === 'tail') {
      this.flickTail();
      this.slowBlink = 0;
    } else if (region === 'back' && this.mood === 'sitidle') {
      // A stroke along the back while seated: the back rounds up into the hand.
      this.enter('sitarch');
    } else if (this.mood === 'perchidle' || this.mood === 'sitidle' || this.mood === 'sitarch') {
      // Seated or on the ledge Blue answers with closed eyes and a head push instead of standing up.
      this.slowBlink = 1;
    } else if (region === 'back' && (this.mood === 'idle' || (this.mood === 'happy' && this.age >= 1.4))) this.enter('arch');
    else if (region === 'head' && (this.mood === 'idle' || (this.mood === 'arch' && this.age >= this.length('arch')))) this.enter('happy');
    this.container.dispatchEvent(new CustomEvent('hall:blue-petted', { bubbles: true }));
  };

  /** A new touch may ask for another flick only after the tail has returned and rested. */
  private flickTail() {
    if (!this.flick || this.flick.isRunning() || this.clock - this.lastFlick < this.length('flick') + .35) return;
    this.lastFlick = this.clock;
    this.flick.reset().setEffectiveTimeScale(1).play();
  }

  hit(ray: THREE.Raycaster) {
    if (!this.root.visible) return null;
    this.root.updateWorldMatrix(true, true);
    // SkinnedMesh caches its first box/sphere (often the sleeping pose). Build a
    // conservative broad phase from the animated bones, then intersect the skin.
    // This is 26 points, rather than re-skinning every vertex just for the bounds.
    this.bounds.makeEmpty();
    for (const bone of this.bones) this.bounds.expandByPoint(bone.getWorldPosition(this.tmpV));
    this.bounds.expandByScalar(.20 * this.scale);
    if (!ray.ray.intersectsBox(this.bounds)) return null;
    for (const mesh of this.pickMeshes) {
      this.pickInverse.copy(mesh.matrixWorld).invert();
      (mesh.boundingBox ??= new THREE.Box3()).copy(this.bounds).applyMatrix4(this.pickInverse);
      mesh.boundingBox.getBoundingSphere(mesh.boundingSphere ??= new THREE.Sphere());
    }
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

  private ledgeSpot() {
    // Cabinet dimensions stay fixed while Blue shrinks on phones. Keep his wrists
    // at the same physical edge by moving the body forward by the lost reach.
    return this.local(new THREE.Vector3(0, LEDGE.top, LEDGE.edge - LEDGE.wrist * this.scale));
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
      case 'happy': case 'arch': case 'jump': case 'playjump': case 'swat': case 'playready': case 'stand': case 'unperch': case 'wake': return; // finish, then resume
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
    if (this.plan.kind === 'perch') { this.inBed = false; this.body.position.copy(this.ledgeSpot()); this.elevation = this.body.position.y; this.body.rotation.y = 0; this.enter('perchidle'); }
    else if (this.plan.kind === 'station') { this.inBed = false; this.elevation = 0; this.body.position.copy(this.stationSpot(this.plan.index, stationX)); this.body.rotation.y = -this.spotSide * .6; this.enter('sitidle'); }
    else { this.elevation = HOME_LIFT; this.inBed = true; this.body.position.copy(HOME); this.body.position.y = HOME_LIFT; this.body.rotation.y = REST_YAW; this.enter('sleep'); this.dwell = Infinity; }
    const current: THREE.AnimationAction | undefined = this.layer;
    if (current) { current.fadeIn(0); current.setEffectiveWeight(1); this.loco = 0; }
  }

  /** Continue the current plan from wherever Blue is. */
  private resume(stationX: number[]) {
    const plan = this.plan, at = this.body.position;
    const takeoff = this.local(LEDGE.takeoff), spot = this.ledgeSpot();
    // In the bed: the home routine stays (idle, then startWalk steps out); other plans step out first.
    if (this.inBed) { if (plan.kind === 'home' && !this.toy) return this.enter('idle'); return this.leaveBed(() => this.resume(stationX)); }
    if (this.elevation > 0) {
      if (plan.kind !== 'perch') return this.startJump(at, takeoff, false);
      if (flat(at, spot) < .03) { this.goal.copy(spot); this.arrival = 'perch'; return this.arrive(stationX); }
      return this.travelTo(spot, .12, 'perch');
    }
    if (plan.kind === 'perch') {
      if (flat(at, takeoff) < .05) return this.startJump(at, spot, true);
      return this.travelTo(takeoff, TRAVEL_SPEED, 'jump');
    }
    if (plan.kind === 'station') {
      const spot = this.stationSpot(plan.index, stationX);
      if (flat(at, spot) < .05) return this.enter('sit');
      return this.travelTo(spot, TRAVEL_SPEED, 'sit');
    }
    if (this.toy && this.clock < this.playUntil) return this.chaseToy();
    if (flat(at, HOME) > 1.4) { this.visits = this.plannedVisits; return this.travelTo(BED_EXIT, TRAVEL_SPEED, 'home'); }
    this.enter('idle');
  }

  private travelTo(goal: THREE.Vector3, speed: number, arrival: Arrival) {
    this.justTurned = false;
    this.goal.copy(goal);
    this.travelSpeed = speed;
    this.arrival = arrival;
    // Far goals are trotted to; nobody gets teleported.
    if (this.elevation === 0 && flat(goal, this.body.position) > FAR_DISTANCE) this.travelSpeed = RUN_SPEED;
    this.enter('walk');
  }

  private startJump(from: THREE.Vector3, to: THREE.Vector3, up: boolean, clip = up ? 'jumpup' : 'jumpdown') {
    this.jumpFrom.copy(from); this.jumpTo.copy(to); this.jumpUp = up;
    this.jumpClip = clip;
    this.jumpHook = clip === 'jumpup' ? this.hookFractions(from, to) : null;
    this.jumpAir = 0;
    this.speed = 0;
    const error = this.headingError(to.x - from.x, to.z - from.z);
    if (Math.abs(error) > TURN_MIN && !this.justTurned) { this.startTurn(error, 'jump'); return; }
    this.jumpYaw = this.yaw + error;
    this.enter('jump');
  }

  private startWalk() {
    if (this.toy && this.clock < this.playUntil) { this.resume([this.stationX]); return; }
    if (this.inBed) return this.leaveBed(() => this.startWalk());
    if (this.visits >= this.plannedVisits) { this.goal.copy(BED_EXIT); this.arrival = 'home'; }
    else {
      let spot = SPOTS[Math.floor(Math.random() * SPOTS.length)];
      if (spot.distanceTo(this.body.position) < .3) spot = SPOTS[(SPOTS.indexOf(spot) + 1) % SPOTS.length];
      this.goal.copy(spot); this.arrival = 'idle';
    }
    this.travelSpeed = ROAM_SPEED;
    this.enter('walk');
  }

  addToy(gltf: GLTF, ball: boolean) {
    if (!this.toys) {
      this.toys = new BlueToys(this.container, toy => {
        if (this.plan.kind !== 'home') return;
        this.toy = toy; this.playUntil = this.clock + 28;
        this.disturb();
        // A new toy can redirect the walk home without restarting its gait.
        if (!this.inBed && this.elevation === 0 && (this.mood === 'walk' || this.mood === 'turn' && this.afterTurn === 'walk')) this.arrival = 'toy';
        // Travel, turns and the current paw stroke finish before a new target.
        if (this.mood === 'idle') this.nextPlay = this.clock;
      });
      this.root.add(this.toys.root);
    }
    this.toys.add(gltf, ball);
  }

  private chaseToy() {
    if (!this.toy) return;
    if (this.tryPlayJump()) return;
    this.aimToy();
    this.goal.copy(this.playAim);
    if (flat(this.body.position, this.toy.position) < .35 && this.toy.position.y < .18 && !this.toy.held) {
      this.goal.copy(this.body.position); this.arrival = 'toy';
      const error = this.headingError(this.toy.position.x - this.body.position.x, this.toy.position.z - this.body.position.z);
      if (Math.abs(error) > TURN_MIN) { this.startTurn(error, 'arrive'); return; }
      this.enter('playready'); return;
    }
    this.travelTo(this.goal, flat(this.body.position, this.goal) > .65 ? RUN_SPEED : .42, 'toy');
  }

  /** Lead moving toys, then steer the existing walk/trot without resetting its clip. */
  private aimToy() {
    const toy = this.toy!;
    const lead = toy.held ? 0 : Math.min(.45, flat(this.body.position, toy.position) / 1.8);
    this.playAim.copy(toy.position).addScaledVector(toy.velocity, lead);
    this.forward.subVectors(this.playAim, this.body.position); this.forward.y = 0;
    if (this.forward.lengthSq() < .001) this.forward.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.forward.normalize();
    this.playAim.addScaledVector(this.forward, -.29); this.playAim.y = 0;
    this.playAim.x = THREE.MathUtils.clamp(this.playAim.x, -2.05, this.compactPlay ? .25 : 1.6);
    // Always approach through the open floor in front of the bolster/cabinets.
    this.playAim.z = THREE.MathUtils.clamp(this.playAim.z, .64, .90);
  }

  private tryPlayJump() {
    const toy = this.toy;
    if (!toy || toy.held || this.inBed || this.elevation > 0 || this.clock < this.nextLeap || toy.position.y < .2) return false;
    const time = .45;
    this.playAim.copy(toy.position).addScaledVector(toy.velocity, time);
    this.playAim.y -= .5 * TOY_GRAVITY * time * time;
    const distance = flat(this.playAim, this.body.position);
    const angle = this.headingError(this.playAim.x - this.body.position.x, this.playAim.z - this.body.position.z);
    if (this.playAim.y < .2 || this.playAim.y > 1.12 || distance > .95 || Math.abs(angle) > .5) return false;
    this.beginPlayJump(true); return true;
  }

  private beginPlayJump(high: boolean) {
    if (!this.toy) return;
    if (!high) this.playAim.copy(this.toy.position);
    this.playFrom.copy(this.body.position); this.playFrom.y = 0;
    this.forward.subVectors(this.playAim, this.playFrom); this.forward.y = 0; this.forward.normalize();
    this.playTo.copy(this.playAim).addScaledVector(this.forward, -.26); this.playTo.y = 0;
    this.playTo.x = THREE.MathUtils.clamp(this.playTo.x, -2.05, this.compactPlay ? .25 : 1.6);
    this.playTo.z = THREE.MathUtils.clamp(this.playTo.z, .64, .90);
    this.playHeight = high ? THREE.MathUtils.clamp(this.playAim.y - .18, .16, .72) : .09;
    this.playClip = high ? 'catch' : 'pounce'; this.nextLeap = this.clock + 2.0;
    this.swatted = false; this.speed = 0; this.enter('playjump');
  }

  /** Only a paw intersecting the toy imparts an impulse; a miss stays a miss. */
  private touchToy() {
    const toy = this.toy;
    if (!toy || toy.held || this.swatted) return;
    const airborne = this.mood === 'playjump';
    if (!(airborne ? this.age > .19 && this.age < .87 : this.mood === 'swat' && this.age > .2 && this.age < .85)) return;
    this.body.updateWorldMatrix(true, true);
    for (const bone of this.bones) {
      if (!bone.name.startsWith('FrontPaw') || (!airborne && !bone.name.endsWith(this.pawSide))) continue;
      this.root.worldToLocal(bone.getWorldPosition(this.tmpV));
      if (this.tmpV.distanceTo(toy.position) > toy.radius + .045) continue;
      this.swatted = true; this.toyContacts++;
      const side = this.pawSide === 'L' ? -.45 : .45;
      // Send it back across the play area at the edge, so the game keeps moving.
      const turnBack = toy.position.x < -1.95 || toy.position.x > (this.compactPlay ? .15 : 1.4);
      this.forward.set(Math.sin(this.yaw + side), 0, Math.cos(this.yaw + side));
      if (turnBack) this.forward.set(-.65 - toy.position.x, 0, .64 - toy.position.z).normalize();
      toy.bat(this.forward, airborne ? .62 : .95);
      if (airborne && this.playClip === 'catch') { toy.velocity.multiplyScalar(.2); toy.velocity.y = -.4; this.toyCatches++; }
      this.playUntil = Math.max(this.playUntil, this.clock + 7);
      break;
    }
  }

  /** Step out of the bed over the front lip (`bedout`, root motion to BED_EXIT), then carry on with `next`. */
  private leaveBed(next: () => void) {
    this.inBed = false;
    this.afterJump = () => { this.elevation = 0; next(); };   // leaving: carry on with whatever was planned
    const error = wrap(REST_YAW - this.yaw);
    this.jumpFrom.copy(this.body.position); this.jumpTo.copy(BED_EXIT); this.jumpUp = false; this.jumpClip = 'bedout';
    if (Math.abs(error) > TURN_MIN) { this.startTurn(error, 'jump'); return; }
    this.body.rotation.set(0, REST_YAW, 0);
    this.startJump(this.body.position, BED_EXIT, false, 'bedout');
  }

  /** Step into the bed over the front lip (`bedin`, root motion from BED_EXIT to HOME on the cushion; he faces the
   * back of the bed while stepping in), then turn round on the cushion and settle facing the lip. */
  private enterBed() {
    this.afterJump = (stationX) => { this.inBed = true; this.elevation = HOME_LIFT; this.goal.copy(HOME); this.arrival = 'settle'; this.arrive(stationX); };
    const target = HOME.clone(); target.y = HOME_LIFT;
    this.startJump(this.body.position, target, true, 'bedin');
  }

  private arrive(stationX: number[]) {
    // A moving toy can come within paw reach before its pursuit goal is reached.
    // Keep that planted position instead of snapping to the latest prediction.
    if (this.arrival === 'toy') this.goal.copy(this.body.position);
    else { this.body.position.x = this.goal.x; this.body.position.z = this.goal.z; }
    this.speed = 0;
    // 'home' ends at BED_EXIT facing into the bed (the lip is behind him once he lies down); 'settle' is on the cushion after `bedin`, facing the lip again.
    const facing = this.arrival === 'home' ? wrap(REST_YAW + Math.PI) : this.arrival === 'settle' ? REST_YAW : this.arrival === 'sit' ? -this.spotSide * .55 : this.arrival === 'perch' ? 0 : null;
    if (facing !== null) {
      // Face the cushion, the cabinet or the viewer with real steps before lying down; a small remainder eases in during the clip.
      const error = wrap(facing - this.yaw);
      if (Math.abs(error) > TURN_MIN && !this.justTurned) { this.startTurn(error, 'arrive'); return; }
      this.faceYaw = facing;
    }
    switch (this.arrival) {
      case 'toy':
        if (this.toy && !this.toy.held && this.toy.position.y < .18 && flat(this.body.position, this.toy.position) < .36) {
          const error = this.headingError(this.toy.position.x - this.body.position.x, this.toy.position.z - this.body.position.z);
          if (Math.abs(error) > TURN_MIN) { this.startTurn(error, 'arrive'); return; }
          this.enter('playready');
        }
        else { this.enter('idle'); this.nextPlay = this.clock + .3; }
        break;
      case 'home': this.enterBed(); break;
      case 'settle': this.enter('settle'); break;
      case 'sit': this.enter('sit'); break;
      case 'perch': this.enter('perch'); break;
      case 'jump': this.startJump(this.body.position, this.ledgeSpot(), true); break;
      default: this.visits++; this.enter('idle'); this.resumeIfNeeded(stationX);
    }
  }

  private resumeIfNeeded(stationX: number[]) {
    if (this.plan.kind !== 'home') this.resume(stationX);
  }

  /** A layered once-clip has finished: continue the plan. */
  private advance(stationX: number[]) {
    switch (this.mood) {
      case 'playready':
        if (!this.toy || this.toy.held || flat(this.body.position, this.toy.position) > .46) { this.resume(stationX); break; }
        this.playBeat++; this.pawSide = this.playBeat % 2 ? 'R' : 'L';
        if (this.playBeat % 3 === 0 && this.clock > this.nextLeap) this.beginPlayJump(false);
        else { this.swatted = false; this.enter('swat'); }
        break;
      case 'playjump': this.body.position.y = this.elevation = 0; this.enter('idle'); this.nextPlay = this.clock + .12; if (this.plan.kind !== 'home') this.resume(stationX); break;
      case 'swat': this.enter('idle'); this.nextPlay = this.clock + .18; if (this.plan.kind !== 'home') this.resume(stationX); break;
      case 'settle': this.enter(this.toy ? 'wake' : 'sleep'); break;
      case 'wake': {
        const region = this.pendingPet;
        this.pendingPet = null;
        if (this.pendingHappy) {
          this.enter(region === 'back' ? 'arch' : region === 'tail' ? 'idle' : 'happy');
          this.touchRegion = region ?? 'head'; this.purr = region === 'tail' ? .65 : 1.15;
          if (region === 'tail') this.flickTail();
        } else { this.enter('idle'); this.resume(stationX); }
        break;
      }
      case 'sit': case 'sitarch': this.enter('sitidle'); break;
      case 'stand': this.enter('idle'); this.resume(stationX); break;
      case 'perch': this.enter('perchidle'); break;
      case 'unperch': this.enter('idle'); this.resume(stationX); break;
      case 'jump': {
        this.elevation = this.jumpTo.y; this.body.position.copy(this.jumpTo);
        const next = this.afterJump; this.afterJump = null;
        if (next) { this.enter('idle'); next(stationX); }
        else { this.earKick = 1; this.enter('idle'); this.resume(stationX); }
        break;
      }
      case 'happy': case 'arch': this.enter('idle'); this.resume(stationX); break;
      case 'turn': {
        const next = this.afterTurn;
        this.justTurned = true;
        if (this.planChanged) { this.planChanged = false; this.justTurned = false; this.enter('idle'); this.resume(stationX); }
        else if (next === 'walk') { this.justTurned = false; this.enter('walk'); }
        else if (next === 'arrive') this.arrive(stationX);
        else this.startJump(this.body.position, this.jumpTo, this.jumpUp, this.jumpClip);
        this.justTurned = false;
        break;
      }
    }
  }

  private locomote(dt: number, stationX: number[]) {
    if (this.toy && this.arrival === 'toy') {
      if (this.tryPlayJump()) return;
      this.aimToy(); this.goal.lerp(this.playAim, 1 - Math.exp(-8 * dt));
      this.travelSpeed = flat(this.body.position, this.toy.position) > .65 || this.toy.velocity.length() > .65 ? RUN_SPEED : .42;
      if (!this.toy.held && this.toy.position.y < .18 && flat(this.body.position, this.toy.position) < .34 && this.speed < .16) { this.arrive(stationX); return; }
    }
    this.forward.subVectors(this.goal, this.body.position);
    this.forward.y = 0;
    const distance = this.forward.length();
    if (distance < .015 && this.speed < .03) { this.arrive(stationX); return; }
    const error = this.headingError(this.forward.x, this.forward.z), angle = Math.abs(error);
    // Only a goal well behind him is worth stopping and stepping around for. A cat does not turn on the spot before
    // walking somewhere 40° off its nose: it walks off in an arc, which is what the creeping minimum speed and the
    // tighter low-speed turning radius below produce (Dennis, 2026-09-20: the turning reads as rigid).
    if (this.speed < .04 && angle > WALK_ARC_MAX) { this.startTurn(error, 'walk'); return; }
    this.targetRotation.setFromAxisAngle(UP, Math.atan2(this.forward.x, this.forward.z));
    // Tight radius while creeping, wide once he is up to speed, so the arc stays inside BOUNDS and still arrives.
    const radius = THREE.MathUtils.lerp(.17, TURN_RADIUS, step(this.speed, .06, .42));
    this.body.quaternion.rotateTowards(this.targetRotation, Math.min(angle * 4, THREE.MathUtils.clamp(this.speed / radius, .45, 1.6)) * dt);
    // Never brake all the way to a stop for a heading error: keep creeping through the arc.
    const aligned = Math.max(.30, 1 - step(angle, .7, 1.7));
    const running = this.travelSpeed >= RUN_SPEED;
    const accel = running ? (this.toy ? 1.4 : .9) : this.travelSpeed > ROAM_SPEED ? .42 : .28, decel = running ? (this.toy ? 1.5 : 1.0) : this.travelSpeed > ROAM_SPEED ? .5 : .36;
    const wanted = Math.min(this.travelSpeed, Math.sqrt(2 * decel * Math.max(0, distance - .01))) * aligned;
    this.speed = this.speed < wanted ? Math.min(wanted, this.speed + accel * dt) : Math.max(wanted, this.speed - decel * dt);
    this.heading.copy(FORWARD).applyQuaternion(this.body.quaternion);
    this.body.position.addScaledVector(this.heading, this.speed * dt);
    if (this.elevation === 0) {
      this.body.position.x = THREE.MathUtils.clamp(this.body.position.x, BOUNDS.minX, BOUNDS.maxX);
      this.body.position.z = THREE.MathUtils.clamp(this.body.position.z, BOUNDS.minZ, BOUNDS.maxZ);
    }
  }

  /** Where along the real take-off-to-landing line the authored hook moment has to fall, or null when the flat
   * warp already puts it there (every desktop jump). */
  private hookFractions(from: THREE.Vector3, to: THREE.Vector3) {
    const ledge = this.local(this.tmpV.set(0, LEDGE.top, LEDGE.edge));
    const span = from.z - to.z, climb = to.y - from.y;
    if (Math.abs(span) < .2 || Math.abs(climb) < .2) return null;
    const forward = (from.z - (ledge.z + JUMP_HOOK.behind)) / span;
    const rise = ((ledge.y - JUMP_HOOK.below) - from.y) / climb;
    if (!(forward > .02 && forward < .98 && rise > .02 && rise < .98)) return null;
    if (Math.abs(forward - JUMP_HOOK.forward) < .01 && Math.abs(rise - JUMP_HOOK.rise) < .01) return null;
    return { forward, rise };
  }

  /**
   * Replay the jump clip's authored trajectory on the body, warped so the forward and vertical distances match the
   * actual take-off and landing points (the compact layout scales the cabinet differently from Blue). When the two
   * geometries disagree the warp is anchored at the hook, so the forepaws still catch the real cap edge.
   */
  private fly() {
    const motion = this.jumpMove.get(this.jumpClip);
    if (!motion) return;
    const from = this.jumpFrom, to = this.jumpTo;
    const sample = motion.at(Math.min(this.age, this.length(this.jumpClip)));
    let forward = Math.abs(motion.total.z) > 1e-3 ? sample.z / motion.total.z : 0;
    let rise = Math.abs(motion.total.y) > 1e-3 ? sample.y / motion.total.y : 0;
    if (this.jumpHook) {
      forward = anchor(forward, JUMP_HOOK.forward, this.jumpHook.forward);
      rise = anchor(rise, JUMP_HOOK.rise, this.jumpHook.rise);
    }
    const dx = to.x - from.x, dz = to.z - from.z;
    this.body.position.set(from.x + dx * forward, from.y + (to.y - from.y) * rise, from.z + dz * forward);
    this.jumpAir = rise;
  }

  /* ---------- attention overlay ---------- */

  private attend(dt: number, camera: THREE.Camera, reduce: boolean) {
    if (!this.head) return;
    const playing = !!this.toy && !this.inBed && this.elevation === 0 && !reduce;
    const awake = this.mood === 'idle' || this.mood === 'walk' || this.mood === 'sitidle' || this.mood === 'sitarch' || this.mood === 'perchidle' || this.mood === 'sit' || this.mood === 'arch' || this.mood === 'swat' || this.mood === 'playready' || this.mood === 'playjump';
    if (this.toy && !reduce) {
      this.gazePoint.copy(this.toy.position); this.root.localToWorld(this.gazePoint);
      this.gazeValid = true; this.gazeAt = this.clock;
    }
    let wanted = 0;
    if (!reduce && awake) {
      if (playing || this.hover || this.purr > 0) wanted = 1;
      else if (this.gazeValid && this.clock - this.gazeAt < 6) wanted = this.mood === 'walk' ? .55 : 1;
      else if (this.mood === 'perchidle') wanted = .75; // looks down at the visitor from the ledge
      else if (this.mood !== 'walk' && !this.gazeValid) wanted = .3;
    }
    this.gazeWeight = THREE.MathUtils.damp(this.gazeWeight, wanted, 4, dt);
    this.perk = THREE.MathUtils.damp(this.perk, !reduce && awake ? (playing ? .75 : this.hover ? 1 : 0) : 0, 6, dt);
    this.playEnergy = THREE.MathUtils.damp(this.playEnergy, playing && awake ? 1 : 0, 5, dt);
    if (wanted > 0) {
      const target = playing ? this.gazePoint : this.hover || !this.gazeValid || this.purr > 0 ? camera.position : this.gazePoint;
      this.head.getWorldPosition(this.tmpV);
      this.tmpV.subVectors(target, this.tmpV);
      this.body.getWorldQuaternion(this.tmpQ).invert();
      this.tmpV.applyQuaternion(this.tmpQ);
      const yaw = THREE.MathUtils.clamp(Math.atan2(this.tmpV.x, this.tmpV.z), -.75, .75);
      const pitch = THREE.MathUtils.clamp(Math.atan2(this.tmpV.y, Math.hypot(this.tmpV.x, this.tmpV.z)), playing ? -.85 : this.elevation > 0 ? -.55 : -.3, playing ? .7 : .42);
      this.gazeYaw = THREE.MathUtils.damp(this.gazeYaw, yaw, 7, dt);
      this.gazePitch = THREE.MathUtils.damp(this.gazePitch, pitch, 7, dt);
    }
    // Being petted: the head pushes up into the hand and rolls into it, the chest leans along; big enough to read at hall size.
    this.touchAmount = THREE.MathUtils.damp(this.touchAmount, this.purr > .2 ? 1 : 0, this.purr > .2 ? 18 : 7, dt);
    const petted = this.touchAmount * (reduce ? .35 : 1);
    const headTouch = this.touchRegion === 'head';
    const backTouch = this.touchRegion === 'back';
    const safePose = this.mood !== 'wake' && this.mood !== 'sleep' && this.mood !== 'settle' && this.mood !== 'jump' && this.mood !== 'playjump';
    // Smooth the actual angles, including side/region changes while already fully
    // petted. Smoothing only touchAmount left a one-frame 23° head flip at x = 0.
    const push = this.touchPush = followTouch(this.touchPush, (headTouch ? .24 : backTouch ? .07 : 0) * petted * (safePose ? 1 : .2), dt);
    const tilt = this.touchTilt = followTouch(this.touchTilt, (headTouch ? .20 : backTouch ? .05 : -.10) * petted * this.touchSide * (safePose ? 1 : .2), dt);
    this.touchCurve = followTouch(this.touchCurve, backTouch && safePose ? petted * .08 : 0, dt);
    this.touchEar = followTouch(this.touchEar, petted * (this.touchRegion === 'tail' ? .40 : .20), dt);
    // From the ledge the camera sits only a few degrees below him; tuck the chin so the look-down reads.
    const ledgeBias = this.mood === 'perchidle' ? .22 * this.gazeWeight : 0;
    // Steering while walking a curve: head and eyes lead, the whole torso bends into the turn proportionally to the
    // smoothed yaw rate and eases out as he straightens, and the chest rolls in. Without this the arc walk reads as
    // a rigid model sliding round a corner.
    const curve = reduce || this.mood !== 'walk' ? 0 : THREE.MathUtils.clamp(this.yawRate, -1.4, 1.4);
    const lead = curve * .30;
    const yaw = this.gazeYaw * this.gazeWeight + lead, pitch = this.gazePitch * this.gazeWeight - push - ledgeBias;
    this.overlay(this.spine, curve * .085, 0, -curve * .035);
    this.overlay(this.chest, curve * .105, -push * .25 - this.touchCurve, -curve * .09 + tilt * .3);
    this.overlay(this.neck, yaw * .38 + curve * .10, -pitch * .35, tilt * .3);
    this.overlay(this.head, yaw * .62, -pitch * .65, tilt);
    const earBack = this.touchEar;
    for (const ear of this.ears) this.overlay(ear, 0, -this.perk * .22 + earBack, ear === this.ears[0] ? this.perk * .06 : -this.perk * .06);
    // Loose carrying sway with a smaller, quicker tip twitch during focused play.
    // Keep this outside the inertia history, just like gaze, so it cannot accumulate.
    for (let i = 0; i < this.tail.length; i++) {
      const tip = (i + 1) / this.tail.length;
      this.overlay(this.tail[i], this.playEnergy * (.065 * Math.sin(this.clock * 3.8 - i * .45) + tip * tip * .07 * Math.sin(this.clock * 8.2 - i * .3)), 0, 0);
    }
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
    // Inertialize the animation pose, not the attention overlay. Carrying gaze and
    // pet angles into the next clip and then adding them again made transitions jerk.
    for (const bone of this.bones) {
      const state = this.inertia.get(bone)!;
      state.before.copy(state.last); state.last.copy(bone.quaternion);
    }
    this.attend(dt, camera, reduce);
    for (const bone of this.bones) this.baseQuat.get(bone)![1].copy(bone.quaternion);
    this.lastDt = Math.max(dt, 1e-4);
  }

  /** Inertialization: on a switch, the offset from the new pose back to the old one (and its velocity) decays to zero. */
  private inertialize(dt: number) {
    if (this.pendingInertia) {
      this.pendingInertia = false; this.inertiaActive = true;
      for (const bone of this.bones) {
        const state = this.inertia.get(bone)!;
        // Offset and velocity of the previous animation pose, before gaze/petting overlays.
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

  /** Asleep, sitting or on the ledge with nothing to look at: only breathing; the mirror pass may idle. */
  get calm() {
    const resting = this.mood === 'sleep' || this.mood === 'sitidle' || this.mood === 'perchidle';
    return resting && this.gazeWeight < .05 && this.perk < .05 && this.purr <= 0 && !this.hover;
  }

  update(dt: number, camera: THREE.Camera, active: boolean, reduce: boolean, scene?: BlueScene) {
    // Layout reads once a second, not per frame (a forced layout under the overlay button's own writes).
    if (this.frame % 60 === 0 || !this.containerWidth) this.containerWidth = this.container.clientWidth;
    const compact = this.containerWidth < 600;
    const previousScale = this.scale;
    this.scale = compact ? .75 : 1;
    this.compactPlay = compact;
    this.root.scale.setScalar(this.scale);
    this.shift.set(compact ? .4 : 0, 0, compact ? .05 : 0);
    this.root.position.set(this.stationX + this.shift.x, 0, this.shift.z);
    if (previousScale !== this.scale && (this.mood === 'perch' || this.mood === 'perchidle')) {
      this.body.position.copy(this.ledgeSpot());
      this.elevation = this.body.position.y;
      this.goal.copy(this.body.position);
    }
    this.root.visible = active;
    this.button.hidden = !active;
    this.toys?.update(active ? dt : 0, camera, active && (!scene || (scene.inHall && scene.pose === 'hall' && scene.focus === 0)), reduce, compact);
    if (!active) return false;
    this.age += dt;
    this.clock += dt;
    this.frame++;
    const stationX = scene?.stationX ?? [this.stationX];
    let plan = this.wanted(scene);
    // Asleep in his bed he stays there while the visitor browses the stations: only a click, a toy or Über mich wakes him (Dennis, 2026-09-19).
    if (plan.kind === 'station' && this.mood === 'sleep' && this.inBed) plan = { kind: 'home' };
    if (this.toy?.held) this.playUntil = this.clock + 28;
    if (plan.kind !== 'home' || reduce || this.clock > this.playUntil) this.toy = null;
    if (plan.kind !== this.plan.kind || (plan.kind === 'station' && this.plan.kind === 'station' && plan.index !== this.plan.index)) this.replan(plan, stationX, reduce);
    if (!reduce) {
      switch (this.mood) {
        case 'idle': if (this.toy && this.clock > this.nextPlay) this.resume(stationX); else if (this.plan.kind === 'home' && this.age > this.dwell) this.startWalk(); break;
        case 'swat':
          if (this.age > this.length('swat')) this.advance(stationX);
          break;
        case 'playready': if (this.age > this.length('playready')) this.advance(stationX); break;
        case 'playjump': {
          const flight = step(this.age, .14, .76);
          this.body.position.lerpVectors(this.playFrom, this.playTo, flight);
          this.body.position.y = Math.sin(Math.PI * flight) * this.playHeight;
          if (this.age > this.length(this.playClip)) this.advance(stationX);
          break;
        }
        case 'walk': this.locomote(dt, stationX); break;
        case 'settle': if (this.age > this.length('settle')) this.advance(stationX); break;
        case 'turn': this.applyTurn(); if (this.age * this.turnRate > this.length(this.turnClip)) this.advance(stationX); break;
        case 'sitarch': if (this.age > this.length('sitarch') && this.purr <= .2) this.advance(stationX); break;
        case 'sleep':
          if (this.age > this.dwell) { if (this.plan.kind === 'station') this.enter('sitidle'); else this.enter('wake'); }
          break;
        case 'arch': if (this.age > this.length('arch') && this.purr <= .2) this.advance(stationX); break;
        case 'wake': if (this.age > this.length('wake')) this.advance(stationX); break;
        case 'sit': if (this.age > this.length('sit')) this.advance(stationX); break;
        case 'sitidle': if (this.age > this.dwell) this.enter('sleep'); break;
        case 'stand': if (this.age > this.length('stand')) this.advance(stationX); break;
        case 'perch': if (this.age > this.length('perch')) this.advance(stationX); break;
        case 'unperch': if (this.age > this.length('unperch')) this.advance(stationX); break;
        case 'jump':
          this.targetRotation.setFromAxisAngle(UP, this.jumpYaw);
          this.body.quaternion.rotateTowards(this.targetRotation, .5 * dt);
          if (this.age > this.length(this.jumpClip)) this.advance(stationX); else this.fly();
          break;
      }
    }
    // A petted cat never spins towards the visitor: the head overlay does the looking.
    if (this.mood === 'happy' && this.age > 2.2 && this.purr <= .2) this.advance(stationX);
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
    const eyeGoal = this.mood === 'wake' ? 1 - step(this.age, .02, .26) : resting ? 1 : this.mood === 'happy' || (this.purr > .2 && this.touchRegion !== 'tail') ? .94 : !reduce && (this.blinkAge > this.blinkPeriod - .24 || this.slowBlink > .45) ? 1 : 0;
    this.blink = THREE.MathUtils.damp(this.blink, eyeGoal, this.mood === 'wake' ? 12 : resting || this.slowBlink > 0 || this.purr > 0 ? 7 : 20, dt);
    // Pose-space floor correctives: sphinx rest, upright sit and the ledge perch each keep their underside above the surface.
    // Each ramp follows its clip's own curl/lie schedule in blue_animate.py.
    const settled = this.mood === 'sleep' ? 1 : this.mood === 'settle' ? step(this.age, 2.45, 4.75) : this.mood === 'wake' ? 1 - step(this.age, 0, 1.4) : 0;
    const seated = this.mood === 'sitidle' || this.mood === 'sitarch' ? 1 : this.mood === 'sit' ? step(this.age, .15, .75) : this.mood === 'stand' ? 1 - step(this.age, .1, .8) : 0;
    const perched = this.mood === 'perchidle' ? 1 : this.mood === 'perch' ? step(this.age, .9, 2.45) : this.mood === 'unperch' ? 1 - step(this.age, .2, 1.8) : 0;
    this.ground = THREE.MathUtils.damp(this.ground, settled, 14, dt);
    this.seatGround = THREE.MathUtils.damp(this.seatGround, seated, 14, dt);
    this.perchGround = THREE.MathUtils.damp(this.perchGround, perched, 14, dt);
    if (this.coat && this.closedMap && this.openMap) {
      const closed = this.blink > .5;
      if (closed !== this.showingClosed) {
        this.showingClosed = closed;
        if (this.eyesOpenMap && this.eyesMaterial && this.eyesTint) {
          // v6: only the eye polygons change; the coat keeps its atlas and its mip chain
          this.eyesMaterial.map = closed ? this.closedMap : this.eyesOpenMap; this.eyesMaterial.color.copy(closed ? WHITE : this.eyesTint);
        } else {
          this.coat.map = closed ? this.closedMap : this.openMap;
          if (this.eyesMaterial && this.eyesTint) { this.eyesMaterial.map = closed ? this.closedMap : this.openMap; this.eyesMaterial.color.copy(closed ? WHITE : this.eyesTint); }
        }
      }
    }
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
    if (this.mood !== 'jump' && this.mood !== 'playjump') this.body.position.y = this.elevation;
    const groundY = this.mood === 'playjump' ? 0 : this.mood === 'jump' ? (this.jumpAir < .5 ? this.jumpFrom.y : this.jumpTo.y) : this.elevation;
    this.shadow.position.set(this.body.position.x, groundY + .003, this.body.position.z);
    this.shadow.rotation.z = -this.yaw;
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 1 - step(this.body.position.y - groundY, .05, .6) * .7;
    this.body.updateWorldMatrix(true, true);
    if (!reduce) this.touchToy();
    // The click target sits on the body: lower when he lies or sits, so a pointer resting on it also hits the mesh.
    const lying = this.mood === 'sleep' || this.mood === 'settle' || this.mood === 'wake' || this.mood === 'perch' || this.mood === 'perchidle';
    const sitting = this.mood === 'sit' || this.mood === 'sitidle' || this.mood === 'sitarch';
    this.projection.set(0, lying ? .15 : sitting ? .22 : .25, 0).applyMatrix4(this.body.matrixWorld).project(camera);
    const inView = Math.abs(this.projection.x) < .94 && Math.abs(this.projection.y) < .94 && this.projection.z > -1 && this.projection.z < 1;
    // DOM writes only when something changed: a style write per frame kept the layout dirty for the hall's reads.
    if (this.button.hidden !== !inView) this.button.hidden = !inView;
    if (inView) {
      const left = ((this.projection.x * .5 + .5) * 100).toFixed(2), top = ((-this.projection.y * .5 + .5) * 100).toFixed(2);
      if (left !== this.buttonLeft) { this.buttonLeft = left; this.button.style.left = `${left}%`; }
      if (top !== this.buttonTop) { this.buttonTop = top; this.button.style.top = `${top}%`; }
      const en = document.documentElement.dataset.lang === 'en';
      if (en !== this.buttonEn) { this.buttonEn = en; this.button.setAttribute('aria-label', en ? 'Pet Blue the cat' : 'Blue streicheln'); }
    }
    if (reduce) return this.mood === 'happy' || this.gazeWeight > .001 || this.perk > .001;
    // Beside an open panel only calm moods are throttled, so reading stays smooth while Blue keeps breathing.
    const calm = this.mood === 'perchidle' || this.mood === 'sitidle' || this.mood === 'sleep';
    if (scene && !scene.inHall && calm && this.gazeWeight < .05 && this.perk < .05 && this.purr <= 0) return this.frame % 3 === 0;
    return true;
  }

  dispose() {
    this.toys?.dispose();
    this.button.removeEventListener('click', this.pet);
    this.button.remove();
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
    this.textures.forEach(texture => {
      for (const level of texture.mipmaps ?? []) (level as { close?: () => void }).close?.();   // the uploaded ImageBitmaps
      texture.dispose();
    });
  }
}
