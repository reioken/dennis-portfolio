import * as THREE from 'three';

/** Two resident textures; transitions only change a uniform, never redraw/upload each frame. */
export class ScreenDissolve {
  private uniforms = { previousScreen: { value: null as THREE.Texture | null }, screenBlend: { value: 1 } };
  private started = 0;
  private duration = 0;
  constructor(readonly material: THREE.MeshBasicMaterial, throughDark = false) {
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.fragmentShader = 'uniform sampler2D previousScreen; uniform float screenBlend;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec4 screenA = texture2D(previousScreen, vMapUv);
          vec4 screenB = texture2D(map, vMapUv);
          ${throughDark ? `
          // Separate identities never occupy the screen at the same time.
          vec4 darkScreen = vec4(0.0, 0.0, 0.0, 1.0);
          diffuseColor *= screenBlend < 0.5
            ? mix(screenA, darkScreen, screenBlend * 2.0)
            : mix(darkScreen, screenB, screenBlend * 2.0 - 1.0);
          ` : 'diffuseColor *= mix(screenA, screenB, screenBlend);'}
        #endif
      `);
    };
    material.customProgramCacheKey = () => throughDark ? 'screen-dip-v2' : 'screen-dissolve-v1';
    material.needsUpdate = true;
  }
  set(texture: THREE.Texture, now: number, duration = 600) {
    if (this.material.map === texture && duration > 0) return;
    const wasMapped = Boolean(this.material.map);
    const previous = this.uniforms.screenBlend.value < .5 ? this.uniforms.previousScreen.value : this.material.map;
    this.uniforms.previousScreen.value = previous?.image && duration > 0 ? previous : texture;
    this.material.map = texture;
    this.duration = previous?.image ? duration : 0;
    this.started = now;
    this.uniforms.screenBlend.value = this.duration ? 0 : 1;
    if (!wasMapped) this.material.needsUpdate = true;
  }
  uses(texture: THREE.Texture) {
    return this.material.map === texture || this.uniforms.previousScreen.value === texture;
  }
  tick(now: number) {
    if (this.uniforms.screenBlend.value === 1) return false;
    const t = Math.min(1, Math.max(0, (now - this.started) / Math.max(1, this.duration)));
    this.uniforms.screenBlend.value = t * t * (3 - 2 * t);
    if (t === 1) this.uniforms.previousScreen.value = this.material.map;
    return true;
  }
}
