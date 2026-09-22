---
title: "Smooth, Dynamic and Responsive Cat Animation in Three.js"
description: "A technical implementation report covering Blender authoring, three.js runtime animation, quadruped turning, eye construction, IK, root motion, inertialization and secondary dynamics."
tags:
  - three.js
  - Blender
  - animation
  - quadruped
  - Astro
  - React
---

# Smooth, Dynamic and Responsive Cat Animation in Three.js

The highest-return solution is a **hybrid animation stack**: improve a small set of reference-driven Blender clips, let authored root motion handle weight and timing, then add runtime trajectory prediction, contact-aware IK, inertialized transitions, gaze, and lightweight spring-bone secondary motion.

Do not pursue neural locomotion or full motion matching yet. The current problems arise primarily from deformation isolation, missing turn/contact animation, broad crossfades, and post-processing order.

## Prioritized diagnosis

| Priority | Problem | Most likely causes, ordered | First intervention |
|---:|---|---|---|
| P0 | Creepy eyes | Corrective or blink morph deltas touching eye/socket vertices; socket vertices weighted differently from eye polygons; eye surface lacks physical depth and eyelid occlusion; accumulated post-mixer head rotation | Isolate every morph and deformation, then separate the eyeballs or rigid-weight them to dedicated eye bones |
| P0 | Toy-like turning | Root yaw is independent of foot placement; idle/walk remains active during large heading changes; no anticipation, lateral weight shift or authored turning contacts | Add 45°/90° turn-in-place clips and one curved-walk pair |
| P1 | Stiffness | Channels share similar timing; limbs are solved geometrically without enough chest/hip transfer; crossfades combine incompatible contacts; secondary motion is directly prescribed | Add contact metadata, phase synchronization, asymmetric timing and post-animation springs |
| P1 | Ledge pose | The 0.30 m paw drop is an absolute target; IK constrains the paw but not the elbow; chest and shoulder placement do not carry the visible weight | Rebuild around elbow and chest support with leg-length-normalized targets |
| P2 | Jump | Scripted trajectory and authored pose describe different accelerations; no explicit front-paw landing contacts; root pitch is damped independently from the spine | Export authored root motion and warp it to the cabinet target |
| P2 | Responsiveness | Crossfades wait for long poses; interrupts preserve no outgoing velocity; heading reacts only to the current destination | Add inertialization and 0.3–0.5 seconds of trajectory look-ahead |
| P3 | Optimization | Dense baked tracks, morph deltas and the atlas probably dominate bandwidth, not the 26-joint skeleton | Deduplicate keys, use Meshopt for animation and compress the atlas |

The existing 26-joint skeleton is sufficient. Two eye bones would help, but a larger production rig, neural controller or motion-matching database would not address the immediate causes.

## Eye system

### Diagnose before rebuilding

Run this deformation matrix in Blender and after `GLTFLoader`:

1. Bind pose, all actions stopped, all morph influences zero.
2. Jump clip only, with runtime overlays disabled.
3. Head overlay only on a static bind pose.
4. Blink at influence 1, with no skeleton animation.
5. Each floor-contact corrective at influence 1.
6. Head pitched to its current maximum with no morphs.
7. Jump plus one morph at a time.
8. Compare Blender, an independent glTF viewer and three.js.

Three.js exposes imported targets through `morphTargetDictionary` and `morphTargetInfluences`. See the [official morph-target face example](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_morphtargets_face.html).

Audit vertices assigned to the eye material:

```ts
function collectGroupVertices(
  geometry: THREE.BufferGeometry,
  materialIndex: number,
): Set<number> {
  const result = new Set<number>();
  const index = geometry.index;

  for (const group of geometry.groups) {
    if (group.materialIndex !== materialIndex) continue;

    for (let i = group.start; i < group.start + group.count; i++) {
      result.add(index ? index.getX(i) : i);
    }
  }

  return result;
}

function auditEyeDeformation(
  mesh: THREE.SkinnedMesh,
  eyeMaterialIndex: number,
) {
  const g = mesh.geometry;
  const eyeVerts = collectGroupVertices(g, eyeMaterialIndex);
  const skinIndex = g.getAttribute("skinIndex");
  const skinWeight = g.getAttribute("skinWeight");

  for (const vi of eyeVerts) {
    const joints = [
      skinIndex.getX(vi),
      skinIndex.getY(vi),
      skinIndex.getZ(vi),
      skinIndex.getW(vi),
    ];
    const weights = [
      skinWeight.getX(vi),
      skinWeight.getY(vi),
      skinWeight.getZ(vi),
      skinWeight.getW(vi),
    ];

    console.log("eye vertex", vi, joints.map((joint, k) => ({
      bone: mesh.skeleton.bones[joint]?.name,
      weight: weights[k],
    })));
  }

  for (const [name, targetIndex] of Object.entries(
    mesh.morphTargetDictionary ?? {},
  )) {
    const attr = g.morphAttributes.position?.[targetIndex];
    if (!attr) continue;

    let maxDelta = 0;
    let affected = 0;

    for (const vi of eyeVerts) {
      const delta = Math.hypot(
        attr.getX(vi),
        attr.getY(vi),
        attr.getZ(vi),
      );
      if (delta > 1e-6) affected++;
      maxDelta = Math.max(maxDelta, delta);
    }

    console.log(name, { affectedEyeVertices: affected, maxDelta });
  }
}
```

Also audit one or two rings of socket vertices. A rigid eye weighted to the head can still appear to slide when its eyelid and cheek boundary blend among the head, neck and upper spine.

In Blender, report unexpected shape-key deltas:

```py
import bpy

obj = bpy.data.objects["Cat"]
basis = obj.data.shape_keys.key_blocks["Basis"]

allowed = {
    "floor_contact_FL": set(...),
    "floor_contact_FR": set(...),
    "floor_contact_HL": set(...),
}

for key in obj.data.shape_keys.key_blocks:
    if key.name == "Basis":
        continue

    bad = []
    allowed_verts = allowed.get(key.name)

    for i, (base_pt, key_pt) in enumerate(zip(basis.data, key.data)):
        delta = (key_pt.co - base_pt.co).length
        if delta > 1e-6 and allowed_verts is not None and i not in allowed_verts:
            bad.append((i, delta))

    print(key.name, sorted(bad, key=lambda x: -x[1])[:30])
```

The [Blender ShapeKey API](https://docs.blender.org/api/current/bpy.types.ShapeKey.html) gives direct access to target point data and optimized bulk access.

### Recommended construction

| Construction | Robustness | Gaze | Cost | Recommendation |
|---|---:|---:|---:|---|
| Current eye polygons, head-weighted | Low | No independent rotation | Lowest | Retire unless intentionally painted flat |
| Separate eye objects, bone-parented to head | High | Rotate each object | Two small objects/draw calls | Best development option |
| Existing skinned mesh with two eye bones | High | Excellent | Two extra joints | Best final optimization |
| Separate pupils over fixed eyeballs | High | Stylized gaze | Small geometry cost | Good for graphic eyes |
| Shader-only pupils | High | Excellent | Lowest geometry cost | Good later optimization |

Start with **two shallow convex eyeball meshes parented to the head bone**, sharing the current atlas and material where possible.

Each eyeball should have:

- A spherical or shallow convex back extending into the socket.
- Its pivot at the approximate center of curvature.
- Enough overlap behind the lid rim that head pitch cannot reveal its rear edge.
- No armature modifier and no morph targets.
- No inherited nonuniform scale.
- A left/right neutral gaze orientation stored in local space.

If extra objects become undesirable, add `eye.L` and `eye.R` deform bones, join the eye geometry to the skinned mesh and assign every eye vertex exclusively to its eye bone. Use Blender's `Clean`, `Limit Total` and `Normalize All` operations to remove stray influences. See [Blender vertex weights](https://docs.blender.org/manual/en/latest/modeling/meshes/properties/vertex_groups/vertex_weights.html).

### Eyelids and blink

The blink target should affect only the eyelids, brow and immediately adjacent socket vertices. It must not translate, scale or flatten the eyeball.

Preferred approaches:

- Upper and lower lid geometry occlude a rigid eyeball; a morph closes the lids.
- A stylized dark lid plane moves across the eye.
- A face morph closes the socket over a rigid eye.

Avoid scaling the entire eye vertically, moving it into the skull, or allowing floor-contact correctives to alter face vertices.

Use separate closing and opening timing:

```ts
const blink = {
  close: 0.08,
  hold: 0.025,
  open: 0.14,
};
```

Automatic and hover blinks should feed one controller so two systems cannot write the same influence concurrently.

### Gaze behavior

Cats coordinate eye and head movement rather than rotating the eyes through large angles. Research on cat gaze shows that larger gaze changes increasingly involve head rotation, with the eyes subsequently counter-rotating as the head completes its motion. See [Coordination of head and eyes in cats](https://pmc.ncbi.nlm.nih.gov/articles/PMC1279357/) and [Kinematics and eye–head coordination](https://pmc.ncbi.nlm.nih.gov/articles/PMC1890377/).

Implement that relationship:

1. Eyes acquire the target quickly.
2. The head starts following after roughly 30–60 ms.
3. Eyes recenter as the head catches up.
4. The upper spine contributes as head yaw approaches its limit.

Conservative initial limits:

```ts
const limits = {
  eyeYaw: THREE.MathUtils.degToRad(10),
  eyePitchUp: THREE.MathUtils.degToRad(6),
  eyePitchDown: THREE.MathUtils.degToRad(8),
  headYaw: THREE.MathUtils.degToRad(38),
  headPitchUp: THREE.MathUtils.degToRad(20),
  headPitchDown: THREE.MathUtils.degToRad(25),
};
```

Use frame-rate-independent damping such as [`THREE.MathUtils.damp`](https://threejs.org/docs/pages/MathUtils.html).

### Overlay composition

Do not repeatedly multiply an overlay into an untracked bone state:

```ts
// Unsafe when the mixer does not rewrite the bone every frame.
head.quaternion.multiply(delta);
```

Instead, rebuild the displayed result from the mixer's pose every frame:

```ts
mixer.update(dt);

baseHeadQ.copy(head.quaternion);
head.quaternion
  .copy(baseHeadQ)
  .multiply(headLookDelta)
  .normalize();
```

If some clips omit the head track, add a constant track or restore a declared base pose before composing the overlay. Otherwise the delta can accumulate across frames.

## Ledge pose

### Pose concept

Build the pose around three visible supports:

- Chest or sternum carries most of the apparent weight on the shelf.
- Both elbows or proximal forearms remain near the top plane.
- Only distal forearms and paws break the edge silhouette.

Replace the absolute 0.30 m drop with fractions of foreleg length `L`:

| Target | Starting position |
|---|---|
| Chest | Shelf height + 0.02–0.05 `L`; behind edge by 0.20–0.30 `L` |
| Shoulder | Behind edge by 0.12–0.22 `L` |
| Elbow | Shelf height + 0.01–0.04 `L`; behind edge by 0.02–0.10 `L` |
| Carpus | Below top by 0.12–0.20 `L`; just beyond edge |
| Paw center | Below top by 0.25–0.38 `L`; slightly inward |
| Paw rotation | Mild flexion or curl rather than vertical extension |

For a 0.25 m shoulder-to-paw length, the paw ends about 6–10 cm below the shelf rather than 30 cm. Use slightly different heights and rotations for the two paws.

### IK construction

A single two-bone solve can satisfy paw position and choose an elbow plane, but it cannot guarantee an exact elbow contact. Because the rig has three foreleg segments, use one of these approaches:

1. In Blender, place chest and shoulder first, use the pole to position the elbow on the surface, solve to a carpus target near the edge and orient the paw separately.
2. Use three-segment FABRIK and soft-constrain the elbow near the shelf plane.
3. Adjust shoulder/scapula rotation to reduce elbow error, solve shoulder–elbow–carpus analytically, then orient the paw.

Three.js includes [`CCDIKSolver`](https://threejs.org/docs/pages/CCDIKSolver.html) with per-link limits and blend factors. [`three-ik`](https://github.com/whatisor/THREE.IK) provides an open-source FABRIK implementation.

For a mostly authored perch, solve in Blender and reserve runtime IK for small shelf-height corrections.

Define the front-leg poles in chest space:

```ts
pole = shoulder
  + lateralAxis * (sideSign * 0.10 * L)
  - forwardAxis * (0.35 * L)
  + upAxis * (0.03 * L);
```

The backward component keeps the elbow caudal rather than forcing it beneath the neck. The lateral offset prevents both elbows collapsing toward the center line.

### Authoring sequence

1. Lower the chest onto the shelf before moving the paws forward.
2. Protract the shoulders slightly toward the edge.
3. Place the elbows just behind the lip.
4. Let each carpus cross the edge.
5. Curl the paws inward by small unequal amounts.
6. Relax the neck after the chest settles.
7. Let the tail finish last.

The Blender reference rig should contain `shelf_plane`, `edge_line`, `elbow_target.L/R`, `carpus_target.L/R` and pole-vector empties. Generate their positions from body measurements rather than fixed meter offsets.

## Turning system

### Production lessons

Public material on *Stray* indicates that the cat animation was hand-authored using extensive live-cat video and an office Sphynx as anatomical reference. The animator and programmer iterated together on jumps, transitions and responsiveness. See [PlayStation's production article](https://blog.playstation.com/2022/07/15/getting-to-know-strays-leading-feline-out-july-19/).

The most applicable small-team reference is the GDC session [Animating Quadruped Characters in The Flame in the Flood](https://gdcvault.com/play/1023209/Animating-Quadruped-Characters-in-The), which addresses locomotion, foot sliding, state blending and a procedural spine from a solo-animator perspective.

### Recommended hybrid

Use three locomotion modes:

| Heading error | Speed | Motion |
|---:|---:|---|
| Under 15° | Any | Forward locomotion |
| 15–45° | Moving | Curved walk |
| Over 35–45° | Near zero | Turn-in-place clip |
| Over 90° | Moving slowly | Brake, shift weight, then use a 90° turn |
| Destination behind | Any | Select left or right once; do not oscillate |

Author:

- `turn_L45`, mirrored to `turn_R45`.
- `turn_L90`, mirrored to `turn_R90`.
- `walk_curve_L`, mirrored to `walk_curve_R`.
- Optionally `walk_start` and `walk_stop`.

Each turn clip needs:

- 100–180 ms of visual acquisition and weight shift.
- A planted pivot paw.
- Two or three repositioning steps.
- Root translation around the support polygon, not only yaw.
- Offset chest and pelvis yaw.
- Tail counterbalance.
- Contact markers for all paws.
- Authored root yaw matching the nominal angle.

### Curved walking

Represent the desired trajectory using forward speed `v` and yaw rate `omega`. Curvature is:

```text
curvature = omega / max(v, epsilon)
```

Blend clips using normalized curvature:

```ts
const curvature = clamp(yawRate / Math.max(speed, 0.05), -maxK, maxK);
const leftWeight = Math.max(0, -curvature / maxK);
const rightWeight = Math.max(0, curvature / maxK);
const forwardWeight = 1 - Math.max(leftWeight, rightWeight);
```

The curved clips should contain unequal inner/outer strides and torso bending. Runtime IK corrects residual contact errors; it should not manufacture the whole turn.

At larger curvature:

- Shorten inner-leg swing targets.
- Extend outer-leg targets.
- Move the chest slightly into the turn.
- Let the tail move outward with lag.
- Point the head closer to the path tangent than the hips.

### Predictive heading

Replace direct target heading with a short predicted trajectory:

```ts
const lookAheadTime = THREE.MathUtils.clamp(
  0.30 + speed * 0.5,
  0.30,
  0.55,
);

const futurePoint = path.sampleByTime(lookAheadTime);
const desiredHeading = headingTo(character.position, futurePoint);
```

Feed the next path segment into heading before the cat reaches the current endpoint. Replace hard straight-line corners with short quadratic or cubic Bézier segments, then derive heading from the curve tangent.

### Root motion

Use root motion for turn-in-place and jumping. Ordinary walking can remain controller-driven, but each state needs a declared movement owner.

For each sample:

```text
translationDelta = rootPositionNow - rootPositionPrevious
rotationDelta = inverse(rootRotationPrevious) * rootRotationNow
```

Apply the deltas to the outer `characterRoot`, then remove the accumulated exported root transform from the visual skeleton. When warping a 45° clip to 38°, distribute the difference over the clip rather than snapping at completion.

## Contact system

### Foot locking

Add a contact curve per paw to locomotion, turn and landing clips:

```ts
interface ContactSample {
  FL: number;
  FR: number;
  HL: number;
  HR: number;
}
```

During stance:

1. Capture paw position and orientation in world space.
2. Hold that transform while the root moves.
3. Solve the leg to the locked target.
4. Fade IK around lift-off and touchdown.
5. Release before the authored swing begins.

The Orange Duck's [Inverse Kinematics and Foot Locking](https://theorangeduck.com/page/inverse-kinematics-foot-locking) gives a useful implementation reference.

Initial policy:

- Lock paws fully above contact weight 0.85.
- Blend correction from 0.25 to 0.85.
- Do not correct swing paws.
- Limit body-height correction per frame.
- Use the strongest two or three contacts when estimating a support plane.

Do not force all paws to IK weight 1 simultaneously.

### Surface adaptation

For a controlled website layout, tagged analytic surfaces are cheaper and more stable than arbitrary raycasting:

```ts
interface SupportSurface {
  id: string;
  plane: THREE.Plane;
  edge?: THREE.Line3;
  bounds: THREE.Box3;
  material: "floor" | "cabinet" | "shelf";
}
```

Use raycasting only for irregular geometry. On phones, run casts only for touchdown prediction and active stance paws, or evaluate known planes analytically.

## Procedural locomotion

A Codeer-style stepping controller—continuous body movement plus independently replanted legs—is practical in TypeScript, but a completely procedural implementation can look spider-like. Plausible paw positions do not automatically create plausible scapula, spine, shoulder and emotional motion.

Use a hybrid:

- Authored clips provide chest, pelvis, spine, head and shoulder rhythm.
- Procedural targets adapt paw placement and turning radius.
- Contact locking removes sliding.
- Procedural swing arcs adapt step length.
- Authored actions retain jump, sit, sleep, perch and expressive motion.

A scheduler can use:

```ts
const shouldStep =
  footError > stepThreshold &&
  plantedCount >= 3 &&
  timeSinceLastStep > minStepInterval;
```

Swing interpolation:

```ts
const u = smoothstep01(stepTime / stepDuration);
const horizontal = start.clone().lerp(end, u);
const lift = 4 * stepHeight * u * (1 - u);

footTarget
  .copy(horizontal)
  .addScaledVector(surfaceNormal, lift);
```

Freeze the target after roughly 60–70% of the swing unless collision avoidance requires a correction. Continuously moving targets near touchdown create nervous tapping.

## Secondary motion

### Tail

Separate intent from physics:

- The clip controls a tail goal chain.
- The rendered tail follows that goal with spring lag.
- The base remains relatively stiff.
- Stiffness decreases toward the tip.
- Visitor reactions bias the goal without resetting spring velocity.

[`@pixiv/three-vrm-springbone`](https://www.npmjs.com/package/@pixiv/three-vrm-springbone) provides an MIT-licensed spring-bone implementation for three.js. Other references include [Wiggle Bones](https://wiggle.three.tools/) and [threeZboingZboing](https://github.com/WebAR-rocks/threeZboingZboing).

For a four- or five-bone tail, a custom Verlet chain is also reasonable:

```ts
next = current
  + (current - previous) * (1 - drag)
  + acceleration * dt * dt;
```

Project each point back to its fixed segment length, then derive bone rotation from the simulated child direction.

### Ears

Do not simulate the full ear orientation. Compose:

1. Authored emotional pose.
2. Fast orienting response.
3. Small spring overshoot.

Recommended behavior:

- Ear base is almost entirely intentional.
- Ear tip lags by 40–100 ms.
- Landing causes one small backward kick and damped recovery.
- Pointer acquisition moves the ears before the head, but only a few degrees.

Reset spring state after tab suspension, teleportation or a large time step. Clamp `dt` or use substeps.

## Animation blending

### Avoid crossfade mush

Three.js actions support crossfades, time warping and synchronization through [`AnimationAction`](https://threejs.org/docs/pages/AnimationAction.html). Maintain locomotion phase explicitly rather than assuming actions stay synchronized forever.

For locomotion transitions:

1. Store normalized gait phase outside `AnimationAction.time`.
2. Start the incoming gait at a matching phase.
3. Prefer transitions with compatible support patterns.
4. Use a short blend.
5. Apply foot locking throughout.
6. Warp time scale gradually rather than resetting phase.

| Transition | Initial duration |
|---|---:|
| Forward walk ↔ curved walk | 80–140 ms |
| Walk ↔ stop | 120–220 ms |
| Idle → turn anticipation | 80–120 ms |
| Turn → walk | 100–180 ms |
| Expressive full-body action | 180–300 ms |
| Interrupted settle/perch | Inertialize over 180–350 ms |

Do not maintain roughly equal idle/walk weights at low speed. Use hysteresis and a start/stop region so the cat commits to a support pattern.

### Bone masks

`AnimationMixer` has no first-class Avatar Mask. Clone clips and remove tracks outside the desired bone set. [`PropertyBinding.parseTrackName`](https://threejs.org/docs/pages/PropertyBinding.html) can parse track paths.

```ts
function maskClip(
  clip: THREE.AnimationClip,
  allowedBones: Set<string>,
  suffix: string,
): THREE.AnimationClip {
  const tracks = clip.tracks.filter((track) => {
    const parsed = THREE.PropertyBinding.parseTrackName(track.name);

    const boneName = parsed.objectName === "bones"
      ? String(parsed.objectIndex)
      : String(parsed.nodeName ?? "");

    return allowedBones.has(boneName);
  });

  return new THREE.AnimationClip(
    `${clip.name}:${suffix}`,
    clip.duration,
    tracks.map((track) => track.clone()),
    clip.blendMode,
  );
}
```

Use one mixer. Multiple mixers writing the same skeleton create ordering-dependent results.

Recommended stack:

- Full-body base locomotion/action.
- Additive spine breathing.
- Additive neck/head orientation.
- Ear intent.
- Blink/morph controller.
- Runtime IK.
- Spring-bone post-process.

[`AnimationUtils.makeClipAdditive`](https://threejs.org/docs/pages/AnimationUtils.html) converts a clip relative to a reference frame. Remove tracks outside the intended layer first and use a real neutral reference frame.

## Jump system

### Author the complete action

For the 1.4-second clip:

| Time | Phase | Pose intent |
|---:|---|---|
| 0.00–0.18 | Acquire | Eyes/head locate landing; body aligns |
| 0.18–0.42 | Anticipation | Pelvis lowers and shifts back; hind legs load |
| 0.42–0.54 | Launch | Hind legs extend rapidly; chest rises; forelegs reach |
| 0.54–0.86 | Flight | Spine lengthens, then begins arching; tail stabilizes pitch |
| 0.86–1.04 | Front contact | Forepaws meet ledge; shoulders and elbows absorb |
| 1.04–1.20 | Hind contact | Hindquarters arrive; spine compresses |
| 1.20–1.40 | Settle | Head and tail complete overlap |

The crouch should not be a uniform vertical squash:

- Pelvis lowers more than the chest.
- Hind paws remain locked.
- Head initially stays comparatively stable.
- Tail shifts to counter the rearward center of mass.
- Launch propagates from hind paws through pelvis, spine, chest and head.
- Landing propagates from front paws through shoulders and spine to the hindquarters.

### Root-motion warping

Export the root's translation and yaw from Blender. At runtime:

1. Read the root-motion curve.
2. Extract frame-to-frame translation and yaw.
3. Apply them to `characterRoot`.
4. Remove them from the visual skeleton.
5. Warp accumulated displacement to the landing transform.

Use the authored vertical timing rather than replacing it with a separate parabola. Separate warping into:

- Pre-launch horizontal alignment.
- Ballistic flight displacement.
- Landing endpoint correction.
- Post-contact IK absorption.

Do not scale the entire root curve uniformly to a new height. Warp the flight segment and let landing IK absorb the remaining endpoint error.

## Blender authoring

### Better procedural curves

Add a clear temporal hierarchy:

- Eyes/head acquire first for intentional actions.
- Chest starts turning before the pelvis during navigation.
- Pelvis leads launch.
- Spine transfers motion with joint-dependent phase offsets.
- Tail base follows pelvis and the tip follows later.
- Ears react quickly but settle after the head.

Generate semantic keys rather than only dense samples:

```py
def set_dynamic_key(kp, interpolation="BEZIER", handle="AUTO_CLAMPED"):
    kp.interpolation = interpolation
    kp.handle_left_type = handle
    kp.handle_right_type = handle
```

Blender keyframes support Bézier and easing modes including `BACK`, `BOUNCE` and `ELASTIC`. See the [Keyframe Python API](https://docs.blender.org/api/current/bpy.types.Keyframe.html). Use overshoot on ears, tail, head accents and settling rotations, never on planted paw positions.

Add low-frequency procedural variation only to secondary channels. Blender's [Noise F-Curve modifier](https://docs.blender.org/api/current/bpy.types.FModifierNoise.html) exposes scale, strength, phase, roughness and detail.

Suggested variation:

- Breathing: low-frequency chest/spine motion.
- Tail idle: two or three overlapping low frequencies.
- Ears: sparse micro-adjustments, not continuous noise.
- Head: short holds connected by quick gaze changes.
- Planted paws: no noise.

### Bake correctly

Blender constraints and control rigs do not transfer directly. Bake final deform-bone transforms to FK. [`bpy.ops.nla.bake`](https://docs.blender.org/api/current/bpy.ops.nla.html) supports visual keying, pose channels and curve cleanup.

```py
bpy.ops.nla.bake(
    frame_start=start,
    frame_end=end,
    step=1,
    only_selected=True,
    visual_keying=True,
    clear_constraints=False,
    use_current_action=True,
    clean_curves=True,
    bake_types={'POSE'},
    channel_types={'LOCATION', 'ROTATION', 'SCALE'},
)
```

Keep the control rig in the `.blend`, but export deform bones only. Validate the baked action before exporting.

### Sampling rate

Moving from 30 fps to 60 fps will not fix uniform timing or weak poses because three.js interpolates between keys.

Recommended policy:

- Author and evaluate at 60 fps when it improves fast impacts and secondary motion.
- Bake at 60 fps while validating.
- Test a 30 fps resampled browser copy.
- Keep 60 fps only where visible differences survive interpolation.
- Keep contacts in continuous time rather than integer runtime frames.

Be careful with optimizer defaults: `gltfpack` may resample animation unless configured. See the [`gltfpack` options](https://manpages.debian.org/testing/gltfpack/gltfpack.1.en.html).

### Export optimization

Use a controlled pipeline:

```bash
gltf-transform inspect cat-source.glb
gltf-transform resample cat-source.glb cat-resampled.glb
gltf-transform meshopt cat-resampled.glb cat.glb --level medium
```

[`gltf-transform resample`](https://gltf-transform.dev/modules/functions/functions/resample) removes redundant baked keys. The [glTF Transform CLI](https://gltf-transform.dev/cli) supports Meshopt compression for geometry, morphs and animation data.

Avoid an unreviewed one-command optimizer pass until node names, skeleton hierarchy, eye parenting and morph dictionaries have automated regression tests.

For the atlas:

- Test WebP first for minimum integration cost.
- Test KTX2/Basis if GPU memory or upload time is a phone bottleneck.
- Preserve alpha-edge quality around eyes when using alpha masking.
- Measure both network size and decoded GPU memory.

## Inertialization

### Why use it

David Bollo's GDC talk [Inertialization: High-Performance Animation Transitions in Gears of War](https://www.gdcvault.com/play/1025165/Inertialization-High-Performance-Animation-Transitions) describes switching immediately to the target animation, measuring the source-to-target pose and velocity offsets, and smoothly decaying those offsets. It avoids evaluating two full animations throughout the transition and preserves outgoing momentum better than a broad crossfade.

Use it for:

- Redirecting during walk or turn anticipation.
- Interrupting settle, sit or perch entry.
- Returning from pointer reaction to navigation.
- Jump landing into idle or walk.
- Transitions without compatible contact phases.

Do not inertialize locked paw targets. Run IK afterward.

### JS implementation

Store local position, rotation, linear velocity and angular velocity for each inertialized joint. Represent rotational offsets as scaled angle-axis vectors using quaternion logarithm/exponential operations. Keep quaternion signs on the closest hemisphere.

Critical decay for vectors:

```ts
function decayCritical(
  x: THREE.Vector3,
  v: THREE.Vector3,
  settleSeconds: number,
  dt: number,
) {
  const omega = 4 / Math.max(settleSeconds, 1e-4);
  const e = Math.exp(-omega * dt);

  const j1 = v.clone().addScaledVector(x, omega);
  const oldX = x.clone();

  x.copy(oldX.addScaledVector(j1, dt)).multiplyScalar(e);
  v.addScaledVector(j1, -omega * dt).multiplyScalar(e);
}
```

Joint state:

```ts
interface InertialJoint {
  bone: THREE.Bone;

  previousPosition: THREE.Vector3;
  previousRotation: THREE.Quaternion;

  sourceVelocity: THREE.Vector3;
  sourceAngularVelocity: THREE.Vector3;

  positionOffset: THREE.Vector3;
  velocityOffset: THREE.Vector3;

  rotationOffset: THREE.Vector3;
  angularVelocityOffset: THREE.Vector3;
}
```

Transition start:

```ts
function beginTransition(targetAction: THREE.AnimationAction) {
  snapshotSourcePose();

  stopBaseActions();
  targetAction.reset().play();
  mixer.update(0);

  for (const joint of inertialJoints) {
    joint.positionOffset
      .copy(joint.previousPosition)
      .sub(joint.bone.position);

    joint.velocityOffset
      .copy(joint.sourceVelocity)
      .sub(estimateTargetLinearVelocity(joint));

    const inverseTarget = joint.bone.quaternion.clone().invert();
    const delta = inverseTarget
      .multiply(joint.previousRotation)
      .normalize();

    quaternionToScaledAngleAxis(delta, joint.rotationOffset);

    joint.angularVelocityOffset
      .copy(joint.sourceAngularVelocity)
      .sub(estimateTargetAngularVelocity(joint));
  }
}
```

Per frame:

```ts
mixer.update(dt);

for (const joint of inertialJoints) {
  decayCritical(
    joint.positionOffset,
    joint.velocityOffset,
    transitionSettle,
    dt,
  );

  decayCritical(
    joint.rotationOffset,
    joint.angularVelocityOffset,
    transitionSettle,
    dt,
  );

  joint.bone.position.add(joint.positionOffset);

  scaledAngleAxisToQuaternion(joint.rotationOffset, tempQ);
  joint.bone.quaternion.multiply(tempQ).normalize();
}
```

Estimate source velocities from the final displayed pose after existing inertial offsets but before IK and spring bones. That preserves visible momentum when one transition interrupts another.

Starting settle times:

- Root/chest: 180–260 ms.
- Unlocked legs: 120–200 ms.
- Neck/head: 140–220 ms.
- Tail intent: 220–350 ms.
- Locked paws: no inertialization.

## Target architecture

```text
Visitor Input / Station Plan
             │
             ▼
     Trajectory Predictor
  position, speed, heading,
 curvature, look-ahead target
             │
             ▼
       Motion State Graph
 idle / walk / curve / turn /
 jump / sit / perch / actions
             │
             ▼
       Base Pose Sampler
      THREE.AnimationMixer
             │
             ▼
        Inertializer
 local bone offsets + velocity
             │
             ▼
 Root Motion + Motion Warping
             │
             ▼
  Contact and Surface Solver
 foot locks, body height, leg IK
             │
             ▼
      Intentional Overlays
 gaze, spine aim, ear response
             │
             ▼
      Secondary Dynamics
 tail and ear spring chains
             │
             ▼
      Morph Controller
 blink + isolated correctives
             │
             ▼
           Render
```

### Runtime ownership

| Property | Owner |
|---|---|
| Navigation destination | Planner |
| Desired speed, heading and curvature | Trajectory predictor |
| Base bone transforms | `AnimationMixer` |
| Transition continuity | Inertializer |
| Character world translation/yaw | Root-motion controller |
| Planted paw world transforms | Contact solver |
| Neck/head gaze delta | Look controller |
| Eye local rotation | Gaze controller |
| Tail/ear lag | Spring solver |
| Blink and correctives | Morph controller |
| Cabinet landing transform | Motion warper |

Recommended frame order:

```ts
function update(dtRaw: number) {
  const dt = Math.min(dtRaw, 1 / 30);

  planner.update(dt);
  trajectory.update(dt, planner.intent);
  stateGraph.update(dt, trajectory);

  mixer.update(dt);
  inertializer.apply(dt);

  rootMotion.update(dt, trajectory);
  characterRoot.updateMatrixWorld(true);

  contactSolver.update(dt);
  characterRoot.updateMatrixWorld(true);

  gazeController.update(dt);
  secondaryMotion.update(dt);
  morphController.update(dt);

  characterRoot.updateMatrixWorld(true);
}
```

The intermediate `updateMatrixWorld()` calls are required because IK, gaze and spring stages use world-space transforms.

### Authoring metadata

Generate a sidecar JSON from Blender:

```json
{
  "walk": {
    "loop": true,
    "nominalSpeed": 0.19,
    "rootMotion": "horizontal",
    "contacts": {
      "FL": [[0.00, 0.29], [0.82, 1.00]],
      "FR": [[0.32, 0.61]],
      "HL": [[0.18, 0.47]],
      "HR": [[0.55, 0.84]]
    }
  },
  "turn_L45": {
    "loop": false,
    "rootYaw": 0.785398,
    "interruptibleAfter": 0.22,
    "events": {
      "weightShiftComplete": 0.16,
      "primaryPlant": 0.27
    }
  }
}
```

This is easier to test and version than recovering contacts from paw velocity in the browser.

## Neural approaches

### Mode-Adaptive Neural Networks

The 2018 paper [Mode-Adaptive Neural Networks for Quadruped Motion Control](https://hub.hku.hk/handle/10722/288761) combines a motion-prediction network with a gating network that blends expert weights for periodic and nonperiodic actions. An open [PyTorch implementation](https://github.com/ami-iit/mann-pytorch) exists, but it is a research/training stack rather than a ready three.js runtime.

No lightweight, maintained three.js cat controller based on MANN was identified. For this project it would require:

- Suitable licensed cat motion data.
- Skeleton canonicalization and retargeting.
- Training and validation.
- ONNX or custom JavaScript inference.
- Foot-contact cleanup.
- Additional model payload.
- Debugging a less art-directable controller.

Treat MANN as background research rather than the next implementation milestone.

### Motion matching

Daniel Holden's [Motion Matching repository](https://github.com/orangeduck/Motion-Matching) includes conventional and learned examples and can build browser demos with Emscripten. Browser execution is therefore possible, but a high-quality quadruped database remains necessary.

With only eleven clips, nearest-neighbor search would mostly rediscover manually defined transitions. Contact-aware phase selection plus inertialization offers most of the practical benefit at much lower cost.

## Assets and data

| Resource | Practical use | License concern |
|---|---|---|
| [Blender Rigify](https://docs.blender.org/manual/en/latest/addons/rigging/rigify/) | Study cat/quadruped joint placement and control-rig design | Bundled with Blender; GPL code |
| [Truebones ZOO](https://truebones.gumroad.com/l/skZMC) | Motion reference or possible retarget source | Product advertises royalty-free use; archive the exact license and verify redistribution rights |
| [Animal3D](https://arxiv.org/html/2308.11737v2) | Anatomical pose reference and SMAL fitting research | Noncommercial restrictions may apply |
| [SMAL](https://smal.is.tue.mpg.de/) / [SMALR](https://smalr.is.tue.mpg.de/license.html) | Shape and pose research | Research/noncommercial and redistribution constraints |
| [smal-fitter](https://github.com/OllieBoyne/smal-fitter) | Offline fitting experiments | MIT code; source assets retain separate licenses |
| [Mesh2Motion](https://gamefromscratch.com/mesh2motion-open-source-mixamo-alternative/) | Experimental quadruped rigging/animation | Verify current project and output licenses |
| Sketchfab/BlenderKit cat rigs | Control-rig and topology study | Check every asset's individual license |

Animal3D is pose-and-shape data, not a polished skeletal animation library. SMAL-family assets are useful for anatomical reference but introduce more licensing and retargeting complexity than video-based authoring.

### Retargeting method

1. Map semantic joints across both skeletons.
2. Compute source and target rest-space orientation bases.
3. Convert source motion to rest-relative rotational deltas.
4. Conjugate each delta through source-to-target axis alignment.
5. Apply the aligned delta to the target rest orientation.
6. Scale root translation by a body or hind-leg length ratio.
7. Run paw IK and spine cleanup.
8. Bake to target FK bones.
9. Correct contacts and silhouette by hand or script.
10. Export only the corrected action.

Do not copy Euler channels or local quaternions directly between rigs with different bone rolls.

## Effort estimate

| Item | Effort | Impact |
|---|---:|---:|
| Eye/morph/weight forensic audit | 0.5–1 day | Critical |
| Separate eyeballs or eye bones | 1–2 days | Critical |
| Gaze controller and eye recentering | 1–2 days | High |
| Re-author perch pose | 0.5–1.5 days | High |
| Contact metadata export | 1–2 days | High |
| Four-paw runtime locks and IK | 2–4 days | Very high |
| 45°/90° turn clips | 2–3 days | Very high |
| Curved-walk pair and blend space | 2–3 days | Very high |
| Predictive trajectory/path curves | 1–2 days | High |
| Tail and ear spring pass | 1–2 days | Medium-high |
| Inertialization | 2–4 days | High |
| Jump root-motion extraction/warping | 2–4 days | High |
| Blender curve/bake improvements | 1–3 days | High |
| GLB optimization and regression checks | 0.5–1.5 days | Medium |
| MANN or motion matching | 4–10+ weeks | Low return |

A practical focused sequence is about three working weeks:

- **Week 1:** Eyes, perch, metadata and contact solver.
- **Week 2:** Turn clips, curved walking and trajectory prediction.
- **Week 3:** Inertialization, jump root motion, secondary dynamics and optimization.

## Implementation order

1. Build deformation debug toggles and fix the eyes.
2. Re-author the perch around chest and elbow support.
3. Add Blender-exported contact metadata.
4. Implement paw locking and analytic leg IK.
5. Author and integrate 45°/90° turn clips.
6. Add curved walking and predictive trajectories.
7. Add interruptible state rules and inertialization.
8. Convert jump to authored root motion with endpoint warping.
9. Add tail and ear spring dynamics.
10. Optimize GLB animation and textures after behavioral regression tests pass.

## Common pitfalls

- Treating morph targets as local correctives without auditing every nonzero vertex delta.
- Weighting eye polygons rigidly while the socket rim follows neck or spine bones.
- Multiplying post-mixer deltas into bones that the mixer does not rewrite every frame.
- Applying corrective morphs by animation state rather than measured joint pose.
- Using long crossfades to conceal missing transition poses.
- Blending locomotion clips with mismatched contact phases.
- Running foot IK during swing.
- Locking all paws while independently forcing the root trajectory.
- Expecting paw IK to generate believable scapula and shoulder performance.
- Using absolute paw-drop distances across differently scaled poses.
- Reversing `sit` or `perch` for `stand` or `unperch`; contact order and gravity make the reverse look synthetic.
- Simulating the tail without an authored intent pose.
- Running springs with an unclamped browser `dt`.
- Assuming a 60 fps bake fixes mechanical timing or weak silhouettes.
- Allowing optimizer defaults to resample animation unexpectedly.
- Copying rotations between rigs without rest-axis compensation.
- Implementing neural locomotion before securing suitable licensed motion data.
- Deriving contacts from velocity alone when an already-sliding paw has low velocity.
- Letting pointer gaze override launch, landing or a critical planted turn step.
