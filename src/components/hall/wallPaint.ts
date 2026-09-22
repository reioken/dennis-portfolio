import * as THREE from 'three';

export const WALL_GAME_FLECKS = 6;
/** Block grid at its widest, shared with wallGame.ts; narrow windows play fewer columns (wallGameGrid.w). */
export const WALL_GAME_COLS = 11;
export const WALL_GAME_ROWS = 6;
/** Atlas sprites the game places on the wall: score and best digits, crown, lives, play mark, the can. */
export const WALL_GAME_GLYPHS = 14;

/**
 * The painted wall game (wallGame.ts) shares this pigment path with the lettering: same brick luminance
 * modulation, same normal map lighting it. Nothing of it is a decal or a plane in front of the wall.
 */
export interface WallGameUniforms {
  /** Alpha mask for everything sprayed once: the frame marks. */
  wallGameMask: { value: THREE.Texture };
  /** COLS x ROWS state texture, red = how much paint the block still carries (1 = solid, 0 = bare brick). */
  wallGameBlocks: { value: THREE.Texture };
  /** The visitor's tag, accumulated on the GPU (wallTag.ts): r = fresh, g = stays, b = haze, a = the adding coat. */
  wallGameTag: { value: THREE.Texture };
  /** Sprayed sprites: digits, crown, lives, play mark, the can. */
  wallGameAtlas: { value: THREE.Texture };
  /** World rect of the mask and the tag: x, y = lower left corner, z, w = size. */
  wallGameRect: { value: THREE.Vector4 };
  /** Block grid: x = left edge, y = bottom edge, z = running-bond parity of the lowest row, w = columns. */
  wallGameGrid: { value: THREE.Vector4 };
  /** The nozzle: x, y = centre, z = radius (0 hides it). */
  wallGameBall: { value: THREE.Vector3 };
  /** Paint flecks falling off a chipped block: x, y, radius. */
  wallGameFlecks: { value: THREE.Vector3[] };
  /** A puff of overspray at the can's nozzle: x, y, radius, density. */
  wallGamePuff: { value: THREE.Vector4 };
  /** Sprite placement: world rect (z = 0 hides it), atlas uv rect, and how much of it has been sprayed yet. */
  wallGameGlyphRect: { value: THREE.Vector4[] };
  wallGameGlyphUv: { value: THREE.Vector4[] };
  wallGameGlyphInk: { value: number[] };
  /** The colour in the visitor's can. */
  wallGameTagColor: { value: THREE.Color };
  /** The batten's wash on the wall: x = centre, y = lamp height, z = the tube's half length, w = throw. */
  wallGameLight: { value: THREE.Vector4 };
  /** Pool colour, already multiplied by its intensity. */
  wallGameLightColor: { value: THREE.Color };
  wallGameOpacity: { value: number };
}

function blankTexture() {
  const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
  t.needsUpdate = true;
  return t;
}

/** Lettering is pigment in the brick material, sharing its mortar, normals and lighting. */
export class WallPaint {
  private canvas = document.createElement('canvas');
  private texture = new THREE.CanvasTexture(this.canvas);
  private label = '';
  private aspect = 1;
  private blank = blankTexture();
  private uniforms = {
    wallPaintMask: { value: this.texture },
    wallPaintRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    wallPaintOpacity: { value: 0 },
    wallPaintColor: { value: new THREE.Color('#92999f') },
  };
  /** Handed to WallGame; always bound so the wall keeps exactly one shader program. */
  readonly game: WallGameUniforms = {
    wallGameMask: { value: this.blank },
    wallGameBlocks: { value: this.blank },
    wallGameTag: { value: this.blank },
    wallGameAtlas: { value: this.blank },
    wallGameRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    wallGameGrid: { value: new THREE.Vector4(0, 0, 0, WALL_GAME_COLS) },
    wallGameBall: { value: new THREE.Vector3(0, 0, 0) },
    wallGameFlecks: { value: Array.from({ length: WALL_GAME_FLECKS }, () => new THREE.Vector3(0, 0, 0)) },
    wallGamePuff: { value: new THREE.Vector4(0, 0, 0, 0) },
    wallGameGlyphRect: { value: Array.from({ length: WALL_GAME_GLYPHS }, () => new THREE.Vector4(0, 0, 0, 0)) },
    wallGameGlyphUv: { value: Array.from({ length: WALL_GAME_GLYPHS }, () => new THREE.Vector4(0, 0, 1, 1)) },
    wallGameGlyphInk: { value: Array.from({ length: WALL_GAME_GLYPHS }, () => 1) },
    wallGameTagColor: { value: new THREE.Color('#92999f') },
    wallGameLight: { value: new THREE.Vector4(0, 0, 1, 1) },
    wallGameLightColor: { value: new THREE.Color(0, 0, 0) },
    wallGameOpacity: { value: 0 },
  };

  attach(material: THREE.MeshStandardMaterial) {
    this.texture.anisotropy = 8;
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, this.uniforms, this.game);
      shader.vertexShader = 'varying vec2 vWallPaintPosition;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvWallPaintPosition = (modelMatrix * vec4(transformed, 1.0)).xy;');
      shader.fragmentShader = `varying vec2 vWallPaintPosition;
        uniform sampler2D wallPaintMask;
        uniform vec4 wallPaintRect;
        uniform float wallPaintOpacity;
        uniform vec3 wallPaintColor;
        uniform sampler2D wallGameMask;
        uniform sampler2D wallGameBlocks;
        uniform sampler2D wallGameTag;
        uniform sampler2D wallGameAtlas;
        uniform vec4 wallGameRect;
        uniform vec4 wallGameGrid;
        uniform vec3 wallGameBall;
        uniform vec3 wallGameFlecks[${WALL_GAME_FLECKS}];
        uniform vec4 wallGamePuff;
        uniform vec4 wallGameGlyphRect[${WALL_GAME_GLYPHS}];
        uniform vec4 wallGameGlyphUv[${WALL_GAME_GLYPHS}];
        uniform float wallGameGlyphInk[${WALL_GAME_GLYPHS}];
        uniform vec3 wallGameTagColor;
        uniform vec4 wallGameLight;
        uniform vec3 wallGameLightColor;
        uniform float wallGameOpacity;
        float wallPaintHash(vec2 p) {
          vec3 q = fract(vec3(p.x, p.y, p.x) * 0.1031);
          q += dot(q, q.yzx + 33.33);
          return fract((q.x + q.y) * q.z);
        }
        // One stable wear noise for the whole wall: a pure function of world position, so nothing crawls.
        float wallPaintNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(wallPaintHash(i), wallPaintHash(i + vec2(1.0, 0.0)), f.x),
                     mix(wallPaintHash(i + vec2(0.0, 1.0)), wallPaintHash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        float wallPaintBox(vec2 p, vec2 c, vec2 h, float soft) {
          vec2 d = abs(p - c) - h;
          float o = min(max(d.x, d.y), 0.0) + length(max(d, vec2(0.0)));
          return 1.0 - smoothstep(-soft, soft, o);
        }
        float wallPaintDot(vec2 p, vec2 c, float r, float soft) {
          return 1.0 - smoothstep(r - soft, r + soft * 0.4, length(p - c));
        }
        /**
         * The game's blocks are the wall's own bricks: 250 mm x 83.3 mm courses in running bond
         * (scripts/assets/hall-wall-texture.py), painted inside the face so the mortar joint stays bare.
         * Returns x = the white coat (blocks, frame marks, digits, the can), y = what came out of the visitor's can.
         */
        vec2 wallGamePigment(vec2 w) {
          vec2 uv = (w - wallGameRect.xy) / wallGameRect.zw;
          float inside = step(0.0, uv.x) * step(0.0, uv.y) * step(uv.x, 1.0) * step(uv.y, 1.0);
          uv = clamp(uv, 0.0, 1.0);
          // sampled in uniform control flow, so the mip level is defined on every pixel
          float fine = texture2D(wallGameMask, uv).a;
          vec4 tg = texture2D(wallGameTag, uv);
          vec2 dwx = dFdx(w), dwy = dFdy(w);
          if (inside < 0.5) return vec2(0.0);
          float flake = wallPaintNoise(w * 96.0);
          // Two coats: the big brick-sized blocks wear like a painted wall, the small marks keep nearly all their
          // pigment — wear that eats a nine-pixel ball makes it disappear.
          float big = 0.0;
          float rowF = (w.y - wallGameGrid.y) / 0.08333333;
          if (rowF >= 0.0 && rowF < ${WALL_GAME_ROWS}.0) {
            float row = floor(rowF);
            float off = 0.125 * mod(row + wallGameGrid.z, 2.0);
            float colF = (w.x - wallGameGrid.x - off) / 0.25;
            if (colF >= 0.0 && colF < (off > 0.0 ? wallGameGrid.w - 1.0 : wallGameGrid.w)) {
              float col = floor(colF);
              float state = texture2D(wallGameBlocks, vec2((col + 0.5) / ${WALL_GAME_COLS}.0, (row + 0.5) / ${WALL_GAME_ROWS}.0)).r;
              vec2 c = vec2(wallGameGrid.x + off + (col + 0.5) * 0.25, wallGameGrid.y + (row + 0.5) * 0.08333333);
              // Thresholded against the wear noise, the paint flakes off the face instead of fading out; what
              // stays in the pores is the wall's memory of the block.
              float coat = smoothstep(-0.10, 0.10, state * 1.24 - 0.12 - flake);
              float stain = 0.15 * smoothstep(0.30, 0.78, wallPaintNoise(w * 58.0)) * (0.55 + 0.45 * wallPaintNoise(w * 9.0));
              big = wallPaintBox(w, c, vec2(0.11987, 0.03654), 0.0016) * max(coat, stain);
            }
          }
          for (int i = 0; i < ${WALL_GAME_GLYPHS}; i++) {
            vec4 gr = wallGameGlyphRect[i];
            vec2 q = (w - gr.xy) / max(gr.zw, vec2(1e-5));
            if (gr.z <= 0.0 || q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) continue;
            vec4 guv = wallGameGlyphUv[i];
            vec2 s = guv.zw / gr.zw;
            float a = textureGrad(wallGameAtlas, guv.xy + q * guv.zw, dwx * s, dwy * s).a;
            // a sprite is sprayed on in one pass from the left: a ragged front, then the mist fills in
            float ink = wallGameGlyphInk[i];
            a *= smoothstep(-0.08, 0.08, ink * 1.55 - 0.27 - q.x * 0.5 - flake * 0.5);
            fine = max(fine, a);
          }
          for (int i = 0; i < ${WALL_GAME_FLECKS}; i++) {
            if (wallGameFlecks[i].z > 0.0) fine = max(fine, wallPaintDot(w, wallGameFlecks[i].xy, wallGameFlecks[i].z, 0.0016));
          }
          if (wallGamePuff.w > 0.0) {
            float pd = length(w - wallGamePuff.xy) / wallGamePuff.z;
            fine = max(fine, wallGamePuff.w * exp(-pd * pd * 2.2) * (0.35 + 0.65 * wallPaintNoise(w * 210.0)));
          }
          // The visitor's line: a delicate scribble. Fresh paint, the signature that stays, the coat that adds up
          // (capped, so a busy corner never turns into a slab) and a breath of overspray around it all.
          float tag = max(max(max(tg.r * 0.88, tg.g), min(tg.a, 0.55)), tg.b * 0.12);
          // The nozzle itself is the one thing that must always read: a dense white dot with a tight halo, and a
          // thin dark ring around it that lifts it off the white bricks and off its own trail.
          float ballCore = 0.0, ballRing = 1.0;
          if (wallGameBall.z > 0.0) {
            float bd = length(w - wallGameBall.xy);
            ballCore = max(1.0 - smoothstep(wallGameBall.z - 0.006, wallGameBall.z + 0.002, bd),
              0.30 * exp(-pow(bd / (wallGameBall.z * 1.5), 2.0)));
            ballRing = 1.0 - 0.72 * smoothstep(wallGameBall.z * 0.95, wallGameBall.z * 1.2, bd) * (1.0 - smoothstep(wallGameBall.z * 1.4, wallGameBall.z * 2.0, bd));
          }
          big *= ballRing;
          fine = max(fine * ballRing, ballCore);
          tag *= ballRing;
          // Worn coverage: broad unevenness always, bare specks only where a screen pixel is smaller than a
          // speck. Procedural noise has no mip chain, so at hall distance it stays a mottle instead of crawling.
          float wear = wallPaintNoise(w * 158.0);
          float near = clamp(1.7 - fwidth(w.x) * 430.0, 0.0, 1.0);
          float specks = smoothstep(0.030, 0.120, wear);
          big *= mix(mix(0.87, 1.0, specks), specks, near);
          float broad = wallPaintNoise(w * 17.0);
          big *= 0.85 + 0.15 * broad;
          float fineSpecks = smoothstep(0.010, 0.070, wear);
          float fineWear = mix(mix(0.96, 1.0, fineSpecks), mix(0.66, 1.0, fineSpecks), near);
          fine *= fineWear * (0.93 + 0.07 * broad);
          tag *= fineWear * (0.90 + 0.10 * broad);
          // Nothing may ever end in a straight cut: whatever reaches the edge of the painted rect (overspray, a drip,
          // a blot from a wall bounce) thins out to nothing over its last centimetres.
          vec2 toEdge = min(w - wallGameRect.xy, wallGameRect.xy + wallGameRect.zw - w);
          float bleed = smoothstep(0.0, 0.08, min(toEdge.x, toEdge.y));
          return vec2(max(big, fine), tag) * (wallGameOpacity * bleed);
        }
` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        #include <map_fragment>
        vec2 paintUv = (vWallPaintPosition - wallPaintRect.xy) / wallPaintRect.zw;
        float insidePaint = step(0.0, paintUv.x) * step(0.0, paintUv.y) * step(paintUv.x, 1.0) * step(paintUv.y, 1.0);
        float pigment = texture2D(wallPaintMask, clamp(paintUv, 0.0, 1.0)).a * insidePaint * wallPaintOpacity;
        float tagPigment = 0.0;
        float wallGamePool = 0.0;
        if (wallGameOpacity > 0.0) {
          vec2 gamePigment = wallGamePigment(vWallPaintPosition);
          pigment = max(pigment, gamePigment.x);
          tagPigment = gamePigment.y;
          // The batten above the piece washes down the wall, so the brick around the game is lit too and it reads
          // as a lit spot rather than brighter paint. The shape is the lamp's, not the game's: a line source of
          // half length z, whose wash is flat under the tube, spreads and softens with every centimetre it falls
          // (box convolved with a widening kernel; tanh stands in for erf), and dies away smoothly down the wall.
          // No term here knows where the painted rect ends.
          vec2 fromLamp = vWallPaintPosition - wallGameLight.xy;
          float fall = max(-fromLamp.y, 0.0);
          float spread = 0.34 + 0.52 * fall;
          float across = 0.5 * (tanh(1.2 * (fromLamp.x + wallGameLight.z) / spread) - tanh(1.2 * (fromLamp.x - wallGameLight.z) / spread));
          float down = smoothstep(-0.16, 0.34, -fromLamp.y) * exp(-pow(fall / wallGameLight.w, 3.0));
          wallGamePool = across * down;
        }
        #ifdef USE_MAP
          float brickGrain = dot(sampledDiffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          // Uneven coverage in the mortar; the existing brick normal map also lights the paint.
          float mortar = mix(0.36, 0.94, smoothstep(0.025, 0.20, brickGrain));
          float body = 0.48 + brickGrain * 0.72;
          // the visitor's line first, the white coat over it: a re-sprayed block covers the tag beneath it
          diffuseColor.rgb = mix(diffuseColor.rgb, wallGameTagColor * body, tagPigment * mortar * (1.0 - 0.85 * pigment));
          diffuseColor.rgb = mix(diffuseColor.rgb, wallPaintColor * body, pigment * mortar);
        #endif
      `);
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_maps>',
        '#include <lights_fragment_maps>\n irradiance += wallGameLightColor * wallGamePool;');
    };
    material.customProgramCacheKey = () => 'brick-painted-title-v10';
  }

  update(label: string, x: number, compact: boolean, visible: boolean, refresh = false) {
    if (label !== this.label || refresh) {
      const ctx = this.canvas.getContext('2d')!;
      const font = '800 180px Outfit, sans-serif';
      ctx.font = font;
      const metrics = ctx.measureText(label);
      const ascent = metrics.actualBoundingBoxAscent || 140;
      const descent = metrics.actualBoundingBoxDescent || 2;
      this.canvas.width = Math.ceil(metrics.width + 24);
      this.canvas.height = Math.ceil(ascent + descent + 16);
      ctx.font = font;
      ctx.fillStyle = '#fff';
      ctx.fillText(label, 12, ascent + 8);
      // Stable fine wear, not a moving noise effect.
      let seed = 431;
      for (let i = 0; i < this.canvas.width * 0.8; i++) {
        seed = (1664525 * seed + 1013904223) >>> 0;
        const px = (seed >>> 8) % this.canvas.width;
        seed = (1664525 * seed + 1013904223) >>> 0;
        const py = (seed >>> 8) % this.canvas.height;
        ctx.clearRect(px, py, 1 + (seed % 2), 1);
      }
      // A project change can change the mask dimensions: allocate fresh GPU storage.
      this.texture.dispose();
      this.texture = new THREE.CanvasTexture(this.canvas);
      this.texture.anisotropy = 8;
      this.uniforms.wallPaintMask.value = this.texture;
      this.aspect = this.canvas.width / this.canvas.height;
      this.label = label;
    }
    const width = Math.min(compact ? 2.4 : 5.5, this.aspect * (compact ? .34 : .43));
    this.uniforms.wallPaintRect.value.set(x - width / 2, compact ? 2.30 : 2.10, width, width / this.aspect);
    this.uniforms.wallPaintOpacity.value = visible ? .91 : 0;
  }

  dispose() { this.texture.dispose(); this.blank.dispose(); }
}
