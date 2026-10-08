/** The rounded bedroom stand to the right of the claw: separate Tripo references, Blender surface polish.
 * Static geometry is batched by material after the packer's transforms are applied. The GLB retains every assembly.
 * One still Melee match on a curved tube; the open view lets the original covers and small hardware read clearly.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { brushed, brushTexture } from './hifi';

/** Tiling speckle for sprayed metallic paint (the Trinitron's silver). */
function flakeTexture() {
  const N = 256, data = new Uint8Array(N * N * 4);
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < N * N; i++) {
    const v = Math.round(255 * (0.5 + 0.5 * (rand() - 0.5) + (rand() < 0.04 ? 0.35 : 0)));
    data.set([v, v, v, 255], i * 4);
  }
  const t = new THREE.DataTexture(data, N, N);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

/** Triplanar surface grain (no UVs needed): colour and gloss variation. Paint flake for the TV's silver (scale 34,
 * strong), a finer, quieter moulded-plastic grain for the other hardware. */
function flaked(m: THREE.MeshStandardMaterial, flake: THREE.Texture, scale = 34, colour = .1, gloss = .5) {
  m.onBeforeCompile = shader => {
    shader.uniforms.flakeMap = { value: flake };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFlakePos;\nvarying vec3 vFlakeNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFlakePos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvFlakeNormal = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform sampler2D flakeMap;\nvarying vec3 vFlakePos;\nvarying vec3 vFlakeNormal;\nfloat flakeAt() {\n  vec3 w = pow(abs(normalize(vFlakeNormal)), vec3(4.0));\n  w /= w.x + w.y + w.z;\n  vec3 p = vFlakePos * ${scale.toFixed(1)};\n  return texture2D(flakeMap, p.zy).r * w.x + texture2D(flakeMap, p.xz).r * w.y + texture2D(flakeMap, p.xy).r * w.z;\n}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\nfloat flk = flakeAt();\ndiffuseColor.rgb *= ${(1 - colour / 2).toFixed(3)} + ${colour.toFixed(3)} * flk;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor * (${(1 + gloss * .3).toFixed(3)} - ${gloss.toFixed(3)} * flk), 0.05, 1.0);`);
  };
  m.customProgramCacheKey = () => `tv-flake-${scale}-${colour}-${gloss}`;
  m.needsUpdate = true;
}

export const BEDROOM_PLACE ={ x: 1.32, z: -1.13, rotY: -.08, scale: 1.08 };
export class HallBedroomTv {
  readonly group = new THREE.Group();
  readonly dom = document.createElement('div');
  private twin = document.createElement('button');
  private close = document.createElement('button');
  private owned = new Set<{ dispose(): void }>();
  private open = false;
  private returnFocus = false;
  private focusClose = false;
  private placed = '';
  private box: THREE.Box3;
  private centre = new THREE.Vector3();
  private language = '';

  constructor(model: THREE.Object3D, callbacks: { open: () => void; close: () => void }) {
    this.group.name = 'bedroom-tv-corner';
    this.group.scale.setScalar(BEDROOM_PLACE.scale);
    model.updateMatrixWorld(true);
    const grain = brushTexture(); this.owned.add(grain);
    const flake = flakeTexture(); this.owned.add(flake);
    const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const materials = new Set<THREE.MeshStandardMaterial>();
    const pieces: string[] = [];
    model.traverse(o => {
      if (/^(bedroom-|crt-screen$|nintendo-|.*-controller$|tv-stand$)/.test(o.name)) pieces.push(o.name);
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      this.owned.add(mesh.geometry);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (Array.isArray(mat)) throw new Error('bedroom TV: expected one material per glTF primitive');
      materials.add(mat); this.owned.add(mat);
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture) {
        this.owned.add(v); v.anisotropy = 8;
      }
      // Quantized attributes cannot receive world coordinates in their integer arrays. Unpack first.
      const g = new THREE.BufferGeometry();
      for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2], ['color', 3]] as const) {
        const source = mesh.geometry.getAttribute(name);
        const data = new Float32Array(mesh.geometry.getAttribute('position').count * size);
        // COLOR_0 is the occlusion baked in Blender (bedroom_tv_finish.py); pieces without it stay unshaded.
        if (!source && name === 'color') data.fill(1);
        if (source) for (let i = 0; i < source.count; i++) {
          data[i * size] = source.getX(i); data[i * size + 1] = source.getY(i);
          if (size === 3) data[i * size + 2] = source.getZ(i);
        }
        g.setAttribute(name, new THREE.BufferAttribute(data, size));
      }
      g.setIndex(mesh.geometry.index?.clone() ?? null);
      g.applyMatrix4(mesh.matrixWorld);
      const list = buckets.get(mat) ?? []; list.push(g); buckets.set(mat, list);
    });
    for (const mat of materials) {
      mat.envMapIntensity = /chrome/.test(mat.name) ? 1.1 : .8;
      if (/^(bedroom-(silver|chrome)|stand-steel)$/.test(mat.name)) brushed(mat, grain);
      // The stand's black laminate: a fine textured grain in colour and sheen, as on the reference furniture.
      if (mat.name === 'stand-laminate') flaked(mat, flake, 150, .08, .45);
      if (/^bedroom-source-(crt|ds|stand)$/.test(mat.name)) brushed(mat, grain);
      // The TV's silver is sprayed paint, not brushed metal: a fine flake in colour and gloss.
      if (/^crt-(silver|key|grille)$/.test(mat.name)) flaked(mat, flake);
      // Moulded plastics everywhere else get a fine, quiet grain so they stop reading as flat CG colour.
      else if (/^(bedroom-(v4|clean|gc)-|bedroom-(black|white|graphite|red|green|yellow|rubber|letter-blue)$|remote-|cart-|case-black|plug-|stand-(collar|foot)$)/.test(mat.name)
        && !/^bedroom-(silver|chrome)$/.test(mat.name)) flaked(mat, flake, 90, .05, .3);
      mat.vertexColors = true;
      if (mat.name === 'covers' || mat.name.startsWith('cover-')) { mat.roughness = .65; mat.envMapIntensity = .15; }
      if (/^(gb-image|ds-top-image|ds-touch-image)$/.test(mat.name)) {
        // These are native game pixels; interpolation blurs their small text and sprites.
        for (const texture of [mat.map, mat.emissiveMap]) if (texture) {
          texture.magFilter = THREE.NearestFilter;
          texture.needsUpdate = true;
        }
      }
      if (mat.name === 'gb-image') { mat.color.setHex(0xa9ba68); mat.emissive.setHex(0xa9ba68); mat.emissiveIntensity = .025; }
      if (mat.name === 'crt-image') {
        mat.color.setRGB(.008, .008, .012);
        mat.map = null;
        mat.emissive.setHex(0xffffff); mat.emissiveIntensity = .88;
        mat.metalness = 0; mat.roughness = .19; mat.envMapIntensity = .55;
        mat.onBeforeCompile = shader => {
          shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
            vec2 tubeUV = vEmissiveMapUv - .5;
            float tubeShade = 1.0 - .28 * dot(tubeUV, tubeUV);
            float scanline = .96 + .04 * sin(vEmissiveMapUv.y * 480.0 * 3.14159265);
            totalEmissiveRadiance *= tubeShade * scanline;`);
        };
        mat.customProgramCacheKey = () => 'bedroom-crt-v1';
      }
    }
    for (const [mat, list] of buckets) {
      const merged = mergeGeometries(list, false);
      list.forEach(g => g.dispose());
      if (!merged) throw new Error('bedroom TV: static batch failed');
      this.owned.add(merged);
      const mesh = new THREE.Mesh(merged, mat); mesh.name = `tv-${mat.name}`;
      this.group.add(mesh);
    }
    this.group.userData.assemblies = pieces;
    this.group.updateMatrixWorld(true);
    this.box = new THREE.Box3().setFromObject(this.group, true);
    this.box.getCenter(this.centre);
    this.dom.className = 'hall-bedroom-layer';
    this.twin.className = 'hall-bedroom'; this.twin.type = 'button'; this.twin.hidden = true;
    this.twin.innerHTML = '<span class="hall-bedroom__hint"><span data-lang="de">Die Spielecke ansehen</span><span data-lang="en">Look at the gaming corner</span></span>';
    this.twin.addEventListener('click', () => { this.returnFocus = true; this.focusClose = true; callbacks.open(); });
    this.close.className = 'hall-bedroom-close'; this.close.type = 'button'; this.close.hidden = true;
    this.close.innerHTML = '<span aria-hidden="true">←</span><span data-lang="de">Zur Halle</span><span data-lang="en">Back to the hall</span>';
    this.close.addEventListener('click', () => callbacks.close());
    this.dom.append(this.twin, this.close);
  }

  setOpen(open: boolean, restoreFocus = false) {
    if (this.open === open) return;
    this.open = open;
    if (!open && this.returnFocus && restoreFocus) {
      // Wait for the twin to return to the picture before restoring keyboard focus.
      this.returnFocus = false; this.focusClose = false;
      this.twin.hidden = false; this.twin.focus({ preventScroll: true });
    }
    if (!open) { this.returnFocus = false; this.focusClose = false; }
  }

  view() {
    const centre = this.group.localToWorld(this.centre.clone().divideScalar(BEDROOM_PLACE.scale));
    const dir = new THREE.Vector3(.24, .18, 1).normalize().transformDirection(this.group.matrixWorld);
    return { centre, dir, width: 1.28 * BEDROOM_PLACE.scale, height: 1.29 * BEDROOM_PLACE.scale };
  }

  /** The corner as one target: its world bounds, not its ~600k triangles. A per-triangle raycast on every pointer
   * move cost a slow CPU half its frame rate (measured 2026-10-08: 20 fps instead of 40 at 4× CPU throttling). */
  private worldBox = new THREE.Box3();
  private boxHit = new THREE.Vector3();
  hit(ray: THREE.Raycaster) {
    this.worldBox.setFromObject(this.group);
    return ray.ray.intersectBox(this.worldBox, this.boxHit) ? ray.ray.origin.distanceTo(this.boxHit) : null;
  }

  place(camera: THREE.Camera, w: number, h: number, mode: 'hall' | 'open' | 'none') {
    const lang = document.documentElement.dataset.lang === 'en' ? 'en' : 'de';
    if (lang !== this.language) {
      this.language = lang;
      this.twin.setAttribute('aria-label', lang === 'en' ? 'Inspect the Nintendo gaming corner' : 'Nintendo-Spielecke ansehen');
      this.close.setAttribute('aria-label', lang === 'en' ? 'Back to the hall' : 'Zur Halle');
    }
    this.close.hidden = mode !== 'open';
    if (mode === 'open' && this.focusClose) { this.focusClose = false; this.close.focus({ preventScroll: true }); }
    if (mode !== 'hall') { this.twin.hidden = true; return; }
    // A forgiving button over the television, clear of nearby cabinet/console hits.
    const b = { x0: -.41, x1: .15, y0: .74, y1: 1.20, z: .218 };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    let behind = false;
    for (const x of [b.x0, b.x1]) for (const y of [b.y0, b.y1]) {
      const v = this.group.localToWorld(new THREE.Vector3(x, y, b.z)).project(camera);
      behind ||= v.z < -1 || v.z > 1;
      const px = (v.x + 1) * w / 2, py = (1 - v.y) * h / 2;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    this.twin.hidden = behind || x1 < 0 || x0 > w || y1 < 0 || y0 > h;
    if (this.twin.hidden) return;
    const place = [x0, y0, x1 - x0, y1 - y0].map(v => v.toFixed(1));
    const key = place.join(',');
    if (key !== this.placed) { this.placed = key; Object.assign(this.twin.style, { left: place[0] + 'px', top: place[1] + 'px', width: place[2] + 'px', height: place[3] + 'px' }); }
  }

  dispose() { this.dom.remove(); this.owned.forEach(x => x.dispose()); this.owned.clear(); }
}
