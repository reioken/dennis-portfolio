# Portfolio direction and implementation plan — 2026-10-04

Status: implemented locally after Dennis approved “Okay, lets build it.” Three agents contributed to the implementation and review. Production has not been deployed. The original design rationale follows the implementation record below.

## Implementation record

### Second art-direction pass

**Typography follow-up:** Dennis requested natural wrapping where space is available. Removed forced breaks in the new entrance headline; removed arbitrary character-width caps from the loader role, mobile introduction/captions, About copy/process heading, case summaries and featured-card summary. The About profile now spans the section, with facts beneath it, instead of being confined beside a facts column. Contact's smaller booth accompanies the heading; its paragraph clears the image and uses full width. Existing intentional portrait/name and address structures remain. Restored 10px horizontal padding to DE/EN (8px mobile), with compact header adjustments to avoid overlap. Both languages checked on home, About, Contact, work directory, Mina and NEXUS at 320/390/768/900/1024/1440: no document overflow or brand/control overlap, and at least 8px inside the language border. Build and 57-page audit passed. Captures in `/entrance-v3/wrap-*`.

**Latest verdict and implementation:** Dennis rejected the added desktop strip as a double header. It and its camera-space reservation have been removed; the room again occupies its original frame. He liked the `dennisbf.` wordmark and meant to put his full name beside it. The wordmark is restored with **Dennis Bierreth-Fernandez** and the precise professional role alongside; DE/EN remains far right and the menu quiet. The accepted headline stays in the loader and native mobile introduction. Header tested at 320/390/900/1024/1440px for overlap, a single wordmark, menu operation and absence of the second strip.

Dennis also stressed that the redesign must use his existing professional background, not over-weight newly supplied AI/games/pipeline details. The About introduction now explicitly identifies his state-recognized media-design qualification, neuefische UX/UI training and 6+ years agency/in-house experience. It links Mina as UX/UI evidence. Education is visible outside the career disclosure again; only career history is folded. Process copy introduces research, information architecture and design systems before discussing AI-assisted work. Existing certificate details and links remain intact. Verified DE/EN at 320/390/1440px, with build and 57-page audit passing. This latest state supersedes the strip/name-only treatment recorded below.

Subsequent correction: Dennis requested the full name, precise professional role, language controls at the outer edge and removal of “Spielraum” / the lavender “Raumplan” key. The header now shows the full name with “Art Direction · UX/UI · Product Builder”, a quiet Menu control and DE/EN at far right. The headline remains, now in a dedicated 110px strip below the desktop header (86px at short heights). Hall camera framing reserves that strip, keeping the brick game unobscured. The strip stays stable across hall stations. Mobile keeps the text in normal document flow. Verified visually at 1024/1440 and tested across the previous mobile widths; see `/entrance-v3` captures. This supersedes the entrance-note and wordmark details below.

Dennis also confirmed that he builds fully functional product-image pipelines at Floordirekt for multiple series, languages and brands. Added a visible commercial-work paragraph to About (outside the collapsed CV), updated the Floordirekt timeline and included pipelines in the homepage introduction. No tools, volume, speed improvement or automation level was inferred. Final build/audit passed; the new DE/EN section was checked at 320/1440px without overflow.

Dennis found the first pass too basic, particularly the homepage wording and header. The entrance now uses “Zu viele Ideen. Für nur ein Format.” and a short personal introduction connecting apps, games and music. Shared DE/EN copy lives in `src/lib/entrance-copy.ts` and is used in the loading composition, phone introduction and a desktop entrance note. The desktop note appears only at the About machine in hall mode and clears when browsing other stations.

The header now uses a condensed, slanted `dennisbf.` typographic mark, numbered route keys and a lavender corner-shaped “Raumplan” control with a grid icon. Destination labels remain familiar. Header height is 72px desktop / 64px phone; responsive offsets continue using `--nav-h`. The existing Barlow Condensed font connects the new entrance to About's typography. Phone About uses an editorial text action instead of another boxed primary button.

Second-pass verification: TypeScript, production build, 57-page audit and `portfolio-refresh.mjs` passed. Captures: external evidence folder `/entrance-v2` (320/390/768/844 and 1024/1440, loader, room, About, Contact, galleries and fallback). Production remains unchanged.

- Retained the rotating loading emblem, with identity, role and direct Projects/Contact routes. Case content no longer waits for room geometry; keyboard focus transfers from a disappearing loader link to its header counterpart.
- Consolidated the header and hall controls around an inset readout and shallow control keys. Phone navigation retains reachable Contact and a full directory.
- Rebuilt About around profile, contribution, process, current games/music and optional career detail. Dennis supplied the process account and the exact memoryrot Spotify album link during implementation. Career and education use a native disclosure, including deep-link expansion and no-JS access.
- Added editorial project activity separately from delivery status. Paused prototypes no longer also claim ongoing development. Existing unclassified work retains its previous facts.
- Clarified gallery versus project links, promoted fullscreen, added screenshot captions, and moved phone case identity/context above the gallery. Native case pages scroll as documents with labelled navigation at the end.
- Made phone Contact independent of the room and added a 9.4 KB static image of the existing booth. Fresh phone Contact requested zero hall models in Chromium checks.
- Preserved the existing machines, camera implementation, full-image navigation, screenshots and substantial case content. No new cabinet or fabricated project proof was added.

Validation: TypeScript, review tests (31), Astro build and the 57-page local-link/metadata audit passed. `portfolio-refresh.mjs` checks 320/390/768/844 landscape and 1024/1440 desktop, both languages, career deep links, menus, fullscreen, native Contact, loader focus, reduced-motion content access, missing models, no WebGL and no-JS disclosures/forms. Screenshots and JSON are in the external evidence folder's `refresh-qa` directory. Chromium emulation does not establish physical-phone performance. The build retains its large-chunk warning.

Existing regression suites also passed: `mobile-camera.mjs` (Riftback, Lowlight, Snapsize, surface/image persistence, swipe, reduced motion and model-failure fallback), `mobile-handoff.mjs` (entry/return projection across first/reopen/scrolled states, effectively zero measured displacement), and `mobile-exhibition.mjs` (history, language, resize, About return and no-JS). Camera telemetry checks require dev mode; the first attempt against the built preview could not read telemetry. A handoff run interrupted by dev reload was repeated with no concurrent edits and passed. Dev SSR still logs the previously documented “Invalid hook call” warning (see `HANDOVER-CLAUDE-FABLE.md`); its cause remains unresolved. The built-browser suites reported no page/console errors.

Local built preview: `http://127.0.0.1:4334`. Existing unrelated edits to `src/data/werkstatt.json` and untracked prior assets were left alone. Use `npx astro build`, not the scanner-running build/deploy scripts, for this review. Production release still follows the repository's normal authorization and release procedure.

## Direction

Keep the arcade, its machines, the existing loading emblem, fullscreen galleries and continuous mobile camera. Make the surrounding interface feel like the control desk and signage of this particular exhibition. Strengthen the connection between the physical world and the information a prospective client or employer needs.

The agents separately covered creative direction/entry, stories/curation, and mobile UX. They agreed that professional context arrives late, project status conflates different facts, and interface controls use too many visual treatments. Their recommendations are synthesized below; this is a heuristic design plan, not the result of a visitor study.

Three concepts were considered:

- **Exhibition control desk — recommended:** equipment-inspired typography, inset readouts, precisely divided controls and a shared identity composition. Closest to the established machines and suitable for professional case studies.
- **Admission ticket:** an editorial ticket around the emblem and project directory. Distinctive, but introduces festival/event associations beside the existing arcade.
- **Console boot screen:** stronger diagnostic styling and startup readouts. Familiar to the setting, but risks generic gaming aesthetics and misleading technical theatre.

Use the first concept. Avoid decoration with no purpose: fake screws, arbitrary distress, flashing status lights, artificial diagnostics or new motifs on the machines.

## 1. Retain the loading screen; give it a useful role

The scene needs preparation feedback, and the current CSS emblem is a good signature. A full-page barrier is not required on every route.

On desktop home, compose the emblem beside an identification panel: Dennis's name, the existing role “Art Director · UX/UI · Independent Product Builder”, and a short genuine readiness message. Precisely aligned type, quiet material edges and the established lavender/ice/pearl palette connect it to the room. Stack the composition at narrow widths where a scene actually requires loading.

The identity must be present immediately, with no carousel, typing animation or timed reading obligation. End the loading state as soon as the room is ready. Do not introduce fake percentages, a minimum display time or a mandatory Start action. Provide usable direct routes to Projects and Contact during preparation. On a fast load, the same role/identity survives in the arrival composition after the emblem disappears.

Mobile home already avoids the full scene. Give it the same identity treatment above the claw; do not add a loading screen there merely for consistency. Individual cabinet preparation can use a smaller instance of the emblem only when an actual delay occurs.

Contact and directly opened case studies should expose their useful content while decorative 3D prepares independently. Keep the room's controlled reveal so unfinished geometry does not appear. Refactor the blanket `.hall-panel` loading suppression into route/region-specific behavior. Remove the additional 4,080ms fade that leaves the dock dim after ignition; navigation should be legible and available with readiness.

## 2. Build a distinctive, consistent interface

**Header:** make the brand area a compact exhibition identity with a deliberate typographic arrangement, rather than a bare wordmark in a standard translucent nav. Keep familiar destination names. Desktop exposes Projects, About, Contact and language; secondary destinations stay in the directory. Phone layouts prioritize a clear directory and reachable Contact rather than squeezing every desktop control into tiny text. The role belongs in mobile arrival content where it has room.

**Hall controls:** replace the full-width media-player impression with a compact control assembly. A station track indicates location; its active marker corresponds to the camera's selected station. Group previous/next keys with an inset station number/name and one explicit open action. Give the directory a distinct labelled control. The track borrows proportion and motion from the hall's existing overhead rail without adding another 3D model. Tiny ticks are not the only accessible station controls: the directory supplies full-size labelled targets.

**Case reading:** the global identity remains, but the hall's station navigator should not compete with the story. Replace the fixed row of unlabeled colored dots on phone case pages with a clearly labelled project directory and adjacent-project navigation at the story's end. Preserve an easy return to the exhibition and its previous position.

**Buttons:** use one family with shallow depth, restrained corners, crisp edges and clear hierarchy: softly illuminated primary key; quieter inset secondary key; simple text action. Reuse existing Nucleo icons. Press response should feel precise and remain stable. Real semantic buttons/links, visible keyboard focus and generous hit areas remain essential. No extra sound or mandatory interaction is proposed.

Consolidate the affected styles. Current navigation and dock styling has multiple override layers; adding another visual patch would perpetuate inconsistency.

## 3. Make Über mich the home for process and collaboration

Dennis explicitly chose Über mich as the primary place to explain his process and how he works. This supersedes the agents' initial suggestion to make extensive project-by-project stories the main intervention. He also requested a clickable Berufserfahrung section to make room for information visitors actually want.

Proposed About reading order (section titles are draft wording):

1. **Who I am and what I bring:** the strong portrait/name treatment, role, short positioning, availability and direct contact. Keep the claw within the composition while bringing this context into the first phone screen.
2. **What you can work with me on:** tangible areas of contribution—Art Direction, UX/UI and building interactive products—with relevant existing work linked as proof. Prefer specific capabilities and collaboration scope over a wall of software logos.
3. **How I work:** Dennis's actual way of developing an idea, exploring direction, prototyping/building, checking and refining. Use a few short editorial chapters with authentic artifacts/examples. Explain his hands-on role and how feedback/collaboration works when supported by his account. Do not turn proposed chapter structure into invented process claims or force every project into the same steps.
4. **What I am working on now:** the user-confirmed games, distinguished from finished and on-hold projects. Keep this a manageable studio update with genuine material, rather than five equally large empty project cards.
5. **Outside the project brief:** a compact personal music feature for memoryrot, with the user-described Spotify release “a lifetime, briefly”. Confirm the exact release styling/link before publishing a music action. Artwork/audio can be added when available; no autoplay or invented cover.
6. **Background, on demand:** a visibly labelled Berufserfahrung disclosure, collapsed initially, with a compact credibility summary and the full existing timeline inside. Education/qualifications and the detailed tool list can sit alongside as secondary information; their exact treatment remains a design choice. Keep all content in the document and usable by keyboard/no-JS. An existing experience deep link must open the relevant disclosure and bring it into view.
7. **Contact:** a clear closing invitation and direct route, with contact also available earlier.

The presentation should feel like opening the creator's working notes within the exhibition: readable typesetting, a few real visual examples and consistent controls. It should not become a dashboard of accordions. The main value/process content remains visible; progressive disclosure is for the lengthy background details.

Project pages remain concise: purpose, Dennis's contribution, what exists today, screenshots/fullscreen and the appropriate action. Add a short evidence-based decision or outcome where useful and link back to the relevant About material. Preserve Mina's substantial existing study rather than removing it; clarify personal ownership only when Dennis supplies the facts. No mandatory long-form rewrite of every project.

Possible featured proof includes Mina for research/collaboration, NEXUS or Riftback for a finished solo product, and a current game or commercial case when there is suitable material. Selection depends on actual evidence; no invented impact metrics or test history.

## 4. Represent project states honestly

Current statuses mix publication (`live`, `released`, `private`), maturity (`wip`), archival and content type (`case`). None proves ongoing activity.

Keep these meanings separate:

- **What exists:** concept, prototype, private build, released product, client work, where supported.
- **Current activity:** actively developed, paused or completed, only when Dennis confirms it and only where useful.
- **Visitor action:** inspect screens, read story, try demo, open live product or download.

Extend the editorial model without breaking existing status-dependent links, games or scanner behavior. Current activity should be manually authored, never inferred from repo dates, a working URL or an automated scan. Check “2025 – heute” timelines against Dennis's confirmation. A released product may be paused; a polished prototype may be complete.

Keep prototypes in the collection. Do not dim machines, switch them off or call them abandoned. Curate a few strong entry points, then retain the full exhibition and project directory. No machine removals or reordering are decided until the current-work inventory is known.

### Dennis-confirmed inventory — October 4

- **Finished for now:** Riftback, NEXUS, Lowlight, VGM Battle, Snapsize. Preserve “for now”; this does not imply permanent completion or abandonment.
- **Actively working on:** Ishikiri, Umbra, Double Dip, Cab No. 09 and the Roblox game Sew It!. These are games; no release state or platform is inferred beyond Dennis identifying Sew It! as Roblox.
- **On hold:** Echo Frequency, Essfreude, Hookline, Berry.
- **Music:** memoryrot; “a lifetime, briefly”, with Dennis's supplied [Spotify album link](https://open.spotify.com/album/44mNF6rpjYqVwUrxJ0X7q1). No additional release metadata was inferred.
- **Not yet classified:** other existing entries, including Sauté Survivors, Mina, Briefly, Riftcast and Carillon. Retain existing factual descriptions without inferring current activity.

Cab No. 09 has an existing portfolio entry; the other newly named games and music now appear in About's current-work area. Adding full pages or physical cabinets for them is separate scope. The present hall mainly represents finished and on-hold work; About explains what is current without discarding that portfolio evidence.

## 5. Improve screenshot discovery, preserving fullscreen

Fullscreen is already implemented and works. Keep it, the physical controls, swipe navigation, surface groups and remembered image state.

Make the screen itself clearly actionable and the existing expand action easier to notice on pointer, keyboard and touch. Avoid persistent floating indicators over hardware. Distinguish the action that opens the interactive cabinet from the action that reads its story. Candidate wording such as “Screens erkunden” / “Projektgeschichte” remains a draft.

Give selected screenshots task-specific captions. In deeper flagship stories, reuse a small number beside the decisions they explain; do not build a second general-purpose gallery. Landscape product screens naturally remain small in a portrait fit-to-screen view; keep native pinch/landscape behavior and explain the content rather than assuming fullscreen alone makes dense UI readable.

## 6. Current mobile findings and proposed changes

Fresh live checks at 320×700, 390×844 and 844×390 confirmed cabinet opening, fullscreen next-image controls and close/return, with no captured page errors or document overflow. These supplement the earlier six-route desktop/phone review. This is Chromium emulation, not real-phone performance or full accessibility certification.

- **Home:** the claw and About-first structure work, but the initial view lacks an explicit professional role. Place the existing role before the machine and provide a clear route to selected work. Preserve the introduction Dennis chose.
- **About:** its animated claw occupies another substantial first screen before the portrait/role. Combine the professional introduction and claw more tightly; preserve the animation, its pause button and the home/About transition. The current profile jump helps but should not carry the whole burden.
- **Project entry:** a title links to the story, while “Projekt ansehen” opens the viewer, which then contains “Zum Projekt”. Give those destinations different labels and a direct story route from the exhibit caption.
- **Viewer:** retain the camera travel and reverse return. Use one compact control assembly for surface/count/previous/next, plus visibly distinct expand and story actions. Landscape should keep its horizontal controls. Verify the screen remains clear of them.
- **Reading pages:** put title, role and status before or alongside the lead image; simplify fixed navigation so the story has more room.
- **Contact:** make it a native server-rendered page. The fresh contact probe downloaded 20 hall model resources (about 8.6 MB), with content visible after about 3.1 seconds in that one run. Show email/form immediately and use a static booth initially; any later 3D enhancement must load only the booth and remain optional.

## Implementation sequence

1. **Apply the confirmed information model and produce visual prototypes.** Use Dennis's inventory above, leave other activity unknown, and prioritize About's new reading order. Show concrete compositions within the recommended control-desk direction: desktop arrival + hall controls, the revised About page, and phone home + viewer/reading controls. Reuse real screenshots and the existing emblem so Dennis can judge actual proportions. New words are clearly marked as drafts.
2. **Fix content access and hierarchy.** Native mobile Contact; independent scene/content readiness; identity before/after startup; readable controls on readiness; role/status placement; unambiguous gallery/story destinations. This can proceed while project-history details are gathered.
3. **Implement shared interface styling.** Header, hall controls, buttons, menu, viewer and reading navigation; consolidate old selectors. Preserve camera state, native links and existing interaction contracts.
4. **Build the About narrative and concise project proof.** Implement process/collaboration/current-work sections and the Berufserfahrung disclosure. Populate only evidence Dennis supplies or the repository already supports. Apply the concise hierarchy to one machine project, preserve Mina's deeper study, and roll out the accepted structure. Add music/current-game material as available; bring commercial proof forward when it is substantive.
5. **Validate and release in reviewable batches.** Preview the interface and content changes. Production follows the repository's existing release procedure and Dennis's production authorization. Dennis subsequently authorized implementation; see the record above.

## Files and verification

Primary touchpoints: `HallGuard.astro`, `hall-loading.css`, `Hall.tsx`, `hall-session.ts`, `GlassNav.tsx`, `site-nav.css`, `arcade-interface.css`, `MobileArcade.astro`, `mobile-arcade.css`, `mobile-arcade-viewer.ts`, About/Contact pages, `CaseOverlay.astro`, `CaseArticle.astro`, `CaseCaptures`, `WorkFilter`, `src/content.config.ts`, project MDX and DE/EN copy. Check the existing module/model preload conditions when adding native Contact. Avoid changes to unrelated `src/data/werkstatt.json`.

Acceptance:

- Identity appears before WebGL and remains understandable after loading; no new artificial delay.
- Contact content and form controls remain available with model requests blocked; no unrelated hall model requests on a fresh phone Contact visit.
- Case text is readable while the decorative scene loads, without incomplete geometry flashing into view.
- No viewport overflow/clipped actions at 320/390/768/844 landscape/1024/1440; safe areas, 44–48px controls and DE/EN expansion handled.
- Existing fullscreen, surface/image selection, cabinet controls, browser history, focus restoration, same-canvas entry/return and exhibit scroll restoration survive.
- Reduced motion, failed WebGL, model failure and no-JS routes remain usable. Check keyboard and screen-reader navigation, not screenshots alone.
- No automatic activity claims; every new process/outcome statement has a source or Dennis's confirmation.
- Berufserfahrung is discoverable, keyboard-operable and usable without JS; direct experience links reveal the content. Primary process/value content is visible without expanding a series of panels.
- Run appropriate typecheck/review tests/build/audit and targeted live-style browser regressions. Use `npx astro build` to avoid the unrelated scanner. Capture one GPU session at a time, outside the repo. Check on a physical phone before making phone-performance claims.

## October 4 — Marquee refinement after Dennis's feedback

Changed the Blender console's two action keys to satin resin (roughness .48, coat .08), reduced visible fasteners from twelve to two, and applied the arcade's shared `marbleBall()` shader to the joystick ball. Removed both the diagonal glass stripe and the broad travelling brightness beam. Project changes now blank the signal briefly and redraw the new raster over 240ms, without sliding or crossfading titles; reduced motion switches immediately. Shared room ignition remains in place.

Added a real modelled, recessed 13-position selector strip in the front fascia. Each channel has a number and light; selection stays lit, hover/focus lights the addressed channel, and native tooltips identify its project. Existing native direct-navigation and roving keyboard semantics drive it. Perspective-expanded hit areas are divided at their midpoints to avoid neighbouring clicks being intercepted. At 900px all targets are at least 44px high and 57px wide; the strip does not overlap the main controls. Desktop console aspect ratio is now 4.3. Current compressed model hash begins `1b927520`.

Verified locally at 1440 and 900px, direct station selection, ArrowRight/Home keyboard selection and focus, no observed console errors, and 390px cleanup with no console WebGL canvas or horizontal overflow. TypeScript, 31 review tests, Astro build and 57-page audit passed. Local only, not deployed or aesthetically approved.

## Inputs still needed

Numbered front selectors now have separate fixed sockets, deeper key skirts and raised bevelled caps in the Blender model (`4ad4de1e`, about 452 KiB gzipped). Runtime moves the complete key, label and indicator inward on press, holds a quick click long enough to register visually, and releases through a damped spring. The current selection remains slightly seated; hover/focus raises unselected keys and increases indicator light. Selection through arrows/joystick also actuates the newly selected key. Reduced motion uses immediate physical states. No extra per-key point lights or sound. Direct clicking and keyboard focus/selection verified at 1440/900px; adjacent hit targets remain separate and at least 44px high. TypeScript, 31 tests, build and 57-page audit pass; no observed browser errors. Local only.

Latest local refinement: stronger 38-row animated CRT raster, continuous fine noise and slight analogue drift; project changes now use a 620ms collapse/blank/raster-lock sequence. Reduced motion retains static scanlines and immediate changes. Action caps have tighter manufactured radii, mould seams, thin satin-metal collars and 1K resin normal/roughness maps. Existing surface scans now retain 1024px resolution. Run `shrink-textures.mjs --only navigation-marquee-v1` before packing; this new scoped option prevents processing unrelated models. WebP encoding keeps the revised model at about 450 KiB gzipped, hash `2daa8dd3`, despite the higher texture resolution.

Fixed the brick game disappearing on rightward navigation: its painted wall opacity now remains enabled throughout the desktop hall, separately from the first station's gameplay/input lifecycle. It moves out of the camera naturally rather than being switched off at selection time. Browser verified the partial artwork remains visible beside Riftback and returns with the first station. TypeScript, 31 review tests, Astro build and 57-page audit passed; no browser errors observed. Local preview only.

### Marquee navigation — chosen concept implemented (October 4, local)

**Subsequent verdict and polish:** Dennis called the first implementation a decent base but cheap, asking for better surfaces/type, animated scanlines, tactile controls, light effects, no square hover overlays and synchronized startup. The current GLB hash is `debbff2d` (about 719 KiB). The Blender generator now creates rounded moulded keycaps and a bowed screen lens; the scanned normal detail is stronger. The runtime uses the same authored reflection environment as the hero cabinets, lit ink on the keys and bright printed directional legends. Barlow Condensed replaces Outfit on the hardware, with a larger stacked station counter.

`dock-screen.ts` adds a dedicated phosphor shader: readable scanlines, restrained moving beam/aperture modulation, glass reflection, a 390ms station-title transition and a thin-line power-on opening. Textures upload on content changes only. `dock-hardware.ts` now animates an immediate initial press plus a stiffer spring, with local point-light spill and soft additive glow on authored GLB planes. Pointer hover/active proxies have no backgrounds, pseudo-elements, box shadows or outlines; keyboard focus retains rounded outlines. Idle display rendering is capped at 24fps, shadow maps update only for hardware motion/resize, reduced motion holds a static display, and all timers/renderers are disposed when leaving the hall.

Startup now uses one `prepareDockAsset()` byte request shared with the hall loading manager (`dock-asset.ts`). The console follows the actual room `data-power-at` clock using `roomPowerLevels` / `withRoomPower`; its screen, reflected light, lamps and glow cannot start at full brightness while the room is dark. Model failure still resolves the decorative readiness item and leaves native navigation. Browser capture confirms hardware is ready while both room and console are dark at ignition, then fully lit together. The final visual check covers 1440px DE and 900px EN, drag (03→05), keyboard, directory, project entry/disposal/Back and pointer-hover computed styles (transparent background, no outline, no box shadow). No browser console errors observed. TypeScript, all 31 tests, build and 57-page audit pass. Local only; final polished appearance awaits Dennis's verdict.

Dennis selected the Marquee image mockup from three generated directions and requested a high-quality build. This supersedes the rejected navigation-console-v2 appearance. `scripts/models/blender/navigation_marquee.py` produces the complete editable Blender assembly under `.source-assets/models-in/navigation-marquee-v1/` and `public/models/navigation-marquee-v1.glb.gz` (SHA prefix `390278d8`, about 723 KiB). The model includes a sloping dark enclosure, scanned normal/roughness finishes, nickel end caps, recessed raised marquee, metal joystick plate, dust seal, chrome shaft, lavender ball top, two large rectangular switch assemblies, fasteners, gaskets and an emissive lower strip. 71,326 triangles before packing. Old model assets remain as rollback copies.

`dock-hardware.ts` loads the whole model, adds high-resolution DE/EN print textures to its authored surfaces, and projects native input targets onto it. The marquee shows the selected station and real count. Generic arrow/grid icons and the row of miniature station keys are removed from the rendered hardware. The joystick supports drag, left/right clicks and existing slider keyboard controls; its spring returns it to center. Buttons depress with their labels. A perspective camera, restrained reflection environment and shadowed key light show the depth. The renderer sleeps once input motion settles. Reduced-motion skips spring motion. The project directory retains access to every project. Below 900px the existing native exhibition remains and the console renderer is disposed.

Verification: TypeScript, 31 existing review tests, production build and 57-page audit pass. Browser checks cover 1440px German, 900px English including Echo Frequency, drag (03 to 05), keyboard Home then Right (02), direction buttons, directory open/close, project entry (console canvas count zero) and browser Back. 390px has no horizontal overflow and no console canvas. No console errors observed. Screenshot: `C:/Users/denni/.codex/visualizations/2026/10/04/01a107cb-ddc1-7b72-84f0-e9b7c8a0ea5f/marquee-navigation-final.png`. Local only; no deployment or commit. The concept is approved; this implemented render awaits Dennis's visual verdict.

### Centered loading composition — October 4

Dennis requested a larger loading animation centered above the text. `hall-loading.css` now uses one centered column, removes the surrounding horizontal rules, reserves space for the 2.7× emblem (previously 1.8×), and keeps the two headline phrases and role on unbroken lines. Name, headline, role, status and links enter with a subtle 80–320ms stagger; readiness/exit timing is unchanged and reduced motion disables the entrances. Short desktop heights use a 2.2× emblem and tighter spacing. Native mobile still skips the room loader.

Built and visually checked DE at 1440×1000 and EN at 1024×600: centered animation, clear text separation, no line overflow or clipped controls. Verified the stagger delays and shorter-screen bounds. Local preview only.

### Complete Blender console — October 4, replaces the first console

Dennis rejected the initial runtime-built deck and requested the WHOLE navigation as real models made with Blender or Meshy. Chose Blender for precise hard-surface construction and separately moving controls. `scripts/models/blender/navigation_console.py` now authors the complete assembly: wedge carcass with a boolean-cut screen well, side cheeks/T-moulding, front return and light diffuser, rubber feet, scanned powdercoat/brushed/plastic materials, retaining ring and mineral-textured trackball, thirteen numbered selector keys, separate action buttons, engraved geometry legends, four actual display meshes, and recessed fasteners. Editable source: `.source-assets/models-in/navigation-console-v2/navigation-console-v2.blend`. Export: `public/models/navigation-console-v2.glb`; web delivery `navigation-console-v2.glb.gz?v=caabfb0b` (791,506 bytes, about 773 KiB). This is the entire visible console, not a CSS panel plus runtime primitives.

The runtime loads that GLB, maps live DE/EN text onto its display meshes, lights its surfaces with PBR reflections/shadows and animates named control assemblies. Native HTML links/buttons/slider are invisible projected hit areas, retaining focus and browser link behavior. No visible HTML labels or CSS controls remain when the model is ready. CSS remains as failure fallback. Rendering settles to idle after interaction. Geometry/material/texture/context disposal is handled on route exit and below 900px. Added a visibility observer so the readout refreshes once the hall is revealed; corrected the housing face winding and separated the ball hit area from selector 01 at the 900px boundary.

Verified actual trackball drag (01 → 03), selector 09, Home/ArrowRight, directory open/close, DE/EN display labels, project entry and browser Back, 1440/1024/900 sizing, 390px no-console cleanup, and zero inspected browser console errors. TypeScript, 31 tests, build and 57-page audit passed. Source/dist model hashes match. Production unchanged; Dennis has not judged this version.

### First physical navigation console — October 4 (rejected and superseded)

Dennis requested a more unique, skeuomorphic bottom navigation using real 3D models and tactile interaction. The desktop hall dock now has a procedural Three.js hardware assembly (`dock-hardware.ts`): bevelled powder-coated housing, recessed fasteners, brushed-metal rings, domed arcade buttons, a marbled rolling trackball, a recessed readout and station-coloured lower light strip. Materials reuse the existing arcade hardware scans. The trackball advances one station per 22px drag; existing arrows, direct station stops, project links and directory still own navigation. Native keyboard/ARIA semantics remain on top of the decorative canvas; modified-link clicks retain normal browser behavior.

Rendering is demand-driven and stops when springs/trackball settle. Reduced motion removes spring/inertia; CSS controls remain if WebGL fails. Resize and language changes realign the geometry to actual DOM controls. Leaving the hall or switching below 900px disposes geometry, materials, textures, renderer and listeners; the existing native mobile exhibition stays lightweight. No new downloaded model assets, sound playback, dependencies, or changes to the arcade machines. Model geometry is authored in TypeScript, not a baked GLB.

Verified visually at 1440 and 1024px, DE/EN; trackball drag advanced two stations, keyboard advanced a station, directory opened/closed, project entry disposed the canvas and browser Back restored it. 390px switch had no console canvas or horizontal overflow. TypeScript, 31 review tests, production build and 57-page audit passed; no browser console errors observed. Local preview only; not committed/deployed or aesthetically approved by Dennis.

### Mina original document restored

Dennis flagged that the complete-study action exposed a rewritten text version instead of his illustrated PDF. Restored the unchanged original `Case Study UXUI Projekt Mina.pdf` from his Drive as `public/media/mina/case-study-mina.pdf` (10,318,522 bytes; SHA-256 `9f55d0348c7063f666354f107053151e17ef8438aa1a21809287fb25271eafff`). It is one tall PDF page, represented by 11 existing image slices on the site. Both case layouts now show those illustrations directly in DE and EN through `MinaOriginal.astro`, with original-PDF open/download actions and a prominent top CTA. About's process-evidence links also open the actual PDF. English labels explicitly identify the original as German. Rewritten Mina study components are no longer rendered.

Verification: original PDF parsed and visually inspected; build copy hash matches source; local response is application/pdf with correct size. Astro build, TypeScript and 57-page link/metadata audit passed. Browser verified original illustrations and PDF actions in DE/EN, including 390px layout without horizontal overflow. Local preview only; not deployed.

### October 4 — interaction pass inspired by Paul Bakaus (local preview)

Dennis approved adapting the reference site's coherent interactions to the existing arcade art direction. Added a one-shot wordmark light sweep, illuminated route keys, a travelling station selector, cabinet-colour indicator and editorial project state in the control deck. Cabinet models and camera choreography remain the existing implementations. The loader signal resolves into light when the room's existing ignition begins, without extending loading time; each headline phrase stays unbroken.

Fullscreen images now travel between their measured image bounds and the cabinet screen, on desktop's native fullscreen path and the mobile dialog path. A shared temporary-image helper cleans up on completion, cancellation and disposal; reduced motion skips travel. Mobile return preserves the screenshot and restores focus and background interaction. No animation library or models added.

About includes a native radio selector with four original Mina document pages (findings, user journey, wireframes, design system), crediting the group project with Aurel Cornea and Laura Kolde. It works without JS. The existing memoryrot Spotify feature is now a CSS cassette link in About; no audio playback or new 3D room prop is claimed. Planning/testing documents for other projects are still not fabricated.

Verification: TypeScript, 31 review tests, Astro build and 57-page audit passed. Browser checks covered station selection, desktop fullscreen enter/return, mobile fullscreen paging/return with focus and animation cleanup, original Mina page selection, DE/EN labels and 320/390/900/1024/1440 layouts. A keyboard conflict caught in review was fixed: Hall no longer intercepts arrows in native radio inputs. Desktop recheck selects the next evidence page without navigating away. No console errors in the inspected browser. Existing large-bundle warning remains. Not deployed to production.

Dennis has supplied the activity list, working approach and exact memoryrot Spotify link; those are implemented. Optional future additions include shareable current-game assets, real planning artifacts and deeper project evidence such as Mina ownership or commercial results. These are not invented or required to review the completed interface/content revision.

Evidence folder: `C:/Users/denni/.codex/visualizations/2026/10/04/01a107cb-ddc1-7b72-84f0-e9b7c8a0ea5f/`. Fresh files include `mobile-plan-audit.json`, `audit-home-320.png`, `audit-about-390.png`, `audit-about-390-scroll.png`, `audit-viewer-844.png` and `audit-fullscreen-390.png`.

### October 4 — local editing, About foil and scene clearance

The About section index is now a compact full-width pastel iridescent strip with dark labels and pointer-following holographic sheen. Desktop height is 46px including borders; the narrow layout retains readable labels. The left pink claw-machine prize is smaller and farther back, with the rear pile also reduced for clearance around the rotating puppet's shoes.

Wall-game trail fade now multiplies every pigment channel by .58 each 260ms instead of retaining the accumulated coat. The final idle cleanup begins after one second; leaving the station clears and flushes the GPU target immediately. Browser play verified fresh purple strokes followed by a clean wall, including station navigation.

The text editor lives entirely outside the repository in the evidence folder's `portfolio-text-editor/` directory. Its loopback proxy at `http://127.0.0.1:4335/` injects the local Edit button; ordinary preview4334 and production output contain no editor. It resolves visible text to source entries, saves with backups and an Astro rebuild, supports guarded undo, and records pending English translations in external `changes.json` / `TRANSLATE-MY-EDITS.md`. Translation is a later agent action or manual EN edit, not an automatic external service. Restart using the external `Start-Editor.ps1`.

Verified a real browser save/rebuild/undo with byte-identical source restoration, four editor parser tests, unauthorized/cross-origin write rejection, desktop foil hover, narrow About strip and puppet clearance. TypeScript, all 31 review tests, Astro build and 57-page audit passed. Existing bundle-size warning remains. Local only; no commit or deployment.

### October 4 — editor isolation, Signature identity and continuous trail fade

Dennis reported editor interaction leakage and unwanted reloads. The external editor now houses its form in an iframe to isolate keyboard events from the hall's capture listeners. Picking blocks complete pointer gestures and hall wheel navigation; save/undo patch the selected DOM text after the validated source build, without `location.reload`. Unmapped canvas strings or ambiguous source-search matches update on the next normal visit. The iframe remounts across Astro navigation. Browser save/undo preserved Dennis's previously saved poster wording byte-for-byte; arrows, Escape, link picking and game picking were checked. The top Mina case-study link was removed from About; the later illustrated process evidence remains.

The trail uses frame-time exponential decay rather than a 260ms timer. Its target now uses half-float precision so small per-frame fades do not quantize into persistent low-opacity residue. Lifetime is unchanged. Browser play and GPU console checks passed.

Dennis selected the Signature concept. Traced its approved silhouette into SVG paths, with independent lettering and dot; exports in `public/brand/` include light/dark/monochrome SVG and transparent PNG, plus lossless WebP. No font or bitmap is embedded in the SVG. `SignatureLogo.tsx` uses shared paths for header and loader, with CSS colour hooks, a clipped sheen, and reduced-motion support. The name remains separate beside the wordmark. Header has translucent dark glass, 24px backdrop blur and subtle edge highlights. It is hidden and unfocusable while the hall loads, then reveals with readiness; native and fallback navigation remain available. TypeScript, 31 review tests, four editor tests, production build and 57-page audit passed. No editor code in production output. Not committed or deployed.

### October 4 — hover cleanup and persistent cool-toned marquee

Follow-up: signature header hover now uses clipped iridescent foil, fine diagonal diffraction and pointer-positioned glare instead of a one-shot sweep. Keyboard focus exposes the foil; reduced motion keeps it static. The header underline and logo share one responsive width variable (146px desktop, 88/76px narrow). Browser verified pointer response, exit fade and matching desktop/mobile widths; TypeScript and build passed.

About's section strip now uses one soft pointer-following reflection and tiny label markers, removing the rectangular sweeps. The About contact CTA and panel back button keep a static gradient over smoothly interpolated base colours; duplicate CTA styling and gradient-to-solid hover swaps are gone. Header routes also interpolate colour instead of swapping gradients. Keyboard focus and reduced-motion treatments remain.

The marquee stays mounted with the persistent Hall instead of disposing on every case entry. Hidden case/close-up modes park rendering; returning wakes the same assembly. Desktop loading is hidden, and the flat fallback is explicit for actual renderer/asset failure. A higher-specificity off-page rule prevents the ready-model display rule from exposing the console behind reading panels.

Dennis requested less pink: runtime materials now retain the GLB's surface maps with blue-grey, lavender-grey and silver bases and restrained physical iridescence. Key/fill lighting, button spill and CRT phosphor are cooler. This is a runtime finish override; the source Blender palette remains the earlier version.

Browser verification covered the four About labels, contact CTA, header controls, menu routes, all 18 marquee hit targets, project filters and a project card. About/Contact/Riftback returns and browser Back retain one ready canvas; the console is display:none in case mode and visible on return. TypeScript, 31 review tests, Astro build and 57-page audit passed; no browser errors observed. Existing bundle-size warning remains. Local only, not committed or deployed.
