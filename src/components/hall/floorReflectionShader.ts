/** A rough dielectric floor: subdued at normal incidence, stronger at grazing angles. */
export const floorReflectionShader = {
  uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null } },
  vertexShader: `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vFloorWorld;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vFloorWorld = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      #include <logdepthbuf_vertex>
    }`,
  fragmentShader: `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    varying vec4 vUv;
    varying vec3 vFloorWorld;
    #include <logdepthbuf_pars_fragment>
    void main() {
      #include <logdepthbuf_fragment>
      vec3 reflected = texture2DProj(tDiffuse, vUv).rgb;
      vec3 viewDirection = normalize(cameraPosition - vFloorWorld);
      float grazing = 1.0 - clamp(abs(viewDirection.y), 0.0, 1.0);
      float fresnel = 0.045 + 0.34 * pow(grazing, 4.0);
      float floorFade = 1.0 - smoothstep(0.6, 5.0, vFloorWorld.z);
      gl_FragColor = vec4(mix(color, reflected, fresnel * floorFade), 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};
