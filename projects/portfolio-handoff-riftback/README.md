# Portfolio-Handoff — Riftback

Lokales Paket für die Portfolio-Übernahme auf dennisbf.design.  
**Nicht deployen.** Ordner ist in `.gitignore`.

## Inhalt

| Datei / Ordner | Zweck |
|---|---|
| `project-info.md` | DE + EN Projekttexte |
| `screenshot-manifest.md` | Alle Screenshots bewertet + Vorauswahl |
| `routes.md` | Sichtbare Produktansichten |
| `screenshots/desktop/` | 1440×900 (+ Full-Page wo sinnvoll) |
| `screenshots/mobile/` | 390×844 |
| `capture-screenshots.mjs` | Re-Capture (braucht Playwright) |
| `capture-extras.mjs` | Build-Kapitel-Scroll-Shot |

## Screenshots neu erzeugen

```bash
pnpm dev
# anderes Terminal:
pnpm add -D playwright
pnpm exec playwright install chromium
node portfolio-handoff/capture-screenshots.mjs
node portfolio-handoff/capture-extras.mjs
```

Optional: `HANDOFF_BASE_URL=https://riftback.gg` gegen Live.

## An Portfolio-Chat weitergeben

Kompletter Ordner `portfolio-handoff/` (Markdown + Screenshots).
