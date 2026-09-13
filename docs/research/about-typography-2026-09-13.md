# About typography and layout — 2026-09-13

Dennis found the About text layout too quiet, especially the top, asked for a more distinctive font, his complete name in uppercase, better use of horizontal space and centered section buttons. This is a separate About pass; it does not imply acceptance of Blue Phase 21.

Application commit: `fbd99f1cae8ff3e1f9ab9aad562b9d8000f5876e`.
Deployment: `f388a7f4`, https://f388a7f4.dennis-portfolio-87g.pages.dev.

## Cause and implementation

The hero used the same rounded Outfit as the body, with a large first name but a much smaller, lighter surname. The portrait was inset by 10% on wide panels. The four equal navigation cells left-aligned their contents, producing 71.42 px of label displacement at a 1920 px viewport. The profile facts occupied rows below the short introduction.

- Locally bundled Barlow Condensed 600 for the name and section headings, existing Outfit for body copy. CSS uppercase for the complete name. The font is 22,308 bytes and Vite emits `barlow-condensed-latin-600.DepVgxBB.woff2`; no third-party font requests or new dependency.
- Wider hero copy, a larger portrait closer to the right edge on wide panels, two equal-width contact actions.
- Section labels centered independently of their small numbers. Mobile retains stacked numbers/labels.
- Above an 820 px panel width, introduction and a compact 2×2 facts grid share one row. Narrow panels retain stacked content. Mobile name and role use the available width below the face, avoiding an unnecessary surname wrap.
- Consolidated the competing compact-poster CSS rules. Outer hall/panel geometry stays as before.
- All existing copy, links, eight career entries, four education entries and 23 skill items are preserved. No new UI wording. No model, atlas or other Blue runtime changes.

Font source: [Google Fonts Barlow Condensed](https://github.com/google/fonts/tree/main/ofl/barlowcondensed), [SIL OFL license](https://raw.githubusercontent.com/google/fonts/main/ofl/barlowcondensed/OFL.txt), bundled alongside the font as `src/assets/fonts/Barlow-OFL.txt`.
Astro [component](https://docs.astro.build/en/basics/astro-components/) and [styling](https://docs.astro.build/en/guides/styling/) guides consulted.

## Verification

Evidence: `.source-assets/qa/about-type-2026-09-13/`. `before/`, `after/`, `final/` and the `probe.mjs`/`story.mjs` scripts contain actual dev-server screenshots and measurements. Final profile screenshots are `*-story-compact.png`; earlier `*-story.png` images show the superseded single-column facts iteration. Screenshots were inspected; no rendered mockups were used.

| Measurement | Before | Final |
| --- | ---: | ---: |
| Section label offset at 1920 px | up to 71.42 px left | 0 px |
| Label centering across final widths | — | within 0.008 px |
| Horizontal overflow at 320, 390, 768, 1440, 2560 px | 0 | 0 |
| Mobile hero height at 390 px | 403.98 px | 402.91 px |
| English mobile hero height at 320 px | 444.23 px | 413.94 px |
| Font bytes added | 0 | 22,308 |

Font loaded and computed uppercase were confirmed in the browser. Existing visible copy was compared before/after ignoring casing and layout whitespace. Desktop story facts have no overflowing cells. Anchor targets remain below the sticky section navigation.

`blue-turn.mjs`, `blue-cat.mjs`, `blue-companion.mjs`, typecheck, all 35 review tests, build and the 52-page audit pass. Blue QA ran from `%TEMP%/blue-about-type-qa`, then its outputs were copied into `blue-regressions/`, so no project files were written during the dev-server browser run. The extra background dev server on 4322 was stopped; the original 4321 server remains.

The prebuild scanner again downgraded sibling repositories to directory scans inside the sandbox. `src/data/werkstatt.json` was restored, the application was committed, and that exact application was rebuilt with `npx astro build` and audited again before upload.

## Live verification

Both live hosts verified in Chromium and Firefox: five routes return 200 with WASM CSP; all three v6d files, the new font and About CSS match dist SHA-256; desktop DE and mobile EN render with loaded Barlow, all four section links work, no page/console errors or failed requests. Screenshots inspected.

| Host | Chromium | Firefox |
| --- | --- | --- |
| f388a7f4.dennis-portfolio-87g.pages.dev | Pass | Pass |
| www.dennisbf.design | Pass | Pass |

The first Firefox probe incorrectly required a new Resource Timing entry for the font on the second page. Firefox reused the loaded font across navigation without adding that entry. The retained screenshots already showed Barlow correctly. The corrected probe checks the actual loaded FontFace as well as computed family, uppercase, network failures and the font file's SHA; the final Firefox report records fontRequested=false with fontFaces.status=loaded on mobile. This was a probe correction, not an application fix or second upload.

Firefox retains the previously recorded WebGL capability/extension/upload warnings and Outfit preload warning; they are included in the JSON reports. No new page or console errors. The earlier production home-to-About soft-navigation hall issue remains open and was not claimed fixed by this typography pass.

Live evidence and the final script: .source-assets/qa/about-type-2026-09-13/live/ and live.mjs. The script writes to %TEMP%/blue-about-type-qa/live and its completed reports were copied back after execution. Dennis judged this initial pass in the consistency follow-up below.

## Consistency follow-up — 2026-09-13

Current application: `107f117`; deployment `a1c29b93`, https://a1c29b93.dennis-portfolio-87g.pages.dev. This supersedes the initial pass above, which Dennis judged: numbers must sit beside labels, DENNIS must visually align left, the introductory sentence felt too large, the work icon was far right, and education/skills had no icons.

The dev probes in `.source-assets/qa/about-consistency-2026-09-13/` measured the actual font ink bounds with Canvas TextMetrics alongside DOM geometry. The first D's side bearing put visible ink 8 px right of body text at 1920 px; `translateX(-.045em)` on the first-name span corrects it across font sizes. The heading's auto margin pushed the work icon 564 px away. Number positioning was absolute and therefore excluded from centering.

Numbers and labels now share a centered flex row with an 8 px gap (6 px compact). Below a 360 px panel width the four links occupy a 2×2 grid and scroll-padding increases to accommodate its 88 px height. The introductory paragraph shares the body's 16 px size and 1.65 line height, with normal tracking and weight 400; the profile lead is 18 px and the desktop role 14 px. The four section headings use the existing about, work, education and pen-nib icons, each 24 px, directly after the heading with the normal row gap. Icons remain decorative and hidden from assistive technology. No UI wording or Blue asset/runtime changes.

| Measurement | Before | After |
| --- | ---: | ---: |
| Number-to-label gap, 1920 px | 75–94 px | 8 px |
| First-name ink vs body left edge, 1920 px | 8 px | 0.55 px |
| Intro type, 1920 px | 26.11 px | 16 px |
| Intro/body line height | different | both 26.4 px |
| Work icon gap, 1440 px | 564.09 px | 14 px |
| Heading icons | 1 of 4 | 4 of 4 |

All four anchors, centered number-label groups, same-row alignment and absence of overflow were checked at 1920, 1440, 390 and 320 px (English on compact views). After adding icons, all four headings and anchors were checked again at 1440 and 320 px; every captured heading view was inspected. Three Blue regressions ran from `%TEMP%/blue-about-consistency-qa` and passed; typecheck, all 35 review tests, build and 52-page audit passed. The prebuild scanner's sibling-repository downgrade was restored again, and the committed application was rebuilt/audited before upload.

Both live hosts passed in Chromium and Firefox. On each host, `/`, `/about/`, `/en/about/`, `/work/` and `/en/` return 200 and carry the CSP `wasm-unsafe-eval` directive. All three Blue v6d files, Barlow font and About CSS match the built dist SHA-256. Headless home and direct About loads complete with no page/console errors or failed requests. Desktop German (1440 px) and mobile English (320 px) confirm loaded Barlow, uppercase name, 16 px intro, centered number-label groups, four adjacent 24 px icons and all four working section anchors without overflow. Live screenshots were inspected.

| Host | Chromium | Firefox |
| --- | --- | --- |
| a1c29b93.dennis-portfolio-87g.pages.dev | Pass | Pass |
| www.dennisbf.design | Pass | Pass |

Firefox retains the previously recorded capability-probe context-loss, shader-extension, texture-upload and Outfit-preload warnings. Reports preserve these warnings; no new errors occurred. The earlier production home-to-About soft-navigation hall issue remains separate and is not claimed fixed or fully reverified here.

Evidence: `.source-assets/qa/about-consistency-2026-09-13/live/` and `live.mjs`. Completed reports/screenshots were copied from `%TEMP%/blue-about-consistency-qa/live` after browser execution. This follow-up and Blue Phase 21 still await Dennis's visual verdict.
