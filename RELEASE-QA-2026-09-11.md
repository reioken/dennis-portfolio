# Release QA — 2026-09-11

## Changes
- Machine order starts About, Riftback, Nexus, Lowlight; dock and directory share the same order.
- Brick wall reaches the header across portrait, landscape and ultrawide layouts, preserving brick texture scale.
- The centered loading prism turns continuously and fades over 320 ms as room ignition starts. Scene readiness includes asset preparation and GPU warm-up to prevent visible model pop-in.
- Prepared project navigation and stable About panel geometry reduce delayed or resizing panels.
- Nexus and Lowlight landing pages connect to their project pages and downloads; Riftback links to riftback.gg.
- Sitemap includes only English pages that are actually generated; build audit catches nonexistent sitemap entries.
- Production CSP permits local blob texture requests required by GLB embedded textures. Bundled modules remain external to avoid Astro navigation data-script violations without allowing data scripts.
- Contact service rejects malformed JSON shapes and preserves correct failure status codes for plain HTML form submissions.
- Deployment commands explicitly target Cloudflare Pages production branch main, including when releasing from a feature branch.

## Verification
- Build and TypeScript checks pass; 26 regression tests pass.
- Static audit: 54 marketing pages, links, canonical URLs, language metadata and sitemap targets.
- Browser scan: 108 page/viewport combinations, with no page errors, failed assets, broken images, document overflow or unnamed buttons.
- Wall ray checks pass at 320, 390, 768, 844, 1366, 1920 and 2560 px widths.
- Interactive suites pass for hall controls, touch navigation, menus, language switching, contact states, galleries and Lowlight controls. Gallery suite covers 81 checks across three layouts.
- Extended audit checks 348 fragment links, 28 srcset references and CSS asset references.
- Cloudflare preview checks cover actual response headers, redirects, 404s and downloadable files. Final hosted browser journeys pass at 1366 and 390 px with zero JavaScript errors, CSP violations or failed responses, including the 3D hall and Nexus/Lowlight navigation.
- Nexus installer and Lowlight installer URLs return downloadable files. Installers were not executed.
- Contact delivery is tested through mocked bindings; no real email was sent. Live validation is checked with invalid payloads only.

## Limits
- LinkedIn blocks automated inspection; the existing profile URL is retained.
- Responsive testing uses Chromium desktop/mobile emulation; physical iOS Safari was not tested.
- A game without a published playable build cannot be tested as playable.

Detailed machine-readable logs and screenshots are kept locally in ignored .source-assets directories.
## Follow-up: one hall per visit and uninterrupted startup
- Preserve the live Astro hall island through legal pages, indexes and the Nexus/Lowlight landing pages. Park it hidden and inert; pause rendering and ignore hall keyboard/gamepad input until returning.
- Internal navigation reuses the same canvas and scene. Remove the startup indicator from returning documents. A real reload still starts a fresh scene.
- Conceal About/project panels during first-time scene preparation, including navigation from an initially opened legal page. Avoid native view-transition snapshots around the live scene.
- Replace startup-time PMREM environment generation with the identical prefiltered half-float environment, generated offline. Runtime decompression is asynchronous; reflections retain HDR values.
- Render the metallic cube as a 288-frame, 60-fps atlas, using compositor translations instead of live 3D face assembly. Preserve the 320 ms dismissal at room ignition and reduced-motion behavior.
- Pixel-only cold-start recordings previously showed a roughly 300 ms gap. The updated normal and 6× CPU-throttled recordings show no such gap after the visible cube begins moving.
- Desktop and mobile navigation tests cover 16 route hops each, browser Back/Forward, unchanged canvas identity and no repeated model/environment requests. Edge checks cover direct About entry, legal-first entry, resizing while parked, keyboard isolation and a genuine reload.
- Reproduction tools: scripts/build-loading-prism.mjs, scripts/build-hall-environment.mjs and scripts/qa/hall-session.mjs. Generator scripts accept PLAYWRIGHT_MODULE for the local browser runtime.
- Landing-page interaction handlers are loaded once with the shared session and bind synchronously after DOM swaps, preventing clicks lost while a newly fetched script is still loading.

### 2026-09-11 — native loading loop and remaining figure edge speckles

- Replaced the 9216 x 512 CSS sprite and its two synchronized transform clocks with a transparent 128 x 128 animated WebP (288 frames, 4.8-second infinite loop). The approved cube appearance, centered placement, surrounding ornament and ignition fade remain. Reduced-motion users receive a separate still through a picture source. New asset URLs avoid reusing the previous cached atlas.
- A cube-only Chromium screencast with the main thread deliberately blocked for 14.4 seconds recorded 566 frames / 192 distinct cube states, including multiple loop boundaries; the largest measured hold was 106 ms (the sample excludes 100 ms at either end). No orbit, glint or signal pixels contribute to this test. Added scripts/qa/loading-prism.mjs. This does not prove every hardware/browser combination is stall-free: an actual cold start under 6x CPU throttling still produced one 267 ms capture gap during GPU preparation.
- Reprojected the approved figure textures with three times the UV island separation (0.003 vs 0.001). This reduces light skin/shoe texture bleed into hair when mipmaps are sampled. Desktop enlarged comparisons show fewer bright speckles along the hair. Confirmed 62,205 triangles and 100% matching rounded spatial positions; tattoos use the same source artwork. Updated model URL hash to bypass its old cache.
- Verified figure at desktop and 390 px phone widths in direct and bloom rendering. TypeScript, 26 regression tests and 54-page build/link/metadata audit passed. Hall navigation regression checked separately before publication.
