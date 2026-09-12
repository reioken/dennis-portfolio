/**
 * Die Spielhalle in WebGL. Eine Reihe Automaten entlang der X-Achse, die Kamera
 * fährt zum fokussierten Automaten. Bildschirme zeigen echte Captures, Marquees
 * leuchten in der Produktfarbe, der Boden spiegelt.
 *
 * Automaten sind vorerst aus Platzhalter-Geometrie gebaut (buildPlaceholder).
 * Echte GLB-Modelle werden über MODELS pro Typ geladen und ersetzen den
 * Platzhalter; das Modell braucht ein Mesh namens "screen" (Bildschirm) und
 * optional "marquee" (Leuchtschild), auf die wir Texturen legen.
 */
import * as THREE from 'three';
import { createHallFloor } from './floorReflectionShader';
import { HallLighting } from './hallLighting';
import { BlueCat } from './blueCat';
import { ScreenDissolve } from './screenDissolve';
import { textTexture } from './marqueeTexture';
import { tvPresentation } from './presentation.mjs';
import { ROOM_POWER_MS, collectRoomPowerTargets, withRoomPower } from './roomPower.mjs';
import { makeGlassWear, clearScreenGlass, addPanelWear } from './hardwareWear';
import { WallPaint } from './wallPaint';
import { cabinetWidth, stationPositions, nearestStation, mascotOffset } from './hallLayout';
import { makeSurfaceMaps, finishHardware, artworkAspect } from './cabinetMaterials';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import type { HallItem, HallMachine, MachineKind } from './Hall';

/** Kamerapose: Reihe (Halle), vor dem Automaten (Projektseite), vor dem Bildschirm (Arcade) */
/** hall = Reihe · zoom = Automat mit Panel · screen = Close-up (Bildschirm + Bedienfeld) · play = Bildschirm mit Web-Build */
export type Pose = 'hall' | 'zoom' | 'play' | 'screen';
/**
 * Freier Bereich des Viewports, in dem der Automat stehen soll: Mitte (cx, cy als Anteil von
 * Breite/Höhe) und Ausdehnung (fw, fh als Anteil). Desktop: links neben dem Panel; Phone: über dem Sheet.
 */
/**
 * Freier Bereich im Viewport (Anteile 0–1): Mitte, Breite, Höhe. `ax` = rechte Kante, an der die
 * Station rechtsbündig steht („Schild am Exponat“) — ohne `ax` wird sie im Bereich zentriert.
 */
export type Frame = {
  cx: number;
  cy: number;
  fw: number;
  fh: number;
  /** rechte Kante, an der die Station rechtsbündig steht (Projektseiten) */
  ax?: number;
  /** linke Kante, an der die Station linksbündig steht (Über mich: Automat am linken Rand) */
  al?: number;
  /** Close-up nur auf den Bildschirm (Phone) */
  tight?: boolean;
};
/** Bedienelement-Aktion aus der Seite (hall:ctl) — Glühen und Bewegung des Meshes */
export type CtlAction = 'lit' | 'dim' | 'hover' | 'press' | 'release' | 'idle';
/** Namen der Bedienelemente in den Modellen (scripts/models/blender/*_gen.py) */
const CTL_NAME = /^(joy|btn|btn_\d+|start_\d+|trackball|tbtn_\d+|kbtn_\d+|sel_\d+)$/;
/**
 * Bedienelement: `node` ist eine Pivot-Gruppe an der Unterkante des Teils (Plattenseite) — der
 * Optimizer (quantize) legt den Ursprung des Meshes sonst in dessen Mitte, dann würde der Joystick
 * um die Schaftmitte kippen. Glühen läuft über das eigene Material.
 */
/** Fernseher-Rig: Laufwagen + Arm bewegen sich in x, das Gerät hängt am Arm und schwingt leicht nach */
type Tv = {
  rig: THREE.Group;
  hang: THREE.Group;
  wheels: THREE.Mesh[];
  screen: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  /** Bias-Licht: echtes Flächenlicht auf die Ziegelwand (Desktop) — Lite: weicher elliptischer Schein */
  light?: THREE.RectAreaLight;
  glow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  /** Kanalwechsel: Schnee über dem Bild, solange der Fernseher fährt oder gerade umgeschaltet hat */
  noise: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  noiseTex: THREE.Texture;
  staticUntil: number;
  staticMix: number;
  /** Fahrt auf der Schiene als Tween (zeitbasiert, nicht bildratenabhängig) */
  from: number;
  to: number;
  t0: number;
  dur: number;
  /** Kanalwechsel: Schnee, dann eine Weile das Logo, dann weich zu den Captures */
  phase: 'static' | 'logo' | 'fade' | 'shots';
  phaseAt: number;
  led: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  /** Plane-UVs normal bzw. in v gespiegelt — glTF-Texturen (flipY aus) brauchen die gespiegelte */
  geoN: THREE.PlaneGeometry;
  geoF: THREE.PlaneGeometry;
  canvas: HTMLCanvasElement;
  tex: THREE.CanvasTexture;
  key: string;
  /** Logo-Karte auf eigener Fläche (Crossfade über Opazität) */
  logo: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  logoCanvas: HTMLCanvasElement;
  logoTex: THREE.CanvasTexture;
  logoKey: string;
  /** x-Bereich der Schiene (erster … letzter Automat) */
  range: [number, number];
  lastX: number;
  swing: number;
  vel: number;
};
type CtlMat = { mat: THREE.MeshStandardMaterial; base: number; /** eigenes Emissive aus dem Modell (Kappe, brand_lit) — sonst glüht das Teil in seiner Farbe nach */ own: boolean };
/**
 * `level` ist die Erregung −1 … 1: −1 gedimmt (nicht gemappt im Close-up), 0 Ruhe (Halle/Zoom, wie im
 * Modell), 0.35 gemappt, 0.6 Hover, 1 Druck. Eigene Emissives skalieren um ihre Ruhestärke, die anderen
 * Teile leuchten erst ab 0 zusätzlich in ihrer eigenen Farbe.
 */
type Ctl = {
  node: THREE.Object3D;
  obj: THREE.Object3D;
  /** Was sich beim Drücken bewegt: Kappe, Schaft + Ball — Ringe und Unterlegscheiben bleiben stehen */
  move: THREE.Group;
  /** Trackball-Kugel: dreht sich statt zu kippen */
  spin?: THREE.Mesh;
  mats: CtlMat[];
  level: number;
  goal: number;
  pressAt: number;
  pressK: number;
  joyDir: -1 | 1;
  pos: THREE.Vector3;
  rot: THREE.Euler;
};
const CTL_LEVEL: Record<CtlAction, number> = { idle: 0, dim: -1, lit: 0.35, release: 0.35, hover: 0.6, press: 1 };
type Extent = { h: number; w: number; d: number; cx: number; zc: number; /** Unterkante (Boden = 0) */ y0: number };
type ScreenFrame = { center: THREE.Vector3; normal: THREE.Vector3; w: number; h: number; corners: THREE.Vector3[] };

export const SPACING = 2.0; // Ceiling fixture rhythm; cabinets use measured widths.
const TEX = '/textures/quaternius';

const NEAR = 3;

/**
 * Echte Modelle pro Automatentyp. `height` normiert die Modellhöhe in Metern, `screen` legt
 * eine Bildschirmfläche vor die Front (für Modelle ohne eigenes "screen"-Mesh).
 * Cabinet/Terminal/Jukebox bleiben Platzhalter, bis die Sketchfab-Downloads da sind.
 */
type ModelSpec = {
  url: string;
  height: number;
  /** Unterkante in Metern (Standard 0 = Boden) */
  y?: number;
  z?: number;
  rotY?: number;
  screen?: { w: number; h: number; y: number; x?: number; zOffset?: number };
  /** Mesh-Namen, die als Bildschirm gelten */
  screenNames?: string[];
  /** Material-Namen, die in der Produktfarbe eingefärbt werden */
  tintMaterials?: string[];
};
/** Pro Produkt generierte Automaten (Blender-Generator, scripts/models/blender/cabinet_gen.py) */
export const MODELS_BY_SLUG: Record<string, ModelSpec> = {
  'echo-frequency': { url: '/models/cab-echo-frequency.glb', height: 1.9, screenNames: ['screen'] },
  carillon: { url: '/models/cab-carillon.glb', height: 1.98, screenNames: ['screen'] },
  'cab-no-9': { url: '/models/cab-cab-no-9.glb', height: 1.86, screenNames: ['screen'] },
  'saute-survivors': { url: '/models/cab-saute-survivors.glb', height: 1.9, screenNames: ['screen'] },
  // Apps: Terminals (Desktop), Kiosk-Türme (Phone), Jukebox (Audio) — scripts/models/blender/machine_gen.py
  nexus: { url: '/models/mach-nexus.glb', height: 1.55, screenNames: ['screen'] },
  riftback: { url: '/models/mach-riftback.glb', height: 1.55, screenNames: ['screen'] },
  riftcast: { url: '/models/mach-riftcast.glb', height: 1.55, screenNames: ['screen'] },
  lowlight: { url: '/models/mach-lowlight.glb?v=babdc201c647', height: 1.65, screenNames: ['screen'] },
  berry: { url: '/models/mach-berry.glb', height: 1.95, screenNames: ['screen'] },
  safeplate: { url: '/models/mach-safeplate.glb', height: 1.95, screenNames: ['screen'] },
  angry: { url: '/models/mach-angry.glb', height: 1.95, screenNames: ['screen'] },
  briefly: { url: '/models/mach-briefly.glb', height: 1.95, screenNames: ['screen'] },
  mina: { url: '/models/mach-mina.glb', height: 1.95, screenNames: ['screen'] },
  hookline: { url: '/models/mach-hookline.glb', height: 1.6, screenNames: ['screen'] },
};
export const MODELS: Partial<Record<MachineKind | 'kasse' | 'phone', ModelSpec>> = {
  kiosk: { url: '/models/vending-machine.glb', height: 1.95, screen: { w: 0.42, h: 0.74, y: 1.3, x: -0.1, zOffset: 0.06 }, tintMaterials: ['VendingMachine_Albedo'] },
  phone: { url: '/models/payphone.glb', height: 1.7, y: 0, z: 0.1 },
};

export type SceneCallbacks = {
  onPick: (index: number) => void;
  onOpen: (index: number) => void;
  /** Klick auf den Bildschirm des fokussierten Automaten (nur außerhalb der Halle) */
  onScreenClick?: () => void;
  /** Klick ins Leere (Wand, Boden) außerhalb der Halle — zurück eine Stufe */
  onBackdrop?: () => void;
};

type Machine = {
  index: number;
  item: HallItem;
  group: THREE.Group;
  housing?: THREE.Object3D;
  screen?: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  marquee?: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  marqueeGlow?: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  light?: THREE.PointLight;
  textures: (THREE.Texture | null)[];
  /** dieselben Captures ohne Letterbox — der Fernseher zeigt sie im eigenen Format */
  raw: (THREE.Texture | null)[];
  /** vorab dekodierte, auf ≤ 1280 px verkleinerte Bitmaps der Captures — drawImage ohne Hauptthread-Stau */
  bitmaps: (ImageBitmap | null)[];
  screenIdx: number;
  dissolve?: ScreenDissolve;
  loaded: boolean;
  sprite?: THREE.Sprite;
  /** Sprite-Sheet-Animation der Figur (Frame-Raster, fps) */
  spriteAnim?: { tex: THREE.Texture; cols: number; rows: number; frames: number; fps: number; frame: number };
  model?: THREE.Object3D;
  props: THREE.Object3D[];
  /** Bildschirm/Marquee stammen aus einem glTF-Modell (UV-Ursprung oben links → flipY aus) */
  gltfUv?: boolean;
  brand: THREE.Color;
  /** Ausdehnung der Station (gecacht, verfällt beim Nachladen von Modellen) */
  extent?: Extent;
  /** Lage des Bildschirms in Weltkoordinaten (gecacht) */
  screenFrame?: ScreenFrame;
  /** Bedienelemente des Modells (joy, btn_0 …): Pivot an der Plattenkante, Mesh, eigenes Material fürs Glühen */
  ctl: Map<string, Ctl>;
  /** Weltbox aller Bedienelemente (gecacht) */
  ctlBox?: THREE.Box3 | null;
};

const isMachine = (it: HallItem): it is HallMachine => it.kind !== 'kasse' && it.kind !== 'phone';
// Dieselbe Datei (z. B. nori.glb als Figur und als Preis) nur einmal laden
THREE.Cache.enabled = true;

/**
 * Die Generatoren exportieren jedes Material als MeshPhysicalMaterial (Clearcoat/Specular-Erweiterungen) —
 * ohne echten Clearcoat kostet das nur Shader-Varianten und doppelte BRDF-Auswertung. Auf Standard zurück.
 */
function simplifyMaterial(mesh: THREE.Mesh) {
  const mat = mesh.material as THREE.MeshPhysicalMaterial;
  if (!mat || !mat.isMeshPhysicalMaterial) return;
  if (mat.clearcoat >= 0.05 || mat.transmission > 0 || mat.sheen > 0 || mat.iridescence > 0) return;
  const std = new THREE.MeshStandardMaterial();
  std.copy(mat);
  std.name = mat.name;
  mesh.material = std;
  mat.dispose();
}

/** Große Texturen (4096²) auf 1024 px bringen — spart Dekodierzeit und hunderte MB VRAM */
function capTexture(mat: THREE.MeshStandardMaterial, max = 1024) {
  const map = mat.map;
  const img = map?.image as { width?: number; height?: number } | undefined;
  if (!map || !img?.width || !img.height || Math.max(img.width, img.height) <= max) return;
  const k = max / Math.max(img.width, img.height);
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  c.getContext('2d')!.drawImage(map.image as CanvasImageSource, 0, 0, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = map.colorSpace;
  t.flipY = map.flipY;
  t.wrapS = map.wrapS;
  t.wrapT = map.wrapT;
  t.anisotropy = map.anisotropy;
  mat.map = t;
  mat.needsUpdate = true;
  map.dispose();
}
const vecOk = (v: THREE.Vector3) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
const frameOk = (f: Frame) => Number.isFinite(f.cx) && Number.isFinite(f.cy) && f.fw > 0 && f.fh > 0 && (f.ax === undefined || Number.isFinite(f.ax));

/**
 * Marquee-/Schild-Textur: Logo (optional) + Name in der Produktfarbe, mit Neon-Saum.
 * Das Logo wird nachgeladen; die Textur aktualisiert sich dann selbst.
 */
/** Seitenkunst: Markenfarbe als Verlauf mit feinem Raster — gibt jedem Automaten sein Gesicht */
function sideArtTexture(color: string, color2: string, artwork?: string, ready?: () => void) {
  const w = 512, h = 1024;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  const draw = (img?: HTMLImageElement) => {
    ctx.fillStyle = '#0a0d14'; ctx.fillRect(0, 0, w, h);
    if (img) {
      const scale = Math.max(w / img.width, h / img.height);
      ctx.drawImage(img, (w-img.width*scale)/2, (h-img.height*scale)/2, img.width*scale, img.height*scale);
      ctx.fillStyle = '#080b1455'; ctx.fillRect(0,0,w,h);
    }
    const shade = ctx.createLinearGradient(0,0,0,h);
    shade.addColorStop(0,'#080b1422'); shade.addColorStop(.55,'#080b1477'); shade.addColorStop(1,'#080b14ee');
    ctx.fillStyle = shade; ctx.fillRect(0,0,w,h);
    ctx.lineWidth = 2;
    for (let i=0;i<6;i++) {
      ctx.strokeStyle = i % 2 ? color2 : color;
      ctx.globalAlpha = .22;
      ctx.beginPath(); ctx.ellipse(w*.25,h*.72,w*(.3+i*.16),h*(.18+i*.1),-.4,0,Math.PI*2); ctx.stroke();
    }
    ctx.globalAlpha = .8; ctx.fillStyle=color; ctx.fillRect(12,24,3,h-48); ctx.globalAlpha=1;
    t.needsUpdate=true; ready?.();
  };
  draw();
  if (artwork) { const img=new Image(); img.onload=()=>draw(img); img.src=artwork; }
  return t;
}

/** Bedienkarte unter dem Bildschirm: Steuerung in Mono auf Karton, in der Markenfarbe gerahmt */
function cardTexture(controls: string, color: string, heading = 'STEUERUNG') {
  // doppelte Auflösung: im Close-up füllt die Karte mehrere hundert Pixel, 512 px wurden matschig
  const w = 1024;
  const h = 272;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#efe7cf';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = color;
  ctx.lineWidth = 10;
  ctx.strokeRect(12, 12, w - 24, h - 24);
  const items = controls
    .split(' · ')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);
  ctx.fillStyle = color;
  ctx.font = `700 30px "Outfit Variable", Outfit, system-ui, sans-serif`;
  ctx.letterSpacing = '0.18em';
  ctx.textBaseline = 'middle';
  ctx.fillText(heading, 48, 60);
  ctx.fillStyle = '#1b1a17';
  ctx.font = `600 42px ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace`;
  ctx.letterSpacing = '0.02em';
  items.forEach((it, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    ctx.fillText(it.toUpperCase().slice(0, 22), 48 + col * (w / 2 - 24), 132 + row * 68, w / 2 - 80);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/**
 * Fläche auf der dünnen, zur Kamera zeigenden Seite eines Kastens (z. B. die Bedienkarte) — die
 * UVs des Kastens sind egal, die Fläche erbt Lage und Neigung des Meshes.
 */
function frontPlane(mesh: THREE.Mesh, mat: THREE.Material) {
  const g = mesh.geometry;
  g.computeBoundingBox();
  const bb = g.boundingBox;
  if (!bb) return null;
  const size = bb.getSize(new THREE.Vector3());
  const center = bb.getCenter(new THREE.Vector3());
  const axes: ('x' | 'y' | 'z')[] = ['x', 'y', 'z'];
  const thin = axes.reduce((a, b) => (size[a] <= size[b] ? a : b));
  const [u, v] = axes.filter((a) => a !== thin) as [('x' | 'y' | 'z'), ('x' | 'y' | 'z')];
  mesh.updateWorldMatrix(true, false);
  const n = new THREE.Vector3();
  n[thin] = 1;
  const outward = n.clone().transformDirection(mesh.matrixWorld).z >= 0 ? 1 : -1;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(size[u], size[v]), mat);
  const pos = center.clone();
  pos[thin] = outward > 0 ? bb.max[thin] + 0.0006 : bb.min[thin] - 0.0006;
  plane.position.copy(pos);
  // Ebene liegt in der u/v-Ebene und schaut entlang der dünnen Achse nach außen
  if (thin === 'z') plane.rotation.y = outward > 0 ? 0 : Math.PI;
  else if (thin === 'y') plane.rotation.x = outward > 0 ? -Math.PI / 2 : Math.PI / 2;
  else plane.rotation.y = outward > 0 ? Math.PI / 2 : -Math.PI / 2;
  // PlaneGeometry spannt x/y auf — bei dünner x- oder y-Achse die Breite/Höhe passend drehen
  if (thin === 'y' && size.x < size.z) plane.rotation.z = Math.PI / 2;
  if (thin === 'x' && size.z < size.y) plane.rotation.z = Math.PI / 2;
  mesh.add(plane);
  return plane;
}

const bodyMat = (color = 0x1a1d27) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.2 });
const darkMat = () => new THREE.MeshStandardMaterial({ color: 0x0b0c12, roughness: 0.7, metalness: 0.1 });

/** Leuchtschild: unbeleuchtete Frontfläche (scharf) auf einem Kasten, der in der Marke glimmt */
function makeMarquee(g: THREE.Group, width: number, height: number, x: number, y: number, z: number, brand: THREE.Color) {
  const glow = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.04, height + 0.04, 0.14),
    new THREE.MeshStandardMaterial({ color: 0x0b0c12, emissive: brand, emissiveIntensity: 0.3, roughness: 0.5 }),
  );
  glow.position.set(x, y, z - 0.07);
  g.add(glow);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
  face.position.set(x, y, z + 0.001);
  g.add(face);
  return { face: face as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>, glow };
}

/** Platzhalter-Automat je Typ. Liefert Group + Bildschirm/Marquee-Referenzen. */
function buildPlaceholder(item: HallItem, brand: THREE.Color, brand2: THREE.Color) {
  const g = new THREE.Group();
  let screen: Machine['screen'];
  let marquee: Machine['marquee'];
  let marqueeGlow: Machine['marqueeGlow'];
  const screenMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const side = new THREE.MeshStandardMaterial({ map: sideArtTexture(`#${brand.getHexString()}`, `#${brand2.getHexString()}`), roughness: 0.6, metalness: 0.1 });

  const box = (w: number, h: number, d: number, m: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  const plane = <M extends THREE.Material>(w: number, h: number, m: M, x: number, y: number, z: number, rx = 0) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    mesh.position.set(x, y, z);
    mesh.rotation.x = rx;
    g.add(mesh);
    return mesh;
  };
  const body = bodyMat();
  // Seiten in Markenfarbe, Rest dunkel: [+x, -x, +y, -y, +z, -z]
  const sixSided = [side, side, body, body, body, body];

  switch (item.kind) {
    case 'cabinet': {
      box(0.88, 1.92, 0.8, sixSided, 0, 0.96, 0);
      box(0.88, 0.28, 0.42, darkMat(), 0, 0.14, 0.2);
      const mq = makeMarquee(g, 0.9, 0.3, 0, 2.06, 0.34, brand);
      marquee = mq.face;
      marqueeGlow = mq.glow;
      screen = plane(0.72, 0.56, screenMat, 0, 1.38, 0.402, -0.1);
      const panel = box(0.88, 0.06, 0.38, bodyMat(0x232735), 0, 0.98, 0.52);
      panel.rotation.x = -0.45;
      const stick = box(0.03, 0.14, 0.03, bodyMat(0xe8e8f0), -0.22, 1.1, 0.57);
      stick.rotation.x = -0.45;
      const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.02, 16), new THREE.MeshStandardMaterial({ color: brand, emissive: brand, emissiveIntensity: 0.6 }));
      b1.position.set(0.14, 1.05, 0.58);
      b1.rotation.x = -0.45;
      g.add(b1);
      const b2 = b1.clone();
      b2.material = new THREE.MeshStandardMaterial({ color: 0xf0f0f4 });
      b2.position.x = 0.27;
      g.add(b2);
      break;
    }
    case 'kiosk': {
      box(0.52, 1.95, 0.44, sixSided, 0, 0.975, 0);
      const mq = makeMarquee(g, 0.54, 0.22, 0, 2.08, 0.16, brand);
      marquee = mq.face;
      marqueeGlow = mq.glow;
      screen = plane(0.38, 0.68, screenMat, 0, 1.38, 0.222);
      box(0.42, 0.05, 0.16, bodyMat(0x232735), 0, 0.92, 0.2);
      break;
    }
    case 'terminal': {
      box(0.98, 0.9, 0.64, sixSided, 0, 0.45, 0);
      box(0.98, 0.66, 0.56, bodyMat(0x151823), 0, 1.33, -0.02);
      const mq = makeMarquee(g, 1.0, 0.24, 0, 1.8, 0.16, brand);
      marquee = mq.face;
      marqueeGlow = mq.glow;
      screen = plane(0.86, 0.52, screenMat, 0, 1.33, 0.262);
      const kb = box(0.82, 0.04, 0.26, bodyMat(0x232735), 0, 0.93, 0.36);
      kb.rotation.x = -0.35;
      break;
    }
    case 'jukebox': {
      const bodyRound = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.7, 24, 1, false, Math.PI, Math.PI), bodyMat(0x2a1f3a));
      bodyRound.position.set(0, 0.85, 0);
      bodyRound.rotation.y = Math.PI;
      g.add(bodyRound);
      box(0.8, 1.7, 0.4, sixSided, 0, 0.85, -0.2);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1a1424, emissive: brand, emissiveIntensity: 0.18, roughness: 0.35 }));
      cap.position.set(0, 1.7, 0);
      g.add(cap);
      const mq = makeMarquee(g, 0.7, 0.2, 0, 1.5, 0.405, brand);
      marquee = mq.face;
      marqueeGlow = mq.glow;
      screen = plane(0.56, 0.36, screenMat, 0, 1.15, 0.402);
      for (let i = 0; i < 6; i++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.03), new THREE.MeshStandardMaterial({ color: brand, emissive: brand, emissiveIntensity: 0.35 }));
        bar.position.set(-0.25 + i * 0.1, 0.72, 0.4);
        g.add(bar);
      }
      break;
    }
    case 'kasse':
    case 'phone':
      break;
  }
  return { group: g, screen, marquee, marqueeGlow };
}

export class HallScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private composer?: EffectComposer;
  /** nur für Dev-Inspektion über window.__hall */
  machines: Machine[] = [];
  private roomLighting!: HallLighting;
  private blue?: BlueCat;
  private neonLight!: THREE.PointLight;
  private loadingManager = new THREE.LoadingManager();
  private loader = new THREE.TextureLoader(this.loadingManager);
  private gltf = new GLTFLoader(this.loadingManager);
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2(0, 0);
  private camX = 0;
  private targetX = 0;
  /** Kamera: aktuelle Lage/Blickpunkt und das Ziel je Pose — die Kamera fährt immer zum Ziel */
  private camPos = new THREE.Vector3(0, 1.9, 7.6);
  private camLook = new THREE.Vector3(0, 1.7, 0);
  private goalPos = new THREE.Vector3(0, 1.9, 7.6);
  private goalLook = new THREE.Vector3(0, 1.7, 0);
  private fov = 42;
  private goalFov = 42;
  private pose: Pose = 'hall';
  private frame: Frame = { cx: 0.5, cy: 0.5, fw: 1, fh: 1 };
  /** Kamerafahrt als Tween mit fester Dauer (unabhängig von der Bildrate): von hier … */
  private tweenFrom = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 42 };
  private tweenStart = -1e9;
  private tweenDur = 280;
  private prevGoalPos = new THREE.Vector3(NaN, NaN, NaN);
  private prevGoalLook = new THREE.Vector3(NaN, NaN, NaN);
  private prevGoalFov = NaN;
  private settledFlag = false;
  /** Außerhalb der Halle wird nur gerendert, wenn sich etwas geändert hat */
  private dirty = true;
  /** Capture, das die Seite auf den Bildschirm legt (statt des Loops) */
  private override: string | null = null;
  private blackout = false;
  private texCache = new Map<string, THREE.Texture>();
  /** Captures, die per Letterbox auf das Seitenverhältnis eines Bildschirms gebracht wurden (src|aspect) */
  private fitCache = new Map<string, THREE.Texture>();
  private hoverAt = 0;
  private bornAt = 0;
  /** 0 = Halle, 1 = Zoom/Play: Nachbarn gehen bis auf Restlicht aus */
  private dimMix = 0;
  /** Bereitschaft: Modelle und erste Captures der Stationen nahe am Start müssen da sein, bevor die Bühne erscheint */
  private pending = 0;
  private managedLoading = false;
  private assembled = false;
  private readinessTimer = 0;
  private readyTimeouts = new Set<number>();
  private readyRejectors: ((reason: Error) => void)[] = [];
  private startupFailed = false;
  private deferredScreens = new Map<number, (() => Promise<void> | void)[]>();
  private deferredScreenTimer = 0;
  private deferredScreenBusy = false;
  private powerTargets: THREE.Object3D[] | undefined;
  private readyDone = false;
  private powerAt: number | null = null;
  private powerSkipped = false;
  private warming = false;
  /** Three polls material programs until compilation settles; keep them alive meanwhile. */
  private warmupPromise: Promise<unknown> | null = null;
  private readyResolvers: (() => void)[] = [];
  private initialFocus = 0;
  private focus = 0;
  private attract = false;
  private raf = 0;
  private last = 0;

  private running = false;
  private reduce: boolean;
  private lite: boolean;
  private container: HTMLElement;
  private cb: SceneCallbacks;
  private items: HallItem[] = [];
  private disposed = false;
  /** Leistungswächter: Frame-Zeiten sammeln und bei Bedarf runterschalten */
  private frameTimes: number[] = [];
  private perfLevel = 2; // 2 = voll, 1 = ohne Bloom/Spiegel, 0 = zusätzlich Pixelratio 1
  private perfGood = 0;
  private mirror?: Reflector;
  /** Spiegel neu rendern, obwohl die Kamera steht (Bildschirm gewechselt, Fernseher, Figur bewegt) */
  private mirrorDirty = true;

  /**
   * Fernseher an der Deckenschiene: fährt mit dem Fokus zwischen den Automaten mit (nicht zur Kasse,
   * nicht zum Telefon) und zeigt das aktuelle Capture groß — Phone-Captures zu dritt nebeneinander.
   */
  private tv!: Tv;
  private tvDissolve?: ScreenDissolve;
  private tvSlides = new Map<string, THREE.DataTexture>();
  private tvBlank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  private wallX = 0;
  private wallPaint = new WallPaint();
  private stationX: number[] = [];
  private surfaceMaps = makeSurfaceMaps();
  private glassWear = makeGlassWear();
  private reflectionResources: { dispose(): void }[] = [];

  private wallTitleKey = "";
  private artworkTextures = new Set<THREE.Texture>();
  private cabinetArtSources = new Map<string, THREE.Texture>();
  private logoImgs = new Map<string, HTMLImageElement>();
  private logoFailures = new Set<string>();
  /** Bitmaps der Seiten-Captures (Override) für den Fernseher */
  private bitmapCache = new Map<string, ImageBitmap>();

  /** Bild vorab dekodieren und auf ≤ 1280 px verkleinern — asynchron, nie im Frame */
  private makeBitmap(t: THREE.Texture, cb: (bmp: ImageBitmap) => void) {
    const img = t.image as HTMLImageElement | undefined;
    if (!img || typeof createImageBitmap !== 'function') return;
    const done = this.track(this.focus);
    const k = Math.min(1, 1280 / Math.max(1, img.naturalWidth || img.width, img.naturalHeight || img.height));
    const opts: ImageBitmapOptions = k < 1 ? { resizeWidth: Math.round((img.naturalWidth || img.width) * k), resizeHeight: Math.round((img.naturalHeight || img.height) * k), resizeQuality: 'medium' } : {};
    createImageBitmap(img, opts)
      .then((bmp) => {
        if (!this.disposed) cb(bmp);
        else bmp.close();
      })
      .catch(() => {})
      .finally(done);
  }
  /** Maskottchen für den Greifautomaten (Character-Bilder der Produkte) */
  private kassePlush: string[] = [];

  constructor(container: HTMLElement, items: HallItem[], initial: number, cb: SceneCallbacks, opts: { reduce: boolean; lite: boolean; pose?: Pose; frame?: Frame }) {
    this.container = container;
    container.dataset.power = 'loading';
    container.dataset.startupPhase = 'assets';
    this.loadingManager.onStart = () => { this.managedLoading = true; };
    this.loadingManager.onProgress = (_url, loaded, total) => {
      container.dataset.startupLoaded = String(loaded);
      container.dataset.startupTotal = String(total);
    };
    this.loadingManager.onLoad = () => { this.managedLoading = false; this.queueReady(); };
    // A missing authored character (or its embedded texture) must not reveal an empty claw.
    this.loadingManager.onError = url => {
      if (!this.readyDone) this.failStartup(new Error(`Hall startup asset failed: ${url}`));
    };
    this.items = items;
    this.stationX = stationPositions(items);
    this.bornAt = performance.now();
    this.cb = cb;
    this.reduce = opts.reduce;
    this.lite = opts.lite;
    // Composer has its own MSAA target. Lite mode and the adaptive performance
    // fallback draw directly to the canvas, so they need canvas MSAA as well.
    // Otherwise the rotating figure's bright silhouette shimmers after fallback.
    const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false, stencil: false });
    r.setPixelRatio(this.pixelRatioFor(container.clientWidth, container.clientHeight, opts.lite));
    r.setSize(container.clientWidth, container.clientHeight, false);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = .98;
    r.domElement.className = 'hall__canvas';
    r.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(r.domElement);
    this.renderer = r;

    this.scene.background = new THREE.Color(0x05060a);
    // Umgebungslicht für Metall, Lack und Glas — ohne Environment-Map rendert alles Glänzende schwarz
    const environmentDone = this.track(initial);
    void this.loadEnvironment().catch(error => this.failStartup(error)).finally(environmentDone);
    this.scene.environmentIntensity = 1.2;
    this.scene.fog = new THREE.Fog(0x05060a, 10.5, 24);
    this.camera = new THREE.PerspectiveCamera(opts.lite ? 52 : 42, container.clientWidth / container.clientHeight, 0.1, 80);

    this.buildRoom();
    // Plüsch in der Kasse: nur Figuren ohne eigenes 3D-Modell — Nori steht dort schon als Modell, das alte Bild bleibt draußen
    this.kassePlush = items.filter(isMachine).filter((it) => !it.characterModel).map((it) => it.character).filter((x): x is string => Boolean(x)).slice(0, 5);
    this.focus = initial;
    this.initialFocus = initial;
    items.forEach((it, i) => this.addMachine(it, i));
    const blueDone = this.track(initial);
    this.gltf.load('/models/blue-rigged-v1.glb', gltf => {
      if (!this.disposed) {
        this.blue = new BlueCat(gltf, container, this.stationX[0]);
        this.scene.add(this.blue.root);
        this.dirty = this.mirrorDirty = true;
      }
      blueDone();
    }, undefined, () => blueDone());
    this.focus = initial;
    this.camX = this.targetX = this.stationX[initial];
    this.wallX = this.camX;
    this.pose = opts.pose ?? 'hall';
    this.frame = opts.frame ?? { cx: 0.5, cy: 0.5, fw: 1, fh: 1 };
    this.applyFocus(true);
    this.updateWallTitle();
    this.updateGoal();
    this.snapCamera();

    if (!opts.lite) {
      const pr = r.getPixelRatio();
      const target = new THREE.WebGLRenderTarget(container.clientWidth * pr, container.clientHeight * pr, { type: THREE.HalfFloatType, samples: 4 });
      const comp = new EffectComposer(r, target);
      comp.addPass(new RenderPass(this.scene, this.camera));
      const bloom = new UnrealBloomPass(new THREE.Vector2(container.clientWidth / 2, container.clientHeight / 2), 0.14, 0.35, 1.05);
      // addPass/setSize setzen die Bloom-Auflösung auf volle Größe zurück — der Blur darf in Viertelauflösung
      // laufen (13 Vollbild-Durchgänge weniger Fläche), sichtbar ist das nicht
      const bloomSetSize = bloom.setSize.bind(bloom);
      bloom.setSize = (w: number, h: number) => bloomSetSize(Math.max(64, Math.round(w / 2)), Math.max(64, Math.round(h / 2)));
      comp.addPass(bloom);
      comp.addPass(new OutputPass());
      this.composer = comp;
    }

    // Marquee-Schriften neu zeichnen, sobald Outfit geladen ist (Canvas nutzt sonst die Fallback-Schrift)
    const fontDone = this.track(initial);
    (document.fonts?.ready ?? Promise.resolve()).then(() => {
      if (this.disposed) return;
      this.wallTitleKey = "";
      this.updateWallTitle();
      for (const m of this.machines) {
        if (!m.marquee || !isMachine(m.item)) continue;
        m.marquee.material.map?.dispose();
        const tex = textTexture(m.item.title, `#${m.brand.getHexString()}`, { aspect: artworkAspect(m.marquee) });
        if (m.gltfUv) tex.flipY = false;
        m.marquee.material.map = tex;
        m.marquee.material.needsUpdate = true;
      }
      this.dirty = true;
    }).finally(fontDone);

    r.domElement.addEventListener('pointermove', this.onPointerMove);
    r.domElement.addEventListener('click', this.onClick);
    window.addEventListener('resize', this.onResize);
    if (import.meta.env.DEV) (window as unknown as { __hall?: HallScene }).__hall = this;
    // Logos use HTMLImageElement rather than a Three loader; enroll them explicitly.
    for (const machine of this.machines) if (isMachine(machine.item)) this.logoImg(machine);
    this.assembled = true;
    this.queueReady();
  }

  /** Paint shares the brick surface instead of sitting in front of it. */
  private updateWallTitle() {
    const it=this.items[this.focus]; if(!it)return;
    const en=document.documentElement.dataset.lang==='en';
    const label=(isMachine(it)?(en?it.titleEn??it.title:it.title):it.kind==='kasse'?'Dennis':en?'Contact':'Kontakt').split(' – ')[0].toUpperCase();
    this.wallPaint.update(label,this.stationX[this.focus],this.container.clientWidth<768,this.pose==='hall',this.wallTitleKey!==label);
    this.wallTitleKey=label;
    this.dirty=true;
  }

  private cabinetArtwork(mesh: THREE.Mesh, slug:string) {
    const deck=mesh.name.toLowerCase()==='deck_art';
    if(deck || mesh.name.toLowerCase()==='front_art') {const material = new THREE.MeshPhysicalMaterial({
      color:0x10141b, roughness:.64, metalness:0, clearcoat:.08, clearcoatRoughness:.5,
      normalMap:this.surfaceMaps.normal, normalScale:new THREE.Vector2(.1,.1),
      roughnessMap:this.surfaceMaps.roughness, envMapIntensity:.2,
    });addPanelWear(mesh,material);return material;}
    let source=this.cabinetArtSources.get(slug);
    if(!source){source=this.loader.load('/textures/cabinet-art/quiet-v2/'+slug+'.webp',()=>{if(!this.disposed)this.dirty=true;});this.cabinetArtSources.set(slug,source);}
    const tex=source.clone();
    tex.colorSpace=THREE.SRGBColorSpace;tex.flipY=false;tex.anisotropy=8;
    const aspect=artworkAspect(mesh),sourceAspect=2/3;
    if(aspect<sourceAspect){tex.repeat.x=aspect/sourceAspect;tex.offset.x=(1-tex.repeat.x)/2;}
    else {tex.repeat.y=sourceAspect/aspect;tex.offset.y=deck?.52:Math.min(.40,(1-tex.repeat.y)*.75);}
    this.artworkTextures.add(tex);
    const material = new THREE.MeshPhysicalMaterial({map:tex,color:deck?0x8a8a8a:0xffffff,roughness:deck?.54:.64,metalness:0,clearcoat:deck?.14:.06,clearcoatRoughness:.52,normalMap:this.surfaceMaps.normal,normalScale:new THREE.Vector2(.1,.1),roughnessMap:this.surfaceMaps.roughness,envMapIntensity:deck?.3:.18});
    addPanelWear(mesh,material);return material;
  }

  /* ---------- Raum ---------- */
  private buildRoom() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0x939cb8, 0x05060a, .32));
    this.roomLighting = new HallLighting(s,this.items,this.stationX,this.loader,this.lite);
    const pbr = (base: string, repeat: [number, number]) => {
      const load = (name: string, srgb = false) => {
        const t = this.loader.load(`${TEX}/${base}_${name}.webp`);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(repeat[0], repeat[1]);
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        return t;
      };
      const orm = load('orm');
      return { map: load('basecolor', true), normalMap: load('normal'), aoMap: orm, roughnessMap: orm, metalnessMap: orm };
    };
    const floorTex = pbr('marble', [45, 12]);
    const floor = createHallFloor(floorTex,this.roomLighting,this.lite,this.container.clientWidth/this.container.clientHeight,()=>({dirty:this.mirrorDirty,ready:this.readyDone,quality:this.perfLevel}),()=>{this.mirrorDirty=false;});
    s.add(floor.mesh);this.reflectionResources.push(floor);
    if(floor.mesh instanceof Reflector)this.mirror=floor.mesh;
    // Rückwand aus Ziegel (Quaternius, CC0), Decke dunkel
    const wallTex = pbr('brick', [60, 8]);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(180, 24), new THREE.MeshStandardMaterial({ ...wallTex, color: 0x858c99, roughness: 1, metalness: 0 }));
    this.wallPaint.attach(wall.material);
    this.roomLighting.decorate(wall.material,'wall');
    wall.name = 'hall-back-wall';
    wall.position.set((this.stationX[0] + this.stationX[this.stationX.length - 1]) / 2, 12, -1.6);
    s.add(wall);
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(90, 24), new THREE.MeshStandardMaterial({ color: 0x06070c, roughness: 1 }));
    ceiling.rotation.x = Math.PI / 2;
    // The former 4.2-unit ceiling occluded the top of the wall on tall viewports.
    ceiling.name = 'hall-ceiling';
    ceiling.position.y = 24;
    s.add(ceiling);

    this.buildTv(s);

    // Farblicht hinter dem Neonschild — färbt die Rückwand in der Produktfarbe
    this.neonLight = new THREE.PointLight(0xffffff, 3.5, 14, 1.6);
    this.neonLight.position.set(0, -1.07, -0.12);
    this.tv.hang.add(this.neonLight);

  }

  /* ---------- Automaten ---------- */
  private addMachine(item: HallItem, index: number) {
    const brand = new THREE.Color(isMachine(item) ? item.brand.primary : '#c8daf4');
    const brand2 = new THREE.Color(isMachine(item) ? (item.brand.secondary ?? item.brand.primary) : '#ac8bfd');
    const { group, screen, marquee, marqueeGlow } = buildPlaceholder(item, brand, brand2);
    group.position.set(this.stationX[index], 0, 0);
    group.rotation.y = 0;
    group.userData.index = index;
    this.scene.add(group);

    const m: Machine = { index, item, group, screen, marquee, marqueeGlow, textures: [], raw: [], bitmaps: [], screenIdx: 0, loaded: false, brand, props: [], ctl: new Map() };
    this.machines.push(m);

    // Leuchtschild: Logo + Name
    if (marquee && isMachine(item)) {
      marquee.material.map = textTexture(item.title, `#${brand.getHexString()}`, { aspect: artworkAspect(marquee) });
      marquee.material.needsUpdate = true;
    }

    // Figur neben dem Automaten: echtes Modell, sonst Sprite
    if (isMachine(item) && item.characterModel) {
      const done = this.track(index);
      this.gltf.load(
        item.characterModel,
        (g) => {
        done();
        if (this.disposed) return;
        const root = g.scene;
        root.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) {
            simplifyMaterial(mesh);
            const mat = mesh.material as THREE.MeshStandardMaterial;
            if (mat) {
              mat.vertexColors = false; // COLOR_0 trägt Cel-Daten, keine Farbe
              mat.roughness = 0.85;
              mat.metalness = 0;
              capTexture(mat);
              mat.needsUpdate = true;
            }
          }
        });
        const box = new THREE.Box3().setFromObject(root);
        const h = Math.max(0.001, box.max.y - box.min.y);
        const k = .92 / h;
        root.scale.setScalar(k);
        root.position.set(mascotOffset(item), -box.min.y * k, .68);
        root.rotation.y = 0.55;
        group.add(root);
        m.model = root;
        m.extent = undefined;
        this.dirty = true;
        },
        undefined,
        () => done(),
      );
    } else if (isMachine(item) && (item.characterSheet || item.character)) {
      const sheet = item.characterSheet;
      const tex = this.loader.load(sheet ? sheet.url : item.character!);
      tex.colorSpace = THREE.SRGBColorSpace;
      if (sheet) {
        // Pixel-Art: scharfe Kanten, ein Frame aus dem Raster sichtbar
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        tex.repeat.set(1 / sheet.cols, 1 / sheet.rows);
        tex.offset.set(0, 1 - 1 / sheet.rows);
        m.spriteAnim = { tex, cols: sheet.cols, rows: sheet.rows, frames: sheet.frames, fps: sheet.fps, frame: -1 };
      }
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.05, toneMapped: false }));
      const size = sheet ? 0.82 : 0.7;
      sp.scale.set(size, size, 1);
      sp.position.set(mascotOffset(item), size / 2 + 0.01, .66);
      group.add(sp);
      m.sprite = sp;
    }

    if (item.kind === 'kasse') this.buildKasse(m);
    else {
      const spec = MODELS_BY_SLUG[item.slug] ?? MODELS[item.kind];
      if (spec) this.loadModel(m, spec);
    }
    if (isMachine(item) && item.props) for (const prop of item.props) this.loadProp(m, prop);
  }

  /** Requisite: auf Ziel-Länge normieren, am Boden aufsetzen, neben den Automaten stellen */
  private loadProp(m: Machine, prop: { url: string; size: number; x: number; z: number; rotY?: number; glow?: string[] }) {
    const done = this.track(m.index);
    this.gltf.load(
      prop.url,
      (g) => {
      done();
      if (this.disposed) return;
      const root = g.scene;
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat && prop.glow?.some((n) => mesh.name.toLowerCase().includes(n.toLowerCase()))) {
          mat.emissiveIntensity = Math.max(mat.emissiveIntensity, 2.5);
          mat.needsUpdate = true;
        }
      });
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const k = prop.size / Math.max(0.001, Math.max(size.x, size.y, size.z));
      const c = box.getCenter(new THREE.Vector3());
      const holder = new THREE.Group();
      root.scale.setScalar(k);
      root.position.set(-c.x * k, -box.min.y * k, -c.z * k);
      holder.add(root);
      holder.position.set(mascotOffset(m.item), 0, .72);
      holder.rotation.y = prop.rotY ?? 0;
      m.group.add(holder);
      m.props.push(holder);
      m.extent = undefined;
      this.dirty = true;
      },
      undefined,
      () => done(),
    );
  }

  /** GLB laden, auf Zielhöhe skalieren, am Boden zentrieren; Bildschirm per Namen oder als Fläche davor */
  private loadModel(m: Machine, spec: ModelSpec) {
    // Platzhalter bleibt unsichtbar, bis das Modell da ist — sonst blitzt beim Laden die alte Geometrie auf
    m.group.visible = false;
    const done = this.track(m.index);
    this.gltf.load(
      spec.url,
      (g) => {
      done();
      if (this.disposed) return;
      const root = g.scene;
      // Platzhalter-Bildschirm und -Schild vergessen; das Modell bringt eigene oder bekommt neue
      m.screen = undefined;
      m.marquee = undefined;
      m.marqueeGlow = undefined;
      m.gltfUv = false;
      m.ctl = new Map();
      m.ctlBox = undefined;
      const ctlNodes = new Map<string, { obj: THREE.Object3D; mats: CtlMat[] }>();
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        simplifyMaterial(mesh);
        finishHardware(mesh,this.surfaceMaps);
        const name = mesh.name.toLowerCase();
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat && /tmolding/.test(mat.name)) {
          mat.emissive.copy(m.brand); mat.emissiveIntensity=.24;mat.roughness=.28;
        }
        if (mat && spec.tintMaterials?.includes(mat.name)) {
          // Klon pro Automat, damit jeder seine eigene Farbe trägt
          const tinted = mat.clone();
          tinted.color = m.brand.clone().lerp(new THREE.Color(0xffffff), 0.25);
          mesh.material = tinted;
        }
        if (spec.screenNames?.some((n) => name === n.toLowerCase())) {
          mesh.material = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
          m.screen = mesh as Machine['screen'];
          m.gltfUv = true;
        } else if (name === 'marquee' && isMachine(m.item)) {
          // Leuchtschild des Modells: unbeleuchtete Fläche mit Logo + Name (glTF-UVs: flipY aus)
          const tex = textTexture(m.item.title, `#${m.brand.getHexString()}`, { aspect: artworkAspect(mesh) });
          tex.flipY = false;
          tex.needsUpdate = true;
          mesh.material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
          m.marquee = mesh as Machine['marquee'];
          m.gltfUv = true;
        } else if (['side_art_l','side_art_r','front_art','deck_art'].includes(name)) {
          mesh.material=this.cabinetArtwork(mesh,m.item.slug);
        } else if (name === 'glass') {
          mesh.material = clearScreenGlass(this.glassWear,mesh);
          mesh.renderOrder = 4;
        } else if (name.startsWith('pilaster') && mat && mat.emissive) {
          // Jukebox-Säulen leuchten, aber nicht bis in den Bloom
          mat.emissiveIntensity = Math.min(mat.emissiveIntensity, 0.4);
          mat.needsUpdate = true;
        } else if (mat && mat.isMeshStandardMaterial && (CTL_NAME.test(name) || (mesh.parent && CTL_NAME.test(mesh.parent.name.toLowerCase()) && /_\d+$/.test(name)))) {
          // Bedienelement (ein Mesh oder — bei mehreren Materialien — eine Gruppe mit Mesh-Kindern):
          // eigenes Material, damit nur dieses Teil glühen kann; der Pivot folgt nach dem Traverse
          const ctlName = CTL_NAME.test(name) ? name : mesh.parent!.name.toLowerCase();
          const own = mat.clone();
          const hasEmissive = own.emissive.getHex() !== 0 && own.emissiveIntensity > 0;
          if (!hasEmissive) {
            // Glüht bei Bedarf in der eigenen Farbe (roter Joystick-Ball bleibt rot), in Ruhe unverändert
            own.emissive.copy(own.color);
            own.emissiveIntensity = 0;
          }
          mesh.material = own;
          const entry = ctlNodes.get(ctlName) ?? { obj: CTL_NAME.test(name) ? mesh : mesh.parent!, mats: [] };
          entry.mats.push({ mat: own, base: hasEmissive ? own.emissiveIntensity : 0, own: hasEmissive });
          ctlNodes.set(ctlName, entry);
        } else if (name === 'card') {
          if (isMachine(m.item) && m.item.controls) {
            // Bedienkarte: Steuerung des Spiels in der Sprache der Seite
            const lang = document.documentElement.dataset.lang === 'en' ? 'en' : 'de';
            const tex = cardTexture(m.item.controls[lang], `#${m.brand.getHexString()}`, lang === 'en' ? 'CONTROLS' : 'STEUERUNG');
            frontPlane(mesh, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: 0xd8d8d8 }));
          } else {
            // Ohne Steuerung gäbe es nur eine leere Fläche in Markenfarbe — der Generator setzt die Karte immer
            mesh.visible = false;
          }
        }
      });
      // Bedienelemente an eine Pivot-Gruppe hängen: Ursprung an der Unterkante (Plattenseite), Teil darunter
      root.updateWorldMatrix(true, true);
      for (const [name, { obj, mats }] of ctlNodes) {
        const parent = obj.parent;
        if (!parent || !mats.length) continue;
        const bb = new THREE.Box3().setFromObject(obj).applyMatrix4(parent.matrixWorld.clone().invert());
        if (bb.isEmpty()) continue;
        const pivot = new THREE.Group();
        pivot.name = `${name}_pivot`;
        pivot.position.set((bb.min.x + bb.max.x) / 2, bb.min.y, (bb.min.z + bb.max.z) / 2);
        parent.add(pivot);
        pivot.add(obj);
        obj.position.sub(pivot.position);
        // Bewegliche Teile in eine eigene Gruppe am Pivot: Ringe/Unterlegscheiben bleiben am Platz
        const move = new THREE.Group();
        move.name = `${name}_move`;
        pivot.add(move);
        obj.updateWorldMatrix(true, true);
        const parts: THREE.Mesh[] = [];
        obj.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) parts.push(o as THREE.Mesh);
        });
        let spin: THREE.Mesh | undefined;
        for (const part of parts) {
          const mn = ((part.material as THREE.Material).name || '').toLowerCase();
          if (/ring|washer|claw_dark/.test(mn)) continue;
          if (name === 'trackball' && /ball/.test(mn)) spin = part;
          move.attach(part);
        }
        m.ctl.set(name, { node: pivot, obj, move, spin, mats, level: 0, goal: 0, pressAt: -1e9, pressK: 0, joyDir: 1, pos: pivot.position.clone(), rot: pivot.rotation.clone() });
      }
      const box = new THREE.Box3().setFromObject(root);
      const size = new THREE.Vector3();
      box.getSize(size);
      const k = spec.height / Math.max(0.001, size.y);
      root.scale.setScalar(k);
      const c = box.getCenter(new THREE.Vector3());
      root.position.set(-c.x * k, -box.min.y * k + (spec.y ?? 0), -c.z * k + (spec.z ?? 0));
      if (spec.rotY) root.rotation.y = spec.rotY;

      m.housing = root;
      const keep = m.group.children.filter((ch) => ch === m.sprite || ch === m.model || m.props.includes(ch));
      m.group.clear();
      keep.forEach((ch) => m.group.add(ch));
      m.group.add(root);

      // Leuchtschild über dem Modell, wenn das Modell keins mitbringt
      if (!m.marquee && isMachine(m.item)) {
        const w = Math.max(0.56, size.x * k);
        const mq = makeMarquee(m.group, w, 0.24, 0, spec.height + (spec.y ?? 0) + 0.14, (spec.z ?? 0) + size.z * k * 0.5 - 0.02, m.brand);
        mq.face.material.map = textTexture(m.item.title, `#${m.brand.getHexString()}`, { aspect: artworkAspect(mq.face) });
        mq.face.material.needsUpdate = true;
        m.marquee = mq.face;
        m.marqueeGlow = mq.glow;
      }
      // Bildschirmfläche vor der Front
      if (!m.screen && spec.screen && isMachine(m.item)) {
        const sc = spec.screen;
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(sc.w, sc.h), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
        plane.position.set(sc.x ?? 0, sc.y, (spec.z ?? 0) + size.z * k * 0.5 + (sc.zOffset ?? 0.01));
        m.group.add(plane);
        m.screen = plane as Machine['screen'];
      }
      m.group.visible = true;
      m.loaded = true;
      m.textures = [];
      m.raw = [];
      m.extent = undefined;
      m.screenFrame = undefined;
      this.ensureTextures(m);
      this.applyFocus(true);
      this.dirty = true;
      if (m.index === this.focus) {
        this.applyScreen();
        this.updateGoal();
        // Direktaufruf: das Modell kam kurz nach dem Start — Kamera sofort passend stellen, kein Nachrutschen
        if (performance.now() - this.bornAt < 1800) this.snapCamera();
        else this.markGoalChanged();
      }
      },
      undefined,
      () => {
        // Modell fehlt (404 o. ä.): Platzhalter zeigen statt Lücke
        done();
        m.group.visible = true;
      },
    );
  }

  /**
   * Capture auf das Seitenverhältnis des Bildschirms bringen: weicht es um mehr als 12 % ab, wird es
   * mittig mit dunklen Balken auf eine Leinwand im Bildschirmformat gezeichnet (kein Verzerren).
   */
  private fitTexture(tex: THREE.Texture, src: string, m: Machine): THREE.Texture {
    const img = tex.image as { width?: number; height?: number } | undefined;
    const sf = this.screenFrameOf(m);
    if (!img?.width || !img.height || !sf || sf.h <= 0) return tex;
    const screenAspect = sf.w / sf.h;
    const imgAspect = img.width / img.height;
    // Kleine Bilder im passenden Format direkt; große immer auf ≤ 1024 px bringen (Upload und Speicher)
    if (Math.abs(imgAspect / screenAspect - 1) < 0.12 && Math.max(img.width, img.height) <= 1280) return tex;
    const key = `${src}|${screenAspect.toFixed(3)}|${m.gltfUv ? 'g' : 'p'}`;
    const cached = this.fitCache.get(key);
    if (cached) return cached;
    const long = 1024;
    const w = screenAspect >= 1 ? long : Math.round(long * screenAspect);
    const h = screenAspect >= 1 ? Math.round(long / screenAspect) : long;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#04050a';
    ctx.fillRect(0, 0, w, h);
    const scale = Math.min(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(tex.image as CanvasImageSource, (w - dw) / 2, (h - dh) / 2, dw, dh);
    const out = new THREE.CanvasTexture(c);
    out.colorSpace = THREE.SRGBColorSpace;
    out.anisotropy = 4;
    out.flipY = !m.gltfUv;
    this.fitCache.set(key, out);
    return out;
  }

  /** Authored dark hall illumination, prefiltered offline before startup. */
  private async loadEnvironment() {
    const response = await fetch('/textures/hall-environment-v2.bin.gz');
    if (!response.ok) throw new Error('Hall environment unavailable');
    let buffer = await response.arrayBuffer();
    const magic = new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength));
    if (magic[0] === 0x1f && magic[1] === 0x8b) {
      buffer = await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    }
    if (this.disposed || this.startupFailed) return;
    const header = new DataView(buffer);
    const width = header.getUint32(0, true), height = header.getUint32(4, true);
    if (width !== 768 || height !== 1024 || buffer.byteLength !== 8 + width * height * 8) throw new Error('Invalid hall environment');
    const texture = new THREE.DataTexture(new Uint16Array(buffer, 8), width, height, THREE.RGBAFormat, THREE.HalfFloatType);
    texture.mapping = THREE.CubeUVReflectionMapping;
    texture.colorSpace = THREE.LinearSRGBColorSpace;
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    this.scene.environment = texture;
    this.artworkTextures.add(texture);
  }

  /** Explicit work complements LoadingManager (fonts, HTML logos and bitmap decoding). */
  private track(_index: number) {
    if (this.readyDone || this.disposed || this.startupFailed) return () => {};
    this.pending += 1;
    this.container.dataset.startupPending = String(this.pending);
    let called = false;
    return () => {
      if (called) return;
      called = true;
      this.pending = Math.max(0, this.pending - 1);
      this.container.dataset.startupPending = String(this.pending);
      this.queueReady();
    };
  }

  private queueReady() {
    if (!this.assembled || this.disposed || this.startupFailed || this.readyDone || this.warming) return;
    window.clearTimeout(this.readinessTimer);
    this.readinessTimer = window.setTimeout(() => {
      if (!this.pending && !this.managedLoading) this.finishReady();
    }, 0);
  }

  ready(timeoutMs = 30000) {
    if (this.readyDone) return Promise.resolve();
    if (this.disposed || this.startupFailed) return Promise.reject(new Error('Hall startup unavailable'));
    return new Promise<void>((resolve, reject) => {
      this.readyResolvers.push(resolve);
      this.readyRejectors.push(reject);
      const timeout = window.setTimeout(() => {
        this.readyTimeouts.delete(timeout);
        if (!this.readyDone) this.failStartup(new Error('Hall assets or GPU preparation timed out'));
      }, timeoutMs);
      this.readyTimeouts.add(timeout);
      this.queueReady();
    });
  }

  private failStartup(error: Error) {
    if (this.disposed || this.readyDone || this.startupFailed) return;
    this.startupFailed = true;
    this.container.dataset.startupPhase = 'failed';
    this.stop();
    this.readyTimeouts.forEach(window.clearTimeout);
    this.readyTimeouts.clear();
    const rejects = this.readyRejectors.splice(0);
    this.readyResolvers = [];
    rejects.forEach(reject => reject(error));
  }

  private finishReady() {
    if (this.disposed || this.startupFailed || this.readyDone || this.warming || this.pending || this.managedLoading) return;
    this.warming = true;
    this.container.dataset.assetReadyMs = String(Math.round(performance.now() - this.bornAt));
    this.container.dataset.startupPhase = 'gpu';
    void this.prepareStartup().catch(error => this.failStartup(error instanceof Error ? error : new Error(String(error))));
  }

  private async prepareStartup() {
    const warmAt = performance.now();
    this.updateGoal();
    this.snapCamera();
    this.scene.updateMatrixWorld(true);
    // Assemble the resident TV image before warming, including parked utility stations.
    const tvX = Math.min(this.tv.range[1], Math.max(this.tv.range[0], this.targetX));
    this.wallX = tvX;
    this.tv.rig.position.x = tvX;
    this.tv.from = this.tv.to = tvX;
    this.tv.t0 = performance.now();
    this.tv.dur = 0;
    const resident = this.machines[nearestStation(this.stationX, tvX)];
    if (resident && isMachine(resident.item)) {
      this.updateTv(resident, this.pose === 'hall', performance.now());
      this.tv.screen.material.opacity = this.pose === 'hall' || this.pose === 'zoom' ? .94 : 0;
      this.tv.screen.visible = this.tv.screen.material.opacity > 0;
    }
    performance.mark('hall:upload-start');
    const uploadAt = performance.now();
    const textures = new Set<THREE.Texture>();
    if (this.scene.environment) textures.add(this.scene.environment);
    this.scene.traverse(object => {
      const material = (object as THREE.Mesh).material;
      for (const mat of material ? (Array.isArray(material) ? material : [material]) : []) {
        for (const value of Object.values(mat)) if (value instanceof THREE.Texture && !value.isRenderTargetTexture && value.image) textures.add(value);
      }
    });
    let uploaded = 0;
    for (const texture of textures) {
      if (this.disposed || this.startupFailed) return;
      this.renderer.initTexture(texture);
      // Give the browser room to process input between small upload batches.
      if (++uploaded % 4 === 0) await new Promise<void>(resolve => window.setTimeout(resolve, 0));
    }
    if (this.disposed || this.startupFailed) return;
    this.container.dataset.uploadMs = String(Math.round(performance.now() - uploadAt));
    performance.mark('hall:upload-end');
    performance.mark('hall:compile-start');
    const compileAt = performance.now();
    const renderables: THREE.Object3D[] = [];
    this.scene.traverse(object => {
      const drawable = object as THREE.Mesh;
      if (drawable.isMesh || (object as THREE.Sprite).isSprite || (object as THREE.Line).isLine || (object as THREE.Points).isPoints) renderables.push(object);
    });
    let maxCompileBatch = 0;
    // compileAsync's synchronous setup and its readiness polling both iterate the
    // supplied materials. Limit each batch instead of blocking on the whole hall.
    // compile() traverses invisible meshes too: no visibility or camera mutations.
    // Canvas uses display-space tone mapping; composer and reflector targets use
    // linear output without tone mapping. Both are distinct Three shader variants.
    const compileTargets: (THREE.WebGLRenderTarget | null)[] = this.composer
      ? [null, this.composer.readBuffer] : [null];
    for (const target of compileTargets) {
      for (let i = 0; i < renderables.length; i += 12) {
        if (this.disposed || this.startupFailed) return;
        const batch = new THREE.Group();
        // A traversal view only; do not reparent live scene objects with add().
        batch.children = renderables.slice(i, i + 12);
        const batchAt = performance.now();
        const previousTarget = this.renderer.getRenderTarget();
        try {
          this.renderer.setRenderTarget(target);
          this.warmupPromise = this.renderer.compileAsync(batch, this.camera, this.scene);
        } finally {
          // Compilation captures these parameters synchronously. Never retain an
          // offscreen framebuffer across an asynchronous navigation/disposal turn.
          this.renderer.setRenderTarget(previousTarget);
        }
        try {
          await this.warmupPromise;
        } finally {
          this.warmupPromise = null;
        }
        maxCompileBatch = Math.max(maxCompileBatch, performance.now() - batchAt);
        await new Promise<void>(resolve => window.setTimeout(resolve, 0));
      }
    }
    this.container.dataset.compileMs = String(Math.round(performance.now() - compileAt));
    this.container.dataset.compileBatchMaxMs = String(Math.round(maxCompileBatch));
    performance.mark('hall:compile-end');
    if (this.disposed || this.startupFailed) return;
    // Real compositor, reflection and upload work happens behind the CSS concealment.
    this.mirrorDirty = true;
    performance.mark('hall:render-warm-start');
    const renderAt = performance.now();
    if (this.composer && this.perfLevel === 2) {
      const passTimes: number[] = [];
      // The hall has RenderPass, bloom and OutputPass, with no stencil/mask pass.
      // Match the composer's buffer swaps, yielding between its actual passes.
      for (let i = 0; i < this.composer.passes.length; i++) {
        if (this.disposed || this.startupFailed) return;
        const pass = this.composer.passes[i];
        if (!pass.enabled) continue;
        pass.renderToScreen = this.composer.renderToScreen && this.composer.isLastEnabledPass(i);
        const previousTarget = this.renderer.getRenderTarget();
        const passAt = performance.now();
        try {
          pass.render(this.renderer, this.composer.writeBuffer, this.composer.readBuffer, 0, false);
          if (pass.needsSwap) this.composer.swapBuffers();
        } finally {
          this.renderer.setRenderTarget(previousTarget);
        }
        passTimes.push(Math.round(performance.now() - passAt));
        await new Promise<void>(resolve => window.setTimeout(resolve, 0));
      }
      this.container.dataset.renderPassMs = JSON.stringify(passTimes);
    } else this.renderFrame();
    this.container.dataset.renderWarmMs = String(Math.round(performance.now() - renderAt));
    performance.mark('hall:render-warm-end');
    await new Promise<void>(resolve => window.setTimeout(resolve, 0));
    if (this.disposed || this.startupFailed) return;
    if (this.pending || this.managedLoading) {
      this.warming = false;
      this.queueReady();
      return;
    }
    this.powerTargets = collectRoomPowerTargets(this.scene);
    this.warming = false;
    this.readyTimeouts.forEach(window.clearTimeout);
    this.readyTimeouts.clear();
    this.container.dataset.warmupMs = String(Math.round(performance.now() - warmAt));
    this.container.dataset.readyMs = String(Math.round(performance.now() - this.bornAt));
    this.container.dataset.startupPhase = 'ready';
    if (!this.reduce && !this.powerSkipped && this.pose === 'hall') {
      this.powerAt = performance.now();
      // Replace the concealed full-light warm-up frame with darkness before CSS reveals it.
      this.renderFrame();
      this.container.dataset.power = 'on';
    } else {
      delete this.container.dataset.power;
    }
    this.readyDone = true;
    if (this.powerAt === null) this.flushDeferredScreens();
    const resolves = this.readyResolvers.splice(0);
    this.readyRejectors = [];
    resolves.forEach(resolve => resolve());
    this.start();
  }

  private deferScreen(index: number, task: () => Promise<void> | void) {
    if (this.disposed || this.startupFailed) return;
    const queue = this.deferredScreens.get(index) ?? [];
    queue.push(task);
    this.deferredScreens.set(index, queue);
    this.flushDeferredScreens();
  }

  private screenWorkAllowed(index: number) {
    return this.readyDone && this.powerAt === null && this.focus === index
      && (this.pose === 'hall' || this.pose === 'zoom') && !document.hidden
      && this.settledFlag && performance.now() - this.tweenStart > this.tweenDur + 700;
  }

  /** Only the selected project's extra slides may use idle time, one operation at a time. */
  private flushDeferredScreens() {
    if (this.disposed || this.startupFailed || !this.readyDone || this.deferredScreenBusy || this.deferredScreenTimer) return;
    if (!this.deferredScreens.get(this.focus)?.length || !['hall', 'zoom'].includes(this.pose)) return;
    this.deferredScreenTimer = window.setTimeout(() => {
      this.deferredScreenTimer = 0;
      const index = this.focus;
      const queue = this.deferredScreens.get(index);
      if (!queue?.length || this.disposed || this.startupFailed) return;
      if (!this.screenWorkAllowed(index)) { this.flushDeferredScreens(); return; }
      const task = queue.shift()!;
      this.deferredScreenBusy = true;
      const work = () => {
        if (this.disposed || this.startupFailed) { this.deferredScreenBusy = false; return; }
        // A click may have started a camera move since the idle callback was scheduled.
        if (!this.screenWorkAllowed(index)) {
          queue.unshift(task);
          this.deferredScreenBusy = false;
          this.flushDeferredScreens();
          return;
        }
        Promise.resolve().then(task).catch(() => {}).finally(() => {
          this.deferredScreenBusy = false;
          this.flushDeferredScreens();
        });
      };
      if ('requestIdleCallback' in window) window.requestIdleCallback(work, { timeout: 1200 });
      else globalThis.setTimeout(work, 0);
    }, 180);
  }

  /**
   * Fernseher an einer Deckenschiene: zwei Schienen unter der Decke, Laufwagen mit Rädern, Arm,
   * daran das Gerät (Korpus, Metallrand, Bildschirm, Glas, Bias-Licht). Die Schiene reicht nur von
   * ersten bis zum letzten Automaten — zur Kasse und zum Telefon kann der Fernseher nicht.
   */
  private buildTv(s: THREE.Scene) {
    const machines = this.items.map((it, i) => (isMachine(it) ? i : -1)).filter((i) => i >= 0);
    const first = machines.length ? machines[0] : 0;
    const last = machines.length ? machines[machines.length - 1] : 0;
    const range: [number, number] = [this.stationX[first], this.stationX[last]];
    const metal = new THREE.MeshStandardMaterial({ color: 0x33363f, metalness: 0.85, roughness: 0.32 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x0c0d12, metalness: 0.35, roughness: 0.55 });
    const RAIL_Y = 4.02;
    const Z = -1.05;
    const W = 1.85;
    const H = 1.15625;

    // Schienen + Deckenhalter (fest)
    const x0 = range[0] - 1.2;
    const x1 = range[1] + 1.2;
    for (const z of [Z - 0.09, Z + 0.09]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.05, 0.05), metal);
      rail.position.set((x0 + x1) / 2, RAIL_Y, z);
      s.add(rail);
    }
    for (let i = first; i <= last; i++) {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.3), metal);
      bracket.position.set(((this.stationX[i] ?? range[1]) + (this.stationX[i + 1] ?? range[1] + 1.1)) / 2, 4.12, Z);
      s.add(bracket);
    }

    // Laufwagen mit vier Rädern, Arm nach unten
    const rig = new THREE.Group();
    const carriage = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.34), dark);
    carriage.position.set(0, RAIL_Y, Z);
    rig.add(carriage);
    const wheels: THREE.Mesh[] = [];
    const wheelGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.03, 20);
    for (const wx of [-0.17, 0.17]) for (const wz of [Z - 0.09, Z + 0.09]) {
      const w = new THREE.Mesh(wheelGeo, metal);
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, RAIL_Y, wz);
      rig.add(w);
      wheels.push(w);
    }
    // Gerät hängt am Arm: Drehpunkt am Laufwagen, damit es beim Anfahren leicht pendelt
    const hang = new THREE.Group();
    hang.position.set(0, RAIL_Y - 0.04, Z);
    rig.add(hang);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.3, 0.07), metal);
    arm.position.set(0, -0.15, 0);
    hang.add(arm);
    const cy = -.76; // Screen above the architectural title band.
    const body = new THREE.Mesh(new RoundedBoxGeometry(W + 0.12, H + 0.12, 0.08, 3, 0.018), dark);
    body.position.set(0, cy, 0);
    hang.add(body);
    // A broad, matte bezel avoids a subpixel specular stripe under the TV as the camera moves.
    const bezel = new THREE.MeshStandardMaterial({ color: 0x20242d, metalness: 0.4, roughness: 0.62 });
    const rim = new THREE.Mesh(new RoundedBoxGeometry(W + 0.20, H + 0.20, 0.03, 3, 0.012), bezel);
    rim.position.set(0, cy, -0.03);
    hang.add(rim);
    const geoN = new THREE.PlaneGeometry(W, H);
    const geoF = geoN.clone();
    const uv = geoF.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    uv.needsUpdate = true;
    const screen = new THREE.Mesh(geoN, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, opacity: 0, depthWrite: false }));
    screen.name = 'tv_screen';
    screen.position.set(0, cy, 0.045);
    screen.visible = false;
    hang.add(screen);
    // Kein Glas vor dem Fernseher: jedes Spitzlicht säße mitten auf dem Bild
    // Bias-Licht: auf dem Desktop ein echtes Flächenlicht hinter dem Gerät, das die Ziegel weich färbt;
    // in Lite ein großer elliptischer Schein mit langem Auslauf (nichts wird abgeschnitten)
    let light: THREE.RectAreaLight | undefined;
    if (!this.lite) {
      RectAreaLightUniformsLib.init();
      light = new THREE.RectAreaLight(0xffffff, 0, W + 0.4, H + 0.3);
      light.position.set(0, cy, -0.05);
      // RectAreaLight emits along local -Z: keep it facing the wall.
      hang.add(light);
    }
    const gc = document.createElement('canvas');
    gc.width = 512;
    gc.height = 320;
    const gctx = gc.getContext('2d')!;
    gctx.save();
    gctx.scale(1, 320 / 512);
    const grad = gctx.createRadialGradient(256, 256, 0, 256, 256, 256);
    // weicher Auslauf (Quadrat der Distanz), läuft lange vor dem Rand gegen null
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const a = Math.pow(1 - t, 2.2) * 0.9;
      grad.addColorStop(t, `rgba(255,255,255,${a.toFixed(3)})`);
    }
    gctx.fillStyle = grad;
    gctx.fillRect(0, 0, 512, 512);
    gctx.restore();
    const glowTex = new THREE.CanvasTexture(gc);
    glowTex.colorSpace = THREE.SRGBColorSpace;
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(W + 2.6, H + 1.8), new THREE.MeshBasicMaterial({ color: 0xffffff, map: glowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.name = 'tv_glow';
    glow.position.set(0, cy, -0.07);
    glow.renderOrder = 1;
    glow.visible = Boolean(this.lite);
    hang.add(glow);

    // Kanalwechsel-Schnee: gekacheltes Rauschen, das pro Frame verschoben wird
    const nc = document.createElement('canvas');
    nc.width = 256;
    nc.height = 256;
    const nctx = nc.getContext('2d')!;
    const img = nctx.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 40 + Math.random() * 215;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v * 1.06;
      img.data[i + 3] = 255;
    }
    nctx.putImageData(img, 0, 0);
    const noiseTex = new THREE.CanvasTexture(nc);
    noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping;
    noiseTex.repeat.set(2.4, 1.5);
    noiseTex.magFilter = THREE.NearestFilter;
    const noise = new THREE.Mesh(geoN, new THREE.MeshBasicMaterial({ color: 0xd8dde8, map: noiseTex, toneMapped: false, transparent: true, opacity: 0, depthWrite: false }));
    noise.position.set(0, cy, 0.047);
    noise.renderOrder = 5;
    noise.visible = false;
    hang.add(noise);
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.01), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
    led.name = 'tv_led';
    led.position.set(W / 2 - 0.08, cy - H / 2 - 0.04, 0.045);
    hang.add(led);
    s.add(rig);

    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 800;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const logoCanvas = document.createElement('canvas');
    logoCanvas.width = 1280;
    logoCanvas.height = 800;
    const logoTex = new THREE.CanvasTexture(logoCanvas);
    logoTex.colorSpace = THREE.SRGBColorSpace;
    const logo = new THREE.Mesh(geoN, new THREE.MeshBasicMaterial({ map: logoTex, toneMapped: false, transparent: true, opacity: 0, depthWrite: false }));
    logo.position.set(0, cy, 0.046);
    logo.renderOrder = 4;
    logo.visible = false;
    hang.add(logo);
    this.tv = { rig, hang, wheels, screen, light, glow, noise, noiseTex, staticUntil: -1e9, staticMix: 0, from: 0, to: NaN, t0: -1e9, dur: 0, phase: 'logo', phaseAt: -1, led, geoN, geoF, canvas, tex, key: '', logo, logoCanvas, logoTex, logoKey: '', range, lastX: 0, swing: 0, vel: 0 };
    this.tvBlank.needsUpdate = true;
    this.tvDissolve = new ScreenDissolve(screen.material, true);
    this.tvDissolve.set(this.tvBlank, 0, 0);
  }

  /**
   * Bild auf dem Fernseher: Desktop-Captures direkt (Textur des Automatenbildschirms, UVs je nach
   * flipY), Phone-Captures zu dritt nebeneinander auf einer 16:10-Leinwand (Halle: die nächsten drei
   * im Loop, Zoom: das gewählte Capture mittig).
   */
  /** Logo des Projekts (Leuchtschild-Grafik) für die Logo-Karte des Fernsehers — lädt nach, Key ändert sich dann */
  private logoImg(m: Machine): HTMLImageElement | undefined {
    if (!isMachine(m.item)) return undefined;
    const src = m.item.logo ?? m.item.marquee;
    if (!src) return undefined;
    let img = this.logoImgs.get(src);
    if (!img) {
      const el = new Image();
      el.decoding = 'async';
      const done = this.track(m.index);
      el.onload = () => {
        Promise.resolve(el.decode?.()).catch(() => {}).finally(() => {
          if (!this.disposed) { this.tv.logoKey = ''; this.dirty = true; }
          done();
        });
      };
      // Text-only logo cards are an intentional, complete fallback for unavailable logos.
      el.onerror = () => { this.logoFailures.add(src); this.dirty = true; done(); };
      el.src = src;
      img = el;
      this.logoImgs.set(src, img);
    }
    return img.complete && img.naturalWidth > 0 ? img : undefined;
  }

  /** Logo-Karte: dunkler Grund, weicher Schein in der Produktfarbe, Logo und Name */
  private drawTvLogo(ctx: CanvasRenderingContext2D, m: Machine) {
    const c = ctx.canvas;
    ctx.fillStyle = '#07080c';
    ctx.fillRect(0, 0, c.width, c.height);
    const hex = `#${m.brand.getHexString()}`;
    const glow = ctx.createRadialGradient(c.width / 2, c.height * 0.46, 40, c.width / 2, c.height * 0.46, c.width * 0.55);
    glow.addColorStop(0, `${hex}59`);
    glow.addColorStop(0.5, `${hex}1f`);
    glow.addColorStop(1, `${hex}00`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, c.width, c.height);
    const img = this.logoImg(m);
    const title = isMachine(m.item) ? m.item.title : '';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (img) {
      const maxW = c.width * 0.68;
      const maxH = c.height * 0.55;
      const k = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
      const dw = img.naturalWidth * k;
      const dh = img.naturalHeight * k;
      ctx.drawImage(img, (c.width - dw) / 2, c.height * 0.5 - dh / 2, dw, dh);

    } else if (isMachine(m.item) && (!(m.item.logo ?? m.item.marquee) || this.logoFailures.has((m.item.logo ?? m.item.marquee)!))) {
      // Schein hinter dem Namen als Verlauf — kein shadowBlur, das kostet auf 1280 × 800 hunderte Millisekunden
      const tw = Math.min(c.width * 0.8, title.length * 62);
      const halo = ctx.createRadialGradient(c.width / 2, c.height * 0.48, 10, c.width / 2, c.height * 0.48, tw * 0.6);
      halo.addColorStop(0, `${hex}66`);
      halo.addColorStop(1, `${hex}00`);
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.font = `800 96px "Outfit Variable", Outfit, system-ui, sans-serif`;
      const fontSize = Math.min(96, 96 * c.width * 0.8 / Math.max(1, ctx.measureText(title).width));
      ctx.font = `800 ${fontSize}px "Outfit Variable", Outfit, system-ui, sans-serif`;
      ctx.fillStyle = '#eef1f8';
      ctx.fillText(title, c.width / 2, c.height * 0.48);
    }
  }

  /** Captures auf die Leinwand: eines groß, Phone-Captures zu dritt nebeneinander (vorab dekodierte Bitmaps) */
  private drawTvShots(ctx: CanvasRenderingContext2D, list: ImageBitmap[]) {
    const c = ctx.canvas;
    ctx.fillStyle = '#04050a';
    ctx.fillRect(0, 0, c.width, c.height);
    const margin = list.length > 1 ? 36 : 0;
    const gap = 28;
    const n = list.length;
    const slotW = (c.width - margin * 2 - gap * (n - 1)) / n;
    const slotH = c.height - margin * 2;
    list.forEach((img, i) => {
      const k = Math.min(slotW / img.width, slotH / img.height);
      const dw = img.width * k;
      const dh = img.height * k;
      const x = margin + i * (slotW + gap) + (slotW - dw) / 2;
      const y = margin + (slotH - dh) / 2;
      ctx.drawImage(img, x, y, dw, dh);
    });
  }

  private updateTv(m: Machine, _inHall: boolean, now: number) {
    const tv = this.tv;
    const focused = this.machines[this.focus];
    const parked = Boolean(focused && !isMachine(focused.item));
    // About/contact keep the resident image; allow an initial pending logo to finish loading.
    if (parked && tv.key && tv.phaseAt >= 0) return;
    const images = m.bitmaps.filter((b): b is ImageBitmap => Boolean(b));
    const ready = Boolean(this.logoImg(m)) || (isMachine(m.item) && ((!m.item.logo && !m.item.marquee) || this.logoFailures.has((m.item.logo ?? m.item.marquee)!)));
    if (tv.phaseAt < 0 && ready) tv.phaseAt = now;
    const presentation = tvPresentation(tv.phaseAt < 0 ? 0 : now - tv.phaseAt, images.length, this.reduce, parked);
    // Use the original capture slot: filtering partially loaded images must not reuse another slide.
    const slot = presentation.kind === 'shot' ? m.bitmaps.indexOf(images[presentation.index]) : 0;
    const key = m.index + '|' + presentation.kind + '|' + slot + '|' + Number(ready);
    if (key === tv.key) return;
    tv.key = key;
    tv.phase = presentation.kind === 'logo' ? 'logo' : 'shots';
    if (!this.tvDissolve) this.tvDissolve = new ScreenDissolve(tv.screen.material, true);
    // Immutable pixel buffers avoid re-uploading a canvas still being sampled by
    // the outgoing dissolve. Reuse complete slides when the presentation loops.
    let texture=this.tvSlides.get(key);
    if (!texture) {
      const canvas=document.createElement('canvas');
      canvas.width=1024;canvas.height=640;
      const ctx=canvas.getContext('2d', {willReadFrequently:true})!;
      if (presentation.kind === 'logo') this.drawTvLogo(ctx, m);
      else this.drawTvShots(ctx, [images[presentation.index]]);
      const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
      texture=new THREE.DataTexture(new Uint8Array(pixels.data.buffer),canvas.width,canvas.height);
      texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=true;
      texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps=true;texture.anisotropy=4;texture.needsUpdate=true;
    }
    this.tvSlides.delete(key);this.tvSlides.set(key,texture);
    this.tvDissolve.set(texture, now, this.reduce || parked || tv.phaseAt < 0 ? 0 : Math.min(500, presentation.duration));
    // Bound GPU memory while retaining both textures of an active dissolve.
    for (const [oldKey,oldTexture] of this.tvSlides) {
      if (this.tvSlides.size <= 12) break;
      if (!this.tvDissolve.uses(oldTexture)) { oldTexture.dispose();this.tvSlides.delete(oldKey); }
    }
    tv.logo.visible = false;
    this.dirty = true;
  }

  /**
   * "Über mich" als Greifautomat (public/models/claw.glb aus scripts/models/blender/claw_gen.py):
   * die Figur des Hausherrn steht als Hauptgewinn auf dem Drehteller, Nori, das Taxi und die
   * Maskottchen liegen als Preise drumherum, der Greifer fährt über allem. Fehlt das Modell,
   * bleibt der einfache Automat aus Grundkörpern (buildKassePlaceholder).
   */
  private buildKasse(m: Machine) {
    const g = m.group;
    g.clear();
    g.visible = false;
    const brand = m.brand;
    const done = this.track(m.index);
    this.gltf.load(
      '/models/claw.glb',
      (res) => {
        done();
        if (this.disposed) return;
        const root = res.scene;
        let disc: THREE.Mesh | undefined;
        let carriage: THREE.Object3D | undefined;
        let claw: THREE.Object3D | undefined;
        let floor: THREE.Mesh | undefined;
        root.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          simplifyMaterial(mesh);
          const name = mesh.name.toLowerCase();
          const mat = mesh.material as THREE.MeshStandardMaterial;
          finishHardware(mesh,this.surfaceMaps);
          if (name === 'front_art' || name === 'side_art_l' || name === 'side_art_r' || name === 'deck_art') {
            mesh.material=this.cabinetArtwork(mesh,'kasse');
          } else if (name === 'marquee') {
            const tex = textTexture(document.documentElement.dataset.lang === 'en' ? 'About me' : 'Über mich', `#${brand.getHexString()}`, { upper: true, aspect: artworkAspect(mesh) });
            tex.flipY = false;
            tex.needsUpdate = true;
            mesh.material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
            m.marquee = mesh as Machine['marquee'];
            m.gltfUv = true;
          } else if (name === 'glass') {
            mesh.material = clearScreenGlass(this.glassWear,mesh,true);
            mesh.renderOrder = 5;
          } else if (name === 'disc') disc = mesh;
          else if (name === 'carriage') carriage = mesh;
          else if (name === 'claw') claw = mesh;
          else if (name === 'floor') floor = mesh;
          else if (name === 'lamp' && mat) {
            mat.emissive = new THREE.Color(0xfff1d6);
            mat.emissiveIntensity = 0.9;
          } else if (name === 'led' && mat) {
            mat.emissive = brand.clone();
            mat.emissiveIntensity = 1.2;
          }
        });
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const k = 1.95 / Math.max(0.001, size.y);
        const c = box.getCenter(new THREE.Vector3());
        root.scale.setScalar(k);
        root.position.set(-c.x * k, -box.min.y * k, -c.z * k);
        g.add(root);
        g.updateWorldMatrix(true, true);

        // Bühne auf dem Drehteller: Figur + Preise in Gruppenkoordinaten
        const discBox = disc ? new THREE.Box3().setFromObject(disc) : undefined;
        const floorBox = floor ? new THREE.Box3().setFromObject(floor) : undefined;
        const discTop = discBox ? g.worldToLocal(new THREE.Vector3(discBox.getCenter(new THREE.Vector3()).x, discBox.max.y, discBox.getCenter(new THREE.Vector3()).z)) : new THREE.Vector3(0, 0.9, 0);
        const floorTop = floorBox ? g.worldToLocal(new THREE.Vector3(0, floorBox.max.y, 0)).y : discTop.y - 0.05;
        const clawBox = claw ? new THREE.Box3().setFromObject(claw) : undefined;
        const clawTip = clawBox ? g.worldToLocal(new THREE.Vector3(0, clawBox.min.y, 0)).y : discTop.y + 0.8;
        const stage = new THREE.Group();
        stage.position.copy(discTop);
        g.add(stage);
        m.model = stage;
        // Figur: groß wie ein Hauptgewinn, aber der Greifer bleibt frei darüber
        const figureH = Math.max(0.4, Math.min(0.66, clawTip - discTop.y - 0.1));
        const carriageRest = carriage ? carriage.position.clone() : null;
        const clawRest = claw ? claw.position.clone() : null;
        g.userData.kasse = { disc, carriage, claw, carriageRest, clawRest, k };
        if (!isMachine(m.item) && m.item.figure) {
          const doneF = this.track(m.index);
          this.gltf.load(
            m.item.figure,
            (fig) => {
              doneF();
              if (this.disposed) return;
              const fr = fig.scene;
              fr.traverse((o) => {
                const mesh = o as THREE.Mesh;
                if (mesh.isMesh && mesh.material) {
                  simplifyMaterial(mesh);
                  const mat = mesh.material as THREE.MeshStandardMaterial;
                  // Keep the approved figure's PBR values and full tattoo texture.
                  mat.vertexColors = false;
                  if (mat.map) {
                    mat.map.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
                    mat.map.needsUpdate = true;
                  }
                  mat.needsUpdate = true;
                }
              });
              const fb = new THREE.Box3().setFromObject(fr);
              const fs = fb.getSize(new THREE.Vector3());
              const fk = figureH / Math.max(0.001, fs.y);
              const fc = fb.getCenter(new THREE.Vector3());
              fr.scale.setScalar(fk);
              fr.position.set(-fc.x * fk, -fb.min.y * fk, -fc.z * fk);
              stage.add(fr);
              // Die Figur bestimmt den Zoom der Kasse — Rahmen neu rechnen
              m.extent = undefined;
              if (m.index === this.focus) {
                this.updateGoal();
                this.markGoalChanged();
              }
              this.dirty = true;
            },
            undefined,
            () => doneF(),
          );
        }
        // Preise auf dem Boden: Nori (Modell), das Taxi (Modell), der Igel und die anderen als Plüsch
        const prizes: { url?: string; sprite?: string; size: number; x: number; z: number; rotY?: number }[] = [];
        const nori = this.items.find((it) => isMachine(it) && it.characterModel);
        if (nori && isMachine(nori) && nori.characterModel) prizes.push({ url: nori.characterModel, size: 0.3, x: -0.27, z: 0.14, rotY: 0.6 });
        const taxi = this.items.find((it) => isMachine(it) && it.props?.length);
        if (taxi && isMachine(taxi) && taxi.props?.[0]) prizes.push({ url: taxi.props[0].url, size: 0.36, x: 0.28, z: 0.1, rotY: -0.7 });
        this.kassePlush.forEach((src, i) => prizes.push({ sprite: src, size: 0.2, x: -0.3 + i * 0.2, z: -0.22 + (i % 2) * 0.08 }));
        for (const pz of prizes) {
          if (pz.url) {
            this.gltf.load(pz.url, (pr) => {
              if (this.disposed) return;
              const r = pr.scene;
              r.traverse((o) => {
                const mesh = o as THREE.Mesh;
                if (!mesh.isMesh || !mesh.material) return;
                const mat = mesh.material as THREE.MeshStandardMaterial;
                if (mat.vertexColors) mat.vertexColors = false;
                mat.needsUpdate = true;
              });
              const b = new THREE.Box3().setFromObject(r);
              const s = b.getSize(new THREE.Vector3());
              const kk = pz.size / Math.max(0.001, Math.max(s.x, s.y, s.z));
              const cc = b.getCenter(new THREE.Vector3());
              const holder = new THREE.Group();
              r.scale.setScalar(kk);
              r.position.set(-cc.x * kk, -b.min.y * kk, -cc.z * kk);
              holder.add(r);
              holder.position.set(pz.x, floorTop, pz.z);
              holder.rotation.y = pz.rotY ?? 0;
              g.add(holder);
              this.dirty = true;
            });
          } else if (pz.sprite) {
            const tex = this.loader.load(pz.sprite, () => {
              this.dirty = true;
            });
            tex.colorSpace = THREE.SRGBColorSpace;
            const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.05, toneMapped: false }));
            sp.scale.set(pz.size, pz.size, 1);
            sp.position.set(pz.x, floorTop + pz.size / 2, pz.z);
            g.add(sp);
          }
        }
        // Schild und Kopf der Kasse bleiben unter der Bloom-Schwelle
        g.userData.marqueeMax = 0.8;
        g.visible = true;
        m.loaded = true;
        m.extent = undefined;
        this.dirty = true;
        this.applyFocus(true);
      },
      undefined,
      () => {
        done();
        this.buildKassePlaceholder(m);
      },
    );
  }

  /** Greifautomat aus Grundkörpern — Rückfall, wenn public/models/claw.glb fehlt */
  private buildKassePlaceholder(m: Machine) {
    const g = m.group;
    g.clear();
    g.visible = true;
    const brand = m.brand;
    const W = 1.15;
    const D = 0.95;
    const baseH = 0.82;
    const glassH = 1.32;
    const topH = 0.3;

    // Sockel mit Münztür und Ausgabeklappe
    const base = new THREE.Mesh(new THREE.BoxGeometry(W, baseH, D), new THREE.MeshStandardMaterial({ color: 0x14121a, roughness: 0.45, metalness: 0.25 }));
    base.position.set(0, baseH / 2, 0);
    g.add(base);
    const chute = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.02), new THREE.MeshStandardMaterial({ color: 0x05060a, roughness: 0.9 }));
    chute.position.set(-0.25, 0.3, D / 2 + 0.005);
    g.add(chute);
    const coin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.02), new THREE.MeshStandardMaterial({ color: 0x2b2f3c, roughness: 0.4, metalness: 0.7 }));
    coin.position.set(0.3, 0.42, D / 2 + 0.005);
    g.add(coin);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(W - 0.08, 0.02, 0.01), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: brand, emissiveIntensity: 1.2 }));
    strip.position.set(0, baseH - 0.03, D / 2 + 0.005);
    g.add(strip);

    // Glaskasten: vier Chromkanten, Scheiben leicht getönt, Innenboden hell
    const chrome = new THREE.MeshStandardMaterial({ color: 0xd8dbe4, roughness: 0.18, metalness: 1 });
    const glassMat = clearScreenGlass(this.glassWear,undefined,true);
    for (const [x, z] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]] as const) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, glassH, 0.05), chrome);
      post.position.set(x, baseH + glassH / 2, z);
      g.add(post);
    }
    const inner = new THREE.Mesh(new THREE.BoxGeometry(W - 0.06, 0.04, D - 0.06), new THREE.MeshStandardMaterial({ color: 0xe9e4f2, roughness: 0.7 }));
    inner.position.set(0, baseH + 0.02, 0);
    g.add(inner);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.06, glassH - 0.04), new THREE.MeshStandardMaterial({ color: 0x2a2440, roughness: 0.8 }));
    back.position.set(0, baseH + glassH / 2, -D / 2 + 0.03);
    g.add(back);
    for (const [w, h, x, y, z, ry] of [
      [W, glassH, 0, baseH + glassH / 2, D / 2, 0],
      [D, glassH, W / 2, baseH + glassH / 2, 0, -Math.PI / 2],
      [D, glassH, -W / 2, baseH + glassH / 2, 0, Math.PI / 2],
    ] as const) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassMat);
      pane.position.set(x, y, z);
      pane.rotation.y = ry;
      pane.renderOrder = 5;
      g.add(pane);
    }

    // Kopf mit Leuchtschild
    const top = new THREE.Mesh(new THREE.BoxGeometry(W + 0.06, topH, D + 0.06), new THREE.MeshStandardMaterial({ color: 0x14121a, roughness: 0.45, metalness: 0.25 }));
    top.position.set(0, baseH + glassH + topH / 2, 0);
    g.add(top);
    const mq = makeMarquee(g, W - 0.1, 0.22, 0, baseH + glassH + topH / 2, D / 2 + 0.035, brand);
    mq.face.material.map = textTexture(document.documentElement.dataset.lang === 'en' ? 'About me' : 'Über mich', `#${brand.getHexString()}`, { upper: true, aspect: artworkAspect(mq.face) });
    mq.face.material.needsUpdate = true;
    m.marquee = mq.face;
    m.marqueeGlow = mq.glow;

    // Innenlicht auf den Preis — zurückhaltend, sonst brennt die Kopfleiste im Bloom aus
    const lamp = new THREE.PointLight(0xfff2dc, 0.7, 2.4, 2);
    lamp.position.set(0, baseH + glassH - 0.2, 0.15);
    g.add(lamp);
    // Schild und Kopf der Kasse bleiben unter der Bloom-Schwelle
    g.userData.marqueeMax = 0.78;

    // Drehscheibe mit der Figur
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.05, 32), new THREE.MeshStandardMaterial({ color: brand, roughness: 0.35, metalness: 0.2, emissive: brand, emissiveIntensity: 0.12 }));
    disc.position.set(0, baseH + 0.065, 0.05);
    g.add(disc);
    const stage = new THREE.Group();
    stage.position.set(0, baseH + 0.09, 0.05);
    g.add(stage);
    m.model = stage;
    if (!isMachine(m.item) && m.item.figure) {
      const done = this.track(m.index);
      this.gltf.load(
        m.item.figure,
        (res) => {
        done();
        if (this.disposed) return;
        const root = res.scene;
        root.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh && mesh.material) {
            const mat = mesh.material as THREE.MeshStandardMaterial;
            // Match the authored figure materials in the fallback cabinet too.
            mat.vertexColors = false;
            if (mat.map) {
              mat.map.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
              mat.map.needsUpdate = true;
            }
            mat.needsUpdate = true;
          }
        });
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const k = (glassH - 0.2) / Math.max(0.001, size.y);
        const c = box.getCenter(new THREE.Vector3());
        root.scale.setScalar(k);
        root.position.set(-c.x * k, -box.min.y * k, -c.z * k);
        stage.add(root);
        this.dirty = true;
        },
        undefined,
        () => done(),
      );
    } else if (!isMachine(m.item) && m.item.portrait) {
      const tex = this.loader.load(m.item.portrait);
      tex.colorSpace = THREE.SRGBColorSpace;
      const me = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.07), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.05, toneMapped: false }));
      me.position.set(0, 0.55, 0);
      stage.add(me);
    }

    // Plüsch: die Maskottchen als kleine Figuren um den Preis herum
    const plush = this.kassePlush;
    plush.forEach((src, i) => {
      const tex = this.loader.load(src);
      tex.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.05, toneMapped: false }));
      const a = (i / Math.max(1, plush.length)) * Math.PI * 1.4 - Math.PI * 0.7;
      sp.scale.set(0.3, 0.3, 1);
      sp.position.set(Math.sin(a) * 0.42, baseH + 0.19, Math.cos(a) * 0.3 + 0.12);
      g.add(sp);
    });

    // Greifer: Schiene, Seil, drei Zinken — pendelt langsam über dem Preis
    const rail = new THREE.Mesh(new THREE.BoxGeometry(W - 0.14, 0.04, 0.06), chrome);
    rail.position.set(0, baseH + glassH - 0.05, 0);
    g.add(rail);
    const claw = new THREE.Group();
    claw.position.set(0, baseH + glassH - 0.07, 0);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.36, 8), new THREE.MeshStandardMaterial({ color: 0x33363f, roughness: 0.8 }));
    rope.position.y = -0.18;
    claw.add(rope);
    const chuck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.08, 16), chrome);
    chuck.position.y = -0.4;
    claw.add(chuck);
    for (let i = 0; i < 3; i++) {
      const prong = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.22, 0.03), chrome);
      const ang = (i / 3) * Math.PI * 2;
      prong.position.set(Math.cos(ang) * 0.07, -0.53, Math.sin(ang) * 0.07);
      prong.rotation.z = Math.cos(ang) * 0.5;
      prong.rotation.x = -Math.sin(ang) * 0.5;
      claw.add(prong);
    }
    g.add(claw);
    m.props.push(claw);
  }

  private ensureTextures(m: Machine) {
    if (!isMachine(m.item) || !m.screen) return;
    if (m.textures.length) return;
    m.raw = [];
    m.bitmaps = [];
    m.textures = m.item.screens.map((src, k) => {
      if (k > 0) {
        this.deferScreen(m.index, () => new Promise<void>(resolve => {
          const t = this.loader.load(src, () => {
            if (this.disposed || this.startupFailed) { resolve(); return; }
            // Decode off the main drawing path before any canvas fitting/upload.
            const image = t.image as HTMLImageElement;
            Promise.resolve(image.decode?.()).catch(() => {}).then(() => {
              this.deferScreen(m.index, () => {
                m.raw[k] = t;
                if (m.gltfUv) t.flipY = false;
                const use = this.fitTexture(t, src, m);
                // Separate canvas fitting from GPU upload and recheck camera/selection.
                this.deferScreen(m.index, () => {
                  this.renderer.initTexture(use);
                  m.textures[k] = use;
                  this.makeBitmap(t, bmp => { m.bitmaps[k] = bmp; this.dirty = true; });
                  this.dirty = true;
                });
              });
            }).finally(resolve);
          }, undefined, () => resolve());
          t.colorSpace = THREE.SRGBColorSpace;
          t.anisotropy = 4;
          // Keep pending ownership for disposal without making the slide displayable.
          m.raw[k] = t;
        }));
        return null;
      }
      const done = this.track(m.index);
      const t = this.loader.load(src, () => {
        done();
        if (this.disposed || this.startupFailed) return;
        m.raw[k] = t;
        this.makeBitmap(t, bmp => { m.bitmaps[k] = bmp; this.dirty = true; });
        if (m.gltfUv) t.flipY = false;
        const use = this.fitTexture(t, src, m);
        this.renderer.initTexture(use);
        m.textures[k] = use;
        if (m.screen && !(m.index === this.focus && this.override) && !this.blackout) this.displayTexture(m, use, 0);
        this.dirty = true;
      }, undefined, () => done());
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    });
  }

  /* ---------- Fokus ---------- */
  setFocus(i: number) {
    const next = Math.max(0, Math.min(this.machines.length - 1, i));
    if (next !== this.focus) {
      this.finishPower();
      // Kanalwechsel: Schnee auf dem Fernseher, bis er angekommen ist (mindestens kurz)
      if (this.tv && isMachine(this.machines[next].item)) {
        // Retire both sampled images immediately, including an interrupted fade.
        // The incoming project's logo starts from a clean screen after travel.
        this.tvDissolve?.set(this.tvBlank, performance.now(), 0);
        this.tv.staticUntil = performance.now() + (this.reduce ? 0 : 380);
        this.tv.phase = 'static';
        this.tv.phaseAt = -1;
        this.tv.key = '';
      } else if (this.tv) {
        // Utility stations park the TV without noise, a logo restart or a dissolve.
        if (this.tv.screen.material.map) this.tvDissolve?.set(this.tv.screen.material.map, performance.now(), 0);
        this.tv.phase = this.tv.phase === 'static' ? 'logo' : this.tv.phase;
        this.tv.staticMix = 0;
        this.tv.noise.visible = false;
      }
      // Vorheriger Bildschirm zeigt wieder die feste Titelaufnahme; der neue bekommt sein Capture von der Seite
      const prev = this.machines[this.focus];
      this.override = null;
      this.blackout = false;
      if (prev?.screen && prev.textures[prev.screenIdx]?.image) {
        prev.screenIdx = 0;
        this.displayTexture(prev, prev.textures[0]!, 0);
      }
    }
    this.focus = next;
    this.targetX = this.stationX[this.focus];
    this.updateWallTitle();
    this.applyFocus(false);
    this.updateGoal();
    this.markGoalChanged();
  }

  /** Pose wechseln (Halle ↔ Automat ↔ Bildschirm); `frame` = freier Bereich für den Automaten */
  setPose(pose: Pose, frame?: Frame) {
    if (frame && frameOk(frame)) this.frame = frame;
    if (pose === this.pose && !frame) return;
    const was = this.pose;
    if (pose !== 'hall') this.finishPower();
    this.pose = pose;
    this.updateWallTitle();
    if (pose === 'hall' && was !== 'hall') {
      this.override = null;
      this.blackout = false;
      const m = this.machines[this.focus];
      if(m?.textures[0]?.image) this.displayTexture(m,m.textures[0],0);
    }
    if (was === 'screen' && pose !== 'screen') this.ctlReset();
    // Der Spiegel rendert die Szene ein zweites Mal — im Close-up und beim Spielen ist der Boden nicht im Bild
    if (this.mirror) this.mirror.visible = pose === 'hall' || pose === 'zoom';
    this.applyFocus(false);
    this.updateGoal();
    this.markGoalChanged();
  }

  setFrame(frame: Frame) {
    if (!frameOk(frame)) return;
    this.frame = frame;
    this.updateGoal();
    this.markGoalChanged();
  }

  /** Löst aus, sobald die Fahrt zu ~80 % durch ist (oder nach `timeoutMs`) — hält den Seitenwechsel */
  settled(timeoutMs = 900) {
    return new Promise<void>((resolve) => {
      const t0 = performance.now();
      const poll = () => {
        const done = performance.now() - this.tweenStart >= this.tweenDur * 0.8;
        if (this.disposed || done || performance.now() - t0 > timeoutMs) resolve();
        else window.setTimeout(poll, 24);
      };
      poll();
    });
  }

  /** Neue Fahrt ab der aktuellen Kameralage starten (Ziel steht in goalPos/goalLook/goalFov) */
  private retarget(now: number) {
    this.tweenFrom.pos.copy(this.camPos);
    this.tweenFrom.look.copy(this.camLook);
    this.tweenFrom.fov = this.fov;
    this.tweenStart = now;
    this.tweenDur = this.reduce ? 0 : this.pose === 'hall' ? 260 : 220;
    // Jede neue Fahrt endet mit einer neuen Ankunft: Bildschirm- und Bedienelement-Rechtecke werden dann
    // erneut projiziert — sonst bleibt die Seite auf einem Rechteck von unterwegs sitzen
    this.settledFlag = false;
    this.prevGoalPos.copy(this.goalPos);
    this.prevGoalLook.copy(this.goalLook);
    this.prevGoalFov = this.goalFov;
  }

  /** Ein Capture der Seite auf den fokussierten Bildschirm legen (null = Loop läuft weiter) */
  showScreen(src: string | null) {
    this.override = src;
    this.applyScreen();
  }

  /** Während der Web-Build als iframe auf dem Bildschirm liegt, bleibt die Fläche darunter schwarz */
  setBlackout(on: boolean) {
    if (this.blackout === on) return;
    this.blackout = on;
    this.applyScreen();
  }

  private displayTexture(m: Machine, texture: THREE.Texture, duration = 600) {
    if (!m.screen) return;
    if (!m.dissolve || m.dissolve.material !== m.screen.material) m.dissolve = new ScreenDissolve(m.screen.material);
    m.dissolve.set(texture, performance.now(), this.reduce ? 0 : duration);
    this.dirty = true;
  }

  private applyScreen() {
    const m = this.machines[this.focus];
    if (!m?.screen || !isMachine(m.item)) return;
    const mat = m.screen.material;
    if (this.blackout) {
      mat.map = null;
      mat.color.setScalar(0);
      mat.needsUpdate = true;
      this.dirty = true;
      return;
    }
    let tex: THREE.Texture | undefined;
    if (this.override) {
      const src = this.override;
      tex = this.texCache.get(src);
      if (!tex) {
        const t = this.loader.load(src, () => {
          // Nach dem Laden ggf. auf das Bildschirmformat bringen und erneut auflegen
          this.makeBitmap(t, (bmp) => {
            this.bitmapCache.set(src, bmp);
            this.dirty = true;
          });
          if (this.override === src) this.applyScreen();
          this.dirty = true;
        });
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        this.texCache.set(src, t);
        tex = t;
      }
      const flip = !m.gltfUv;
      if (tex.flipY !== flip) {
        tex.flipY = flip;
        tex.needsUpdate = true;
      }
      if (tex.image) {
        tex = this.fitTexture(tex, src, m);
        this.renderer.initTexture(tex);
      }
    } else {
      tex = m.textures[m.screenIdx] ?? m.textures[0] ?? undefined;
    }
    if (tex && mat.map !== tex) {
      if(tex.image) this.displayTexture(m, tex);
    }
    this.dirty = true;
  }

  private markGoalChanged() {
    // Kein unbedingter Neustart der Fahrt: die Schleife startet sie, sobald sich das Ziel wirklich
    // unterscheidet — sonst setzt jede Route-Bestätigung (prep, after-swap, page-load) die Fahrt neu auf
    this.settledFlag = false;
    this.dirty = true;
  }

  private snapCamera() {
    this.camPos.copy(this.goalPos);
    this.camLook.copy(this.goalLook);
    this.fov = this.goalFov;
    this.retarget(-1e9);
    this.tweenFrom.pos.copy(this.goalPos);
    this.tweenFrom.look.copy(this.goalLook);
    this.tweenFrom.fov = this.goalFov;
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.camX = this.camPos.x;
    this.settledFlag = false;
    this.dirty = true;
  }

  /** Kameraziel je Pose. Zoom/Play rechnen aus Ausdehnung bzw. Bildschirm und dem freien Bereich. */
  private updateGoal() {
    const m = this.machines[this.focus];
    const lite = this.lite;
    const aspect = this.camera.aspect || 1.6;
    if (this.pose === 'hall' || !m) {
      const compact=this.container.clientWidth<768;
      const floorBand=this.frame.cy+this.frame.fh/2;
      const lookY=1.45+(floorBand-.82)*2;
      this.goalPos.set(this.targetX,compact?1.7:1.8,compact?6.0:6.5);
      this.goalLook.set(this.targetX,compact?1.35:lookY,0);
      this.goalFov=compact?48:42;
      return;
    }
    const f = this.frame;
    const fov = this.pose === 'play' || this.pose === 'screen' ? (lite ? 40 : 30) : lite ? 44 : 34;
    const tanH = Math.tan(THREE.MathUtils.degToRad(fov / 2));
    this.goalFov = fov;
    if (this.pose === 'screen') {
      const sf = this.screenFrameOf(m);
      if (sf) {
        // Close-up: Bildschirm und Bedienfeld im Bild — die Knöpfe blättern die Captures. Ohne
        // eigene Bedien-Meshes gilt ein fester Abstand unter dem Bildschirm; auf dem Phone (tight)
        // nur der Bildschirm, dort wischt man.
        const top = sf.center.y + sf.h / 2;
        const cb = f.tight ? null : this.controlBox(m);
        const bottom = f.tight ? sf.center.y - sf.h / 2 : cb ? cb.min.y - 0.07 : sf.center.y - sf.h / 2 - 0.32;
        const regionH = (top - bottom) * (f.tight ? 1.08 : 1.08);
        const regionW = Math.max(sf.w, cb ? cb.max.x - cb.min.x : 0) * 1.08;
        const d = Math.max(regionH / (0.86 * f.fh * 2 * tanH), regionW / (0.86 * f.fw * 2 * aspect * tanH), 0.7);
        const Hv = 2 * d * tanH;
        const ox = (0.5 - f.cx) * Hv * aspect;
        const oy = (f.cy - 0.5) * Hv;
        const midY = (top + bottom) / 2;
        this.goalLook.set(sf.center.x + ox, midY + oy, sf.center.z);
        this.goalPos.copy(this.goalLook).addScaledVector(sf.normal, d);
        return;
      }
    }
    if (this.pose === 'play') {
      const sf = this.screenFrameOf(m);
      if (sf) {
        // Bildschirm füllt ~62 % der freien Breite bzw. ~70 % der freien Höhe
        const d = Math.max(sf.w / (0.62 * f.fw * 2 * aspect * tanH), sf.h / (0.7 * f.fh * 2 * tanH), 0.6);
        const Hv = 2 * d * tanH;
        const ox = (0.5 - f.cx) * Hv * aspect;
        const oy = (f.cy - 0.5) * Hv;
        this.goalLook.set(sf.center.x + ox, sf.center.y + oy, sf.center.z);
        this.goalPos.copy(sf.center).addScaledVector(sf.normal, d);
        this.goalPos.x += ox;
        this.goalPos.y += oy;
        return;
      }
    }
    // Zoom: der ganze Automat (mit Figur/Requisite) füllt ~90 % der freien Höhe (Schild am Exponat)
    // bzw. ~84 % ohne feste Kante (Sheet)
    const ex = this.extentOf(m);
    // Maßgeblich für die Höhe ist die Vorderseite der Station (Leuchtschild, Bedienfeld): sie liegt der
    // Kamera am nächsten und würde sonst über den Rahmen hinauswachsen
    const hasMascot = isMachine(m.item) && Boolean(m.item.characterModel || m.item.character || m.item.characterSheet || m.item.props?.length);
    const fill = hasMascot ? .84 : .9;
    const dFront = Math.max(ex.h / (fill * f.fh * 2 * tanH), ex.w / (0.9 * f.fw * 2 * aspect * tanH), 1.0);
    const d = dFront + ex.d * 0.5;
    const Hv = 2 * dFront * tanH;
    const oy = (f.cy - 0.5) * Hv;
    const mx = m.group.position.x + ex.cx;
    const cy = ex.y0 + ex.h * 0.5;
    let X = mx + (0.5 - f.cx) * Hv * aspect;
    if (f.al !== undefined) {
      // Linke Kante der Station auf die Frame-Kante legen (Über mich): die Kamera steht rechts, sichtbar
      // ist vorn links die vordere Ecke
      const xl = f.al * 2 - 1;
      X = mx - ex.w * 0.5 - xl * dFront * tanH * aspect;
    } else if (f.ax !== undefined) {
      // Rechte Kante der Station auf die Frame-Kante legen (Lücke zum Panel steckt im Frame). Die Kamera
      // steht rechts der Station und sieht ihre Seite: die Silhouette bildet dann die hintere Kante.
      const xr = f.ax * 2 - 1;
      const dEdge = xr < 0 ? dFront + ex.d : dFront;
      X = mx + ex.w * 0.5 - xr * dEdge * tanH * aspect;
    }
    this.goalLook.set(X, cy + oy, 0);
    this.goalPos.set(X, cy + ex.h * 0.08 + oy, m.group.position.z + ex.zc + d);
  }

  private extentOf(m: Machine): Extent {
    if (m.extent) return m.extent;
    // Kasse: nicht der ganze Automat, sondern die Figur auf dem Drehteller — „ich" im Fokus
    if (m.item.kind === 'kasse' && m.model) {
      m.group.updateWorldMatrix(true, true);
      const fb = new THREE.Box3().setFromObject(m.model);
      if (!fb.isEmpty()) {
        const fs = fb.getSize(new THREE.Vector3());
        const fc = fb.getCenter(new THREE.Vector3());
        m.extent = {
          h: Math.max(1.0, fs.y + 0.5),
          w: Math.max(1.0, fs.x + 0.5),
          d: Math.max(0.8, fs.z + 0.4),
          cx: fc.x - m.group.position.x,
          zc: fc.z - m.group.position.z,
          y0: fb.min.y - 0.12,
        };
        return m.extent;
      }
    }
    const box = new THREE.Box3().setFromObject(m.housing ?? m.group);
    if (box.isEmpty()) return { h: 1.9, w: 0.9, d: 0.8, cx: 0, zc: 0, y0: 0 };
    const s = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    m.extent = {
      h: Math.min(2.7, Math.max(1.2, s.y)),
      w: Math.min(3.4, Math.max(0.3, s.x)),
      d: Math.min(2.5, Math.max(0.3, s.z)),
      cx: c.x - m.group.position.x,
      zc: c.z - m.group.position.z,
      y0: 0,
    };
    return m.extent;
  }

  /** Bildschirm: Mitte, Normale (zur Kamera hin), Breite/Höhe und die Ecken in Weltkoordinaten */
  private screenFrameOf(m: Machine): ScreenFrame | undefined {
    if (m.screenFrame) return m.screenFrame;
    const s = m.screen;
    if (!s) return undefined;
    s.updateWorldMatrix(true, false);
    const g = s.geometry;
    g.computeBoundingBox();
    const bb = g.boundingBox;
    if (!bb) return undefined;
    const corners: THREE.Vector3[] = [];
    for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) corners.push(new THREE.Vector3(x, y, z).applyMatrix4(s.matrixWorld));
    const center = corners.reduce((a, b) => a.add(b), new THREE.Vector3()).multiplyScalar(1 / corners.length);
    const normal = new THREE.Vector3();
    const na = g.getAttribute('normal');
    if (na) for (let i = 0; i < na.count; i++) normal.add(new THREE.Vector3(na.getX(i), na.getY(i), na.getZ(i)));
    if (normal.lengthSq() < 0.25) normal.set(0, 0, 1);
    normal.transformDirection(s.matrixWorld);
    if (normal.z < 0) normal.negate();
    const up = new THREE.Vector3(0, 1, 0);
    up.addScaledVector(normal, -up.dot(normal)).normalize();
    const right = new THREE.Vector3().crossVectors(up, normal).normalize();
    let w = 0;
    let h = 0;
    for (const c of corners) {
      const dv = c.clone().sub(center);
      w = Math.max(w, Math.abs(dv.dot(right)) * 2);
      h = Math.max(h, Math.abs(dv.dot(up)) * 2);
    }
    m.screenFrame = { center, normal, w, h, corners };
    return m.screenFrame;
  }

  /** Weltbox der Bedienelemente (null = das Modell hat keine eigenen Bedien-Meshes) */
  private controlBox(m: Machine): THREE.Box3 | null {
    if (m.ctlBox !== undefined) return m.ctlBox;
    if (!m.ctl.size) return (m.ctlBox = null);
    // Direkt nach dem Laden stehen die Weltmatrizen noch nicht — sonst landet die Box im Modellraum
    m.group.updateWorldMatrix(true, true);
    const box = new THREE.Box3();
    for (const c of m.ctl.values()) box.union(new THREE.Box3().setFromObject(c.node));
    return (m.ctlBox = box.isEmpty() ? null : box);
  }

  /** Objekt in Viewport-Pixel projizieren (achsenparallele Hülle der Box-Ecken) */
  private projectBox(box: THREE.Box3): { x: number; y: number; w: number; h: number } | null {
    // Die Kamera steht schon am Ziel, ihre Matrizen aber erst nach dem nächsten Render — hier nachziehen,
    // sonst ist die Projektion einen Frame alt und das Fenster sitzt einen Hauch daneben
    this.camera.updateMatrixWorld(true);
    const r = this.renderer.domElement.getBoundingClientRect();
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    const v = new THREE.Vector3();
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      v.set(x, y, z).project(this.camera);
      if (v.z > 1) return null;
      const px = r.left + ((v.x + 1) / 2) * r.width;
      const py = r.top + ((1 - v.y) / 2) * r.height;
      x0 = Math.min(x0, px);
      y0 = Math.min(y0, py);
      x1 = Math.max(x1, px);
      y1 = Math.max(y1, py);
    }
    if (!Number.isFinite(x0) || x1 - x0 < 2) return null;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  /** Hülle des fokussierten Automaten in Viewport-Pixel — danach richtet Über mich sein Panel aus */
  private emitMachineRect() {
    const m = this.machines[this.focus];
    if (!m) return;
    const ex = this.extentOf(m);
    const gx = m.group.position.x + ex.cx;
    const gz = m.group.position.z + ex.zc;
    const box = new THREE.Box3(new THREE.Vector3(gx - ex.w / 2, ex.y0, gz - ex.d / 2), new THREE.Vector3(gx + ex.w / 2, ex.y0 + ex.h, gz + ex.d / 2));
    const r = this.projectBox(box);
    if (r) document.dispatchEvent(new CustomEvent('hall:machinerect', { detail: r }));
  }

  /** Project the entire pivot, including moving caps/ball reparented out of the original mesh group. */
  private emitControlRects() {
    const m = this.machines[this.focus];
    if (!m) return;
    const rects: Record<string, { x: number; y: number; w: number; h: number }> = {};
    for (const [name, c] of m.ctl) {
      const r = this.projectBox(new THREE.Box3().setFromObject(c.node));
      if (r) rects[name] = r;
    }
    document.dispatchEvent(new CustomEvent('hall:ctlrects', { detail: { pose: this.pose, rects } }));
  }

  /** Bedienelement glühen lassen oder drücken (hall:ctl aus der Seite) */
  ctl(name: string, action: CtlAction) {
    const m = this.machines[this.focus];
    const c = m?.ctl.get(name);
    if (!c) return;
    c.goal = CTL_LEVEL[action];
    if (action === 'press') c.pressAt = performance.now();
    this.dirty = true;
  }

  /** Alle Bedienelemente des fokussierten Automaten in die Ruhelage (Close-up verlassen) */
  ctlReset() {
    const m = this.machines[this.focus];
    if (!m) return;
    for (const c of m.ctl.values()) {
      c.goal = 0;
      c.pressAt = -1e9;
    }
    this.dirty = true;
  }

  /** Glühen weich nachziehen, Knopfkappe/Joystick federn (nur der fokussierte Automat) */
  private tickControls(now: number, dt: number): boolean {
    const m = this.machines[this.focus];
    if (!m || !m.ctl.size) return false;
    let moving = false;
    const ws = new THREE.Vector3();
    for (const [name, c] of m.ctl) {
      if (Math.abs(c.goal - c.level) > 0.003) {
        c.level += (c.goal - c.level) * Math.min(1, dt * 9);
        const e = c.level;
        for (const cm of c.mats) cm.mat.emissiveIntensity = cm.own ? cm.base * (1 + e * (e < 0 ? 0.7 : 1.4)) : Math.max(0, e) * 0.9;
        moving = true;
      }
      // Druck: 90 ms runter, 140 ms zurück — der Joystick kippt am Fuß, Kappen sinken 4 mm; danach zurück auf „gemappt"
      const el = now - c.pressAt;
      const k = el < 90 ? el / 90 : el < 230 ? 1 - (el - 90) / 140 : 0;
      if (k === 0 && c.pressK > 0 && c.goal === CTL_LEVEL.press) c.goal = CTL_LEVEL.lit;
      if (k > 0 || c.pressK > 0) {
        c.pressK = k;
        moving = true;
        if (name === 'joy') c.move.rotation.set(0, 0, -c.joyDir * k * 0.24);
        else if (name === 'trackball') {
          // Kugel rollt in Blätterrichtung, der Ring bleibt
          if (c.spin && k > 0) c.spin.rotation.x += c.joyDir * dt * 7;
        } else {
          const unit = c.node.parent ? c.node.parent.getWorldScale(ws).y : 1;
          c.move.position.set(0, -(k * 0.004) / Math.max(1e-6, unit), 0);
        }
      }
    }
    return moving;
  }

  /** Joystick-Richtung fürs nächste Kippen (−1 links, 1 rechts) */
  joyDir(dir: -1 | 1) {
    const m = this.machines[this.focus];
    for (const name of ['joy', 'trackball']) {
      const c = m?.ctl.get(name);
      if (c) c.joyDir = dir;
    }
  }

  /** Bildschirm des fokussierten Automaten in Viewport-Pixel — darauf legt die Seite das iframe */
  private emitScreenRect() {
    const m = this.machines[this.focus];
    const sf = m ? this.screenFrameOf(m) : undefined;
    if (!sf || !m?.screen) return;
    this.camera.updateMatrixWorld(true);
    const r = this.renderer.domElement.getBoundingClientRect();
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    // Die echten Punkte des Bildschirm-Meshes (gewölbte Röhre, Rand) statt der Box-Ecken — sonst
    // sitzt das Fenster der Seite einen Hauch zu groß auf dem Glas
    const pos = m.screen.geometry.getAttribute('position');
    m.screen.updateWorldMatrix(true, false);
    const v = new THREE.Vector3();
    const pts: THREE.Vector3[] = [];
    if (pos && pos.count <= 6000) for (let i = 0; i < pos.count; i++) pts.push(v.fromBufferAttribute(pos, i).applyMatrix4(m.screen.matrixWorld).clone());
    for (const c of pts.length ? pts : sf.corners) {
      const p = c.clone().project(this.camera);
      const x = r.left + ((p.x + 1) / 2) * r.width;
      const y = r.top + ((1 - p.y) / 2) * r.height;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    if (!Number.isFinite(x0) || x1 - x0 < 4) return;
    document.dispatchEvent(new CustomEvent('hall:screenrect', { detail: { pose:this.pose, x: x0, y: y0, w: x1 - x0, h: y1 - y0 } }));
  }
  setAttract(a: boolean) {
    this.attract = a;
  }
  setReduce(r: boolean) {
    this.reduce = r;
    if (r) this.finishPower();
  }

  private applyFocus(immediate: boolean) {

    for (const m of this.machines) {
      const d = Math.abs(m.index - this.focus);
      // Jenseits von sechs Stationen steht alles im Nebel — gar nicht erst zeichnen (Modelle, die noch laden,
      // bleiben in der Hand von loadModel)
      if (m.loaded || !(MODELS_BY_SLUG[m.item.slug] ?? MODELS[m.item.kind])) m.group.visible = d <= 6;
      if (d <= NEAR) this.ensureTextures(m);
      const bright = d === 0 ? 1 : this.pose !== 'hall' ? 0.14 : d === 1 ? 0.62 : 0.4;
      m.group.userData.targetBright = bright;
      if (immediate) m.group.userData.bright = bright;
    }
    this.roomLighting.setFocus(this.focus);
  }

  /** Stationen, deren Hülle der Strahl trifft — spart den Dreiecks-Test an allen 16 Modellen */
  private rayCandidates(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    const box = new THREE.Box3();
    for (const m of this.machines) {
      if (!m.group.visible) continue;
      // Hit testing includes the complete housing and props; camera framing stays independent.
      box.setFromObject(m.group);
      if (this.raycaster.ray.intersectsBox(box)) out.push(m.group);
    }
    return out;
  }

  /** Match the actual button/joystick mesh, including children of imported controls. */
  private controlAt(m: Machine, hit: THREE.Object3D): string | undefined {
    for (const [name, c] of m.ctl) {
      let node: THREE.Object3D | null = hit;
      while (node) {
        if (node === c.node) return name;
        node = node.parent;
      }
    }
    return undefined;
  }

  /* ---------- Eingabe ---------- */
  private onPointerMove = (e: PointerEvent) => {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    const now = performance.now();
    if (now - this.hoverAt > 90) {
      this.hoverAt = now;
      this.updateCursor();
    }
  };
  /** Zeiger: Automat anklickbar, Bildschirm öffnet die Großansicht */
  private updateCursor() {
    if (this.tweenDur > 0 && performance.now() - this.tweenStart < this.tweenDur) return;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.rayCandidates(), true);
    const blueHit = this.blue?.hit(this.raycaster);
    if (blueHit && (!hits.length || blueHit.distance < hits[0].distance)) {
      this.renderer.domElement.style.cursor = 'pointer';
      return;
    }
    let cursor = '';
    if (hits.length) {
      let o: THREE.Object3D | null = hits[0].object;
      while (o && o.userData.index === undefined) o = o.parent;
      const idx = o?.userData.index as number | undefined;
      const cur = this.machines[this.focus];
      if (idx !== undefined) {
        if (this.pose === 'hall' || idx !== this.focus) cursor = 'pointer';
        else if (cur && (hits.slice(0, 4).some((h) => h.object === cur.screen) || this.controlAt(cur, hits[0].object))) cursor = 'zoom-in';
      }
    } else if (this.pose === 'zoom' || this.pose === 'screen') {
      // Ins Leere klicken fährt zurück (Zoom → Halle, Close-up → Automat) — der Zeiger kündigt es an
      cursor = 'zoom-out';
    }
    if (this.renderer.domElement.style.cursor !== cursor) this.renderer.domElement.style.cursor = cursor;
  }
  private onClick = (e: MouseEvent) => {
    const r = this.renderer.domElement.getBoundingClientRect();
    const p = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    this.raycaster.setFromCamera(p, this.camera);
    const hits = this.raycaster.intersectObjects(this.rayCandidates(), true);
    const blueHit = this.blue?.hit(this.raycaster);
    if (blueHit && (!hits.length || blueHit.distance < hits[0].distance)) {
      this.blue?.pet();
      this.dirty = this.mirrorDirty = true;
      return;
    }
    if (!hits.length) {
      if (this.pose !== 'hall') this.cb.onBackdrop?.();
      return;
    }
    let o: THREE.Object3D | null = hits[0].object;
    while (o && o.userData.index === undefined) o = o.parent;
    if (!o) return;
    const idx = o.userData.index as number;
    if (this.pose !== 'hall') {
      const cur = this.machines[this.focus];
      if (idx !== this.focus) this.cb.onPick(idx);
      else if (cur && (hits.slice(0, 4).some((h) => h.object === cur.screen) || this.controlAt(cur, hits[0].object))) this.cb.onScreenClick?.();
      return;
    }
    this.cb.onOpen(idx);
  };
  private onResize = () => {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    // Zusammengeklapptes Fenster (0 × 0): nichts anfassen, sonst wird die Projektion NaN
    if (!w || !h) return;
    if (this.perfLevel > 0) this.renderer.setPixelRatio(this.pixelRatioFor(w, h, this.lite));
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    this.updateWallTitle();
    this.camera.updateProjectionMatrix();
    this.updateGoal();
    this.settledFlag = false;
    this.dirty = true;
  };

  /* ---------- Loop ---------- */
  start() {
    if (this.container.closest('[data-hall-parked]')) return;
    if (this.running || !this.readyDone || this.disposed || this.startupFailed) return;
    const ratio = this.renderer.getPixelRatio();
    if (this.renderer.domElement.width !== Math.floor(this.container.clientWidth * ratio) || this.renderer.domElement.height !== Math.floor(this.container.clientHeight * ratio)) this.onResize();
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }
  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
  private tick = (now: number) => {
    if (!this.running) return;
    // Höchstens ~60 Bilder pro Sekunde: auf 120/144-Hz-Schirmen bleibt so mehr als die Hälfte des Hauptthreads
    // für DOM-Übergänge und Eingabe frei; die Animationen sind zeitbasiert und bleiben gleich schnell
    if (now - this.last < 15.2) {
      this.raf = requestAnimationFrame(this.tick);
      return;
    }
    const frameDt = (now - this.last) / 1000;
    const dt = Math.min(0.05, frameDt);
    this.last = now;
    const t = now / 1000;

    // Kamera: je Pose zum Ziel fahren — Halle: Fokus in der Reihe, Zoom: Automat im freien Bereich, Play: Bildschirm.
    // Leichte Parallaxe zum Zeiger und das Attract-Schwanken gibt es nur in der Halle.
    this.updateGoal();
    const inHall = this.pose === 'hall';
    // Ziel verschoben (Modell nachgeladen, Fenster verändert, neue Station)? Fahrt ab hier neu starten.
    if (this.prevGoalPos.distanceToSquared(this.goalPos) > 0.0004 || this.prevGoalLook.distanceToSquared(this.goalLook) > 0.0004 || Math.abs(this.prevGoalFov - this.goalFov) > 0.01) {
      this.retarget(now);
    }
    // Ein ungültiges Ziel (NaN) darf die Kamera nicht vergiften — altes Ziel behalten bzw. neu aufsetzen
    if (!vecOk(this.goalPos) || !vecOk(this.goalLook) || !Number.isFinite(this.goalFov)) {
      if (vecOk(this.prevGoalPos) && vecOk(this.prevGoalLook)) {
        this.goalPos.copy(this.prevGoalPos);
        this.goalLook.copy(this.prevGoalLook);
        this.goalFov = Number.isFinite(this.prevGoalFov) ? this.prevGoalFov : this.fov;
      } else {
        this.goalPos.set(this.targetX, 1.9, 7.6);
        this.goalLook.set(this.targetX, 1.7, 0);
        this.goalFov = 42;
      }
    }
    if (!vecOk(this.camPos) || !vecOk(this.camLook) || !Number.isFinite(this.fov)) this.snapCamera();
    // Out-Expo über feste Dauer: die Ankunft ist weich, die Dauer immer gleich
    const el = this.tweenDur > 0 ? Math.min(1, (now - this.tweenStart) / this.tweenDur) : 1;
    const k = this.reduce || el >= 1 ? 1 : 1 - Math.pow(2, -10 * el);
    this.camPos.lerpVectors(this.tweenFrom.pos, this.goalPos, k);
    this.camLook.lerpVectors(this.tweenFrom.look, this.goalLook, k);
    this.fov = this.tweenFrom.fov + (this.goalFov - this.tweenFrom.fov) * k;
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
    this.camX = this.camPos.x;
    const sway = inHall && this.attract && !this.reduce ? Math.sin(t * 0.6) * 0.25 : 0;
    const px = inHall && !this.reduce ? this.pointer.x * 0.35 : 0;
    const py = inHall && !this.reduce ? this.pointer.y * 0.18 : 0;
    this.camera.position.set(this.camPos.x + px + sway, this.camPos.y + py, this.camPos.z);
    this.camera.lookAt(this.camLook.x + px * 0.5, this.camLook.y, this.camLook.z);
    // TV illumination inherits the carriage and pendulum transform.
    this.camera.updateMatrixWorld();
    const camMoving = k < 1;
    if (this.pose === 'screen' && (camMoving || !this.settledFlag || this.dirty)) {
      this.emitScreenRect(); this.emitControlRects();
    }
    if (!camMoving && !this.settledFlag) {
      this.settledFlag = true;
      this.flushDeferredScreens();
      if (!inHall) this.emitScreenRect();
      if (this.pose === 'zoom') this.emitMachineRect();
      if (this.pose === 'screen' || this.pose === 'play') this.emitControlRects();
      document.dispatchEvent(new CustomEvent('hall:settled', { detail: { pose: this.pose } }));
    }
    const ctlMoving = this.tickControls(now, dt);
    const lightingMoving = this.roomLighting.update(dt,inHall);
    if(lightingMoving)this.mirrorDirty=true;
    // Nebel: vor dem Automaten dichter, die Nachbarn treten zurück
    const fog = this.scene.fog as THREE.Fog;
    const close = this.pose === 'play' || this.pose === 'screen';
    const fogNear = inHall ? 10.5 : close ? 2.6 : 4.2;
    const fogFar = inHall ? 24 : close ? 8 : 11.5;
    fog.near += (fogNear - fog.near) * Math.min(1, dt * 3.5);
    fog.far += (fogFar - fog.far) * Math.min(1, dt * 3.5);
    if (Math.abs(fogNear - fog.near) < 0.08) fog.near = fogNear;
    if (Math.abs(fogFar - fog.far) < 0.15) fog.far = fogFar;
    const fogMoving = fog.near !== fogNear || fog.far !== fogFar;

    // Fernseher fährt zeitbasiert auf der Schiene zum Fokus — nur zwischen den Automaten; an Kasse/Telefon parkt er
    const tv = this.tv;
    const tvGoal = Math.min(tv.range[1], Math.max(tv.range[0], this.targetX));
    if (!(Math.abs(tvGoal - tv.to) < 1e-6)) {
      const first = Number.isNaN(tv.to);
      tv.from = first ? tvGoal : this.wallX;
      tv.to = tvGoal;
      tv.t0 = now;
      tv.dur = first || this.reduce ? 0 : Math.min(680, Math.max(300, Math.abs(tv.to - tv.from) * 100));
    }
    const tt = tv.dur > 0 ? Math.min(1, (now - tv.t0) / tv.dur) : 1;
    const ease = tt < 0.5 ? 4 * tt * tt * tt : 1 - Math.pow(-2 * tt + 2, 3) / 2;
    const prevX = this.wallX;
    this.wallX = tv.from + (tv.to - tv.from) * ease;
    const dx = this.wallX - prevX;
    tv.lastX = this.wallX;
    tv.rig.position.x = this.wallX;
    let wallMoving = tt < 1;
    if (Math.abs(dx) > 1e-6) for (const w of tv.wheels) w.rotation.x -= dx / 0.055;
    // Das Gerät pendelt beim Anfahren und Bremsen leicht nach (gedämpft)
    const vel = dt > 0 ? dx / dt : 0;
    const acc = (vel - tv.vel) / Math.max(dt, 1e-3);
    tv.vel = vel;
    tv.swing += (-acc * 0.004 - tv.swing * 6) * Math.min(dt, 0.05);
    tv.swing = Math.max(-0.05, Math.min(0.05, tv.swing));
    if (Math.abs(tv.swing) > 1e-4 || Math.abs(tv.hang.rotation.z) > 1e-4) {
      tv.hang.rotation.z += (tv.swing - tv.hang.rotation.z) * Math.min(1, dt * 6);
      wallMoving = true;
    }
    const focused = this.machines[this.focus];
    // Steht der Fokus auf Kasse oder Telefon, parkt der Fernseher am Rand und zeigt die Logo-Karte des Automaten dort
    const parked = focused && !isMachine(focused.item);
    const parkIdx = nearestStation(this.stationX, tvGoal);
    const cur = parked ? this.machines[parkIdx] : focused;
    const hasPic = Boolean(cur && isMachine(cur.item) && (cur.bitmaps.some(Boolean) || cur.raw.some((t) => t?.image)));
    const arrived = tt >= 1;
    // In der Halle und im Zoom an; im Close-up und beim Spielen aus
    const screenOn = hasPic && (inHall || this.pose === 'zoom');
    const tvGoalOp = screenOn ? 0.94 : 0;
    tv.screen.material.opacity += (tvGoalOp - tv.screen.material.opacity) * Math.min(1, dt * 5);
    if (Math.abs(tvGoalOp - tv.screen.material.opacity) < 0.015) tv.screen.material.opacity = tvGoalOp;
    if (tv.screen.material.opacity !== tvGoalOp) wallMoving = true;
    tv.screen.visible = tv.screen.material.opacity > 0.02;
    // Start the presentation clock only once the rig and logo are ready.
    if (tv.phase === 'static' && arrived && now >= tv.staticUntil) {
      tv.phase = 'logo'; tv.phaseAt = -1; tv.key = '';
    }
    tv.logo.visible = false;
    const staticOn = screenOn && tv.phase === 'static';
    const staticGoal = staticOn ? 1 : 0;
    if (Math.abs(staticGoal - tv.staticMix) > 0.01) {
      tv.staticMix += (staticGoal - tv.staticMix) * Math.min(1, dt * (staticOn ? 22 : 9));
      wallMoving = true;
    }
    if (tv.staticMix > 0.02) {
      wallMoving = true;
      tv.noiseTex.offset.set(Math.random(), Math.random());
      tv.noise.material.opacity = tv.screen.material.opacity * tv.staticMix * (0.82 + Math.random() * 0.18);
      tv.noise.visible = true;
    } else tv.noise.visible = false;
    const glowLevel = tv.screen.material.opacity * (1 - tv.staticMix * 0.55);
    if (tv.light) tv.light.intensity = glowLevel * 2.2;
    tv.glow.material.opacity = glowLevel * 0.16;
    this.neonLight.intensity = glowLevel * .45;
    tv.led.material.color.setHex(screenOn ? 0x2bd67b : 0xff3b30);
    if (cur && hasPic) {
      this.neonLight.color.lerp(parked ? focused.brand : cur.brand, 1-Math.exp(-dt*7));
      tv.glow.material.color.copy(this.neonLight.color);
      tv.light?.color.copy(this.neonLight.color);
      if (arrived && tv.phase !== 'static') this.updateTv(cur, inHall, now);
    }

    // Helligkeit der Automaten weich nachziehen, Figuren wippen (nur in der Halle).
    // Außerhalb der Halle gehen Bildschirme und Schilder der Nachbarn fast aus (dimMix).
    let brightMoving = false;
    const dimGoal = inHall ? 0 : 1;
    this.dimMix += (dimGoal - this.dimMix) * Math.min(1, dt * 4);
    if (Math.abs(dimGoal - this.dimMix) < 0.012) this.dimMix = dimGoal;
    if (this.dimMix !== dimGoal) brightMoving = true;
    const mix = (a: number, b: number) => a + (b - a) * this.dimMix;
    for (const m of this.machines) {
      const ud = m.group.userData;
      ud.bright = ud.bright ?? ud.targetBright ?? 0.4;
      ud.bright += ((ud.targetBright ?? 0.4) - ud.bright) * Math.min(1, dt * 4.5);
      if (Math.abs((ud.targetBright ?? 0.4) - ud.bright) < 0.012) ud.bright = ud.targetBright ?? 0.4;
      if (ud.bright !== (ud.targetBright ?? 0.4)) brightMoving = true;
      const b = ud.bright as number;
      const other = m.index !== this.focus;
      if (m.screen && !(this.blackout && m.index === this.focus)) m.screen.material.color.setScalar(other ? mix(0.3 + b * 0.62, b * 0.8) : 0.3 + b * 0.62);
      if (m.marqueeGlow) m.marqueeGlow.material.emissiveIntensity = other ? mix(0.15 + b * 0.45, b * 0.25) : 0.15 + b * 0.45;
      const mqMax = (m.group.userData.marqueeMax as number | undefined) ?? 1;
      if (m.marquee) m.marquee.material.color.setScalar(Math.min(mqMax, other ? mix(0.55 + b * 0.45, b * 0.8) : 0.55 + b * 0.45));
      const showCast = inHall || m.index === this.focus;
      if (m.sprite && m.sprite.visible !== showCast) {
        m.sprite.visible = showCast;
        this.dirty = true;
      }
      if (m.model && m.item.kind !== 'kasse' && m.model.visible !== showCast) {
        m.model.visible = showCast;
        this.dirty = true;
      }
      if (m.sprite && !this.reduce && inHall && !m.spriteAnim) m.sprite.position.y = 0.36 + Math.sin(t * 1.6 + m.index) * 0.02;
      // Idle-Animation der Figur: nächster Frame aus dem Raster (läuft in allen Posen, nur nahe am Fokus)
      const sa = m.spriteAnim;
      if (sa && Math.abs(m.index - this.focus) <= (inHall ? 2 : 0)) {
        const frame = this.reduce ? 0 : Math.floor(t * sa.fps) % sa.frames;
        if (frame !== sa.frame) {
          sa.frame = frame;
          sa.tex.offset.set((frame % sa.cols) / sa.cols, 1 - (Math.floor(frame / sa.cols) + 1) / sa.rows);
          brightMoving = true;
        }
      }
      if (m.model && !this.reduce && (inHall || (m.item.kind === 'kasse' && m.index === this.focus))) {
        if (m.item.kind === 'kasse') {
          // Außerhalb der Halle rendert die Bühne nur bei Änderungen — die Figur bewegt sich, also zeichnen
          if (!inHall) this.dirty = true;
          m.model.rotation.y = Math.sin(t * 0.45) * 0.55; // Drehteller pendelt, Gesicht bleibt vorn
          const kz = m.group.userData.kasse as { disc?: THREE.Object3D; carriage?: THREE.Object3D; claw?: THREE.Object3D; carriageRest?: THREE.Vector3 | null; clawRest?: THREE.Vector3 | null; k: number } | undefined;
          if (kz) {
            if (kz.disc) kz.disc.rotation.y = m.model.rotation.y;
            // Greifer fährt langsam über die Preise (Versatz in Modell-Einheiten)
            const ox = (Math.sin(t * 0.35) * 0.16) / kz.k;
            const oz = (Math.cos(t * 0.27) * 0.035) / kz.k; // die Rollen bleiben auf den Schienen
            if (kz.carriage && kz.carriageRest) kz.carriage.position.set(kz.carriageRest.x + ox, kz.carriageRest.y, kz.carriageRest.z + oz);
            if (kz.claw && kz.clawRest) kz.claw.position.set(kz.clawRest.x + ox, kz.clawRest.y, kz.clawRest.z + oz);
          } else {
            const claw = m.props[0];
            if (claw) {
              claw.position.x = Math.sin(t * 0.45) * 0.3;
              claw.position.z = Math.cos(t * 0.3) * 0.12;
            }
          }
        } else {
          m.model.rotation.y = 0.55 + Math.sin(t * 0.7 + m.index) * 0.12;
        }
      }
    }

    for (const m of this.machines) if (m.dissolve?.tick(now)) brightMoving = true;
    if (this.blue?.update(dt, this.camera, this.focus <= 2 && (inHall || this.focus === 0), this.reduce)) {
      this.dirty = this.mirrorDirty = true;
    }
    if (this.tvDissolve?.tick(now)) wallMoving = true;

    // Außerhalb der Halle nur rendern, wenn sich etwas bewegt — die Seite daneben bleibt flüssig
    if (inHall || camMoving || lightingMoving || brightMoving || fogMoving || wallMoving || ctlMoving || this.dirty || !this.readyDone) {
      if (brightMoving || wallMoving || ctlMoving || this.dirty) this.mirrorDirty = true;
      this.dirty = false;
      this.renderFrame();
      this.watchPerformance(frameDt);
      // Erst wenn alles Nahe geladen und gezeichnet ist, darf die Bühne erscheinen
      if (!this.readyDone && this.pending === 0 && now - this.bornAt > 120) this.finishReady();
    }
    this.raf = requestAnimationFrame(this.tick);
  };

  private finishPower() {
    if (!this.readyDone) { this.powerSkipped = true; return; }
    if (this.powerAt === null) return;
    this.powerAt = null;
    delete this.container.dataset.power;
    this.flushDeferredScreens();
    this.mirrorDirty = true;
    this.dirty = true;
  }

  private renderFrame() {
    const draw = () => {
      if (this.composer && this.perfLevel === 2) this.composer.render();
      else this.renderer.render(this.scene, this.camera);
    };
    if (this.powerAt !== null) {
      const age = performance.now() - this.powerAt;
      // While geometry loads, only dim ignition attempts repeat; the full warm-up waits for real assets.
      const elapsed = age;
      if (!this.readyDone || elapsed < ROOM_POWER_MS) {
        this.scene.updateMatrixWorld();
        this.mirrorDirty = true;
        withRoomPower(this.scene, elapsed, this.stationX[this.initialFocus], draw, false, this.powerTargets);
        return;
      }
      this.finishPower();
    }
    draw();
  }

  /** Pixelratio nach Fläche deckeln: mehr als ~2560×1440 Render-Pixel bringt nichts, kostet aber viel */
  private pixelRatioFor(w: number, h: number, lite: boolean) {
    const dpr = Math.min(window.devicePixelRatio || 1, lite ? 1.25 : 1.5);
    const budget = lite ? 1280 * 720 : 2560 * 1440;
    const px = w * h * dpr * dpr;
    return px > budget ? dpr * Math.sqrt(budget / px) : dpr;
  }

  /** Sustained frames above 24ms reduce GPU cost; isolated stalls do not lower quality. */
  private watchPerformance(dt: number) {
    // Ausreißer (Shader-Bau, GC, Tab-Wechsel) sagen nichts über die Bildrate
    if (dt <= 0 || dt > 0.1) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes = [];
    // Wieder hochschalten, wenn es länger locker läuft (Bloom/Spiegel zurück)
    if (avg < 0.017 && this.perfLevel < 2) {
      this.perfGood += 1;
      if (this.perfGood >= 4) {
        this.perfGood = 0;
        this.perfLevel += 1;
        if (this.perfLevel === 1) this.renderer.setPixelRatio(this.pixelRatioFor(this.container.clientWidth, this.container.clientHeight, this.lite));
        if (this.perfLevel === 2 && this.mirror) this.mirror.visible = this.pose === 'hall' || this.pose === 'zoom';
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight, false);
        this.composer?.setSize(this.container.clientWidth, this.container.clientHeight);
        this.dirty = true;
      }
      return;
    }
    this.perfGood = 0;
    if (avg > 0.024 && this.perfLevel > 0) {
      this.perfLevel -= 1;
      if (this.perfLevel === 1) {
        this.mirrorDirty = true;
        console.info('[hall] Leistung: reduzierte Reflexion, Bloom aus');
      } else {
        this.renderer.setPixelRatio(Math.min(1,this.pixelRatioFor(this.container.clientWidth,this.container.clientHeight,this.lite)*.7));
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight, false);
        console.info('[hall] Leistung: reduzierte Renderfläche');
      }
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    window.clearTimeout(this.readinessTimer);
    this.readyTimeouts.forEach(window.clearTimeout);
    this.readyTimeouts.clear();
    this.readyRejectors.splice(0).forEach(reject => reject(new Error('Hall disposed during startup')));
    this.readyResolvers = [];
    window.clearTimeout(this.deferredScreenTimer);
    this.deferredScreens.clear();
    this.stop();
    this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.removeEventListener('click', this.onClick);
    window.removeEventListener('resize', this.onResize);
    this.renderer.domElement.remove();
    // compileAsync polls renderer material properties from a timer. Disposing
    // those properties while it runs removes currentProgram and makes Three's
    // next program.isReady() call throw outside the promise. Detach immediately,
    // but release GPU resources only when that existing warm-up has settled.
    if (this.warmupPromise) {
      void this.warmupPromise.then(() => this.releaseResources(), () => this.releaseResources());
    } else this.releaseResources();
  }

  private releaseResources() {
    this.blue?.dispose();
    this.wallPaint.dispose();
    this.glassWear.roughness.dispose();
    this.tvSlides.forEach(texture=>texture.dispose());this.tvSlides.clear();
    this.tvBlank.dispose();
    this.tv?.tex.dispose();this.tv?.logoTex.dispose();this.tv?.noiseTex.dispose();
    this.surfaceMaps.normal.dispose(); this.surfaceMaps.roughness.dispose();
    this.reflectionResources.forEach(resource=>resource.dispose());
    this.roomLighting.dispose();
    this.artworkTextures.forEach((texture) => texture.dispose());
    this.artworkTextures.clear();
    this.cabinetArtSources.forEach(texture=>texture.dispose());this.cabinetArtSources.clear();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    this.machines.forEach((m) => {
      m.textures.forEach((t) => t?.dispose());
      m.raw.forEach((t) => t?.dispose());
      m.bitmaps.forEach((b) => b?.close());
    });
    this.bitmapCache.forEach((b) => b.close());
    this.bitmapCache.clear();
    this.texCache.forEach((t) => t.dispose());
    this.texCache.clear();
    this.fitCache.forEach((t) => t.dispose());
    this.fitCache.clear();
    this.composer?.dispose();
    this.renderer.dispose();
    // Kontext wirklich freigeben — Seiten ohne Halle sollen keinen der ~16 Kontexte belegen
    this.renderer.forceContextLoss();
  }
}

