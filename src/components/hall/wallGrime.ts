import * as THREE from 'three';

/**
 * Large-scale soot on the back wall, sampled in world coordinates so it never tiles with the brick.
 *
 * The brick tile repeats every two metres; anything bigger than that has to live here or the eye finds the grid.
 * Two things only: the wall goes darker towards the ceiling (smoke and dust settle on the upper courses) and a
 * dirtier band along the floor (shoes, mops, trolleys). Both wander slowly along the hall — three incommensurable
 * waves over fifteen to ninety metres — so nothing repeats across the 180 m wall.
 *
 * v2 (2026-09-20): a third of v1's amplitude and no mid-scale waves at all. v1's three-to-nine-metre "weather"
 * read as grey fog over the brick, which is exactly what the wall must not have. Nothing here may compete with
 * the relief of the joints, the wall title or the coloured light pool behind each station.
 *
 * Chain this AFTER WallPaint.attach (which replaces onBeforeCompile) and BEFORE HallLighting.decorate.
 */
export function attachWallGrime(material: THREE.MeshStandardMaterial) {
  const before = material.onBeforeCompile.bind(material);
  const previousKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    before(shader, renderer);
    shader.vertexShader = 'varying vec2 vWallGrime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvWallGrime = (modelMatrix * vec4(transformed, 1.0)).xy;');
    shader.fragmentShader = 'varying vec2 vWallGrime;\nfloat hallWallGrime(){\n'
      + ' float wander = sin(vWallGrime.x * 0.0731 + 1.7) * 0.5 + sin(vWallGrime.x * 0.1873 - 0.6) * 0.31'
      + ' + sin(vWallGrime.x * 0.4210 + 2.9) * 0.19;\n'
      + ' float blotch = clamp(0.5 + 0.5 * wander, 0.0, 1.0);\n'
      + ' float up = smoothstep(3.8, 12.0, vWallGrime.y);\n'
      + ' float skirt = 1.0 - smoothstep(0.04, 1.10, vWallGrime.y);\n'
      + ' return clamp(up * (0.55 + 0.45 * blotch) + skirt * (0.45 + 0.55 * blotch), 0.0, 1.0);\n}\n'
      + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',
      '#include <map_fragment>\n diffuseColor.rgb *= 1.0 - 0.055 * hallWallGrime();');
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>',
      '#include <roughnessmap_fragment>\n roughnessFactor = clamp(roughnessFactor + 0.035 * hallWallGrime(), 0.0, 1.0);');
  };
  material.customProgramCacheKey = () => previousKey() + '-wall-grime-v2';
}
