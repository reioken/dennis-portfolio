# Mobile arcade exhibition — September 27, 2026

Dennis chose the left of two concept studies: a native vertical exhibition of the
existing machines, with project context. On September 27 Dennis authorized the
production release: “Ja mach auf live seite.” Release verification is recorded below.

## Experience

Below 900 px the homepage starts with Riftback and lists the eleven machine projects
in their existing order. Each has its existing title, role, summary, a real cabinet
render and a project link. The claw/About exhibit follows the projects; Contact,
all projects and legal links finish the page. The four content-only projects remain
in the complete Projects index. Desktop retains the live hall.

Machine images are rendered from the actual HallScene models, materials, wall,
lighting and floor, with a three-quarter camera. They are static WebPs until tapped.
Entry now opens a full-screen dialog with just the selected cabinet.
The real HallScene camera turns from the three-quarter view and moves toward its
monitor over 720 ms. Screenshots remain on that monitor, with the same crisp image
projection used by the desktop closeup once the camera settles. This replaces the
initial CSS image zoom, which Dennis rejected as an unsatisfying click interaction.

Swipe, the projected cabinet controls and the bottom arrows browse the original
case gallery. Surface groups, enlarged images and a project-details link remain
available. Back reverses the camera move and restores the list without scrolling.
Reduced motion skips the camera tween. Failed WebGL/model loading falls back to
the screenshot viewer; closing during loading cancels the viewer. The desktop hall
uses its existing timing and presentation.

Dennis found click-to-entry loading too slow. After a 450 ms pause in browsing,
the cabinet at the viewport centre now prepares in a hidden, full-viewport stage.
Only one cabinet is retained; its render loop is parked. Entry moves that prepared
stage into the dialog, and closing parks it for reuse. Scrolling to another cabinet
releases the old one. Route changes, desktop resizing and page exit release it too.
Data-saver and 2G connections skip speculative preparation. Immediate taps still
prepare on demand. The artificial 180 ms pre-animation pause was removed.
Shader preparation now protects submitted compile batches during cancellation,
including the yields between batches, before disposing their GPU resources.

Mobile gallery polish: the selected surface and screenshot are remembered per
cabinet for this page session. Enlarged screenshots have their own counter and
previous/next controls, and support swiping. Single-finger horizontal gestures
ignore button/select interaction and suppress the synthetic tap after a swipe;
multi-touch remains available for native zoom. Selected screenshots decode before
replacing the prior image, with a 140 ms fade (omitted for reduced motion), and
only the next shot is prefetched. The loading label waits 450 ms to avoid flashing
on prepared entry. Controls respect safe areas and have subtle press feedback;
hardware hit targets stay visually transparent. mobile-camera.mjs now checks
enlarged navigation, swipe and retained surface/image state as well as the camera.

Dennis clarified that polish also means visual proportions. The exhibition now
uses a shared 20–32 px responsive gutter, 28 px section spacing, 32–44 px titles,
12 px role text and 14 px descriptions with a 1.65 line height. Project buttons
span the text column, and section rules align with that column. The gallery has
a centered 18 px title and 44 px back button. Its controls share a compact row
inside an inset panel (12 px edge gap, 14 px padding, 44 px touch controls), instead
of the previous stacked full-width selector. Landscape uses a single horizontal
panel. The camera derives its available space from the panel's actual bounds.
Screenshots and navigation checked at 320/390/768/844 px; gallery captures inspected
for landscape, narrow portrait, and both landscape/portrait cabinet monitors.

Entry continuity: Dennis noticed a different frame flashing before the camera
move. The dialog had recentered a static poster with object-fit:contain, then
faded to a separately framed overview. The prepared cabinet now renders once in
the list at the poster's original camera (39°, position −1.25/1.45/3.8 relative to
the station). Its loop stays stopped. Entry reparents that same canvas, matches
the original on-page projection using a temporary view offset and adjusted field
of view, draws it before reveal, then interpolates to the monitor. The list fades
behind the expanding view; there is no intermediate fullscreen poster. Cold entry
keeps the list visible until the matching first frame is ready. Closing parks the
canvas back in the exhibit. mobile-handoff.mjs checks projected reference points
before/after reparenting on first open, reopen and after scrolling (under 0.5 px
tolerance), captures intermediate frames, and verifies the list render loop stops.

Local built-preview timings from mobile-entry-timing.mjs (390×844, Chromium; one
before/after probe, not a physical-phone benchmark): after 6 s reading time,
entry began at 615 → 42 ms; reopening at 495 → 36 ms. Immediate first entry was
1753 → 1584 ms. The 720 ms camera animation follows those preparation times.

MobileArcade.astro is server-rendered and works without JS. The first poster is
eager; responsive 390/780 px images are lazy-loaded for following exhibits.
Hall.tsx, HallGuard and the session handler defer the 3D stage on phone home as
they do for phone case studies. Resizing to desktop or opening About/Contact can
boot it. A previously running hall stops while hidden. Build-time module and
model preloads share the 900 px condition. Back to hall, browser history and home
language switching restore exhibit-relative scroll position.

## Regenerating the posters

Run the dev server, then:

```powershell
node scripts/assets/render-mobile-arcade.mjs "$env:TEMP/portfolio-mobile-arcade-renders" http://localhost:4321
Copy-Item -Path "$env:TEMP/portfolio-mobile-arcade-renders/*.webp" -Destination public/media/mobile-arcade
```

Capture output stays outside the watched tree. The tool uses the dev-only
window.__hall, waits for all actual models, and uses one browser/GPU context.
Re-render when machines or source screen captures change.

## Validation

- TypeScript, 31 review tests, Astro build and 57-page audit passed.
- mobile-exhibition.mjs passed at 320, 390, 768 and 844 px, with no horizontal
  overflow or console/page errors. Mobile home requests no Stage3D hall; background
  preparation requests only the cabinet currently being viewed.
- Project/back, browser back/forward, DE/EN and localized links, project index,
  desktop resizing, About/return and no-JS project links passed.
- Phone screenshots at 320/390 px and desktop hall inspected.
- mobile-camera.mjs verifies actual camera coordinates, Riftback/Lowlight/Snapsize
  monitor galleries, cabinet buttons, swipe, surface groups, enlarge, close and
  scroll preservation. It also covers 320 px reduced motion, 844 px landscape,
  interrupted loading and failed-model fallback. No page errors; model requests
  contain only the selected cabinets. Captures inspected after sharpening.
- Browser-emulated checks; no physical-phone performance claim.

Local screenshots/results: %TEMP%/portfolio-mobile-exhibition-qa.
Camera screenshots/results: %TEMP%/portfolio-mobile-camera-qa.
Use scripts/qa/hero/mobile-exhibition.mjs OUT BASE for this design. The older
mobile-hall.mjs still describes the previous horizontal mobile homepage.

Production publication authorized September 27; deployment verification pending.
