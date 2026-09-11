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