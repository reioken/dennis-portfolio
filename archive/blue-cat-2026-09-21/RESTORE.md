# Blue the hall cat — archived 2026-09-21

Dennis asked for the cat and everything cat-related to be taken off the site and kept for later. Nothing was
deleted without a copy here first; every `.glb`/`.webp` in this folder was SHA-256 checked against the original
before the original was removed.

This folder is outside `src/` and `public/`, so Astro does not build or ship it, and `tsconfig.json` now has
`"exclude": ["dist", "archive"]` so `tsc` ignores it.

## What is in here

| path | what it is |
| --- | --- |
| `src/components/hall/blueCat.ts` | the runtime: roaming, moods, petting, perching, toys, the post-mixer pose pipeline. **Working-tree state, i.e. the unfinished v6h rework** |
| `src/components/hall/blueToys.ts` | ball and mouse physics, grab/throw, the DOM toy buttons |
| `public/models/blue-rigged-v6f.glb` (1,289,900 B) | the **shipped** cat, the one live at deployment `434a754d` |
| `public/models/blue-v6f-{closed,mips}.webp` | his eye + coat textures for v6f |
| `public/models/blue-rigged-v6h.glb` (1,497,556 B) | the **unfinished rework**, never shipped, never judged |
| `public/models/blue-v6h-{closed,mips}.webp` | its textures |
| `public/models/blue-toy-{ball,mouse}-v1.glb` | the two Meshy toys |
| `scripts/models/blender/blue_*.py` | rig, animation authoring, pose checks, morph forensics, v4 experiments |
| `scripts/models/blue-*.mjs`, `blue-v4-generate.py` | the packer and the texture/atlas/pupil generators |
| `scripts/qa/blue-*.mjs`, `scripts/qa/live/blue-*.mjs` | every Blue regression, including `blue-asset.test.mjs` (it was part of `npm run test:review`) |
| `docs/research/blue-*.md`, `cat-animation.md`, `HANDOVER-CLAUDE-BLUE-2026-09-20.md`, `HANDOVER-NEXT-AGENT.md` | copies of the written record — **the originals were left in place**, they are history, not site code |
| `uncommitted-blue-rework.patch` | `git diff` of the v6h work that was never committed (`blueCat.ts`, `blue_animate.py`, four QA scripts) |
| `remove-blue-hooks.patch` | the diff of the non-Blue files that were changed to unhook him |
| `hallScene.with-blue.HEAD.ts` | `hallScene.ts` exactly as commit `abb363a` has it, with every Blue hook still in |

## Where the shipped state lives

- Shipped cat: **v6f**, in git history at commit `889babc` (production deployment `434a754d`).
- Current branch tip when this archive was made: **`abb363a`** on `feat/werkstatt`. Nothing was committed for this
  removal — it is all working-tree changes.
- Blender masters, photos, Meshy references and QA evidence are in **`.source-assets/blue/`**. That folder is
  git-ignored and was **left in place**; it is not duplicated here.

## Putting him back

1. Copy `src/components/hall/blueCat.ts` and `blueToys.ts` back to `src/components/hall/`.
2. Copy `public/models/blue-*` back to `public/models/`.
3. Copy the `scripts/` files back to their paths.
4. Re-apply the hooks. `remove-blue-hooks.patch` reversed (`git apply -R`) is the recipe for `hall.css`,
   `scripts/modulepreload.mjs`, `scripts/models/pack-models.mjs`, `scripts/models/shrink-textures.mjs`,
   `scripts/qa/hero/live-assets.mjs` and `scripts/qa/hero/verify-hashes.mjs`.
   **`hallScene.ts` will not reverse cleanly**: its diff in that patch also carries the new painted wall game.
   Use `hallScene.with-blue.HEAD.ts` as the reference and re-add these by hand:
   - `import { BlueCat, BLUE_ASSET_BUILD } from './blueCat';` and `import { BLUE_TOY_BUILD } from './blueToys';`
   - the `private blue?: BlueCat;` field
   - the `gltf.load('/models/blue-rigged-…')` block in the constructor (with `track(initial)` so he is part of the
     startup gate) and the two toy loads inside `blue.ready.then(...)`
   - the pointer block: `bluePointer` / `blueStrokeAt` / `blueStrokeX` / `blueStrokeY` / `blueClickUntil`,
     `blueAt()`, `onBlueButtonDown`, `onBluePointerDown`, `onBluePointerUp`, their four `addEventListener` /
     `removeEventListener` lines, the petting branch at the top of `onPointerMove`, and `onPointerLeave`
   - the `blue?.hit` / `blue?.look` branch at the top of `updateCursor()` and the one at the top of `onClick()`
     (plus the `blueClickUntil` guard on the first line of `onClick`)
   - `this.blue?.update(...)` in `tick()` and `this.blue?.dispose()` in `releaseResources()`
   - note: the wall game's `onWallGamePointerDown` must keep skipping a pointer that Blue already took
     (`this.bluePointer === e.pointerId`) — that guard was removed with him.
5. `uncommitted-blue-rework.patch` re-applies the unfinished v6h work on top of the `889babc` versions of those
   six files, if that is where you want to carry on.
6. Re-add `blue-asset.test.mjs` and re-run the Blue regressions; they need the dev server.

## Left behind on purpose

- The small black cat **plush inside the claw machine's prize pile** is a prize, part of the claw machine, and was
  not touched. It is Dennis's call whether that goes too.
- All written history: `docs/research/blue-*.md`, the handovers, `cat-animation.md`.
- `.source-assets/blue/` — the Blender masters and every piece of QA evidence.
