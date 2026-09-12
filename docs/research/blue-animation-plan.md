# Blue v3 — animation overhaul plan

Source: Dennis's feedback of 2026-09-12 (creepy bulging eyes on the leap, legs hanging too far on the cabinet, robotic spin turns, stiff and unresponsive motion) and the research report `cat-animation.md`. This document maps the report onto the actual pipeline (`blue_rig.py` → `blue_animate.py` → `blue_check.py` → `blueCat.ts`) and fixes the order of work. Not started yet.

## What the code confirms

| Report claim | In our code |
| --- | --- |
| Eyes are flat polygons with no depth | `blue_rig.py` only retints material slot 1; the eyes are painted atlas polygons skinned like the surrounding face. `BlueBlink` moves the iris vertices themselves together with the skin ring. |
| Correctives can deform the face | `BlueGround`, `BlueSit`, `BluePerch` are computed over the whole mesh; only the perch skips the front legs. Nothing excludes head vertices. They are driven by mood and clip age, not by the measured pose. |
| Head pitch plus body pitch during the jump | `jump()` pitches the head nose-up 0.25 rad at launch; `fly()` additionally pitches the whole model up to 0.32 rad; the gaze overlay fades out only at rate 4 and can still add pitch on top. A flat eye seen from the low hall camera under that combined pitch reads as the eye sliding up. |
| Turn is a pure yaw spin | `locomote()` uses `quaternion.rotateTowards` at up to 2.4 rad/s with walk or idle playing; `settle`, `sit` and `perch` keep spinning while the clip plays. |
| Reversed stand/unperch look synthetic | `stand` and `unperch` are `sit` and `perch` at time scale −1. |
| Scripted parabola vs authored jump | `fly()` moves the body; the clip is in place with its own crouch timing. |
| Broad crossfades | `enter()` uses 0.25–1.2 s fades, no phase matching, no inertialization. |
| Secondary motion prescribed | Tail and ears are fully authored sine motion in the clips. |

Rig facts that constrain the design: 26 joints, legs are Upper → Lower → Paw (two-bone chain plus paw segment, so analytic IK is enough), one ear bone per side, six tail bones, root scaled 0.75 and shifted on phones, calm moods beside a panel render every third frame (any solver must tolerate skipped frames).

## Phases

Each phase ends with Blender renders or Playwright evidence, the existing regressions (`blue-cat.mjs`, `blue-companion.mjs`, `blue_check.py`, 27 review tests, `npx astro build`), a commit, and a deployment for Dennis to judge. Nothing from a later phase is required for an earlier one to ship.

### Phase 0 — Forensics (eyes)

1. `blue_check.py` gains a matrix render of the jump clip at 0.30–0.60 s from the hall camera angle: no morphs; each morph alone at influence 1; head pitch at its maximum; jump plus each morph.
2. Blender script reports every vertex the three correctives and the blink move, grouped by dominant bone; list any head-weighted vertex touched by a floor corrective.
3. Playwright dump of eye-vertex skin weights and per-morph deltas on the loaded GLB (the report's `auditEyeDeformation`).
4. Output: which of the four suspects (flat eye geometry, blink delta, corrective bleed, overlay/pitch stacking) causes the bulge. Expected: flat geometry plus pitch stacking, with blink as a secondary contributor.

### Phase 1 — Ledge pose (quick win, Blender only)

1. Replace `FRONT_HANG` (absolute 0.30 m drop) with targets derived from the measured foreleg length: elbow on the top plane just behind the lip, wrist crossing the edge, paw 0.25–0.38 L below the top, unequal per side, paws curled inward.
2. Raise the chest drop so the sternum carries the weight; shoulders protracted slightly toward the edge; neck relaxes after the chest settles; tail last.
3. `BluePerch` corrective excludes head and neck vertices as well as the front legs.
4. Verify with `blue_check.py` renders from the hall camera (below the ledge, looking up) and `blue-companion.mjs` perch height/edge checks.

### Phase 2 — Eyes

1. `blue_rig.py`: add `Eye.L`/`Eye.R` deform bones under `Head`; generate two shallow convex eyeball meshes at the eye-polygon centroids with the pivot at the centre of curvature and overlap behind the lid rim; weight every eyeball vertex 100 % to its eye bone. Push the original eye polygons slightly into the skull so they become the socket floor.
2. Eye texture: procedural amber iris with a vertical slit pupil and dark rim, generated in numpy into a small dedicated texture (or a spare atlas region). Dennis approves the look from renders before it ships.
3. Blink: rebuilt as a lid morph on the skin ring only, sliding over the eyeball; the eyeball is excluded from every morph. Closing 80 ms, hold 25 ms, opening 140 ms, one controller for automatic, hover and purr blinks.
4. All three correctives exclude face vertices.
5. Runtime gaze: eyes acquire the target first within ±10° yaw / +6° −8° pitch, head follows after ~40 ms, eyes recentre as the head catches up; the overlay is suppressed during launch and landing. Overlay composition stays as it is (base/applied tracking) but is verified against clips that omit head tracks.
6. Evidence: jump frames from the hall camera before/after, hover gaze, blink timing.

### Phase 3 — Turning and locomotion

1. New clips in `blue_animate.py`: `turn_L45`, `turn_R45`, `turn_L90`, `turn_R90` (weight shift, planted pivot paw, two to three repositioning steps, root translation around the support polygon, authored root yaw), `walk_curve_L/R` (unequal inner/outer strides, torso bend), authored `stand` and `unperch` instead of reversed playback, optionally `walk_start`/`walk_stop`.
2. Blender exports a sidecar JSON per clip: loop flag, nominal speed, root-motion owner, paw contact windows, root yaw, interruptible-after time.
3. Runtime state graph by heading error: <15° forward walk, 15–45° curved-walk blend by curvature, >35–45° at rest turn-in-place with authored root yaw applied to the body and stripped from the skeleton (warped to the actual angle), >90° brake then 90° turn, left/right chosen once.
4. Path: destinations become short Bézier segments; heading follows the tangent 0.3–0.55 s ahead instead of the raw goal. `settle`/`sit`/`perch` no longer spin during the clip; the turn happens before they start.
5. Locomotion phase kept outside `AnimationAction.time`, idle/walk split with hysteresis, short blends (80–220 ms).
6. Contact solver: paw lock during stance from the sidecar windows, analytic two-bone leg IK to the locked world position, blend in 0.25–0.85, no correction in swing, surfaces are tagged planes (floor, cabinet top) rather than raycasts.
7. Evidence: 300-frame walk with a 90° and a 180° redirect, paw slide metric, station approach at all three viewports.

### Phase 4 — Transitions and jump

1. Inertialization for interrupts (report's `decayCritical` design): root/chest 180–260 ms, legs 120–200 ms, neck/head 140–220 ms, tail 220–350 ms, locked paws excluded. Used when a plan change interrupts settle/sit/perch entry, on pointer reactions, and landing into idle.
2. Jump re-authored with root motion in Blender: acquire, anticipation (pelvis lower than chest, hind paws locked), launch from the hind legs, flight with spine arch and tail counterbalance, front-paw contact first, hind contact, settle. Runtime reads the root curve, warps only the flight segment to the cabinet landing, and lets landing IK absorb the remaining error. `fly()` and the separate pitch damping go away.
3. The climb-down gets its own authored clip with root motion instead of the reversed perch plus hop.
4. Evidence: jump frame strip from the hall camera at 1440×900 and 390×844, landing paw positions on the cabinet plane.

### Phase 5 — Secondary motion

1. Tail: clips keep an intent pose; a six-point Verlet chain with stiffness decreasing toward the tip follows it; visitor reactions bias the goal, not the spring state.
2. Ears: authored intent plus a small single-bone spring for overshoot and a landing kick.
3. `dt` clamped to 1/30 with substeps; spring state reset after tab suspension, teleport or plan snaps (reduced motion).
4. Frame order in `update()` becomes: planner → trajectory → state graph → mixer → inertializer → root motion → contact solver → gaze → springs → morphs, with the intermediate `updateMatrixWorld` calls the solvers need.

### Phase 6 — Asset budget and regression hardening

1. `gltf-transform resample` and Meshopt on the animation data (loader gets `MeshoptDecoder`), atlas to WebP; measure network size and decoded memory. Keep the GLB under ~3 MB.
2. Regression tests assert node names, skeleton hierarchy, eye parenting and morph dictionary before any optimiser pass is accepted.
3. Rerun `blue-cat-firefox.mjs`, phone viewport, and the hall hitch measurement from the performance audit (extra per-frame IK and springs must not add main-thread holds).
4. Update `docs/research/blue-cat.md` and the handover.

## Out of scope for now

Mode-Adaptive Neural Networks and motion matching: no licensed cat motion data, large payload, not art-directable. Revisit only if the authored approach still fails after Phase 4.

## Risks and decisions for Dennis

- **Eye look changes.** The painted Meshy irises get replaced by generated eyeballs. Renders go to Dennis for approval before the asset ships.
- **Stroll speed, sit side, leap height, head tuck** stay tunable constants; Dennis has not judged v2 live yet, so those vetoes may arrive mid-plan and are folded into the running phase.
- **Performance.** Contact IK, inertialization and springs run every frame on the main thread. The Phase 6 hitch measurement gates the release; on phones the contact solver only runs for stance paws.
- **Order.** Phase 1 ships first because it is a half-day Blender change and visible immediately; Phase 0 and 2 follow because the eyes are the strongest complaint; turning (Phase 3) is the largest block of work.
