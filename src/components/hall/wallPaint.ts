import * as THREE from 'three';

/** Lettering is pigment in the brick material, sharing its mortar, normals and lighting. */
export class WallPaint {
  private canvas = document.createElement('canvas');
  private texture = new THREE.CanvasTexture(this.canvas);
  private label = '';
  private aspect = 1;
  private uniforms = {
    wallPaintMask: { value: this.texture },
    wallPaintRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    wallPaintOpacity: { value: 0 },
    wallPaintColor: { value: new THREE.Color('#92999f') },
  };

  attach(material: THREE.MeshStandardMaterial) {
    this.texture.anisotropy = 8;
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = 'varying vec2 vWallPaintPosition;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvWallPaintPosition = (modelMatrix * vec4(transformed, 1.0)).xy;');
      shader.fragmentShader = `varying vec2 vWallPaintPosition;
        uniform sampler2D wallPaintMask;
        uniform vec4 wallPaintRect;
        uniform float wallPaintOpacity;
        uniform vec3 wallPaintColor;\n` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        #include <map_fragment>
        vec2 paintUv = (vWallPaintPosition - wallPaintRect.xy) / wallPaintRect.zw;
        float insidePaint = step(0.0, paintUv.x) * step(0.0, paintUv.y) * step(paintUv.x, 1.0) * step(paintUv.y, 1.0);
        float pigment = texture2D(wallPaintMask, clamp(paintUv, 0.0, 1.0)).a * insidePaint * wallPaintOpacity;
        #ifdef USE_MAP
          float brickGrain = dot(sampledDiffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          // Uneven coverage in the mortar; the existing brick normal map also lights the paint.
          pigment *= mix(0.36, 0.94, smoothstep(0.025, 0.20, brickGrain));
          diffuseColor.rgb = mix(diffuseColor.rgb, wallPaintColor * (0.48 + brickGrain * 0.72), pigment);
        #endif
      `);
    };
    material.customProgramCacheKey = () => 'brick-painted-title-v1';
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

  dispose() { this.texture.dispose(); }
}
