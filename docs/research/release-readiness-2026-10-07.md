# Release readiness — October 7, 2026

**Released October 8, 2026 as `21f0d0e` / Pages `70f1afb8`** together with the Nintendo corner v9 and the
weak-PC fixes; see the [October 8 handover](../../HANDOVER-CLAUDE-2026-10-08.md). The text below is the pre-release record.

This records the approved hi-fi payload. The later TV v3 candidate is unapproved and local only;
see [current Claude continuation](../../HANDOVER-CLAUDE-2026-10-08.md) for the complete remaining work.

Status: approved hosted preview uploaded and verified as `a25254be` on `hifi-preview`. Production remains
the October 6 source `cedb8fa` / Pages `d381da08`. Source remains uncommitted; no push or production deployment.

Preview: https://hifi-preview.dennis-portfolio-87g.pages.dev
Immutable deployment: https://a25254be.dennis-portfolio-87g.pages.dev

## Prepared result

- Clean silver bedroom hi-fi with generated player/speakers, centered CD, dimensional LCD/glass, brushed grain,
  speaker wiring and wall power. Six real album tracks and the 1024 px cover are included.
- Existing GPU-loss recovery and compact centered loader verified. Dennis confirmed the loader buttons work.
- Factual UX audit items 1–7 and 9 completed; the CRT readout motion remains a design decision.
- Rapid track changes fixed: cancelled older playback promises cannot stop the newest track's display.
- Hosted audio seeking fixed: Pages returns whole files for range requests and does not expose internal length.
  `functions/media/music/[[path]].js` streams single ranges through `FixedLengthStream`; `album-lengths.json`
  supplies verified file sizes. It preserves asset security headers and validators without buffering whole files.
  [Pages behavior](https://developers.cloudflare.com/pages/configuration/serving-pages/#behavior),
  [Worker response lengths](https://developers.cloudflare.com/workers/runtime-apis/response/#set-the-content-length-header).

Source baseline: `d55f91b` on `feat/werkstatt`, plus explicitly selected working-tree changes. The isolated source
is an archive of HEAD with intended tracked changes/deletions and explicit new hi-fi/music/status files copied in.
Unrelated dirty `src/data/werkstatt.json`, external text-editor tooling, `.claude` settings and old untracked
models/textures are excluded. Captures and QA output remain outside the repository.

## Verification

| Check | Result |
| --- | --- |
| TypeScript and review tests | Pass; 39/39 review tests, including seven audio-range regressions |
| Model hashes | 30/30 |
| Isolated Astro build and build audit | Pass; 61 marketing pages, links and metadata |
| Production editor marker scan | No editor runtime markers found |
| Real album browser suite | 33/33; includes delayed rapid-track regression |
| Hi-fi layout | Controls/menu inside 900×700, 1024×600, 1280×800, 1440×900, 1920×1080 |
| Real audio | Starts from a user click; seek beyond 90 s; six local 206 ranges with correct MIME/length |
| GPU reset | Actual Chromium GPU-process crash; new hall canvas reaches ready; music continues; no errors |
| Mobile gallery | Selection retained through close/reopen and 7.5 s attract interval |
| Portfolio-refresh | Contact/menu/galleries/About/DE–EN/desktop/no-JS/no-WebGL pass |
| Repair-flow | Materials ready before compile, close-up, language/history/return, phone gallery/landscape pass |
| Loader compositor | Pass; reduced motion stops animation, main-thread block leaves it rotating |
| Hosted assets | 63 JS/CSS/model/album/cover assets match the build by SHA-256 |
| Hosted ranges | 18 exact 206 responses: start/middle/end of all six tracks |
| Hosted browser | Real click/play/seek beyond 90s/pause/resume/rapid skip/stop/close; phone EN content/layout; no errors |
| Hosted security | DE/EN home/archive CSP inline hashes and security headers pass; no editor markers |

Chromium on this Windows PC and browser-emulated phone sizes were used. Physical-device history/scroll-state
and screen-reader announcement density remain unverified.

## Evidence and preview

External artifact root:
`C:/Users/denni/.codex/visualizations/2026/10/07/01a117ee-e0f3-7ad3-961b-2f5d01aa0701/`

- `hifi-release/`: isolated source and `dist`; `http://127.0.0.1:4331/` serves this build.
- `release-sources.json`: SHA-256 manifest of selected changed/new sources.
- `release-dist.json`: SHA-256 manifest of the exact upload payload.
- `release-review.json`, `hifi-{width}x{height}.jpg`, `gpu-recovered.jpg`: targeted layout/audio/GPU checks.
- `hifi-final/`, `mobile-camera/`, `portfolio-refresh/`, `repair-flow/`, `loading-final/`: suite evidence.
- `hosted-preview.json`, `hosted-hifi-playing.jpg`, `hosted-phone-forever.jpg`: final hosted verification.
- `release-functions.json`: SHA-256 manifest of the Pages Functions sources, including range size metadata.

## Approval and next action

Automatic approval review initially rejected the upload; Dennis then explicitly approved the complete build,
six tracks and cover for `dennis-portfolio` / `hifi-preview`. Uploaded the approved static build and updated only
the preview's Pages Functions while fixing hosted seeking. The initial preview was `dde9fbf5`; final verified
preview is `a25254be`. The temporary asset-length diagnostic was removed before final verification.

Ready for an authorized intended-source commit and production release. Include the range function, its size
metadata, seven tests and album files with the other intended changes. Exclude dirty werkstatt data and old
untracked experiments/editor. The contact Worker is separate and was not redeployed.
