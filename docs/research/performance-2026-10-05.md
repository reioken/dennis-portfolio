# Performance check — 2026-10-05

Trigger: a friend of Dennis's reported that the site lags a lot. Subject: production `15a5136` (Pages `07fc6db3`),
https://www.dennisbf.design. The study below was read-only; the fixes that followed are recorded at the end
("Implemented"), released as `e6b91f9` / Pages `ed7da1ba`.

## Method

- `scripts/qa/live/perf.mjs` (new): headless Chromium with the real GPU via ANGLE D3D11. Desktop flow: cold load,
  8 s hall idle, 6 s pointer parallax, station navigation (4× right, 2× left), Enter, case idle, Escape. Phone flow
  (390×844 @3, touch): load, scroll the exhibition, the first project exhibit, tap, viewer idle.
- Two GPUs on this PC: the RTX 5090, and the CPU's integrated AMD Radeon (selected with `--use-adapter-luid`; the LUID
  comes from `chrome://gpu` and changes on reboot). The integrated GPU stands in for laptop/office graphics. It is a
  proxy, not a measurement of the friend's device.
- CPU throttling (`--cpu=4`) stands in for slower laptop/phone CPUs. Phone runs are Chromium emulation, not a phone.
- Main metric: how often the hall's own WebGL context actually drew (`renderFps`, gaps between its frames). The
  headless display here runs at 240 Hz, so page-level fps is not meaningful. Long tasks and long-animation-frame
  entries give main-thread attribution; WebGL timer queries (`--gpuTimer`) give GPU ms per frame.
- A/B tests in the test browser only: `--block=marquee` aborts the console GLB, `--shader=noarea` rewrites
  `NUM_RECT_AREA_LIGHTS` to 0 in every three.js program, `--css=nobackdrop` removes all backdrop blur.
- Results JSON: session scratchpad `perf/out/` (not in the repo).

## Results

### Desktop, strong PC (RTX, 1920×1080)

Hall steady at 60 fps in every phase. The console draws about 21 fps idle and about 104 fps while its keys move
(no frame cap; it follows the panel rate). The longest load task is still 1.3 s (see the console below).

### Desktop, integrated GPU (1920×1080)

| Phase | Hall frames/s | Worst gap |
| --- | --- | --- |
| Idle, full quality (first ~13 s after the reveal) | 14.5 | 117 ms |
| Pointer parallax, after the ladder stepped down | 21.4 | 125 ms |
| Station navigation, lowest level | 22.8 | 208 ms |
| Same, console GLB blocked | 31.2 / 28.9 | 71 / 138 ms |

- The quality ladder starts at full quality (composer with 4× MSAA half-float target, bloom, floor mirror) and
  judges 90-frame windows. At 14 fps a window is about 6 s. The first step came about 13.5 s after the reveal, and
  the second about 19 s after it.
- GPU time at full quality: hall about 34 ms per frame, console about 4 ms. Without the 7 RectAreaLights the hall
  needs about 24 ms (−10 ms). At the lowest level the area lights made no measurable difference. There the moving
  camera dominates: pointer parallax and navigation re-render the floor reflection, which roughly doubles draw calls
  (about 160 → 300 per frame).
- Backdrop blur removed: no consistent change.

### Desktop, slow CPU (RTX, CPU ×4)

- Load: 17 long tasks, 6.3 s in total. The largest are hydration (one 2.7 s task, `client.js`), the console's first
  frame (1.34 s, `dock-hardware`) and the Hall module/scene construction (0.61 s).
- Hall: 49 fps idle, 19.7 fps with pointer parallax, 12 fps while navigating. Per frame, `tick` takes 55–150 ms. The
  hall keydown handler takes 45–50 ms, of which 27–31 ms is forced style/layout.
- The ladder still lowered the resolution, although the CPU was the limit. That costs sharpness and gains nothing.

### Load (all desktop runs)

- First visit (fresh profile, cache on): 14.95 MB in 194 requests: models 9.0, textures 3.8, media 1.2, JS 0.5 MB.
  `data-ready-ms` was 5.9–6.8 s. The hall was revealed 7.6–8.6 s after navigation on this machine and line, and the
  6.8 s ignition followed.
- In every run at normal CPU speed, the worst main-thread stall is the console's first frame: 1.1–1.5 s. The
  synchronous shader compile covers MeshPhysical iridescence/clearcoat, PCF soft shadows and point lights. Next
  come hydration (0.5–0.6 s) and the Hall module (0.5 s).
- Code reading, not measured: `hallScene` registers the console GLB with its loading manager, so a slow console
  download holds back the room's readiness.

### Phone (390×844 @3)

- Fast phone (RTX, CPU ×1): no long task over 150 ms. A scroll session with one opened cabinet transfers 9.25 MB in
  126 requests. Of that, the claw exhibit is about 2.7 MB of models (figure 1.37 MB, claw, two plush piles).
- Mid-range proxy (integrated GPU, CPU ×4): scrolling produced 20 long tasks, 4.1 s in total. Every newly prepared
  exhibit blocks for 0.8–0.9 s (`mobile-arcade-viewer` → `new HallScene`). One short session created five WebGL
  renderers, because every exhibit builds a new renderer and room, decodes and uploads the environment map again
  (the HTTP cache prevents only the re-download) and compiles its shaders again. The claw exhibit draws about 24 fps
  against its 30 fps target.

## What to optimise, by measured effect

1. **Navigation console** (desktop; the largest single item, added October 4–5). Compile its materials with
   `compileAsync` before the first frame, which removes the 1.1–1.5 s stall. Cap it at 30 fps while keys move, and
   draw the idle CRT less often or only on change. Limit the pixel ratio to 1.5 (now 2). Do not re-render the
   1024² PCF soft shadow map on every moving frame. Reuse the hall's environment map. Decouple hall readiness from
   the console GLB. Optional, larger: draw the console with the hall's renderer instead of a second WebGL context.
   No visible change intended.
2. **Quality ladder**. Choose the starting level from the warm-up frames the loader already renders, and judge
   windows of 1–2 s instead of about 6 s. Distinguish CPU-bound from GPU-bound: lower resolution only when the GPU
   is the limit. On lower levels, update the floor reflection at most about 10 times a second while the camera
   moves, cap the area lights (for example the focused station's two only) and turn off canvas MSAA when the composer
   draws. Full quality on strong machines is unchanged.
3. **Main-thread work per frame and per key** (slow CPUs). Merge static room meshes and let the reflection pass draw
   only nearby objects. Remove the forced layout from the hall keydown path. Split hydration and scene construction
   into yielding chunks.
4. **Phone exhibition**. Keep one renderer, room and decoded environment map for the whole exhibition and swap only
   the cabinet. This removes the 0.8–0.9 s scroll stalls on mid-range phones and the repeated decode, upload and
   compile. No visible change intended.
5. **Payload** (larger, needs Dennis's word). GPU-compressed textures (KTX2) cut decode, upload stalls and GPU
   memory. Loading the nearby stations first is possible only for stations that are off-screen, because of his
   no-pop-in rule.

Small item seen in passing: on every station change the console title is drawn with canvas `shadowBlur` on a
1536×384 canvas (`dock-screen.ts`). The September audit found that pattern costly on large canvases.

## Not established

The friend's device and browser are unknown. Integrated-GPU and CPU-throttle runs are proxies. No physical phone
or laptop was measured, and Safari/iOS was not tested.

## Implemented, 2026-10-05 — released as `e6b91f9` / Pages `ed7da1ba`

Committed and released on Dennis's word. A preview deployment with the real headers and CSP passed first.
Live, all 55 JS/CSS assets and the console model match the build byte for byte, and the flow check passed
16/16. See the handover's performance release section.

Dennis: „Mach alles davon. 3d navi kann auch etwas kleiner gemacht werden.“ Profiling during the work moved some
fixes from the list above to their measured causes.

**Navigation console** (`dock-hardware.ts`, `dock-hardware.css`, `dock-screen.ts`)
- Programs build with `compileAsync` before the first frame; the console stays hidden until they are ready.
- At most 60 fps while keys or the CRT transition move; the idle phosphor runs at 12 fps (was 24).
- Pixel ratio at most 1.5 (was 2), like the hall. `checkShaderErrors` only in development.
- Key shadows refresh at most ten times a second while moving, and once at rest.
- The 18 printed surfaces repaint only when their text changes. `data-lighting` is written only on change: its
  write every frame restyled the page twelve times a second, which the hall loop paid for as a forced style recalc.
- The hero environment is inflated once for console and hall.
- Smaller, as Dennis asked: `width: max(720px, min(100% − 48px, 960px, 107.5vh))`, before up to 1160 px. Sizes:
  960×223 at 1920×1080 (was 1160×270), 826×192 at 1366×768, 753×175 at 900×700. Every station key stays at least
  47×44 px. The hall frames itself above the console's top edge, so the room gains that space.
- When the console is ready it sends `hall:reframe`, and `Hall.tsx` also re-measures when the scene registers.
  In the production build the console often finished after the boot measurement but before the scene existed. The
  dock observer skips that case, so the camera framed the room above the console's pre-ready layout, 50–100 px too
  low. This race existed before; the later ready state made it frequent.

**Hall frame loop and quality** (`hallScene.ts`, `floorReflectionShader.ts`, `hallLighting.ts`)
- The floor reflection is captured before the frame's render call, not nested in it. The nested render had its
  own light state, so three re-resolved every lit material's program and uniforms twice per frame. Main-thread
  time in `renderFrame` per 5 s of pointer parallax: 1209 → 611 ms. Floor pixels unchanged (mean difference 0.03/255).
- Every quality level draws through the composer, so changing level needs no compile and no render-path switch
  (`ensureCompiled` is gone). Level 1 turns bloom off, captures the floor reflection at half size, and lets wall
  and floor take the same seven lamps through a cheap approximation (`CHEAP_AREA_LIGHT`: the irradiance of a disc
  of the rectangle's area, Lambert plus one GGX lobe) instead of two LTC integrations per lamp. The cabinets keep
  the exact lights. The exact loop sits behind a uniform branch in three's `lights_fragment_begin`: at 1 the output
  equals the stock chunk, at 0 it measured as fast as compiling the loop out. The two fade over half a second.
  Level 0 adds a 0.7× pixel ratio.
- Measured on the integrated GPU, per knob: area lights on wall and floor were the cost (L1 15→29 fps without
  them); bloom and the reflection were not. Dropping them outright left the wall nearly black, so it was not shipped.
  The approximation reaches 85–100 % of the exact brightness on wall and floor (RTX, same view) and costs about 15 %
  of the gain; the half-size reflection gives back 5–9 % while the camera moves.
- In the 12 s after the reveal, a decision window is 24 frames instead of 90, and only a clearly GPU-bound interval
  counts there. Fewer pixels only for GPU-bound frames. A level that fails right after an upgrade is not retried.
- GPU-bound is measured where the browser exposes `EXT_disjoint_timer_query_webgl2` (Chrome and Edge on the
  desktop): GPU time over 14 ms per frame and over 1.5× the main thread's frame time. The second condition is
  needed because a timer query also spans the gaps while a slow CPU still submits draws; a fast GPU behind CPU ×4
  read 15–25 ms. Without the extension, the frame interval and the main-thread cost decide.
- The container size is cached (ResizeObserver). Reading `clientWidth` in `updateGoal` every frame forced the
  page's style recalc whenever something had dirtied it.

**Textures** (`bitmapTextures.ts`)
- Room, hardware, light-response and cabinet-art maps decode with `createImageBitmap`, off the main thread.
  Orientation, alpha and colour conversion are read from the texture when its bytes arrive and baked into the
  decode, because WebGL ignores those flags for ImageBitmaps. Browsers outside three's GLTFLoader gate (Safari
  < 17, Firefox < 98) keep the TextureLoader. A phone exhibit's uploads at CPU ×4: 1040 → 340 ms of main thread.
- Environment binaries are fetched and inflated once per page (`inflatedBinary`).

**Text fitting** (`fitText.mjs`, used by the cabinet marquees, the console keys and the CRT title)
- The size is predicted from one measurement and confirmed with two or three more, instead of a measurement per
  pixel step (up to ~170). On a phone this was 548 ms of `measureText` in one exhibit's preparation at CPU ×4,
  now 26 ms. `scripts/qa/fit-text.test.mjs` checks that the result equals the old loops.

**Results.** Both builds are local production builds served the same way: before = `15a5136` from a Git archive,
after = the working tree. The hall rate is the frames its own context drew.

| Scenario | Before | After |
| --- | --- | --- |
| Integrated GPU, hall idle / pointer / navigating | 14.9 / 21.0 / 22.2 fps | 35.3 / 40.5 / 30.7 fps |
| Integrated GPU, worst navigation gap | 208 ms | 133 ms |
| Integrated GPU, quality settled after the reveal | 13 s and 19 s | 1.4 s and 3.2 s |
| Integrated GPU, load long tasks (longest) | 2.30 s (1.08 s) | 0.96 s (0.51 s) |
| Slow CPU (×4), hall pointer / navigating | 21.5 / 14.5 fps | 47.1 / 31.7 fps |
| Slow CPU, long tasks while navigating | 6.6 s | 1.5 s |
| Slow CPU, load long tasks (longest) | 6.9 s (3.2 s) | 2.0 s (0.63 s) |
| Phone proxy, scroll long tasks (worst frame) | 4.6 s in 21 (1288 ms) | 0.33 s in 4 (196 ms) |
| Strong PC (RTX), hall | 60 fps, full quality | 60 fps, full quality, no level change |
| Strong PC, longest load task | 1.28 s (live) | 0.57–0.61 s |

The integrated-GPU "after" includes the approximated wall and floor lamps. Switched off entirely, they gave
44.5 / 42.8 / 34.0 fps, but the wall went nearly black.

Full quality is unchanged. With the console forced to its old size, the RTX frame of station 05 matches the live
build pixel for pixel: mean difference ≤ 0.01/255 on wall, floor and both neighbouring cabinets, and no channel
off by more than 12. The bitmap decode, the reflection capture, the gated light chunk at 1 and the console
changes therefore leave the image as it was.

Most of the slow-CPU load gain came from the text fitting. With every other fix in place, the longest load task was
still 3.0 s; after the fitting fix it was 0.64 s. The hall builds every cabinet's marquee inside the React effect
that creates the scene, so the old per-pixel loop sat in the task that had looked like hydration.

**Not built**
- A shared phone renderer: 90 % of the exhibit stall was image decoding on the main thread, which is fixed at its
  source. Sharing one context would save about 6 ms of context creation per exhibit, but it needs every texture
  of every exhibit disposed by hand, which risks GPU memory on phones.
- Splitting hydration: after the text-fitting fix, the longest load task at CPU ×4 is 0.64 s. Not needed now.
- Payload and KTX2 textures: unchanged.
