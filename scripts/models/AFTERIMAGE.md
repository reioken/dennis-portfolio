# Afterimage machine rebuild — 10 September 2026

All 15 active hall stations retain their original roles: four arcade cabinets, desktop terminals, phone kiosks, jukebox, claw machine and telephone. The archived Angry kiosk is rebuilt too (16 GLB files total). The hanging TV uses rounded geometry in hallScene.ts.

The Blender pass adds smoother bevels and round parts, stationary machined button collars, panel fasteners with slots, darker cabinet finishes, and UV-mapped artwork inserts. All 15 active stations now have original generated print artwork in `public/textures/cabinet-art/`; project captures remain on displays and in the gallery. Cabinet and terminal control decks use dedicated `deck_art` meshes, and the jukebox selector strip has its own deck insert. Kiosks and the claw machine have front/side artwork, while the telephone has a front insert. Marquees keep the real project names. The telephone has a curved handset, numeric keypad, coin return, speaker ports and a spiral cord with strain relief.

PNG originals, exact prompts and generated-source provenance are retained in [the artwork inventory](../../design-mockups/afterimage-textures/README.md). These illustrations supply albedo; physical finish and lighting are applied separately. The archived Angry kiosk retains artwork slots but has no newly generated illustration in this active-station set.

## Rebuild

Run from the repository root with Blender 5.2 installed at the path in the build script:

```powershell
node scripts/models/rebuild-afterimage.mjs
node scripts/models/optimize.mjs --in .source-assets/models-afterimage
node scripts/models/verify-afterimage.mjs
```

Editable Blender files and raw exports: `.source-assets/models-afterimage/<machine>/`.
Runtime files: `public/models/`.
Baseline source and assets from before this implementation: `.source-assets/afterimage-baseline-2026-09-10/`.

The verifier checks named runtime bindings, explicitly required artwork slots for each machine layout, complete `TEXCOORD_0` UVs on displays and front/side/deck artwork, a 50k triangle ceiling per machine, and exact hashes for the existing Dennis puppet and Nori assets. Those character files are not regenerated. Model files are approximately 136–436 KiB, with 7k–26k triangles per asset.

## Interface integration

- Dark navigation, balanced station dock and project directory; all 15 stations preserved.
- Every cabinet pair has the same 1.52 m clear gap, with mascots centered in that space. The home view starts at the leftmost About Me claw machine.
- Project names are painted into the brick material, sharing its mortar, normal map and lighting. The smaller, lower title scales to phone widths; the TV is larger.
- Project navigation and camera movement run together; the loading shell appears immediately. Gallery projection follows the moving screen without a settled-camera timer.
- Desktop floor reflection remains enabled through performance tiers at reduced resolution. Colored emitter footprints support lower GPU tiers; ceiling-light spacing is independent of cabinet spacing.
- Project screenshots moved above the written case study.
- Compact desktop screenshot transport leaves the physical deck clear.
- Mobile gallery keeps a large image with touch navigation.
- Contact stays in the persistent hall beside its telephone.
- Station selection no longer changes through an automatic idle tour.
- TV light remains attached to its moving rig; matte rounded bezel avoids a narrow reflective edge.

## Verification status

The current 16 model exports pass the extended artwork-slot and UV checks, including the jukebox selector deck. Dennis and Nori hashes still match the saved baseline. Results are written to `.source-assets/models-afterimage/verification.json`.

The current generated-artwork revision passes TypeScript, all six interaction/arcade regression tests, the production build, the 50-page link/metadata audit, and the extended model verifier. Browser checks covered desktop hall framing, all 15 directory entries, Echo joystick and NEXUS trackball next-image actions, the original puppet in About, the telephone/contact panel, and English mobile Berry gallery next/return actions. Fresh mobile startup was checked after fixing hidden CSS carousel scroll events that changed WebGL selection. Physical reflection quality is reduced on small/weak devices. No contact message was sent and nothing was deployed.

### Earlier implementation checks

TypeScript, six interaction/arcade regression tests, production build, 50-page link/metadata audit, and model checks passed. Browser checks covered the station directory, project-to-gallery navigation, NEXUS trackball and Echo joystick next-image actions, About with the original puppet, telephone contact, English mobile Berry gallery and return navigation. No contact message was sent and nothing was deployed.

Use the production preview at http://localhost:4322/ for visual review. The local development browser tab crashed during this session; production-preview checks remained stable. The existing initial-JavaScript bundle warning remains (about 1.31 MB reachable, before transfer compression).

## Painted-wall and mascot-spacing revision

The wall title is now pigment inside the existing brick material, using the same surface normals and mortar shading. It is smaller and lower; the TV is 1.85 m wide. Mascot stations reserve 0.72 m beside the cabinet, with a larger bay for the taxi. Project framing leaves extra vertical room for mascots. The puppet and character asset files are unchanged.

Desktop hall and Sauté project layouts were inspected at normal and 1280×720 viewports. TypeScript passes. During the mobile resize check, the in-app browser crashed and subsequent preview access was blocked by its client. Paint masks now allocate fresh texture storage when label dimensions change; the final mobile visual check remains unverified.

## Quiet full-side artwork and reflection revision (2026-09-10)

Fifteen new generated print textures replace the busy illustrations at runtime. Each uses one dominant motif with substantial dark negative space. Originals, the exact built-in image_gen prompts and provenance are in design-mockups/afterimage-textures/quiet-v2; compressed runtime files are in public/textures/cabinet-art/quiet-v2. Earlier artwork remains archived.

Arcade, terminal and kiosk side artwork follows the full cabinet silhouette with continuous UVs, including the top and bottom. Jukebox and telephone artwork follows their evaluated bevelled side surfaces. Claw artwork follows the solid base; its glass and original puppet remain intact. Front and control-deck inserts are plain dark satin, retaining all physical controls, labels, fasteners and trim.

The floor now uses a softer, angle-dependent reflection with distance falloff. Removed three artificial floor point lights and overlapping additive footprints from the reflected desktop scene. The low-GPU fallback retains restrained emitter footprints. Side lacquer has lower clearcoat and environment intensity to avoid harsh reflections.

Validation: all 16 rebuilt/optimized exports pass required art slots, complete UVs, full cabinet/terminal/kiosk side-height coverage, retained control bindings and geometry budgets. Dennis and Nori hashes are unchanged. TypeScript, all six regression tests and the production build pass. Desktop browser inspection confirms quiet front panels, full-height side art, subdued floor reflections, the initial About station and all 15 directory entries. Echo screenshot view opens and its physical joystick target advances from capture 1 to 2; returning to the hall also passes. The updated gallery was visually checked at 430 x 900 and the normal preview size was restored. One directory-to-project navigation crashed the in-app browser; a fresh direct Echo page rendered and worked. That transition is not signed off. Nothing deployed.

## Backlit signs, presentation timing and maintained surfaces (2026-09-10)

Project signs now use one crisp, medium-weight Outfit treatment with a restrained backlit halo and colored lower edge. Each texture is rendered at its sign's measured physical UV aspect; text is resized uniformly, never compressed horizontally. Full project logos are reserved for the rear TV, centered with their original proportions and without duplicated captions.

The rear TV owns an independent presentation clock, starting after arrival and logo readiness. It holds the logo for 15 seconds after its 1.2-second entrance, dissolves to a single screenshot, holds screenshots for 7.5 seconds, and returns to the logo after up to three captures. Subsequent shot dissolves last 800 ms. Parked and reduced-motion TVs keep a static identity. TV and cabinet dissolves blend resident textures on the GPU, with no per-frame canvas uploads.

Hall cabinets always show their first hero screenshot. Only the selected cabinet's info view cycles (every 7 seconds, after WebGL is ready and while the document is visible). Hovering/selecting a capture, switching surface, or opening the manual screenshot view pauses autoplay for that project visit. Manual selection persists on return from close-up; automatic changes do not generate live-region announcements.

Glass uses low diffuse opacity, angle-dependent reflections, sparse scratches and cleaning marks in roughness, and dust near the gasket. Runtime UV projection restores coordinates removed by GLB optimization. Paint and printed panels have restrained, stable edge chips and lower-body scuffs; their placement accounts for the rotation of each GLB insert. No character/model asset was changed.

Reflection attachments now stay at a fixed 512 x 256 instead of reallocating within onBeforeRender. The preview crashed once during a close-up return before this adjustment. The subsequent retest passed hall-to-Riftback navigation, opening close-up, trackball advance from capture 4 to 5, and return to the info view with capture 5 still selected after more than one autoplay interval. This is a successful retest, not a claim of broad browser stability.

Validation: TypeScript, all ten regression tests (including TV hold/cycle/reduced-motion cases), production build and the 50-page link/metadata audit pass. Browser inspection confirmed the clear screen contrast, consistent signs, info-view autoplay and fixed hall screens.

### 2026-09-10 — immediate arcade navigation and convex screen glass

- Hall routes suppress native page snapshots and skip the browser transition during the DOM swap. The existing WebGL camera moves concurrently; panel arrival is 140 ms, exit is 100–120 ms. Return-to-hall now sets the leaving state at navigation start, including top-nav/Back/Escape paths. Case pages also prefetch the hall URL. Reduced motion disables panel animation.
- Runtime monitor glass is a 32×24 curved lens with its rim fixed in the original bezel and a physical bulge of 2.8% of the shorter dimension. Handles quantized/nonuniform GLB transforms without changing shared source geometry, screen images, or control projection. Claw enclosure remains flat.
- Reflection-only blending retains highlights at low opacity; dark diffuse prevents a milky overlay. Existing roughness scratches remain. Strongest reflections scaled to 65% for screenshot readability.
- Validation: typecheck, build, 11 regression tests, 50-page audit passed. Browser route-swap readings: opening 30–45 ms, returning 30–107 ms (local preview, excludes camera finish). Repeated hall/project and close-up/control/return interactions checked.

- Follow-up stability: the Sauté direct-entry → hall sequence crashed after TV playback advanced. Moving the floor reflection outside the main pass did not resolve it and was reverted. Disabling TV updates did prevent the failure. TV slides now use immutable CPU pixel buffers (DataTexture), cached with a 12-slide bound; eviction protects both images in the active dissolve. Logo holds and crossfades are unchanged. Temporary diagnostic switches were removed.
- Final browser verification with TV restored: Sauté remained usable beyond the previous failure interval and a complete playback cycle; reopening measured 38 ms, followed by close-up → project → hall at 31 ms. One persistent scene canvas remained, and the case panel was removed on exit.

### 2026-09-10 — remove interim window; spectrum project rail

- Removed hall-opening entirely (markup, state, styles). No miniature title/summary placeholder before the actual case. Removed the extra case-card entrance animation. Navigation timing now also records two animation frames after the swap, measured from input capture: full panel 132–142 ms in the current narrow preview, with zero placeholder elements.
- Added a restrained moving gradient line above the bottom dock. All 15 station stops are directly clickable, show the current station, and reveal names on hover/focus. Arrow keys and Home/End move focus and selection together. Reduced motion keeps a static gradient. Checked narrow and 1280 px layouts and direct Sauté selection/opening.

### 2026-09-10 — TV identity transitions and utility parking

- Clear both sampled TV textures when selecting a project, including interrupted fades. TV slides fade through dark over at most 500 ms, preventing simultaneous outgoing/incoming text. Cabinet screenshot crossfades retain their existing behavior.
- Pending logos no longer display temporary title text; confirmed missing/failed logos use a fitted title. Slide cache keys use original screenshot slots, avoiding collisions while captures arrive out of order. Immutable DataTexture slides and bounded caching remain in place.
- About/contact settle the current image and park without static or a restarted presentation. Initial parked startup may still load its first identity.
- Four transition regression tests added. Glass findings and proposed rendering changes are documented separately in SCREEN-GLASS-RESEARCH-2026-09-10.md; glass rendering is unchanged in this pass.

### 2026-09-10 — the hall wakes up

- Replaced the eight-segment startup indicator with a dark architectural loading composition: existing DENNIS identity, five actual cabinet silhouettes (claw first), a slow sequential color wash, floor reflections, and a thin moving spectrum line. Only the existing bilingual loading label is shown.
- Added an offline geometry renderer in scripts/models/build-loading-art.mjs. It projects existing GLBs with a depth buffer into five small transparent WebP assets (~17 KB total); no extra runtime WebGL context, external media, or generated replacement models.
- The loader is server rendered and controlled by the existing gl-pending/scene-ready lifecycle. Removed the 500 ms delayed loader fade and 900 ms stage fade: both now hand off over 180 ms, with no minimum duration. Ready/fallback hide the loader; persistent route changes do not replay it.
- Animation is opt-in for no-preference; reduced motion keeps the composition still and reveals immediately. The status is available to assistive technology and uses the existing DE/EN selectors.

### 2026-09-10 — corrected startup: actual room power-on

- Replaced the separate cabinet illustration with a lighting cue inside the real persistent WebGL hall. After the first frame is ready, ambient lighting rises, followed by cabinet emitters and nearby lamps; the floor reflection captures the same lighting. The cue lasts 2400 ms and does not delay the ready signal.
- Light intensity, environment lighting, emissive strength and unlit screen brightness are temporarily scaled for each render and restored afterward. Focus changes, entering a project, or reduced motion finish the cue immediately. It runs once for a fresh hall scene, never during ordinary route transitions.
- Bottom navigation fades up with the room. Its line and dark surface now use restrained silver, pearl, lilac and blue-grey iridescence instead of a rainbow.
- Removed the obsolete loading illustration renderer and its five model projections. Added regression coverage for illumination progression, restoration after rendering failures, and completion.

### 2026-09-10 — room-only loading, slower ignition

- Removed all loading text, dots, bars and overlay markup. The actual WebGL room is visible during loading at near-dark illumination. Dim, staggered lamp ignition attempts repeat while real assets load; shader warm-up no longer exposes temporarily visible objects in the room.
- Once ready, two irregular low-output ignition attempts lead into a gradual stable warm-up over 6800 ms. Light levels vary by fixture position; screen emitters settle later. The iridescent dock comes up with the room. Interaction/reduced motion still finish the cue immediately.

### 2026-09-10 — lighting choreography refinement

- Fixture timing now belongs to stable asymmetric circuit banks, with fast electrical strikes, a short hold and a longer afterglow. Ceiling fixtures start independently rather than applying the same pulse across the room. A small local ballast dip settles into a smoother fifth-order warm-up.
- Ambient/reflected fill stays steady through the ignition attempts. Displays wake separately without fluorescent flickering; unlit artwork/mascots receive simulated fill instead of behaving like emitters. White practical lights have a subtle temporary warm-to-neutral shift, with all original colors restored after each render.
- Long asset loads retain steady low ambient light while fixture attempts repeat. Regression tests cover separate display/fixture behavior, timing consistency, light-color restoration and bounded light output. No loading overlay, text, progress UI or camera movement added.
