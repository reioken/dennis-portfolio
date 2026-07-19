# Anleitung: dennisbf.design — was du selbst machen kannst

Stand: EN-Version live (https://www.dennisbf.design/en/), Web Analytics
deaktiviert, **Auto-Deploy läuft** (jeder `git push` deployt selbstständig).
Einfach von oben nach unten abarbeiten.

---

## 1. Echte Kennzahlen in die Cases schreiben (wann du willst)

In drei Dateien stehen `TODO`-Kommentare, wo nur du die Zahlen kennst:

| Datei | Gesucht z. B. |
|---|---|
| `src/content/work/nexus.mdx` | Installationen, unterstützte Stores/Spiele, Startzeit |
| `src/content/work/riftcast.mdx` | Stream-Latenz, Auflösung/FPS |
| `src/content/work/berry.mdx` | Karten in der Sammlung, APK-Releases |

So gehst du vor:
1. Datei öffnen, den Satz bei **Ergebnis** um deine Zahl ergänzen
2. Den `{/* TODO: … */}`-Kommentar löschen
3. Deployen (siehe Punkt 3)

**Wichtig:** Nichts erfinden — lieber keine Zahl als eine ausgedachte.

---

## 2. Neue Case Study anlegen (Schritt für Schritt)

1. Screenshots nach `public/media/<projekt>/shots/` legen (WebP)
2. `npm run thumbs` ausführen (erzeugt kleine Varianten fürs schnelle Laden)
3. Eine bestehende Datei in `src/content/work/` kopieren (z. B. `berry.mdx`)
   und anpassen: `title`, `summary`, `cover`, `gallery` + `galleryAlts`
   (kurze Bildbeschreibungen), `tags`, `order`
4. Soll sie auf die Startseite? → `featured: true`
5. Deployen (Punkt 3) — die englische `/en/`-Route entsteht **automatisch**

Nur wenn die Seite einen eigenen englischen Beschreibungstext bekommen soll:
in `scripts/en-routes.mjs` bei `META_EN` einen Eintrag ergänzen (sonst bleibt
dort der deutsche Text — kein Beinbruch).

---

## 3. Deployen

**Weg A (Standard):** committen und pushen — GitHub deployt automatisch
```
git add -A
git commit -m "Kurz sagen was du geändert hast"
git push
```

**Weg B (Notnagel, direkt vom Rechner):**
```
npm run deploy
```

Danach immer kurz https://www.dennisbf.design aufrufen und durchklicken.

---

## 4. Einmalige Qualitäts-Checks (je ~2 Minuten, kein Konto nötig)

| Tool | Link | Was du tust |
|---|---|---|
| PageSpeed Insights | https://pagespeed.web.dev | URL eingeben → Werte notieren (Ziel: alles grün) |
| axe DevTools | Browser-Erweiterung installieren | Auf der Seite F12 → axe-Tab → „Scan" |
| Kaputte Links | https://validator.w3.org/checklink | URL eingeben, prüfen lassen |

Wenn irgendwo Rot auftaucht: Screenshot machen und mir geben.

---

## 5. Wo liegt was? (Spickzettel)

| Was | Datei |
|---|---|
| Texte Startseite/Nav/Buttons (DE+EN) | `src/lib/i18n.ts` |
| Deine Daten: Skills, Lebenslauf, Status-Zeile | `src/lib/site.ts` |
| Case Studies (Inhalt + Bilder-Listen) | `src/content/work/*.mdx` |
| Farben & Design-Tokens | `src/styles/tokens.css` |
| Impressum / Datenschutz | `src/pages/impressum.astro`, `privacy.astro` |
| Englische Titles/Descriptions | `scripts/en-routes.mjs` (`META_EN`) |
