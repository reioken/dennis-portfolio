# Hero machines

The hall's machines at the level of detail Dennis approved on 2026-09-20 (Riftback first). One generator, one recipe
per product, one height (1.95 m), and no two machines that age alike.

## What Dennis asked for, in his order

- Photoreal, still cheap to draw. A REAL arcade machine: real parts (coin door, drivers, vents, locks), never themed
  or fantasy props.
- One carcass. Details are cut INTO a panel, not laid on top. No nameplate on the machine: the wall names it.
- The monitor sits deep behind a sloped shroud, not flush in a hole.
- Glow and light: the trim glows like the rest of the hall, a hidden light under the shelf washes the pedestal.
- Every machine follows what the product is, and every machine is a unique piece: its own build, its own KIND of
  wear, its own patterns. Two machines with the same chipped edge in the same place is a defect.
- In the close-up: no floating tags next to the hardware (arrows are printed on the caps), no hover backgrounds, the
  trackball turns under the mouse, arrows appear at the screen's edges on hover, the cabinet's controls keep working.

## Pipeline

```
.source-assets/models-in/<name>/spec.json      recipe ("hero" block overrides CFG in the generator)
scripts/models/blender/hero_terminal_gen.py    geometry, UVs (tiling + visibility-weighted atlas), Cycles bakes
scripts/models/blender/hero_claw_gen.py        the claw machine (About): claw_gen.py's moving parts + hero front, no sign
scripts/models/blender/hero_gen.py             bake helpers: mask RGBA = AO / screen light / brand light / wear zones
scripts/models/hero-attach-mask.mjs <name>     mask → occlusion slot, key-light shadow → emissive slot (TEXCOORD_1)
scripts/models/optimize.mjs --only <name> --keep-attributes --size 1024
scripts/models/pack-models.mjs --only <name>   (delete .source-assets/models-original/<name>.glb first)
src/components/hall/heroMaterial.ts            surfaces, wear detail, per-machine HeroLook, hero room reflection
src/components/hall/hallScene.ts               MODELS_BY_SLUG: url with ?v=<sha8>, noMarquee, hero: HeroLook
scripts/assets/hero-wear-texture.py            the six generated wear tiles (public/textures/hardware/wear-*-v1.webp)
scripts/build-hero-environment.mjs             the room hero machines mirror (public/textures/hero-environment-v1.bin.gz)
```

`/models/*` is edge-cached for a day: every rebuilt GLB needs a new `?v=` (first 8 hex of its SHA-256).

## A recipe

`"hero"` keys (defaults = Riftback): `width depth tilt shelf_z shelf_edge deck_len deck_tilt display_top hood_drop
hood_angle` (profile), `screen_w screen_aspect` (the screen is fitted to its panel), `pedestal` (`coin_door`, `pc_bay`
with `bay: "rack"`, `speakers` with `drivers: [[x, y, r], ...]` and `coin_door: true`, kiosk: `printer`, `tray`, `nfc`,
`intercom`), `speakers` (`hood`, `pedestal`, `none`), `light_line` (`shelf`, `hood`), `controls` (`keyboard`,
`transport`, `selectors`, `arcade` with `second_stick`, `kiosk`), `knobs`, `chrome`, `paint panel door`, `seed`, `wear`
(zone strengths: edge, hands, shoes, knees, crevice, low, dust).

Control names are the hall's contract: `trackball tbtn_0 tbtn_1` · `joy btn_0..5 start_0 start_1` · `kbtn_0 kbtn_1` ·
`start_0 sel_0..5`. Previous/next buttons carry a printed chevron.

## Unique wear, three layers

1. Baked ZONES (soft, 1 K): where a machine is worn. Seeded per machine and per part (`seed`, `hg.WEAR_PER_PART`).
2. Detail tiles (sharp, tiling): what wear looks like. `HeroLook.lines` = scratches | swirls | scuffs, `HeroLook.chips`
   = chips | pits | flakes. The soft zone is thresholded against the chip height; lines lie over it.
3. Placement: `HeroLook.seed`, `turn`, `scale` shift, turn and size the tiles per machine and per material.

Before showing a new machine, put it next to the finished ones and check that no wear feature repeats.

## Traps

- The hall draws no shadows: the key light would light the bezel under the hood. `bake_key_shadow` fixes that.
- `mach_led` (glow behind slots) needs a BLACK base colour or the room paints it in the brand colour.
- Wear on the gloss acrylic sheet must stay near zero (it reads as torn paper / cracked glass).
- The screen recess plus shroud must fit the display panel; the generator clamps `screen_w`.
- Bakes and headless captures use the same GPU Dennis looks at the site with: he sees them as lag.
- Closeup.tsx has CRLF line endings. Never script-edit TypeScript lines that contain `\n` escapes from a shell.

## The claw machine

`hero_claw_gen.py` reuses `claw_gen.py` (mesh names and pivots are `buildKasse`'s contract: glass, floor, disc, carriage,
claw, lamp, led, joy, btn), removes the marquee (Dennis: no "Über mich" sign on top), opens the base's front and closes
it with one panel (deep prize chute behind its flap, coin door with two coin mechs, lock, speaker slots), adds a gantry
motor, end stops, a cable loop, LED bars inside the front posts, post caps, kick screws and levellers. The interior
lamps bake into the mask's G channel (`hg.SCREEN_EMITTERS = ("claw_lamp",)`); `buildKasse` gives every baked surface a
hero material (`CLAW_LOOK`) and leaves lamps, LEDs and panes alone. Model: `public/models/claw-v2.glb`, URL and look in
`CLAW_MODEL` / `CLAW_LOOK` in hallScene.ts. Blue's perch (`LEDGE` in blueCat.ts, 1.95 m) still lands on the flat cap.

## The phone booth, the TV rig, the floor (night of 2026-09-20)

- **Kontakt** = a classic yellow phone booth, `scripts/models/blender/hero_booth_gen.py` → `public/models/phone-booth-v1.glb`
  (`MODELS.phone`: `enclosure: true` gives its `glass` mesh the two-sided enclosure glass, `lamp` colours the mask's G
  channel warm). 1.95 m like every station, so it covers neither the wall title nor the TV; `hallLayout` width 0.92.
  Inside: wall payphone (handset on its hook, coiled cord, keypad, coin slot, return cup), shelf, directory binder.
- **TV rig** = `scripts/models/blender/hero_tv_gen.py` → `public/models/tv-rig-v1.glb` with the nodes `rail` (one metre,
  instanced along the hall), `carriage`, `wheel` (four clones, turned by the existing animation), `arm`, `tv`.
  `HallScene.loadTvRig` swaps them in for the box stand-ins that `buildTv` still creates first (the picture, LED, light
  and glow stay procedural). The rails hang from OUTSIDE brackets: the trolley runs on top of the channels, so nothing
  may cross above them. Never set `position`/`scale` on a GLB node itself: quantized nodes carry their dequantization
  there (the claw became 50 times too large that way). Put the node into a holder group, or multiply.
- **Floor** = `scripts/assets/hall-floor-texture.py` → `public/textures/floor/concrete-v1_{basecolor,normal,orm}.webp`:
  polished concrete, saw-cut joints on the tile border (the hall repeats it every 2 m, the joints become the slab grid
  and hide the repeat), trowel arcs, two faint hairline cracks, duller walking paths. 58 KB together.
- **Wall title of the About station** now reads ÜBER MICH / ABOUT ME (the text the removed sign carried), not DENNIS.
- **The claw holds the figure**: `buildKasse` finds multi-material parts by node name (they arrive as groups, which is
  why the claw never moved before), scales the claw by 1.35, lowers it onto the figure's head, keeps the gantry over
  him and turns the claw with the turntable (`kasse.hold`).
- **No dots**: the chip threshold window opens above the chip height for every machine with a seed (`heroLook.z`);
  centred on it, a trace of baked wear let the lowest 5 % of the tile through everywhere. Riftback keeps the old window.

## Edges, real parts, the room (afternoon of 2026-09-20)

**A bevel normal in the same atlas.** `hg.bake_bevel_normal` bakes the Bevel node's rounded normal (radius 1.5 mm,
`BEVEL_RADIUS`; `hero_tv_gen.py` passes 1.2 mm because its channels and plates are smaller) to `<name>-normal.png`
next to the mask. `hero-attach-mask.mjs` hangs it on the material as the glTF `normalTexture` with `texCoord 1`, so it
rides the atlas UV set; `heroMaterial.ts` keeps the tiling scan as the normalMap and perturbs the shading normal with
the baked one afterwards at `BEVEL_SCALE = 0.55`. A machine baked before this existed has no file and renders exactly
as before. Every generator rebakes with the same one line.

**Real parts per family.** The keyboard is an ANSI stagger (`KEY_ROWS`: 1.75 / 2.25 / 1.5 modifiers, a 6.25 space bar)
of moulded `keycap`s with draft and a dished top, standing in a black tray. `joystick` gets the four carriage bolts of
its mounting plate on a 64 mm square, a chrome dust washer and a rubber dust boot over the shaft. Buttons are turned
parts (`dish_cap`: rolled rim, face dished a few tenths of a millimetre) in a ring collar, chevron printed into the cap.
`hg.bake_*` panels carry `bezel_screw`s; `door_hardware` gives every door two butt hinges with a pin, frame bolts and a
lock. Kiosk pedestals gained a `cam_lens` above the screen and the printer lip / NFC reader plate their `ped_kind`
implies. A `power_cable` group named `cable` runs from a strain-relief bush low on the back panel down to a tail on the
floor — invisible from the hall's frontal camera, and short on purpose: `loadModel` centres every model on its bounding
box, so a lead reaching the wall would push the machine forward and widen the close-up's framing.

**Dennis's rule:** stamped vent and speaker slots on the TOP belong to arcade cabinets only. The claw's cap and the
booth's roof lost theirs (`hero_claw_gen.py`: "no sign, no vents"; `hero_booth_gen.py`: "no vent on the roof"). And
nothing may hang loose into the claw's glass box.

- **Claw**: what really drives the bridge — `belt_drive` pulley on an extended shaft, `belt_idler` at the far end, the
  two `belt_run`s between them and the limit switch the bridge trips. The cable it drags runs TIGHT along the rear rail.
- **Booth**: an overhead door closer (spindle, arm, elbow, forearm, shoe, bracket), three pairs of hinge leaves, a
  ribbed rubber `mat` with raised ridges, and a `coinbox_door` with the lock the collector opens it by.
- **TV rig**: strut channel comes in lengths, so each rail end carries half a `splice` plate with two dome-head bolts,
  and a `track_cable` is clipped along the outer face of the near channel, level across the joints.

**The room.** The wall is generated brick, `scripts/assets/hall-wall-texture.py` →
`public/textures/wall/brick-v2_{basecolor,normal,orm}.webp`: real masonry, 240 × 73 mm bricks with 10 mm joints, a
250 mm brick pitch and 83.3 mm course pitch, running bond, one tile exactly 2.00 × 2.00 m at 2048 px (about 1 px per
mm). The joint is raked 10 mm deep with a roll-over at the arris and stays darker than the faces; the normal map keeps
full resolution so the relief survives the mip chain. No mid-scale clouds: v1's three-to-nine-metre "weather" read as
grey fog. What is larger than the tile lives in `src/components/hall/wallGrime.ts` — a ceiling gradient and a floor
skirt only, sampled in world coordinates, a third of v1's amplitude. Chain it AFTER `WallPaint.attach` and BEFORE
`HallLighting.decorate`. The floor is `concrete-v2_*` from `hall-floor-texture.py`, with the same split:
`floorReflectionShader.ts` adds a world-space hook at `<roughnessmap_fragment>` (slow cloudiness in the sealer, and the
dull walking lane in front of the machines that breaks up the reflection); cache key `-rough-planar-v3`.

**Focused screens are sharp.** In the case pose the glass covers about 550 framebuffer pixels, so a fixed 1024 canvas
lands between two mip levels and the GPU blends them. `fitTexture` now takes a target long edge and `sharpenFocusScreen`
(hallScene.ts) redraws the focused machine's capture on the screen's own footprint once the camera stands — only that
machine, only outside the hall, no extra bytes: the case page has the full-resolution capture loaded anyway.
