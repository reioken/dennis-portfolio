import * as THREE from 'three';

/**
 * The visitor's tag, accumulated on the GPU.
 *
 * The ball is a spray nozzle; the line it leaves has to stay on the wall for the whole round and beyond. Redrawing
 * a canvas and uploading it every frame is exactly what the hall cannot afford, so the paint is laid down where it
 * lives: a small render target covering the painted rect, into which every frame stamps only the few centimetres
 * of line that are new. The wall's brick shader (wallPaint.ts) samples it as one more pigment source, so the line
 * goes through the same mortar / normal-map / wear path as the lettering.
 *
 * Channels:
 *   R  (max) fresh paint — what was just sprayed; a slow multiply pass lets it settle
 *   G  (max) paint that stays at full strength: the signature, the crown
 *   B  (max) overspray haze around the line
 *   A  (add) the coat every pass leaves behind. It ADDS UP: where the ball has been often the wall gets denser,
 *            so by the end of a round the tag is also a picture of how the round was played. Flight pieces are
 *            butt-ended in this channel, so consecutive frames tile without beading.
 *
 * One batched draw per frame, preallocated buffers, no readbacks, nothing at all while nothing moves.
 */

const MAX_QUADS = 128;

const VERT = /* glsl */`
  attribute vec4 aSeg;
  attribute vec4 aPar;
  attribute vec4 aMix;
  varying vec2 vW;
  varying vec4 vSeg;
  varying vec4 vPar;
  varying vec4 vMix;
  varying float vSpeck;
  void main() {
    vSpeck = position.z;
    vW = position.xy; vSeg = aSeg; vPar = aPar; vMix = aMix;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xy, 0.0, 1.0);
  }`;

const FRAG = /* glsl */`
  precision highp float;
  varying vec2 vW;
  varying vec4 vSeg;   // p0.xy, p1.xy (metres)
  varying vec4 vPar;   // r0, r1, pressure, seed
  varying vec4 vMix;   // gain R (fresh), G (stays), B (haze), A (coat that adds up)
  varying float vSpeck;
  uniform vec3 uGrid;  // rect x, rect y, pixels per metre
  float hash(vec2 p) {
    vec3 q = fract(vec3(p.x, p.y, p.x) * 0.1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  void main() {
    vec2 pa = vW - vSeg.xy, ba = vSeg.zw - vSeg.xy;
    float bb = dot(ba, ba);
    float hh = bb > 1e-10 ? dot(pa, ba) / bb : 0.0;
    float t = clamp(hh, 0.0, 1.0);
    float d = length(pa - ba * t);
    float r = mix(vPar.x, vPar.y, t);
    vec2 px = (vW - uGrid.xy) * uGrid.z;
    float seed = vPar.w;
    // a ragged, soft edge: the cone of a can is never a clean disc
    float rag = (noise(px * 0.23 + seed * 7.0) - 0.5) * r * 0.62;
    float grain = 0.84 + 0.16 * noise(px * 0.06 + seed * 3.0);
    float core = (1.0 - smoothstep(r * 0.58, r * 1.10, d + rag)) * grain;
    // the adding coat: butt-ended along the flight so the next frame's piece continues it without overlap
    float tile = bb > 1e-10 ? step(0.0, hh) * step(hh, 0.9999995) : 1.0;
    float coat = bb > 1e-10 ? (1.0 - smoothstep(r * 0.58, r * 1.10, length(pa - ba * hh) + rag)) * grain * tile : core;
    // overspray: single droplets, dense at the edge of the line and gone by three radii
    float fall = exp(-pow(d / (r * 1.9), 2.0));
    float h = hash(floor(px) + floor(seed * 13.0));
    float h2 = hash(floor(px * 0.5) + floor(seed * 29.0) + 7.0);
    float speck = step(1.0 - vSpeck * fall * 0.62, h) * (0.45 + 0.55 * h2);
    speck = max(speck, step(1.0 - vSpeck * fall * 0.16, h2) * 0.8);
    float v = max(core, speck) * vPar.z;
    float haze = exp(-pow(d / (r * 2.0), 2.0)) * vPar.z;
    gl_FragColor = vec4(v * vMix.x, v * vMix.y, haze * vMix.z, coat * vPar.z * vMix.w);
  }`;

const WASH_FRAG = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform vec4 uFade;   // per-channel factor outside the roller band
  uniform vec4 uBand;   // x0, x1 of the roller in uv this frame (x1 <= x0 switches it off), ghost level, seed
  float hash(vec2 p) {
    vec3 q = fract(vec3(p.x, p.y, p.x) * 0.1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  void main() {
    vec4 k = uFade;
    if (uBand.y > uBand.x) {
      // the roller's edge is ragged per row, identical every frame, so each texel is wiped exactly once
      float j = (noise(vec2(uBand.w, vUv.y * 46.0)) - 0.5) * 0.085 + (noise(vec2(uBand.w + 9.0, vUv.y * 9.0)) - 0.5) * 0.11;
      float x = vUv.x - j;
      if (x >= uBand.x && x < uBand.y) {
        // what a buffed wall keeps: a ghost, stronger in the streaks the roller skipped
        float streak = smoothstep(0.58, 0.92, noise(vec2(vUv.x * 5.0 + uBand.w, vUv.y * 120.0)));
        float g = uBand.z * (0.35 + 1.9 * streak);
        k = vec4(g, g, g * 0.5, g);
      }
    }
    gl_FragColor = k;
  }`;

const WASH_VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export interface TagRect { x: number; y: number; w: number; h: number }

export class WallTag {
  readonly target: THREE.WebGLRenderTarget;
  readonly pxPerM: number;
  private scene = new THREE.Scene();
  private washScene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private geometry = new THREE.BufferGeometry();
  private pos = new Float32Array(MAX_QUADS * 4 * 3);
  private seg = new Float32Array(MAX_QUADS * 4 * 4);
  private par = new Float32Array(MAX_QUADS * 4 * 4);
  private mix = new Float32Array(MAX_QUADS * 4 * 4);
  private attrs: THREE.BufferAttribute[] = [];
  private material: THREE.ShaderMaterial;
  private wash: THREE.ShaderMaterial;
  private eraser: THREE.ShaderMaterial;
  private mesh: THREE.Mesh;
  private count = 0;
  private washPending = false;
  private clearPending = true;
  private clearColor = new THREE.Color();
  /** Something is on the wall (cheap bookkeeping; the pixels are never read back in production). */
  dirtyPaint = false;

  constructor(private rect: TagRect, width = 1024) {
    this.pxPerM = width / rect.w;
    const height = Math.round(width * rect.h / rect.w);
    this.target = new THREE.WebGLRenderTarget(width, height, {
      format: THREE.RGBAFormat, type: THREE.UnsignedByteType, depthBuffer: false, stencilBuffer: false,
      magFilter: THREE.LinearFilter, minFilter: THREE.LinearMipmapLinearFilter, generateMipmaps: true,
    });
    this.target.texture.name = 'wall-game-tag';
    this.target.texture.anisotropy = 4;
    this.camera = new THREE.OrthographicCamera(rect.x, rect.x + rect.w, rect.y + rect.h, rect.y, -1, 1);
    const index = new Uint16Array(MAX_QUADS * 6);
    for (let q = 0; q < MAX_QUADS; q++) index.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4 + 2, q * 4 + 1, q * 4 + 3], q * 6);
    this.geometry.setIndex(new THREE.BufferAttribute(index, 1));
    const add = (name: string, array: Float32Array, size: number) => {
      const a = new THREE.BufferAttribute(array, size);
      a.setUsage(THREE.DynamicDrawUsage);
      this.geometry.setAttribute(name, a);
      this.attrs.push(a);
    };
    add('position', this.pos, 3); add('aSeg', this.seg, 4); add('aPar', this.par, 4); add('aMix', this.mix, 4);
    this.geometry.setDrawRange(0, 0);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: { uGrid: { value: new THREE.Vector3(rect.x, rect.y, this.pxPerM) } },
      depthTest: false, depthWrite: false, transparent: true, toneMapped: false,
      blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor,
    });
    // Same program, other blending: what the brush would have painted is taken OFF instead (dst * (1 - src)).
    // The crown clears itself a dark outline out of the tag before it is sprayed, the way a piece gets one.
    this.eraser = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms: this.material.uniforms,
      depthTest: false, depthWrite: false, transparent: true, toneMapped: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.OneMinusSrcColorFactor,
      blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
    this.wash = new THREE.ShaderMaterial({
      vertexShader: WASH_VERT, fragmentShader: WASH_FRAG,
      uniforms: { uFade: { value: new THREE.Vector4(1, 1, 1, 1) }, uBand: { value: new THREE.Vector4(0, 0, 0.1, 1) } },
      depthTest: false, depthWrite: false, transparent: true, toneMapped: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor,
      blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.SrcAlphaFactor,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.wash);
    quad.frustumCulled = false;
    this.washScene.add(quad);
  }

  get texture() { return this.target.texture; }
  get pending() { return this.count > 0 || this.washPending || this.clearPending; }

  /** Wipe everything (a new visitor layout, or a lost GL context handed us an empty target). */
  clear() { this.clearPending = true; this.count = 0; this.dirtyPaint = false; }

  /**
   * One pass of the nozzle from (x0, y0) to (x1, y1), metres. `fresh`/`stays`/`haze`/`coat` are the channel
   * gains, `speck` the overspray density. A zero-length capsule is a dot.
   */
  capsule(renderer: THREE.WebGLRenderer, x0: number, y0: number, x1: number, y1: number, r0: number, r1: number, pressure: number, seed: number, fresh = 1, stays = 0, haze = 1, coat = 0, speck = 1) {
    if (this.count >= MAX_QUADS) this.flush(renderer);
    const reach = Math.max(r0, r1) * 3.4 + 0.004;
    let dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len > 1e-7) { dx /= len; dy /= len; } else { dx = 1; dy = 0; }
    const nx = -dy * reach, ny = dx * reach, ex = dx * reach, ey = dy * reach;
    const q = this.count++;
    const p = q * 12;
    this.pos[p] = x0 - ex + nx; this.pos[p + 1] = y0 - ey + ny; this.pos[p + 2] = speck;
    this.pos[p + 3] = x0 - ex - nx; this.pos[p + 4] = y0 - ey - ny; this.pos[p + 5] = speck;
    this.pos[p + 6] = x1 + ex + nx; this.pos[p + 7] = y1 + ey + ny; this.pos[p + 8] = speck;
    this.pos[p + 9] = x1 + ex - nx; this.pos[p + 10] = y1 + ey - ny; this.pos[p + 11] = speck;
    for (let v = 0; v < 4; v++) {
      const o = (q * 4 + v) * 4;
      this.seg[o] = x0; this.seg[o + 1] = y0; this.seg[o + 2] = x1; this.seg[o + 3] = y1;
      this.par[o] = r0; this.par[o + 1] = r1; this.par[o + 2] = pressure; this.par[o + 3] = seed;
      this.mix[o] = fresh; this.mix[o + 1] = stays; this.mix[o + 2] = haze; this.mix[o + 3] = coat;
    }
    this.dirtyPaint = true;
  }

  /** Everything queued so far is drawn; what is queued until `erase(false)` takes paint off instead. */
  erase(renderer: THREE.WebGLRenderer, on: boolean) {
    this.flush(renderer);
    this.mesh.material = on ? this.eraser : this.material;
  }

  /** Fresh paint settles: R is multiplied down a little; the coat in A is what remains. */
  settle(factor: number) {
    this.wash.uniforms.uFade.value.set(factor, 1, 1, 1);
    this.wash.uniforms.uBand.value.x = 0; this.wash.uniforms.uBand.value.y = 0;
    this.washPending = true;
  }

  /** The buff roller crossed uv x0..x1 since the last frame. */
  buff(x0: number, x1: number, ghost: number, seed: number) {
    this.wash.uniforms.uFade.value.set(1, 1, 1, 1);
    this.wash.uniforms.uBand.value.set(x0, x1, ghost, seed);
    this.washPending = true;
  }

  /** Draws what was queued. Leaves the renderer exactly as it found it. */
  flush(renderer: THREE.WebGLRenderer) {
    if (!this.pending) return;
    const prevTarget = renderer.getRenderTarget();
    const prevAuto = renderer.autoClear;
    const prevXr = renderer.xr.enabled;
    renderer.xr.enabled = false;
    renderer.autoClear = false;
    renderer.setRenderTarget(this.target);
    if (this.clearPending) {
      renderer.getClearColor(this.clearColor);
      const alpha = renderer.getClearAlpha();
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, false, false);
      renderer.setClearColor(this.clearColor, alpha);
      this.clearPending = false;
    }
    if (this.washPending) {
      renderer.render(this.washScene, this.camera);
      this.washPending = false;
    }
    if (this.count > 0) {
      for (const a of this.attrs) {
        a.clearUpdateRanges();
        a.addUpdateRange(0, this.count * 4 * a.itemSize);
        a.needsUpdate = true;
      }
      this.geometry.setDrawRange(0, this.count * 6);
      renderer.render(this.scene, this.camera);
      this.count = 0;
    }
    renderer.setRenderTarget(prevTarget);
    renderer.autoClear = prevAuto;
    renderer.xr.enabled = prevXr;
  }

  /** Builds both programs now, while the hall is still starting, so play never compiles anything. */
  warm(renderer: THREE.WebGLRenderer) {
    this.capsule(renderer, this.rect.x - 9, this.rect.y - 9, this.rect.x - 9, this.rect.y - 9, 0.001, 0.001, 0, 0, 0, 0, 0, 0, 0);
    this.wash.uniforms.uFade.value.set(1, 1, 1, 1);
    this.wash.uniforms.uBand.value.set(0, 0, 0, 0);
    this.washPending = true;
    this.flush(renderer);
    // the eraser shares the brush's program; one empty draw makes sure of it before play
    this.capsule(renderer, this.rect.x - 9, this.rect.y - 9, this.rect.x - 9, this.rect.y - 9, 0.001, 0.001, 0, 0, 0, 0, 0, 0, 0);
    this.erase(renderer, true);
    this.capsule(renderer, this.rect.x - 9, this.rect.y - 9, this.rect.x - 9, this.rect.y - 9, 0.001, 0.001, 0, 0, 0, 0, 0, 0, 0);
    this.erase(renderer, false);
    this.dirtyPaint = false;
  }

  /** Dev/QA only: how much paint is on the target (sum of the coat channel, 0..1 per texel). */
  debugCoverage(renderer: THREE.WebGLRenderer) {
    const w = this.target.width, h = this.target.height;
    const buf = new Uint8Array(w * h * 4);
    renderer.readRenderTargetPixels(this.target, 0, 0, w, h, buf);
    let fresh = 0, coat = 0, haze = 0;
    for (let i = 0; i < buf.length; i += 4) { fresh += buf[i]; coat += Math.max(buf[i + 1], buf[i + 3]); haze += buf[i + 2]; }
    const n = w * h * 255;
    return { fresh: fresh / n, coat: coat / n, haze: haze / n };
  }

  dispose() {
    this.target.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.eraser.dispose();
    this.wash.dispose();
    (this.washScene.children[0] as THREE.Mesh).geometry.dispose();
  }
}
