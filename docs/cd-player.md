# CD player beside the claw machine (October 5, 2026)

Dennis: a model "next to the claw machine on the left where you can play my music", generated as an image in Gemini
and modelled in Meshy, "an oldschool cd player … early 2000s, kinda silver". Local only; not committed or released.

## What is in the hall

A silver Y2K boombox with a front-loading disc window stands on a black road case 1.32 m left of the claw machine,
0.3 m in front of the cabinet line, turned 0.24 rad toward the room (`BOOMBOX_PLACE` in
`src/components/hall/boombox.ts`). It loads with the claw machine's station (inside the startup gate when the claw
machine is in the first view, otherwise prepared like a late station); a failed download leaves the corner empty and
never fails the hall. Desktop hall only; the phone pages have no hall.

- Click on the player: play, pause, resume. Click on the disc window: next track. After the last track it stops.
- Playing: the disc turns (1.6 turns/s, eased), the display shows track, transport symbol, a 14-band spectrum and
  the time; the violet speaker trims pulse with the bass (Web Audio analyser, relative to the track's running bass
  level). Paused: the time blinks. Stopped: track count and album length (`06`, `22:46`), as a CD player shows it.
  Digits and symbols only, no words.
- The music keeps playing while the hall is on screen, also in a background tab; it pauses when the hall is parked
  (another page) and stops when the hall is disposed.
- Reduced motion: the disc stands still, the spectrum stays dark, the trims hold one level.
- A DOM twin over the player's projected box (`HallBoombox.makeTwin`, placed by `HallScene.placeBoomboxTwin`) makes
  it a real link (Spotify) or button (hosted audio, `aria-pressed`) with a visible focus ring. Its hint says what a
  click does before it happens (hover, keyboard focus, or the first tap on touch; the second tap goes), in the About
  page's approved words: artist, title, „Auf Spotify hören ↗“ / “Listen on Spotify ↗”; with hosted audio the track
  number and title instead. It is hidden whenever the player is off screen or the hall is not in its hall pose, so
  there is no invisible tab stop. A pointer click on the twin still skips on the disc window (the hall raycasts the
  click point).
- `album.selfHosted` (`src/lib/album.ts`) is false: until the audio is on the site, a click opens the album on
  Spotify in a new tab. A track file that fails to load switches the player to the same fallback.

## Open decisions for Dennis

1. **Hosting the audio.** Copying the album into `public/` for streaming was blocked by the permission system; it is
   Dennis's call. The files would be the Mixea-style masters
   (`Projects/Music/release/memoryrot - a lifetime, briefly (mixea style)/wav`): Spotify's 30-second previews match
   that edition (waveform fit −21/−19 dB residual against −9/−12 dB for the original edition, tracks 1 and 4).
   Planned encoding: AAC 160 kbps `.m4a` with faststart, about 4–5 MB per track, file names as in `album.ts`; then set
   `selfHosted: true`. CSP `media-src 'self'` allows it and `functions/_middleware.js` passes requests through
   untouched; whether Pages answers byte-range requests (seeking, resuming) is still to be checked on a preview upload.
2. **Album cover on the disc label** (instead of the abstract print), from the same release folder.
3. Size, position and the road case are mine, open to his veto.

## Pipeline

```
MESHY_API_KEY=… python scripts/models/cd-player-generate.py image <name> "<prompt>" [aspect]   # nano-banana-pro, 9 credits
MESHY_API_KEY=… python scripts/models/cd-player-generate.py edit <name> "<prompt>" <reference>  # image-to-image, 9 credits
MESHY_API_KEY=… python scripts/models/cd-player-generate.py model boombox-e <concept-e.jpg> 30000  # meshy-7, 30 credits
node scripts/models/boombox-build.mjs [--debug <dir>]
npx gltf-transform optimize .source-assets/cd-player/boombox-built.glb public/models/boombox-v1.glb --texture-size 1024 \
  --texture-compress webp --compress meshopt --simplify false --join false --palette false --flatten false --prune-attributes false
node scripts/models/gzip-models.mjs --only boombox-v1      # prints the ?v= for BOOMBOX_MODEL
```

The Gemini API key in this environment is free tier, which has no image quota for any Gemini image model (429,
limit 0), so the concepts ran through Meshy's text-to-image with Google's `nano-banana-pro` (Gemini 3 Pro Image).
Concepts A–D (two portable players, two boomboxes) went to Dennis; D was the pick for the hall's scale (a 14 cm
portable would be a few pixels). D's CD lid on top is edge-on from the eye-height camera, so E (image-to-image from D)
moved the disc to a front window. 114 Meshy credits in all (six images, two models); prompts and task ids are in
`.source-assets/cd-player/state-*.json`.

`boombox-build.mjs` scales the Meshy model to 0.62 m wide (depth kept at 78 %: the reconstruction was too deep),
copies the faces over the display strip and the disc window into overlay meshes `boombox_display` and `boombox_disc`
(lifted 0.8 mm, planar UVs, the region's edge drawn by the overlay texture's alpha, not by triangle edges) and adds an
emissive mask of the violet trims (`boombox_trim`). Window and strip were measured on a flat-colour orthographic front
render (Blender Workbench) plus ray casts. The optimize flags keep the overlays' UVs and names
(`--prune-attributes false`; palette/join would merge their untextured materials). Model: 0.98 MB, 893 KB gzip.

## Checks

`node scripts/qa/boombox.mjs` on the dev server (needs `window.__hall`) tests whichever mode `album.selfHosted`
selects: Spotify fallback (popup, no opener, no audio), or playback with a synthetic beat in place of every track
(play, trim pulse, disc turning, next track, pause, resume), plus cursor, standby display and console errors.
