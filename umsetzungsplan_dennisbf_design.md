# Umsetzungsplan: dennisbf.design

Basierend auf dem Audit vom 19. Juli 2026 (`audit_dennisbf_design.md`). Priorisiert nach Impact auf die drei Site-Ziele (Festanstellung, Freelance-Anfragen, Product-Arbeit glaubwürdig zeigen) — nicht nach Lehrbuch-Reihenfolge.

---

## Phase 0 — Kritische Fixes (sofort, blockieren Conversion)

Diese drei Punkte verhindern aktuell, dass Anfragen überhaupt ankommen oder dass Recruiter Kontakt aufnehmen.

- [x] **Kontaktformular ohne JS zum Laufen bringen** — `<form>` braucht `action`/`method`, die an den bestehenden Cloudflare-Worker-Endpoint posten; Client-JS bleibt als Progressive Enhancement (Validierung, ohne Reload). *Aufwand: M*
- [x] **E-Mail-Link ohne JS reparieren** — Cloudflare-Email-Obfuscation für den Contact-Link deaktivieren oder durch einfaches, funktionierendes Muster (z. B. `<noscript>`-Fallback mit echtem `mailto:`) ersetzen. *Aufwand: S*
- [x] **Beschäftigungsstatus klarstellen** — ein Satz im Hero/Contact, der eindeutig sagt: aktuell Art Director bei Floordirekt, **keine** Festanstellung gesucht, aber offen für Freelance-Projekte. Z. B. "Aktuell Art Director bei Floordirekt · offen für Freelance-Projekte · Mannheim/Heidelberg" (Vorbild: Lu Yu, [luyu.co](https://luyu.co/)). Verhindert unpassende Recruiter-Anfragen und schärft Ziel 2. *Aufwand: S*

---

## Phase 1 — Quick Wins (alle < 1h, in einem Batch umsetzbar)

- [x] Standortangabe auf `/contact/` von "Deutschland" auf "Mannheim/Heidelberg-Raum" konkretisieren
- [ ] Cloudflare Web Analytics im Dashboard deaktivieren (behebt CSP-Konsolenfehler)
- [x] `fetchpriority="high"` auf das echte Hero-/LCP-Bild setzen, `low` nur für den Rest
- [x] Mobile-Menü-Hintergrund undurchsichtig machen (Opazität/Blur erhöhen, behebt Text-Overlap)
- [x] `address`-Feld (PostalAddress, Region Rhein-Neckar) im Person-JSON-LD ergänzen
- [x] Interne Links direkt mit trailing slash versehen (spart 308-Redirect-Hop)
- [x] Toten `lockSite`/`authKey`-Code aus dem Production-Bundle entfernen
- [x] Desktop-Hamburger neben Vollnavigation entfernen
- [x] `--faint`-Textfarbe (`#727990`) geringfügig aufhellen für sichere AA-Konformität
- [x] `access-control-allow-origin: *` von HTML-Responses entfernen, nur auf API-Routen belassen

---

## Phase 2 — Hoch-Priorität (Accessibility & SEO-Substanz)

- [x] **Alt-Texte nachziehen**: alle Bilder auf `/work/nexus/` (18 von 19 fehlen) und 33 der 36 Homepage-Bilder — nach Vorbild von `/work/mina/` (bereits vorbildlich)
- [x] **Formular-Fehlermeldungen pro Feld**: statt einer Sammelmeldung, jedes invalide Feld per `aria-describedby` mit eigenem Fehlertext verknüpfen
- [x] **Scroll-Reveal-Galerie robuster machen**: `IntersectionObserver`-`rootMargin` großzügiger setzen (z. B. `200% 0px`), damit Crawler/schnelles Scrollen nichts verpassen
- [x] **Sitemap um `lastmod`** pro URL ergänzen (automatisch aus Build-Zeitstempel)

---

## Phase 3 — Content-Überarbeitung (größter Hebel für Ziel 1 + 3)

- [x] **NEXUS-Case auf Problem→Prozess→Outcome umbauen**: mindestens 1-2 echte oder plausibel approximierte Kennzahlen ergänzen (Anzahl Stores/Installationen, Zeitersparnis, Fehlerquote vorher/nachher)
- [x] Gleiches Schema für Riftcast und Berry, sobald NEXUS als Vorlage steht
- [x] **Trust-Leiste ergänzen**: Firmennamen/Rollen (Floordirekt, performio, cyberWear, Decathlon) prominent auf About oder Homepage platzieren — ohne dass Zitate nötig sind
- [x] Formulierung auf About-Seite präzisieren: aktuelle Festanstellung bei Floordirekt als Art Director klar benennen und explizit machen, dass nur Freelance-Anfragen gesucht werden, keine neue Festanstellung (siehe Phase 0)

---

## Phase 4 — Strategischer Rebuild (größerer Aufwand, größte SEO-Reichweite)

- [x] **Echte Zweisprachigkeit mit eigenen `/en/`-Routen + hreflang** statt Client-seitigem `display:none`-Sprachwechsel
  - Astro-Routing um `src/pages/en/` erweitern (oder i18n-Routing-Feature nutzen)
  - `hreflang="de"`/`hreflang="en"`/`hreflang="x-default"` in `<head>` ergänzen
  - Sitemap um beide Sprachversionen erweitern
  - *Trade-off:* deutlich mehr Wartungsaufwand bei jedem neuen Case-Study, aber öffnet englischsprachige Suchanfragen komplett neu

---

## Phase 5 — Aufräumen (niedrige Priorität, bei Gelegenheit)

- [ ] `/work/`-Mobile-Menü visuell gruppieren (Accordion oder klarere Sections statt einer langen Liste)
- [ ] AVIF-Kaskade (`<picture>` AVIF→WebP→JPEG) für die größten Screenshot-Assets ergänzen
- [ ] CSP `'unsafe-inline'` in `script-src`/`style-src` durch Nonce/Hash ersetzen, falls Build-Setup das zulässt

---

## Nicht selbst umsetzbar / vorher verifizieren

Vor dem Launch der Fixes empfiehlt sich eine Kontrollmessung mit echten Tools (siehe Test-Checkliste im Audit): [PageSpeed Insights](https://pagespeed.web.dev/) für reale CWV, [axe DevTools](https://www.deque.com/axe/devtools/) für automatisierten A11y-Scan, [WebPageTest](https://www.webpagetest.org/) für die ungeklärte 15s-Lade-Anomalie, sowie ein manueller Screenreader-Test (NVDA/VoiceOver) nach Umsetzung von Phase 2.
