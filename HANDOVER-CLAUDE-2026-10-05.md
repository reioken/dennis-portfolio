# Handover to Claude — October 5, 2026

Read this first. Dennis asked: “Update documentation. handover. claude with continue.”
The implementation and release are complete; this is the continuation record, not
a request to repeat the deployment or redesign the site again.

## Current state

| Item | Verified state |
| --- | --- |
| Repository | `C:/Users/denni/Projects/dennis-portfolio` |
| Branch | `feat/werkstatt`, pushed to `origin` |
| Live | https://www.dennisbf.design |
| Production source | `15a5136545f987258d9435b40060223a692c22b3` |
| Pages deployment | `07fc6db3`, https://07fc6db3.dennis-portfolio-87g.pages.dev |
| Release documentation | `5b4e9a6` (pushed; documentation only) |
| Latest local preview used | `http://127.0.0.1:4334/` |
| Local editor proxy | `http://127.0.0.1:4335/`; external to Git |

Git `main` is not the production source branch. Pages receives an explicit upload
with `--branch=main` from a build of the committed `feat/werkstatt` source. Do not
merge/reset branches to make their names agree. The handover's own documentation
commit will be newer than the deployed source; that does not require another deploy.

## What just shipped

**Mobile:** Dennis rejected the static-image presentation and wanted actual models
that can be tapped and zoomed into. The chosen layout is a vertical exhibition with
native scrolling and a compact station selector. The claw, project cabinets and
contact phone all have real live models. Entry reuses the visible canvas and moves
the camera; return preserves exhibition position. Current screenshots survive entry.
Only one prepared exhibition model is resident at once; the exhibit loop targets
30 fps and pauses offscreen/hidden. Pause, reduced-motion and poster/link fallbacks
remain. Pinch gestures no longer accidentally navigate gallery screenshots.

About has a full-width live claw with zoom, pause and loading/retry states. Its
section navigation fits a single 48 px row at 320 px. Work index has mobile gutters,
header clearance and a horizontal filter row. Details: [docs/mobile-arcade.md](docs/mobile-arcade.md).

**Ishikiri:** first project after About, station 02/14 before Riftback. Nine original
marketing images come from `C:/Users/denni/Projects/ishikiri/build/marketing/2026-10-04`.
DE/EN project content is included; status is in development, with no invented public
play/download link. All captures have 1920 px and 720 px WebP/AVIF versions.

Dennis rejected the initial scenic side illustration and dark cabinet. The live
`cab-ishikiri-v2` is beige/yellow (`#d3bf88`), jade trim, graphite deck/bezel, with
a sparse charcoal split-stone/jade side graphic matching the other machines.
It is 1.95 m tall, 0.9 m wide, with a 16:9 recessed monitor, joystick and six buttons.
Model hash: `de3ab319`; gzip 398,398 bytes. The official transparent ink logo is
drawn onto a full white TV screen, avoiding the rectangular paper-logo cutout.
Keep `logo-ink.webp` for that identity screen; `logo.webp` remains a separate card asset.

The real Blender marquee has 14 physical selector keys: `navigation-marquee-v2`,
hash `f48b04d9`, gzip 464,055 bytes. The mobile poster uses `ishikiri-v2` filenames.
Details and exact image-generation provenance: [docs/ishikiri-station.md](docs/ishikiri-station.md).

**Already shipped before this batch:** Deductidle (Dennis's daily game, finished for
now, idea by Dennis / implementation with AI); Sauté Survivors removed from the hall
but its page retained; Snapsize changed to one normal recessed monitor instead of
the four-screen rig. [docs/deductidle-station.md](docs/deductidle-station.md) records
that earlier release; its 13-key count is historical, now superseded by Ishikiri.

## Implementation map

| Area | Files |
| --- | --- |
| Mobile exhibition | `src/components/hall/MobileArcade.astro`, `mobile-arcade-viewer.ts`, `mobile-arcade.css` |
| About claw | `src/components/hall/MobileClaw.astro`, `mobile-claw.ts`, `src/components/work/about-panel.css` |
| Touch gallery | `src/components/work/GalleryLightbox.tsx`, `gallery-lightbox.css` |
| Station ordering/status | `src/lib/hall-items.ts`, `src/lib/project-activity.ts` |
| Cabinet and TV identity | `src/components/hall/hallScene.ts`, `hallLayout.ts` |
| Navigation GLB | `src/components/hall/dock-asset.ts`, `scripts/models/blender/navigation_marquee.py` |
| Ishikiri content/localization | `src/content/work/ishikiri.mdx`, `scripts/en-routes.mjs` |
| Cabinet source recipe | `scripts/models/hero-recipes/cab-ishikiri-v2.json` |
| Media and provenance | `scripts/assets/ishikiri-media.mjs`, `ishikiri-media.json`, `ishikiri-side-art-v2.json`, `ishikiri-finish-v2.mjs`, `encode-ishikiri-poster.mjs` |

## Dennis's decisions to preserve

- Premium, physical arcade construction, tactile real 3D navigation, restrained
  iridescent purple/blue/grey rather than excessive pink. Avoid generic flat menus,
  shiny cheap buttons, hover squares, decorative screws and artificial screen wipes.
- Signature wordmark plus full name, UX/UI background retained. The signature has
  a holo hover and no underline. Do not revive the double header or “Raumplan”.
- Loader animation centered and larger, text below with complete phrases. Header
  reveals with the site. Loader may use the signature, not a duplicate name heading.
- Process belongs under Über mich; experience is available through disclosure.
  Keep his existing education/roles and wording, not invented marketing claims.
- His process: inspiration from varied sources, problem solving, extensive planning
  and design bibles, multimedia work, iterations with Claude/Codex and other AI tools,
  multi-agent testing. His Floordirekt work includes functional product-image series
  pipelines across series, languages and brands.
- Local text editing must never be committed or present on the public site. Its
  proxy isolates editing events and patches DOM text after save/undo without a page
  reload. Translation follow-ups are recorded externally, not silently auto-translated.
- Latest publication was explicitly authorized. No new feature request is pending
  after this handover; continue from Dennis's next feedback. Deployment authorization
  for this completed batch is not a request to publish arbitrary future changes.

## Verification completed

- TypeScript passed, 31 review tests passed, 29 model hash checks passed, 61-page
  built-site audit passed.
- Local browser checks at 320/390/768 px, 844x390 landscape and 1440 px desktop:
  models, entry/return, screenshot switching/full-screen, About zoom/pause/anchors,
  filters/menu and localized links. One live exhibition canvas; no document overflow.
- Production desktop: beige Ishikiri, white logo TV, station order and 14-key marquee.
  Production 390x844: claw entry/return, Ishikiri entry, next screenshot, full-screen
  and close. No console errors or mobile horizontal overflow observed.
- All 60 checked live JS/CSS/model/art/poster files matched the isolated release
  build by SHA-256. Production editor scan and DOM check were clean.
- These are browser-emulated mobile checks, not physical-device performance results.
  No new Lighthouse score or broad cross-browser certification is claimed.

Evidence and external local tooling live under:
`C:/Users/denni/.codex/visualizations/2026/10/04/01a107cb-ddc1-7b72-84f0-e9b7c8a0ea5f/`

- `live-ishikiri-07fc6db3.png`: inspected production desktop screenshot.
- `ishikiri-release/`: isolated Git archive used for build/upload; `node_modules`
  junction points to repository dependencies.
- `verify-ishikiri-release.mjs`: release asset comparison.
- `portfolio-text-editor/`: external editor tooling, `Start-Editor.ps1`, edit history
  and translation queue. Inspect the queue before claiming all edits are translated.

## Local work to preserve

At handover, the only pre-existing tracked dirty file is `src/data/werkstatt.json`.
It was deliberately excluded from both release commits/builds. Do not stage it or
run the scanner incidentally. Preserve these untracked files as well:

- `.claude/settings.local.json`, `cat-animation.md`, `exports/screenshots-2026-09-16/`
- `public/models/mach-riftback-v3.glb`, `navigation-console-v2.glb` and `.glb.gz`
- `public/textures/floor/concrete-v1_{basecolor,normal,orm}.webp`
- `scripts/models/blender/navigation_console.py`, `scripts/qa/live/_tmp_stress.mjs`
- Superseded local Ishikiri v1 assets: `public/models/cab-ishikiri-v1.glb` and `.gz`,
  `public/media/mobile-arcade/ishikiri.webp`, `ishikiri-sm.webp`, and
  `public/textures/cabinet-art/quiet-v2/ishikiri.webp`.

Do not delete experiments just because they are untracked. The temporary Ishikiri
capture route was removed before release; do not restore it to production.

## Continuing safely

1. Inspect status and the relevant implementation before changing anything. Do not
   treat September's old open-work lists as current instructions. Blue is archived;
   old Blue animation instructions do not authorize restoring it.
2. Use the existing preview if running. If a dev server is needed, follow the repo's
   `astro dev --background` rule. Keep browser captures outside the repository and
   never run GPU bakes and browser captures together.
3. For a future authorized release, stage only intended files, commit, and build an
   isolated Git archive so dirty data, the editor and old assets cannot leak.
4. Run `npx tsc --noEmit -p .`, `npm run test:review`,
   `node scripts/qa/hero/verify-hashes.mjs`, then `npx astro build` with
   `ASTRO_TELEMETRY_DISABLED=1` and `node scripts/audit-build.mjs`.
   Never use `npm run build`, `npm run check` or `npm run deploy`: those invoke the
   werkstatt scanner and/or contact Worker deployment.
5. Upload the verified isolated `dist` using Pages project `dennis-portfolio`,
   `--branch=main --commit-hash=<source-sha> --commit-dirty=false`. The contact Worker
   is a separate service; do not redeploy it for visual changes.
6. Verify the actual custom-domain UI and asset hashes, then document the release.
   Docs-only changes do not need a build or another production deployment.

Older references: [hero machines](docs/hero-machines.md),
[QA tools](scripts/qa/hero/README.md), [September handover](HANDOVER-2026-09-20.md),
[release traps](HANDOVER-2026-09-19.md), and
[October design history](docs/portfolio-redesign-plan-2026-10-04.md).
Their dated intermediate states are historical; this handover and current source
take precedence for release status and current design.
