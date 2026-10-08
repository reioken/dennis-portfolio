# Handover to Claude — October 5, 2026

**Current continuation:** read [HANDOVER-CLAUDE-2026-10-08.md](HANDOVER-CLAUDE-2026-10-08.md) first.
It consolidates the latest TV verdicts, v3 review candidate, verification gaps and remaining work.
This file retains the detailed earlier implementation and release history.

Dennis asked: “Update documentation. handover. claude with continue.”
The October 6 release is complete. The October 7 continuation below is local and
uncommitted; this record is not a request to repeat a deployment.

## Current state

| Item | Verified state |
| --- | --- |
| Repository | `C:/Users/denni/Projects/dennis-portfolio` |
| Branch | `feat/werkstatt`, pushed to `origin` |
| Live | https://www.dennisbf.design |
| Production source | `cedb8fad3521f7f0976189739065274e11c25cf6` (CD player, split loader, UX/UI audit fixes; October 6) |
| Pages deployment | `d381da08`, https://d381da08.dennis-portfolio-87g.pages.dev (preview `9cf7dc68`, alias `ux-preview`) |
| Current hi-fi preview | `a25254be`, https://hifi-preview.dennis-portfolio-87g.pages.dev (October 7; production unchanged) |
| Previous release | `e6b91f9` / `ed7da1ba` (performance); before that `15a5136` / `07fc6db3` |
| Release documentation | the commit after `cedb8fa` (documentation only) |
| Latest local preview used | `http://127.0.0.1:4334/` (October 8 isolated `bedroom-corrected-release/dist`; Tripo/Blender TV v3 review candidate, unapproved; hi-fi 4331 and rejected TV v1 4332 / v2 4333 preserved) |
| Local editor proxy | `http://127.0.0.1:4335/`; external to Git |

Git `main` is not the production source branch. Pages receives an explicit upload
with `--branch=main` from a build of the committed `feat/werkstatt` source. Do not
merge/reset branches to make their names agree. The handover's own documentation
commit will be newer than the deployed source; that does not require another deploy.

## October 8 verdict — TV appearance rejected, Tripo rebuild requested

Dennis says the models need substantially more polish. Replace the TV-corner pieces through individual
reference images → Tripo.ai → Blender polish. The procedural v1 below is a functional rollback,
not a visually approved result. Add candid horizontal GameCube stacks with readable side spines,
uneven mixed game/cartridge piles and naturally angled controllers. Keep Melee prominent and the
requested Zelda/Yoshi's Island/Smash 64 games. See [docs/bedroom-tv.md](docs/bedroom-tv.md).

15 replacement modeling references are saved in `.source-assets/bedroom-tv-tripo/references/`.
`scripts/models/bedroom-tv-tripo.references.json` records each path/hash and actual Tripo/Blender state.
Dennis signed in on October 8. All 15 H3.1 geometry jobs and 15 4K texture jobs completed, using 750 existing
credits total. Source GLBs are preserved in `raw/` and `textured/`; all 15 polished pieces and editable
`bedroom-tv-v2.blend` are under `.source-assets/bedroom-tv-tripo/`. Original Nintendo covers/screens and
readable side spines are applied, with two uneven game piles, angled controllers and loose cartridges/cables.
CRT and GameCube front details received selective artist repairs on the generated bodies.

Historical v2 model: `bedroom-tv-v2.glb.gz?v=a1c96b20`, 210,220 triangles, 28 static material batches,
5,447,498 gzip bytes. TypeScript, 39 review tests, 31 hashes, isolated build and 61-page audit pass.
Built browser checks confirm DE/EN inspect/return, Enter/Escape and restored focus, hi-fi access,
short-desktop framing and native phone exclusion without overflow; no warnings/errors observed.
GPU recovery checks below are historical v1 coverage, not repeated v2 results.

Rejected v2 comparison at **http://127.0.0.1:4333/**. Evidence: `tv-tripo-v2-final/` Blender renders and
`tv-tripo-{hall,inspect,short-desktop,phone}.png` built-site captures under the October 7 artifact root.
Source overlay: `bedroom-tripo-release-sources.json`; current UI/delivery checks: `tv-tripo-built-checks.json`.
Dennis subsequently rejected v2: broken, mushy textures, especially the GameCube, then explicitly
required fixing **all objects**. V2 is rejected. All fifteen source types have received the v3 correction,
with clean direct hardware materials, local Blender retopology, repaired controls/printing and full-size
individual original covers. Editable final candidate: `.source-assets/bedroom-tv-tripo/bedroom-tv-v3.blend`.
Per-piece closeups `tv-v3-final-pieces/` share its recorded SHA; `tv-v3-assembly/` contains three final views.
The final N64 ventilation cuts are applied by `bedroom_tv_delivery_finish.py` after assembly and before
packing. See the reproducible correction workflow in `docs/bedroom-tv.md`; intermediate `corrected/`
exports do not include all final artist repairs.

Current candidate: `bedroom-tv-v3.glb.gz?v=5bfa96da`, **742,449 triangles**, **44 material batches**,
**13 separate artwork maps**, **5,928,346 gzip bytes**; no AI hardware texture maps. Review at
**http://127.0.0.1:4334/**. Isolated sources: `bedroom-corrected-release-sources.json`.
TypeScript, 39 review tests, 31 hashes, Astro build and 61-page audit pass. Actual delivered gzip and
decoded packed bytes match local files; DE/EN desktop preloads are correct. Delivery evidence:
`tv-v3-delivery-audit.json` and `tv-v3-built-checks.json`. No additional Tripo credits used.

**Unapproved review candidate.** Browser automation fails before execution with “failed to write kernel
assets … path specified (os error 3)”; no v3 interaction/mobile/GPU browser checks were performed. Inspect
all revised objects and verify the built interaction before activation. The repository runtime remains
v2; only isolated 4334 uses v3. No visual approval, commit, push or hosted TV release.

## October 7 Nintendo TV corner — built locally, source uncommitted, visually rejected

Dennis selected mockup 03: "Build the last one. piece by piece. same fidelity and quality as the other models."
Melee must be visible, with Zelda games, SNES Yoshi's Island and Smash 64. Completed the rounded graphite/silver
stand, curved CRT, all five consoles/handhelds, three controllers, wiring and original textured game packaging.
Melee faces forward beside the GameCube and appears on the tube. See [docs/bedroom-tv.md](docs/bedroom-tv.md).

`bedroom-tv-v1.glb.gz?v=d2bb74e4`: 48,829 triangles, 943 KiB gzip; 26 material draws after static batching.
Right of claw at X +1.32/Z -1.13. Keyboard-accessible inspect view, DE/EN return labels, Escape and return focus.
Claw startup/late-load path and preloads include it; native phone pages exclude the accessory. Forced GPU recovery
keeps TV/hi-fi corner poses while respecting navigation during recovery.

TypeScript, 39 review tests, 31 hashes, isolated Astro build/61-page audit, 17 corner browser checks and 8 built
preview checks pass. Browser evidence: `tv-hall-qa-pass/`; isolated built preview at `http://127.0.0.1:4332/`,
`bedroom-release/` under the October 7 external artifact root. This extends only the approved hi-fi snapshot
with named TV files. The previous hosted hi-fi (`a25254be`), production (`d381da08`), and older uncommitted work
are preserved. No commit, push or new hosted TV deployment.

## October 7 continuation — verified hosted hi-fi preview, source uncommitted

Dennis: "1. works do the rest" after the status review. The loader buttons are resolved by his confirmation.
The current hi-fi is the clean generated silver unit and speakers, centered CD, layered LCD/glass, brushed grain,
speaker wires and mains lead; its gzip model is 0.41 MB. The earlier model sizes below are historical.

Completed the factual UX audit items: shared delivery-status wording without duplicate active status, dynamic
selected-project count, directory numbers matched to physical stations, short-landscape selector scrolling,
About/directory internal link cues, localized gallery names, descriptive archive/Mina image text and consistent
About names/headings. The phone gallery now retains its last screenshot after reopening, including after the
7-second attract interval. The CRT collapse/retype design choice and physical-device checks remain open.

Additional playback bug reproduced and fixed: rapid next-track presses cancelled old `play()` promises, whose
rejection incorrectly marked the newest playing track as stopped. `albumPlayer.ts` now ignores stale requests;
the permanent CD-player browser suite includes the regression (33/33 with the real album).

Verified TypeScript, 39 review tests (seven new audio-range tests), 30 model hashes, isolated build and 61-page audit. Browser checks include
900/1024/1280/1440/1920 px hi-fi layouts, real audio click/seek, actual GPU-process crash with music continuing,
DE/EN content, short landscape, mobile gallery retention, portfolio-refresh, repair-flow and loading-prism.
All six audio files return 206 byte ranges locally and on the hosted preview. Hosted CSP/headers and playback pass.

After the initial automatic-review rejection, Dennis explicitly approved the complete build, six album tracks and
cover for project `dennis-portfolio`, preview branch `hifi-preview`. Uploaded and verified as `a25254be`.
Pages itself returns full files for ranges and hides the internal asset length. The narrow
`functions/media/music/[[path]].js` handler now streams requested byte intervals through `FixedLengthStream`, using
`album-lengths.json` metadata checked against the six actual files. No whole-file buffering or temporary diagnostic
header remains. Seven regression tests cover ranges, validators, cancellation, fallback and metadata.
The hosted preview passes 18 exact ranges, real click/play/seek/pause/rapid-skip/stop/close, DE/EN CSP hashes,
phone content/layout and 63 SHA-256 asset comparisons. Nothing has been committed, pushed or deployed to production.
Unrelated dirty `src/data/werkstatt.json`, external editor and old untracked experiments are excluded from the build.

Full evidence, build path and next steps: [release readiness](docs/research/release-readiness-2026-10-07.md).

## Performance release — October 5, evening

A friend of Dennis's reported heavy lag. The measured causes and fixes are in
[docs/research/performance-2026-10-05.md](docs/research/performance-2026-10-05.md); Dennis approved
(„Mach alles davon. 3d navi kann auch etwas kleiner gemacht werden.“, then „ja“ to commit and release).
In short: the navigation console compiles before its first frame, is frame-capped and smaller (max 960 px);
the quality ladder stays on one render path and reacts within seconds, with an approximated area light on
wall and floor below full quality; the floor reflection no longer renders nested; surface textures decode
off the main thread; text fitting no longer measures once per pixel. Full quality is pixel-identical to the
previous release at the old console size. The integrated-GPU and slow-CPU measurements use this PC's AMD
iGPU (`--use-adapter-luid`) and CPU throttling as proxies; `scripts/qa/live/perf.mjs` reproduces them.

Released as `e6b91f9` / Pages `ed7da1ba` after a preview deployment (`perf-preview` alias, real headers and
CSP). Isolated archive build: TypeScript, 32 review tests, 29 model hashes, build and 61-page audit passed;
no editor markers in the build. Live: 55/55 JS/CSS assets and the console model byte-identical to the build,
flow check 16/16 (phone claw/exhibit/viewer/full screen/return, desktop keys/case/directory/EN), no errors.

Four older QA suites (`mobile-exhibition`, `mobile-camera`, `mobile-handoff`, `portfolio-refresh`) already
failed against the previous release: they still expect Riftback first and no live claw model. A separate
session was started to update them.

In progress next: Dennis asked for a silver, early-2000s style CD player model next to the claw machine
(left), in the site's palette, where visitors can play his music. Built locally (not committed, not released):
[docs/cd-player.md](docs/cd-player.md). Open: whether his album audio may be hosted on the site (until then a
click opens Spotify), the cover on the disc, and his verdict on size and placement.

## Release October 6: CD player, split loader, UX/UI audit

Dennis: „commit and deploy“. Released as `cedb8fa` / Pages `d381da08` (with the earlier `43645d2` loader focus fix).
Contents: the CD player in Spotify mode ([docs/cd-player.md](docs/cd-player.md); the album is not hosted), the
loader's editorial split (his mockup; the cube and its motion unchanged, the two ways in as buttons) and the fixes of the
audit against [docs/portfolio-ux-ui-rules.md](docs/portfolio-ux-ui-rules.md)
([docs/research/ux-audit-2026-10-06.md](docs/research/ux-audit-2026-10-06.md), including the open decisions).
Isolated archive build: TypeScript, 32 review tests, 30 model hashes, build, 61-page audit, no editor markers. Preview
`9cf7dc68`: feature/CSP checks 6/6, flow check 16/16. Live: 56/56 JS/CSS/model assets byte-identical to the build,
feature/CSP 6/6, flow 16/16, Contact protections 11/11 (network intercepted, nothing sent), close/history 7/7.

## Local, October 6 evening (not committed, not released)

Dennis: the CD player should open a menu to pick and play his songs on the site, a different player with the CD
visible on top, a click zooming onto the top, skeuomorphic keys, the album cover on the spinning disc; images from
Gemini in Chrome, models from Meshy. And: "while browsing everything except the navs turned black randomly".

- **Black room.** Reproduced as a lost WebGL context (a GPU process reset: driver timeout, another program loading the
  GPU, memory pressure): the hall handed over to its dark CSS backdrop for the rest of the visit, the console to its
  DOM controls. Now `Stage3D.tsx` rebuilds the hall about a second later at its current station and pose, without the
  loading screen or the ignition (`recover` in `hallScene.ts`, `data-recover` fade in `hall-loading.css`), up to three
  times per visit; the console is mounted again (`dock:contextlost`, `Hall.tsx`). Two leftovers of a reset fixed with
  it: the wall game's spray stamps are GPU canvases that a reset blanks (`forgetSprayStamps`), and three's
  `compileAsync` threw or polled forever when a late station was still compiling (`compileReady`). Checked with
  CDP `Browser.crashGpuProcess` on dev and on a production build (hall, project page, English page): back in 3–4 s,
  wall paint complete, no errors. 81 steps of normal browsing on live never went black.
- **CD player.** Replaced: [docs/cd-player.md](docs/cd-player.md) (the old boombox, its model, build script and QA are
  deleted in the working tree). `node scripts/qa/cd-player.mjs` passes 30/30 on dev and on a production build
  (27 + 3 dev-only skips). Gemini in Chrome was unreachable (extension not connected): Nano Banana Pro through Meshy.
  The album audio and cover were refused to me by the permission system; Dennis ran the encode himself and they are
  in `public/media/music/a-lifetime-briefly/` (untracked; `--real` QA passes 32/32 with them).
- Checks: `tsc`, 32 review tests, 30 model hashes, isolated production build (32 pages, 29 EN routes, CSP hashes).
- **Loader, later the same evening.** Dennis: "way too big … should be more centered … way too far from each other":
  the split is now one compact group in the middle (columns sized to their content, ways in centred under it; emblem
  scale 3.2 / 3.7 / 4.3 instead of up to 8.4, statement up to 88 px). And a refresh on a project, About or Contact page
  no longer shows the turning emblem beside the readable content ("bugged"): the room fades in behind it when ready.
  The CD player's track list now sits just right of the lid, the pair centred (`placeMenu`). `loading-prism.mjs` passes.
- **Then:** the dashes under the cube became one line across the whole group with a flowing violet-blue gradient
  (`.hall-startup__progress`, a compositor transform); the Discman was replaced by the bedroom hi-fi of Dennis's
  reference, every piece built in code (`hifi.ts`; docs/cd-player.md); and the overhead TV kept the last project's
  logo when jumping back to Ueber mich or Kontakt (an early return in `updateTv`); now the parked TV shows the cabinet
  under it. `cd-player.mjs --real` 32/32, `loading-prism.mjs`, TV jump/park probes and the GPU-crash rebuild pass.
- **Night (into October 7): the hi-fi's pieces as Tripo models.** Dennis: every piece except the glass from a Gemini
  image through tripo.ai, "better looks and more details". Gemini images and Tripo GLBs in `.source-assets/hifi/`;
  `public/models/hifi-v1.glb.gz` (1.19 MB, untracked like the other new models) from
  `scripts/models/blender/hifi_build.py` + `hifi_bake_lowpoly.py`; `hifi.ts` assembles it with the glass, lid, well,
  disc and display in code; loaded with the claw machine's station and preloaded on home/About. Details and lessons
  (weld before decimating, normals transferred back, speaker/cases rebaked low, Tripo's full metal set to satin, the
  packer's node transforms kept by `adopt`) in docs/cd-player.md. Also the loader's cube column is as wide as the cube
  draws (it had collapsed to 72 px after the status line moved, the group sat 48 px right). `cd-player.mjs --real`
  32/32 and `loading-prism.mjs` pass. Still open: "buttons on the load page dont work" (not reproduced; suspect
  Firefox's synchronous shader linking between startup batches).
- **October 7, evening.** Dennis: "better textures. better looking glass panels. also the table further to the wall":
  4K re-exports from Tripo (no credits), normal maps that now carry detail, the unit's 4K colour swapped in on the
  close-up; Fresnel float glass (`floatGlass`); the corner at the wall (`CD_PLACE` z -1.15, rotY 0.1). Model 1.67 MB.
  `cd-player.mjs --real` 32/32.
- **Then:** "all look smudged, not accurate": Tripo's AI paint replaced by classified flat paint baked with geometry
  AO (`hifi_paint.py`), the speaker grille drawn (`grillePanel`), the 4K swap removed. Model 1.52 MB. 32/32.
- **Then:** seams and cases: the body ironed, a flat deck plate over the dented top (`deckPlate`), the jewel cases
  built in code (`caseStacks`); `hifi_bake_lowpoly.py` deleted. Model 1.19 MB. 32/32.
- **Then:** "fix the model then or make a new one": the unit modelled new (`hifi_unit_gen.py`), deck plate gone,
  prints in code. Model 0.49 MB. 32/32.
- **Then:** the speaker modelled new (`hifi_speaker_gen.py`), the CD centred on the deck, the LCD layered behind a
  pane with depth. Model 0.41 MB. 32/32.
- **Then:** silver speakers, a brushed grain on the silver (world-space triplanar), speaker wire and a mains lead to
  a wall socket. 32/32.

## What shipped earlier on October 5

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
- The completed October 5 publication was explicitly authorized. Later hi-fi and TV work is recorded
  in the October 8 handover. Deployment authorization for a completed batch is not a request to
  publish arbitrary future changes.

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

At the original October 5 handover, the only pre-existing tracked dirty file was `src/data/werkstatt.json`.
The workspace now has extensive additional intended local changes; consult the October 8 handover.
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
