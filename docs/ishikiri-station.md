# Ishikiri station — October 5, 2026

## Production release — October 5

Dennis authorized commit and deployment. Source commit `15a5136` is pushed to
`feat/werkstatt`; Pages deployment `07fc6db3` is live at https://www.dennisbf.design.
The release was built from an isolated archive of that commit, excluding the local
editor, unrelated `src/data/werkstatt.json` edit and untracked experiments.
TypeScript, 31 tests, 29 model hashes and the 61-page build audit passed. All 60
checked live JavaScript/CSS/model/art/poster files match the release build by SHA-256.
Desktop and mobile browser checks confirmed the beige cabinet, white logo screen,
14 selectors, model entry, screenshot switching and full-screen. No console errors
were observed. Mobile verification used an emulated viewport, not a physical phone.

## Current revision: beige cabinet and series-style graphic

Dennis rejected the scenic side illustration and requested the graphic style of
the other machines, plus a beige/yellow cabinet. The active model is now
`cab-ishikiri-v2` (`de3ab319`), with matching paint/panel recipe colour `#d3bf88`.
The active side print is `ishikiri-v2.webp`: a sparse charcoal split-stone/jade
emblem on warm beige, generated with Riftback and Nexus prints as style references.
Exact built-in image_gen prompt: `scripts/assets/ishikiri-side-art-v2.json`.
The mobile poster pair uses the `ishikiri-v2` filename as well.

Dennis also requested the logo fill the white TV screen without an inset box.
The official transparent ink logo is encoded as `media/ishikiri/logo-ink.webp`;
Ishikiri's TV identity phase uses a full white canvas with no coloured halo.
The content/card logo and actual gameplay captures remain unchanged.

The original implementation below records the preceding local iteration.

Local implementation requested by Dennis: add Ishikiri as the first project
machine using his October 4 marketing pack. About remains the entrance; Ishikiri
is station 02/14, directly before Riftback, on desktop and mobile.

Nine images from `C:/Users/denni/Projects/ishikiri/build/marketing/2026-10-04` are
encoded as full 1920 px and small 720 px WebP/AVIF, without added graphics. Includes
official title key art, carving, Ushi-Oni, Ryujin, festival stall, companions,
journey, forge and minerals. Original SHA-256 provenance is in
`scripts/assets/ishikiri-media.json`. The TV mark is the official paper logo.
DE/EN copy summarizes the product README and supplied captures; status stays in
development. No public download or playable web build is claimed.

`cab-ishikiri-v1.json` uses the approved hero pipeline: 1.95 m height, 0.9 m width,
16:9 recessed display, single joystick, six controls, coin door, charcoal paint,
jade trim and its own wear seed. 14,796 triangles; gzip about 389 KiB,
cache hash `7cf3d857`. Source bake maps remain in `.source-assets/models-in/`.

The side print adapts official key art using built-in image_gen: parchment,
ink/watercolour mountains, pine, suspended jade stone and small ronin. Exact prompt
and provenance: `scripts/assets/ishikiri-side-art.json`; runtime asset:
`public/textures/cabinet-art/quiet-v2/ishikiri.webp` (768x1152). Both side meshes use
this print. Mobile posters were captured from the real isolated HallScene, then
encoded at 780x940 and 390x470. The temporary capture route was removed before the
final build.

The physical marquee needed a fourteenth selector. `navigation_marquee.py` now
exports `navigation-marquee-v2`, with 14 slightly narrower real Blender key
assemblies within the existing rail. All node names and tactile controls remain.
Textures were WebP encoded with `shrink-textures.mjs --only`, then packed/gzipped;
hash `f48b04d9`, about 453 KiB. No runtime primitive substitutes.

Validation: TypeScript, 31 review tests, 29 model hashes and 61-page build audit
pass. Browser checked at 1440x960 and 390x844: first-machine order, side artwork,
14th selector, project page, joystick screenshot switching, return to marquee,
mobile directory, live model zoom, screenshot switching and full-screen. No console
errors observed. This describes the earlier local iteration; the v2 revision above
is now committed and deployed.

The mobile redesign shipped in the same release. Preserve the unrelated local
werkstatt data and experimental untracked files.
