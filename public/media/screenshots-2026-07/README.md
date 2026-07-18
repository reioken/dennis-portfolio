# Portfolio-Screenshots (Auswahl 2026-07-18)

Kuratierte Auswahl aus `Documents/screenshots` (+ manuelle NEXUS-Ergänzungen).

**Eingebunden** über `node scripts/import-screenshots-2026-07.mjs` → `public/media/{projekt}/screen-*.webp` (+ `@2x`), Case-Galleries und Hero-Collage.

---

## Berry — 7

| Datei | Warum |
|---|---|
| `01-home` | Cover: Brand, Portfolio-Wert, Scan-CTA, Leaks |
| `02-search` | Katalog, Filter-Chips, Stöbern |
| `03-collection` | Sammlung mit Preisen & Mengen |
| `04-decks-meta` | Meta / Siegerlisten |
| `05-deck-editor` | Deck-Bau (Turnierbereit, Pool) |
| `06-insights` | Charts: Wert, Farben, Rarität |
| `07-tournaments` | Winrate, Matchups, Formate |

**Weggelassen:** Settings, Quick-Add (leere Spoiler-Set), Card-Detail (Overlay/Placeholder), Sealed, Kalender, Album (überlappt Collection), Hub (nur Menü).

---

## NEXUS — 8

| Datei | Warum |
|---|---|
| `01-home` | Flow-Home mit Carousels |
| `02-grid` | Bibliothek-Raster (Kernansicht) |
| `03-showcase` | Hero-Detail + Status |
| `04-coverflow` | Cover-Flow-Ansicht |
| `05-couch` | 10-Fuß / Gamepad-UI |
| `06-toplists` | Rankings + Filterpane |
| `07-wrapped` | Jahres-Stats (markant) |
| `08-cmdk` | Command Palette |

**Weggelassen:** Light-Mode-Dubletten, List/Split (ähnlich Grid), Stats (Wrapped reicht), Onboarding, Hubs (Riot/Blizz), Achievements, Wish/Soon.

---

## Floordirekt Studio — 6

| Datei | Warum |
|---|---|
| `01-start` | Einstieg / Workflow |
| `02-bilder` | Dropzone + Auto-Farbe |
| `03-layout-export` | Smart-Platzierung + Multi-Brand |
| `04-sprachen` | DeepL / Mehrsprachigkeit |
| `05-pruefen` | Pre-Export (stärkstes „fertig vor Lauf“) |
| `06-fertig` | Batch-Ergebnis |

**Wegelassen:** APIs/Keys, Farben-Unterschritte, Texte, Schnellstart-Duplikate, Erzeugen-Zwischenstand, Einstellungen.

**Hinweis:** UI zeigt lokale Pfade (`C:\Users\…`). Vor Live-Deploy ggf. maskieren oder neu aufnehmen.

---

## Riftcast — 7

| Datei | Warum |
|---|---|
| `01-launcher-home` | Host + QR / Pairing |
| `02-launcher-remote` | Remote / Tunnel-Story |
| `03-desktop-live` | Live-Session Desktop |
| `04-desktop-controls` | Control-Overlay Desktop |
| `05-mobile-controls` | Phone Control-Grid |
| `06-mobile-quality` | Qualitäts-Presets / Slider |
| `07-pad-shooter` | On-Screen-Pad (stärkstes Layout) |

**Weggelassen:** Login-Screens, leeres Live-Clean, weitere Pad-Layouts (Controller/MOBA/Racing), Keyboard/Clicks-Overlays, Shortcuts-alone.

---

## Nächste Schritte (optional)

1. PNGs → WebP komprimieren
2. In `src/content/work/*.mdx` `gallery` / `cover` aktualisieren
3. `src/lib/media-catalog.ts` + Hero-Collage anpassen
