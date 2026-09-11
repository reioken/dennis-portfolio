# About poster implementation — 2026-09-11

Implemented the user's selected personal-poster direction using the approved portrait regenerated from the original photograph.

- Large photographic portrait and editorial name treatment, restrained iridescent section divider.
- One scrollable panel with section anchors; existing hall, machine and panel geometry retained.
- All 8 career records, 4 education records, 23 skill items, both languages and both language proficiency entries preserved. Earlier career entries are now visible without an accordion.
- Contact, LinkedIn, email and certificate links retained. Icons use the existing Nucleo Sharp collection via Icon.tsx.
- Separate compact composition below 600px panel width; reading mode supported.
- Approved source converted to 1122px / 640px WebP assets (149,256 / 55,142 bytes), no generative changes.

Validation:
- TypeScript check passed.
- All 26 existing regression tests passed.
- Production build and audit passed: 54 marketing pages, local links and metadata valid.
- Browser checks at 320×740, 390×844, 768×1024, 1440×900 and 1920×1080: complete source content in both languages, all section links, back-to-top, reading mode, no page overflow or browser errors.
- Screenshots and detailed results retained locally in .source-assets/about-poster-qa/.

The existing large-JavaScript-chunk build warning remains; this change adds no client-side component or animation dependency.
