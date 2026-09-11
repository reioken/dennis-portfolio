# Screen glass research — 10 September 2026

Scope: research and recommendation only. No glass material or geometry changed in this pass.

## Findings in this project

- hallScene.ts assigns a PMREM of Three.js RoomEnvironment to the entire hall. Its bright studio panels do not represent the visible arcade architecture. On the curved lens, a concentrated reflection of one panel can dominate one side. This is a likely contributor; isolate it with an environment-only comparison before tuning curvature.
- hardwareWear.ts adds a clearcoat lobe over the base specular lobe, then uses custom blending and a fixed RGB multiplier. Reflected energy and the amount of screen obscured are controlled independently. This makes the result harder to calibrate than a single dielectric interface.
- Roughness is multiplied by the map. The base texture value is 32/255, so the nominal 0.65 roughness becomes about 0.082 on the clean area. The additional clearcoat stays at 0.085 and does not use the wear map. The surface is therefore much smoother than the main setting suggests.
- convexGlass.mjs uses the product of two parabolas, with zero displacement around the entire rectangular rim. This gives a pillow-like shape, rather than a spherical/aspheric CRT face. Every machine screen currently receives the same curvature, including modern terminals and portrait kiosks.
- The installed WebGLRenderer renders opaque objects into its transmission background before transparent objects. Existing fading screen meshes are transparent. Simply setting transmission=1 on a new outer pane can therefore miss the screen behind it or produce incorrect layer order.

## Recommended direction

1. Use a shallow spherical/aspheric face for actual CRT cabinets, with the edge seated behind the bezel. Keep modern terminal and kiosk covers almost flat. Give the face visible thickness at the rim rather than exaggerating its bulge.
2. Replace the generic studio reflection on screens with a dedicated, restrained hall environment: broad ceiling strips, dark architecture, and faint colored machine lights. Prefilter it once. Avoid a live cube-camera render for every cabinet.
3. Use one Fresnel-controlled reflection interface. Glass with IOR around 1.5 reflects about 4% at normal incidence and more at grazing angles. Keep image brightness independent of a fake translucent grey overlay. Prototype a combined emissive-screen/reflection material for display faces; evaluate physical transmission separately for the claw enclosure where actual objects must remain visible through glass.
4. Start testing clean-surface roughness around 0.12–0.2 as art-direction values, with small local changes for scratches and cleaning marks. Use minimal normal variation, sparse scratches, and dust near the gasket. Remove the second clearcoat highlight unless a real coating is deliberately modeled.
5. Compare straight-on, both sides, and moving camera views. Use both a bright UI and a dark game image. Reflections should travel smoothly over the surface without obscuring controls or text. Check the floor pass and frame time before accepting the change.

## Primary references

- [Three.js physical material](https://threejs.org/docs/pages/MeshPhysicalMaterial.html): optical transmission versus opacity, IOR, separate clearcoat layer, environment requirement, and rendering cost.
- [Three.js RoomEnvironment](https://threejs.org/docs/pages/RoomEnvironment.html): this is a generic room lighting environment, not a capture of the portfolio hall.
- [Three.js PMREMGenerator](https://threejs.org/docs/pages/PMREMGenerator.html): prefiltered environment reflections with roughness-dependent blur.

Current installed source was also inspected: WebGLRenderer.js, roughnessmap_fragment.glsl.js, and RoomEnvironment.js. Proposed parameter ranges are starting points for visual comparison, not measured properties of these fictional machines.
