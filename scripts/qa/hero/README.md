# Hero machine QA tools

Headless captures and static checks for the hall machines. Rescued from the scratchpad of the
Sept 19/20 2026 hero-machines build.

## Two rules before you run anything

**Output goes outside the project.** Vite reloads the dev server whenever a file changes under the
repo root, so a screenshot written into the repo restarts the page in the middle of a capture. Every
tool that writes files resolves its out dir and exits with an error if it lands inside the repo. Use
a temp dir, e.g. `%TEMP%\hero-qa`.

**Bakes and headless captures share the GPU with the owner's browser.** He sees a running bake or a
Playwright run as lag on the live site. Run them one at a time, never next to a Blender bake. If
several agents work in parallel, take a lock first:

```sh
until mkdir "$TMP/gpu.lock" 2>/dev/null; do sleep 20; done
# ... bake or capture ...
rmdir "$TMP/gpu.lock"
```

Keep the number of captures low. Prefer one run over 14 stations to 14 separate runs.

## Tools

`OUT` below is a directory outside the repo. `BASE` defaults to `http://localhost:4321` where the
argument is optional.

| Tool | Usage | What to look at |
| --- | --- | --- |
| `all-stations.mjs` | `node scripts/qa/hero/all-stations.mjs OUT [BASE] [slug,slug]` | `01-case.png` … `14-case.png`, one per station. `ERRORS 0` at the end. |
| `sheet.py` | `python scripts/qa/hero/sheet.py OUT sheet.jpg` | 7x2 contact sheet of those 14 shots. Scan for a wear feature (a chipped corner, a scuff band, a scratch fan) that repeats across machines. |
| `station-zoom.mjs` | `node scripts/qa/hero/station-zoom.mjs OUT [BASE] [steps-right]` | `zoom-top.png` (hood and screen) and `zoom-machine.png` at dpr 2. Screen recess, bevel highlights, seams, dots in the wear. |
| `claw-shots.mjs` | `node scripts/qa/hero/claw-shots.mjs OUT [BASE]` | Claw in the hall and on its case page. Run after every `claw-v2` bake. |
| `booth-shots.mjs` | `node scripts/qa/hero/booth-shots.mjs OUT [BASE]` | `/contact/` booth and the hall behind it. Run after every `phone-booth-v1` bake. |
| `tv-shots.mjs` | `node scripts/qa/hero/tv-shots.mjs OUT [BASE]` | TV rig above the hall at dpr 2. Run after every `tv-rig-v1` bake. |
| `closeup-shot.mjs` | `node scripts/qa/hero/closeup-shot.mjs OUT [BASE] [steps-right]` | `closeup.png` / `closeup-hover.png` plus the screen hit-box it found. |
| `ctl-test.mjs` | `node scripts/qa/hero/ctl-test.mjs [BASE] [slug,slug] [x,y]` | Per station: control count, always-on tags, slide count before -> after "next". Kiosk cabinets need the screen click at `592,380` instead of the default `480,420`. |
| `ball-test.mjs` | `node scripts/qa/hero/ball-test.mjs OUT [BASE] [steps-right]` | Trackball drag, left-half click, screen arrow, keyboard — each should move the slide count. |
| `hover-test.mjs` | `node scripts/qa/hero/hover-test.mjs [BASE] [steps-right]` | Edge-arrow x/y range over 1.2 s; a non-zero range means the arrow drifts under the cursor. |
| `frames.mjs` | `node scripts/qa/hero/frames.mjs BASE [--4k]` | `mean` / `p95` / `max` / `over33` for hall idle, navigate, open case, case idle. `--4k` = 2560x1440 @ dpr 1.5. |
| `verify-hashes.mjs` | `node scripts/qa/hero/verify-hashes.mjs` | Every `?v=<sha>` cache-buster in the hall sources vs. the file on disk. Exits 1 on `MISMATCH` or `MISSING FILE`. |
| `live-assets.mjs` | `node scripts/qa/hero/live-assets.mjs BASE` | Byte-compares served assets against `public/`. `BAD` = stale or broken on the server. Use after a deploy. |
| `preview-sweep.mjs` | `node scripts/qa/hero/preview-sweep.mjs BASE` | Every sitemap URL, console + network errors. Point it at `astro preview`, not the dev server. |
| `unref.mjs` | `node scripts/qa/hero/unref.mjs` | Files in `public/models` / `public/textures` whose name appears nowhere in `src/` or `scripts/`, biggest first. Candidates for deletion, not proof. |
| `tris.mjs` | `node scripts/qa/hero/tris.mjs file.glb [...]` | Triangle count and byte size per GLB. Uncompressed GLB only — run it on `.source-assets`, not on packed output. |
| `inspect-models.mjs` | `node scripts/qa/hero/inspect-models.mjs mach-berry-v2 [...]` | World bounding size, screen plate size and aspect, and the control node names the close-up maps to. |

`_out.mjs` is not a tool: it holds the repo root and the out-dir guard the capture tools share.

## Review routine

1. **Wear repetition.** `all-stations.mjs` over all 14 slugs, then `sheet.py`. Look at the sheet as
   one image: no wear feature may read twice. A repeat is a defect: change the recipe's `seed` / `wear` zones or the machine's `HeroLook` in `hallScene.ts`.
2. **Close-up quality.** `station-zoom.mjs` at dpr 2 for the stations you touched. Screen sitting deep in its
   shroud, bevels catching light, no dots in the wear, no stretched texels on the sides.
3. **Controls.** `ctl-test.mjs` after any change to control geometry or node names — the close-up
   maps proxies by node name, so a renamed button silently drops a control.
4. **Frames.** `frames.mjs` before and after the change, same machine, nothing else on the GPU.

## Baking

`scripts/models/build-hero.sh <name>` runs the whole chain for one machine: recipe ->
Blender bake -> attach mask -> optimize -> pack -> sha8. Set `BLENDER` to override the Blender path.
Run it with no arguments for the usage text. It is GPU-heavy; take the lock.
