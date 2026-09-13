# Site-wide performance and QA pass — analysis and checklist

Dennis, 2026-09-13: "Do a complete performance pass of the whole website. Check every link, every transition, every state, multiple agents. Fix bugs, try to make it run as good as possible. Before you do that analyse and make a checklist. THEN do it."

This is the analysis and the checklist. Nothing below has been executed yet; execution starts on Dennis's go. Items marked **[ask]** change something he may want to veto (deleting files, CI gating, dependencies); everything else is a straightforward fix or a measurement.

## What the site is (from a read of the code, 2026-09-13)

- Astro 7, static output, React islands, three.js 0.181, Tailwind 4, `motion` 12. 13 source pages → 54 built pages (28 DE + 26 EN, the EN tree is cloned after the build by `scripts/en-routes.mjs`) plus `404.html`. Redirects in `astro.config.mjs`, `public/_redirects` and an apex→www 308 in `functions/_middleware.js`.
- The 3D hall (`src/components/hall/hallScene.ts`, 3,079 lines; `Hall.tsx`, 1,273 lines) is one persistent island shared by `/`, `/work/<slug>/`, `/about/`, `/contact/`, `/arcade/<id>/`. `hall-session.ts` parks it when navigating to a hall-less page and skips the native view transition whenever the hall is involved; `hall-route-cache.ts` prefetches up to six hall documents and their stylesheets.
- Rendering already has the right shape: Meshopt for every GLB, texture caps at 1024 px, `compileAsync` and warm-up before ready, a 60 fps cap, dirty-flag rendering outside the hall pose, a half-resolution bloom, a reflector that only re-renders on camera change, adaptive quality (bloom and mirror off above 24 ms, then pixel ratio ×0.7), lite mode on phones and ≤4-core machines, deferred slide decoding for the focused station only.
- Pose state machine: `hall` → `zoom` → `play`, plus `screen` for the close-up; keyboard (arrows, a/d, Home/End, Enter, r, Esc), wheel, touch, gamepad; reduced motion applied after mount; WebGL missing or a 30 s startup timeout falls back to a CSS row; context loss does the same.
- `public/` is about 100 MB (media 63, models 16, lowlight 11, textures 10). Images are hand-generated `.webp`/`.avif`/`@2x`/`@sm` siblings, not `astro:assets`. Fonts ship through fontsource and are preloaded.
- QA: 8 offline `node --test` files (`npm run test:review`), about 32 Playwright scripts that need a server, `scripts/audit-build.mjs` (h1, canonical, hreflang, local links, sitemap), Blue's asset guard. No Lighthouse or Core Web Vitals tooling. CI only runs `npm run build`.

## Findings before measuring anything

Concrete things the inventory turned up. Each is a checklist item below.

1. **Two landing-page scripts load on every page.** `HallSession.astro` puts `/lowlight/main.js` and `/nexus/main.js` (`is:inline defer`) into the shared layout head; only `lowlight.astro` and `nexus.astro` need them. Two wasted requests and parses on 52 pages.
2. **No cache headers for `/models/*` and `/textures/*`.** 16 MB of GLBs and 10 MB of textures get the Pages default while `/fonts/*` (an empty folder) has an immutable rule. `/media/*` has one day + stale-while-revalidate.
3. **Orphan assets shipped in `public/`** (never fetched by the runtime): the 16 legacy cabinet-art files directly in `textures/cabinet-art/` (7.5 MB; the runtime loads `quiet-v2/`), Blue `v1`, `v2`, `v4`, `v5` GLBs and the v4/v5 closed atlases (about 7.5 MB), `hall-environment.bin.gz` (0.9 MB; the runtime loads `-v2`), `mach-nocturne.glb`, `cabinet-proto.glb`, `cash-register.glb`, `models/kenney/*`. They cost nothing at runtime but bloat every deploy and the audit. **[ask]** The old Blue files were kept as a rollback path; git history keeps them anyway.
4. **Gamepad polling runs a `requestAnimationFrame` loop even with no gamepad connected** (`Hall.tsx` ≈ 834–897). Cheap per frame but permanent.
5. **TV static calls `Math.random()` per frame and moves a texture offset**, which forces a render every frame while `staticMix > 0.02` and defeats the dirty flag (`hallScene.ts` ≈ 2836–2840).
6. **Preloaded stylesheets not used within a few seconds** on the live site (seen in every live recording: `_..FSf0Btdu.css`, `PanelBack…css`, `about…css`). Almost certainly the route cache's speculative `<link rel="preload">`; harmless for users, but it is console noise and a hint that the preload `as`/timing is off.
7. **Home JS: 1.33 MB across 21 files** (`audit-build.mjs`). Three.js core, EffectComposer + UnrealBloom, GLTFLoader, the Meshopt decoder, React 19, `motion` 12. Which of these are needed for first paint, and whether `motion` and non-hall islands can load later, is a measurement question.
8. **Dead code**: `IDLE_MS`/`armIdle()`/`idleTimer` in `Hall.tsx` (attract mode no longer arms), a `@deprecated` export in `src/lib/content-store.ts`, duplicate `AvailabilityStatus.astro` / `.tsx`, an unreachable `kiosk` entry in `MODELS`, EN metadata for the archived `work/angry/` and `work/ashwake/` in `en-routes.mjs`.
9. **CI gates nothing.** `.github/workflows/deploy.yml` runs `npm run build` only; `npm run check` (typecheck + review tests + build + audit) exists but is not used. **[ask]**
10. **Playwright is imported by a machine-local absolute path** in about 30 QA scripts (`file:///C:/Users/denni/.cache/codex-runtimes/…`), and `playwright`, `meshoptimizer`, `@gltf-transform/core` and `@gltf-transform/functions` are used but not declared in `package.json`. The QA suite only runs on this machine. **[ask]** (adds devDependencies)
11. Not a bug after checking: `blueCat.ts` mentions `blue-v5-closed.webp` only in a comment; the closed atlas is loaded from the coat material's version (`blue-v6-closed.webp` live, verified by checksum).

## Checklist

### A. Baseline (measure first, touch nothing)
- [ ] A1 Real-GPU frame measurements (Chromium `--use-angle=d3d11`, never SwiftShader) at 1440×900 DPR 1 and 2, and 390×844: fps, render CPU ms, GPU timer queries, rAF gaps > 50 ms, long tasks, for hall idle, station change, zoom + close-up, About open/close, back to hall, project panel open/close, language switch, cat asleep vs walking. Reuse the `measure.mjs` / `tick-probe.mjs` / `gl-probe.mjs` pattern from the September 10 audit (ported to Playwright).
- [ ] A2 Chrome trace per transition (`trace.mjs` pattern): attribute every hitch to decode, shader build, layout, React commit or GC.
- [ ] A3 Cold-load waterfall for `/`, a project page, `/about/`, `/en/`: bytes by type, largest requests, time to `finishReady` (the `container.dataset.*` startup probes), what is preloaded but unused, what blocks first paint.
- [ ] A4 Core Web Vitals per page type (LCP, CLS, INP, TBT) via Lighthouse in headless Chromium, mobile and desktop, for `/`, `/work/`, one project page, `/about/`, `/contact/`, `/lab/`, `/impressum/`, `/404`, and their EN twins.
- [ ] A5 Memory: JS heap and `renderer.info.memory` after five minutes idle and after cycling every station twice (leaks, undisposed textures/geometries).
- [ ] A6 Phone-class profile: 4× CPU throttling + lite mode, same transitions as A1.

### B. Links, routes, SEO, i18n
- [ ] B1 Crawl `dist/` and the live site: every internal `href`/`src` resolves (200, no redirect chains), trailing-slash and uppercase variants, `_redirects` and the apex 308, `404.html` served for unknown paths.
- [ ] B2 Language pairs: every DE page has its EN twin and vice versa, hreflang pairs point at each other, canonical correct, the language switch lands on the equivalent page (not the home page), `lowlight`/`nexus` whitelist still valid.
- [ ] B3 External links: HEAD 2xx, `rel="noopener"`, no mixed content, download links (the 9.7 MB Lowlight installer) have size hints.
- [ ] B4 Sitemap and robots: every listed URL resolves, no orphan pages missing from the sitemap, no archived slugs (`angry`, `ashwake`) leaking through `en-routes.mjs`.
- [ ] B5 Keyboard and focus: Tab order through nav, dock rail, panels and lightbox; focus visible; focus returns after a panel closes; Esc semantics consistent across zoom, close-up, lightbox.
- [ ] B6 `<img>` width/height everywhere (CLS), lazy loading below the fold, `.avif`/`.webp` fallbacks actually served.

### C. Transitions and states of the hall
- [ ] C1 Entry: loader prism → ready → first frame; no pop-in; the cat present before the room lights (existing rule); startup fallback after 30 s and with WebGL disabled.
- [ ] C2 Station change forward/back, fast repeated presses, wheel and touch scrubbing, Home/End, dock rail jumps, "Alle Projekte" and back; no restarted tweens, no double renders.
- [ ] C3 Zoom and close-up: enter, leave, enter another station while a tween runs, browser back/forward, reload while zoomed, fullscreen and Esc.
- [ ] C4 About: open, perch, ledge petting, close, reopen; EN variant; contact panel the same.
- [ ] C5 Panels: open/close, PanelBack, scrolling inside, links inside, the tall detent; no layout shift of the free viewport rect on resize.
- [ ] C6 Visibility and resize: tab hidden/shown (clocks resume sanely, no catch-up burst), resize across the 760 px and 1204/1222 px breakpoints, orientation change, DPR change, context loss → CSS row.
- [ ] C7 Reduced motion: every transition reaches its end state, the cat snaps, no animation loops, the deferred screen decode still happens.
- [ ] C8 Failure states: a model 404, throttled 3G, offline after load, a CSP-blocked resource: the page stays usable and the console explains it.
- [ ] C9 Mobile/compact: 390×844 and 768×1024, touch targets ≥ 44 px, safe areas, no horizontal scroll, cat and bed placement, the CSS row when WebGL is off.
- [ ] C10 Gamepad: only polled when connected (finding 4).

### D. Runtime performance (three.js)
- [ ] D1 Per-frame allocations in `tick`, `blue.update`, gaze, springs (hot-path `new Vector3` etc.).
- [ ] D2 `renderer.info` per pose: draw calls, triangles, textures; find anything rendered off-screen or twice.
- [ ] D3 TV static without per-frame randomness (shader time uniform or a low-rate offset), so the dirty flag holds (finding 5).
- [ ] D4 Shader warm-up coverage: no first-sight compile when the closed-eye atlas swaps, a panel opens, or bloom toggles with the perf level.
- [ ] D5 Texture budget: every texture ≤ display need, mipmaps and anisotropy sane, KTX2/Basis worth it for the cabinet art and the cat atlas (decode cost vs bytes).
- [ ] D6 Disposal on leaving close-up/About/arcade; listeners removed; the route cache bounded.
- [ ] D7 Adaptive quality: does it recover, does it thrash on a borderline machine, is the lite threshold right.

### E. Delivery
- [ ] E1 Split the two landing scripts out of the shared layout (finding 1).
- [ ] E2 Cache headers for `/models/*` and `/textures/*`; version query strings where files can change (finding 2).
- [ ] E3 Bundle analysis of the home route: what each of the 21 files is, what is needed before ready, lazy-load `motion` and non-hall islands, check three.js tree-shaking, drop unused examples (finding 7).
- [ ] E4 Preload hygiene: the unused-preload warnings (finding 6), `fetchpriority` on the first models, fonts `font-display`.
- [ ] E5 Remove orphan assets from `public/` (finding 3) **[ask]**.
- [ ] E6 CSP: hashes in place of `'unsafe-inline'` where the build already hashes; no blocked resource on any page; `wasm-unsafe-eval` present.
- [ ] E7 Build: warnings from `astro build`, the audit script extended with a byte budget per route.

### F. Housekeeping and gates
- [ ] F1 Dead code from finding 8.
- [ ] F2 QA portability: `playwright`, `meshoptimizer`, `@gltf-transform/*` as devDependencies, scripts import them normally **[ask]**.
- [ ] F3 CI: run `npm run check` before deploy **[ask]**.
- [ ] F4 Every fix re-verified by the full gate: typecheck, `test:review`, Blue regressions (turn, cat, companion), build, audit, then a deploy and a headless live load with console capture on both hosts.

## Execution plan (multiple agents, after the go)

| Agent | Job | Deliverable |
| --- | --- | --- |
| A — Links & SEO | B1–B4, B6 on `dist/` and live | table of every broken/odd link, redirect chain, hreflang mismatch, missing dimension |
| B — Hall states | C1–C9 with Playwright on a real GPU, evidence strips per transition | per-transition report with frame strips and the numbers from the startup probes |
| C — Runtime profiling | A1, A2, A5, A6, D1–D7 | ranked list of hitches with cause and a proposed fix, each with the measurement that proves it |
| D — Delivery | A3, A4, E1–E7 | bundle map, waterfall, CWV table, proposed header/preload/bundle changes |
| Me | triage the four reports, make the fixes in the codebase in priority order, run the gate (F4), deploy, verify live, record everything in `docs/research/` and the handovers | one release per batch, never a fix without its measurement |

Rules for the pass: nothing writes into the project (not even `docs/`) while a Playwright run is active against the dev server; measurements on the real GPU only; no copy changes without Dennis; a fix without a before/after number is not a fix.

Order: A1–A6 baseline first (about an hour of machine time), agents A–D in parallel, then fixes in the order: bugs → per-frame waste → delivery → housekeeping, each batch through the gate and a deploy.

Decisions for Dennis before the go: E5 (delete the orphan files, including the old Blue rollback GLBs), F2 (devDependencies), F3 (CI gate), and whether a Lighthouse score target matters or only the felt smoothness.

## Execution record (2026-09-13, after the go)

Four agents measured an unmodified checkout (`dennis-portfolio-measure`, dev on 4323 with `window.__hall`, preview on 4324) while the fixes went into the main checkout; their reports and raw data are in the session scratchpad under `pass/A..D/` and copied to `.source-assets/qa/performance-pass-2026-09-13/`.

### What the agents found (short)

- **Links / SEO / i18n (A):** 9,169 internal references on 55 pages, 422 of 423 targets resolve; all 50 DE/EN pairs, hreflang, canonicals, sitemap and robots correct. Defects: Cloudflare's e-mail obfuscation rewrote the contact and About `mailto` links and the decoder only ran on hard loads under the ClientRouter, so the primary contact link was dead after any in-site navigation; slash-less legacy URLs (`/work/ashwake`, `/work/ceiling`, `/work/nocturne` and EN) 404ed; the nocturne redirect was declared twice; EN `/work/riftback/` carried the German description; the 404 page had a redirecting canonical and no `noindex`; nexus lacked og tags; case covers had no og:image dimensions; adjacent-case thumbs no width/height; 76 unreferenced media files; `rel="noreferrer"` without `noopener`.
- **Hall states (B):** every transition and state reached its end state (station change, zoom, close-up, back/forward, reload while zoomed, About with the cat, panels, visibility, resize, reduced motion, model 404, no WebGL, compact). Anomalies: the first visit spends 9–11 s compiling shaders behind the loader; offline, opening a station destroyed the hall (full navigation onto Chrome's error page); the cat on the About ledge was cut by the nav bar at all three viewports; taps shortly after a swipe were swallowed (browser fling handling plus the app's 500 ms window); the dot-link targets were 6×6 px; after `End` the cat walks 33 m to the phone (by design, no teleporting); the CSS fallback is the heaviest moment (16 machines with images hydrating).
- **Runtime (C):** steady state healthy (hall idle 2–3 ms CPU, 4 ms GPU, 212 draw calls, 61 programs, no heap growth over 5 minutes and full station cycling). Causes ranked: the calm cat kept the floor reflection re-rendering 16 times a second; the hall pose renders every gated tick; the quality ladder judged the interval between *rendered* ticks, quantised to the gate on 144 Hz panels (never recovers) and above the degrade threshold on 75 Hz panels; the taxi's transparent double-sided glass re-resolved its program twice a frame; the cat's pet button wrote styles and read layout every frame; zoom-in uploads/decodes 60–80 ms on the main thread (300 ms at 4× CPU throttle).
- **Delivery (D):** time to a visible hall 11.4 s local / 16.9 s live fast / 24.6 s live 4G, of which shader compile 8.8 s constant; 16 MB per cold hall load (8.3 MB images, 7.2 MB models); the hidden CSS fallback row fetched all 73 thumbnails on 3D clients (4.3 MB, competing with the models); `/models/*` uncached at the edge (`max-age=0`, DYNAMIC); no modulepreload for the 5-hop chain to the three.js bundle; three lowlight captures loaded full-size (430–455 KB each); the route cache's stylesheet preloads warned on every hall page; CLS 0 everywhere, CSP hashes in place, 0 console errors on 12 page types; Lighthouse on hall pages meaningless for LCP (its trace ends before the hall reveals).

### What was changed (three batches, each through typecheck, review tests, build and audit)

1. Housekeeping (`ca4f9c8`): landing scripts scoped to their pages; `Cache-Control` for `/models/*` and `/textures/*`; gamepad polling only with a pad; TV snow at 25 Hz; dead idle-timer code; ~15 MB of orphaned assets removed; QA deps declared, scripts import `playwright`; CI runs `npm run check`.
2. Crawl findings (`bef50c3`): `<!--email_off-->` around the mail links; exact slash-less redirects; single nocturne redirect; EN riftback description from the case's `summaryEn`; 404 `noindex`; og:image sizes from the real files (sharp at build); nexus og tags; adjacent-thumb sizes; case logo via avif; `@sm.avif` no longer generated; dead media removed; `noopener`.
3. Startup and runtime (this commit): shader compile only for the render path in use (composer at perfLevel 2), the other variant set compiled in small batches before the ladder switches paths; the fallback row leaves the render tree while WebGL is pending and its images are lazy; modulepreload links for the hall chain on every page that mounts it (build hook); `@sm` thumbnails for the lowlight screens and the case covers, cards serve a 720 px source with `srcset`/`sizes`; route-cache stylesheets prefetched instead of preloaded; About frame with headroom for the cat; offline navigation guarded; post-swipe tap window 280 ms; dot-link hit areas 44 px tall; calm-cat mirror cadence 350 ms; quality ladder on the real rAF interval and the frame's CPU cost; single-pass transparent double-sided materials; pet-button DOM writes deduplicated and layout reads cached.

### Measured on the same probe (dev server, 1440×900, cold, real GPU)

| | before | after |
| --- | --- | --- |
| ready after navigation | 10.9 s | 6.4 s |
| shader compile | 8.4 s | 4.1 s |
| programs compiled before reveal | 61 | 35 |
| `/media/` image requests before ready | 80 | 28 |
| requests before ready | 292 | 238 |

The About cat clears the nav at 1440×900, 768×1024 and 390×844 (pet-button top 221 / 117 / 117 px, nav bottom 56).

### Left open (with reasons)

Hall pose still renders every gated tick (the room is meant to look alive; the saving is battery, not smoothness); zoom-in upload burst (60–80 ms) and the About panel's first-paint raster (140 ms GPU) need a decode/upload scheduler and are worth a round of their own; station-change slide pipeline (per-slide canvas + DataTexture) likewise; the compact raycast per pointer move (6 ms) only matters with a mouse on a phone-width window; splitting the hall CSS out of the base sheet and code-splitting the three.js bundle for lite clients are larger refactors; the far-station walk after `End` is by design (Dennis: no teleporting); the loading overlay gives no progress on slow networks (copy and UI are Dennis's call); Meshopt is already on every GLB.
