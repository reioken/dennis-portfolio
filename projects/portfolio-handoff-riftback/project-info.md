# Riftback — Portfolio project info

Solo Product Build. Keine erfundenen Nutzerzahlen oder Erfolgsmetriken.

---

## Deutsch

### Projektname
**Riftback**

### Untertitel (≤ 8 Wörter)
League-Classic-Builds, klar und belegbar

### Beschreibung (≤ 160 Zeichen)
Fan-Referenz für League Classic und ARAM Mayhem-ish: Builds, Items, Runes, Jungle und Tier-Listen — ohne Winrates, mit belegter Datenherkunft.

### Kompakte Projektbeschreibung (~60–100 Wörter)
Riftback ist eine statische Fan-Seite für Riots League-Classic-Modus (Season-3-Kits, Patch 26.15) und den Mayhem-ish-Augment-Pool. Alle 60 Roster-Champions haben Kits und Classic-SR-Builds; Items, Runes, Masteries, Spells und Jungle-Daten liegen als validierte JSON-Inhalte vor. Ein Build-Editor kann Community-Builds veröffentlichen. Die Seite läuft ohne Login und ohne Datenbank auf Cloudflare Pages. Gameplay-Zahlen werden nicht erfunden — Unsicherheiten bleiben intern dokumentiert, Win-/Pick-/Ban-Rates erscheinen nicht.

### Zielgruppe
Spieler, die League Classic lernen oder nach Season-1–3 zurückkehren und eine klare Build-/System-Referenz brauchen.

### Wichtigste Funktionen
1. Champion-Seiten mit Ability-HUD, Builds, Matchups, Skins und Vs.-modern-Vergleich  
2. Item-, Rune-, Mastery- und Summoner-Spell-Kataloge  
3. Jungle-Seite mit Camp-Werten, Smite und gerouteten Karten  
4. Tier-Listen Classic SR und ARAM Mayhem-ish (Begründung, keine Rates)  
5. Build-Editor mit optionaler Community-Veröffentlichung  
6. ⌘K/Ctrl+K-Suche über Champions, Builds, Items und Abilities  

### Tech-Stack
Next.js 15 (static export), React 19, TypeScript, Tailwind CSS 4, Zod, Fuse.js, Zustand · Cloudflare Pages + Pages Functions + KV · pnpm, Vitest, GitHub Actions CI

### Rolle
Solo Product Build

### Konkreter Beitrag
Produktidee, Content-Pipeline und Import-Skripte, Schemas/Validierung, gesamtes UI (Hextech-Vault-Design, Rail-Nav, Themes), Champion-/Jungle-/Builder-Flows, Community-Builds-API, Deploy und Content-Pflege.

### Aktueller Status
Öffentlich unter https://riftback.gg (seit 2026-08-03), bewusst `noindex`. Feature-seitig weitgehend fertig für den 60er-Roster; einzelne Gameplay-Zahlen und Jungle-Timer bleiben Era-/Community-Stand-ins und sind intern als unsicher markiert.

### Empfohlene Kategorie
Product Design / Web App · Fan Tool · Gaming Reference

### Empfohlene Tags
Next.js, TypeScript, Tailwind, Cloudflare Pages, content-driven, League of Legends, static site, Zod, solo build

### Öffentliche URL
https://riftback.gg

### Nicht öffentlich zeigen
- Interne Docs (`CLAUDE.md`, `docs/HANDOVER.md`, `docs/STATUS.md`, `docs/UNCERTAIN.md`, Research-Prompts)
- Secrets / Pages-Secrets (`SITE_PASSWORD`, `SITE_PUBLIC`), KV-Namespace-Details als „Hack“
- Win-/Pick-/Ban-Rates (existieren bewusst nicht)
- Ungeprüfte Community-Builds als redaktionelle Wahrheit
- Optional: persönliche Elo-Angabe auf `/about` (steht im Produkt; Portfolio kann den Shot weglassen)
- Client-Audit- und OP.GG-Dump-Pfade außerhalb des Repos

---

## English

### Project name
**Riftback**

### Subtitle (≤ 8 words)
League Classic builds, sourced and clear

### Description (≤ 160 characters)
Fan reference for League Classic and ARAM Mayhem-ish: builds, items, runes, jungle, and tier lists — no win rates, with documented data provenance.

### Short project description (~60–100 words)
Riftback is a static fan site for Riot’s League Classic mode (Season 3 kits, patch 26.15) and the Mayhem-ish augment pool. All 60 roster champions ship with kits and Classic SR builds; items, runes, masteries, spells, and jungle data live as validated JSON. A build editor can publish community builds. There is no login and no database — Cloudflare Pages serves the export. Gameplay numbers are not invented; uncertain values stay documented internally, and win/pick/ban rates never appear.

### Audience
Players learning League Classic or returning from Seasons 1–3 who need a clear build and systems reference.

### Key features
1. Champion pages with ability HUD, builds, matchups, skins, and vs-modern comparison  
2. Item, rune, mastery, and summoner-spell catalogs  
3. Jungle page with camp values, Smite, and routed maps  
4. Classic SR and ARAM Mayhem-ish tier lists (reasons, no rates)  
5. Build editor with optional community publishing  
6. ⌘K/Ctrl+K search across champions, builds, items, and abilities  

### Tech stack
Next.js 15 (static export), React 19, TypeScript, Tailwind CSS 4, Zod, Fuse.js, Zustand · Cloudflare Pages + Pages Functions + KV · pnpm, Vitest, GitHub Actions CI

### Role
Solo Product Build

### My contribution
Product concept, content pipeline and import scripts, schemas/validation, full UI (Hextech Vault design, rail nav, themes), champion/jungle/builder flows, community-builds API, deploy, and ongoing content care.

### Current status
Public at https://riftback.gg (since 2026-08-03), intentionally `noindex`. Feature-complete for the 60-champion roster; some gameplay figures and jungle timers remain era/community stand-ins and are marked uncertain internally.

### Recommended category
Product Design / Web App · Fan Tool · Gaming Reference

### Recommended tags
Next.js, TypeScript, Tailwind, Cloudflare Pages, content-driven, League of Legends, static site, Zod, solo build

### Public URL
https://riftback.gg

### Do not show publicly
- Internal docs (`CLAUDE.md`, `docs/HANDOVER.md`, `docs/STATUS.md`, `docs/UNCERTAIN.md`, research prompts)
- Secrets / Pages secrets, KV namespace details framed as exploits
- Win/pick/ban rates (deliberately absent)
- Unreviewed community builds as editorial truth
- Optional: personal Elo line on `/about` (present in product; portfolio can omit that shot)
- Client-audit / OP.GG dump paths outside the repo
