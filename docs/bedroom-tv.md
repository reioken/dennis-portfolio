# Bedroom Nintendo corner — updated October 8, 2026 (v4 candidate)

**Released October 8, 2026: model v9 (`/models/bedroom-tv-v9.glb.gz?v=7e5f11d6`) in `21f0d0e` / Pages `70f1afb8`.**
The corner loads after the room's reveal and is hit-tested by its bounds (weak-PC pass, see handover).

Current continuation and site-wide priorities: [Claude handover — October 8](../HANDOVER-CLAUDE-2026-10-08.md).

## Latest verdict — October 8, 2026

Dennis rejected the appearance of the procedural v1 meshes: they need substantially more polish.
He also rejected the Tripo/Blender v2 result: broken and mushy textures, particularly on the GameCube,
then explicitly required fixing **all objects**. V2 is rejected, not pending approval. All fifteen source
types are included in the current correction pass; generation success and functional checks are not
evidence of acceptable visual quality.
The functional QA below is historical and does not constitute visual approval. Keep v1 as a rollback only.
The requested replacement pipeline is separate high-fidelity reference images for every corner piece,
Tripo.ai image-to-3D generation, then Blender cleanup and polish. Do not replace this pipeline with
another procedural rebuild without Dennis's instruction.

The arrangement must feel like his childhood bedroom: uneven horizontal stacks of GameCube cases
with readable side spines, casually placed controllers and cartridges, and mixed game piles.
Super Smash Bros. Melee remains prominent, with Zelda games, SNES Yoshi's Island and N64 Smash Bros.
The rounded graphite stand selected from mockup 03 and its position right of the claw remain the target.

Replacement source images and Tripo exports belong in ignored `.source-assets/bedroom-tv-tripo/`.
Record each image, job, downloaded source and polish result before treating a replacement as complete.

Fifteen individual input images are saved in `.source-assets/bedroom-tv-tripo/references/`, with a local
`reference-board.md`. Names, original generated image paths, SHA-256 hashes, byte lengths and actual
job/polish states are recorded in `scripts/models/bedroom-tv-tripo.references.json`.
They cover stand, CRT, five systems, three controllers, horizontal GameCube stack, retro pile,
single DVD-size game case, PAL SNES cartridge and N64 cartridge. Game packaging uses blank inserts;
the original art listed below and crisp title spines must be applied during Blender polish.

Dennis restored the desktop app and signed in on October 8. All 15 H3.1 Best Quality geometry jobs and
15 separate 4K texture jobs completed: 450 geometry + 300 texture = **750 existing credits**.
Remove Lighting was enabled. Original geometry and textured GLBs are retained in `raw/` and `textured/`;
the manifest records actual job URLs, byte lengths and SHA-256 hashes. All 15 sources were polished in
Blender, assembled and integrated as v2. **Visually rejected by Dennis.**
Production and v1 remain unchanged. No account purchase, commit, push or new hosted release.

## Current review candidate — v7 (October 8, latest, unapproved)

Dennis on v6: "New tv still looks bad. the speakers dont even fit it properly", SNES plug "still wrong". v7 rebuilds the
CRT layout from measurements of `references/crt.png` (see `bedroom_tv_crt_build.py` docstring: 0.50 × 0.47 m front,
7.5 % / 7 % / 19 % margins, speaker grilles filling the chin's outer fifths inside the rounded corners, tighter
corners, Trinitron-style glass) and adds a triplanar paint flake for the TV's silver in `bedroomTv.ts`. The SNES plug
is now a stadium-section moulding as wide as the slot, seated at the slot centre measured on the ortho map
(canonical x −.163, z .126). Model `/models/bedroom-tv-v7.glb.gz?v=3f3fc963` (521,830 triangles, 4.51 MB gzip).
Preview **http://127.0.0.1:4342/**; checks as v6 plus the loader QA; close-ups `tv-v7-pieces/`, QA `tv-v7-qa/`.
The same preview carries the new loading line (handover, October 8 latest). **Not judged by Dennis.**

## Previous candidate — v6 (October 8 night, superseded by v7)

Dennis on v5: some textures don't look good / are wonky; the TV looks weird (shape, screen-to-edge ratio); case
sides must be the actual spines of popular games; the Smash 64 cartridge doesn't look like the real one; the SNES
controller plug is wrong; cables clip into the shelf; the N64 controller is weirdly placed; spikes at the bottom
of the GameCube's grey fascia.

`scripts/models/blender/bedroom_tv_v6_swap.py` (v5 plus):
- **TV** (`bedroom_tv_crt_build.py`) rebuilt to the reference photo's proportions: 0.50 × 0.445 m front with large
  rounded corners, screen opening with 8 % side margins, 13 % above, a 16 % control chin; deep dark surround and a
  black tube border on the curved glass; strongly tapered rear; vents follow the housing.
- **GameCube cases** use the real printed spines and fronts: `scripts/models/bedroom-tv-gc-covers.mjs` downloads
  GameTDB full case scans (PAL/EN, URLs and hashes in `bedroom-tv-art.sources.json`), crops spine and front, and
  builds one spine atlas (`.source-assets/bedroom-tv/gc/spines-atlas.png`, 12 games). Tall stack: Metroid Prime,
  Luigi's Mansion, Pikmin, Sunshine, Twilight Princess, Double Dash, Wind Waker cover-up; pile: F-Zero GX, Animal
  Crossing, Paper Mario TTYD, Mario Party 4 cover-up; Melee leant against the stack.
- **N64 cartridges** modelled to the real cartridge (`bedroom_tv_parts_build.n64_cart`: 116 × 75 × 19 mm, arched top,
  narrower foot, grooves, 61 × 49 mm label recess, connector opening) with the PAL label layout filling the label
  (`bedroom-tv-cart-labels.mjs`): Smash 64 in the console, gold Ocarina, Mario Kart 64 standing by the boxes (the
  generated pile cart is removed), Super Mario 64 on the boxes. SNES cartridges stay Tripo.
- **Plugs** (`bedroom_tv_parts_build.plug`): SNES plug with flat underside, rounded top, grip ribs and boot; N64 plug
  in the same family, smaller; GameCube plug round.
- **Cables** rest on the shelves with their full radius (the clamp had let the lower 80 % of the tube sink in).
- **N64 controller** lies in front, clear of the console, turned casually.
- **GameCube**: all generated grey on the front is body colour (the authored fascia covers the panel), the fascia
  sits 9 mm proud, embossed POWER/RESET/OPEN relief ironed, port keys darker. **SNES**: dark AI paint dashes on the
  upper rims removed.

Delivery: **521,082 triangles**, 50 materials, **4,513,007 gzip bytes**, `/models/bedroom-tv-v6.glb.gz?v=965f10ef`.
Isolated candidate `bedroom-v6-release/` (`prepare-bedroom-v6-release.mjs`), built preview **http://127.0.0.1:4340/**.
Verified: TypeScript, 39 tests, 31 hashes, Astro build, 61-page audit, corner QA **17/17** (`tv-v6-qa/`), HTTP bytes
and preloads (`tv-v6-built-checks.json`), perf RTX 60 fps / AMD iGPU hall 35.8, navigate 30.2 fps, 21 MB, no errors
(`tv-v6-perf/`). Close-ups `tv-v6-pieces/`, assembly `tv-v6-assembly/`. Repo runtime still v2. **Not judged by Dennis.**

Reproduce: `node scripts/models/bedroom-tv-gc-covers.mjs`, `node scripts/models/bedroom-tv-cart-labels.mjs`, then
`blender -b -P scripts/models/blender/bedroom_tv_v6_swap.py -- .source-assets/bedroom-tv-tripo
.source-assets/bedroom-tv-tripo/bedroom-tv-v3.blend .source-assets/bedroom-tv-tripo/bedroom-tv-v6.blend OUT.glb RENDER_DIR`,
copy to `public/models/bedroom-tv-v6.glb` and `.source-assets/models-original/`, pack and gzip `--only bedroom-tv-v6`.

## Previous candidate — v5 (October 8 night, superseded by v6)

Dennis on v4: GameCube's grey fascia too wide for the purple box; cables weird, especially the TV; the TV needs
better texture and more polish; some cartridges don't show their image properly; controller cables have no plugs in
the ports; the Game Boy floats; cases shouldn't just stand there but be stacked the way a kid would.

`scripts/models/blender/bedroom_tv_v5_swap.py` (from the v3 Blend, includes all v4 rebuilds) answers each point:
- **GameCube** rebuilt from its Tripo surface (`bedroom_tv_source_rebuild.py`, id `gamecube`). The generated fascia
  was too sparse to stay flat, so `_gc_front_plate` authors it at the measured place: 77 % of the front width with
  indigo frame around it (as on the real console), four port openings with sockets, two recessed memory-card doors,
  SLOT-A/SLOT-B and the port dots. Black disc lid with NINTENDO GAMECUBE, Nintendo badge.
- **CRT** modelled in Blender after the Trinitron reference (`bedroom_tv_crt_build.py`): chamfered silver bezel,
  recessed screen with dark surround and curved glass (Melee capture), tapered rear housing, top and side vents,
  perforated speaker grilles, power key and red LED, five keys with TV/VIDEO, VOLUME, CHANNEL printing, AV panel with
  yellow/white/red jacks and VIDEO L-AUDIO-R, SONY (serif) and Trinitron. Same size and spot as before.
- **Cables** are round (8-sided, 10 segments per span) and clamped onto the shelves. Controller leads end in plugs
  seated in port 1 of their console (GameCube round plug, SNES and N64 flat plugs, strain-relief boots) and run to
  the controller's cable exit. The GameCube AV lead has three RCA plugs in the TV's front jacks, joins, drops over the
  deck edge and runs round to the cube's back. Mains leads leave the backs and drop behind the stand.
- **Cartridge labels** are composed by `scripts/models/bedroom-tv-cart-labels.mjs`: SNES labels show the whole box
  art at label height over its blurred extension; N64 labels the whole art (with its NINTENDO64 band) on black.
  The pile's generated lying cartridge is removed; a real Super Mario 64 cartridge lies on top of the SNES boxes.
- **Game Boy** (v3 model) rotated to lie flat on the deck, turned slightly.
- **Cases**: procedural DVD-size GameCube cases (19 × 13.5 × 1.4 cm) with spines from `print/spines.png`.
  A tall uneven stack (Metroid Prime, Luigi's Mansion, Pikmin, Sunshine, Double Dash, Wind Waker on top cover-up and
  twisted), a smaller twisted pile (Pikmin, Double Dash, Sunshine), and Melee leant against the tall stack facing
  the room.

Delivery: **553,681 triangles**, 48 materials, **4,418,987 gzip bytes**; `/models/bedroom-tv-v5.glb.gz?v=79729d9b`.
Raw export `.source-assets/models-original/bedroom-tv-v5.glb`; Blend `.source-assets/bedroom-tv-tripo/bedroom-tv-v5.blend`.
Isolated candidate `bedroom-v5-release/` (prepared by `prepare-bedroom-v5-release.mjs`), built preview
**http://127.0.0.1:4338/** (v4 stays on 4336, v3 on 4334). Repository runtime still references v2.

Verified on the v5 build: TypeScript, 39 tests, 31 hashes, Astro build, 61-page audit; `scripts/qa/bedroom-tv.mjs`
**17/17** (names updated to v5: `bedroom-cable-*`, `bedroom-case-stack-0`, `cover-label-*`) on a dev server of the
isolated source; HTTP bytes and desktop-only preloads (`tv-v5-built-checks.json`); performance RTX 60 fps,
AMD iGPU hall idle/pointer/navigate 36.0/35.9/30.3 fps, 20.9 MB, no errors (`tv-v5-perf/`). Evidence:
`tv-v5-assembly/`, `tv-v5-pieces/` (close-ups from the saved Blend), `tv-v5-qa/`. **Not judged by Dennis.**

Reproduce: `node scripts/models/bedroom-tv-cart-labels.mjs`, then
`blender -b -P scripts/models/blender/bedroom_tv_v5_swap.py -- .source-assets/bedroom-tv-tripo
.source-assets/bedroom-tv-tripo/bedroom-tv-v3.blend .source-assets/bedroom-tv-tripo/bedroom-tv-v5.blend OUT.glb RENDER_DIR`,
copy to `public/models/bedroom-tv-v5.glb` and `.source-assets/models-original/`, pack and gzip `--only bedroom-tv-v5`.

## Previous candidate — v4, recorded Tripo surfaces kept (October 8 evening, superseded by v5)

Close inspection of v3 showed that its "correction" had replaced several good Tripo shapes with flat,
smoothed retopology: both N64/GameCube controllers were extruded plates (squashed further by per-axis
placement scaling), the N64 shell was lumpy, the DS had lost its black keys and silver shell, cartridges
and the retro pile were crumpled, and the pile's N64 cart carried a SNES Yoshi label. The raw Tripo H3.1
geometry for these pieces is accurate; v2/v3 failures came from heavy decimation, smoothing, baked AI paint
and the retopology, not from the generated shapes.

v4 therefore keeps the recorded Tripo surface and replaces only its paint, in Blender:
`scripts/models/blender/bedroom_tv_source_rebuild.py` welds each 190k-face `textured/` source, reads its
4K map only to classify faces into a small clean palette (Lab distance), cleans the labels on the face graph
(majority filter, crease snapping so colours end on moulded edges, island merge), irons out illegible generated
lettering, adds planar caps where a few large generated triangles shaded unevenly (N64 lid, reset key, logo oval),
reduces to a web budget and projects clean printed lettering (Nintendo, GAMECUBE, START/PAUSE, POWER/RESET,
SUPER NINTENDO, MEMORY EXPANSION, SELECT/START, button letters) plus the SNES emblem dots onto the real surface.
No AI texture reaches the model. `bedroom_tv_v4_swap.py` opens the saved v3 Blend, removes the replaced
v3 bodies and their detail parts, places the rebuilt pieces with uniform (real-proportion) scale, applies
cover art in the moulded label recesses (SNES labels keep the title band, N64 labels a centre crop), seats
Yoshi's Island in the SNES and Smash 64 in the N64 by ray-casting the slot floor, shares v3's identical clean
materials, exports, renders and saves `.source-assets/bedroom-tv-tripo/bedroom-tv-v4.blend`.

Rebuilt from Tripo surfaces: N64, PAL SNES, original silver DS, N64 controller, GameCube controller, SNES and
N64 cartridges (Yoshi's Island, Smash 64, gold Ocarina, A Link to the Past), retro pile. Carried over unchanged
from v3: stand, CRT, GameCube, Game Boy, SNES controller, GameCube case stacks, Melee/Wind Waker cases, DS/GB
boxes and cables. The pile now shows a Super Mario World box, a standing Mario Kart 64 and a lying Super Mario 64
cartridge (`scripts/models/bedroom-tv-art-extra.mjs` fetched those covers and Donkey Kong Country, unused, from the
same libretro source; URLs and hashes appended to `bedroom-tv-art.sources.json`). Controllers rest on their grips.

Delivery: **643,386 triangles** (v3 742,449), 51 materials before runtime batching, **4,996,219 gzip bytes**
(v3 5,928,346), packed 6,576,852. Candidate URL `/models/bedroom-tv-v4.glb.gz?v=6a3bad0f`, SHA-256
`6a3bad0ff6bda503866ca68fcb2da6136b844a60ff11e36c6c91a434baf314d8`. Raw export preserved at
`.source-assets/models-original/bedroom-tv-v4.glb`. The repository runtime still references **v2**; only the
isolated candidate uses v4. No Tripo credits were used for v4.

Isolated candidate: artifact root `bedroom-v4-release/` (v3 candidate source + the v4 model, scripts and the
one-line `BEDROOM_MODEL` change; manifest `bedroom-v4-release-sources.json`, prepared by
`prepare-bedroom-v4-release.mjs`). Built preview **http://127.0.0.1:4336/**; the v3 comparison runs on 4334.

Verified on October 8 (actual v4 build, not historical):
- TypeScript, 39 review tests, 31 model hashes, Astro build, 61-page audit.
- `scripts/qa/bedroom-tv.mjs` **17/17** against a dev server of the same isolated source (dev-only
  `astro.qa.config.mjs` relaxes Vite's fs allow list for the junctioned node_modules): decode and batching
  under 60 draws / 750k triangles, all fifteen assemblies, placement right of the claw, covers and screens,
  pointer and keyboard open, arrow key, Escape with opener focus, return button, hi-fi open/close, both GPU
  recoveries (WEBGL_lose_context), short desktop 1344×730, phone exclusion, no errors. Evidence `tv-v4-qa/`.
- Built preview: DE/EN labels, focus to return and back, 1000×740 framing, no overflow or errors
  (`tv-v4-qa/built-*.png`); exact gzip/decoded bytes and desktop-only preloads (`tv-v4-built-checks.json`).
- Performance, headless `scripts/qa/live/perf.mjs`, v3 vs v4 builds: RTX 5090 hall 60 fps both; AMD iGPU hall
  idle/pointer/navigate 35.4/34.3/30.6 (v3) vs 34.2/35.5/30.2 fps (v4), within noise; ~21.5 MB transferred
  (`tv-v4-perf/`). Inspect-pose frame rate was not measured separately.
- Close-ups of all fifteen piece types rendered from the saved v4 Blend: `tv-v4-pieces/` (+ `review.json`);
  assembly views `tv-v4-assembly/`.

Known remaining imperfections (visible in close-ups): faint ghosts of ironed relief under some reprinted logos,
slight surface crumple on the DS lid around the speakers, the N64 front badge uses a NINTENDO64 print without the
coloured N cube, a small grey sliver on the pile's lower box, SNES side edges carry a few dark paint dashes, and the
GameCube stack top cover duplicates Wind Waker. **Not visually accepted by Dennis.**

Reproduce: `blender -b -P scripts/models/blender/bedroom_tv_v4_swap.py -- .source-assets/bedroom-tv-tripo
.source-assets/bedroom-tv-tripo/bedroom-tv-v3.blend .source-assets/bedroom-tv-tripo/bedroom-tv-v4.blend OUT.glb RENDER_DIR`,
copy OUT.glb to `public/models/bedroom-tv-v4.glb` (and `.source-assets/models-original/`), then
`pack-models.mjs --only bedroom-tv-v4` and `gzip-models.mjs --only bedroom-tv-v4`. Close-ups:
`blender -b .source-assets/bedroom-tv-tripo/bedroom-tv-v4.blend -P scripts/models/blender/bedroom_tv_v4_review.py -- OUT_DIR`.
Single-piece inspection: `blender -b -P scripts/models/blender/bedroom_tv_source_rebuild.py -- .source-assets/bedroom-tv-tripo OUT_DIR <id>`.

## Superseded candidate — Tripo source, Blender v3 (unapproved, replaced by v4 for review)

`bedroom_tv_surface_correct.py` reprocesses all fourteen non-GameCube source types with direct clean
PBR materials and retained generated geometry. `bedroom_tv_gamecube_polish.py` corrects the GameCube's
front fascia, four physical ports, closed memory-card covers, lid and printing, preserving its source
side shell/vents and handle. These candidates remove the former hardware transfer/AO texture bake.

`bedroom_tv_artist_repairs.py` contains local retopology and control/printing repairs. The stand's
damaged laminate decks and posts follow the generated proportions; its original feet remain.
`bedroom-tv-corrected-assembly.mjs` produces `bedroom_tv_corrected_assemble.py`, preserving the candid
placements and using each original game cover at its full resolution rather than a square atlas.
Clean fitted printing surfaces prevent source triangles from cutting through the DS screens and covers.

All fifteen source types have now received the correction pass. Controller shells use continuous
retopology sampled from the generated silhouettes; the N64 has a closed replacement surface following
the source dimensions. Hardware has no AI texture maps. Console ports, buttons, sticks, printing,
handheld screen surrounds and shelf surfaces receive local Blender repairs. The finishing script
cuts nineteen physical N64 top vents. Thirteen separate artwork maps retain the original cover and
screen dimensions; Melee and Wind Waker face forward, with readable horizontal case stacks.

Editable final candidate: `.source-assets/bedroom-tv-tripo/bedroom-tv-v3.blend`. Exports in `corrected/`
are intermediate sources; the final artist repairs live in the assembled Blend and assembly scripts.
`bedroom_tv_corrected_review.py` renders all fifteen actual assembled pieces, including final artwork.
Every row in `tv-v3-final-pieces/review.json` records the same final Blend SHA-256. Three assembly views
in `tv-v3-assembly/` were rendered from that saved source after the ventilation pass.

Delivery: **742,449 triangles**, **44 materials/static batches**, **13 artwork maps**,
**5,928,346 gzip bytes**. Candidate URL: `/models/bedroom-tv-v3.glb.gz?v=5bfa96da`.
The packed model is 8,714,980 bytes. The actual gzip passes finite attributes, valid indices, required
assemblies and textured UV bounds checks. These numerical checks do not constitute visual approval.

Review at **http://127.0.0.1:4334/**, built from isolated `bedroom-corrected-release/` over the preserved
v2/approved hi-fi snapshot. TypeScript, all 39 review tests, 31 hashes, Astro build and the 61-page audit
pass. HTTP checks confirm the exact compressed and decoded model bytes and desktop preloads on DE/EN
home pages. Evidence: `tv-v3-delivery-audit.json`, `tv-v3-built-checks.json` and
`bedroom-corrected-release-sources.json` under the artifact root below.

**V3 remains unapproved.** Browser automation fails before execution with “failed to write kernel assets:
The system cannot find the path specified. (os error 3)”; no v3 interaction, GPU recovery or mobile UI
checks were performed. The repo runtime still references v2; only the isolated 4334 preview uses v3.
The older 4333 preview remains available as the rejected v2 comparison. No additional Tripo credits,
commit, push or hosted release. Review all pieces and the built interaction before activating v3.

### Reproduce the correction

Keep the recorded reference images and actual Tripo exports. Run `bedroom_tv_surface_correct.py` on
the fourteen non-GameCube sources, and `bedroom_tv_gamecube_polish.py` on the GameCube. Generate the
assembler with `node scripts/models/bedroom-tv-corrected-assembly.mjs`, then run its generated
`bedroom_tv_corrected_assemble.py` with source root, destination GLB and render directory arguments.
It imports `bedroom_tv_artist_repairs.py` automatically. Next run `bedroom_tv_delivery_finish.py`
with the saved Blend, destination GLB and finish-report paths; it also updates the saved Blend.
Preserve that raw GLB in `.source-assets/models-original/bedroom-tv-v3.glb` before packing with
`pack-models.mjs --only bedroom-tv-v3`, then `gzip-models.mjs --only bedroom-tv-v3`.
Audit the delivered gzip using `bedroom-tv-corrected-audit.mjs MODEL REPORT`. Render the saved final
Blend with `bedroom_tv_corrected_review.py` and `bedroom_tv_assembly_review.py`, then update provenance
using `bedroom-tv-correction-status.mjs`. Update the isolated runtime hash to match the actual gzip.

## Historical v2 — Tripo and Blender, visually rejected

`bedroom_tv_tripo_polish.py` welds and cleans the actual generated meshes, smooths their surfaces,
reduces geometry and rebakes classified clean paint, roughness and AO to their UVs. Tripo source shapes
remain the foundation. `bedroom_tv_tripo_assemble.py` places all pieces at physical shelf heights and applies
the original Nintendo covers/screens and new readable spine printing. Selective artist repairs clean the
CRT front bezel, speakers and RCA controls, and the GameCube front ports, memory slots and disc lid.
Two offset horizontal case piles, angled controllers, loose cartridges and curved cables provide the
requested candid arrangement. Melee and Wind Waker face forward; Yoshi's Island and Smash 64 are inserted
in their systems; Zelda cartridge labels and Link's Awakening on the Game Boy remain visible.

Full editable source: `.source-assets/bedroom-tv-tripo/bedroom-tv-v2.blend`.
Individual polished GLBs: `.source-assets/bedroom-tv-tripo/polished/`.
`bedroom-tv-tripo-print.mjs` prepares the spine/badge atlases; `bedroom-tv-tripo-web.mjs` preserves cover
and screen resolution while reducing hardware base maps to 1024 and PBR maps to 512 for web delivery.
Packing and gzip use the existing `pack-models.mjs` / `gzip-models.mjs` with `--only bedroom-tv-v2`.
The optional GPU parameters added to `hifi_paint.py` retain its previous CPU defaults; hi-fi assets were not rebuilt.

Delivery: **210,220 triangles**, **28 materials/static batches**, **5,447,498 gzip bytes**.
Runtime URL: `/models/bedroom-tv-v2.glb.gz?v=a1c96b20`.
All 15 source assemblies and CRT screen survive packing, with finite positions, normals and UVs.
The existing accessible inspect/return controls, placement and mobile exclusion are retained.
The larger model is desktop-only; its preload has `(min-width: 900px)`.

Historical v2 validation: TypeScript, 39 review tests, 31 model hashes, isolated Astro build and 61-page audit pass.
CUA checks on the actual built v2: visible hall placement and inspect framing; pointer and Enter entry;
Escape and return-button exit with opener focus restored; DE/EN labels; hi-fi menu still accessible;
1000×740 framing; 390×844 native mobile layout excludes the accessory and has no horizontal overflow.
No browser warnings/errors were observed. GPU recovery tests listed below belong to v1 and were not repeated
for v2. The automated corner suite was updated to v2 names/budgets but was not rerun this turn.

Built local preview: **http://127.0.0.1:4333/**, isolated `bedroom-tripo-release/` over the approved hi-fi snapshot.
Evidence root: `C:/Users/denni/.codex/visualizations/2026/10/07/01a117ee-e0f3-7ad3-961b-2f5d01aa0701/`.
`tv-tripo-v2-final/{assembly,front,games}.png` are Blender renders. `tv-tripo-{hall,inspect,short-desktop,phone}.png`
show the actual built site. `tv-tripo-built-checks.json` records the manual UI checks and model delivery hash.
`bedroom-tripo-release-sources.json` records the isolated source overlay. Hosted hi-fi and production are preserved.

## Historical v1 — visually rejected

Dennis selected mockup 03: rounded graphite shelves and silver tubular posts, a small silver CRT,
GameCube, PAL SNES, N64, original Game Boy and open silver original DS. It stands **right of the claw**,
opposite the hi-fi. His favourite **Super Smash Bros. Melee** faces forward beside the GameCube and appears
on the tube. Zelda Wind Waker, Ocarina of Time, A Link to the Past and Link's Awakening, SNES Yoshi's Island,
and Smash Bros. 64 are visible on their cases, boxes or cartridge labels.

## Pieces and source art

`scripts/models/blender/bedroom_tv_gen.py` builds the stand and CRT; `bedroom_tv_consoles.py` builds each
Nintendo system, the three controllers, games and wiring. `bedroom_tv_common.py` provides bevelled shells,
rounded lofts, printing, textured labels and cables. These are clean authored meshes, following the current
hi-fi's clean Blender hardware. They use physical geometry and flat materials rather than generated surface paint.

Thirteen named assemblies: `tv-stand`, `bedroom-crt`, `crt-screen`, `nintendo-gamecube`, `nintendo-snes`,
`nintendo-64`, `nintendo-gameboy`, `nintendo-ds`, `gamecube-controller`, `snes-controller`, `n64-controller`,
`bedroom-cables`, `bedroom-games`. Details include the deep tapered CRT/convex tube, grille holes and front RCA
plugs; console disc/cart wells, ports, vents and keys; handheld hinges, speakers, ports and stylus;
recognizable controller silhouettes, sticks, coloured buttons, shoulder keys, case spines and routed cables.

`scripts/models/bedroom-tv-art.mjs` obtains the named cover/screenshot references from the public
[libretro thumbnail collection](https://github.com/libretro-thumbnails). Nintendo is the original publisher of
the depicted covers/game images. Exact URLs and SHA-256 hashes are in `scripts/models/bedroom-tv-art.sources.json`.
Downloads and the atlas remain in ignored `.source-assets/bedroom-tv/`. Embedded GLB textures: one 2048×1024 cover
atlas, Melee match capture and handheld screen images. The DS capture is split into its two correct halves.
The Game Boy receives a green monochrome tint in the hall. This is a static visual prop, not an emulator.

## Build and runtime

```powershell
node scripts/models/bedroom-tv-art.mjs
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' -b -P scripts/models/blender/bedroom_tv_gen.py -- public/models/bedroom-tv-v1.glb OUTSIDE_REPO_RENDER_DIR
node scripts/models/pack-models.mjs --only bedroom-tv-v1
node scripts/models/gzip-models.mjs --only bedroom-tv-v1
```

Final model: **48,829 triangles**, thirteen assemblies, **943 KiB gzip**.
Runtime URL: `/models/bedroom-tv-v1.glb.gz?v=d2bb74e4` in `hallScene.ts`. Update the hash after a rebuild and run
`scripts/qa/hero/verify-hashes.mjs`. The GLB retains every assembly; `bedroomTv.ts` batches static geometry to
**26 material draws** after unpacking quantized attributes into float buffers and applying world transforms.
It shares the hi-fi's brushed finish helper, gives the curved tube restrained scanlines, and owns/disposes its
resources and DOM layer. No additional idle animation loop.

Placement relative to claw: X `+1.32`, Z `-1.13`, rotation Y `-.08`, scale `1.08`. Loads/compiles with the claw's
startup/late-load path; home/About preload the exact runtime URL. Native phone home/exhibits exclude the accessory.
Click the TV or accessible DOM button to inspect the shelf (`Pose='bedroom'`); the dock steps aside.
Return button, Escape or clicking the scene closes it. Opening focuses the return button; closing restores opener
focus. Labels are DE/EN. GPU recovery snapshots actual scene poses, preserving TV/hi-fi views; subsequent page
navigation takes precedence and recovery uses the latest page frame.

## Verification and evidence

TypeScript, 39 review tests, 31 hashes, isolated Astro build/61-page audit pass.
`scripts/qa/bedroom-tv.mjs`: **17 checks**, including real decode/batching, all pieces, position/art, pointer and
keyboard/focus, hi-fi access, two forced GPU recoveries, short desktop and native phone exclusion. No errors.
Built preview: **8 checks**, DE/EN controls, keyboard return, phone exclusion, exact served/decoded model bytes,
preload and no browser/network errors. Studio and actual final browser images were visually inspected.

Evidence root: `C:/Users/denni/.codex/visualizations/2026/10/07/01a117ee-e0f3-7ad3-961b-2f5d01aa0701/`.
`bedroom-release/` extends the approved hi-fi snapshot with only named TV files; dirty werkstatt data,
editor tooling and unrelated experiments are excluded. Local built preview: **http://127.0.0.1:4332/**.
Evidence: `tv-hall-qa-pass/`, `tv-built-{hall,inspect}.png`, `tv-built-checks.json`, `bedroom-release-sources.json`.
`tv-build-v2/` studio images predate the final geometry reduction; browser images show the actual packed model.
Previous `hifi-release/` and hosted `a25254be` are preserved. No commit, push or new hosted TV deployment.
