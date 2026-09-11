# public/game-builds

Browser builds of games shown on the arcade page. Everything in `public/game-builds/<game>/`
is **generated and not committed** (see `.gitignore`); only this README is tracked.

## Echo Frequency

```
npm run arcade:echo
```

runs `scripts/export-arcade.mjs echo-frequency`, which exports the Godot project at
`C:/Users/denni/Projects/Echo-Frequency/EchoFreq/game` with the Web preset in
`scripts/arcade/echo-frequency.preset.cfg` into `public/game-builds/echo-frequency/`
(`index.html`, `index.js`, `index.wasm`, `index.pck`, `index.audio.worklet.js`,
`index.icon.png`, `index.apple-touch-icon.png`).

Requirements:

- Godot 4.7.1 console binary (path in the script; override with `GODOT_EXE`).
- Web export templates for the same version in
  `%APPDATA%\Godot\export_templates\4.7.1.stable\` (`web_nothreads_release.zip` for the
  single-threaded preset; `web_release.zip` if `variant/thread_support=true`).

The script temporarily appends the Web preset to the game's `export_presets.cfg` and
restores the original byte-for-byte afterwards (verified by SHA-256). It never commits,
stages, or switches branches in the game repo.

Flags: `--import` (resource import pass first), `--debug` (debug template),
`--dry-run` (append + restore only, Godot not run), `--backup-dir <dir>`.

## Local test

```
node scripts/arcade/serve.mjs --port 8765          # add --coi for threaded exports
node scripts/arcade/boot-check.mjs http://127.0.0.1:8765/echo-frequency/index.html --shot boot.png
```

## Deployment (R2)

Cloudflare Pages rejects any single file over 25 MiB; the Godot `.wasm` and the game `.pck`
both exceed that. The builds therefore live in an R2 bucket behind a custom domain and the
arcade page embeds them cross-origin in an iframe.

One-time setup (Cloudflare dashboard or wrangler):

1. Create the bucket: `npx wrangler r2 bucket create dennisbf-arcade`
2. R2 → bucket → Settings → Custom Domains → connect `arcade.dennisbf.design`
   (the zone is already on Cloudflare, so this is one click).
3. Put `PUBLIC_ARCADE_BASE=https://arcade.dennisbf.design` into `.env` (build-time, public).

Every time a game build changes:

```
npm run arcade:echo        # export → public/game-builds/echo-frequency/
npm run arcade:publish     # upload every file in public/game-builds/*/ to the bucket
# Build/redeploy the portfolio through its existing release workflow.
```

`publish-r2.mjs` uses `wrangler r2 object put` per file with the right Content-Type and
skips files whose size+mtime are unchanged since the last upload (state in
`.arcade-publish.json`, ignored by git). The main-site CSP already allows
`frame-src https://arcade.dennisbf.design`; threads are off in the preset, so the
game needs no COOP/COEP headers on the bucket.

## Readiness and release gate

The exporter instruments the Godot startGame promise and writes portfolio-ready.json only after a successful export. The portfolio embeds only a local build with this marker or an explicitly enabled remote release. Remote builds need PUBLIC_ARCADE_BASE and a comma-separated PUBLIC_ARCADE_RELEASES list. Verify the real game boot, failure handling and controls before adding an ID. Never copy a portfolio page into this directory.

The wrapper requests status on iframe load; the game reports readiness only after its engine startup promise resolves. HTML load is not treated as game startup. A failed or missing signal keeps the loading/error UI visible.
