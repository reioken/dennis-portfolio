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
