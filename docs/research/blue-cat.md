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

### Verification

- Blender: pose renders and stretch report for all clips (`blue_check.py`).
- Chromium 1440×900 (Playwright, `scratchpad` evidence scripts): head direction follows the pointer left/right, hover perks ears with a pointer cursor, petting closes the eyes and keeps the route, walk peaks at 0.21 m/s with acceleration under 0.36 m/s² over 300 frames at 60 fps, settle → sleep → wake cycle, no console errors.
- `scripts/qa/blue-cat.mjs` passes at 1440×900, 390×844 and reduced motion; `npm run test:review` 27/27; typecheck.
- Not covered: native Firefox rerun, physical devices, Safari.
