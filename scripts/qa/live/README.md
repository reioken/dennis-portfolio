# Live probes

Headless Chromium (GPU: `--use-angle=d3d11`) against a real origin: live, a Pages deployment URL or `astro preview`
(port 4322). They read only; nothing is submitted. Production-only defects never show on the dev server, so
run these against the preview or live. Output directories are arguments; keep them outside the project
(a write inside the project reloads a dev server under test).

| Script | Usage | What it answers |
| --- | --- | --- |
| `crawl.mjs` | `node scripts/qa/live/crawl.mjs <outdir>` | Every sitemap URL at 1440×900 and a phone subset: status, console/page errors, failed requests, overflow, h1/meta/canonical/hreflang/og, alt text, then every link and asset target once. Writes `crawl.json` and screenshots. LinkedIn answers 999 to bots; that is not a broken link. |
| `flow.mjs` | `node scripts/qa/live/flow.mjs <outdir>` | Cold start luminance series, keyboard stepping, Enter/Escape, soft About, panel next, back/forward, language switch, menu, contact validation (empty submit only), a direct project page; desktop, phone, reduced motion. |
| `cold-start.mjs` | `node scripts/qa/live/cold-start.mjs <origin>` | `hall:*` performance marks, `data-ready-ms`, bytes by group, largest files. Trust these marks; screenshot polling slows the page it measures. |
| `waterfall.mjs` | `node scripts/qa/live/waterfall.mjs <origin>` | Per-asset start/TTFB/download, protocol, long tasks. |
| `lang-switch.mjs` | `node scripts/qa/live/lang-switch.mjs <origin> <outdir>` | The DE/EN switch keeps the hall (constant luminance, surviving `window` marker), links/labels/canonical follow, back/forward. |
| `claw.mjs` | `node scripts/qa/live/claw.mjs <origin> <outdir> [tag]` | Close-up of the claw machine on About and in the hall. |
| `station-check.mjs` | `node scripts/qa/live/station-check.mjs <outdir> [origin]` | Steps to station 05, opens it, loads its page directly on desktop and phone. The slug and step count are written for VGM Battle; change them for another station. |
