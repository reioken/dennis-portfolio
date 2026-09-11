# Sichtbare Produktansichten (Portfolio)

Basis-URL lokal: `http://localhost:3000` · Live: `https://riftback.gg`

| # | Ansicht | Route | Desktop Shot | Mobile Shot | Anmerkung |
|---|---|---|---|---|---|
| 1 | Start / Landing | `/` | 01-home-* | 01-home-mobile | Hero + Roster |
| 2 | Champions-Übersicht | `/champions` | 02-champions-* | 02-champions-mobile | Grid |
| 3 | Champion-Detail | `/champions/[slug]` | 03-ahri, 03b-build, 04-sion | 03-ahri-mobile | Ahri = Showcase |
| 4 | Items-Übersicht | `/items` | 05-items | — | |
| 5 | Item-Detail | `/items/[slug]` | 06-deathfire-grasp | — | |
| 6 | Runes | `/runes` | 07-runes | — | |
| 7 | Masteries | `/masteries` | 08-masteries | — | Nicht in Rail |
| 8 | Summoner Spells | `/summoner-spells` | 09-summoner-spells | — | |
| 9 | Jungle | `/jungle` | 10-jungle-* | 04-jungle-mobile | RouteMaps |
| 10 | Build-Editor | `/builder` | 11-builder | 05-builder-mobile | |
| 11 | Tier List Classic | `/tier-list` | 12-tier-list-* | 06-tier-list-mobile | |
| 12 | Tier List Mayhem | `/tier-list/aram` | 13-mayhem-tier | — | |
| 13 | Augments | `/tier-list/aram/augments` | 14-augments | — | |
| 14 | Classic explained | `/start` | 15-classic-explained-* | 07-classic-explained-mobile | Rail: Explained |
| 15 | Changes | `/changes` | 16-changes | — | |
| 16 | About | `/about` | 17-about | — | Elo-Hinweis |
| 17 | Contribute | `/contribute` | 18-contribute | — | Formular |
| 18 | Suche (Overlay) | `/` + Ctrl+K | 19-search-palette | — | |

## Nicht aufgenommen (bewusst)

- `/impressum`, `/datenschutz` — Rechtstexte, wenig Portfolio-Wert  
- Technische 404/Error-Seiten  
- Community-Shelf-Zustände mit fremden User-Inhalten (variabel, unreviewed)  
- Light-Theme (Design: dark first)  
- Login — existiert nicht  

## Wichtige Zustände geprüft

| Zustand | Wo | Ergebnis |
|---|---|---|
| Befüllt | Home, Champions, Tier List, Ahri | OK |
| Detail geöffnet | Ahri Overview + Build | OK |
| Suche mit Ergebnissen | Palette `ahri` | OK (Fuzzy-Nebentreffer) |
| Jungle Routes | `/jungle` | OK, nummerierte Steps |
| Builder Start | `/builder` | oft leer bis Champion gewählt |
| Legal | impressum/datenschutz | vorhanden, nicht geshot |
