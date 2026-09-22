# Handover to Claude — Blue motion, 2026-09-20

## Dennis's latest verdict overrides everything below

**“No clue what you did, dont see a difference. document and handoff prompt for claude NOW.”**
He has NOT approved the visual result. Work stopped at that request. Do not describe the motion as fixed or approved because automated checks pass. Do not continue this implementation blindly.

Original four complaints: rigid turns; unnatural lying down; weird speed when jumping up; claw-machine paw placement should use only the front paws. Preserve his selected original v6 cat mesh and coat. No model replacement, redesign, unrelated site edits, commit, or production deployment was authorized for this polish.

## Exact state

- Branch `feat/werkstatt`; HEAD `abb363a` (documentation). Production application remains `889babc`, deployment `434a754d`; production was untouched.
- All changes below are **uncommitted**.
- Last successful preview: **https://18aa4be2.dennis-portfolio-87g.pages.dev**, alias **https://probe-coldstart.dennis-portfolio-87g.pages.dev**. This contains v6g and the initial motion changes, but **does not contain the subsequent resize-while-perched fix**.
- The first preview-upload attempt was rejected by automatic approval review. Dennis then explicitly answered “Yes, publish the preview,” and that upload succeeded. No later upload occurred. The latest instruction now stops further work.
- `dist` is the build uploaded as `18aa4be2`. It predates the last resize fix. No rebuild/deploy after that fix.

## What was changed, and why (not visual acceptance)

`src/components/hall/blueCat.ts`:

- Asset build `v6f` → `v6g`.
- Turns choose authored 15/30/45/60/90/120-degree clips, without scaling only the body yaw against unchanged foot trajectories. `TURN_MIN=.14`, shared by toy turns to avoid opposing 15-degree loops. Final root sample now applies before a turn finishes.
- Small residual jump-heading correction eases at .5 rad/s instead of snapping at jump start.
- Perch origin uses measured current claw cap edge `.409942` minus scaled forewrist reach `.262`. Body world z is `.147942` desktop / `.213442` compact; hind paws stay behind the chest on the roof.
- **Last local change:** when scale changes while mood is `perch`/`perchidle`, reset body/goal/elevation to `ledgeSpot()`. Hosted resize had visibly moved the perched cat down beside the cabinet. The targeted local desktop→phone→desktop contact regression printed success immediately before cancellation, but this fix has **not** had a fresh typecheck/build/hosted visual check and is **not deployed**. Broader resize-during-jump behavior was not addressed.

`scripts/models/blender/blue_animate.py`:

- Added cubic Hermite ascent segments matching velocity at the hook; removed the late horizontal speed burst. The old forward join jumped to approximately 5.19 m/s; a new packed-asset regression bounds the pull-up under 1.6 m/s.
- Added 15/30/60/120-degree turn variants on both sides; slightly longer step schedule. Existing 45/90 remain.
- Settling lowers haunches first, folds forelegs at different times under shoulders, then curls; supporting-side paw tucks later. Final sleep pose, original rig limitations and mesh design remain.

New public assets: `public/models/blue-rigged-v6g.glb` (1,426,128 bytes, +136,228 over v6f; 37 clips instead of 29), `blue-v6g-closed.webp`, `blue-v6g-mips.webp`. Companion images match v6f byte-for-byte. Old v6f files remain for rollback. Rebuilt ignored source outputs are in `.source-assets/blue/v3/blue-animated-v6.blend`, `blue-rigged-v6.glb`, `blue-rigged-v6-atlas.glb`; atlas inspector outputs under `.source-assets/blue/v6/`. No Meshy or image generation used.

QA files modified: `scripts/qa/blue-asset.test.mjs`, `blue-cat.mjs`, `blue-companion.mjs`, `blue-turn.mjs`, `hero/live-assets.mjs`. Changes cover clip/version lists, new jump-speed assertion, new roof origin, output outside the repo, and old mobile probe assumptions after the already-shipped focused cabinet framing. The mobile cat probe explicitly focuses its isolated camera on Blue; that is not a site camera change.

New QA tools: `scripts/qa/blue-motion.mjs` (deterministic strips and paw coordinates; `QA_BASE_URL`, `QA_OUT`, optional `QA_SCENARIOS=perch`); `scripts/qa/live/blue-motion.mjs BASE OUT` (actual About navigation, timed hosted frames, phone resize).

Unrelated pre-existing untracked files preserved: `.claude/settings.local.json`, `cat-animation.md`, `exports/screenshots-2026-09-16/`, `public/models/mach-riftback-v3.glb`, `public/textures/floor/concrete-v1_*`. `src/data` was unchanged. Do not delete or sweep these into a commit.

## Actual validation and evidence

Before the last resize change: typecheck, **40 review tests**, direct `npx astro build`, and **55-page audit** pass. Required `blue-turn`, `blue-cat`, `blue-companion` pass on local dev (cat/companion include desktop, compact and reduced motion). The 180-degree regression ends at exactly 180 degrees via 120+60, max turn yaw rate 4 rad/s. New contact checks put both forewrists within 15 mm of the cap edge and both hind paws behind it, above roof height. No new full Firefox/play/coat regression was run this round.

Hosted `18aa4be2`: zero console/page/network errors in the focused navigation capture; 71 static asset URLs match local public bytes, zero bad, five dynamic templates skipped. **Visual hosted resize found the real bug described above despite those checks.**

Evidence root: `C:/Users/denni/AppData/Local/Temp/`:

- `blue-motion-before/`: initial turn/settle/jump/perch strips. Initial turn probes incorrectly continued toward a common 90-degree destination; use them only for the initial phrase. Final probe goals were corrected.
- `blue-motion-after/`: first rebuilt comparison strips.
- `blue-motion-final/`: inspected final `turn20.png`, `turn60.png`, `turn120.png`, `settle.png`, `jump.png`, `perch.png`, corrected `perchcompact.png`; most strips have 16 frames. `report.json` was overwritten by an isolated compact run; subsequent filtered runs now use separate report names. `report-perch.json` is the last local resize-contact test.
- `blue-turn-after/`, `blue-cat-after/`, `blue-companion-after/`: passing regression outputs; actual phone About capture is `blue-companion-after/companion-phone-perch-full.png`.
- `blue-motion-preview/`: hosted `about-motion-0.png`, `about-motion-1.png`, `about-final.png`, `phone-perch.png`, `report.json`. **`phone-perch.png` shows the resize bug in the deployed preview; it is not a passing visual result.**

No playable video was produced. Strips are movement evidence, not proof of naturalness. Some jump framing hides the initial floor preparation; the original rig still limits deformation. Dennis sees no improvement: that is the controlling verdict.

## Processes and next working method

- Dev server started with `astro dev --background`, reported `http://localhost:4322`, PID `119796`; stop with `npx astro dev stop`, inspect with `npx astro dev status` / `logs`.
- Existing production preview reported `http://127.0.0.1:4322`, PID `86800`; stop with `npx astro preview stop`, inspect with `npx astro preview status`. Localhost and 127.0.0.1 have been serving dev/preview separately; verify which before a test. Dev exposes `window.__hall`; production does not.
- Last tool session `40296` ran only the targeted local perch resize regression; it printed successful completion immediately before cancellation. No build, upload, Blender or GPU capture was intentionally left running. Check status before launching more GPU work; do not kill unrelated owner processes.

Claude: first read this and the required current handovers. Compare **production v6f with preview v6g at Dennis's normal viewing distance and actual speed**, reproduce each complaint, and establish why his eyes see no improvement before any further edit. Review the uncommitted diff and the undispatched resize fix. Prefer a short normal-speed comparison the user can judge. Do not substitute passing numbers or close-up stills for his verdict. Keep one GPU job at a time and outputs outside the repo. Never run `npm run build`, `npm run check` or `npm run deploy` (scanner/contact Worker traps); use direct Astro build with telemetry disabled when work is authorized again.
