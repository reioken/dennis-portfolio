# Live site audit — 2026-09-19

Subject: `https://www.dennisbf.design` as deployed on 2026-09-17 (`05684256`), before the day's releases.
Machine: Windows 11, RTX 5090, headless Chromium with the GPU (`--use-angle=d3d11`), one desktop line.
Scripts: `scripts/qa/live/` (see its README). Numbers are measurements from this machine; nothing is estimated.

## Method

1. `crawl.mjs`: all 52 sitemap URLs plus `/rarer/`, `/rarer/?mode=depth` and a 404 at 1440×900; 29 of them again
   at 390×844. 450 link and asset targets checked once.
2. `flow.mjs`: the hall flows on desktop, phone and with reduced motion.
3. Lighthouse 12, mobile profile, on `/`, `/work/`, `/about/`, `/work/nexus/`.
4. `curl` for redirects, headers, robots, sitemap, the contact API (OPTIONS and an empty POST; nothing was sent).
5. Local: `tsc`, the 39 review tests, `npm audit`, branch state.

## Clean

- No console or page errors, no failed requests, no broken link or asset, no horizontal overflow on any page.
- One `h1`, description, canonical, `lang` and alt text everywhere; no unnamed control except Blue's two hidden toy buttons.
- HSTS, CSP with script hashes and `wasm-unsafe-eval`, COOP, nosniff, frame denial; http → https → www; slash redirects; real 404.
- `/api/contact`: 204 on OPTIONS, `{"ok":false,"error":"missing_fields"}` on an empty POST; client validation marks the three fields.
- Lighthouse accessibility, best practices and SEO 100 on all four pages; `/work/` performance 99.
- Keyboard stepping, Enter, Escape, soft About, panel next, back/forward, menu, phone sheets and native phone project pages all behaved.

## Findings

| # | Finding | Evidence | State |
| --- | --- | --- | --- |
| 1 | The DE/EN switch was a hard reload: the hall went black and re-ignited | second document request, `window` marker lost, luminance 17 → 0 for about 6 s | **fixed** `33e28d4` (client-router navigation) |
| 2 | Cold start: lit hall after about 13.5 s, 10.6 MB on the first visit | marks: load until 5.6 s, upload 0.4 s, compile 4.5 s, ready 10.7 s, then ignition | **partly fixed** `33e28d4`: compile 4.5 → 1.2 s. The rest is bandwidth (see below) and the intentional ignition |
| 3 | Mobile Lighthouse performance: home 47, About 58, `/work/nexus/` 61 (CLS 0.143, LCP 6.9 s) | `lh-*.json` | open |
| 4 | `/lowlight/`, `/nexus/`, `/rarer/` have no EN version (allowlisted in the audit); `/rarer/` has no `og:image` and is not in the sitemap | crawl | open, Dennis's call |
| 5 | Descriptions over 160 characters: Echo Frequency 193, Sauté Survivors 181, Essfreude 166, Cab No. 9 162; Impressum/privacy under 50 | crawl | open, his wording |
| 6 | `npm audit`: 8 advisories (svgo, sharp via wrangler/miniflare, undici, js-yaml, nanoid, smol-toml, browserslist, devalue, postcss), all build tooling for a static site | `npm audit` | open, `npm audit fix` on a quiet day with a full check |
| 7 | Git `main` is 99 commits behind what production serves; production is uploaded from `feat/werkstatt` | `git rev-list` | open, needs his decision |
| 8 | `pack-models.mjs` rewrote every GLB on a run meant for one | `git status` after the run | **fixed** `a37ff62` (`--only`) |
| 9 | No browser smoke test in `npm run check`; every browser regression needs a hand-started dev server | — | open; `scripts/qa/live/` is the start |
| 10 | `loadingManager.onError` fails the whole startup on one asset error; the case-mode CSS fallback shows nothing beside the panel | carried over from 2026-09-16 | open |

## Cold start after `33e28d4` (live, same machine)

- `hall:compile-start → compile-end`: 4486 ms → 1192 ms. Cause: `compileFor` awaited each batch of twelve before
  submitting the next, which held KHR_parallel_shader_compile to twelve programs at a time. All batches are now
  submitted (with a yield between them) and awaited together; the post-reveal path (`ensureCompiled`, batches of 3) is unchanged.
- The load phase is bandwidth-bound: about 9 MB over one HTTP/3 connection. Roughly sixty small textures and
  logos start at 1.5 s and receive their first byte only at 4.2 s, when `dennis.glb` (1.48 MB) and Blue (1.26 MB) finish.
  One 859 ms long task at 0.9 s (hydration and scene construction).
- First-visit bytes: taxi, Nori and the mascot sprites left (−2.4 MB), the plush came in (+1.35 MB).
- Not built: gate the reveal on the stations near the start and stream the others afterwards. The far stations
  are off-screen at the reveal, so nothing would pop in view; the cost is texture uploads and first-use shader
  variants arriving during the ignition and the first scroll. It needs the hitch measurements from
  `docs/research/site-performance-pass-2026-09-13.md` repeated, and Dennis's word, because "no models popping in"
  is his rule.
- Screenshot polling slows the page it measures (ready-to-lit read 6 s with 250 ms polling against 3.6 s with 500 ms).
  Use the `hall:*` marks and `data-ready-ms`.
