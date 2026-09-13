# Prompt for the next agent (Astra) — dennisbf.design, Blue the hall cat

You are taking over the agent role on `C:\Users\denni\Projects\dennis-portfolio` (Astro 7 static site, React islands, a three.js 3D hall with Blue, a black cat, as the companion). Dennis Bierreth-Fernandez is the owner: art director, German, terse, judges everything by eye on the live site, not on renders. Read this whole file, then the files it names, before you change anything.

## 1. Read first, in this order

1. `CLAUDE.md` (project instructions, dev server rules).
2. `HANDOVER-NEXT-AGENT.md` — Dennis's verdicts in his words, what was tried and rejected, the pipeline command table, open items. The status paragraphs at the top are in chronological order; the last one is Phase 18.
3. `HANDOVER-CLAUDE-FABLE.md` — site-wide state, deployment workflow, older decisions.
4. `docs/research/blue-cat.md` — the technical record of the cat, Phases 1–18. Phase 18 (the last section) is the current state.
5. `docs/research/site-performance-pass-2026-09-13.md` — the site-wide performance pass and its open items.

## 2. Where things stand (2026-09-13)

- Branch `feat/werkstatt`, head `6138289`, pushed to `origin`. Production deployment `8973d2f7` = build of `07ba2b9`, verified on `https://8973d2f7.dennis-portfolio-87g.pages.dev` and `https://www.dennisbf.design` (pages 200, Blue files by SHA-256 against `dist`, CSP with `'wasm-unsafe-eval'`, headless load with console capture: no errors).
- **Unjudged by Dennis:** Phase 18 (side-lying curled sleep, the white face flicker fixed with island-aware mip levels and separate eye textures, dark ear rims) and the performance pass. He will give his verdict on the live site. His verdict is the spec; ask for specifics only when different readings would lead to materially different work.
- Blue is **v6**: the very first Meshy mesh from his photos with its original atlas and painted amber eyes. He rejected every later mesh and coat (v2 cleaned coat, v3 eyeballs/lids, v4 "clay", v5 "EWWW no"). **Do not swap the model or the atlas again without asking.** Changes are to this mesh and this atlas.
- Untracked in the repo root: `cat-animation.md` (Dennis's own research report on cat animation). Leave it.

## 3. Dennis's rules (non-negotiable)

- Never invent copy. Any UI text, label, headline or message you add is listed for his veto before it ships; he decides all wording.
- No paid assets, no commissions. Meshy credits are allowed; the key is passed only as the `MESHY_API_KEY` environment variable, never written to a file, a log or a commit.
- The cat is woken by clicking him. Big round eyes. No teleporting: he walks everywhere (the long walk from the far station back to the bed is by design).
- "How do you not see that?" — look at every frame of a strip before you show or ship it. Compose sheets and actually look at them.
- Autonomous execution with concise updates; commit and deploy site changes yourself once they are verified; verify live after every upload.

## 4. How to work here

- Dev server: `astro dev --background` (port 4321; `astro dev status|logs|stop`). `window.__hall` (the scene, `__hall.blue` the cat) exists in dev only, never live.
- **Never write any project file, docs included, while a Playwright run is going against the dev server** — Astro reloads the page and the run dies or lies. Run probes, then edit.
- Blender 5.2: `C:/Program Files/Blender Foundation/Blender 5.2/blender.exe`, always `--background --python`. Give it absolute output paths: relative render paths land under `C:\`.
- Python needs `C:/...` paths, not `/c/...`. Node scripts outside the repo need the repo's `node_modules` (a junction next to the script, or `file:///` imports).
- Blue pipeline (all from the repo root): `BLUE_ORIGINAL=1 blender --background --python scripts/models/blender/blue_animate.py` (bakes all 24 clips + correctives, exports `.source-assets/blue/v3/blue-rigged-v6.glb`) → `node scripts/models/blue-v6-atlas.mjs` (derived GLB with the 1024² island-aware coat + separate eye textures, the mip sheet and the closed-eye texture under `public/models/`) → `node scripts/models/blue-pack.mjs .source-assets/blue/v3/blue-rigged-v6-atlas.glb public/models/blue-rigged-<build>.glb` → `node --test scripts/qa/blue-asset.test.mjs` → `blender --background --python scripts/models/blender/blue_check.py -- <abs blend> <abs outdir>` for the pose sheet.
- **File names:** `/models/*` and `/textures/*` are edge-cached for a day. Any content change under them needs a new file name. Blue's three files share the suffix `BLUE_ASSET_BUILD` in `src/components/hall/blueCat.ts` (currently `v6b`): bump it, pass it to the atlas script (4th argument) and use it in the pack output name. Delete the old files. This was learned the hard way on 2026-09-13.
- Pose iteration: `.source-assets/blue/qa/curl-atlas-2026-09-13/blue_pose_lab.py` renders a single pose through the real solver in ~20 s with an override file and `LAB_PARAMS` JSON. Use it before any full bake.
- Runtime probes on the dev server: `scripts/qa/blue-turn.mjs`, `blue-cat.mjs`, `blue-companion.mjs` (regressions; run all three before a deploy), `.source-assets/blue/qa/curl-atlas-2026-09-13/dev-flicker.mjs` (single-frame sparkle counter), `dev-mips-check.mjs` (texture setup, bed and head views), `.source-assets/blue/qa/live-analysis-2026-09-13/bed/dev-bed.mjs` (hand-stepped bed scenario). Wait ~6 s after `readyDone` before stopping the loop for hand-stepped captures, the reveal fades in.
- Checks before a deploy: `npm run typecheck`, `npm run test:review`, `npm run build`, `npm run audit` (`npm run check` runs all four; CI runs it too).
- Deploy: `npx wrangler pages deploy dist --project-name=dennis-portfolio --branch=main --commit-dirty=true` (deploys `dist` to production). Then verify on the deployment URL and on `www.dennisbf.design`: pages 200, the Blue files by SHA-256 against `dist`, the CSP header contains `'wasm-unsafe-eval'` (without it the whole hall goes blank), a headless load with console capture and a look at the cat. `.source-assets/blue/qa/curl-atlas-2026-09-13/live-verify-phase18.mjs <origin>` does exactly this; update its file list when the build suffix changes.
- Commit the application change first, deploy its build, then update both handover files with the commit and deployment ids and commit those. Push `feat/werkstatt`. `.source-assets/` is git-ignored: evidence lives there locally, never in git.
- Windows shell quirks: heredocs with apostrophes inside break in some tool shells; write patch scripts to files and run them.

## 5. Open items (details in the two research documents)

- Blue: the curl's p99 stretch is 3.9 (a fold at the shoulder under the neck, invisible at hall size); a small hollow remains in the ring from straight above; the coarse mip levels cap anything brighter than the fur, so no whisker strokes below about 100 px on screen; the front paws hover a few centimetres for a moment on the bed exit (no runtime foot IK); the turn at `BED_EXIT` before stepping in can take up to 2 s; contact-locked feet, native Firefox rerun, KTX2 textures, foot slide on curved walking, the trot's look.
- Site: the hall pose renders every gated tick (by choice), the zoom-in decode/upload burst, the About panel's first-paint raster stall, station-change slide pipeline allocations, compact raycast per pointer move, a hall CSS split, a three.js code-split for lite clients, loader progress on slow networks (copy and UI are Dennis's call), the pre-existing `hall-route-cache.mjs` warm EN scenario React #424 flake (one run in two, also on the old build).

## 6. What to do first

Nothing on the site until Dennis has judged the live deployment. If he reports a defect, reproduce it on the dev server with a probe (frame strips, measurements) before changing anything, state the cause in one paragraph, fix, verify with the regressions and a live check, deploy, update the handovers, push. Report in short plain sentences; lead with what changed and what he will see; numbers in a small table.
