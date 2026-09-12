# Blue — portfolio hall companion

## Identity and source

Blue is Dennis's black cat with amber eyes, confirmed by Dennis on 2026-09-12. The lighter cat in the supplied archive is a different cat.

Source archive: `drive-download-20260911T230121Z-1-001.zip`. Local originals and generation records are retained under `.source-assets/blue/`; original personal photographs are not published with the website.

Preserve broad cheeks, a short dark muzzle, black nose, dense short black coat, compact adult build, substantial paws and a thick tail. No invented white markings or collar. The stylized reference was generated with the built-in image-generation tool using the face and full-body photographs.

## Production checks

- First Meshy 7 Ultra single-image output: rejected, flattened segmented geometry (35 credits).
- Second Meshy 7 standard single-image output: rejected, extremely thin body and malformed anatomy (30 credits).
- Third attempt: multi-image reconstruction from front, side and three-quarter views succeeded (30 credits). Task `01a092ce-e72d-73f4-b9f5-bd9c4af497e9`. Total generation cost: 95 credits.
- No failed mesh is an acceptable fallback for the live website.

## Rigging research

Meshy's web app advertises quadruped rigging, but its public rigging API currently documents support for standard humanoids. Do not submit the cat to the humanoid API.

- [Meshy rigging API](https://docs.meshy.ai/en/api/rigging)
- [Meshy image-to-3D settings](https://docs.meshy.ai/en/api/image-to-3d)
- [Three.js animation blending](https://threejs.org/docs/pages/AnimationAction.html)
- [Quaternius Cat, CC0 motion reference](https://poly.pizza/m/qKICY6xla2)

The retained CC0 reference model is `.source-assets/blue/quaternius-cat.glb`. It is an animation reference, not Blue's appearance. Its simple four-leg rig is insufficient by itself for the desired expressive custom character.

## Behavior contract

Basket beside the left of the About claw cabinet. Restricted roaming path in front of that area, with pauses, a smooth settling pose, breathing while asleep and a wake-up. Clicking/tapping interrupts the routine with an affectionate head tilt, relaxed closed eyes and expressive tail movement. Keyboard access uses a projected focus target. Reduced-motion preference disables roaming. Scene pause must also pause Blue's clock.

The model belongs to the startup asset gate and must not pop into an already-lit room. Keep the texture budget modest, use opaque fur materials, avoid alpha hair cards and high-contrast emissive edges. Pick the actual cat mesh before processing cabinet/backdrop actions. Preserve the single persistent hall instance across internal navigation.

## Delivered locally

- `public/models/blue-rigged-v1.glb`: 1,961,872 bytes; 26 joints; six animation clips; facial blink and floor-contact corrective morph targets. Amber iris material factor preserves the generated pupil texture.
- `scripts/models/blender/blue_rig.py`: deterministic skinning, surface weight smoothing, two-segment leg solving, looped clips, pose-space contact correction and GLB export. Editable packed master retained in `.source-assets/blue/v3/blue-rigged-master.blend`.
- `src/components/hall/blueCat.ts`: interruptible behavior, cloth bed, contact shadow, nearest-hit interaction, mobile arrangement and accessible projected control.
- Cat and bed load before the lighting reveal; rendering pauses with the hall. No alpha fur cards or extra animation libraries.

## Verification

- TypeScript and production build passed; 27 existing regression tests passed.
- Built-site audit: 54 pages, local links and metadata passed.
- Chromium: 1440×900 and 390×844, plus reduced motion. Real pointer clicks and keyboard activation preserve the current route. Simulated two-minute cycles visit walk, idle, settle, sleep and wake within the restricted path; hidden/off-screen state does not advance its clock.
- Firefox 155.0.1: startup completes, mixer advances, actual pointer click triggers happy and closed eyes; accessible control has no hidden ancestor.
- Existing Firefox cube compositor regression: all six faces accelerated throughout two 9.6-second main-thread blocks; maximum sampled rotation hold 41 ms. Startup dismisses and reduced motion passes.
- Blender studio inspection includes idle, walking, settled, sleeping and happy poses. Contact correction keeps the sampled resting underside above the floor. These are authored stylized animations, not motion capture.

QA scripts: `scripts/qa/blue-cat.mjs`, `scripts/qa/blue-cat-firefox.mjs`. Screenshots and detailed results are retained in `.source-assets/blue/qa/`.

## v2 polish — 2026-09-12

Dennis's feedback on v1: not clean enough, not interactive enough, animations far from smooth. Diagnosis from the delivered v1 asset and code:

- The glTF exporter had decimated the sampled clips (some 4-second channels kept only 2–12 linear keys), so slow motion advanced in visible steps.
- The authored motion was tiny (idle head sway under one degree, paw lift 2.8 cm) and the sleep pose dropped the torso 11–13 cm although the belly sits 12 cm above the floor, which crushed the body and triggered the floor-contact morph across the whole underside.
- The Meshy atlas carries streaky fur highlights and warm specks that read as noise on a black coat.
- Runtime turning used a fixed angular rate, walking clamped the clip time scale (foot sliding at low speed), and clip switches were plain crossfades.

### Pipeline

`scripts/models/blender/blue_rig.py` is unchanged and still produces the skin master. The new `scripts/models/blender/blue_animate.py` opens that master and:

1. Rebuilds all six clips positions-first (torso chain, IK legs, tail chain, explicit head/ear rotations) at 30 fps: `idle` 8 s look-around with ear flicks and tail stir, `walk` 1.2 s lateral-sequence gait with 4 cm paw lift, paw pitch, body roll/yaw and head bob, `settle` 2.4 s into a **sphinx rest** (torso down 8.5–10 cm, front legs extended, hind legs tucked, tail along the flank), `sleep` 6 s breathing and head droop loop, `wake` 2.4 s reverse, `happy` 4 s head tilt, chin up, ears back, tail up.
2. Recomputes the `BlueGround` corrective for the sphinx pose.
3. Cleans the coat: the 4096² atlas is averaged to 1024², the amber eye polygons are rasterised through their UVs, the pink inner-ear polygons through the ear-bone weights, and everything else is replaced by a smoothed satin black. No colour-threshold survives, because warm highlight specks in the atlas map onto the face and chest.
4. Exports with `export_optimize_animation_size=False`, then repacks the GLB: channels that never leave the node's rest value (all scale channels, static translations) are dropped and the binary chunk is rebuilt. Sparse morph-target accessors are remapped as well; missing that made three.js fail with an invalid typed array length.

Result: `public/models/blue-rigged-v2.glb`, **2,144,196 bytes** (v1: 1,961,872), same 26 joints and two morphs, 322 static channels dropped, 30 fps keys on every remaining channel. `blue-rigged-v1.glb` is retained for rollback only.

Two texture lessons from this atlas: the polygons are only a few texels wide at 1024², so even a 2 px mask dilation paints neighbouring islands; and bright eye texels bleed into adjacent islands at coarse mip levels, which showed as glinting specks on the face and chest of the resting cat. Disabling mipmaps removed them but would shimmer; capping the eye texels at luminance 0.5, removing the dilation and anisotropy 8 leaves only faint residue.

`scripts/models/blender/blue_check.py` renders the authored poses and reports edge stretch per clip into `.source-assets/blue/v3/check-v2/`. Remaining stretch outliers sit at the wrists in the sphinx pose and between the front legs during the walk, both hidden from the hall camera.

### Runtime (`src/components/hall/blueCat.ts`)

- Idle and walk are one locomotion layer whose split follows the actual ground speed; the walk time scale equals speed ÷ 0.19 m/s, so feet never slide. Speed is acceleration-limited (0.28 up, 0.36 down) with braking distance to the goal; turns ease out into alignment. Stops are chosen randomly from five spots; after two to four visits Blue returns to the cushion and turns into a fixed resting heading so the lying pose reads from the frontal camera.
- Settle, sleep, wake and happy fade in over the locomotion layer. Petting a resting cat plays wake first, then happy.
- Attention overlay after the mixer: neck, head and ears follow the pointer (clamped ±0.75 rad yaw, −0.3…0.42 rad pitch, damped), lose interest six seconds after the pointer stops, and look at the viewer while the pointer rests on the cat, with perked ears, a pointer cursor and a slow blink. Without a pointer Blue glances at the camera at low weight. Reduced motion disables the overlay.
- Material: `MeshPhysicalMaterial` sheen (0.55, roughness 0.6, cool grey) gives the coat a velvet rim under the rect lights; eyes are glossy (roughness 0.32). Normal map strength 0.35, texture anisotropy 8.
- `hallScene.ts` passes the pointer ray and hover state through `look()` on every cursor update and clears it on `pointerleave`; loader errors are now logged instead of swallowed.

### Companion behaviour (same day, Dennis's follow-up)

Dennis asked for two things: on "Über mich" Blue should jump onto the claw machine, look down and lie there like a photo of him on a shelf edge with his front paws hanging over; on the other stations he should slowly walk past the arcades and sit in front of them.

- Five more clips in `blue_animate.py`: `sit` (1.8 s, stand → upright sit), `sitidle` (6 s loop with glances, ear flicks and tail-tip flicks), `jump` (1.4 s in place: crouch 0–0.30 s, launch, flight 0.42–1.10 s, landing crouch; the runtime moves the body), `perch` (2 s, stand → lying at a ledge with the front legs hanging below it) and `perchidle` (6 s loop). `stand` and `unperch` are `sit` and `perch` played backwards. Two more pose-space correctives, `BlueSit` and `BluePerch`, keep each underside on its surface; `BluePerch` skips the front-leg vertices because those are meant to hang. Morph normals are no longer exported (they cost 350 KB and change nothing visible). Asset: 2,260,396 bytes, 11 clips, four morphs.
- The hall now passes `{ focus, pose, stationX, inHall }` every frame and keeps Blue active at every station and behind open panels. `blueCat.ts` derives a plan from that: **home** (station 0 in the hall: the basket routine as before), **station n** (sit beside cabinet n) or **perch** (About: station 0 with a non-hall pose). Plan changes stand him up, wake him or climb him down first, then `resume()` continues from wherever he is.
- Station: he strolls at 0.34 m/s along a lane 0.8 m in front of the cabinets and sits 0.92 m beside the focused one, on the side he arrives from, facing the visitor; after 18–36 s he lies down (sphinx), 14–22 s later he sits up again. If the target is further than 3.4 m he is placed 2.6 m outside the frame on the approach side and walks in, so long hall jumps do not turn into 30-second treks.
- Perch: he walks to 1.05 m in front of the claw cabinet, crouches and leaps 1.95 m onto its top (a stylised cat leap with an eased rise and a small overshoot, nose up then down), turns to face the viewer, steps to the marquee's front edge (top surface 1.95 m, front face z 0.42 measured by raycast) and lies down with the paws hanging in front of the marquee. Petting on the ledge closes his eyes and pushes his head instead of standing him up. Leaving About plays `unperch`, a forward hop down to the floor, then the walk home.
- Reduced motion snaps to the plan's final pose without travelling. Beside an open panel only calm moods render every third frame.
- `scripts/qa/blue-companion.mjs` drives the whole scenario in Chromium at 1440×900 (plus reduced motion and 390×844): station sit position, perch position/heading/height, petting on the ledge, climb-down after `history.back()`, no console errors. Screenshots in `.source-assets/blue/qa/companion-*.png`.

### Verification

- Blender: pose renders and stretch report for all clips (`blue_check.py`).
- Chromium 1440×900 (Playwright, `scratchpad` evidence scripts): head direction follows the pointer left/right, hover perks ears with a pointer cursor, petting closes the eyes and keeps the route, walk peaks at 0.21 m/s with acceleration under 0.36 m/s² over 300 frames at 60 fps, settle → sleep → wake cycle, no console errors.
- `scripts/qa/blue-cat.mjs` passes at 1440×900, 390×844 and reduced motion; `npm run test:review` 27/27; typecheck.
- Not covered: native Firefox rerun, physical devices, Safari.

## v3 — eye forensics and ledge pose (2026-09-12, evening)

Dennis on the live companion: the eyes bulge upward when Blue jumps onto the machine, the legs hang far too low on the ledge, and turning is a robotic spin. The overhaul plan is `blue-animation-plan.md`; this section records the first two phases.

### Eyes: the correctives carried the blink

`scripts/models/blender/blue_forensics.py` audits the skin weights on the eye and socket polygons, the deltas of every shape key grouped by dominant bone, and renders the jump launch frames one morph at a time (`.source-assets/blue/v3/forensics-before/` and `forensics/`).

Findings on the v2 asset: eye and socket vertices are weighted 100 % to `Head` and every vertex sums to 1, so skinning was never the problem. But `BlueGround`, `BlueSit` and `BluePerch` each moved the same 1,772 head vertices as `BlueBlink`, with the identical 15 mm maximum on the eyes, and `BlueSit`/`BluePerch` additionally carried 50–120 mm deltas on the tail and hind legs. Cause: `Object.shape_key_add()` defaults to `from_mix=True`, so each corrective started as a copy of whatever mix was active (the blink at 1 and the previously created correctives). At runtime that meant: lying down or perching faded the eyes shut, petting on the ledge stacked the real blink on top for a 30 mm displacement, and the "before" render with all morphs at 1 shows the eyes as two spikes. The extra deltas also explain the poor stretch numbers of every resting pose.

Fix in `blue_animate.py`: all key values are zeroed, correctives are created with `from_mix=False`, the corrective uses the armature modifier's rule (missing weight stays at rest) and head, neck and ear vertices are excluded from every corrective. Result: no corrective touches an eye vertex; edges stretched over 3× fell from 364 → 104 (sleep), 340 → 78 (sit) and 1,039 → 79 (perch); the GLB lost 140 KB of sparse garbage (2,120,092 bytes). The eyeball rebuild from the plan is therefore deferred: at the hall's viewing size the flat eyes read fine once nothing deforms them.

### Ledge pose

The wrist target was an absolute 0.30 m drop. New pose (`EDGE_Y`, `FRONT_HANG`, `HANG_SIDE`): the marquee edge is 0.25 m in front of the body origin, the elbow rests on the top 3 cm behind the lip, the wrist crosses the edge 4 cm below it and the paws curl by 0.75/0.55 rad with a few millimetres of asymmetry, so the paws end about 7.5 cm below the top instead of 20 cm. Chest first, shoulders protract 1.2 cm toward the lip, front legs follow, neck relaxes after the chest, tail last. Per-leg offsets now apply after the pose target (they were no-ops at full amount before), so the perch idle stirs are visible. Runtime `LEDGE.spot` moved from z 0.20 to 0.17 so the cabinet front face lands at the authored edge. `blue_check.py` renders the perch on a ledge prop from two low camera angles that mimic the hall camera.

### Turning with steps (Phase 3)

Dennis: "when turning he just spins". The runtime rotated the body with `quaternion.rotateTowards` at up to 2.4 rad/s while idle or walk played, and settle/sit/perch kept spinning during their clips; stand and unperch were reversed playback.

Authoring (`blue_animate.py`): four turn-in-place clips, `turnL45`/`turnR45` (1.15 s) and `turnL90`/`turnR90` (1.7 s), built in the *turning frame*. The body yaws by a trapezoid profile (rate ramps up over 0.3 s, holds, ramps down, so the peak stays near 78°/s) around a pivot 3 cm ahead of the origin, while each paw keeps its world position until it steps; in body space a planted paw therefore sweeps backwards. The step schedule is simulated at 240 Hz: a paw steps when the body has yawed more than half a step (45°) past its planted angle, lands half a step ahead of the body's current yaw, only diagonal pairs may swing together, the paw furthest behind has priority, and the inner front paw starts. This keeps every paw within ~26° of the body (about 9 cm at the paw radius) instead of the 57° the first attempt produced. The head acquires the new direction first (0.34 rad lead, settling to zero), the chest leads and the pelvis lags by a few degrees, the chest rolls into the turn, the tail swings outward with lag. The Root bone carries the yaw curve.

Runtime (`blueCat.ts`): the Root tracks are stripped from the turn clips at load and sampled through a linear interpolant instead, so the skeleton plays in the turning frame and the body group is rotated by the same curve (`applyTurn`). A heading error above 0.35 rad while standing picks the clip whose nominal angle is nearest (45° stretched between 0.5 and 1.3, 90° between 0.65 and 1.25) and chains a second turn for the rest; `afterTurn` continues with the walk, the arrival clip or the jump. Walking yaw is limited by a 0.45 m turning radius (0.3–1 rad/s), a goal far off the heading brakes to a stop so a turn clip can take over, arrivals turn before settle/sit/perch, the jump no longer snaps its heading, the petted reaction only nudges the body when the visitor is within 0.7 rad, and while curving the chest rolls and the head leads along the path from the measured yaw rate. `stand` and `unperch` are authored (weight forward, hind legs push; one paw after the other back onto the ledge). Plan changes during a turn are deferred to its end. Clip lengths come from the loaded clips.

Regression: `scripts/qa/blue-turn.mjs` drives a goal straight behind Blue and the return to the basket frame by frame, and asserts that turn clips carried the 180°, that walking yaw stays under 1.15 rad/s, that a turn precedes the settle and that the settle itself no longer spins.

### Jumps with root motion (Phase 4)

The in-place `jump` clip and the scripted parabola in `fly()` described different accelerations, and the runtime pitched the whole model separately. Replaced by two authored clips whose Root bone carries the trajectory: `jumpup` (1.5 s: look up, load the hindquarters with the pelvis lower than the chest and the weight back, launch nose-up with the hind legs extending, arc with the front legs folded and the tail back, front paws land first, the hindquarters follow, absorb, settle; 1.95 m up and 1.03 m forward) and `jumpdown` (1.3 s: peer down, push off, accelerating drop nose-down, front paws take the landing, hind contact, settle; 1.95 m down and 0.88 m forward). Whole-body pitch is applied to the skeleton about a pivot at the chest, so it survives the Root stripping. At load the runtime removes the Root tracks, samples the displacement curve and replays it on the body, warping the forward and vertical components separately to the actual take-off and landing points (the compact layout scales Blue but not the cabinet), so the pose and the flight can no longer disagree and the landing is exact by construction. `blue_check.py` follows the Root with camera and lights and hides the floor while airborne.

### Polish round (Phase 5, late 2026-09-12)

Dennis after seeing v3 live: too much clipping, the bed must look far better, Blue should sleep there at the start and get up when the visitor does something, the cabinet jump must not pass through anything, turning and moving should be more realistic, touching different parts should get different reactions, and some turns still had no animation.

- *Jump paths.* Take-off moved to 0.80 m in front of the cabinet and the landing is the lying spot itself. `jumpup` now rises to 2.12 m before any forward travel, hooks the front paws over the marquee top and swings the body in; `jumpdown` pushes off forward first so the hindquarters clear the marquee, then drops. The runtime warps both per axis as before.
- *Bed.* Rounded-rectangle velvet bolster (superellipse, sheen material, woven bump, lavender piping along the ridge), quilted cushion that dips towards the middle, dark plinth. The bed is rotated to Blue's resting heading, its centre 6 cm behind his body origin, the front lip lowered so the sphinx paws and the head rest on it instead of passing through a ring (`BED` constants). Body lift on the cushion 0.085 m, ramped from 0.55 m out so the paws clear the lip on the way in.
- *Sleeping start.* `startAsleep()` puts him in the bed asleep with an infinite dwell; `disturb()` wakes him on 0.7 s of hover, a pet, or a plan change (station pick, About). After that his normal roam/sleep cycle runs. Reduced motion shows him asleep too.
- *Touch reactions.* `pet(hit)` finds the region by the nearest bone (Head/Neck → head, Tail2–5 → tail, else back). Head: the purr (lean in, slow blink; head push while seated or on the ledge). Back while standing: the new `arch` clip (spine up, hindquarters rise, tail up, head dips). Tail: the new `flick` clip stored additively against its own first frame and played on top of any pose (tail lash, ears back, glance over the shoulder, small flinch). Keyboard activation counts as a head touch.
- *Turns.* `TURN_MIN` 0.2 rad and the 45° clip stretchable down to 0.25, so nearly every standing turn is stepped; the settle residual eases at ≤ 0.25 rad/s; the petted reaction no longer rotates the body at all; after landing on the cabinet he turns to the viewer with steps before lying down.
- Not addressed: inertialized interrupts and tail/ear springs ("move more realistically" beyond the authored clips).

### Inertialized interrupts and secondary motion (Phase 6)

Dennis: "do that too" for the remaining "move more realistically" items. `blueCat.ts` now runs a post-mixer pose pipeline every frame (`pose()`): recover the mixer's value for every bone (bones a clip does not key keep last frame's mixer value rather than what the pipeline wrote), apply the inertial offset, run the springs, then the attention overlays, then remember what was written.

- *Inertialization.* Any transition that is not between two resting moods (settle, sleep, wake, sit, sitidle, perch, perchidle) now switches in one frame: the old action stops, the new one gets weight 1, the idle/walk pair snaps. On that frame the pipeline stores, per bone, the rotation from the new pose back to the pose shown last frame and the angular velocity of the shown pose (from its last two frames, capped at 12 rad/s), and decays both with Bollo's critically damped curve over 0.22 s (`decayCritical`). The earlier 0.06 s crossfade plus a slow offset had merely moved the pop into the fade frames; the mixer pose has to jump all at once for the offset to cover it.
- *Tail springs.* Tail1–Tail4 (Tail5 is a static end bone, its channel is pruned) follow the mixer's rotation through second-order springs in rotation-vector space, stiffness 420 → 110 towards the tip with damping ratios 0.75 → 0.55, two substeps at a clamped 1/30 s. The body's smoothed acceleration and measured yaw rate add a deflection request: forward acceleration pulls the tail back and down, turning swings it out (0.28 rad per rad/s at the base, fading to zero by Tail4), applied in the bone's own frame and rotated into the parent frame. Measured on a 180° turn: up to 0.27 rad deviation at Tail4, settling to 0.016 rad within two seconds of standing still.
- *Ears.* The same spring (k 520, ζ 0.5) on both ear bones gives their authored flicks a little overshoot; landing a jump adds an angular impulse that kicks them back once (`earKick`).
- Cost: ~0.045 ms per `update()` for the whole cat (26 bones), measured in Chromium.
- Reduced motion skips the inertializer and the springs; a pause longer than 0.2 s or a teleport resets the spring states and the body-velocity estimate.

### Asset budget (Phase 7)

The runtime GLB had grown to 2.36 MB: a 24k-vertex skin at full float precision, four sparse morph targets and dense 30 fps keys on every bone for 20 clips. The textures were already WebP and small (48 KB normal map, 40 KB coat). New packaging step `scripts/models/blue-pack.mjs` (glTF Transform API) runs after `blue_animate.py`: `resample` at a 1e-4 tolerance drops the keys the bake produced on straight segments, `prune` removes what nothing references, and `meshopt` at level medium quantizes positions and normals to 16 bit, texture coordinates to 16 bit and weights to 8 bit and compresses geometry, morphs and animation with `EXT_meshopt_compression`. Result 919 KB (39 %). The hall's `GLTFLoader` gets `setMeshoptDecoder` from three's bundled WASM decoder; the other models are untouched.

`scripts/qa/blue-asset.test.mjs` (part of `npm run test:review`) guards the file against an optimiser pass changing anything the runtime addresses by name: the 26 joints once each, the exact clip list, morph target names and order, the two materials, Root rotation only on turn clips and Root translation only on jump clips, turn end angles within 1.5° of nominal, jump displacements within 2 cm of authored, and a 1.6 MB size ceiling. KTX2/Basis textures were not adopted: at 88 KB the textures are not the cost, and the toolchain is not installed.

### Dynamic authoring pass (Phase 8)

Dennis after the motion round: "the turning animation still looks way too robotic, in general a lot of the animations look way too robotic and not dynamic like a real cat", plus: he wakes too slowly with the eyes shut too long, and he teleports when the visitor scrolls the arcades.

The cause was in the authoring, not the runtime: every clip was symmetric smoothstep segments on isolated parts with a rigid torso and metronomic steps. Changes in `blue_animate.py`:

- *Bendable spine.* A `bend` channel per torso segment curves the chain in yaw after the drop-based positions are computed (each segment turns a little further than the previous one), so the torso forms a C in turns and an S in the walk; planted paws keep their spots and the leg roots ride on the bent chain. A `root_dz` channel lifts a shoulder or hip with its swinging leg.
- *Easing library.* `ease_out`, `ease_in`, `ease_back` (overshoot and settle) and `curve()` (per-key ease names: smooth, out, in, back, snap) replace uniform smoothstep where weight arrives or a target is acquired; `jitter()` gives deterministic ±12 % variation to repeated timings.
- *Turn.* The head snaps to the new direction (`snap` ease over 0.16 s), the spine bends into a C behind it (up to ~0.5 rad across neck, chest and spine for 90°, half for 45°), the weight shifts onto the inside and rolls out, the chest rolls in, swinging paws arc outward and lift their shoulder, the tail whips out with a tip flick, both ears go back briefly. The root yaw profile now starts quickly and settles slowly (ramp in 0.22 s, out 0.5 s), swing durations are jittered.
- *Walk.* Hips and shoulders roll (0.06/0.04 rad) and the pelvis yaws, the spine sways in an S with the neck and head countering, the weight sits over the stance side, shoulders lift with each swing, paws reach fast and are set down decelerating (`1-(1-u)^2.4`), higher lift, occasional ear flicks.
- *Idle.* Weight drifts side to side with the spine following, and once per loop a front paw is lifted and re-planted.
- *Settle and sit.* The torso arrives with a small overshoot (`ease_back`), the front dips as it folds, weight rocks back before the hindquarters come down.
- *Wake.* 1.5 s instead of 2.4: head up first with a small shake and ear flicks, then the front pushes up, then the hindquarters. In the runtime the eyes open in the first half second of the wake and hover wakes him after 0.35 s.
- *Trot.* New two-beat diagonal gait (0.52 s cycle, 0.9 m/s nominal, bouncing back with the spine flexing, long reaching strides, tail carried up and back). The runtime blends walk into trot by speed (0.42–0.62 m/s) and trots to any goal further than 1.8 m at 0.9 m/s with stronger acceleration; the off-screen teleport for far stations is gone.

Stretch reports stayed in range for every clip (walk p99 1.52, turn frames 1.19–1.62). Asset after packing 943 KB.

### Hall models (Phase 9)

Dennis: optimise all the other 3D models too. Two scripts, run in this order: `scripts/models/shrink-textures.mjs` caps textures (base colour and emissive 2048², normal/roughness/occlusion 1024², all WebP at quality 86) and `scripts/models/pack-models.mjs` deduplicates buffers, prunes, resamples animations and Meshopt-compresses with quantization, in place, keeping originals in `.source-assets/models-original/`. The packer guards structure (node, mesh, material, animation and skin names unchanged, one unnamed wrapper node tolerated) because the hall addresses controls, screens and glow parts by name, and restores any file the pass would make larger. Kenney props are skipped (not loaded by the hall); Blue keeps his own packer.

Two traps: glTF Transform's `textureCompress` and the `functions` bundle pull in a second native sharp build, and two libvips in one process fail every encode with "colourspace: parameter space not set", so the texture pass lives in its own process; and sharp ignores a `Uint8Array`'s byte offset into the GLB buffer, so images are copied into a `Buffer` first.

Result, measured as what the hall actually downloads on a fresh visit: 13.0 MB → 6.1 MB over 19 files. Dennis figure 4.8 → 1.5 MB (its three 4096² maps were 268 MB of GPU memory; now 2048/1024/1024), Nori 2.0 → 0.6 MB, taxi 1.4 → 1.1 MB, Lowlight cabinet 0.54 → 0.19 MB, payphone 0.45 → 0.18 MB, the generated cabinets roughly halved. Before/after screenshots of the hall, About and a station are indistinguishable (`.source-assets/models-qa/`). The two versioned URLs (`dennis.glb?v=`, `mach-lowlight.glb?v=`) got new hashes.

### Coat (Phase 10)

Dennis: "the cat texture honestly looks really bad and low quality". Two causes in the v2 coat: the cleanup kept 35 % of the blurred Meshy atlas, whose island boundaries read as grey smudged patches on a black cat, and the untouched Meshy normal map added sparkle noise under the rect lights.

Now the albedo outside the eye and inner-ear islands is one even, slightly cool black (0.040/0.037/0.046), the material carries no normal texture at all (48 KB less in the file), and `blueCat.ts` generates a 256² tiling fur-grain normal at load (`furGrain()`: two octaves of hashed noise stretched along one axis, converted to normals from its gradients, repeated seven times over the atlas) at a low strength (0.32) with roughness 0.82, sheen 0.7 and a lavender-grey sheen colour. Close-ups on the ledge and in the bed at 2× (`.source-assets/blue/qa/coat-*.png`) show an even velvet black with rim sheen and no specks; a stronger grain (0.55) sparkled again and was backed off. Asset after packing 895 KB. The model's lumpy Meshy silhouette is the remaining quality ceiling; that needs a different mesh, not a texture.
