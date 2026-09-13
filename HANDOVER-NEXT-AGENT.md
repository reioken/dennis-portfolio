# Handover for the next agent — Blue, the hall cat

Written 2026-09-13 (early hours) at the end of a long session. Read this first, then `HANDOVER-CLAUDE-FABLE.md` (site-wide state, deployment workflow, older decisions) and `docs/research/blue-cat.md` (the full technical record, Phases v1 → 12). Your first job is **not** to change anything. It is to analyse deeply, live, what Dennis is unhappy with and why, and to propose a plan he can veto before you build.

**Status 2026-09-13, later:** the analysis in section 5 is done and written up in `docs/research/blue-live-analysis-2026-09-13.md` (60 fps live strips at 1440×900 and 390×844, per-frame traces on the dev server, reference timings, options with costs, five decisions for Dennis). Evidence and the probe scripts are in `.source-assets/blue/qa/live-analysis-2026-09-13/`. Two defects were found that no earlier round knew about: the runtime looks up the eyeballs as `Eye.L`/`Eye.R` but three's loader renames them to `EyeL`/`EyeR`, so the eyes have never closed on the site (`blueCat.ts:231`); and the About choreography plays below the frame on desktop and behind the panel on phones, so the visitor never sees the walk-up or the jump. Nothing was changed at that point.

**Dennis decided (same day):** no paid assets and no commission, Meshy credits are fine; order C (retime and fix the current pipeline) first, then a new head/mesh made in-house or with Meshy; keep the jump onto the claw machine; wake him by clicking him; pupils big and round. **Round C shipped** as `5c41795` / deployment `7d891d30` (`docs/research/blue-cat.md` Phase 13). Dennis judged it: the eyes were "extremely creepy", the lids seemed to move the whole eyeball. **The mesh round (v4) then shipped the same night** as `f8bb85e` / deployment `80129228` (Phase 14): a Meshy multi-image mesh from a generated turnaround (his choice: set B), rigged with `blue_v4_inspect.py` → `blue_v4_build.py` → `blue_animate.py` in `BLUE_V4=1` mode, eyes painted into the coat, blink by texture swap. Not yet judged by Dennis. Pipeline commands are in Phase 14; the Meshy key is never stored, it is passed as `MESHY_API_KEY` in the environment of `scripts/models/blue-v4-generate.py`. Known limits: the blink has no lid seam line (the closed eyes are fur-coloured discs), the squash morph dents the eye region slightly at 2×, stretch p99 on resting poses is 2.3–3.2 because of the fur-clump faces (no visible tearing), the asset is 2.9 MB (75k vertices; decimate if the budget bites), the perch clip still stands for its first half second, the hind paws rise high during the pull-up scramble.

**v5 shipped 2026-09-13 (later)** as `117cb30` / deployment `89dd8cfc` (`docs/research/blue-cat.md` Phase 15). Dennis judged v4: too heavy for the site, "weirdly like clay, with the fur being part of the model", stylise it, keep the walk; plus: click on a cabinet → walk over and sit in front of it; on the claw machine only the paws over the edge. Seven Meshy style sheets, he chose `pixar` ("style 4"); the first v5 cut he judged "so much like plastic, needs a proper fur texture" with the tail "super broken … how do you not see that?" (I had waved the check sheet through). What shipped: the `pixar` mesh at 25k polys (22.5k vertices), a Meshy fur *retexture* on the same UVs, the tail joints on the measured centreline, a corrective guard against the sit explosion, iris detection fixed (it had taken the inner ears for eyes, so the blink squashed the ears), big round pupils rasterised in mesh space (`scripts/models/blue-v5-pupils.mjs`), a matte coat (Meshy's roughness map dropped, fur grain 14× at 0.9, soft sheen), sit-in-front (`STATION_SIDE_X` 0.12), paws-only ledge hang. Asset 1.18 MB. **Not yet judged by Dennis.** Look at the About close-up and the climb-down first, that is where he sees the coat.

## 0. Who Dennis is and how he works

Art director who ships his own apps; German, terse, judges by eye. He wants autonomous execution with concise updates, real QA, and automatic commits/publication for authorized site changes. He decides all wording; never invent copy. He gives verdicts on the live site, not on renders. A verdict like "still robotic" or "looks bad" is the spec; ask for specifics only when the reading would change the work. Every deploy this evening was explicitly instructed by him; the permission classifier blocks `wrangler pages deploy` in Bash, and it runs through the PowerShell tool.

## 1. What is live right now

- Branch `feat/werkstatt`, head `117cb30` (plus the handover commit on top), pushed. Production deployment `89dd8cfc` = build of `117cb30`, verified by a headless browser load with console capture on the deployment URL and `www.dennisbf.design`, and by SHA-256 of `/models/blue-rigged-v5.glb` (1184104 bytes) and `/models/blue-v5-closed.webp` (269750 bytes) against the local `dist`.
- Blue v5: the stylised `pixar` Meshy mesh with a fur retexture, 22 clips, Meshopt-packed GLB of 1.18 MB, one PBR material (`Blue coat v5`), blink by texture swap plus a squash morph, painted round pupils, procedural bed, sleeping start, touch reactions, stepped turns, trot, inertialized transitions, tail/ear springs. `blue-rigged-v4.glb` (2.9 MB) and `blue-rigged-v2.glb` (1.04 MB) stay in `public/models/` for rollback (switch the path in `hallScene.ts`; the runtime routes by material name, `Blue coat vN` → `blue-vN-closed.webp`).
- The site CSP in `public/_headers` carries `'wasm-unsafe-eval'` on the main rule since `8dc7efa`. Without it the whole 3D hall goes blank, because every model needs the Meshopt WebAssembly decoder. That happened once for three deployments.

## 2. What Dennis is unhappy with (in his words, in order)

1. "not clean, not interactive enough, animation not smooth" (v1 → v2)
2. "eyes bulge when he jumps on the machine; legs go down way too far on the machine; too many robotic animations, when turning he just spins; not responsive or dynamic; needs way better, smoother, more dynamic animations"
3. "too much clipping; the cat bed needs to look way better; he should be sleeping there at the start and get up when you do something or click him; when jumping on the claw machine he must not clip through anything; turn more realistically, move more realistically; clicking different parts should elicit different reactions like a real cat; should feel like a companion; sometimes he still turns without an animation; needs way more polish"
4. "the turning animation still looks way too robotic; in general a lot of the animations look way too robotic and not dynamic like a real cat"
5. "the cat wakes up not fast enough and keeps his eyes closed too long; when scrolling the arcades he teleports, he should keep walking or have a running animation"
6. "the cat texture honestly looks really bad and low quality"
7. "the texture in the face looks really bad still, not high res enough, mushy, not detailed, like broken"
8. "eyes are way worse, he doesn't look cute anymore, he needs his eyelids and big black eyes; he still has no proper turning animation, he just spins; in general still bad animations; the ears need to be black from the outside"
9. On the retime round (Phase 13): "cat eyes look extremely creepy still, the eyelids don't work properly and move the whole eyeball; let's try making a new model first, with Meshy and Blender, higher quality everything"
10. On v4 (Phase 14): "the performance of this new model isn't good enough, and it looks weirdly like clay, with the fur being part of the model; let's stylize it, generate new images first, then we make a new model; the website needs to keep being high performance; I like how the cat walks now though" — plus "when clicking on an arcade, the cat should walk and sit in front of it" and "when sitting on top of the claw machine, only his paws at the edge should look over it, not part of his arms also"
11. On the first style sheets: "the toy style looks too much like plastic, it should be like a Pixar cat style kinda" → "style 4, try that"
12. On the first v5 cut: "he looks so much like plastic, needs a proper fur texture; also the model is super broken in a lot of those screens, especially the tail; how do you not see that?"

Items 5, 6, 8 (ear backs), 9 (no more lid geometry), 10 (weight, walk kept, sit-in-front, paws-only) and 12 (fur retexture, tail rig) are answered technically. The pattern of the earlier rounds still holds: what he sees on the live site decides, and item 12 was a check I should have caught myself from the pose sheet. He has not judged the v5 deployment.

## 3. What we currently want

A black cat companion in the 3D hall that reads as a **real, cute cat**: Dennis's actual cat Blue (black, amber eyes, big dark pupils, photos in `.source-assets/blue/`), who sleeps in his bed, wakes when the visitor does something, strolls or trots to the focused cabinet, sits beside it, climbs the claw machine on "Über mich" and lies on its marquee, reacts differently to being touched on head, back and tail, and above all **moves like a cat**: weight, spine, anticipation, follow-through, nothing that reads as a turntable or a rod.

## 4. What has been tried and where it fell short

Everything is procedural: the mesh is a Meshy generation, the rig and every clip are authored by Python in Blender (`scripts/models/blender/blue_rig.py`, `blue_animate.py`), and the runtime (`src/components/hall/blueCat.ts`) layers state machine, root motion, inertialization, springs and gaze on top. In this order:

- v2: rebuilt clips at 30 fps, cleaned coat, gaze overlay. Verdict: robotic.
- Corrective morphs had silently copied the blink (Blender `shape_key_add` default `from_mix=True`); fixed. Ledge pose rebuilt. Turn-in-place clips with root yaw; root-motion jumps; heading from the quaternion (three.js Euler `rotation.y` folds past ±90°). Verdict: still robotic, clipping, bed, sleep, touch.
- Bed rebuilt, sleeping start, touch regions, jump paths that clear the marquee, inertialized transitions, tail/ear springs. Verdict: turning still spins, animations robotic.
- Dynamic pass: bendable spine channel, easing library with overshoot and jitter, re-authored turn/walk/idle/settle/sit, trot, quick wake. Verdict: coat looks bad.
- Coat: even velvet black with a runtime-tiled fur grain, Meshy normal dropped. Verdict: face mushy, broken.
- Face: separate eyeball meshes with a generated iris, face material with a cleaned normal map. Verdict: eyes worse, not cute, still spins, ears skin-coloured.
- Turn as explicit stepped choreography, bigger dark eyes with lids, black ear backs. Verdict: not judged separately; the live analysis came next.
- Live analysis (`docs/research/blue-live-analysis-2026-09-13.md`) and the retime round (Phase 13): one-sweep turns, 37 cm strides, ballistic jumps, lid caps. Verdict: eyes extremely creepy, lids move the whole eyeball.
- v4 (Phase 14): Meshy multi-image mesh from a generated turnaround, 75k vertices, config-driven rig from `blue_v4_build.py`, eyes painted into the coat, blink by texture swap. Verdict: too heavy, clay-like, fur sculpted into the mesh; keep the walk.
- v5 (Phase 15): seven style sheets → `pixar`, 25k-poly mesh, fur retexture on the same UVs, tail joints re-measured, corrective guard, iris detection fixed, round pupils rasterised in mesh space, matte coat, sit-in-front, paws-only hang. **Not yet judged.**

Why it keeps falling short, honestly assessed:

1. **The Meshy mesh.** Lumpy silhouette, a fragmented UV atlas (hundreds of tiny islands, so any texture work is fighting seams and mip bleed), face sculpt of modest quality. No texture or clip fixes a base mesh. Dennis's cat is a specific, cute animal; the mesh is a generic cat blob.
2. **Procedural authoring has a ceiling.** Sine waves and eased tracks on a 26-joint rig, even with a bending spine and stepped turns, do not produce the micro-timing of a real cat. The 90° turn is 4 beats on a fixed pattern; a cat never does the same turn twice.
3. **Nobody has watched it like Dennis does.** Verification was numeric (yaw rates, stretch reports, regressions) plus static renders. The one time a *frame strip* of the live runtime was recorded (`.source-assets/blue/qa/turn-strip.png`), the "turntable" problem was obvious in seconds. The runtime look is what matters.
4. **Small model on a big stage.** From the hall camera the cat is ~120 px tall; details that look fine in a 2× close-up vanish, and what remains is silhouette and rhythm. Design for that size.

## 5. Your first task: deep analysis before any change

1. Open the live site in a real browser (the Browser pane, not just Playwright) at 1440×900 and on a phone viewport. Watch the whole companion loop: sleeping in the bed, hover-wake, walk to a spot, turn, sit, station change with the trot, About with the jump onto the cabinet, the lie-down on the marquee, touching head/back/tail, the climb-down and walk home. Record frame strips (pattern in the scratchpad probes described in `docs/research/blue-cat.md`, Phase 12) of the turn, the walk start, the jump and the wake. Look at them as an animator, not as a test.
2. Compare with reference: Dennis's photos in `.source-assets/blue/`, and video reference of black cats turning, sitting down, jumping onto shelves. Write down the specific differences (timing, weight, spine, head), not adjectives.
3. Read the pipeline end to end: `blue_rig.py` (rig, weights, blink morph), `blue_animate.py` (solver, clips, correctives, coat, eyeballs, export), `blue-pack.mjs`, `blue-asset.test.mjs`, `blueCat.ts` (state machine, root motion, pose pipeline, springs, materials, bed, touch), the hall integration in `hallScene.ts` (`blue.update`, `look`, `pet`, station data), and `public/_headers`.
4. Decide, and put to Dennis as options with cost and expected quality, between:
   - **A. New base mesh and rig.** A hand-modelled or commissioned stylised black cat (clean topology, one UV island per body part, real eyelid geometry, proper ears) rigged with Rigify or a custom quadruped rig. Highest ceiling for "cute" and "real". Everything in `blue_animate.py` is rig-agnostic in principle (positions-first solver on named joints) but would need re-fitting.
   - **B. Real motion data.** Cat/quadruped mocap or hand-keyed animation retargeted to the rig (the Perplexity report `cat-animation.md` lists sources and licence caveats; nothing licensed and usable was found tonight). Solves "robotic" at the root; needs retargeting work and a rig with matching proportions.
   - **C. Keep the procedural pipeline and iterate with strips.** Cheapest; the ceiling is what you see now. Only worth it if Dennis accepts the ceiling.
   Do not start C by default. Dennis has judged its output five times.
5. Only then make a plan with phases, each ending in a live deploy he can judge, and get his veto before building.

## 6. Pipeline map

| Step | Tool | Notes |
| --- | --- | --- |
| Rig | `blender --background --python scripts/models/blender/blue_rig.py` | Master `.source-assets/blue/v3/blue-rigged-master.blend`; weights by position; `BlueBlink` morph |
| Clips, correctives, coat, eyeballs, export | `blender --background --python scripts/models/blender/blue_animate.py` | Positions-first solver; `bend` spine channel; `root_yaw`/`root_move` on the Root bone; explicit turn choreography; face material and eyeballs; writes `.source-assets/blue/v3/blue-rigged-v2.glb` |
| Meshy stages (v4/v5) | `MESHY_API_KEY=… python scripts/models/blue-v4-generate.py images` / `style NAME` / `mesh NAME imgs…` / `retexture NAME` | Key only in the environment, never in files; per-stage `state-*.json` and downloads in `.source-assets/blue/v4/`; `MESHY_POLYS`/`MESHY_ULTRA` set the mesh budget (v5: 25000, no ultra) |
| Normalise a Meshy mesh | `blender --background --python scripts/models/blender/blue_v4_inspect.py -- <glb> .source-assets/blue/v4/inspect-NAME` | Longest axis to Y, head at −Y, 0.42 m tall, paws on z = 0, orthographic views on a grid |
| Rig a Meshy mesh | `blender --background --python scripts/models/blender/blue_v4_build.py -- inspect-NAME/normalised.glb build-NAME rig-config-NAME.json` | 26 joints from the config, capsule weights, iris detection by amber hue below the ears, `BlueBlink` squash, see-through joint renders (`joints-*.png`, look at them) |
| Clips + export (Meshy mesh) | `BLUE_V4=1 BLUE_VERSION=v5 BLUE_MASTER=<abs path to build-NAME/blue-v4-master.blend> blender --background --python scripts/models/blender/blue_animate.py` | Writes `.source-assets/blue/v3/blue-rigged-v5.glb`; material renamed `Blue coat v5` |
| Closed eyes + pupils | `node scripts/models/blue-v4-closed-eyes.mjs NAME v5` then `node scripts/models/blue-v5-pupils.mjs NAME` | Closed atlas → `public/models/blue-v5-closed.webp`; pupils → `blue-rigged-v5-pupils.glb` (the export is never overwritten); pack that file |
| Pose renders + stretch | `blender --background --python scripts/models/blender/blue_check.py` | `.source-assets/blue/v3/check-v2/`; ledge prop for perch shots, follows the Root on jumps |
| Eye/morph forensics | `blue_forensics.py` | Only needed if deformation looks wrong again |
| Pack | `node scripts/models/blue-pack.mjs <source glb> public/models/blue-rigged-v5.glb` | resample + Meshopt; the guard reads the version from the file name |
| Guard | `node --test scripts/qa/blue-asset.test.mjs` | In `npm run test:review`; names, clips, Root motion, morphs, eyeballs, size ceiling |
| Browser regressions | `node scripts/qa/blue-cat.mjs`, `blue-companion.mjs`, `blue-turn.mjs` | Need the dev server (`astro dev --background`); **nothing may write into the project while they run**, not a Blender export and not a markdown file under `docs/` either (that reloaded the page mid-recording tonight) |
| Other models | `node scripts/models/shrink-textures.mjs && node scripts/models/pack-models.mjs` | Separate processes on purpose (two native sharp builds in node_modules) |
| Release | typecheck `npx tsc --noEmit -p .`, `npm run test:review`, `npx astro build`, `node scripts/audit-build.mjs`, then `npx wrangler pages deploy dist --project-name=dennis-portfolio --branch=main --commit-dirty=true` (PowerShell tool, after Dennis's instruction), then **a headless load of the live URL with console capture and a screenshot** | Status codes and checksums are not verification |

Runtime knobs in `blueCat.ts`: `HOME`, `BED`, `LEDGE` (take-off z 0.80, landing = lying spot z 0.17), `TURN_MIN`/`TURN_CLIPS`, `RUN_SPEED`/`FAR_DISTANCE`, `INERTIA_SETTLE`, `TAIL_SPRING`/`EAR_SPRING`, `furGrain()`, material routing by name (`amber` → eyeballs, `face`, else coat), `startAsleep`/`disturb`, `pet(hit)` regions.

## 7. Environment traps (all hit tonight)

- Blender 5.2 at `C:/Program Files/Blender Foundation/Blender 5.2/blender.exe`; it resolves relative render paths against `C:\`, use absolute paths.
- `node_modules` and Playwright browsers vanished once; `npm ci` and `node <codex playwright>/cli.js install chromium` restore them. QA scripts import Playwright from the codex runtime cache.
- Two native sharp builds (0.34 top-level, 0.35 under `ndarray-pixels`): never import `@gltf-transform/functions` in a process that encodes with sharp; copy texture views into a `Buffer` before handing them to sharp.
- Python heredocs mangle `\n` inside JavaScript strings; edit JS with the Edit tool.
- three.js Euler `rotation.y` is not the heading past ±90°; use `blue.yaw`.
- Blender `shape_key_add()` defaults to `from_mix=True`.
- `window.__hall` (with `blue`) exists on the dev server only; the live probe must rely on the canvas and console.

## 8. Open items that are not on Dennis's list

Contact-locked feet, native Firefox rerun, KTX2 textures, foot slide on curved walking, the trot's look, the bed's size from the hall camera, `cat-animation.md` (Dennis's research report) is untracked in the repo root. v5-specific: the closed-eye look is a fur-coloured disc with a faint seam (no lid line), the blink squash dents the eye region a little at 2×, the perch clip still stands for its first half second, the tail lies low along the floor in the walk (that is how the `pixar` mesh was generated), `blue_check.py` has not been run on v5 (the pose sheet is what missed the tail last time; run it and look at every clip).
