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
