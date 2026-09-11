# Arcade interface and interaction polish — 10 September 2026

Implemented locally in response to feedback about generic UI, misplaced controls, flickering TV trim, unsynchronised lighting, and slow transitions. No deployment or commit.

## Visual direction

The arcade now uses a shared signage treatment: warm paper, dark enamel surfaces, squared keys, large station numbers and a numbered directory. Project panels use a light reading surface and stronger title hierarchy. Gallery controls and project cards share the same styling. The individual project screenshots keep their own identities.

Removed the duplicated mobile read-more control in favour of the existing reading mode. Corrected primary-button and corridor contrast on light panels. The English fullscreen action now has a full-width row, so its label fits. Cabinet labels use compact symbols with text on hover/focus.

Main stylesheet: src/styles/arcade-interface.css. Original files from the beginning of this pass are saved under .source-assets/polish-baseline-2026-09-10/.

## Physical consistency

- The extra TV accent light used to track the camera's X coordinate. It is now a child of the television's hanging assembly, inheriting the carriage position and pendulum rotation.
- The rear area light now faces local -Z toward the wall. Its colour follows the same eased accent colour. Lighting intensity follows the screen state.
- The brick wall had metalness 1. It is now non-metallic, removing the inappropriate sharp metallic response.
- The thin polished TV bezel was widened and given its own rough material to reduce the angle-dependent specular stripe. These address the observed rendering risks; flicker is not claimed eliminated on every GPU, pixel ratio or viewing angle.

## Cabinet controls

The main positioning bug was in the model hierarchy. Moving button caps, joystick shaft and ball were reparented into a sibling animation group. Projection and hit testing still used the original object, so they missed those visible parts. Bounds and raycast ancestry now use the entire pivot.

A separate control-target layout enlarges targets and partitions shared space between neighbours. Joystick halves meet at the centre instead of overlapping. Both rows of six-button cabinets use previous / fullscreen / next from left to right. Controls also open the gallery from the project view.

Browser verification on Echo Frequency at 1280 x 800: joystick bounds extend from approximately y=557 to y=697, including the visible ball, shaft and base. Previously the target covered only y=641 to y=690. Both joystick directions change the counter correctly (01 → 02 → 01). No overlapping proxy rectangles. Trackball directions on Riftback also pass and have no overlapping actions.

## Response times

Configured animation durations, not benchmarked end-to-end latency:

| Interaction | Before | After |
| --- | --- | --- |
| Camera, hall | 620 ms | 300 ms |
| Camera, project/gallery | 720 ms | 280 ms |
| TV travel | 520–1400 ms | 300–680 ms |
| Menu | 200 ms plus staggered links | 120 ms, all links together |
| Panel travel | 400 ms | 160 ms |
| Regular page reveals | 600 ms plus delays | 180 ms, no delays |

Removed the artificial wait that held a ready route for camera movement, panel/thumbnail entrance staggers and obsolete all-label hover/timer handlers. Reduced-motion rules remain in place.

## Validation

- TypeScript passes.
- Six regression tests pass, including new dense-target and joystick-split tests.
- Production build passes: 26 source routes and 25 generated English routes.
- Build audit passes for 50 marketing pages, links and metadata.
- Browser checks: desktop DE/EN menus, Riftback project and trackball gallery, Echo Frequency joystick gallery, mobile 390 x 844 project panel, reading mode, gallery, and return flow. No mobile document overflow. Checked corrected primary contrast from computed styles and full-width English fullscreen label.
- Preview: http://localhost:4322/ . Development server remains on 4321.

## Limits

The production preview remained stable during this review. The development tab crashed during hot reloads; that development issue is still unresolved. Physical-phone and extended-session/GPU testing remain outstanding.

The large Three.js chunk warning remains. Reachable home JavaScript is 1208.9 KB across 20 files, including lazy scene dependencies; this is not the initial transfer size. CSS is 157.3 KB across two files. This pass improves interaction timing and consistency, not the initial 3D download budget.

Documentation consulted: https://docs.astro.build/en/guides/styling/ and https://threejs.org/docs/ .
