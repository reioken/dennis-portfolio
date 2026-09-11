# Atmospheric hall lighting — implementation and verification

Implemented 2026-09-11. Direction and sources: [lighting research](hall-lighting-atmosphere.md).

## Rendering changes

- Authored a dark environment with restrained cool, lavender and warm emitters. Generated the PMREM offline; versioned its URL to bypass immutable asset caches.
- Replaced moving broad spots with six fixed-budget rectangular lights. Stations retain their world positions while brightness fades between the focused machine and its neighbours.
- Added actual Cycles diffuse-response and ambient-occlusion bakes for the floor and wall. These reusable maps come from a generic cabinet proxy; they are not full-room GI or exact shadows for each machine.
- Combined stone material, local illumination and planar reflection in one floor surface. Capture and both roughness blur levels use HalfFloat HDR; the final output applies tone mapping.
- Added angle-dependent reflection strength, subtle normal distortion and projected-edge fading. The mobile Lite path uses the PBR floor and response maps without a planar capture.
- Reduced TV halo and bloom, preserved neutral form lighting, and retuned screen glass to avoid broad milky highlights under the new lights.
- Connected baked illumination to the existing startup power cue, including restoration after failed renders. Shared uniforms are scaled only once.
- Corrected the lower-quality pixel-ratio fallback so ultrawide rendering does not accidentally increase its pixel count.

## Verification

- TypeScript check, 27 regression tests and production build pass.
- Build audit passes for 54 marketing pages, local links and metadata.
- Chromium checks at 390 x 844 (forced Lite), 1440 x 900 and 3789 x 1896: no horizontal overflow or page/console errors; project entry and return work.
- Station sweep through About, Riftback, Nexus, Lowlight and other projects: shader program count remains 57 on desktop; all lighting transitions settle.
- Desktop reflection blur targets verified as HalfFloat. Lite creates no planar reflection targets.
- Final local Chromium frame-cadence sample: 143 frames, median 16.7 ms, p95 16.7 ms, maximum 16.8 ms. This is requestAnimationFrame cadence on this machine, not a GPU benchmark or a guarantee for physical phones.
- Visually checked hall, Nexus glass, About, mobile and ultrawide screenshots. QA captures and JSON evidence remain in ignored `.source-assets/hall-light-qa/`.

## Reproduction

- `scripts/build-hall-environment.mjs` generates the environment asset using Playwright.
- `scripts/models/blender/bake_hall_light.py` generates the four Cycles maps; `scripts/build-hall-light-maps.mjs` converts them to lossless WebP.
- `scripts/qa/hall-lighting.mjs` exercises project changes in the local browser.

No volumetric renderer, SSR, dynamic shadow-map system or new runtime dependency was introduced. Physical-device testing remains outstanding.
