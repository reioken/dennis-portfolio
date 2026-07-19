Du arbeitest am Codebase von dennisbf.design — einer Portfolio-Website von Dennis Bierreth-Fernandez (Art Director & UI/UX Designer). Stack: Astro (statisch) mit React Islands, Deployment auf Cloudflare Pages, Kontaktformular über einen Cloudflare Worker, zweisprachig DE/EN aktuell über client-seitigen Sprachwechsel unter einer URL (`data-lang="de"/"en"` Attribute + CSS `display:none`).

Setze folgende Fixes aus einem vorangegangenen Website-Audit um, in dieser Reihenfolge. Arbeite Phase für Phase, committe nach jeder Phase separat, und beschreibe kurz was du geändert hast.

## Phase 0 — Kritisch (zuerst)

1. **Kontaktformular ohne JavaScript reparieren**: Das `<form>` auf `/contact/` hat aktuell kein `action`/`method`-Attribut und funktioniert nur mit JavaScript. Ergänze `action` und `method="POST"`, die zum bestehenden Cloudflare-Worker-Endpoint zeigen (finde den Endpoint im Code, z. B. `wrangler.toml` oder Worker-Verzeichnis). Das bestehende Client-JS (Validierung, kein Page-Reload) soll als Progressive Enhancement erhalten bleiben — bei deaktiviertem JS muss ein normaler HTML-Form-POST funktionieren und der Nutzer eine Erfolgs-/Fehler-Seite oder -Meldung sehen.

2. **E-Mail-Link ohne JavaScript reparieren**: Die E-Mail-Adresse ist über Cloudflares automatische Email-Obfuscation eingebunden und zeigt ohne JS nur "[email protected]" (nicht klickbar). Ersetze das entweder durch Deaktivierung der Cloudflare-Email-Obfuscation für diesen Link (z. B. via `data-cfemail`-Attribut ausschließen) oder durch ein eigenes, funktionierendes `mailto:`-Pattern mit einfacher Verschleierung, das auch ohne JS als klickbarer Link funktioniert.

3. **Beschäftigungsstatus klarstellen**: Füge im Hero-Bereich der Startseite oder direkt auf `/contact/` einen kurzen, prominenten Satz ein, der eindeutig sagt, dass Dennis aktuell als Art Director bei Floordirekt fest angestellt ist und **keine** neue Festanstellung sucht, aber offen für Freelance-Projekte ist. Beispiel: "Aktuell Art Director bei Floordirekt · offen für Freelance-Projekte · Mannheim/Heidelberg". Ziel ist es, unpassende Recruiter-Anfragen für Festanstellungen zu vermeiden und die Freelance-Anfragen zu schärfen.

## Phase 1 — Quick Wins (alle klein, in einem Batch)

4. Ändere die Standortangabe auf `/contact/` von "Standort Deutschland" zu "Mannheim/Heidelberg-Raum" (oder äquivalent präziser).
5. Setze `fetchpriority="high"` auf das tatsächliche LCP-Bild (das größte/erste sichtbare Bild im Viewport der Startseite), entferne `fetchPriority="low"` von genau diesem Bild. Alle anderen Bilder behalten `low`/`lazy` wie bisher.
6. Erhöhe im Mobile-Menü-Overlay die Deckkraft/den Blur-Wert des Hintergrunds, sodass Hero-Text im Hintergrund nicht mehr durchscheint und mit Menütext überlappt.
7. Ergänze im `Person`-JSON-LD-Schema (sitewide) ein `address`-Feld vom Typ `PostalAddress` mit Region Rhein-Neckar/Mannheim-Heidelberg.
8. Prüfe alle internen `<a href>`-Werte im Code und stelle sicher, dass sie bereits den trailing slash enthalten (z. B. `/work/` statt `/work`), um den zusätzlichen 308-Redirect zu vermeiden.
9. Suche im Code nach der ungenutzten `lockSite`/`authKey`-Site-Gate-Logik (Inline-Script) und entferne diesen toten Code vollständig.
10. Entferne auf Desktop-Viewports das Hamburger-Menü-Icon, sodass dort nur die normale Hauptnavigation sichtbar ist; das Hamburger-Menü bleibt für Mobile/Tablet erhalten.
11. Helle die CSS-Variable `--faint` (aktuell `#727990`) geringfügig auf (z. B. auf `#7d84a0`), sodass sie auf allen drei Hintergrundfarben (`#07080c`, `#0c0e16`, `#12151f`) mindestens 4.5:1 Kontrast erreicht.
12. Entferne den Header `access-control-allow-origin: *` von normalen HTML-Seiten-Responses (Cloudflare Pages `_headers`-Datei oder Konfiguration prüfen) und beschränke ihn, falls überhaupt nötig, nur auf tatsächliche API-Routen.

## Phase 2 — Accessibility & SEO-Substanz

13. Ergänze beschreibende `alt`-Texte für alle Bilder auf `/work/nexus/`, die aktuell `alt=""` haben (18 von 19 Bildern betroffen), sowie für die 33 von 36 Bildern auf der Startseite mit `alt=""`. Orientiere dich am Qualitätsniveau der bereits guten Alt-Texte auf `/work/mina/`. Beschreibe den tatsächlichen Bildinhalt (z. B. "NEXUS Store-Verwaltung: Übersicht über 22 Themes in der Installer-Oberfläche"), nicht generische Platzhalter.
14. Baue die Formular-Fehlerbehandlung auf `/contact/` so um, dass jedes invalide Feld eine eigene, spezifische Fehlermeldung per `aria-describedby` zugeordnet bekommt, zusätzlich zur bestehenden Sammelmeldung im `role="alert"`-Bereich.
15. Setze bei der `IntersectionObserver`-Konfiguration für die scroll-getriggerten `data-reveal`-Elemente (z. B. in der Nexus-Galerie) die `rootMargin` großzügiger (z. B. `"200% 0px"`), damit Inhalte früher vorab geladen werden und bei schnellem Scrollen oder automatisierten Tools nicht leer bleiben.
16. Ergänze in der Sitemap-Generierung ein `<lastmod>`-Feld pro URL, automatisch befüllt mit dem Build- oder letzten Content-Änderungszeitpunkt.

## Phase 3 — Content (bitte NICHT automatisch erfinden — nur Struktur vorbereiten)

17. Baue für die Case Study `/work/nexus/` die Textstruktur von einer reinen Feature-Liste zu einem Problem→Prozess→Outcome-Format um. Da echte Kennzahlen von Dennis stammen müssen, lege Platzhalter-Abschnitte mit TODO-Kommentaren an (z. B. `<!-- TODO: echte Kennzahl einfügen, z.B. Anzahl Installationen, Zeitersparnis, Fehlerquote vorher/nachher -->`), damit er sie inhaltlich befüllen kann. Wiederhole die gleiche Struktur für `/work/riftcast/` und `/work/berry/`.
18. Baue eine "Trust-Leiste"-Komponente (einfache Logo- oder Text-Reihe mit Firmennamen: Floordirekt, performio GmbH, cyberWear, Decathlon) und platziere sie prominent auf der Startseite oder `/about/`.

## Phase 4 — Strategischer Rebuild (nur wenn Zeit reicht, größerer Umbau)

19. Baue die Zweisprachigkeit von client-seitigem `display:none`-Umschalten auf echte, separat crawlbare Routen um: lege `src/pages/en/` (oder das Astro-i18n-Feature, falls im Projekt schon konfigurierbar) an, dupliziere die Seitenstruktur, und ergänze in jedem `<head>` `hreflang="de"`, `hreflang="en"` und `hreflang="x-default"` Alternate-Links zueinander. Erweitere die Sitemap-Generierung um beide Sprachpfade. Dies ist ein größerer strukturverändernder Eingriff — lege dafür einen eigenen Branch an und beschreibe die Trade-offs (Wartungsaufwand pro neuem Case-Study) im PR.

## Wichtige Leitplanken

- Ändere nichts an den bereits guten Security-Headern (HSTS, CSP-Grundgerüst, Permissions-Policy) außer den explizit genannten Punkten.
- Behalte die bestehende `prefers-reduced-motion`-Unterstützung und alle `:focus-visible`-Styles unverändert bei — diese sind laut Audit vorbildlich.
- Erfinde keine Kennzahlen oder Firmendaten selbst — markiere alles, was echte Eingaben von Dennis braucht, klar mit TODO-Kommentaren.
- Teste nach jeder Phase mindestens: Seite lädt korrekt, Kontaktformular sendet (mit UND ohne JS aktiviert), Lighthouse-Schnelltest zeigt keine neuen Regressionen.
