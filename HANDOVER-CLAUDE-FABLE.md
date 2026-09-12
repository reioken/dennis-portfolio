# Dennis portfolio — handover for Claude Fable

Prepared 2026-09-12 from the repository, retained QA reports, and the current conversation. This is the current entry point. `HANDOVER-2026-09-10.md` is historical: its uncommitted status, old About layout, machine order, loader and outstanding-publication notes are superseded.

## 1. Current state and immediate next step

Latest application commit: **`3e07dc8`** (Blue v2: re-authored clips, cleaned coat, pointer attention), pushed to `origin/feat/werkstatt` and **published on 2026-09-12** at Dennis's explicit request (deployment `85fc5078`, uploaded from a fresh build of `4eb7b56`, which only adds handover text on top of `3e07dc8`). Dennis's feedback on the first Blue release was that the cat was not clean, not interactive enough and its animation not smooth; that pass is implemented and documented in `docs/research/blue-cat.md` (section "v2 polish"). Dennis has not yet reviewed v2 on the live site; expect vetoes on the sphinx rest pose, the satin-black coat or the attention behaviour.

| Item | Current value |
| --- | --- |
| Workspace | `C:/Users/denni/Projects/dennis-portfolio` |
| Working / pushed branch | `feat/werkstatt` |
| Git remote | `https://github.com/reioken/dennis-portfolio.git` |
| Production | `https://www.dennisbf.design` |
| Latest verified deployment | `https://85fc5078.dennis-portfolio-87g.pages.dev` (Blue v2, build of `4eb7b56`) |
| Cloudflare Pages project | `dennis-portfolio` |
| Pages production branch argument | `main` |
| Local development | `http://localhost:4321/` |
| Latest delivered assets | `portrait-wide-v2-{1200,640}.webp`, `blue-rigged-v2.glb` (`blue-rigged-v1.glb` retained for rollback only) |

**Git branch and deployment branch are different.** Production was uploaded directly from the tested `feat/werkstatt` build with `--branch=main`; this did not merge the Git branch into `main`. Do not assume Git main contains this work. At inspection, local main was behind origin/main, whose tip was `3ad8ae9`; those refs have not been freshly fetched for this documentation pass. Reconcile intentionally if a main-branch merge is requested. Do not overwrite or force-push main.

At handover inspection the only unrelated untracked file was `.claude/settings.local.json`. Leave it alone; it was not included in the site commits. Private scratch assets are ignored under `.source-assets/`.

The user explicitly approved uploading the wider portrait, hair correction and Blue to GitHub and production after an automated approval ambiguity. **That publication is now complete; there is no remaining approval blocker for this release.**

## 2. Product direction and non-negotiable preferences

- This is a professional designer's portfolio website presented as a 3D arcade hall. Preserve the hall/gallery and skeuomorphic clickable machine controls. Do not replace it with a generic flat portfolio or call the website itself a game.
- Dark, modern, creative, sleek and atmospheric. Restrained lavender, ice blue, pearl pink and warm light; iridescence rather than a full rainbow. Avoid busy panel graphics, generic dashboard styling and invented marketing copy.
- Machine side artwork covers the whole side; fronts may stay quiet. Keep realistic material detail and wear without milky glass, overpowering glare or white edge shimmer.
- Start at the left with About's claw machine, then Riftback, then NEXUS as the **third physical machine**. Lowlight follows NEXUS. Keep equal station spacing and room for mascots.
- Use appropriate icons from Dennis's **Nucleo** collection. Existing wrapper: `src/components/icons/Icon.tsx`; source IDs: `src/components/icons/nucleo-sources.json`. Do not substitute unrelated icon styles simply because a package is installed.
- Generated mockups means actual generated images, not implemented code mockups. Discuss substantial visual departures before implementing them.
- User chose the editorial **poster About layout**, but all career, education, skills and contact information must remain. Never remove information to make a mockup fit.
- Portrait: recognizable actual face, only subtle blemish cleanup and slightly stronger moustache; complete shoulders/upper arms, no oversized face, real transparency through hair. Preserve warm and violet hair lighting and separate blurry background atmosphere.
- Loading happens once on initial site entry. Internal navigation must preserve the hall and avoid another room ignition, content flash or small temporary panel that resizes.
- Initial room reveal is slow, intentional dark light flickering, with a centered PS2/GameCube-era-style cube indicator. No visible models popping into a lit room. Cube fades when ignition begins; it must rotate continuously, including in Firefox.
- Reading mode and the duplicate header “Halle” link were deliberately removed. Shared back arrow sits beside the content panel; Escape remains available.
- User wants autonomous execution, useful concise updates, appropriate QA, and automatic commits/publication for authorized site changes. Never expose API keys in documentation or commits.

## 3. What changed

### Hall, projects and navigation

The broad release `2faa56c` replaced the earlier hall presentation with higher-quality machines, panel graphics, screen presentation, gallery/control polish, responsive navigation and the integrated Lowlight/NEXUS pages. Detailed older generation notes are in `scripts/models/AFTERIMAGE.md`; their dated test results and open items are historical, not necessarily current.

- Nocturne is now **Lowlight**, with marketing images sourced from `C:/Users/denni/Projects/Spotify/design/marketing`, a fitting machine design and `/lowlight/` landing link. Legacy Nocturne routes remain in the build for compatibility.
- NEXUS case links to `/nexus/`. Landing page was completed by another agent, then integrated and published. Current installer URL is `https://github.com/reioken/nexus-releases/releases/latest/download/NEXUS-Library-Setup.exe`; do not replace it with a guessed binary URL.
- Riftback points to `https://riftback.gg`.
- Current order in `src/lib/hall-items.ts`: About/kasse, Riftback, NEXUS, Lowlight, Sauté Survivors, Echo Frequency, Safeplate, Cab No. 9, Hookline, Berry, Carillon, Riftcast, Briefly, Mina, Contact/phone.
- TV/media work addressed old logos persisting, duplicated text logos, logo aspect ratios, logo dwell and dissolves. Preserve the intended static machine screen in hall mode and changing captures after entering a project. About/Contact should not trigger a project TV travel sequence.
- Persistent hall and startup fixes are in `949c847` and `89f1c85`. Keep internal route changes lightweight; do not recreate the WebGL scene per page.
- `012b6da` removed reading mode and the header return duplication and introduced the shared panel back button.

### About poster and portrait

| Commit | Delivered change |
| --- | --- |
| `e157469`, `3448fe6` | Researched three About directions and generated mockups |
| `f4a1df3`, `28bd516` | Portrait direction and fresh subtly retouched source-based headshot |
| `97db7a4` | Editorial poster implementation with complete profile |
| `3ac72b2` | Specialty band, mockup accents and bounded ultrawide composition |
| `9b9b071`, `012b6da` | Background atmosphere, real local cutout and navigation cleanup |
| `b86e464` | Wider source portrait with complete shoulder silhouette |
| `f5e84f7` | Removed pale background remnants inside four curls; responsive v2 exports |

Content remains in `src/lib/site.ts` and bilingual copy in `src/lib/i18n.ts`. Implementation: `src/components/work/AboutOverlay.astro`, `about-panel.css`, and `src/pages/about.astro`. The content-preservation QA recorded 8 career entries, 4 education entries, 23 skills and both language-proficiency entries. Four sections: `about-story`, `about-experience`, `about-training`, `about-expertise`.

Original identity photo: `C:/Users/denni/Downloads/20260911_223412.jpg`. Earlier approved lighting/treatment asset: `public/media/me/portrait-poster-1122.webp`. Wide generated source and editable mattes are local:

- `.source-assets/portrait-wide-generated.png`
- `.source-assets/portrait-wide-cutout.png`
- `.source-assets/portrait-wide-cutout-matted.png`
- `.source-assets/portrait-wide-hair-clean.png`
- `.source-assets/portrait-wide-prompt.txt`
- `.source-assets/cutout-wide-portrait.py`, `.source-assets/matte-wide-portrait.py`

Image generation painted an opaque checkerboard despite requesting transparency. Dennis explicitly approved **local background removal**. BiRefNet/rembg and matting produced real alpha; the most recent fix refines the four enclosed hair gaps. Reproducible correction: `scripts/assets/refine-portrait-hair.py`. It is intentionally tied to the approved **1145×1086** matte and asserts that size. It alters alpha only, asserting all source RGB stays unchanged before resizing/encoding. Do not apply those polygon coordinates to a different image.

Current runtime assets: `public/media/me/portrait-wide-v2-1200.webp` (202,080 bytes), `portrait-wide-v2-640.webp` (67,492 bytes). Both About markup and page metadata use v2. Versioned filenames avoid stale immutable caches. Warm/violet highlights remain; pale background islands were removed. Face was not regenerated during cleanup. Previous v1 assets are retained for provenance/rollback, not the current About reference.

### Room atmosphere

Research: `3c42905`; implementation: `e300b79`.

- Dark offline-generated PMREM environment with cool, lavender and warm emitters.
- Six fixed-budget rectangular lights; station colors fade as focus moves. Lights stay positioned with their sources.
- Cycles diffuse-response/AO maps for wall and floor, authored from generic cabinet proxies. These are not full dynamic GI or exact per-machine shadows.
- Floor combines stone PBR, local illumination and planar reflections with HalfFloat HDR capture/blur targets, angle response, subtle distortion and edge fading.
- Lite/mobile uses PBR floor and response maps without planar capture. Reduced TV bloom and less milky screen glass; startup power cue modulates lighting.
- Ultrawide pixel-budget fallback corrected. No volumetrics, screen-space reflections or new dynamic shadow-map system.

References: `docs/research/hall-lighting-atmosphere.md`, `hall-lighting-implementation.md`. Generators: `scripts/build-hall-environment.mjs`, `scripts/models/blender/bake_hall_light.py`, `scripts/build-hall-light-maps.mjs`.

### Loading cube: actual Firefox cause and final fix

**Use `9ecd880` as the baseline.** Earlier animated-WebP and parent-rotation implementations were repeatedly reported as frozen by the user. Do not restore them based on old documentation or a visually moving outer bracket.

Native Firefox diagnostics showed the parent 3D rotation was not composited although panel expansion and brackets were. A main-thread stall stopped rotation while other parts continued. Moving complete transforms onto each face exposed a second issue: perspective produced enormous calculated face bounds and disabled acceleration on some faces.

Current `src/components/hall/hall-loading.css` keeps the preserve-3D parent static and puts complete linear rotation plus gentle expansion on each of the six faces. Orthographic projection prevents Firefox's inflated bounds. Thin opaque panels, 4.8-second rotation, restrained gradients; no crossing glint overlay. Reduced motion is intentionally static.

`scripts/qa/loading-prism-firefox.mjs` reads native off-main-thread rotation with a privileged script **only inside a disposable test profile**. Six faces stayed accelerated through two full turns under 9.6-second main-thread blocking; maximum sampled rotation hold ~41ms. Chromium screencast tests isolate cube movement from bracket/progress movement. These measurements cover this machine, not every browser/driver.

Full diagnosis: `docs/research/loading-cube-compositor.md`. Its “Firefox correction — 2026-09-13” heading is a historical date inconsistency; the code was already deployed and verified in this September 12 handover. Follow commit IDs and evidence, not that heading.

### Dennis figure and Blue

Dennis's accepted stylized toy figure is `public/models/dennis.glb`, referenced with a version query in `hall-items.ts`. Purple short-sleeved shirt, loose dark trousers and chunky sneakers; no watch. Tattoo placement was iterated from personal photos: spider on the back of the hand, sword vertical in the middle of the forearm, with earlier arm assignments corrected by the user. The user accepted the current model for now. Do not assert perfect tattoo fidelity or regenerate without a request. Several white-edge shimmer fixes were made; preserve them and test motion if changing AA, texture filtering or materials.

**Blue (`d618f34`)** is Dennis's black cat with amber eyes, not the lighter cat in the source archive. Source archive: `C:/Users/denni/Downloads/drive-download-20260911T230121Z-1-001.zip`. Photos, generated multi-view references and pipeline records: `.source-assets/blue/`.

- Two single-view Meshy attempts were rejected for flattened/malformed anatomy. Third multi-image attempt succeeded: task `01a092ce-e72d-73f4-b9f5-bd9c4af497e9`. Total spent: **95 credits** (35 + 30 + 30). Do not regenerate failed models as fallbacks or spend more credits without a concrete need.
- Final `public/models/blue-rigged-v1.glb`: **1,961,872 bytes**, 26 joints, 6 clips (`idle`, `walk`, `settle`, `sleep`, `wake`, `happy`), `BlueBlink` facial morph and `BlueGround` floor-contact correction.
- Blender script: `scripts/models/blender/blue_rig.py`. Packed editable master: `.source-assets/blue/v3/blue-rigged-master.blend`; normalized source: `blue-normalized.blend`; raw export: `blue-rigged.glb` in the same folder.
- Custom anatomical skinning, weight smoothing and leg solving; these are authored stylized motions, not motion capture. Some stylized joint compression remains a possible refinement.
- Runtime `src/components/hall/blueCat.ts`: restrained roaming by the first machine, pauses, settling/sleeping/breathing/waking, interruptible happy reaction with eye closing, head tilt and tail movement. Small upholstered basket left of claw machine.
- Mobile scales/repositions cat and basket. Reduced motion disables roaming. Pausing/off-screen hall stops Blue's clock. Blue is part of startup readiness and must not appear after the room is lit.
- Pointer hits actual cat before cabinet/background logic. Keyboard uses a projected accessible button; `transition:none!important` avoids a moving hit-target lag. `Stage3D.tsx` no longer hides this control from accessibility; canvas itself remains aria-hidden.
- Keep opaque fur, amber eyes and generated pupil texture; no white markings, collar or alpha hair cards.

**Blue v2 (`3e07dc8`, 2026-09-12)** answers Dennis's "not clean, not interactive, animations need to be way smoother":

- Diagnosis: the glTF exporter had decimated the sampled clips to a handful of linear keys, the authored motion was tiny, the sleep pose dropped the torso through the floor (belly clearance is 12 cm), and the Meshy atlas carried streaky highlights.
- `scripts/models/blender/blue_animate.py` opens the unchanged skin master and re-authors all six clips at 30 fps (idle look-around with ear flicks, real lateral-sequence walk, **sphinx rest** instead of the crushed loaf, breathing/drooping sleep, happy head tilt), rebuilds the floor-contact morph, cleans the coat via UV-selected eye and inner-ear islands, prunes static channels and repacks the GLB. `blue_check.py` renders poses and reports skin stretch. Runtime asset: `public/models/blue-rigged-v2.glb` (2,144,196 bytes).
- `src/components/hall/blueCat.ts`: idle/walk blended by ground speed (no foot sliding), acceleration-limited locomotion with eased turns and random stops, layered settle/sleep/wake/happy, petting a resting cat wakes it first, a fixed resting heading so the lying pose reads from the frontal camera, and a post-mixer attention overlay: neck/head/ears follow the pointer, look at the viewer with perked ears and a slow blink on hover, glance at the camera without a pointer. Velvet sheen material, glossy eyes.
- `hallScene.ts` feeds the pointer ray/hover state through `look()` and clears it on `pointerleave`; loader failures are logged.
- Known residue: faint mip-bleed specks from the eye texels on the resting cat under strong light (see the research note), wrist stretch in the sphinx pose hidden from the camera, native Firefox and physical devices not rerun for v2.

Detailed pipeline/QA: `docs/research/blue-cat.md`. Meshy CLI adapter used: `C:/Users/denni/Projects/survivorlike/tools/meshy.py`. No API credential is included in this handover; never recover one by printing conversation secrets into files/logs. Public rigging API support must be rechecked before using it for quadrupeds; this delivery used local Blender rigging.

## 4. Architecture and file map

| Responsibility | Files |
| --- | --- |
| Persistent hall / routing / framing | `src/components/hall/Hall.tsx`, `Stage3D.tsx`, `src/layouts/BaseLayout.astro` |
| Three.js scene, camera, TV, lighting, floor, picking, readiness | `src/components/hall/hallScene.ts` |
| Hall styling and loading emblem | `src/components/hall/hall.css`, `hall-loading.css` |
| Station data, models and order | `src/lib/hall-items.ts` |
| Project content / links / screenshots | `src/content/work/*.mdx` |
| About content and bilingual copy | `src/lib/site.ts`, `src/lib/i18n.ts` |
| About, case and return UI | `src/components/work/AboutOverlay.astro`, `CaseOverlay.astro`, `PanelBack.astro`, `about-panel.css`, `hall-panel.css` |
| Close-up / gallery / physical controls | `src/components/work/Closeup.tsx`, `CaseCaptures.tsx`, `closeup.css` |
| Navigation | `src/components/nav/GlassNav.tsx`, `site-nav.css` |
| Nucleo | `src/components/icons/Icon.tsx`, `nucleo-sources.json` |
| Models and reproducible generators | `public/models/`, `scripts/models/blender/` |
| Blue | `src/components/hall/blueCat.ts`; asset pipeline `scripts/models/blender/blue_rig.py` (skin) → `blue_animate.py` (clips, coat, export) → `blue_check.py` (pose renders, stretch report) |
| Release audit / regressions | `scripts/audit-build.mjs`, `scripts/qa/` |

The shared `window.__hall` handle is used by local diagnostics (`readyDone`, `blue`, stop/start etc.). Read current implementations before scripting mutations. Hall camera/panel frame measurements are interdependent: test both initial entry and subsequent internal navigation if touching either. CSS dimensions alone can cause a delayed second reframe.

## 5. How to work and verify

Node >=22.12; installed package stack: Astro 7.3.2, React 19.2.7, Three.js 0.181, Tailwind 4, TypeScript 5.9.3, Wrangler 4.112. PowerShell on Windows. Follow `AGENTS.md` and `CLAUDE.md` for Astro documentation and background server usage.

```powershell
$env:ASTRO_TELEMETRY_DISABLED='1'
npx astro dev --background
npx astro dev status
npx astro dev logs
npx astro dev stop

npm run typecheck
npm run test:review
npx astro build
npm run audit
git diff --check
```

Prefer **`npx astro build`** for targeted verification: `npm run build` invokes `prebuild` (`werkstatt-scan.mjs`) and may modify unrelated product data or trigger dev reloads. `npm run deploy` also runs that scanner and deploys the contact Worker; use targeted Pages upload for a site-only change. Do not run a build while measuring dev startup/navigation: shared Vite optimization can invalidate dependencies.

Retained runtime paths on this machine:

- Python: `C:/Users/denni/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe`
- Cutout Python packages: `.source-assets/python-cutout` (scripts add this to sys.path).
- Playwright: `C:/Users/denni/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs`
- Blender: `C:/Program Files/Blender Foundation/Blender 5.2/blender.exe`
- Firefox: `C:/Program Files/Mozilla Firefox/firefox.exe`
- Geckodriver: `.source-assets/firefox-qa/geckodriver.exe`

Some QA scripts hard-code these paths and localhost:4321; adapt deliberately on another machine. Chromium uses `--use-angle=d3d11`. Native Firefox tests support `GECKODRIVER`, `FIREFOX_BINARY` and, for the cube, `QA_BASE_URL`. Headless browser spawning or package reads may require host permissions; do not silently claim a passed test after an EPERM.

| Change / concern | Relevant test |
| --- | --- |
| Portrait, section presence, return navigation, responsive layout | `node scripts/qa/portrait-navigation.mjs` |
| Cat behavior, actual pointer/keyboard, reduced motion | `node scripts/qa/blue-cat.mjs` |
| Native Firefox cat | `node scripts/qa/blue-cat-firefox.mjs` |
| Cube rotation under stalls / startup | `node scripts/qa/loading-prism.mjs`, `node scripts/qa/loading-prism-firefox.mjs` |
| Lighting, station focus, mobile Lite | `node scripts/qa/hall-lighting.mjs` |
| Route preservation and panel timing | `hall-session.mjs`, `hall-route-cache.mjs`, `panel-smoothness.mjs`, `smooth-navigation.mjs` in `scripts/qa/` |
| Figure shimmer | `scripts/qa/figure-flicker.mjs` (read variant/configuration support first) |

Test scripts from older iterations may assert historical UI. Inspect before treating failures as current regressions; do not simply delete assertions to obtain green output.

### What has actually been checked

- Blue release: typecheck, all **27** regressions, build, **54-page** link/metadata audit, Chromium desktop/mobile/reduced motion, native Firefox interaction and cube regression.
- Blue v2: Blender pose renders and stretch report; typecheck; `scripts/qa/blue-cat.mjs` at 1440×900, 390×844 and reduced motion; 27 regressions; `npx astro build`; 54-page audit (home JS 1259.7 KB across 21 files); Playwright evidence for pointer gaze left/right, hover perk with pointer cursor, petting, a 300-frame walk at 60 fps with acceleration under 0.36 m/s², and the settle → sleep → wake cycle. Native Firefox was **not** rerun for v2.
- Latest hair correction: typecheck; visual enlarged cutouts; About navigation at **1440×900, 3789×1896, 390×844**; all four About sections; return button visibility/44px target; same persistent hall; no horizontal overflow or browser errors after dev-server restart.
- Final publication: fresh build and 54-page audit passed. About and English About returned 200 and referenced portrait v2. Homepage returned 200. Both portrait files and Blue GLB were downloaded for SHA-256 comparison and matched the tested local build byte for byte.
- Last build reported home reachable JS **1254.9 KB across 21 files**, CSS **174.7 KB across 2 files** (audit totals, not transfer-size or Core Web Vitals measurements). Large-chunk warning remains.
- Live asset/HTTP verification does not equal a new complete production browser QA sweep. The full browser checks above ran locally.

Retained visual/test evidence: `.source-assets/portrait-navigation-qa/`, `.source-assets/blue/qa/`, `.source-assets/firefox-qa/`, `.source-assets/hall-light-qa/`, `.source-assets/about-poster-qa/`. These are local ignored files, not guaranteed present on a fresh clone.

## 6. Remaining work and limitations — prioritize evidence

There is **no unfinished requested implementation** from the portrait/Blue release. The following are technical follow-ups and QA gaps, not permission to redesign the site.

1. **Investigate the recurring dev SSR “Invalid hook call” warning.** Still seen on requests; predates these changes. Production build and exercised browser routes pass, but root cause is not resolved. Do not declare harmless without investigating React resolution/hydration.
2. **Dev dependency-cache stability.** Portrait QA twice hit `504 Outdated Optimize Dep`; restarting the background Astro server made the full test pass. Keep this separate from a production defect; investigate reproducible causes instead of masking console errors.
3. **Physical-device coverage.** Real iPhone/Safari, Android, touch ergonomics, weak GPUs, thermal/battery behavior, DPR differences and Safari cube compositing were not signed off. Desktop headless responsive screenshots are not physical-phone performance evidence.
4. **Firefox/driver breadth.** Final cube compositor behavior is verified in native headless Firefox 155.0.1 on this machine. If Dennis reports another stall, capture actual cube rotation separately from expansion/brackets and confirm live build identity; do not repeat cosmetic rewrites based on computed transforms alone.
5. **Figure edge shimmer.** Several fixes reduced Dennis's white edge flicker, especially hair. No universal elimination across drivers/resolutions is proven. Inspect moving live frames if the user still sees it; preserve current accepted model and avoid excessive blur.
6. **Performance budget.** Large JS bundle warning remains. Profile before cutting features or changing animation timing. Room warm-up, GPU uploads and model loading need coverage on slower hardware. Keep Blue behind the existing startup gate.
7. **Blue v2 review.** Dennis has not yet judged v2 live. If he still finds it unclean, the remaining candidates are the faint eye-texel mip bleed on the resting cat (custom mip chain or a lower eye cap in `blue_animate.py`), the wrist stretch in the sphinx pose (weights, not clips), and the head/neck overlay weights. Rerun `scripts/qa/blue-cat-firefox.mjs` before claiming Firefox parity. Check feet/floor contact, route bounds, basket relation, happy-expression readability and the projected click target at new resolutions before changing behavior.
8. **Tattoo fidelity.** Current Dennis model was accepted “for now”; perfect anatomical/texture accuracy was not achieved or certified. Any future improvement should map the original photos and preserve corrected left/right/hand/forearm placements.
9. **External links/downloads.** Latest built-site audit covers local links and metadata. Do not infer it downloaded and executed the NEXUS installer or revalidated every external destination. Smoke-test changed destinations without installing software or submitting contact messages unnecessarily.
10. **Git main alignment.** Current source is on `feat/werkstatt`, production is a direct Pages deployment. Decide a proper main merge with current remote evidence if requested; GitHub Actions deploys pushes to main/master and runs `npm run build`, including its scanner.
11. **Reproducibility.** Some generator inputs, model masters and Python packages exist only in ignored local scratch. Before moving machines, back them up through a user-approved private channel; do not add private originals to the public site directory or bulk-commit them.

Older handover suggestions (copy wording, unused components, Nori fallback fields, close-up hash URLs, phone framing) are **unverified historical backlog**. Re-read current code and reproduce before acting. Reading mode removal, publication, About content, machine order and final cube implementation are already resolved and must not be reopened from stale notes.

## 7. Deployment and continuation

Latest successful release sequence (already completed):

```powershell
git push origin feat/werkstatt
npx astro build
npm run audit
npx wrangler pages deploy dist --project-name=dennis-portfolio --branch=main --commit-hash=4eb7b56 --commit-dirty=true
```

Blue v2 upload (2026-09-12): the agent's permission layer first blocked the upload; Dennis then asked explicitly to put it on the website and the sequence above ran. Verified afterwards: `/models/blue-rigged-v2.glb` (2,144,196 bytes) and the `Stage3D` chunk that loads it returned 200 with SHA-256 identical to the local `dist` on both `85fc5078.dennis-portfolio-87g.pages.dev` and `www.dennisbf.design`; the homepage returned 200. This is HTTP/asset verification, not a production browser QA sweep.

For the next application release, rebuild and audit the actual new commit, substitute its hash, inspect the working tree and upload only the intended build. The dirty flag was needed because of unrelated local Claude settings; it is not a reason to skip reviewing changes. Do not redeploy a stale `dist` directory or unnecessarily redeploy the contact Worker.

Do not confuse a successful git commit, remote push, Pages deployment, HTTP asset verification and full browser QA: report each accurately. Previous approval-review rejections for portrait publication were resolved by explicit user approval, followed by successful push/deploy. Do not carry that historical blocker forward.

Suggested first action for Claude Fable: read this document, inspect `git status` and current branch, open the live or local site, then address the user's next request. If asked for a further polish pass, start with the confirmed dev warning and real-device QA gaps above. Preserve existing art direction and verify visually before claiming improvements.

## 8. Supporting documentation index

- `HANDOVER-2026-09-10.md` — historical hall architecture and earlier decisions; superseded where noted.
- `docs/research/about-art-direction.md` — multi-agent/research directions.
- `docs/research/about-mockups/` — generated mockups and content/implementation plans.
- `docs/research/portrait-panel-polish.md` — earlier cutout/navigation revision; superseded portrait URLs and loader notes.
- `docs/research/loading-prism-polish.md` — older animation investigation; final authority is compositor report.
- `docs/research/loading-cube-compositor.md` — final native Firefox failure/fix and measured limits.
- `docs/research/hall-lighting-atmosphere.md`, `hall-lighting-implementation.md` — lighting research and implementation evidence.
- `docs/research/blue-cat.md` — identity, Meshy attempts, rig, behavior and QA.
- `scripts/models/AFTERIMAGE.md` — earlier machine/model production and dated QA.

Maintain this handover after substantial changes: record the actual application commit/deployment, user decisions, tests run, failures/limits and remaining work. Keep secrets out and distinguish historical evidence from current verification.
