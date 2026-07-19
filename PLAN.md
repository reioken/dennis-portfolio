# Portfolio Deep-Analyse & Verbesserungsplan

Stand: 19.07.2026 · Basis: Code-Review aller Seiten/Komponenten, Produktions-Build (sauber, 16 Seiten),
Live-Tests im Dev-Server (Formular, Filter, Lightbox, Mobile-Viewport 375px, Konsole, Netzwerk).

## ✅ Umsetzungsstatus (19.07.2026)

**Umgesetzt und verifiziert:**
A1 404-Seite · A2 Sitemap+robots.txt · A3 tote Assets gelöscht (−4,3 MB) · A4 Formular-Validierung
mit Fehler-Mapping, `aria-invalid` und Fokus · A5 Impressum (DDG/MStV) + Datenschutz (Kontaktformular-
Abschnitt) · A6 `prefetchAll` · A7 Ordner entfernt · B1 `--faint` auf ≥4,5:1 · B2 Lightbox-Fokus
(Trap + Return, live getestet) · B3 Filter mit `aria-pressed` + Live-Region · B4 Tap-Targets ·
B5 Reduced-Motion bei BackToTop/Surface-Jump · B6 Reveal auf CSS/IO umgebaut (sichtbar ohne JS,
behebt auch invalides `ol > div > li`) · C1 Mina im Archiv · C2 Filter in URL (`?filter=`) ·
C3 lokalisierte Tag-Labels · C4/C5 Titles + Descriptions · C6 Meldung reset bei Eingabe ·
D1 `@sm`-Varianten (720 px) + `srcset` für Hero-Collage (`npm run thumbs`) · D2 GSAP entfernt ·
D4 Font-Preload · E2 OG-Größen-Metas nur noch beim Default-Bild · E3 CreativeWork+Breadcrumb-LD ·
F5 README. **Dist: 20 MB → 17 MB.**

**Bewusst zurückgestellt:** D3 (ContactForm bleibt `client:load` — vor der Hydration würde ein
nacktes `<form>` nativ per GET submitten und Felddaten in die URL schreiben; im Test reproduziert) ·
E1 i18n-Routing (strategische Entscheidung) · C7 Case-Outcomes (braucht echte Zahlen) ·
F1 Turnstile (erst bei Spam) · F2 WAF-Rate-Limit (Cloudflare-Dashboard, kein Code).

**Braucht deine Eingabe:** Straße + Hausnummer für Impressum/Datenschutz
(`site.legalAddress` in `src/lib/site.ts`).

---

## 1. Was schon richtig gut ist (behalten!)

- **Architektur:** Astro 7 statisch + gezielte React-Islands, saubere Trennung Content (MDX-Collection mit Zod) / Design (Tokens) / Logik. Build fehlerfrei.
- **Design-System:** Konsistente Tokens (`src/styles/tokens.css`), Glass-Ästhetik durchgezogen, Accent-Themes (ocean/ember), `@supports`-Fallback ohne backdrop-filter.
- **Reduced Motion:** Vorbildlich — 10+ `prefers-reduced-motion`-Blöcke, `useReducedMotion` in allen Islands, `--fx`-Schalter, FxBoot.
- **Security-Header** (`public/_headers`): CSP, HSTS mit preload, X-Frame-Options, Permissions-Policy — weit über Portfolio-Standard.
- **Kontakt-Pipeline:** Honeypot, serverseitige Validierung, HTML-Escaping in Mails, Reply-To sauber bereinigt, Worker/Pages-Function getrennt, Apex→www 308-Redirect.
- **A11y-Basis:** Skip-Link, `:focus-visible`-Stile, aria-Labels auf allen Controls (Audit: 0 unbenannte Buttons/Links), alt-Attribute auf allen 38 Bildern, `aria-current`, Escape/Pfeiltasten in Lightbox & Menü.
- **Responsive:** Kein horizontaler Overflow auf 375px (Home, Case, Work getestet), `width/height` auf Bildern (CLS-sicher), lazy loading (35/38 Bilder).
- **Caching:** `/_astro/*` immutable, Media mit SWR — korrekt.

---

## 2. Bugs & Defekte (Prio A — sofort fixen)

### A1 · Keine 404-Seite
Es gibt kein `src/pages/404.astro` → Cloudflare Pages liefert seine nackte Standard-404.
**Fix:** `src/pages/404.astro` mit BaseLayout, DE/EN-Text, Links zu Start/Work/Kontakt. ~15 min.

### A2 · robots.txt und sitemap.xml fehlen
Build erzeugt keine Sitemap, `public/robots.txt` existiert nicht.
**Fix:** `@astrojs/sitemap` installieren (`integrations: [sitemap()]`), `public/robots.txt` mit
`Sitemap: https://www.dennisbf.design/sitemap-index.xml`. ~15 min.

### A3 · ~4,3 MB tote Assets werden deployed (von 20 MB gesamt)
- `public/media/cta/cta-graphic.png` (2,3 MB) — Seite nutzt nur die .webp-Variante
- `public/media/cta/_preview.png` (740 KB) — Arbeitsdatei
- `public/media/mina/mina-1.webp` (900 KB) — nirgends referenziert (Gallery nutzt slide-1..4)
- `public/brand/mark-ai-source.png` (368 KB) — Quelldatei, nicht referenziert
**Fix:** Löschen bzw. in einen nicht-deployten `assets-src/` Ordner verschieben. ~10 min.
**Akzeptanz:** `dist/` schrumpft um ~4,3 MB.

### A4 · Kontaktformular: Fehler-UX unvollständig
Getestet: `not-an-email` passiert die Client-Validierung (nur „nicht leer“-Check bei `noValidate`),
Server antwortet 400 `invalid_email`, aber der Client zeigt dafür die generische Meldung
„Senden fehlgeschlagen. Versuch's nochmal“ — für einen E-Mail-Tippfehler die falsche Botschaft.
**Fix** in `src/components/contact/ContactForm.tsx`:
1. Client-seitiger E-Mail-Regex-Check vor dem Fetch (gleiche Regex wie Worker).
2. `errorKey`-Mapping: `invalid_email` → eigene Meldung („Bitte E-Mail-Adresse prüfen“ DE/EN).
3. `aria-invalid` + Fokus auf erstes fehlerhaftes Feld beim Validierungsfehler.
~45 min.

### A5 · Impressum/Datenschutz veraltet bzw. lückenhaft *(kein Rechtsrat, aber bekannte Punkte)*
- „§ 5 TMG“ → seit Mai 2024 **§ 5 DDG**; „§ 55 Abs. 2 RStV“ → seit 2020 **§ 18 Abs. 2 MStV**.
- `legalAddress` = nur „68542 Heddesheim“ — ladungsfähige Anschrift erfordert Straße + Hausnummer.
- Datenschutzerklärung beschreibt nur E-Mail-Kontakt; das **Kontaktformular** (Verarbeitung über
  Cloudflare Worker + Email Routing, übermittelte Felder, Rechtsgrundlage) fehlt komplett.
**Fix:** `src/pages/impressum.astro`, `src/pages/privacy.astro`, `src/lib/site.ts` (legalAddress). ~30 min.

### A6 · `prefetch: true` ist wirkungslos
Kein einziges `data-astro-prefetch`-Attribut im Code → es wird nie geprefetcht.
**Fix:** In `astro.config.mjs`: `prefetch: { prefetchAll: true, defaultStrategy: 'hover' }`. ~5 min,
spürbar schnellere Navigation.

### A7 · Leerer Ordner „Der Sport Müller“ im Repo-Root
**Fix:** löschen. ~1 min.

---

## 3. Accessibility (Prio B)

### B1 · Kontrast `--faint` (#52586c auf #07080c) ≈ 2,8:1 — WCAG-AA-Fail
Betroffen: Footer-Navigation (0,72rem!), inaktive Nav-Links, Karten-Tags, Copyright-Zeile.
AA verlangt 4,5:1 für kleinen Text.
**Fix:** `--faint` auf ~`#7a8098` anheben (≈4,6:1) oder betroffene Kleintexte auf `--dim` umstellen.
Visuell prüfen, damit die Hierarchie erhalten bleibt. ~30 min.

### B2 · Lightbox ohne Fokus-Management
`role="dialog"` + `aria-modal` vorhanden, aber: Fokus wird beim Öffnen nicht in den Dialog gesetzt,
kein Fokus-Trap (Tab wandert in die Seite dahinter), kein Fokus-Return auf den Auslöser beim Schließen.
**Fix** in `CaseMedia.tsx` (GalleryLightbox): beim Öffnen Close-Button fokussieren, Tab/Shift-Tab im
Dialog zirkulieren lassen, beim Schließen Trigger-Ref fokussieren. ~1–1,5 h.

### B3 · WorkFilter: falsche ARIA-Semantik
`role="tablist"/"tab"` ohne Pfeiltasten-Navigation und ohne `tabpanel` ist irreführend für Screenreader.
**Fix:** Entweder echte Tabs-Semantik (roving tabindex + Pfeiltasten) oder — einfacher und ehrlicher —
normale Buttons mit `aria-pressed`. Zusätzlich: Ergebnisanzahl in `aria-live`-Region ansagen. ~45 min.

### B4 · Tap-Targets unter 24 px
Footer-Links (18 px Höhe), „Projekt besprechen“-Link (18 px), Filmstrip-Thumbs (29 px).
**Fix:** Padding erhöhen (Zielgröße ≥ 24×24 px, ideal 44 px auf Touch). ~20 min.

### B5 · BackToTop ignoriert Reduced Motion
`window.scrollTo({ behavior: 'smooth' })` erzwingt Smooth-Scroll.
**Fix:** `matchMedia('(prefers-reduced-motion: reduce)')` prüfen → `behavior: 'auto'`. ~5 min.
(Gleiches Muster in `CaseSurfaceStack.jump()`.)

### B6 · Reveal-Sektionen sind bis zur Hydration unsichtbar
Motion rendert SSR-seitig `opacity:0` inline (Reveal, ProjectCard-Entrances). Bei JS-Fehler oder
langsamer Verbindung bleiben ganze Sektionen leer — der Hero wurde deswegen schon auf CSS umgestellt,
die Reveal-Wrapper (Home „Aktueller Stand“-Header, About-Skills) nicht.
**Fix-Optionen:** (a) Reveal auf CSS-`@keyframes` + `animation-timeline`/IntersectionObserver-Klasse
umbauen, oder (b) `<noscript>`-/Fallback-CSS `[style*="opacity:0"]`-Reset nach Timeout. Pragmatisch:
Reveal wie beim Hero durch reine CSS-Animation ersetzen. ~1–2 h.

---

## 4. Usability & Content (Prio B/C)

### C1 · Mina ist auf der Startseite unauffindbar
`featured: false` und kein `archive`-Tag → erscheint weder bei „Aktueller Stand“ noch im „Craft“-Streifen.
Als einziger klassischer UX-Case (Research, Tests, Prototypen) ist das aber Bewerbungs-relevant.
**Empfehlung:** `tags: ["design", "archive"]` setzen (dann 4er-Grid im Craft-Streifen statt 3 + Lücke)
oder bewusst featuren. ~5 min.

### C2 · Filterzustand nicht in der URL
`/work` → Filter „Product“ → Reload/Share verliert den Zustand.
**Fix:** `?filter=product` via `history.replaceState` + beim Mount lesen. ~30 min.

### C3 · Karten-Tags sind rohe englische Slugs
Auf den Cards steht „PRODUCT / DESIGN / ARCHIVE / LAB“ (Datenwerte), im UI-Filter aber „Archiv/Labor“.
**Fix:** Tag-Labels über i18n-Map rendern (`archive` → „Archiv“/„Archive“). ~20 min.

### C4 · Seitentitel mischen Sprachen
„Work — …“, „About — …“, „Contact — …“ auf einer primär deutschen Seite; EN-Modus ändert Titles nicht
(client-seitiges i18n). Kurzfristig: konsistent entscheiden (z. B. neutrale Titel „Projekte · Work“).
Langfristig: siehe E1. ~15 min.

### C5 · Meta-Descriptions generisch
Work/About/Contact/Lab nutzen alle `site.description`.
**Fix:** individuelle Descriptions pro Seite (About: Profil-Text, Work: Projektliste, …). ~20 min.

### C6 · Kontakt-Erfolgsmeldung verschwindet nicht / kein Reset-Hinweis
Nach Erfolg bleibt der Text stehen, Formular ist geleert — ok, aber ein zweiter Besuch des Buttons
wirkt tot. Nice-to-have: Erfolgspanel mit „Neue Nachricht“-Reset. ~30 min.

### C7 · Cases: Outcome teils dünn
„Shipbares Product“ o. ä. — wo möglich konkrete Zahlen/Fakten ergänzen (Screens geshippt, Plattformen,
Nutzer, Zeitraum). Reine Content-Arbeit, hoher Bewerbungs-Impact.

---

## 5. Performance (Prio B)

### D1 · Bild-Pipeline: kein `srcset`/`sizes`, kein AVIF
Karten laden Cover in voller Breite (bis 390 KB @2x), Collage-Shots ohne Responsive-Varianten.
**Plan:**
1. `scripts/optimize-media.mjs` erweitern: pro Bild 480/960/1440-Breiten + AVIF erzeugen.
2. `ProjectCard`, `WorkCollage`, `CaseMedia`-Thumbs auf `<img srcset sizes>` bzw. `<picture>` umstellen.
3. Mobile-Collage: statt 16 Shots × 2 Rails nur ~8 rendern (`window.matchMedia` oder CSS `content-visibility`).
~3–4 h, größter messbarer Gewinn auf Mobile.

### D2 · GSAP nur für eine Animation
`PortraitStage` lädt GSAP (Chunk 72 KB) für ein einzelnes `fromTo` — Motion ist ohnehin gebündelt.
**Fix:** Animation auf `motion/react` umschreiben, `gsap` aus `package.json` entfernen. ~30 min, −~25 KB gzip auf /about.

### D3 · Islands-Hygiene
`ContactForm client:load` → `client:visible` reicht. `Reveal client:visible` entfällt bei B6-Umbau
komplett (reines CSS). GlassNav/HeroStage bleiben `client:load`. ~20 min.

### D4 · Font-Preload
Zwei Outfit-woff2 (47 KB) laden via CSS-Kaskade → kurzer FOUT.
**Fix:** `<link rel="preload" as="font">` für die Latin-Variante im BaseLayout. ~10 min.

---

## 6. SEO & Sharing (Prio B/C)

### E1 · Bilingual-Strategie (strategische Entscheidung)
Aktuell: eine URL, beide Sprachen im DOM, EN per CSS versteckt, `lang`-Attribut wechselt client-seitig.
Konsequenz: Google indexiert nur DE; englischsprachige Recruiter finden die Seite schlecht; kein hreflang.
**Optionen:**
- **(a) Status quo akzeptieren** — für DE-Bewerbungen völlig okay, 0 Aufwand.
- **(b) Astro-i18n-Routing** (`/en/…`-Pfade, hreflang, getrennte Titles/Metas) — sauberste Lösung,
  aber ~1–2 Tage Umbau (Layout, Nav, alle `data-lang`-Spans in Props/Slots überführen).
Empfehlung: (b) nur angehen, wenn internationale Reichweite ein echtes Ziel ist.

### E2 · OG-Images der Case-Seiten
`og:image` = Produktscreenshot in Originalgröße, aber `og:image:width/height` hardcoded „1200×630“.
**Fix:** Entweder pro Case ein echtes 1200×630-OG-Bild rendern (Cover + Logo + Titel auf Brand-Gradient,
einmalig via Sharp-Skript) oder die width/height-Metas nur beim Default-OG ausgeben. ~1–2 h für die schöne Variante.

### E3 · Strukturierte Daten erweitern (optional)
`Person`-LD vorhanden ✓. Optional: `CreativeWork` je Case + `BreadcrumbList`. ~45 min.

---

## 7. Robustheit & Sonstiges (Prio C)

- **F1 · Spam-Schutz:** Nur Honeypot. Reicht meist; falls Spam kommt: Cloudflare Turnstile (invisible)
  in Form + Worker-Verify. ~1 h, erst bei Bedarf.
- **F2 · Worker-Antwort bei Rate-Limit/Missbrauch:** kein Limit konfiguriert. Cloudflare WAF-Rule
  (z. B. 5 req/min auf `/api/contact`) im Dashboard — 10 min, kein Code.
- **F3 · `SiteGate`/Editor-Chunks** landen ungenutzt in `dist/_astro` (44 KB) — harmlos (nicht referenziert),
  optional via bedingtem Import eliminieren.
- **F4 · E-Mail-Adresse** steht als Klartext-`mailto:` — Scraper-Risiko bewusst akzeptieren oder
  minimal obfuskieren. Bewusste Entscheidung, kein Muss.
- **F5 · README** erwähnt „Astro 5“, installiert ist Astro 7 — Doku-Fix.

---

## 8. Umsetzungs-Reihenfolge (Sprint-Vorschlag)

**Sprint 1 — Quick Wins & Pflicht (≈ ½ Tag):**
A1 404-Seite · A2 Sitemap/robots · A3 tote Assets · A5 Impressum/Datenschutz · A6 prefetchAll ·
A7 Ordner löschen · B5 BackToTop · D4 Font-Preload · F5 README

**Sprint 2 — Formular & A11y (≈ 1 Tag):**
A4 Formular-Fehler-UX · B1 Kontrast · B2 Lightbox-Fokus · B3 Filter-ARIA · B4 Tap-Targets ·
C2 Filter-URL · C3 Tag-Labels · C4/C5 Titles/Descriptions

**Sprint 3 — Performance (≈ 1 Tag):**
D1 srcset/AVIF-Pipeline · D2 GSAP raus · D3 Islands · B6 Reveal→CSS · E2 OG-Images

**Sprint 4 — Strategisch (nach Bedarf):**
E1 echtes i18n-Routing · C7 Case-Outcomes schärfen · C1 Mina platzieren · E3 LD-Erweiterung ·
F1/F2 Spam-Schutz

**Nach jedem Sprint:** `npm run build` + Lighthouse (Mobile) + Tastatur-Durchlauf (Tab durch Home,
Work-Filter, Lightbox, Formular) als Abnahme.

---

## 9. Nicht gefundene Probleme (explizit geprüft, alles sauber)

- Keine Konsolen-Fehler auf Home/Work/Case/Contact
- Kein horizontaler Overflow auf 375 px
- Keine Bilder ohne alt, keine unbenannten Buttons/Links, keine doppelten IDs
- Heading-Hierarchie korrekt (genau ein H1 pro Seite, logische H2/H3)
- Build ohne Warnungen, alle 16 Routen generiert
- Canonical-URLs, Favicons, Apple-Touch-Icon, theme-color korrekt
- Escape/Pfeiltasten der Lightbox funktionieren (Code korrekt; ein scheinbarer Hänger im Test lag am
  Test-Browser, dessen requestAnimationFrame eingefroren war — nicht an der Seite)
