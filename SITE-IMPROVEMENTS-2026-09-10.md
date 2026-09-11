# Site improvements — 10 September 2026

Implemented from SITE-REVIEW-2026-09-10.md. Changes are local and have not been deployed.

## What changed

- Persistent 56px navigation with direct Projects and Contact access on desktop, Projects on phone, and legal/privacy links in the menu. The menu has a localized accessible name before and after hydration.
- A visible professional-role line and named project chooser on the home page. The chooser preserves the active language and uses client navigation.
- Six selected projects as the initial index view, with All, Games and the existing category filters available. Cards use actual work previews, portrait image sequences where appropriate, and explicit project status.
- Phone galleries use the available viewport instead of the projected cabinet screen. Surface selection, captions, previous/next and fullscreen controls occupy separate areas. The tested controls are 44px high. Screenshots are neutral by default; the desktop CRT effect is optional.
- Expanded reading view for project and About panels. The scene dims, text follows a single reading column, Escape closes the view, and entering a gallery clears the reading state. Earlier About experience is expandable; Contact receives primary emphasis.
- Mina's German study is readable HTML, including research, personas, flow, design decisions and deliverables. The original 11-section presentation remains available. Team attribution and the distinction between prototype work and released-product results are explicit.
- NEXUS, Berry, Riftcast and Riftback now explain the brief, contribution, design and current result using existing project material. Berry's version is aligned to v3.4.1; Briefly's English wording and conflicting Riftback body count were corrected. No new client results or personal research responsibilities were invented.
- Direct email appears above the contact form on phone as well as desktop; Subject is explicitly optional.
- Primary brand-button text now uses a dark foreground. The inspected Riftback button improved from approximately 2.21:1 to **8.33:1** contrast.
- Station-slider keyboard focus is preserved. Station and corridor names remain accessible in both languages.

## Games and loading

Exported game documents now belong under `public/game-builds/<id>/`, separate from portfolio `/arcade/` pages. All launch entry points share an availability check. Local builds need a valid release marker; hosted builds require an explicit release-ID list in addition to the configured base URL.

The exporter adds a status protocol around the Godot engine-start promise. The wrapper validates the sending frame, origin and game ID. An iframe load only requests status; it cannot mark a game as running. A missing or failed ready signal produces the existing timeout/error state.

Echo Frequency currently has no released browser build available in this workspace. Its direct route shows the availability explanation and project links, with **zero iframes and no 3D scene load**. Game hosting/export prerequisites were not fabricated or bypassed.

The 3D stage now has an independent startup watchdog and falls back if readiness does not settle. This bounds the asynchronous startup path; it is not a claim that synchronous GPU/driver stalls can be interrupted by JavaScript.

## Validation

| Check | Result |
|---|---|
| TypeScript | Passed; the eight original diagnostics are resolved |
| Regression tests | 4 passed: lazy asset traversal, engine readiness, unsupported export shell, failed engine startup |
| Production build | Passed; 26 generated pages plus 25 English route copies |
| Built-site audit | Passed for 50 marketing pages, local links and metadata |
| Keyboard | Repeated station arrows retain INPUT focus; English value text updates; gallery return restores selected-thumbnail focus |
| English navigation | Named chooser opens `/en/work/riftback/`; menu, legal/privacy links and game availability text verified |
| Phone gallery, 390 × 844 | Portrait/landscape surface switching, image navigation, separate controls, no horizontal overflow |
| Reading view | German Mina, English project flow, desktop and phone layouts checked; reading-to-gallery transition verified |
| Game unavailable state | English production route has a useful explanation, return links and no iframe |

The corrected asset report counts **1208.4 KB of reachable home JavaScript across 20 files**, including the lazy 3D scene, and **148.7 KB of CSS**. These are uncompressed reachable build bytes, not initial transfer size or Core Web Vitals. The large-scene bundle warning remains visible.

The normal `check` command now includes type checking and regression tests before build and audit. Astro's configuration-directory access required an approved build outside the workspace sandbox; the same release steps were completed individually after that permission issue.

## Review notes and limits

The pre-change source snapshot is in `.source-assets/review-baseline-2026-09-10/`; existing uncommitted work was preserved. No commit, deployment, external game export, upload or contact-form submission was performed.

One development-browser tab crashed after repeated rebuilds and scene reloads. A fresh production-preview tab completed the home → project → gallery and reading checks. This is a reason to retain physical-device and longer-session testing; it is not evidence of a confirmed production crash fix.

Native phone fullscreen, pinch zoom, screen-reader use and low-end-device performance still need real-device validation. The in-app browser did not expose a verifiable native fullscreen state. Missing game assets/hosting and additional individual/client outcome evidence remain external inputs.

Implementation references: [Godot engine startup API](https://docs.godotengine.org/en/stable/tutorials/platform/web/html5_shell_classref.html) and [Cloudflare Pages header rules](https://developers.cloudflare.com/pages/configuration/headers/). The existing game-specific header policy was moved to the isolated asset namespace; the site-wide policy remains separate.
