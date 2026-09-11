# Loading cube — compositor correction, 2026-09-12

The user still observed pauses with the published animated WebP and preferred the earlier thin-panel design. Replaced image playback with the original style's six CSS panels, animated directly with transform-only compositor animations.

## Changes
- Restored the thin floating-panel appearance and diagonal full-turn rotation.
- The first implementation used a 4.8-second parent rotation and independent panel expansion. Chromium accelerated both; subsequent Firefox testing below disproved cross-browser independence.
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

## Firefox correction — 2026-09-13

The user identified Firefox and confirmed that the inner cube stopped while the brackets kept moving. Native Firefox 155.0.1 diagnostics reproduced the underlying failure: the parent rotation reported `runningOnCompositor: false`, while a face's expansion and the outer bracket rotation reported `true`. A content-thread block left no compositor rotation for the parent, although the other motion continued. Ordinary WebDriver screenshots and computed CSS transforms had concealed this distinction.

The final implementation leaves the `preserve-3d` container static. Each face owns its entire rotation and expansion in one transform animation. The linear angular speed and 4.8-second period are unchanged. Sampled cosine depth preserves two gentle expansion cycles. Panels, inset highlights, colors, dimensions, brackets, accessibility text, and dismissal timing remain.

A second Firefox diagnostic caught four unaccelerated faces after combining their transforms. Firefox's perspective bounds calculation reported a frame area of 1,793,148,811 pixels for one 24px face, exceeding its acceleration budget. Using orthographic projection for this small emblem removes that inflated perspective calculation while retaining real 3D rotation and depth sorting. All six faces then accelerated.

`scripts/qa/loading-prism-firefox.mjs` uses an isolated native Firefox WebDriver profile. Its test-only privileged frame script reads `windowUtils.getOMTAStyle`, rather than forcing main-thread style updates. Nothing from this diagnostic ships in the website, and it does not alter the user's browser profile.

Verified in Firefox 155.0.1:
- All six complete face transforms run on the compositor.
- Two full turns during a 9.6-second continuous main-thread block: 240 samples per face, maximum sampled rotation hold 41ms.
- Actual page startup with the same induced block: all six faces kept rotating, maximum sampled hold 40ms. Room subsequently reached ready and dismissed the loader.
- Rotation is checked separately from translation, so expansion cannot conceal a frozen rotation.
- Reduced motion stops the animation.

Run with `GECKODRIVER` pointing to an installed geckodriver and optional `FIREFOX_BINARY`. `QA_BASE_URL` selects the local or deployed site. `QA_LOADER_CSS` supports checking a saved baseline; the prior implementation must fail the compositor assertions. The existing Chromium screencast test remains as a separate cross-browser check.

The measurements cover native headless Firefox on this machine, including real site startup, not every graphics driver or browser extension configuration. Unlike the previous result, the regression directly verifies Firefox's off-main-thread rotation for every face.
