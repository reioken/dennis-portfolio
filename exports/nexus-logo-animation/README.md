# NEXUS Logo Animation

Portable Version der NEXUS-Logoanimation aus dem Portfolio. Keine Dependencies und kein Framework erforderlich.

## Dateien

- `nexus-logo.svg` — originales animiertes SVG mit Facetten, Lichtläufen und Sparkles
- `nexus-logo.css` — Aura, Float, Partikel, Glints und Hover-Intensivierung
- `nexus-logo.js` — kleine Web Component für Markup, Interaktion und Reduced Motion
- `index.html` — direkt nutzbare Demo

## Einbau

Kopiere den gesamten Ordner in dein anderes Projekt und binde CSS und JavaScript ein:

```html
<link rel="stylesheet" href="/pfad/nexus-logo.css" />
<script type="module" src="/pfad/nexus-logo.js"></script>

<nexus-logo
  src="/pfad/nexus-logo.svg"
  label="NEXUS"
  size="320"
></nexus-logo>
```

Das Logo läuft standardmäßig ruhig. Hover oder Tastaturfokus aktiviert automatisch die stärkere Animation.

## Optionen

```html
<!-- Dauerhaft intensive Animation -->
<nexus-logo src="./nexus-logo.svg" active></nexus-logo>

<!-- Responsive Größe -->
<nexus-logo src="./nexus-logo.svg" size="min(70vw, 420px)"></nexus-logo>
```

Farben können am Element überschrieben werden:

```css
nexus-logo {
  --nx-violet: #ac8bfd;
  --nx-blue: #4a82fe;
  --nx-ice: #dcebff;
}
```

## Nur das animierte SVG

Wenn du Aura, Partikel und Hover-Modus nicht brauchst, reicht auch:

```html
<img src="/pfad/nexus-logo.svg" alt="NEXUS" width="320" height="320" />
```

Die internen Lichtläufe und Sparkles des SVGs bleiben dabei animiert.

## Hinweise

- Funktioniert in aktuellen Chrome-, Edge-, Firefox- und Safari-Versionen.
- `prefers-reduced-motion` stoppt die äußeren CSS-Effekte.
- Die Web Component funktioniert auch innerhalb von Astro, React, Vue und Svelte.
