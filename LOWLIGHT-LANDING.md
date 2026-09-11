# Lowlight landing page

A standalone, responsive download page for https://www.dennisbf.design/lowlight/.

## Portfolio integration

The portfolio page lives in `C:/Users/denni/Projects/dennis-portfolio/src/pages/lowlight.astro`; its assets, stylesheet, script and installer live in `public/lowlight/`. Astro builds the explicit route at `/lowlight/`. It has its own styling and does not load the portfolio's 3D scene.

The Lowlight entry in `src/content/work/lowlight.mdx` has `landingUrl: "/lowlight/"`. The optional content field is rendered as **Website & Download** in both project views, using a normal full-page link. All pre-existing redesign edits were preserved; no commit or deployment was made.

`landing/` in the player project is the standalone source copy. After editing it, run `python scripts/sync-landing.py`. The sync refreshes the owned Astro page and assets without editing the surrounding portfolio.

## Download

The buttons use `downloads/Lowlight-Setup.exe`, a real copy of the existing 0.3.2 installer. Its size is 9,679,755 bytes; SHA-256:

    A1615DAA24F6B524DCEF7A467600BB700698C5641820C043733A5331804FD30D

When publishing a new app version, replace that file in both copies and update the visible version and size in `index.html`. No GitHub private-repository URL or placeholder is used. Provider setup requirements and the unsigned build status are explained on the page.

## Assets and behavior

Existing real-song app captures are optimized to WebP by `scripts/build-landing-assets.mjs`. The three featured records are Reborn, Starboy and Bloodhail. Source artwork provenance is recorded in `design/marketing/artwork/real-releases.json`.

There are no runtime dependencies, external fonts, analytics, cookies, or external API calls. The lightweight record switcher supports pointer and keyboard navigation; the FAQ and download work without JavaScript. Reduced-motion preferences are respected. Glass blur is illustrated behind the transparent app capture.

## Verification

- Responsive browser checks: 1440, 1024, 768, 390 and 320px; no horizontal overflow.
- Record switching, arrow/Home keyboard controls and all FAQ disclosures.
- Actual download at every tested width, with SHA-256 matching the installer.
- No browser exceptions or failed local requests, under a restrictive script policy.
- Portfolio TypeScript check passed.
- Portfolio production build passed into an isolated output folder; generated project links, static page files and installer were verified. Existing chunk-size warnings are unrelated to this page.
- Desktop and mobile screenshots were visually inspected.
- Portfolio preview integration passed: project action, explicit /lowlight/ route, script and exact installer download. The background Astro preview was restarted on its original localhost:4321 port to refresh the content schema.

Preview from the player project:

    node scripts/preview-landing.mjs

Open http://127.0.0.1:4178/lowlight/. Run `node scripts/verify-landing.mjs` for the standalone browser checks.
