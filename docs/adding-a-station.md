# Adding a station to the hall

Written 2026-09-19 from the VGM Battle build (`a37ff62`). A station is derived from a `work` content entry; the
rest is a model, one side-art texture, media and four small tables. Reference entries: `vgm-battle.mdx` (bespoke
cabinet, web product), `lowlight.mdx` (bespoke console), `nexus.mdx` (parametric terminal with a landing page).

Wording is Dennis's. Reuse the product's own shipped copy; anything new is listed for his veto before it ships.

## 1. Media

```
public/media/<slug>/shots/     gallery images (WebP, 1600 px wide is the house size)
public/media/<slug>/screens/   clean captures for the physical screen (hallScreens, four are used)
public/media/<slug>/logo.svg   TV and dock mark
```

```
npm run thumbs    # @sm.webp siblings for shots/, screens/ and the cover
npm run avif      # .avif and @sm.avif siblings: REQUIRED, the build audit fails on a missing srcset candidate
```

Captures of a live product: a short Playwright script at 1600×1000, device scale 1.5, `sharp().resize(1600).webp({quality: 86})`.
Leave out screens that show user accounts.

## 2. Content

Copy an existing `src/content/work/*.mdx`. Schema: `src/content.config.ts`. `platform` decides the machine kind
(`game` → cabinet, `audio` → jukebox, mobile only → kiosk, else terminal) and the kind label in the panel; the
model itself comes from `MODELS_BY_SLUG`, so a web product can still have a cabinet. Body: one
`<div data-lang="de">` and one `<div data-lang="en">`. Numbers only with a source and a date.

## 3. Hall wiring (four edits)

| File | Edit |
| --- | --- |
| `src/lib/hall-items.ts` | slug into `ORDER` (About, Riftback, NEXUS, Lowlight stay first) |
| `src/components/hall/hallScene.ts` | `MODELS_BY_SLUG['<slug>'] = { url, height, screenNames: ['screen'] }` |
| `src/components/hall/hallLayout.ts` | `widths['<slug>']` in metres, equal to the model's width, else spacing drifts |
| `scripts/en-routes.mjs` | `META_EN['work/<slug>/']` title and description; the `/en/` route itself is automatic |

`MAX_STATIONS` in `hallLighting.ts` is 20; the hall has 16.

## 4. Side art

```
OPENAI_API_KEY=… node scripts/assets/generate-side-art.mjs <slug> "<one-sentence motif>" "<two accent colours>"
```

Writes the PNG original and the prompt into `design-mockups/afterimage-textures/quiet-v2/` and the runtime file
`public/textures/cabinet-art/quiet-v2/<slug>.webp` (768×1152, loaded by slug). `SIDE_ART_VARIANT=a` writes a
variant only; `SIDE_ART_FROM=<png>` promotes a variant without a new request. Look at variants beside two
existing prints before choosing. Marquee, control card and screens are rendered at runtime; front and deck stay
plain satin.

## 5. Model

Parametric: `cabinet_gen.py` (`cab-*`) or `machine_gen.py` (`mach-*`) with a `spec.json` under
`.source-assets/models-in/<name>/`. Bespoke: copy `vgmbattle_gen.py` or `lowlight_gen.py`.

```
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --python scripts/models/blender/<gen>.py
node scripts/models/optimize.mjs --only <name>
node scripts/models/shrink-textures.mjs
node scripts/models/pack-models.mjs --only <name>
```

- The runtime binds by mesh name: `screen`, `glass`, `marquee`, `side_art_l`, `side_art_r`, `front_art`,
  `deck_art`, `card`, and the controls `joy`, `btn_0…5`, `start_0/1`, `trackball`, `tbtn_*`, `kbtn_*`, `sel_*`.
  One `joy` per machine is driven; a second stick is scenery. `btn_k` maps to previous / fullscreen / next by `k % 3`.
- `afterimage_detail.enrich` adds `front_art` above a part named `lower_panel` or `ped_panel` and `deck_art`
  above `cp_plate`, `ledge`, `selector_plate` or `selector_strip`. Name those parts accordingly.
- **Always pass `--only` to `pack-models.mjs`.** A full run rewrites every GLB byte-wise; `/models/*` is
  edge-cached for a day under unchanged names and `dennis.glb` / `nori.glb` are hash-guarded. If it happened:
  `git checkout -- public/models`.
- Changed content under an existing model or texture name needs a new file name or a `?v=` query.
- Under 50,000 triangles. Render a three-quarter, a front and a deck view before packing.

## 6. Verify

```
npm run typecheck && npm run test:review
npx astro build            # not `npm run build`: that runs the werkstatt scanner
npm run audit              # page count rises by two per station
```

Then on the dev server and on `astro preview` (launch config `astro-preview`, port 4322):
`node scripts/qa/live/station-check.mjs <outdir> http://localhost:4322` with the slug and step count adjusted.
Look at the hall view, the case panel, both side panels from the neighbouring stations, and the phone page.
After the deploy the same script runs against `https://www.dennisbf.design`, and the GLB's SHA-256 is compared
with `dist`.

## Props made with Meshy (the claw machine's plush)

```
OPENAI_API_KEY=… node scripts/assets/generate-image.mjs .source-assets/claw-plush/<name>.png "<prompt>" [1536x1024]
# downscale to <name>.jpg (≤ 1280 px, quality 90): a multi-megabyte data URI is refused by the API
MESHY_API_KEY=… python scripts/models/claw-plush-generate.py <name> [polycount]
npx gltf-transform optimize <in> public/models/plush/<name>-v1.glb --texture-size 1024 --texture-compress webp --compress meshopt --simplify false
```

About 30 credits per model; the state file keeps a task from being requested twice. The key is only ever in the
environment. Objects that should press into each other are generated as ONE mesh from one image of the heap.
Placement: `CLAW_PRIZES` in `hallScene.ts`; the claw interior floor is ±0.428 m with a pedestal of radius 0.24 m.
