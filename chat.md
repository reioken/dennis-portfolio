Ich schaue mir die Seite gründlich an — zuerst die Codebasis, dann starte ich den Dev-Server und teste die Seite im Browser (Desktop + Mobile), prüfe Konsole, Netzwerk, Accessibility und Performance. Am Ende bekommst du einen ausführlichen Plan.


Ran 2 commands, found files, read 2 files
Der Dev-Server läuft. Ich öffne jetzt die Seite im Browser und lese parallel die wichtigsten Quelldateien.


Loading
Projekte — Dennis Bierreth-Fernandez
dennisbf.design · Opened in Browser

Read 29 files, ran 13 commands, searched code, created a file, used 42 tools
Sent
Der komplette Analyse- und Verbesserungsplan als Datei im Repo.


MD
PLAN.md

12.7 KB

Fertig — ich habe die komplette Seite analysiert (Code-Review aller Seiten und Komponenten, Produktions-Build, Live-Tests von Formular, Filtern, Lightbox und Mobile-Viewport) und den ausführlichen Plan als PLAN.md ins Repo gelegt. Hier das Wichtigste:

Gesamtbild
Die Seite ist technisch deutlich über Portfolio-Durchschnitt: sauberer Astro-7-Build (16 Seiten, fehlerfrei), konsequentes Token-Design-System, vorbildliches Reduced-Motion-Handling, starke Security-Header (CSP, HSTS), durchdachte Kontakt-Pipeline mit Honeypot und serverseitiger Validierung, alle Bilder mit alt-Text, kein einziger unbenannter Button, kein horizontaler Overflow auf Mobile. Solide Grundlage — die Probleme liegen in Details.

Die wichtigsten Funde (Prio A)
Keine 404-Seite — Cloudflare Pages zeigt seine nackte Standard-Fehlerseite.
Sitemap und robots.txt fehlen komplett — einfachster SEO-Fix überhaupt.
~4,3 MB tote Assets werden deployed (von 20 MB gesamt): ein 2,3-MB-PNG, dessen WebP-Version längst benutzt wird, eine _preview.png, ein ungenutztes 900-KB-Mina-Bild und eine Logo-Quelldatei.
Formular-Bug (live getestet): Eine ungültige E-Mail-Adresse passiert die Client-Validierung, der Server lehnt mit invalid_email ab — aber der Nutzer sieht nur „Senden fehlgeschlagen, versuch's nochmal“. Wer sich vertippt, versucht es also endlos mit derselben falschen Adresse.
Impressum ist veraltet: verweist auf § 5 TMG (heute DDG) und § 55 RStV (seit 2020 durch MStV ersetzt), Adresse ohne Straße; die Datenschutzerklärung erwähnt das Kontaktformular (Cloudflare Worker) gar nicht.
prefetch: true ist wirkungslos — nirgendwo ein data-astro-prefetch-Attribut; prefetchAll: true wäre ein Einzeiler.
Weitere relevante Punkte
Kontrast-Fail: --faint (#52586c) auf dem dunklen Hintergrund erreicht nur ~2,8:1 bei winzigem Footer-Text (WCAG AA braucht 4,5:1).
Lightbox ohne Fokus-Management — Fokus bleibt hinter dem Dialog, kein Trap, kein Return.
GSAP wird nur für eine einzige Animation geladen (About-Portrait), obwohl Motion eh gebündelt ist — unnötige ~25 KB.
Mina-Case ist auf der Startseite unauffindbar (weder featured noch archive-Tag) — ausgerechnet der klassische UX-Case mit Research und Usability-Tests.
Kein srcset/AVIF — die größten Performance-Reserven auf Mobile.
Bilingual-Strategie: EN existiert nur client-seitig per CSS-Toggle, Google indexiert nur Deutsch — im Plan als strategische Entscheidung mit Optionen beschrieben.
Der Plan enthält 30+ Punkte mit Dateipfaden, Aufwandsschätzungen und einer Sprint-Reihenfolge (Sprint 1 „Quick Wins“ ist ein halber Tag und deckt fast alle Prio-A-Punkte ab).

Zwei Hinweise: Das Browser-Panel dieser Session hatte ein eingefrorenes requestAnimationFrame — Screenshots und Animationstests waren dadurch unmöglich; ein scheinbarer Lightbox-Hänger war ein Artefakt davon, der Code ist korrekt. Und der Dev-Server läuft noch im Hintergrund (astro dev stop zum Beenden). Sag Bescheid, wenn ich Sprint 1 direkt umsetzen soll.

Ja alles umsetzen

Alles klar — ich setze den Plan um. Ich arbeite in Sprints (Quick Wins → Formular/A11y → Performance) und verifiziere am Ende mit Build + DOM-Tests. Punkte, die deine Eingabe brauchen (Straße im Impressum) oder Dashboard-Zugriff (Rate-Limit), flagge ich.


Ran 2 commands, edited 11 files, created 3 files, used 8 tools
Jetzt der Fokus-Trap im Lightbox-Dialog selbst:


Edited 10 files, created 2 files, searched code, read 2 files, ran a command, used 2 tools
Jetzt die drei Reveal-Verwendungen in about.astro ersetzen:


Edited 6 files, read 2 files, ran 9 commands, searched code, created a file, used 19 tools
Fertig — alle umsetzbaren Punkte aus dem Plan sind implementiert, gebaut und getestet. Der Build ist sauber (17 Seiten inkl. neuer 404, Sitemap generiert), und das Deploy-Paket ist von 20 MB auf 17 MB geschrumpft.

Umgesetzt und live verifiziert:

Formular: Ungültige E-Mail wird jetzt client-seitig abgefangen mit eigener Meldung („Bitte prüf die E-Mail-Adresse…"), das Feld bekommt aria-invalid + roten Rahmen, der Fokus springt aufs Feld, und die Meldung verschwindet beim Weitertippen — alles im Browser durchgespielt.
Lightbox: Fokus wandert beim Öffnen in den Dialog, Tab ist im Dialog gefangen, beim Schließen kehrt der Fokus zum Vorschaubild zurück — ebenfalls live getestet.
Work-Filter: Zustand in der URL (/work?filter=archive ist jetzt teilbar), korrekte aria-pressed-Semantik statt falscher Tabs, Ergebnis-Ansage für Screenreader, deutsche Tag-Labels („Archiv" statt „archive"), Mina erscheint jetzt im Archiv.
Quick Wins: 404-Seite, robots.txt + Sitemap, 4,3 MB tote Assets gelöscht, Impressum auf DDG/MStV aktualisiert, Datenschutz um den Kontaktformular-Abschnitt ergänzt, Prefetch aktiviert (war wirkungslos konfiguriert), Font-Preload, Kontrast von --faint auf AA-Niveau, Tap-Targets vergrößert.
Performance: GSAP komplett entfernt (Portrait-Animation läuft jetzt über das eh vorhandene Motion), 40 kleine @sm-Bildvarianten generiert (neues Script, npm run thumbs) und per srcset in der Hero-Collage eingebunden — die Startseite lädt auf normalen Displays jetzt die 720px-Varianten statt der vollen Shots.
Reveal-Animationen laufen jetzt über CSS + IntersectionObserver statt React/Motion: Inhalte sind ohne JS sichtbar (vorher SSR-bedingt opacity:0), und nebenbei war das alte Markup invalides HTML (ol > div > li) — auch behoben.
Interessanter Fund beim Testen: Mein geplanter Umbau des Kontaktformulars auf client:visible hätte einen echten Bug eingeführt — vor der Hydration submittet ein nacktes <form> nativ per GET und schreibt die Felddaten in die URL. Im Test reproduziert, deshalb bleibt es bewusst bei client:load (mit Kommentar im Code).

Was noch offen ist:

Deine Eingabe nötig: Straße + Hausnummer für das Impressum (legalAddress in site.ts:11) — ohne die ist die Anschrift formal nicht ladungsfähig.
Bewusst zurückgestellt: echtes i18n-Routing (/en/-Pfade), konkrete Zahlen für die Case-Outcomes, Turnstile (erst bei Spam) und das WAF-Rate-Limit (10 Minuten im Cloudflare-Dashboard, kein Code).
PLAN.md hat jetzt oben einen Umsetzungsstatus-Block. Die Änderungen liegen uncommitted im Working Tree (30 geänderte Dateien + die neuen @sm-Varianten) — sag Bescheid, wenn ich committen soll. Der Dev-Server läuft noch (astro dev stop zum Beenden).

mach alle änderungen auf die aktuelle seite bei dennisbf.design

Ich deploye die Änderungen auf dennisbf.design. Zuerst kurz die Deploy-Doku und die Wrangler-Authentifizierung prüfen:


Read a file, ran 5 commands
Alles ist live auf dennisbf.design. Zusammenfassung:

Deployment: Build (17 Seiten) + Upload auf das Cloudflare-Pages-Projekt dennis-portfolio — die Produktions-Domain www.dennisbf.design zieht automatisch mit. Den Kontakt-Worker habe ich nicht angefasst, der war unverändert.

Live verifiziert:

robots.txt und sitemap-index.xml werden ausgeliefert (Status 200, 16 URLs)
Die neue 404-Seite kommt mit korrektem Status 404 und deinem Design statt der nackten Cloudflare-Fehlerseite
Die Hero-Collage lädt die neuen @sm-Bildvarianten per srcset
Font-Preload ist im Head
Kontakt-Pipeline funktioniert: Ein Test-POST mit ungültiger E-Mail wird vom Worker sauber mit 400 invalid_email abgelehnt (dabei wird keine Mail verschickt — dein Postfach bleibt sauber)
Zwei offene Punkte:

Impressum: In site.ts:11 fehlt weiterhin Straße + Hausnummer (legalAddress ist nur „68542 Heddesheim"). Sobald du mir die Adresse gibst, trage ich sie ein und deploye nach — oder du machst es selbst und führst npm run deploy aus.
Git: Die Änderungen (30 Dateien + neue Bildvarianten + PLAN.md) sind live, aber noch nicht committet. Soll ich sie committen und pushen?
mina zu current stand machen

Edited
mina.mdx
+2
-2
Jetzt noch den Beschreibungstext der Sektion anpassen (der zählt die Projekte auf) und deployen:


Edited a file, ran a command
Mina ist im Build auf der Startseite. Jetzt live deployen:


Ran 4 commands
Erledigt — Mina ist jetzt live unter „Aktueller Stand" auf dennisbf.design.

Was ich geändert habe:

mina.mdx: featured: true — Mina erscheint jetzt als fünfte Karte in der Featured-Sektion (nach NEXUS als Lead-Karte im 2×2-Grid mit Berry, Riftcast und Floordirekt Studio). Das archive-Tag habe ich dafür wieder entfernt, damit sie nicht doppelt auftaucht (der „Craft"-Streifen unten hat wieder seine ursprünglichen 3 Karten).
Sektionstext angepasst: „NEXUS, Berry, Riftcast, Floordirekt Studio und die Mina Case Study — live Screenshots aus den Produkten" (DE + EN), damit die Aufzählung stimmt.
Live verifiziert: Die Mina-Karte rendert auf der Startseite mit dem hellen Logo-Panel (wegen des dunklen Mina-Logos), der neue Text ist drin, und der Case-Link funktioniert.

Kleiner Hinweis wie gehabt: Alle Änderungen laufen weiter uncommitted — falls du einen sauberen Stand willst, committe ich gern alles zusammen.