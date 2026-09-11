# Loading cube and portrait polish — 2026-09-11

## Changes
- Replaced the offline CSS-plane loader with a deterministic render of six beveled, closed metallic panels and a dark inner core. Continuous rotation keeps the edge-on views readable; no runtime 3D renderer is added to the loader.
- Exported 288 frames at 60 fps with an exact 4.8-second loop. Versioned both animated and reduced-motion assets to bypass stale immutable caches.
- Masked the portrait itself on all four edges, removed the rectangular gradient overlay, and introduced a softly blurred copy of the approved portrait with restrained lavender, blue and warm color accents.

## Verification
- Every decoded frame changes. Consecutive average channel differences: minimum 2.32, median 3.46, maximum 6.50; loop boundary 3.74. The QA script now rejects frozen frames, abrupt face popping, and loop jumps.
- During a 14.4-second main-thread busy loop, Chromium delivered 559 captured frames with 192 distinct cube images. Maximum captured unchanged interval was 108 ms (screencast sampling may skip refreshes).
- Normal and reduced-motion variants select the correct image and are hidden within 400 ms of room ignition (normal CSS fade: 320 ms).
- About verified at 3789×1896, 2560×1440, 1440×900, 390×844, and 320×740: no horizontal overflow or page errors; all career, education, skills and language content retained in German and English; anchors and reading mode pass.
- TypeScript and all 26 regression tests pass. Production build succeeds (existing large-chunk advisory remains).
