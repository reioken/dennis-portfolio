# Anleitung: dennisbf.design — was du selbst machen kannst

Einfach von oben nach unten abarbeiten. Alles andere läuft automatisch.

---

## 1. Englische Version live schalten (5 Minuten)

Die englische Version (`/en/…`) liegt fertig getestet in einem Pull Request.

1. Öffne: **https://github.com/reioken/dennis-portfolio/pull/1**
2. Klicke den grünen Button **„Merge pull request"** → **„Confirm merge"**
3. Fertig — GitHub deployt automatisch. Nach ~2 Minuten prüfen:
   - https://www.dennisbf.design/en/ → englische Startseite
   - Der **DE/EN-Schalter** oben rechts wechselt jetzt die URL

---

## 2. Cloudflare Web Analytics ausschalten (2 Minuten)

Behebt die Konsolenfehler aus dem Audit. Geht nur in deinem Dashboard:

1. https://dash.cloudflare.com → **Workers & Pages** → Projekt **dennis-portfolio**
2. Tab **Metrics** (oder **Settings**) → **Web Analytics** → deaktivieren

---

## 3. Echte Kennzahlen in die Cases schreiben (wann du willst)

In drei Dateien stehen `TODO`-Kommentare, wo nur du die Zahlen kennst:

| Datei | Gesucht z. B. |
|---|---|
| `src/content/work/nexus.mdx` | Installationen, unterstützte Stores/Spiele, Startzeit |
| `src/content/work/riftcast.mdx` | Stream-Latenz, Auflösung/FPS |
| `src/content/work/berry.mdx` | Karten in der Sammlung, APK-Releases |

So gehst du vor:
1. Datei öffnen, den Satz bei **Ergebnis** um deine Zahl ergänzen
2. Den `{/* TODO: … */}`-Kommentar löschen
3. Deployen (siehe Punkt 5)

**Wichtig:** Nichts erfinden — lieber keine Zahl als eine ausgedachte.

---

## 4. Neue Case Study anlegen (Schritt für Schritt)

1. Screenshots nach `public/media/<projekt>/shots/` legen (WebP)
2. `npm run thumbs` ausführen (erzeugt kleine Varianten fürs schnelle Laden)
3. Eine bestehende Datei in `src/content/work/` kopieren (z. B. `berry.mdx`)
   und anpassen: `title`, `summary`, `cover`, `gallery` + `galleryAlts`
   (kurze Bildbeschreibungen), `tags`, `order`
4. Soll sie auf die Startseite? → `featured: true`
5. Deployen (Punkt 5) — die englische `/en/`-Route entsteht **automatisch**

Nur wenn die Seite einen eigenen englischen Beschreibungstext bekommen soll:
in `scripts/en-routes.mjs` bei `META_EN` einen Eintrag ergänzen (sonst bleibt
dort der deutsche Text — kein Beinbruch).

---

## 5. Deployen — zwei Wege

**Weg A (empfohlen):** committen und pushen, GitHub deployt automatisch
```
git add -A
git commit -m "Kurz sagen was du geändert hast"
git push
```

**Weg B (direkt vom Rechner):**
```
npm run deploy
```

Danach immer kurz https://www.dennisbf.design aufrufen und durchklicken.

---

## 6. Einmalige Qualitäts-Checks (je ~2 Minuten, kein Konto nötig)

| Tool | Link | Was du tust |
|---|---|---|
| PageSpeed Insights | https://pagespeed.web.dev | URL eingeben → Werte notieren (Ziel: alles grün) |
| axe DevTools | Browser-Erweiterung installieren | Auf der Seite F12 → axe-Tab → „Scan" |
| Kaputte Links | https://validator.w3.org/checklink | URL eingeben, prüfen lassen |

Wenn irgendwo Rot auftaucht: Screenshot machen und mir geben.

---

## 7. Wo liegt was? (Spickzettel)

| Was | Datei |
|---|---|
| Texte Startseite/Nav/Buttons (DE+EN) | `src/lib/i18n.ts` |
| Deine Daten: Skills, Lebenslauf, Status-Zeile | `src/lib/site.ts` |
| Case Studies (Inhalt + Bilder-Listen) | `src/content/work/*.mdx` |
| Farben & Design-Tokens | `src/styles/tokens.css` |
| Impressum / Datenschutz | `src/pages/impressum.astro`, `privacy.astro` |
| Englische Titles/Descriptions | `scripts/en-routes.mjs` (`META_EN`) |

**Noch offen im Impressum:** Straße + Hausnummer fehlen
(`legalAddress` in `src/lib/site.ts`) — kurz eintragen, committen, fertig.
