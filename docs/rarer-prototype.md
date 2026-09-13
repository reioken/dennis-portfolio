# Rarer prototype

Standalone browser game at https://www.dennisbf.design/rarer/.

Runtime files, the sourced answer catalog, self-hosted fonts and their licenses, and the manifest-selected sprites are in public/rarer. No backend or API keys are used. Progress stays in the player's browser.

Source project: ../idle/prototype. Run node ../idle/.rarer-tools/export-website.mjs from this repository to stage a new runtime-only export in ../idle/.rarer-tools/website-export, then review and copy that export into public/rarer. The exporter rewrites asset paths, self-hosts Google Fonts, labels the page as a prototype, and disables development controls. Do not copy the entire source project or its private generation scripts.

Validation: npm run check, followed by browser verification on the deployed page. Rarer is a standalone English page and intentionally has no /en/ copy. The normal CSP build includes its theme script hash. /rarer/* revalidates so prototype updates arrive together.

The initial answer snapshot contains nine categories, with three per UTC day; sets repeat after three days. Data provenance and scoring details are retained at public/rarer/data/README.md.
