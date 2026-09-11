# Poster portrait and complete About content

User direction: 11 September 2026. The personal poster is preferred. The new real photograph is the authoritative likeness reference. All existing About information remains relevant and must be preserved.

## Generated portrait
- File: portrait-poster-v1.png
- Built-in image_gen, identity-preserving reference generation.
- Reference: user-provided 20260911_223412.jpg.
- Dark crew-neck shirt, charcoal background, head-and-shoulders composition, restrained cool edge light.
- Intended for the right side of the poster hero; the generated portrait is saved as an asset proposal. Production UI is not changed by this research artifact.

## Complete content structure
The poster is the opening section, not the whole About page. Continue in the same panel with one vertical scroll surface. Show the start of the following content at the initial viewport, with a compact section navigation: Über mich / Erfahrung / Ausbildung / Skills. These links scroll to content already present; they do not load new screens.

1. Poster: large name and portrait, current role, brief positioning, availability, Kontakt and LinkedIn.
2. Personal introduction: preserve the existing lead and body meaning, current employment, independent work, professional focus and relevant project references.
3. Berufserfahrung: preserve every existing timeline record with dates, roles, employers and descriptions. Present an editorial chronology, current role emphasized; do not hide earlier experience by default.
4. Ausbildung & Zertifikate: preserve every existing education entry, descriptions, dates and existing certificate links.
5. Skills: preserve all existing skill groups and individual entries, with clearer typography and grouping rather than a dense badge wall.
6. Practical information: preserve location, languages and proficiency, readable email, contact and LinkedIn.

Source of truth remains src/lib/site.ts and src/lib/i18n.ts, with current rendering in src/components/work/AboutOverlay.astro. Preserve German and English content. Do not invent achievements, employers, credentials, dates or statistics. At implementation, compare every existing timeline, education, language and skill entry against the result.

## Layout intent
Desktop: strong poster above an open editorial layout. Use restrained section numerals, typographic hierarchy and thin iridescent dividers; chronology dates in a narrow left column, substantive descriptions beside them. The portrait has its own readable image area; text must not cover eyes or mouth. Keep the current claw-machine context.
Mobile: smaller poster height and deliberate crop so role, contact and the beginning of further information remain discoverable. Stack chronology dates with descriptions. No horizontal scrolling and no mandatory accordions for the CV.
Motion must not delay access to content, change panel size or replay loading.

## Generation prompt
See portrait-poster-v1.prompt.txt.


Latest portrait: portrait-poster-v2.png — user-requested slightly stronger moustache; generation edit prompt retained alongside the image.
