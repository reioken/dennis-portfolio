# Afterimage design mockups

Local design study, kept separate from the Astro application. No source UI or production build was changed by this mockup work.

Open http://localhost:4323/ . The server is already running locally.

## Included

- A: Afterimage / architectural typography, with real depth occlusion behind the cabinet.
- B: Contact-sheet alternative, with a dominant screenshot and overlapping cabinet.
- Hall, project overview and gallery compositions.
- Desktop and 390 × 844 mobile layouts (mobile frame displayed at 78% in the review board).
- Echo Frequency and Riftback, using existing GLB models, screenshots, project names, branding and local Outfit font.
- Project index, project switching, gallery stepping, expanded image view, back navigation, keyboard navigation and basic dialogs.

The review toolbar is outside the proposed product. Use it to change direction, view or device. State is encoded in the URL for sharing local views.

## Scope

These are interactive visual mockups, not a production implementation. Camera movement demonstrates the relationship between views; the final screen-origin transition is not implemented as a complete shared-element morph. The gallery prioritises flat, readable images. Fullscreen expands the image within the mockup frame. Only two representative projects and four images per project are included. Real gameplay and production form submission are outside this study.

The room treatment is proposed. The cabinet models and project images are existing assets. No screenshots or project results were generated or invented.

## Validation

JavaScript syntax checked with `node --check`. Browser-reviewed desktop hall/project/gallery, the contact-sheet alternative, mobile hall/project, project chooser, project-to-gallery flow, screenshot stepping and expanded image view. The screenshot counter advanced to 02 / 04 and the corresponding real image loaded. Replaced an overlapping desktop facts/cabinet layout during review. Corrected the initially flattened wall typography, logo contrast and per-project TV/adjacent preview content.

## Restart

From the portfolio workspace:

```powershell
node design-mockups/server.mjs
```

This small read-only server listens on 127.0.0.1:4323. It serves this folder, public assets and installed vendor modules. No upload, edit or deployment endpoints exist. The existing dev and production-preview servers are unaffected.
