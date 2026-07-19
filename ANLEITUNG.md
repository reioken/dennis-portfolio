# Anleitung: dennisbf.design — was du selbst machen kannst

Stand: EN-Version ist gemerged und live (https://www.dennisbf.design/en/),
Web Analytics ist deaktiviert. Einfach von oben nach unten abarbeiten.

---

## 1. Auto-Deploy reparieren (einmalig, ~5 Minuten)

Aktuell schlägt der automatische Deploy bei jedem `git push` fehl, weil im
GitHub-Repo die Cloudflare-Zugangsdaten fehlen. Bis das gemacht ist, muss
nach jedem Push zusätzlich `npm run deploy` laufen.

1. **Cloudflare-Token erstellen:**
   https://dash.cloudflare.com/profile/api-tokens → **Create Token** →
   unten bei „Custom token" auf **Get started** →
   Name z. B. `github-pages-deploy`, Berechtigung:
   **Account → Cloudflare Pages → Edit** → Continue → Create Token →
   den angezeigten Token **kopieren** (wird nur einmal angezeigt)
2. **In GitHub eintragen:**
   https://github.com/reioken/dennis-portfolio/settings/secrets/actions →
   **New repository secret**, zwei Stück:
   - Name: `CLOUDFLARE_API_TOKEN` → Wert: der kopierte Token
   - Name: `CLOUDFLARE_ACCOUNT_ID` → Wert: `bd0f3043cb8b0eb6dfab9c1131fe8e87`
3. Fertig. Ab jetzt deployt **jeder `git push` automatisch** — testen kannst
   du es unter https://github.com/reioken/dennis-portfolio/actions
   (der neueste Lauf sollte grün werden).

---

## 2. Echte Kennzahlen in die Cases schreiben (wann du willst)

In drei Dateien stehen `TODO`-Kommentare, wo nur du die Zahlen kennst:

| Datei | Gesucht z. B. |
|---|---|
| `src/content/work/nexus.mdx` | Installationen, unterstützte Stores/Spiele, Startzeit |
| `src/content/work/riftcast.mdx` | Stream-Latenz, Auflösung/FPS |
| `src/content/work/berry.mdx` | Karten in der Sammlung, APK-Releases |

So gehst du vor:
1. Datei öffnen, den Satz bei **Ergebnis** um deine Zahl ergänzen
2. Den `{/* TODO: … */}`-Kommentar löschen
3. Deployen (siehe Punkt 4)

**Wichtig:** Nichts erfinden — lieber keine Zahl als eine ausgedachte.

---

## 3. Neue Case Study anlegen (Schritt für Schritt)

1. Screenshots nach `public/media/<projekt>/shots/` legen (WebP)
2. `npm run thumbs` ausführen (erzeugt kleine Varianten fürs schnelle Laden)
3. Eine bestehende Datei in `src/content/work/` kopieren (z. B. `berry.mdx`)
   und anpassen: `title`, `summary`, `cover`, `gallery` + `galleryAlts`
   (kurze Bildbeschreibungen), `tags`, `order`
4. Soll sie auf die Startseite? → `featured: true`
5. Deployen (Punkt 4) — die englische `/en/`-Route entsteht **automatisch**

Nur wenn die Seite einen eigenen englischen Beschreibungstext bekommen soll:
in `scripts/en-routes.mjs` bei `META_EN` einen Eintrag ergänzen (sonst bleibt
dort der deutsche Text — kein Beinbruch).

---

## 4. Deployen — zwei Wege

**Weg A (nach Punkt 1 eingerichtet):** committen und pushen, GitHub deployt
```
git add -A
git commit -m "Kurz sagen was du geändert hast"
git push
```

**Weg B (direkt vom Rechner, funktioniert immer):**
```
npm run deploy
```

Danach immer kurz https://www.dennisbf.design aufrufen und durchklicken.

---

## 5. Einmalige Qualitäts-Checks (je ~2 Minuten, kein Konto nötig)

| Tool | Link | Was du tust |
|---|---|---|
| PageSpeed Insights | https://pagespeed.web.dev | URL eingeben → Werte notieren (Ziel: alles grün) |
| axe DevTools | Browser-Erweiterung installieren | Auf der Seite F12 → axe-Tab → „Scan" |
| Kaputte Links | https://validator.w3.org/checklink | URL eingeben, prüfen lassen |

Wenn irgendwo Rot auftaucht: Screenshot machen und mir geben.

---

## 6. Wo liegt was? (Spickzettel)

| Was | Datei |
|---|---|
| Texte Startseite/Nav/Buttons (DE+EN) | `src/lib/i18n.ts` |
| Deine Daten: Skills, Lebenslauf, Status-Zeile | `src/lib/site.ts` |
| Case Studies (Inhalt + Bilder-Listen) | `src/content/work/*.mdx` |
| Farben & Design-Tokens | `src/styles/tokens.css` |
| Impressum / Datenschutz | `src/pages/impressum.astro`, `privacy.astro` |
| Englische Titles/Descriptions | `scripts/en-routes.mjs` (`META_EN`) |
