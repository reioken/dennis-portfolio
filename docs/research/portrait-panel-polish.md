# Portrait cutout and panel navigation — 2026-09-12

## Changes
- Used the approved `portrait-poster-1122.webp` as the source for a local BiRefNet portrait mask. Original RGB pixels are preserved in the working PNG; only alpha changes. The website uses optimized 1122px and 640px WebP derivatives with real transparency.
- Moved the portrait inward, separated the lavender/warm/blue background atmosphere from the photograph, and softened only the cropped shirt boundaries at the frame edges.
- Removed the reading-mode component, its CSS and event guards across About, projects and Contact.
- Removed the duplicate hall return link in the header. A shared PanelBack component now provides a 44px Nucleo arrow button beside the panel; on mobile it stays above the content sheet. Existing Escape navigation is retained.

## Image provenance
Two built-in image editing attempts returned opaque RGB checkerboards; neither is used in the website. The user explicitly approved local background removal. Final assets are produced by `scripts/cutout-approved-portrait.py` using the already cached `birefnet-portrait` model. The original image, face, tattoos and clothing are not regenerated.

Built-in edit prompt intent (rejected output): remove only the studio background, preserve the exact person, return an alpha-transparent PNG with fine hair, no halo or painted checkerboard. Final processing instead uses local segmentation and thresholding of tiny alpha noise; it has no generative prompt.

## Checks
- `scripts/qa/portrait-navigation.mjs`: 1440x900, 3789x1896, 390x844; no overflow, no page or console errors; correct portrait asset; return button visible, at least 44x44px, unobstructed and beside the panel on desktop.
- About -> hall -> Nexus -> hall -> Contact -> Escape verified. The About return preserves the same Hall instance.
- All four About content sections remain present. Desktop and mobile screenshots visually checked; cropped shoulder edges received a final feathering adjustment.
- TypeScript, 27 regression tests, production build and 54-page link/metadata audit pass.

## Loading cube diagnosis
The open live About tab still referenced `/media/ui/loading-prism-loop.webp`. The local site references the corrected `loading-prism-v2-loop.webp` from commit 9b9b071. No second animation rewrite was made on top of an unpublished fix.
- Current 288-frame sequence: every frame changes; minimum average channel delta 2.32, median 3.46, maximum 6.50, loop boundary 3.74.
- Repeated a 14.4s main-thread block: 558 screencast frames, 192 distinct cube samples, largest sampled unchanged interval 114ms. Screencast delivery is not a full frame-presentation trace.
- Publication was previously blocked by automatic approval review. These checks concern the local build, not a newly deployed live release.
