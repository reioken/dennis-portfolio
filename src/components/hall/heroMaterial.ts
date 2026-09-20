import * as THREE from 'three';

/**
 * Hero machines (scripts/models/blender/hero_gen.py) carry two UV sets and one baked mask atlas, exported as the
 * glTF occlusion texture on the second set: R = ambient occlusion, G = light from the machine's own screen,
 * B = light from its brand lamps (both as the square root of a form factor), A = wear (0.5 neutral, above =
 * rubbed edges, below = dirt). The first set is a box projection, 4 m per UV unit, over which the shared scanned
 * surfaces (public/textures/hardware, ambientCG CC0) tile.
 */
const UV_METRES = 4;
const HERO_EXPOSURE = 1.6;
type Surface = { file: string; tile: number; normal: number; edge: number; rough?: number; metal?: number; grain?: number; flat?: number; wear?: number };
const SURFACES: Record<string, Surface> = {
  // tile = metres per repeat; edge = how bright a rubbed edge gets relative to the base colour
  paint: { file: 'powdercoat-v1', tile: .28, normal: .55, edge: 5.5 },
  plastic: { file: 'plastic-v1', tile: .5, normal: .5, edge: 3.2 },
  steel: { file: 'steel-v1', tile: .6, normal: .7, edge: 2.4, metal: .9, wear: .55 },
  brushed: { file: 'brushed-v1', tile: .25, normal: .6, edge: 1.5, metal: .92, wear: .45 },
  // the control deck: black like the carcass, a little glossier, so it carries the screen's reflection
  satin: { file: 'plastic-v1', tile: .5, normal: .3, edge: 2.6, rough: .62, grain: .15 },
  // gloss acrylic (the display sheet): the scan only breaks up the reflection, it must never read as a pattern
  gloss: { file: 'plastic-v1', tile: 1.1, normal: .03, edge: 1.4, grain: 0, flat: .16 },
};

function surfaceFor(name: string): keyof typeof SURFACES | null {
  if (/seam|led|lamp|brand_lit|accent|tmolding|ball|ivory|pilaster/.test(name)) return null;
  if (/gloss/.test(name)) return 'gloss';
  if (/satin/.test(name)) return 'satin';
  if (/metal_door|kick/.test(name)) return 'steel';
  if (/metal|chrome|fastener|grille/.test(name)) return 'brushed';
  if (/paint/.test(name)) return 'paint';
  return 'plastic';
}

type SurfaceMaps = Record<string, { normal: THREE.Texture; orm: THREE.Texture }>;
/** The scans per surface, plus the shared wear detail (scripts/assets/hero-wear-texture.py): the baked mask says
 * where a machine is worn, these two tiles say what wear looks like at arm's length. */
export type HeroMaps = { surfaces: SurfaceMaps; wear: Record<WearTile, THREE.Texture>; room: HeroRoom };
type WearTile = 'scratches' | 'swirls' | 'scuffs' | 'chips' | 'pits' | 'flakes';
/** How ONE machine has aged (Dennis: every machine a unique piece, never the same pattern twice). The seed moves
 * every part's pattern, the tiles decide the kind of wear (hairline scratches, wipe marks or scuffs; chipped paint,
 * dings or flaking plates), turn/scale change their direction and grain, the amounts their strength. */
export type HeroLook = { seed: string; lines: 'scratches' | 'swirls' | 'scuffs'; chips: 'chips' | 'pits' | 'flakes'; turn: number; scale: number; chip: number; line: number };
export const RIFTBACK_LOOK: HeroLook = { seed: '', lines: 'scratches', chips: 'chips', turn: 0, scale: 1, chip: .95, line: 1 };
const WEAR_TILE = .6;

/** What a hero machine mirrors (scripts/build-hero-environment.mjs): the hall's own environment is nearly black
 * towards the viewer, so a gloss front had nothing to reflect. Same prefiltered CubeUV layout and size as the hall's,
 * so swapping it in needs no new shader program. It arrives after the first frame; until then the hall's is used. */
type HeroRoom = { texture: THREE.Texture | null; users: Set<THREE.MeshStandardMaterial> };
function loadHeroRoom(onLoad: () => void): HeroRoom {
  const room: HeroRoom = { texture: null, users: new Set() };
  void (async () => {
    const response = await fetch('/textures/hero-environment-v1.bin.gz');
    if (!response.ok) return;
    let buffer = await response.arrayBuffer();
    const magic = new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength));
    if (magic[0] === 0x1f && magic[1] === 0x8b) buffer = await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    const header = new DataView(buffer);
    const width = header.getUint32(0, true), height = header.getUint32(4, true);
    if (width !== 768 || height !== 1024 || buffer.byteLength !== 8 + width * height * 8) return;
    const texture = new THREE.DataTexture(new Uint16Array(buffer, 8), width, height, THREE.RGBAFormat, THREE.HalfFloatType);
    texture.mapping = THREE.CubeUVReflectionMapping;
    texture.colorSpace = THREE.LinearSRGBColorSpace;
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    room.texture = texture;
    for (const mat of room.users) mat.envMap = texture;
    onLoad();
  })().catch(() => {});
  return room;
}

export function loadHeroMaps(loader: THREE.TextureLoader, onLoad: () => void): HeroMaps {
  const maps: SurfaceMaps = {};
  for (const [key, surface] of Object.entries(SURFACES)) {
    const load = (kind: string) => {
      const t = loader.load(`/textures/hardware/${surface.file}-${kind}.webp`, onLoad);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.setScalar(UV_METRES / surface.tile);
      t.anisotropy = 8;
      return t;
    };
    maps[key] = { normal: load('normal'), orm: load('orm') };
  }
  const wear = (name: string) => {
    // changed tiles get a new file name: /textures/* is edge-cached for a day
    const t = loader.load(`/textures/hardware/wear-${name}-${/pits|scuffs|flakes/.test(name) ? 'v2' : 'v1'}.webp`, onLoad);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return t;
  };
  // fetched on first use: a hall with one kind of wear never downloads the others
  const tiles = {} as Record<WearTile, THREE.Texture>;
  for (const name of ['scratches', 'swirls', 'scuffs', 'chips', 'pits', 'flakes'] as const) Object.defineProperty(tiles, name, { configurable: true, enumerable: true, get() { const t = wear(name); Object.defineProperty(tiles, name, { value: t, enumerable: true }); return t; } });
  return { surfaces: maps, wear: tiles, room: loadHeroRoom(onLoad) };
}

export const isHeroMaterial = (material: THREE.Material | undefined): material is THREE.MeshStandardMaterial =>
  Boolean(material && (material as THREE.MeshStandardMaterial).isMeshStandardMaterial && (material as THREE.MeshStandardMaterial).aoMap);

/** Light the machine throws on itself; one object per machine so its screen and lamps can drive it. */
export type HeroGlow = { screen: { value: THREE.Color }; brand: { value: THREE.Color }; look: HeroLook };
export const makeHeroGlow = (brand: THREE.Color, look: HeroLook = RIFTBACK_LOOK): HeroGlow => ({
  screen: { value: new THREE.Color(.62, .72, 1).multiplyScalar(4.4) },
  brand: { value: brand.clone().multiplyScalar(7) },
  look,
});

/** A trackball you can see turning: a marbled swirl in the ball's own space (no texture, no UVs needed). */
export function marbleBall(mat: THREE.MeshStandardMaterial) {
  mat.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 vHeroBall;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvHeroBall = normal;'); // the direction on the sphere: positions are quantized
    shader.fragmentShader = 'varying vec3 vHeroBall;\n' + shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      vec3 hb = normalize(vHeroBall) * 2.3;
      float heroSwirl = sin(hb.x * 1.7 + 2.6 * sin(hb.y * 1.3 + hb.z * .9) + 1.4 * sin(hb.z * 2.1 - hb.x * .6));
      diffuseColor.rgb *= mix(.42, 1.18, smoothstep(-.35, .45, heroSwirl));`);
  };
  mat.customProgramCacheKey = () => 'hero-ball-v1';
  mat.needsUpdate = true;
}

/** The key-light bake travels in the glTF emissive slot (hero-attach-mask.mjs). Materials that do not read it as a
 * shadow must not glow with it. */
export function stripHeroLight(mat: THREE.MeshStandardMaterial) {
  if (!mat.emissiveMap) return;
  mat.emissiveMap = null;
  if (mat.userData.heroLight) mat.emissive.setRGB(0, 0, 0);
}

/** A stable offset (x, y), turn (z, radians) and mirror (w) per material name. */
function wearShift(name: string, turn = 0) {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  const unit = (shift: number) => ((h >>> shift) & 1023) / 1023;
  return new THREE.Vector4(unit(0), unit(10), (unit(20) - .5) * .5 + turn, h & 1 ? 1 : -1);
}

/** How strongly the baked rounded edges bend the shading normal (1 = as baked, a 1.5 mm radius). A 1 K atlas for
 * a whole machine cannot resolve 1.5 mm: its mip chain spreads the edge over the neighbouring texels, and on the
 * near-mirror brushed metal of the shroud and the bezel that swung a whole face into the hall's lamp. 0.55 keeps
 * the rounding on the slots, the coin mechs and the door and takes that blown highlight back. */
const BEVEL_SCALE = 0.55;
/** The baked edge/bevel atlas, if this machine was built with one: the glTF normalTexture on the atlas UV set
 * (hero_gen.bake_bevel_normal → hero-attach-mask.mjs). Machines baked before it exists have none. */
const bevelMapOf = (original: THREE.MeshStandardMaterial) =>
  original.normalMap && original.normalMap.channel === 1 ? original.normalMap : null;

export function heroMaterial(original: THREE.MeshStandardMaterial, maps: HeroMaps, glow: HeroGlow): THREE.MeshStandardMaterial {
  const key = surfaceFor(original.name.toLowerCase());
  const mat = original.clone();
  mat.aoMapIntensity = 1;
  const bevel = bevelMapOf(original);
  // the trim, the lamps and the LEDs keep no tiling scan: three applies the baked atlas through its own normal
  // map path on the same UV set, which is exactly right there
  if (!key) { stripHeroLight(mat); return mat; }
  const surface = SURFACES[key];
  mat.normalMap = maps.surfaces[key].normal;
  mat.normalScale.setScalar(surface.normal);
  mat.roughnessMap = maps.surfaces[key].orm;
  mat.roughness = surface.rough ?? 1;
  mat.metalness = surface.metal ?? 0;
  mat.envMapIntensity = surface.metal ? .9 : key === 'gloss' ? .5 : .6;
  maps.room.users.add(mat);
  if (maps.room.texture) mat.envMap = maps.room.texture;
  // The self-lighting rides on the emissive term: the room's power cue dims it with every other lamp.
  mat.emissive = new THREE.Color(1, 1, 1);
  mat.emissiveIntensity = 1;
  const edge = { value: surface.edge }, grain = { value: surface.grain ?? .3 }, flat = { value: surface.flat ?? -1 };
  mat.onBeforeCompile = shader => {
    shader.uniforms.heroScreen = glow.screen;
    shader.uniforms.heroBrand = glow.brand;
    shader.uniforms.heroEdge = edge;
    shader.uniforms.heroGrain = grain;
    shader.uniforms.heroFlat = flat;
    shader.uniforms.heroScratches = { value: maps.wear[glow.look.lines] };
    shader.uniforms.heroChips = { value: maps.wear[glow.look.chips] };
    shader.uniforms.heroWearScale = { value: surface.tile / WEAR_TILE * glow.look.scale };
    shader.uniforms.heroLook = { value: new THREE.Vector3(glow.look.chip, glow.look.line, glow.look.seed ? 0 : .05) };
    shader.uniforms.heroWearShift = { value: new THREE.Vector4().copy(wearShift(original.name + glow.look.seed, glow.look.turn)) };
    shader.uniforms.heroWearAmount = { value: surface.wear ?? 1 };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 heroScreen;\nuniform vec3 heroBrand;\nuniform float heroEdge;\nuniform float heroGrain;\nuniform float heroFlat;\nuniform sampler2D heroScratches;\nuniform sampler2D heroChips;\nuniform float heroWearScale;\nuniform vec4 heroWearShift;\nuniform float heroWearAmount;\nuniform vec3 heroLook;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec4 heroMask = texture2D(aoMap, vAoMapUv);
        // a wiped acrylic sheet keeps almost none of it: broken-up crevice dirt along its borders reads as torn paper
        float heroWear = (heroFlat >= 0.0 ? .08 : 1.0) * heroWearAmount;
        // The baked mask is soft (1 K for the whole machine). Wear is not: paint chips off along a hard line and a
        // scratch is a hairline. The tiling detail supplies that: the soft mask is thresholded against the chip
        // height, and the scratches show wherever hands and shoes reach (and faintly in every highlight).
        // Every part carries its own wear: a scratch ends where the panel ends and does not run on across the coin
        // door and its mechs. The shift (offset, a small turn, a mirror) comes from the material's name.
        vec2 heroWearUv = vRoughnessMapUv * heroWearScale;
        heroWearUv = vec2(heroWearUv.x * heroWearShift.w, heroWearUv.y);
        heroWearUv = mat2(cos(heroWearShift.z), sin(heroWearShift.z), -sin(heroWearShift.z), cos(heroWearShift.z)) * heroWearUv + heroWearShift.xy;
        float heroChip = texture2D(heroChips, heroWearUv).r;
        float heroScratch = texture2D(heroScratches, heroWearUv + heroChip * .01).r;
        float heroRubSoft = max(heroMask.a * 2.0 - 1.0, 0.0);
        float heroDirtSoft = max(1.0 - heroMask.a * 2.0, 0.0);
        // The window opens ABOVE the chip height (heroLook.z = 0): with it centred on the height, a trace of baked wear let
        // the lowest 5 % of the tile through everywhere: "komische Dots" (Dennis). Riftback keeps the centred window
        // (z = .05), it was approved that way.
        float heroRub = smoothstep(heroChip - heroLook.z, heroChip + .1 - heroLook.z, heroRubSoft * heroLook.x) * step(.015, heroRubSoft) * heroWear;
        heroScratch *= heroLook.y;
        heroRub = max(heroRub, heroScratch * min(1.0, .12 + heroRubSoft * 2.5 + heroDirtSoft) * .55 * heroWear);
        float heroDirt = heroDirtSoft * mix(.55, 1.25, heroChip) * heroWear;
        diffuseColor.rgb *= mix(1.0, texture2D(roughnessMap, vRoughnessMapUv).r * 2.0, heroGrain);
        diffuseColor.rgb = mix(diffuseColor.rgb, min(diffuseColor.rgb * heroEdge + .012 * (heroEdge - 1.0), vec3(.8)), heroRub);
        diffuseColor.rgb *= 1.0 - heroDirt * .6;
        // three applies AO to indirect light only; the hall is lit by lamps, so direct light takes part of it too
        diffuseColor.rgb *= mix(1.0, heroMask.r, .5);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        // handling leaves a second, much larger pattern in the gloss: the same scan read at a quarter of its scale
        if (heroFlat >= 0.0) roughnessFactor = heroFlat;
        else roughnessFactor *= mix(.78, 1.28, smoothstep(.3, .7, texture2D(roughnessMap, vRoughnessMapUv * .23 + .37).g));
        // hairlines scatter light: they show in every reflection, the acrylic sheet included
        roughnessFactor = clamp(roughnessFactor + heroDirt * .3 - heroRub * .22 + heroScratch * (heroFlat >= 0.0 ? .035 : .22), .06, 1.0);`)
      .replace('#include <emissivemap_fragment>', `
        totalEmissiveRadiance *= (heroMask.g * heroMask.g * heroScreen + heroMask.b * heroMask.b * heroBrand) * (diffuseColor.rgb * .8 + .035);`)
      // The hall draws no shadows. The emissive slot carries the baked share of the key light that reaches the
      // texel (the hood shades the bezel, the shelf the pedestal); every direct light takes it.
      // Dennis wants more light on the machine: a hero surface takes the room's lamps at HERO_EXPOSURE.
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        float heroKey = ${HERO_EXPOSURE.toFixed(2)};
        #ifdef USE_EMISSIVEMAP
          heroKey *= texture2D(emissiveMap, vEmissiveMapUv).r;
        #endif
        reflectedLight.directDiffuse *= heroKey;
        reflectedLight.directSpecular *= heroKey;`);
    if (!bevel) return;
    shader.uniforms.heroBevel = { value: bevel };
    shader.uniforms.heroBevelScale = { value: BEVEL_SCALE };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D heroBevel;\nuniform float heroBevelScale;')
      // Every real edge is slightly rounded and catches a highlight; ours are razor sharp. The baked atlas carries
      // that rounding as a tangent-space normal on the atlas UV set (the same set as the mask), applied AFTER the
      // tiling scan on uv0. The frame comes from the screen-space derivatives of the atlas UV
      // (thetenthplanet.de/archives/1180), so no TANGENT attribute is needed and mirrored islands stay right.
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec3 heroBevelN = texture2D(heroBevel, vAoMapUv).xyz * 2.0 - 1.0;
        heroBevelN.xy *= heroBevelScale;
        vec3 heroQ0 = dFdx(-vViewPosition), heroQ1 = dFdy(-vViewPosition);
        vec2 heroSt0 = dFdx(vAoMapUv), heroSt1 = dFdy(vAoMapUv);
        vec3 heroQ1p = cross(heroQ1, normal), heroQ0p = cross(normal, heroQ0);
        vec3 heroT = heroQ1p * heroSt0.x + heroQ0p * heroSt1.x;
        vec3 heroB = heroQ1p * heroSt0.y + heroQ0p * heroSt1.y;
        float heroDet = max(dot(heroT, heroT), dot(heroB, heroB));
        float heroTs = heroDet == 0.0 ? 0.0 : faceDirection * inversesqrt(heroDet);
        normal = normalize(heroT * (heroBevelN.x * heroTs) + heroB * (heroBevelN.y * heroTs) + normal * heroBevelN.z);`);
  };
  mat.customProgramCacheKey = () => (bevel ? 'hero-surface-v13-bevel' : 'hero-surface-v13');
  return mat;
}
