# Room loading and arcade navigation

## Findings

The visible loading problems came from several independent parts of the experience. The scene could become visible before all its contents were ready. The About panel then changed its dimensions after the camera arrived. Navigation also depended on a fresh document and its styles being available, while texture and shader work could compete with interaction processing. Shortening one animation could not resolve all four mechanisms.

The implementation now uses a complete startup barrier, a small server-rendered circuit indicator, stable panel geometry, bounded preparation of likely destination pages, and selective background media work. The established dark room, approved figure and tattoo textures, project machines, physical controls and 6.8-second room-light sequence remain intact.

## What the measurements establish

The baseline was recorded against the local production preview at `http://localhost:4322/`, using Chromium with the D3D11 rendering option and a 1366 × 900 viewport. The same scripted route sequence covered About, the hall, Riftback and Lowlight. Frame samples, Astro lifecycle events, resource timings, Long Tasks and Long Animation Frames were recorded together. These are laboratory observations, not field Core Web Vitals.

The original warm local route swaps took 18–49 ms. That was already fairly quick and does not support a blanket claim that local network navigation was the main cause of the perceived delay. The About panel nevertheless changed from x=600/width=734 to x=612/width=722 after navigation. Its source contained a separate 350 ms left-position transition triggered after the camera settled. That second animation explains the visible resize independently of the document-fetch time.

Startup contained much larger interruptions. The baseline recorded tasks lasting approximately 1,986, 1,143, 567 and 479 ms. Several were attributed to the 3D animation loop as newly attached content first rendered. The initial readiness revision removed incomplete rendering, but its full-scene shader preparation created a single 3,632 ms task. That regression prompted a second change: bounded shader batches with yields between them, plus separate upload, compile and first-render timing markers.

An early post-change pass also revealed image-loader callbacks lasting roughly 62–69 ms just when the room finished opening. Loading all secondary screenshots at that moment competed with the first project interaction. Those extra screenshots are now requested only for the selected project, after camera movement has settled, with decoding, fitting and upload separated into queued work.

Interaction latency and document arrival are different measurements. Browser Event Timing separates input delay, handler processing and the delay until the next presented result. A click can receive a quick first visual response while the destination panel arrives much later. The report therefore keeps real-click Event Timing separate from route-swap and opaque-panel timings. [1]

## Why models appeared during loading

The previous constructor started the render loop while asset requests were still running. A `data-power="loading"` attribute deliberately made the canvas visible, and the lighting function applied dim ambient light and intermittent ignition strikes. The room looked dark, but it was not concealed. Newly inserted geometry could therefore become visible during a light pulse.

Readiness also counted only part of the scene. The tracked station radius was smaller than the visibility radius, and nested claw contents, some artwork, room textures, fonts and logo work were not all represented by the same barrier. The claw cabinet could arrive before the figure and prizes. A nine-second deadline called the readiness function without requiring the outstanding work to finish. That converted slow loading into permission to reveal an incomplete scene.

The new barrier combines Three's loading manager with explicit tasks for work outside that manager, including fonts, ordinary image-based logos and bitmap preparation. Three's LoadingManager tracks loader operations; it does not automatically understand application-specific assembly work. [2] The startup now proceeds through these states:

| State | Visible feedback | Required condition |
| --- | --- | --- |
| Assets | Top-left circuit indicator; 3D stage concealed | Models, nested contents, artwork, initial screens and required textures settle |
| GPU preparation | Indicator remains active; stage concealed | Texture uploads, shader preparation and a real pipeline warm-up frame finish |
| Ignition | Fully assembled room begins dark; circuit indicator settles and fades | A dark frame has replaced the concealed full-light warm-up frame |
| Ready | Normal hall | The existing lighting cue has completed, or reduced motion/direct entry bypasses the cinematic |
| Failure | Stable CSS hall fallback | A required asset fails or the startup deadline expires |

Elapsed time no longer grants readiness. The 30-second deadline selects a usable fallback instead of showing half a WebGL scene. Reduced-motion and direct project routes still wait for asset preparation, but do not require the full room-opening cinematic. Optional logo failure uses the existing text-card fallback; missing required models or managed textures selects the CSS hall.

The loading indicator is ordinary server-rendered markup, so it does not wait for React hydration or the Three.js chunk. Following visual feedback, the initial three strips were replaced with an original metallic prism: faces separate and reassemble, the prism turns continuously, surrounding fragments orbit, and a light sweep accents the cycle. It uses restrained champagne, lilac and cool gray, with transform and opacity animation. It is centered and enlarged, with a 320 ms fade as room ignition begins; verified at 320, 390, 1366 and 1920 px. No loading text is displayed, while an accessible status is supplied for assistive technology. Reduced motion keeps the emblem steady. The motion direction drew on the geometric assembly and timing of this [GameCube startup reference](https://makeagif.com/gif/nintendo-gamecube-startup-animation-eCnr3e), without reproducing the console logo.

## Rendering work moved out of the first visible frames

Loading a GLB or image is not the same as making it cheap to draw. Texture upload and shader preparation may still occur the first time the renderer uses the resource. Three documents `initTexture()` for preparing textures ahead of their first render, and `compileAsync()` for preparing shaders with the intended scene configuration. [3] MDN also identifies texture uploads as operations that can interrupt graphics pipelines. [4]

The implementation uploads startup textures in small batches, then prepares renderable batches against the final scene lighting and environment. Batching matters because an asynchronous completion API can still contain substantial synchronous setup or readiness-query work. The real compositor and reflection pipeline then draw while concealed. Only after that does the scene write its initial dark frame and reveal the canvas.

The batch-only intermediate build exposed a further mismatch: it prepared the canvas shader variants, while the main scene uses an offscreen compositor target. Inspection of the installed Three.js program parameters confirmed that those targets select different output color-space and tone-mapping variants. The corrected implementation prepares both required target configurations and warms the individual compositor passes. The intermediate trace recorded a 4,034 ms render warm-up; the final integrated trace recorded 134 ms. This is a single-host comparison, not a universal speedup estimate. Reflection throttling also now allows the initial dark frame to replace the bright concealed warm-up reflection immediately.

The original deferred-disposal protection remains: resources needed by an in-progress shader operation are not immediately destroyed when navigation removes the hall. Every resumed startup step checks whether the scene was disposed or failed. This prevents the earlier compilation/teardown race from returning.

During the light cue, the scene reuses a collected list of participating lights and materials instead of traversing the entire scene to rediscover them every frame. Material values are still restored after each temporary lighting application. The performance governor now evaluates actual frame intervals and responds to sustained frame times above 24 ms, rather than waiting until the scene was already near 30 frames per second. Existing quality tiers and recovery hysteresis are retained.

Secondary screenshots no longer start as an unrestricted batch after ignition. The queue is keyed by machine, leaves unselected projects idle, waits until the selected camera has settled, decodes images before canvas fitting, and separates fitting from texture upload. Work checks the selected machine and camera state again before proceeding. A navigation can therefore take priority without changing the first screenshot or removing gallery content.

## About panel geometry

The former layout had a feedback loop: CSS predicted a panel position, the camera moved, the scene projected the machine bounds, and the About script then moved the panel to those measured bounds. With a fixed right edge and automatic width, changing the left edge also changed the content width. Crossing a container-query breakpoint could rearrange its contents as well.

The new relationship is one-way. Responsive CSS defines the final panel rectangle, and the camera fits the remaining space. The late projected-machine listener and the 350 ms left transition have been removed. The initial desktop left edge uses `clamp(440px, 36vw, 760px)`; existing tablet, mobile and reading layouts remain supported. Before a route swap, camera prediction uses the destination layout instead of reading the outgoing page's panel.

This removes both the visible resizing and avoidable layout work. Position and size changes can require layout recalculation; transform and opacity animation can avoid that class of work when used appropriately. [5] The entrance keeps content visible and uses only a brief, small movement. Reduced motion removes that entrance movement.

A related reading-mode defect was also corrected. Resizing while reading could update the camera for the expanded reading panel, then closing reading mode left that frame behind. Normal reading-mode close now requests a reframe after restoring the regular layout. Navigation and gallery handoffs suppress that extra request because they choose their own destination frame.

## Navigation preparation

The installed Astro router fetches and parses the destination HTML, then waits for newly required stylesheets before the document swap. Its ordinary prefetch path prepares the HTML but does not necessarily remove the separate cold stylesheet dependency. Astro exposes navigation preparation lifecycle hooks for replacing or extending the loader. [6]

The new cache prepares only the focused station, its immediate neighbors and the hall return where relevant. It keeps at most six documents for 30 seconds, limits simultaneous speculation, and starts after the room's assets have priority. It accepts only same-origin HTML with the expected Astro metadata, rejects redirects and private/no-store responses, and warms the document's local compiled stylesheets. Development mode, offline state and data-saving/very slow connections avoid this speculation.

Navigation uses a cached document only when its preparation has already completed. An incomplete request, expired entry or cache miss leaves Astro's normal loader in place; the click never waits for speculative work to finish. Prepared documents are cloned so that swapping one navigation does not consume the cached DOM for later visits.

The existing native snapshot opt-out was inspected rather than duplicated. During hall navigation, the root and relevant descendants already have `view-transition-name: none`; the recorded computed values confirmed this. A long task attributed to the native transition callback is not sufficient evidence that snapshot capture alone caused it, because the callback also contains document-swap and associated work. The final changes therefore preserve the existing opt-out and target measured asset, layout and preparation costs.

## Validation and interpretation

Detailed results are recorded in `.source-assets/smoothness-2026-09-11/`. The startup checks deliberately delay a figure beyond the former nine-second readiness deadline, delay side artwork, deny a required model, exceed the current deadline, disable WebGL, enable reduced motion and navigate during preparation. Frame assertions check that the incomplete stage stays concealed. Navigation checks cover ordinary and prepared routes, German and English, browser history, rapid changes and stable About bounds.

Long Animation Frames help locate delayed rendering updates, including work that cannot be explained by a single event-handler duration. They complement, rather than replace, interaction and resource timing. [7]

### Integrated results

The final production build completed at 18:55 on 11 September. `verified-1366.json` is the final integrated trace; the earlier file named `final-1366.json` is an intermediate build and must not be mistaken for the finished result.

| Check | Observed result |
| --- | --- |
| Seven local route swaps | 12–39 ms; first About 39 ms, repeat About 15 ms |
| About geometry during navigation | One sampled rectangle, x≈492 and width≈842; no late resize |
| Concealed GPU preparation | 521 ms upload, 4,616 ms total yielded shader preparation, 134 ms render warm-up |
| Startup readiness | 7,790 ms from scene startup in this cold trace; all 151 managed requests settled and explicit pending tasks at zero |
| Controlled cold versus prepared navigation | With 450 ms latency and 250 KB/s download, document swap 1,482 ms versus 22 ms; opaque panel 1,493 ms versus 24 ms |
| Real-click Event Timing in that comparison | 48 ms cold, 72 ms prepared; distinct from full-panel arrival and not a field INP result |
| Startup stress matrix | All nine cases passed; zero incomplete visible frames or uncaught page errors |
| Responsive panel and reading-mode checks | 13/13 passed across desktop, phone and landscape; stable frame restoration and no overflow |
| Final built visual and arcade regression checks | About and Lowlight at 390 and 1366 px passed with no page overflow, broken images or browser errors; Lowlight controls, six-image gallery, fullscreen, directory and DE/EN redirects passed |
| Automated code/build checks | TypeScript passed, 23/23 regression tests passed, 53 built pages passed links/metadata audit |

The startup matrix includes normal loading, a figure delayed by 12 seconds, delayed cabinet art, reduced motion, early About navigation, navigation away during GPU preparation, unavailable WebGL, a failed required figure and the 30-second fallback deadline. Delayed assets remained concealed rather than being revealed on a timer. The route-cache checks also passed German/English navigation, browser back/forward, language reload, rapid navigation cancellation and ordinary uncached routes.

Final screenshots were visually inspected for the concealed loading state, room ignition, phone About layout and phone Lowlight layout. The mobile screenshot strip intentionally scrolls horizontally: its later thumbnails were outside the viewport, while the document itself had zero horizontal overflow. Artifacts are in `smoothness-2026-09-11/` and the `smoothness-final-*` and `lowlight-controls-*` files under `polish-2026-09-11/`, both within `.source-assets/`.

The final trace still contains a 1,383 ms initial construction task while concealed, plus occasional interaction-frame gaps of 50–83 ms. The result therefore does not establish locked 60 fps or eliminate every possible hitch. It does establish that the measured multi-second first-render interruption was moved into explicit preparation, the panel sizing defect was removed, and prepared destinations can arrive without the cold document dependency. Asset weight and scene-construction work remain the next performance opportunities if further loading-time reduction is needed.

The remaining limits are explicit: Chromium and emulated viewport/touch conditions are not physical iPhone/Safari tests; the local preview does not reproduce production network caching exactly; a cold GPU driver can still require significant concealed preparation; and no finite test proves perfect smoothness on every device. The room's deliberate 6.8-second light cue is a design duration, not a claim that asset downloading takes 6.8 seconds. No deployment or real contact-form submission is part of this change.

## Sources

1. Google, [Optimize Interaction to Next Paint](https://web.dev/articles/optimize-inp). Interaction decomposition and the distinction between input, processing and presentation delays.
2. Three.js, [LoadingManager](https://threejs.org/docs/pages/LoadingManager.html). Loader operation tracking and completion/error callbacks.
3. Three.js, [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html). Texture initialization, compilation and target-scene preparation.
4. MDN, [WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices). Texture upload and graphics-pipeline behavior.
5. Google, [Avoid large, complex layouts and layout thrashing](https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing). Layout work associated with geometry changes.
6. Astro, [View transitions](https://docs.astro.build/en/guides/view-transitions/), [Router API](https://docs.astro.build/en/reference/modules/astro-transitions/) and [Prefetch](https://docs.astro.build/en/guides/prefetch/). Installed router and prefetch source were also inspected for the behavior of this project's version.
7. Chrome for Developers, [Long Animation Frames API](https://developer.chrome.com/docs/web-platform/long-animation-frames). Rendering-update attribution and the limitations of long-task-only measurement.

Repository evidence: `Hall.tsx`, `HallGuard.astro`, `hallScene.ts`, `roomPower.mjs`, `hall-loading.css`, `AboutOverlay.astro`, `hall-panel.css`, `ReadingMode.astro`, `hall-route-cache.ts`, the installed Astro/Three.js sources, and the baseline/intermediate/final JSON traces. Official sources were consulted on 11 September 2026.

