# Loading cube — compositor correction, 2026-09-12

The user still observed pauses with the published animated WebP and preferred the earlier thin-panel design. Replaced image playback with the original style's six CSS panels, animated directly with transform-only compositor animations.

## Changes
- Restored the thin floating-panel appearance and diagonal full-turn rotation.
- A single 4.8-second linear rotation runs unchanged across loading phases. Panel expansion has its own transform animation and cannot pause the parent rotation.
- No animated-image request, decode or per-frame raster upload is needed for the loader.
- Removed the independent diagonal glint overlay. Panel surfaces are opaque so a distant face cannot shine through a nearer face; the small surface gradient remains inside its panel.
- Reduced-motion users get a static assembled cube. Existing size, orbit, progress accents and ignition fade remain.

## Evidence and limits
The prior test explicitly decoded the animated image before blocking the main thread. That proved predecoded playback could continue, but did not cover the user's full startup conditions. The precise browser/driver event behind the reported WebP pause was not conclusively isolated; this implementation removes that playback dependency.

Updated `scripts/qa/loading-prism.mjs` checks:
- Seven accelerated transform layers reported by Chromium.
- 288 distinct rotation transforms per revolution and identical transforms at two loop boundaries.
- 9.6-second main-thread block: 564 changed cube-only screencast samples; largest sampled unchanged interval 31.8ms.
- Actual room startup with delayed GLBs and 4x CPU throttling: 896 changed cube-only samples across 15.24 seconds, largest sampled unchanged interval 67.9ms. Captured assets -> GPU preparation -> ready phases.
- Orbit and progress accents hidden in the measurement so they cannot mask a frozen cube.
- No loader images or glint element; reduced-motion stops animation; loader hides after ignition; no page errors.
- TypeScript, 27 existing regression tests, production build and 54-page link/metadata audit pass.

Screencast sampling is not a guarantee of perfect frame delivery on all hardware. It now measures the real room preparation rather than only an isolated predecoded asset.

References: [MDN animation performance](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/CSS_JavaScript_animation_performance), [3D transform preservation and flattening](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/transform-style).
