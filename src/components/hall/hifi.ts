/**
 * The bedroom hi-fi left of the claw machine (Dennis, 2026-10-06, his reference "01 / BEDROOM HI-FI": "a radio that
 * looks like the left one here built. everything built individually, also with that table, some cd cases the old ones,
 * remote, speakers etc. real 2000s vibes. no need for the rack"). The same night: "For all the pieces of the new radio
 * you built, including the metal rods, everything except the glass: create 3d model images with gemini of every piece.
 * use tripo.ai ... I want better looks and more details." The speaker (twice), the remote and the table's chrome leg
 * (four times) are Tripo models made from Gemini product images (.source-assets/hifi/), repainted clean
 * (scripts/models/blender/hifi_build.py; Tripo's AI paint was smudged). The CD micro system is modelled clean in
 * hifi_unit_gen.py in the Tripo unit's proportions (its seams rippled): body, four keys that press, a knurled knob that
 * turns. All in one file. Built here: the glass shelves, the jewel cases, the speakers' grilles, and on the unit what
 * the hall moves or lights: the clear blue lid over the well with the album disc, the display, the power lamp, the
 * panel's prints, the knob's index.
 * The models keep Tripo's units (longest side ~0.98); each piece is scaled to its real size here, in metres, and the
 * hall sets the corner at HIFI_SCALE. The player's behaviour (keys, display, disc, track list) is cdPlayer.ts's.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type HifiAct = 'prev' | 'play' | 'stop' | 'next' | 'quieter' | 'louder';
/**
 * A control on the front: its group sits on the face (+z out of it), `face` is the local z of what the finger
 * touches, `cap` moves in by `travel` when pressed.
 */
export type HifiKey = { act: HifiAct; group: THREE.Group; cap: THREE.Object3D; material: THREE.MeshStandardMaterial; hit: { x: number; y: number; r: number }; face: number; travel: number };
export type Hifi = {
  group: THREE.Group;
  disc: THREE.Mesh;
  knob: THREE.Object3D;
  keys: HifiKey[];
  screen: { ctx: CanvasRenderingContext2D; texture: THREE.CanvasTexture; width: number; height: number };
  /** The close-up's subject in the corner's own space (before HIFI_SCALE): centre, direction to the eye, radius. */
  view: { centre: THREE.Vector3; dir: THREE.Vector3; radius: number };
  owned: { dispose(): void }[];
};

/** The corner reads at hall scale a little larger than life: the claw machine beside it is a big machine. */
export const HIFI_SCALE = 1.3;
const TABLE = { w: 0.92, d: 0.46, glass: 0.012, legX: 0.4, legZ: 0.17, corner: 0.035 };
/** The leg: 0.588 m of model height, its pole 3.4 cm thick; the collars' tops (model units) carry the shelves. */
const LEG = { y: 0.588, r: 0.29, upper: 0.83, lower: 0.386, pole: 0.0585 };
const TOP = LEG.upper * LEG.y + TABLE.glass;
const LOWER = LEG.lower * LEG.y + TABLE.glass;
/** The unit 26 cm wide (its disc 14 cm, a CD's 12 a little enlarged), the speakers 27 cm tall, the remote 17 cm. */
const RADIO = { s: 0.3, z: 0.03 };
const SPEAKER = { s: 0.2755, x: 0.335, z: -0.012, toe: 0.12 };
const REMOTE = { s: 0.1735, x: 0.3, z: 0.09, rot: -0.42 };
/** The unit's places (model units, hifi_unit_gen.py): its lid's well, and the display's glass in its window. */
const LID = { x: 0, z: 0.03, cut: 0.3, top: 0.3593 };
/** The display's window (hifi_unit_gen.py): its opening, the panel's front, the window's back 9 mm (model) in. */
const DISPLAY = { x0: -0.143, x1: 0.143, y0: 0.207, y1: 0.291, front: 0.425, back: 0.416 };
const LCD = { px: 524, py: 144 };
/** The keys as printed above them, left to right, and the prints' x (the keys' centres). */
const KEY_ACTS: HifiAct[] = ['play', 'stop', 'prev', 'next'];
const PRINT_X = [-0.1009, -0.0335, 0.0342, 0.1014];
/** A CD's hole and its printed face on the disc (model units: the disc is 0.24). */
const DISC = { r: 0.226, hole: 0.03 };

/** The wall behind the corner, in the corner's own space: its z at a given x, and the turn that sets a thing flat on it. */
export type HifiWall = { z: (x: number) => number; turn: number };

export function buildHifi(model: THREE.Object3D, cover: string, changed: () => void, wall: HifiWall): Hifi {
  const owned: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => { owned.push(x); return x; };
  // the file's own geometry, materials and textures go with the corner
  const seen = new Set<object>();
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (!seen.has(mesh.geometry)) { seen.add(mesh.geometry); keep(mesh.geometry); }
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (seen.has(m)) continue;
      seen.add(m); keep(m);
      for (const value of Object.values(m)) if (value instanceof THREE.Texture && !seen.has(value)) { seen.add(value); keep(value); }
    }
  });
  const part = (name: string) => {
    const o = model.getObjectByName(name) as THREE.Mesh | undefined;
    if (!o?.isMesh) throw new Error(`hifi model: ${name} missing`);
    return o;
  };
  model.updateMatrixWorld(true);
  /**
   * Moves a piece under `parent`, keeping its place in the file's space: its node carries the packer's dequantization
   * (pack-models.mjs), so its own position and scale are never overwritten. `origin`: where `parent` sits in that space.
   */
  const adopt = <T extends THREE.Object3D>(parent: THREE.Object3D, piece: T, origin?: THREE.Vector3) => {
    piece.updateWorldMatrix(true, false);
    const m = piece.matrixWorld.clone();
    if (origin) m.premultiply(new THREE.Matrix4().makeTranslation(-origin.x, -origin.y, -origin.z));
    parent.add(piece);
    m.decompose(piece.position, piece.quaternion, piece.scale);
    return piece;
  };
  /** A piece under a group of its own, which places and sizes it. */
  const held = (name: string) => {
    // a piece of several materials comes as a group of meshes
    const piece = model.getObjectByName(name);
    if (!piece) throw new Error(`hifi model: ${name} missing`);
    return adopt(new THREE.Group(), piece).parent as THREE.Group;
  };
  /** The middle of a control's face (its front-most plane), in the file's space. */
  const faceOf = (mesh: THREE.Mesh) => {
    const b = new THREE.Box3().setFromObject(mesh);
    return new THREE.Vector3((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, b.max.z);
  };
  /** The pieces carry their own gloss and metal (hifi_paint.py, hifi_unit_gen.py); the factors only scale them. */
  const tune = <T extends THREE.Object3D>(piece: T, env: number, metal = 1, rough = 1) => {
    piece.traverse((o) => {
      const material = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[] | undefined;
      for (const m of material ? (Array.isArray(material) ? material : [material]) : []) {
        m.envMapIntensity = env;
        m.metalness *= metal;
        m.roughness *= rough;
      }
    });
    return piece;
  };
  const mat = {
    // the unit's own paint (hifi_build.py's silver), for the parts built here
    silver: keep(new THREE.MeshStandardMaterial({ name: 'hifi-silver', color: 0xc3c6cc, metalness: 0.55, roughness: 0.38, envMapIntensity: 1 })),
    chrome: keep(new THREE.MeshStandardMaterial({ name: 'hifi-chrome', color: 0xdcdfe6, metalness: 1, roughness: 0.15, envMapIntensity: 1.1 })),
    well: keep(new THREE.MeshStandardMaterial({ name: 'hifi-well', color: 0x0e0f14, metalness: 0.1, roughness: 0.55, envMapIntensity: 0.5 })),
    // the lid's rim in the era's translucent blue, its window nearly clear
    blue: keep(new THREE.MeshStandardMaterial({ name: 'hifi-blue', color: 0x7083d6, metalness: 0.05, roughness: 0.12, emissive: 0x16206a, emissiveIntensity: 0.16, transparent: true, opacity: 0.5, envMapIntensity: 1.1, depthWrite: false })),
    lid: keep(new THREE.MeshStandardMaterial({ name: 'hifi-lid', color: 0xc3ccff, metalness: 0, roughness: 0.06, transparent: true, opacity: 0.08, envMapIntensity: 0.45, depthWrite: false })),
    // float glass: nearly clear seen from above, a mirror at a glance, its cut edges the green of the glass's depth
    glass: keep(floatGlass('hifi-glass', 0xd6ebe2, 0.05, 0.85)),
    glassEdge: keep(floatGlass('hifi-glass-edge', 0x4f9a7c, 0.62, 0.38)),
  };
  const group = new THREE.Group();
  group.name = 'hifi';

  /* ---------- the table: two glass shelves on the collars of four legs ---------- */
  const holeR = LEG.pole * LEG.r + 0.002;
  const shelf = (top: number) => {
    const shape = roundedRect(TABLE.w, TABLE.d, TABLE.corner);
    for (const x of [-TABLE.legX, TABLE.legX]) for (const z of [-TABLE.legZ, TABLE.legZ]) {
      const hole = new THREE.Path();
      // the shape lies in x/y and turns flat below, its y becoming -z
      hole.absarc(x, -z, holeR, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
    const geometry = keep(new THREE.ExtrudeGeometry(shape, { depth: TABLE.glass, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 2, curveSegments: 12 }));
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, top - TABLE.glass - 0.0015, 0);
    // the faces clear, the cut edges the green of thick float glass
    const mesh = new THREE.Mesh(geometry, [mat.glass, mat.glassEdge]);
    mesh.renderOrder = 2;
    return mesh;
  };
  group.add(shelf(TOP), shelf(LOWER));
  part('leg').material = mat.chrome;
  const leg = held('leg');
  for (const x of [-TABLE.legX, TABLE.legX]) for (const z of [-TABLE.legZ, TABLE.legZ]) {
    const l = x === -TABLE.legX && z === -TABLE.legZ ? leg : leg.clone();
    l.position.set(x, 0, z);
    l.scale.set(LEG.r, LEG.y, LEG.r);
    // each turned a little, so the collars' screws do not all face the room
    l.rotation.y = (x * 7 + z * 13) % Math.PI;
    group.add(l);
  }

  /* ---------- the unit ---------- */
  const unit = new THREE.Group();
  unit.name = 'hifi-unit';
  unit.position.set(0, TOP, RADIO.z);
  unit.scale.setScalar(RADIO.s);
  // the unit modelled clean (hifi_unit_gen.py): its shell, base, recesses and trims as flat materials
  // several materials: the loader makes it a group of meshes
  const shell = model.getObjectByName('radio-body');
  if (!shell) throw new Error('hifi model: radio-body missing');
  adopt(unit, tune(shell, 1));
  const lit = (source: THREE.Material | THREE.Material[]) => {
    const m = keep((source as THREE.MeshStandardMaterial).clone());
    m.emissive.setHex(0x3a3070);
    m.emissiveIntensity = 0;
    return m;
  };
  const disk = keep(new THREE.CircleGeometry(1, 40));
  const keys: HifiKey[] = [];
  KEY_ACTS.forEach((act, i) => {
    const cap = part(`radio-key-${i}`);
    const g = new THREE.Group();
    g.position.copy(faceOf(cap));
    g.name = `hifi-key-${act}`;
    g.userData.key = keys.length;
    adopt(g, cap, g.position);
    const material = lit(cap.material);
    cap.material = material;
    g.add(cap);
    unit.add(g);
    keys.push({ act, group: g, cap, material, hit: { x: 0, y: 0, r: 0.0185 }, face: 0, travel: 0.006 });
  });
  // the volume knob: the model's own, turning on its axis; its two halves turn it down and up
  const knobMesh = part('radio-knob');
  const knobGroup = new THREE.Group();
  knobGroup.position.copy(faceOf(knobMesh));
  knobGroup.name = 'hifi-knob';
  knobGroup.userData.knob = true;
  const knobMaterial = lit(knobMesh.material);
  knobMesh.material = knobMaterial;
  const knob = new THREE.Group();
  adopt(knob, knobMesh, knobGroup.position);
  // a lit index on its face shows where the volume stands
  const index = new THREE.Mesh(keep(new RoundedBoxGeometry(0.006, 0.018, 0.002, 1, 0.0015)), keep(new THREE.MeshBasicMaterial({ color: 0x8fb4ff, toneMapped: false })));
  index.position.set(0, 0.038, 0.0008);
  knob.add(index);
  knobGroup.add(knob);
  unit.add(knobGroup);
  for (const [act, side] of [['quieter', -1], ['louder', 1]] as const) {
    keys.push({ act, group: knobGroup, cap: knob, material: knobMaterial, hit: { x: side * 0.031, y: 0, r: 0.031 }, face: 0, travel: 0 });
  }
  // the power lamp, lit
  const lamp = new THREE.Mesh(disk, keep(new THREE.MeshBasicMaterial({ color: 0x3df08c, toneMapped: false })));
  lamp.scale.setScalar(0.0042);
  lamp.position.set(-0.275, 0.255, 0.4256);
  unit.add(lamp);
  // the symbols printed on the panel above the keys, and the headphones' over the socket
  const ink = keep(new THREE.MeshStandardMaterial({ name: 'hifi-print', map: keep(printTexture()), transparent: true, depthWrite: false, metalness: 0, roughness: 0.6, envMapIntensity: 0.3 }));
  ([...KEY_ACTS, 'phones'] as const).forEach((act, i) => {
    const g = new THREE.PlaneGeometry(0.026, 0.013);
    const uv = g.getAttribute('uv');
    for (let k = 0; k < uv.count; k++) uv.setX(k, (i + uv.getX(k)) / 5);
    const print = new THREE.Mesh(keep(g), ink);
    const [x, y] = act === 'phones' ? [0.1862, 0.0905] : [PRINT_X[i], 0.1665];
    print.position.set(x, y, 0.4253);
    unit.add(print);
  });

  // the disc window in the unit's round well: a bezel over its edge, the well's wall and floor, the disc, the spindle,
  // the blue lid
  const well = new THREE.Group();
  well.position.set(LID.x, 0, LID.z);
  unit.add(well);
  const lathe = (points: [number, number][], material: THREE.Material, y = 0, segments = 128) => {
    // outside-in: a lathe's faces look to the profile's right, so caps are drawn from the rim inwards
    const mesh = new THREE.Mesh(keep(new THREE.LatheGeometry(points.map(([r, h]) => new THREE.Vector2(r, h)), segments)), material);
    mesh.position.y = y;
    well.add(mesh);
    return mesh;
  };
  // its skirt reaches down into the finger notch in front of the lid
  lathe([[LID.cut + 0.0185, LID.top - 0.012], [LID.cut + 0.018, LID.top - 0.0003], [LID.cut + 0.013, LID.top + 0.0029], [LID.cut + 0.004, LID.top + 0.0041], [LID.cut - 0.005, LID.top + 0.0025], [LID.cut - 0.0075, LID.top - 0.0038]], mat.silver);
  lathe([[LID.cut - 0.0075, LID.top - 0.0038], [LID.cut - 0.009, LID.top - 0.0173], [LID.cut - 0.016, LID.top - 0.0198]], mat.well);
  const floor = new THREE.Mesh(keep(new THREE.CircleGeometry(LID.cut - 0.015, 96)), mat.well);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = LID.top - 0.0198;
  well.add(floor);
  const discY = LID.top - 0.0168;
  const disc = new THREE.Mesh(keep(new THREE.RingGeometry(DISC.hole, DISC.r, 128, 1)), discMaterial(cover, keep, changed));
  disc.geometry.rotateX(-Math.PI / 2);
  disc.position.y = discY;
  disc.name = 'hifi-disc';
  well.add(disc);
  lathe([[0.029, 0], [0.028, 0.0035], [0.021, 0.0058], [0, 0.0066]], mat.chrome, discY);
  const rim = lathe([[LID.cut - 0.0045, LID.top + 0.0022], [LID.cut - 0.0045, LID.top + 0.011], [LID.cut - 0.0105, LID.top + 0.0172], [LID.cut - 0.036, LID.top + 0.0192], [LID.cut - 0.056, LID.top + 0.0207], [LID.cut - 0.068, LID.top + 0.0222], [LID.cut - 0.075, LID.top + 0.0197], [LID.cut - 0.077, LID.top + 0.0137]], mat.blue);
  rim.renderOrder = 3;
  const dome = lathe([[LID.cut - 0.0765, LID.top + 0.0139], [0.2, LID.top + 0.0159], [0.12, LID.top + 0.0177], [0, LID.top + 0.0183]], mat.lid);
  dome.renderOrder = 4;
  const sheen = new THREE.Mesh(dome.geometry, keep(new THREE.MeshBasicMaterial({ map: keep(sheenTexture()), transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
  sheen.position.y = dome.position.y + 0.0004;
  sheen.renderOrder = 5;
  well.add(sheen);

  // The display as an LCD is built: the backlight at the back of its window, the segments a little in front of it (they
  // shift against it as the eye moves, and their shadow falls on it), a clear pane in the window's mouth that catches
  // the room's reflection at a glance. The segments are drawn by cdPlayer.drawScreen.
  const canvas = document.createElement('canvas');
  canvas.width = LCD.px;
  canvas.height = LCD.py;
  const lcdTexture = keep(new THREE.CanvasTexture(canvas));
  lcdTexture.colorSpace = THREE.SRGBColorSpace;
  lcdTexture.anisotropy = 4;
  const lcd = new THREE.Group();
  lcd.name = 'hifi-display';
  lcd.position.set((DISPLAY.x0 + DISPLAY.x1) / 2, (DISPLAY.y0 + DISPLAY.y1) / 2, 0);
  const w = DISPLAY.x1 - DISPLAY.x0, h = DISPLAY.y1 - DISPLAY.y0;
  const layer = (material: THREE.Material, z: number, inset: number, order: number, dx = 0, dy = 0) => {
    const m = new THREE.Mesh(keep(new THREE.PlaneGeometry(w - inset, h - inset)), material);
    m.position.set(dx, dy, z);
    m.renderOrder = order;
    lcd.add(m);
    return m;
  };
  layer(keep(new THREE.MeshBasicMaterial({ map: keep(backlightTexture()), toneMapped: false, color: new THREE.Color(0.86, 0.88, 0.96) })), DISPLAY.back + 0.0003, 0.002, 0);
  layer(keep(new THREE.MeshBasicMaterial({ map: lcdTexture, color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false, toneMapped: false })), DISPLAY.back + 0.0008, 0.006, 1, 0.0009, -0.0011);
  layer(keep(new THREE.MeshBasicMaterial({ map: lcdTexture, transparent: true, depthWrite: false, toneMapped: false })), DISPLAY.back + 0.0036, 0.006, 2);
  layer(keep(floatGlass('hifi-display-pane', 0xe4ecff, 0.035, 0.6)), DISPLAY.front - 0.0015, -0.002, 3);
  // and the pane's own glare, a soft diagonal streak
  layer(keep(new THREE.MeshBasicMaterial({ map: keep(sheenTexture()), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })), DISPLAY.front - 0.0013, -0.002, 4);
  unit.add(lcd);
  group.add(unit);

  /* ---------- the speakers, toed in ---------- */
  const speaker = tune(held('speaker'), 0.8);
  // the grille: the model's is crinkled noise; perforated steel over it, the drivers dark behind its holes
  speaker.add(grillePanel(keep));
  for (const side of [-1, 1] as const) {
    const s = side < 0 ? speaker : speaker.clone();
    s.scale.setScalar(SPEAKER.s);
    s.position.set(side * SPEAKER.x, TOP, SPEAKER.z);
    s.rotation.y = -side * SPEAKER.toe;
    s.name = side < 0 ? 'hifi-speaker-left' : 'hifi-speaker-right';
    group.add(s);
  }

  /* ---------- the cables: speaker wire to the unit's back, its mains lead to a socket in the wall ---------- */
  group.add(cables(group, unit, wall, keep));

  /* ---------- the lower shelf: two stacks of jewel cases, the album on top of one, and the remote ---------- */
  // built here: Tripo's jewel cases came with smudged AI prints and sawn edges; cases are mostly clear plastic anyway
  group.add(caseStacks(cover, keep, changed, keep(floatGlass('hifi-case-lid', 0xdfe6ee, 0.025, 0.35)), LOWER));
  const remote = tune(held('remote'), 0.7);
  remote.scale.setScalar(REMOTE.s);
  remote.position.set(REMOTE.x, LOWER, REMOTE.z);
  remote.rotation.y = REMOTE.rot;
  group.add(remote);

  /* ---------- contact shadows ---------- */
  const blob = keep(blobTexture());
  const shadow = (w: number, d: number, y: number, x: number, z: number, opacity: number) => {
    const m = new THREE.Mesh(keep(new THREE.PlaneGeometry(w, d)), keep(new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false, opacity, color: 0x000000, toneMapped: false })));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.renderOrder = 1;
    group.add(m);
  };
  shadow(TABLE.w * 1.25, TABLE.d * 1.5, 0.003, 0, 0, 0.55);

  // the silver parts' brushed grain (after the keys' materials are cloned: a clone does not keep the shader hook)
  const grain = keep(brushTexture());
  group.traverse((o) => {
    const material = (o as THREE.Mesh).material;
    for (const m of material ? (Array.isArray(material) ? material : [material]) : []) {
      if (/^hifi-(radio|radio-base|key|speaker)$/.test(m.name) && m instanceof THREE.MeshStandardMaterial) brushed(m, grain);
    }
  });

  return {
    group, disc, knob, keys,
    screen: { ctx: canvas.getContext('2d')!, texture: lcdTexture, width: LCD.px, height: LCD.py },
    view: { centre: new THREE.Vector3(0, TOP + 0.065, RADIO.z + 0.03), dir: new THREE.Vector3(0, Math.sin(0.86), Math.cos(0.86)), radius: 0.17 },
    owned,
  };
}

/* ---------- parts ---------- */

/**
 * The wiring (Dennis, 2026-10-07: "they need cables connecting to the player in the middle. and the player needs a cable
 * connected to a socket in the wall"): from each speaker's terminals a pair of speaker wire drops behind it onto the
 * glass and runs to the unit's back; the unit's mains lead goes over the shelf's back edge, down to the floor, along it
 * to the wall and up into the plug of a socket on the bricks.
 */
function cables(group: THREE.Group, unit: THREE.Group, wall: HifiWall, keep: <T extends { dispose(): void }>(x: T) => T) {
  group.updateMatrixWorld(true);
  const toLocal = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const at = (o: THREE.Object3D, x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyMatrix4(o.matrixWorld).applyMatrix4(toLocal);
  const rubber = keep(new THREE.MeshStandardMaterial({ name: 'hifi-cable', color: 0x1d1e22, metalness: 0, roughness: 0.55, envMapIntensity: 0.6 }));
  const out = new THREE.Group();
  out.name = 'hifi-cables';
  const tube = (points: THREE.Vector3[], r: number) => {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    out.add(new THREE.Mesh(keep(new THREE.TubeGeometry(curve, Math.max(24, points.length * 14), r, 8, false)), rubber));
  };
  const glass = TOP + 0.003;
  const back = RADIO.z - 0.49 * RADIO.s;
  for (const side of [-1, 1]) {
    const speaker = group.getObjectByName(side < 0 ? 'hifi-speaker-left' : 'hifi-speaker-right')!;
    // the terminals sit 0.24 up the speaker's back (model units, hifi_speaker_gen.py)
    for (const pole of [-1, 1]) {
      const start = at(speaker, pole * 0.045, 0.24, -0.475);
      const end = at(unit, side * 0.3, 0.09 + pole * 0.02, -0.495);
      const behind = Math.min(start.z, end.z) - 0.035;
      tube([start, new THREE.Vector3(start.x, (start.y + glass) / 2, start.z - 0.02), new THREE.Vector3(start.x - side * 0.01, glass, behind),
        new THREE.Vector3((start.x + end.x) / 2, glass, behind - 0.01), new THREE.Vector3(end.x, glass, end.z - 0.03), end], 0.0016);
    }
  }
  // the mains lead and its socket, on the wall behind the table's left back leg
  const sx = -0.24, sy = 0.24, sz = wall.z(sx);
  const lead = at(unit, -0.3, 0.07, -0.495);
  const edge = -TABLE.d / 2 - 0.006;
  tube([lead, new THREE.Vector3(lead.x, glass + 0.004, back - 0.02), new THREE.Vector3(lead.x - 0.02, glass, edge),
    new THREE.Vector3(lead.x - 0.03, TOP - 0.06, edge - 0.012), new THREE.Vector3(lead.x - 0.05, 0.08, (edge + sz) / 2),
    new THREE.Vector3(lead.x - 0.07, 0.004, sz + 0.06), new THREE.Vector3(sx + 0.04, 0.004, sz + 0.035),
    new THREE.Vector3(sx, 0.07, sz + 0.03), new THREE.Vector3(sx, sy - 0.03, sz + 0.03)], 0.0028);
  const socket = new THREE.Group();
  socket.position.set(sx, sy, sz);
  socket.rotation.y = wall.turn;
  const plate = keep(new THREE.MeshStandardMaterial({ name: 'hifi-socket', color: 0xd9d7d0, metalness: 0, roughness: 0.45, envMapIntensity: 0.6 }));
  const frame = new THREE.Mesh(keep(new RoundedBoxGeometry(0.08, 0.08, 0.012, 3, 0.006)), plate);
  frame.position.z = 0.006;
  // the plug in it: a round grip with its lead coming out underneath
  const plugMaterial = keep(new THREE.MeshStandardMaterial({ name: 'hifi-plug', color: 0x45474e, metalness: 0, roughness: 0.5, envMapIntensity: 0.6 }));
  const plug = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.019, 0.021, 0.034, 32).rotateX(Math.PI / 2)), plugMaterial);
  plug.position.z = 0.012 + 0.017;
  const sleeve = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.0055, 0.0045, 0.02, 16)), rubber);
  sleeve.position.set(0, -0.026, 0.03);
  socket.add(frame, plug, sleeve);
  out.add(socket);
  return out;
}

/**
 * Brushed silver without UVs: a streak map sampled from three sides in world space (the streaks run along x, and along
 * z on the sides), varying the gloss and a hair of the tone. Up close it reads as finely brushed metal; far off the
 * mip levels average it back to the flat paint.
 */
export function brushed(m: THREE.MeshStandardMaterial, grain: THREE.Texture) {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.brushMap = { value: grain };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBrushPos;\nvarying vec3 vBrushNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBrushPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvBrushNormal = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D brushMap;\nvarying vec3 vBrushPos;\nvarying vec3 vBrushNormal;\nfloat brushAt() {\n  vec3 w = pow(abs(normalize(vBrushNormal)), vec3(4.0));\n  w /= w.x + w.y + w.z;\n  vec3 p = vBrushPos * 7.0;\n  return texture2D(brushMap, p.zy).r * w.x + texture2D(brushMap, p.xz).r * w.y + texture2D(brushMap, p.xy).r * w.z;\n}')
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat brush = brushAt();\ndiffuseColor.rgb *= 0.965 + 0.07 * brush;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor * (0.78 + 0.44 * brush), 0.05, 1.0);');
  };
  m.customProgramCacheKey = () => 'hifi-brushed';
  m.needsUpdate = true;
}

/** Fine horizontal streaks that tile: each row its own level, drifting slowly along it. */
export function brushTexture() {
  const W = 512, H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < H; y++) {
    const row = rand(), phase = rand() * Math.PI * 2, wave = 1 + Math.floor(rand() * 4);
    for (let x = 0; x < W; x++) {
      // a whole number of slow waves per row, so the row joins itself where the map repeats
      const v = 0.5 + 0.34 * (row - 0.5) + 0.12 * Math.sin((x / W) * Math.PI * 2 * wave + phase) + 0.06 * (rand() - 0.5);
      const c = Math.round(Math.min(1, Math.max(0, v)) * 255), i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = c; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

/** An LCD's backlight: the era's blue, lighter at the top, falling off at the edges of the light guide. */
function backlightTexture() {
  const W = 256, H = 72;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#b2daff'); g.addColorStop(1, '#6aa6f4');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const edge = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.62);
  edge.addColorStop(0, 'rgba(10,30,80,0)'); edge.addColorStop(1, 'rgba(10,30,80,.35)');
  ctx.fillStyle = edge; ctx.fillRect(0, 0, W, H);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** The panel's prints in a strip of five cells: play/pause, stop, previous, next, headphones; dark ink, clear ground. */
function printTexture() {
  const cw = 128, ch = 64;
  const canvas = document.createElement('canvas');
  canvas.width = cw * 5; canvas.height = ch;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#2a2c33';
  const tri = (x: number, dir: 1 | -1, w = 15, h = 20) => { ctx.beginPath(); ctx.moveTo(x, ch / 2 - h / 2); ctx.lineTo(x + dir * w, ch / 2); ctx.lineTo(x, ch / 2 + h / 2); ctx.closePath(); ctx.fill(); };
  const bar = (x: number, w = 5, h = 20) => ctx.fillRect(x, ch / 2 - h / 2, w, h);
  let c = cw / 2;
  tri(c - 20, 1); bar(c + 2); bar(c + 11);
  c += cw; ctx.fillRect(c - 9, ch / 2 - 9, 18, 18);
  c += cw; bar(c - 18); tri(c - 1, -1); tri(c + 15, -1);
  c += cw; tri(c - 15, 1); tri(c + 1, 1); bar(c + 13);
  c += cw;
  ctx.strokeStyle = '#2a2c33'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(c, ch / 2 + 4, 13, Math.PI, 0); ctx.stroke();
  ctx.fillRect(c - 16, ch / 2 + 2, 7, 12); ctx.fillRect(c + 9, ch / 2 + 2, 7, 12);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * The speaker's grille as perforated steel, in the speaker model's units (its grille opening measured on the model):
 * a hex field of round holes: through them the woofer's and the tweeter's dark cones with their dust caps and lighter
 * surrounds, the cabinet's inside elsewhere.
 */
function grillePanel(keep: <T extends { dispose(): void }>(x: T) => T) {
  // over the opening and the frame's inner bevel, whose bake is ragged where the remesh cuts the corner
  const W = 0.645, H = 0.823, R = 0.032, cy = 0.5395, z = 0.437;
  const px = 1024, py = Math.round(px * H / W);
  const canvas = document.createElement('canvas');
  canvas.width = px; canvas.height = py;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#5b5e66';
  ctx.fillRect(0, 0, px, py);
  const toPx = (y: number) => (1 - (y - (cy - H / 2)) / H) * py;
  const woofer = { y: toPx(0.4304), r: (0.265 / W) * px }, tweeter = { y: toPx(0.8346), r: (0.106 / W) * px };
  const step = 9, hole = 2.7;
  for (let row = 0, y = step / 2; y < py; row++, y += step * 0.866) {
    for (let x = (row % 2) * step / 2; x < px + step; x += step) {
      const d = (c: { y: number; r: number }) => Math.hypot(x - px / 2, y - c.y) / c.r;
      const behind = Math.min(d(woofer), d(tweeter));
      // the drivers read as darker discs with a lighter surround ring, the cabinet's inside elsewhere
      ctx.fillStyle = behind < 0.3 ? '#2a2b30' : behind < 0.86 ? '#060607' : behind < 1 ? '#3a3c42' : '#18191c';
      ctx.beginPath(); ctx.arc(x, y, hole, 0, Math.PI * 2); ctx.fill();
    }
  }
  const texture = keep(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const shape = roundedRect(W, H, R);
  const geometry = keep(new THREE.ShapeGeometry(shape, 8));
  const uv = geometry.getAttribute('uv'), pos = geometry.getAttribute('position');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / W + 0.5, pos.getY(i) / H + 0.5);
  const mesh = new THREE.Mesh(geometry, keep(new THREE.MeshStandardMaterial({ name: 'hifi-grille', map: texture, metalness: 0.3, roughness: 0.5, envMapIntensity: 0.8 })));
  mesh.position.set(0, cy, z);
  mesh.name = 'hifi-grille';
  return mesh;
}

/**
 * Glass that reads as glass without a transmission pass (an extra render of the hall): premultiplied blending, so the
 * room's reflection is added at full strength while the glass itself only tints what lies behind it; its cover rises
 * with the Fresnel term, nearly clear face-on and a mirror at grazing angles, as a shelf seen across the room is.
 * `alpha`: the tint's cover face-on; `glance`: what the grazing angle adds to it.
 */
function floatGlass(name: string, tint: number, alpha: number, glance: number) {
  const m = new THREE.MeshStandardMaterial({ name, color: tint, metalness: 0, roughness: 0.025, envMapIntensity: 1.6, transparent: true, depthWrite: false });
  m.blending = THREE.CustomBlending;
  m.blendSrc = THREE.OneFactor;
  m.blendDst = THREE.OneMinusSrcAlphaFactor;
  m.blendSrcAlpha = THREE.OneFactor;
  m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.glassCover = { value: new THREE.Vector2(alpha, glance) };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec2 glassCover;')
      .replace('#include <opaque_fragment>', [
        'float glassFacing = saturate( dot( normal, normalize( vViewPosition ) ) );',
        'float glassA = clamp( glassCover.x + glassCover.y * pow( 1.0 - glassFacing, 4.0 ), 0.0, 1.0 );',
        'gl_FragColor = vec4( totalDiffuse * glassA + totalSpecular, glassA );',
      ].join('\n'));
  };
  m.customProgramCacheKey = () => 'hifi-float-glass';
  return m;
}


function roundedRect(w: number, d: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** The album's cover printed over the whole disc, a thin silver rim outside the print. */
function discMaterial(cover: string, keep: <T extends { dispose(): void }>(x: T) => T, changed: () => void) {
  const size = 1024, c = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const texture = keep(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const draw = (image: CanvasImageSource | null) => {
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, c, 0, Math.PI * 2);
    ctx.clip();
    if (image) ctx.drawImage(image, 0, 0, size, size);
    else { ctx.fillStyle = '#4b4760'; ctx.fillRect(0, 0, size, size); }
    const rim = ctx.createRadialGradient(c, c, c * 0.955, c, c, c);
    rim.addColorStop(0, 'rgba(206,210,222,0)');
    rim.addColorStop(0.18, 'rgba(206,210,222,.92)');
    rim.addColorStop(1, 'rgba(160,165,182,.95)');
    ctx.fillStyle = rim;
    ctx.fillRect(0, 0, size, size);
    // the clear hub and its stacking ring, as on any pressed disc
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(190,196,210,.85)';
    ctx.beginPath(); ctx.arc(c, c, c * 0.3, 0, Math.PI * 2); ctx.arc(c, c, c * 0.2, 0, Math.PI * 2, true); ctx.fill();
    ctx.restore();
    texture.needsUpdate = true;
    changed();
  };
  draw(null);
  const image = new Image();
  image.decoding = 'async';
  image.onload = () => draw(image);
  image.src = cover;
  // nearly matte: under the hall's ceiling lamps a glossy print mirrored their brightness over the whole cover
  return keep(new THREE.MeshStandardMaterial({ map: texture, color: new THREE.Color(0.85, 0.85, 0.85), roughness: 0.6, metalness: 0, envMapIntensity: 0.08 }));
}

/** The era's wordless covers: two-colour gradients with one mark each. */
const SLEEVES: { a: string; b: string; mark: 'ring' | 'bars' | 'dot' | 'wave' | 'grid' | 'sun' }[] = [
  { a: '#f2b134', b: '#c2391b', mark: 'sun' }, { a: '#3ac2d6', b: '#22306e', mark: 'wave' }, { a: '#ececec', b: '#9a9aa2', mark: 'dot' },
  { a: '#e94f8a', b: '#5b1e6f', mark: 'ring' }, { a: '#9be15d', b: '#1f6b47', mark: 'bars' }, { a: '#1b1b20', b: '#3c3f4c', mark: 'grid' },
  { a: '#ffd8a8', b: '#e07a5f', mark: 'ring' }, { a: '#5d7bff', b: '#16163a', mark: 'sun' }, { a: '#c9c2f2', b: '#6a5fb0', mark: 'wave' },
  { a: '#f6e27a', b: '#3d8f7a', mark: 'bars' }, { a: '#ff8a5b', b: '#2a1f3d', mark: 'dot' }, { a: '#d7dde6', b: '#46566e', mark: 'grid' },
];
/** A jewel case in metres: the black tray, the printed inlay under the clear lid, the spine card on the hinge side. */
const CASE = { w: 0.142, d: 0.125, h: 0.0104, tray: 0.0062 };

/**
 * Two stacks of jewel cases on the lower shelf, memoryrot's album on top of the left one (Tripo's cases came with
 * smudged AI prints). One mesh per material: the trays, the paper (inlays and spines from one atlas), the clear lids.
 */
function caseStacks(cover: string, keep: <T extends { dispose(): void }>(x: T) => T, changed: () => void, lidMaterial: THREE.Material, shelf: number) {
  const size = 1024, cell = 256, album = SLEEVES.length;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const at = (i: number) => ({ x: (i % 4) * cell, y: Math.floor(i / 4) * cell });
  // the spines: thin bands in the last cell
  const spine = { x: 3 * cell, y: 3 * cell, band: Math.floor(cell / 14) };
  SLEEVES.forEach((s, i) => {
    const { x, y } = at(i), c = cell;
    const g = ctx.createLinearGradient(x, y, x + c, y + c);
    g.addColorStop(0, s.a); g.addColorStop(1, s.b);
    ctx.fillStyle = g; ctx.fillRect(x, y, c, c);
    ctx.save(); ctx.translate(x + c / 2, y + c / 2);
    ctx.strokeStyle = ctx.fillStyle = 'rgba(255,255,255,.72)'; ctx.lineWidth = 7;
    if (s.mark === 'ring') { ctx.beginPath(); ctx.arc(0, 0, c * 0.28, 0, Math.PI * 2); ctx.stroke(); }
    else if (s.mark === 'dot') { ctx.fillStyle = s.b; ctx.beginPath(); ctx.arc(c * 0.12, -c * 0.1, c * 0.17, 0, Math.PI * 2); ctx.fill(); }
    else if (s.mark === 'bars') for (let k = 0; k < 5; k++) ctx.fillRect(-c * 0.35, -c * 0.3 + k * c * 0.14, c * (0.3 + 0.1 * k), c * 0.05);
    else if (s.mark === 'wave') { ctx.beginPath(); for (let t = -0.4; t <= 0.4; t += 0.01) ctx.lineTo(t * c, Math.sin(t * 18) * c * 0.1); ctx.stroke(); }
    else if (s.mark === 'grid') {
      ctx.strokeStyle = 'rgba(190,200,255,.55)'; ctx.lineWidth = 3;
      for (let k = -3; k <= 3; k++) {
        ctx.beginPath(); ctx.moveTo(k * c * 0.1, -c * 0.3); ctx.lineTo(k * c * 0.1, c * 0.3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-c * 0.3, k * c * 0.1); ctx.lineTo(c * 0.3, k * c * 0.1); ctx.stroke();
      }
    }
    else { ctx.fillStyle = 'rgba(255,250,220,.8)'; ctx.beginPath(); ctx.arc(0, c * 0.08, c * 0.2, Math.PI, 0); ctx.fill(); }
    ctx.restore();
    const b = spine.y + i * spine.band;
    ctx.fillStyle = s.a; ctx.fillRect(spine.x, b, c, spine.band);
    ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(spine.x + 40, b + spine.band / 2 - 1, 60 + (i * 37) % 90, 2);
  });
  const texture = keep(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const drawAlbum = (image: CanvasImageSource | null) => {
    const { x, y } = at(album);
    ctx.fillStyle = '#26232f'; ctx.fillRect(x, y, cell, cell);
    if (image) ctx.drawImage(image, x, y, cell, cell);
    const b = spine.y + album * spine.band;
    ctx.fillStyle = '#1f1d27'; ctx.fillRect(spine.x, b, cell, spine.band);
    ctx.fillStyle = '#b79ce9'; ctx.fillRect(spine.x + 40, b + spine.band / 2 - 1, 80, 2);
    texture.needsUpdate = true;
    changed();
  };
  drawAlbum(null);
  const image = new Image();
  image.decoding = 'async';
  image.onload = () => drawAlbum(image);
  image.src = cover;
  const toCell = (g: THREE.BufferGeometry, u0: number, v0: number, u1: number, v1: number) => {
    const uv = g.getAttribute('uv');
    for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * (u1 - u0), v0 + uv.getY(k) * (v1 - v0));
    return g;
  };
  const trays: THREE.BufferGeometry[] = [], paper: THREE.BufferGeometry[] = [], lids: THREE.BufferGeometry[] = [];
  const place = (g: THREE.BufferGeometry, m: THREE.Matrix4, list: THREE.BufferGeometry[]) => { g.applyMatrix4(m); list.push(g); };
  const addCase = (sleeve: number, m: THREE.Matrix4) => {
    place(new THREE.BoxGeometry(CASE.w, CASE.tray, CASE.d).translate(0, CASE.tray / 2, 0), m, trays);
    const { x, y } = at(sleeve);
    const inlay = toCell(new THREE.PlaneGeometry(CASE.w - 0.016, CASE.d - 0.006), (x + 2) / size, 1 - (y + cell - 2) / size, (x + cell - 2) / size, 1 - (y + 2) / size);
    place(inlay.rotateX(-Math.PI / 2).translate(0.005, CASE.tray + 0.0004, 0), m, paper);
    const b = spine.y + sleeve * spine.band;
    const card = toCell(new THREE.BoxGeometry(0.0012, CASE.h - 0.0016, CASE.d - 0.004), spine.x / size, 1 - (b + spine.band - 1) / size, (spine.x + cell) / size, 1 - (b + 1) / size);
    place(card.translate(-CASE.w / 2 + 0.0012, (CASE.h - 0.0016) / 2 + 0.0004, 0), m, paper);
    place(new THREE.BoxGeometry(CASE.w, CASE.h - CASE.tray + 0.0006, CASE.d).translate(0, (CASE.h + CASE.tray) / 2 - 0.0003, 0), m, lids);
  };
  const stack = (x: number, z: number, rot: number, sleeves: number[]) => sleeves.forEach((sleeve, k) => {
    // stacked by hand: a few millimetres off and a little turned, case on case
    const jitter = Math.sin(sleeve * 12.9 + k * 3.1);
    const m = new THREE.Matrix4().makeRotationY(rot + jitter * 0.04);
    m.setPosition(x + jitter * 0.003, shelf + k * CASE.h, z + Math.cos(sleeve * 7.7) * 0.003);
    addCase(sleeve, m);
  });
  stack(-0.2, 0.02, 0.05, [0, 1, 2, 3, 4, 5, 6, album]);
  stack(0.02, 0.04, Math.PI + 0.24, [7, 8, 9, 10, 11]);
  const merge = (list: THREE.BufferGeometry[]) => keep(mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g))));
  const group = new THREE.Group();
  group.name = 'hifi-cases';
  group.add(
    new THREE.Mesh(merge(trays), keep(new THREE.MeshStandardMaterial({ name: 'hifi-case-tray', color: 0x141519, metalness: 0, roughness: 0.38, envMapIntensity: 0.6 }))),
    new THREE.Mesh(merge(paper), keep(new THREE.MeshStandardMaterial({ name: 'hifi-case-paper', map: texture, metalness: 0, roughness: 0.55, envMapIntensity: 0.25 }))),
  );
  const lid = new THREE.Mesh(merge(lids), lidMaterial);
  lid.renderOrder = 2;
  group.add(lid);
  return group;
}

function sheenTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(size / 2, size / 2);
  ctx.rotate(-0.62);
  for (const [x, w, a] of [[-38, 46, 0.55], [26, 16, 0.32]] as const) {
    const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, `rgba(255,255,255,${a})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - w, -size, w * 2, size * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function blobTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d')!;
  const fade = g.createRadialGradient(64, 64, 14, 64, 64, 64);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fade;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}
