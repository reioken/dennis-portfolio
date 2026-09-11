# Safeplate — Portfolio-Handoff

**Stand:** 2026-08-04 · App **0.53.0** · Gebaut und allein von Dennis Bierreth  
**Zweck dieses Ordners:** Material für die Aufnahme auf dennisbf.design — **ohne** Deploy, **ohne** Portfolio-Änderung.

---

## 1. Kurzprofil

| | |
|---|---|
| **Name** | Safeplate |
| **Ein Satz** | Offline-first Android-App, die Rezepte und Lebensmittel gegen selbst gewählte Ernährungseinschränkungen einordnet — ohne Diagnose, ohne „sicher für dich“. |
| **Problem** | Mit Allergie/OAS, FODMAP/Reizdarm oder EoE ist „was kann ich jetzt essen?“ teuer im Alltag: Zubereitung ändert die Lage, Listen lügen, Restaurant und Reise brauchen andere Hilfen als ein Kalorien-Tracker. |
| **Für wen** | Menschen mit krankheitsbedingten oder ärztlich empfohlenen Ernährungseinschränkungen; deutschsprachig. |
| **Nicht** | Medizinprodukt, Trigger-Finder, Diät-Coach, Streak-App. |

**Zweckbestimmung (fest, unveränderlich):** Informations- und Rezeptanwendung zur Alltagsorganisation bei Ernährungseinschränkungen. Keine Diagnose, keine Therapie, keine Sicherheitsbewertung von Lebensmitteln, kein Ersatz für fachliche Beratung. Regel: **Etikett schlägt App. Immer.**

---

## 2. Was das Produkt kann (funktionierend)

Getestet am Emulator mit Release-APK `0.53.0` (lokale Install, leeres Profil nach Onboarding).

### Kern
- **Constraint-Engine on-device:** Rezepte und Zubereitungszustände gegen Profil (Ausschlüsse, Molekül-Toleranzen, FODMAP-Dosen, Textur, Soft-Flags).
- **Verdikte mit Form + Farbe + Evidenz:** `passt` / `je_nach` / `passt_nicht` / `ungeklaert` / `etikett_pruefen` — keine Ampel-Eskalation.
- **Transformationsvorschläge:** Kochen, Schälen, Portion, Technik — damit Gerichte nutzbar bleiben statt zu verschwinden.
- **Nie leere Suche:** Relaxationen benennen, was blockiert.
- **Anaphylaxie-Modus:** keine „grün“-Aussagen, nur Etikett-Hinweise.

### Alltag
- Start mit tageszeitabhängigen Vorschlägen + Geschmacksumordnung (Like / Dislike / Novelty).
- Kategorien / Slots, Wochenplan (deterministisch).
- Lebensmittelliste mit Vergleich der Zubereitungszustände.
- Rezeptdetail: Verdikt, Nährwerte (wenn vorhanden), Zutaten, Schritte, Haushalts-/Vorkoch-Hinweise, Varianten.
- Intake-Tagebuch („Heute gegessen“) ohne Zwang und ohne Streak.
- Tageseintrag (ein Wert/Geste), Beobachtungen nebeneinander **ohne** Korrelation.
- Reisekarte (mehrsprachig, offline), Restaurant-Hilfe (Fragen an die Küche, **kein** Gerichtsurteil).
- Einkauf, Vorrat, „zurückgewonnen“, Einstellungen, Consent, Export/Löschen, About.

### Datenbestand (Validator)
142 Lebensmittel · 500 Zubereitungszustände · 1359 Gerichte · 150 Transformationsregeln · 101 Moleküle · 184 Quellen · 13 Reisekarten-Sprachen.

---

## 3. Gestalterisch interessant

- **Zwei Skins als Baupläne, nicht nur Paletten:** Glas (Frost, schwebendes Dock) und Picturebook (dunkel, illustriert, Glow-Nav). Umschalten: Mehr → Einstellungen → Darstellung.
- **Glas-UI:** Blur-Dock, refraktierte Kanten, Gradient-Ground — auf Android mit `BlurTargetView` (nur die Leiste blurrt bewusst).
- **Companion:** wiederkehrendes Gesicht; Stimmung/Animation; Onboarding und leere Zustände.
- **Verdikt-Silhouetten** statt Ampel (ADR-010).
- **Tagesskala:** links belastet, rechts beschwerdefrei — Orb (Glas) / Slider (Picturebook).
- **Keine Gamification:** keine Streaks, keine sichtbaren Health-Scores, Lücken im Tagebuch sind erlaubt.
- **Picturebook:** zutatentreue Illustrationen, Bildkarten-Raster, Donut-/Ring-Makros.

---

## 4. Technisch interessant

| Schicht | Inhalt |
|---|---|
| **Monorepo** | `apps/mobile` (Expo RN 0.86 / Expo 57), `packages/domain` (reine TS-Engine, keine I/O), `packages/data` (kuratierter Bundle + Validator), `apps/api` (optional Content, kein User-Health) |
| **Offline-first** | Content-Bundle im Binary; Engine lokal; AsyncStorage; Release-APK **ohne INTERNET-Permission** |
| **Navigation** | Hand-rolled Tabs + Stacks (kein react-navigation) — bewusste Abhängigkeitsarmut |
| **Doktrin als Code** | `firewall.test.ts`, `texts.test.ts` (Sperrliste), Canary-Szenarien, ADR-010–021 |
| **Geschmack** | `tasteScore` sortiert nur innerhalb gleicher Verdict-Stufe (ADR-021) |
| **Qualitätstor** | `npm run check` = validate + typecheck + Tests |

---

## 5. Tech-Stack

- TypeScript, Node ≥ 22  
- React 19 / React Native / Expo  
- AsyncStorage, expo-blur, expo-linear-gradient, react-native-svg, Inter  
- Kein Analytics-SDK, kein Cloud-ML für Empfehlungen  

---

## 6. Entwicklungsstand

| | |
|---|---|
| **Version** | 0.53.0 (`apps/mobile/app.json`) |
| **Reife** | Funktionsbreite App mit großem Datenbestand; privat nutzbar |
| **Produktion klinisch** | **Nicht** durch Experten-Review freigegeben. `PERSONAL_PRODUCTION_ACCEPTANCE` stempelt das Bundle für den Eigentümer — das ist **kein** fachliches Review |
| **Tests** | 194 Domain/Data/Mobile-Tests grün beim letzten `npm run check` (Stand dieser Sitzung) |

### Sichtbar unfertig / Lücken (ehrlich)
- Viele Nährwert-Warnungen (`NUTRI-MISSING`); Nährwerte ohne fachliches Review.
- FODMAP-Lücken → mehr `ungeklaert` als ideal (`docs/FODMAP-GAP.md`).
- H-008 / H-009 in `RISKS.md` offen (Literatur-Audit ≠ klinische Freigabe).
- Consent-Zwecke „Backup“ / „Forschung“: UI vorhanden, **nicht implementiert**.
- Feature-Flags aus: Barcode, Community, RAG-Chat, …
- Dev-Tools-Flag in Builds für Entwickler — vor echten Nutzertests aus.
- Day-Moment (Picturebook/Lavendel-Overlay): in Stichprobe **sehr geringer Textkontrast** auf Glas-Karten — für Portfolio eher Glas-Home/Rezept nutzen oder nachpolieren.
- Essbar-Tab: in dieser Capture-Session vom Day-Moment überdeckt; Funktion existiert (virtualisierte Liste + Suche), sauberer Screenshot fehlt in `selected/`.

### Bewusst nicht gebaut (Kern-App)
Trigger-Analyse, Symptom→Lebensmittel-Auswertung, FODMAP-/EoE-Protokoll-Engine, Nährstoffmangel-Analyse, Streaks.

---

## 7. Was öffentlich nicht gezeigt werden sollte

- `packages/data/src/owner-acceptance.ts` (persönliche Freigabe / Name)  
- `docs/DPIA-DRAFT.md`, `RISKS.md` (interne Risiko-/DPIA-Arbeit)  
- Keystore / `gradle.properties` / Upload-Signatur-Secrets  
- Exportierte Nutzerdaten, echte Symptom-/Intake-Logs  
- Private Repo-Hinweise, Drive-APK-Pfade aus Übergabe-Docs  
- Dev-Screen mit Persona-Health-Daten in Screenshots für Live-Nutzer  
- Store-/Website-Texte ohne Marketing-Review-Gate (`docs/MARKETING-REVIEW-GATE.md`)

**Screenshots hier:** Demo-Profil ohne harte Ausschlüsse, keine Secrets, keine echten Personendaten. Emulator-Statusleiste zeigt Systemuhren — unkritisch.

---

## 8. Ansichtenliste (portfolio-relevant)

### Overlays
| ID | Ansicht | Screenshot |
|---|---|---|
| onboarding | Willkommen + Zweckbestimmung (nicht überspringbar) | `01-…` |
| onboarding | Symptome (Erfahrung, keine Diagnose) | `02-…` |
| onboarding | Apfel-Fragen / Ausschlüsse / Kochen | `03`–`05` |
| daymoment | Tagesmoment „Noch wach“ / Slot-Vorschläge | `16-day-moment` |

### Tabs
| Tab | Ansicht | Screenshot |
|---|---|---|
| Start | Home: Begrüßung + Vorschläge + Planen | `06` / `07-home` |
| Start | Rezeptdetail + Zutaten/Schritte | `07`–`08` |
| Essen | Heute gegessen (leerer Zustand, bewusst) | `09-track-empty` |
| Mehr | Hub | `10-more-hub` |
| Mehr | Reisekarte (leer ohne Ausschlüsse) | `11-…` |
| Mehr | Restaurant-Hilfe | `12-…` |
| Mehr | Einstellungen | `13-…` |
| Mehr | Über Safeplate | `14-…` |
| — | Picturebook: Rezeptdetail | `15-…` |

### Vorhanden, aber nicht in `selected/` (oder Capture unsauber)
- Essbar / Food-Detail  
- Tag (Day-Orb) — ggf. mit Track verwechselt in Rohserie; Day-Orb ist eigener Screen  
- Wochenplan, Kategorien/Slots (Roh: `curated-week`/`curated-slots` zeigten Day-Moment)  
- Ziele, Intake hinzufügen, Beobachtungen, Einkauf, Vorrat, Zurückgewonnen, Consent, Dev  

### Nicht für Portfolio
- Dev-Personas, reine Lade-/Fehlerseiten, Debug  

---

## 9. Screenshots

### Ordner
```
portfolio-handoff/
  HANDOFF.md                 ← diese Datei
  screenshots/
    mobile/                  ← Roh-Captures Emulator 1080×2340
    selected/
      mobile-390x844/        ← Portfolio-Export Mobile
      desktop-1440x900/      ← Phone auf 1440×900 Canvas (App ist kein Desktop-UI)
  _export_shots.py           ← Re-Export-Skript
```

### Desktop-Hinweis
Safeplate ist eine **Android-App**, kein Web-Frontend. „Desktop“-Dateien sind gerahmte Phone-Screens auf 1440×900 — kein separates Desktop-Layout. Expo Web ist im Projekt **nicht** als Ziel konfiguriert.

### Mobile-Exports (390×844)
Siehe `screenshots/selected/mobile-390x844/` — 16 Dateien (`01`–`16`).

### Aufnahmebedingungen
- Emulator `emulator-5554`, APK Release 0.53.0  
- Skin überwiegend **Glas**; `15-picturebook-recipe` = Picturebook  
- Onboarding ohne harte Ausschlüsse → Reisekarte bewusst leer  
- Keine kostenpflichtigen APIs, keine Produktionsdaten  

---

## 10. Formulierungshilfe (knapp, ohne Marketing)

**Brauchbar:**
- „Rezepte und Zubereitungen gegen deine Vorgaben einordnen.“
- „Offline. Etikett schlägt App.“
- „Geschmack sortiert um — Verträglichkeit entscheidet.“

**Verboten (auch auf der Website):**
- „sicher für dich“, „findet Trigger“, „warnt vor gefährlichen Produkten“, Diät-als-Therapie-Sprache.

Jeder öffentliche Text muss durch das Marketing-Review-Gate.

---

## 11. Beobachtungen beim Test (nicht behoben)

1. Day-Moment-Overlay: Text auf hellen Glas-Karten teilweise **kaum lesbar** (Kontrast).  
2. Nach `wm size reset` fiel der Emulator kurz auf den Launcher — Capture-Pipeline sensibel.  
3. Reisekarte ohne Ausschlüsse zeigt leeren Zustand korrekt — für „gefüllte“ Karte Profil mit z. B. Gluten/Milch setzen.  
4. Bio-Skin ist aus dem Code entfernt; nur Glas + Picturebook.

---

## 12. Nächste Schritte für dennisbf.design (nur mit deiner Freigabe)

1. Case Study aus Abschnitt 1–4 kürzen (1 Scroll, kein Team-Jargon).  
2. 4–8 Key Visuals aus `selected/` wählen (Empfehlung: Welcome, Home, Rezept, Track-leer, Mehr, Picturebook-Rezept).  
3. Marketing-Review gegen Sperrliste.  
4. **Nicht** deployen, bis du ausdrücklich zustimmst.
