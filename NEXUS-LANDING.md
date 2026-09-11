# NEXUS launch page and screenshots

Created 11 September 2026 after three independent reviews: product/source, release/updater, and visual/capture workflow.

## Deliverables

- `screenshots/01-home.png` through `06-details.png`: six 2880 × 1800 marketing compositions.
- `screenshots/index.html`: local gallery.
- `contact-sheet.png`: overview of the six compositions.
- `site/`: standalone product-page source, intended to be served at `/nexus/`.
- `../PROJECT-ANALYSIS-2026-09-11.md`: detailed product findings and source evidence.
- `../../docs/RELEASE-VERIFICATION-1.1.1.md`: installer/update verification and remaining limits.

Screenshots reuse the project's real application captures in `marketing/screenshots/`. No invented game artwork, games, or fabricated interface was generated. Existing populated library and sample statistics are explicitly identified as demonstration content. Source captures were not recaptured from a live user session. All game artwork and trademarks remain with their respective owners.

## Visual direction

Graphite surfaces, violet-blue crystal branding, geometric Outfit typography, large intact app captures, restrained edges and motion. Library previews switch with mouse or arrow keys, and every screenshot can be enlarged. Motion follows the system's reduced-motion setting. The page is deliberately independent of Lowlight's editorial music aesthetic and of the portfolio's 3D scene.

## Portfolio integration

- `src/pages/nexus.astro`: full-document route.
- `public/nexus/`: optimized WebP captures, brand mark, self-hosted font, stylesheet and script.
- `src/content/work/nexus.mdx`: `landingUrl: "/nexus/"` reuses the existing project-link integration.
- Existing portfolio work was left uncommitted; the portfolio has not been deployed.

## Download and updates

Installer version: 1.1.1. Static installer files are intentionally not copied into the portfolio: the 91 MiB package exceeds Cloudflare Pages' per-file limit. The button uses the stable GitHub latest-release asset name `NEXUS-Library-Setup.exe` in `reioken/nexus-releases`.

Each future release must include the versioned installer, stable-name alias, versioned blockmap and `latest.yml`. The normal public release must be marked latest for the default updater channel. The corrected build has an update feed; older 1.0 / some 1.1 installs require a one-time manual install. The user can disable startup checks in Settings. Full quit, not hiding to tray, applies a downloaded update.

Published with explicit user approval: https://github.com/reioken/nexus-releases/releases/tag/v1.1.1 . Anonymous public download verified against the local SHA-256; update feed and blockmap verified accessible. Installer SHA-256: 5335b004464a3bedbc41802debc487ea196d78e988538194da07c8e539584ab3.

## QA

Landing checks passed at 320, 390, 768, 1024 and 1440 px: no horizontal overflow or clipped text, no failed local asset requests or browser exceptions, keyboard tab selection, image enlargement/Escape/focus return, FAQ and portfolio project link. 200% root text-size check passed. Isolated production Astro build passed without deploying. The existing unrelated portfolio large-bundle warning remains.

App full suite: 31/32 scenes passed. The existing roundicons assertion disagrees with current sidebar gradient styling; this release does not redesign those controls. Packaging and simulated updater transport/integrity/install-dispatch checks passed. Actual Windows upgrade execution remains an external end-to-end check.

## Reference review

The product positioning was compared with primary product pages: [Playnite](https://playnite.link/) emphasizes unified libraries, customization and controller mode; [GOG GALAXY](https://www.gog.com/galaxy) emphasizes a shared collection and cross-platform friends. Design conclusion: lead NEXUS with the personal Home and visual identity, while explaining store-client and import requirements honestly. This is a design judgment, not a claim of unique technical capabilities.

Outfit is redistributed under its bundled SIL Open Font License in site/assets/Outfit-LICENSE.txt. Page logos use a static rendering of the existing vector mark; tab transitions respect reduced-motion preferences. The original icon is retained as the favicon. The Sites skill was read, but its profile helper and reference files were absent from the installed plugin path; the existing Astro workflow was preserved and validated.
