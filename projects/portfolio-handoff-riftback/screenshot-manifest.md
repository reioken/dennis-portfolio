# Screenshot-Manifest — Riftback

Aufgenommen gegen lokalen Dev-Server `http://localhost:3000` (Branch mit aktuellem UI), Viewport Desktop **1440×900**, Mobile **390×844**, Dark-Theme. Keine Secrets sichtbar. Light-Theme nicht separat aufgenommen (sekundär laut Produktdesign).

Skript: `capture-screenshots.mjs` (+ `capture-extras.mjs`).

---

## Vorläufige Auswahl

| Rolle | Datei |
|---|---|
| **Hero / Cover** | `desktop/01-home-desktop.png` |
| **Stärkste Desktop (6)** | `01-home-desktop.png`, `03-champion-ahri-desktop.png`, `03b-champion-ahri-build-desktop.png`, `10-jungle-desktop.png`, `12-tier-list-desktop.png`, `19-search-palette-desktop.png` |
| **Stärkste Mobile (4)** | `01-home-mobile.png`, `03-champion-ahri-mobile.png`, `02-champions-mobile.png`, `06-tier-list-mobile.png` |
| **Besser nicht verwenden** | `18-contribute-desktop.png` (Formular, wenig visueller Punch), `17-about-desktop.png` (enthält persönliche Elo-Zeile), `09-summoner-spells-desktop.png` (ähnlich Kataloge, schwächer als Items/Runes), reine Full-Page-Duplikate außer Home/Jungle/Tier wenn Platz knapp |

Alle Dateien bleiben im Ordner; Endauswahl im Portfolio-Projekt.

---

## Desktop

### 01-home-desktop.png
- **Seite:** Start / Landing  
- **Route:** `/`  
- **Format:** Desktop Viewport  
- **Relevanz:** Marke, Hero-Splash, S-Tier-Teaser, Roster-Filter — erste Portfolio-Aussage  
- **Erkennbar:** Hextech-Vault-UI, Rail-Nav, Patch-Badge, 60-Champion-Grid  
- **Eignung:** Titelbild / Haupt-Screenshot  
- **Schwächen:** Featured-Champion wechselt täglich (Rammus im Shot) — nicht „fest“  
- **Bewertung:** 9/10

### 01-home-desktop-full.png
- **Seite:** Start komplette Seite  
- **Route:** `/`  
- **Format:** Desktop Full-Page  
- **Relevanz:** Länge und Abschnittstiefe der Landing  
- **Erkennbar:** Featured + Stats-Strip + voller Roster  
- **Eignung:** Ergänzend  
- **Schwächen:** Sehr lang; Detail verliert sich in Verkleinerung  
- **Bewertung:** 7/10

### 02-champions-desktop.png
- **Seite:** Champion-Übersicht  
- **Route:** `/champions`  
- **Format:** Desktop Viewport  
- **Relevanz:** Katalog-Einstieg  
- **Erkennbar:** Grid, Tier-Badges  
- **Eignung:** Ergänzend  
- **Schwächen:** Weniger einzigartig als Home-Roster  
- **Bewertung:** 7/10

### 02-champions-desktop-full.png
- **Seite:** Champion-Übersicht voll  
- **Route:** `/champions`  
- **Format:** Desktop Full-Page  
- **Relevanz:** Alle 60 Karten  
- **Eignung:** Ergänzend / Archiv  
- **Schwächen:** Zu dicht für Portfolio-Kachel  
- **Bewertung:** 6/10

### 03-champion-ahri-desktop.png
- **Seite:** Champion-Detail Overview (Ahri)  
- **Route:** `/champions/ahri`  
- **Format:** Desktop Viewport  
- **Relevanz:** Kernprodukt — Splash, Tiers, Ability-HUD, Base Stats  
- **Erkennbar:** Mode-Switch Classic/Mayhem, Subnav, Daten-Dichte ohne Chaos  
- **Eignung:** Haupt-Screenshot  
- **Schwächen:** Build-Kapitel nicht im Viewport  
- **Bewertung:** 9/10

### 03-champion-ahri-desktop-full.png
- **Seite:** Ahri komplette Seite  
- **Route:** `/champions/ahri`  
- **Format:** Desktop Full-Page  
- **Relevanz:** Gesamter Champion-Flow  
- **Eignung:** Ergänzend  
- **Schwächen:** Zu lang für Hero  
- **Bewertung:** 7/10

### 03b-champion-ahri-build-desktop.png
- **Seite:** Ahri Build-Kapitel (gescrollt)  
- **Route:** `/champions/ahri#build`  
- **Format:** Desktop Viewport  
- **Relevanz:** Offensive/Defensive-Items, Final Build, Copy — aktueller Build-UI-Stand  
- **Erkennbar:** Item-Path-Struktur, Runes/Masteries-Nähe  
- **Eignung:** Haupt-Screenshot  
- **Schwächen:** Abhängig von Scroll-Position; First-buy-Streifen klein  
- **Bewertung:** 8/10

### 04-champion-sion-desktop.png
- **Seite:** Champion-Detail Sion (Pre-Rework-Signal)  
- **Route:** `/champions/sion`  
- **Format:** Desktop Viewport  
- **Relevanz:** Anderer Champion-Archetyp / AP-Sion-Story  
- **Eignung:** Ergänzend  
- **Schwächen:** Ähnliche Layout-Struktur wie Ahri  
- **Bewertung:** 7/10

### 05-items-desktop.png
- **Seite:** Item-Katalog  
- **Route:** `/items`  
- **Format:** Desktop Viewport  
- **Relevanz:** 150 Classic-Items  
- **Eignung:** Ergänzend  
- **Schwächen:** Grid wirkt generisch ohne Detail  
- **Bewertung:** 6/10

### 06-item-deathfire-grasp-desktop.png
- **Seite:** Item-Detail Deathfire Grasp  
- **Route:** `/items/deathfire-grasp`  
- **Format:** Desktop Viewport  
- **Relevanz:** Ikonisches Season-3-Item, Stats/Rezept  
- **Eignung:** Ergänzend  
- **Schwächen:** Weniger „Produkt“-Feeling als Champion-Seiten  
- **Bewertung:** 7/10

### 07-runes-desktop.png
- **Seite:** Runes-Katalog  
- **Route:** `/runes`  
- **Format:** Desktop Viewport  
- **Relevanz:** Season-3-Rune-System  
- **Eignung:** Ergänzend  
- **Schwächen:** Visuell ruhiger als Jungle/Champion  
- **Bewertung:** 6/10

### 08-masteries-desktop.png
- **Seite:** Masteries-Katalog  
- **Route:** `/masteries`  
- **Format:** Desktop Viewport  
- **Relevanz:** 56 Talents, drei Bäume  
- **Eignung:** Ergänzend  
- **Schwächen:** Nicht in der Rail; Nutzer finden sie oft über Runes/Suche  
- **Bewertung:** 7/10

### 09-summoner-spells-desktop.png
- **Seite:** Summoner Spells  
- **Route:** `/summoner-spells`  
- **Format:** Desktop Viewport  
- **Relevanz:** Spell-Katalog inkl. Smite-Hinweis  
- **Eignung:** Eher weglassen wenn Platz knapp  
- **Schwächen:** Wenig Differenzierung  
- **Bewertung:** 5/10

### 10-jungle-desktop.png
- **Seite:** Jungle Routes  
- **Route:** `/jungle`  
- **Format:** Desktop Viewport  
- **Relevanz:** Eigene RouteMaps, nummerierte Steps — starkes UI-Stück  
- **Erkennbar:** Gemessene Camp-Positionen, Editorial-Routen, Designsprache  
- **Eignung:** Haupt-Screenshot  
- **Schwächen:** Unterer Teil (Loadout/Smite) nur angeschnitten  
- **Bewertung:** 9/10

### 10-jungle-desktop-full.png
- **Seite:** Jungle komplett  
- **Route:** `/jungle`  
- **Format:** Desktop Full-Page  
- **Relevanz:** Routen + Camps + Smite + Timer  
- **Eignung:** Ergänzend  
- **Schwächen:** Länge  
- **Bewertung:** 7/10

### 11-builder-desktop.png
- **Seite:** Build-Editor  
- **Route:** `/builder`  
- **Format:** Desktop Viewport  
- **Relevanz:** Erstellung/Veröffentlichung  
- **Eignung:** Ergänzend  
- **Schwächen:** Leerer/Startzustand weniger beeindruckend als gefüllter Editor  
- **Bewertung:** 6/10

### 12-tier-list-desktop.png
- **Seite:** Classic SR Tier List  
- **Route:** `/tier-list`  
- **Format:** Desktop Viewport  
- **Relevanz:** Meta-Übersicht ohne Rates  
- **Erkennbar:** Tier-Rails, Champion-Portraits, Gründe  
- **Eignung:** Haupt-Screenshot  
- **Schwächen:** Dichte; Text der Gründe braucht Zoom  
- **Bewertung:** 8/10

### 12-tier-list-desktop-full.png
- **Seite:** Tier List voll  
- **Route:** `/tier-list`  
- **Format:** Desktop Full-Page  
- **Relevanz:** Alle Tiers  
- **Eignung:** Ergänzend  
- **Bewertung:** 7/10

### 13-mayhem-tier-desktop.png
- **Seite:** ARAM Mayhem-ish Tier List  
- **Route:** `/tier-list/aram`  
- **Format:** Desktop Viewport  
- **Relevanz:** Zweiter Modus  
- **Eignung:** Ergänzend  
- **Schwächen:** Ähnlich Classic-Tier-List  
- **Bewertung:** 7/10

### 14-augments-desktop.png
- **Seite:** Mayhem Augments  
- **Route:** `/tier-list/aram/augments`  
- **Format:** Desktop Viewport  
- **Relevanz:** Augment-Pool  
- **Eignung:** Ergänzend  
- **Schwächen:** Viele ähnliche Icons (Riot-Art wiederholt sich)  
- **Bewertung:** 6/10

### 15-classic-explained-desktop.png
- **Seite:** Classic explained  
- **Route:** `/start`  
- **Format:** Desktop Viewport  
- **Relevanz:** Onboarding / Erklärung  
- **Eignung:** Ergänzend  
- **Schwächen:** Textlastig, weniger „App“-Look  
- **Bewertung:** 7/10

### 15-classic-explained-desktop-full.png
- **Seite:** Classic explained voll  
- **Route:** `/start`  
- **Format:** Desktop Full-Page  
- **Eignung:** Ergänzend  
- **Bewertung:** 6/10

### 16-changes-desktop.png
- **Seite:** Changelog  
- **Route:** `/changes`  
- **Format:** Desktop Viewport  
- **Relevanz:** Patch-/Mode-Änderungen  
- **Eignung:** Ergänzend  
- **Bewertung:** 6/10

### 17-about-desktop.png
- **Seite:** About  
- **Route:** `/about`  
- **Format:** Desktop Viewport  
- **Relevanz:** Provenance-Zahlen, Shortcuts  
- **Eignung:** **Besser nicht** (persönliche Elo-Zeile)  
- **Schwächen:** Persönlicher Kontext  
- **Bewertung:** 5/10 (Inhalt ok, Portfolio-Risiko)

### 18-contribute-desktop.png
- **Seite:** Contribute  
- **Route:** `/contribute`  
- **Format:** Desktop Viewport  
- **Relevanz:** Feedback-Kanal  
- **Eignung:** **Besser nicht**  
- **Schwächen:** Formular, wenig Design-Story  
- **Bewertung:** 4/10

### 19-search-palette-desktop.png
- **Seite:** Command-Palette Suche  
- **Route:** `/` (Overlay, Query `ahri`)  
- **Format:** Desktop Viewport  
- **Relevanz:** Keyboard-first Search, gruppierte Treffer  
- **Erkennbar:** Champions + Abilities, Tier in Results, Nav-Hints  
- **Eignung:** Haupt-Screenshot  
- **Schwächen:** Fuzzy-Matches können neben Ahri andere Champions listen  
- **Bewertung:** 8/10

---

## Mobile

### 01-home-mobile.png
- **Seite:** Start  
- **Route:** `/`  
- **Format:** Mobile Viewport  
- **Relevanz:** Mobile Hero + Einstieg  
- **Eignung:** Haupt-Mobile  
- **Schwächen:** Rail/Nav-Verhalten prüfen (Hamburger vs. Compact)  
- **Bewertung:** 8/10

### 02-champions-mobile.png
- **Seite:** Champions  
- **Route:** `/champions`  
- **Format:** Mobile Viewport  
- **Relevanz:** Grid auf schmalem Viewport  
- **Eignung:** Haupt-Mobile  
- **Bewertung:** 7/10

### 03-champion-ahri-mobile.png
- **Seite:** Ahri Detail  
- **Route:** `/champions/ahri`  
- **Format:** Mobile Viewport  
- **Relevanz:** Wichtigste Detailansicht mobil  
- **Eignung:** Haupt-Mobile  
- **Schwächen:** Subnav und Daten gestapelt  
- **Bewertung:** 8/10

### 04-jungle-mobile.png
- **Seite:** Jungle  
- **Route:** `/jungle`  
- **Format:** Mobile Viewport  
- **Relevanz:** Route-Karten gestapelt  
- **Eignung:** Ergänzend  
- **Schwächen:** Maps kleiner; weniger Punch als Desktop  
- **Bewertung:** 6/10

### 05-builder-mobile.png
- **Seite:** Builder  
- **Route:** `/builder`  
- **Format:** Mobile Viewport  
- **Relevanz:** Editor mobil  
- **Eignung:** Ergänzend  
- **Schwächen:** Leerer Zustand  
- **Bewertung:** 5/10

### 06-tier-list-mobile.png
- **Seite:** Tier List  
- **Route:** `/tier-list`  
- **Format:** Mobile Viewport  
- **Relevanz:** Meta mobil lesbar  
- **Eignung:** Haupt-Mobile  
- **Bewertung:** 7/10

### 07-classic-explained-mobile.png
- **Seite:** Classic explained  
- **Route:** `/start`  
- **Format:** Mobile Viewport  
- **Relevanz:** Textseiten mobil  
- **Eignung:** Ergänzend  
- **Bewertung:** 6/10

---

## Bekannte Darstellungsprobleme (Screenshots)

1. Featured-Champion auf Home wechselt täglich — Cover ist zeitgebunden.  
2. Search „ahri“ zeigte zusätzlich Fuzzy-Treffer (z. B. andere Champions) — nicht falsch, aber unklar ohne Erklärung.  
3. Builder-Shots oft im leeren Startzustand.  
4. About enthält persönliche Elo — Portfolio sollte den Shot meiden oder croppen.  
5. Augment-Icons wiederholen teilweise Riot-Art (bekanntes Client-Verhalten).  
6. Jungle-Viewport schneidet Loadout/Smite ab — Full-Page nutzen wenn nötig.  
7. Aufnahmen lokal; Live-Deploy kann um Minuten hinter dem Branch liegen (unklar ohne Live-Check zum Aufnahmezeitpunkt).
