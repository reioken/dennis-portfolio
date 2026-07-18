# Dennis Portfolio

Persönliche Portfolio-Website von **Dennis Bierreth Fernandez** — Hybrid Designer + Builder, Design-DNA aus NEXUS Liquid Glass.

## Stack

- Astro 5 + React islands
- Tailwind CSS v4 + Design Tokens (`src/styles/tokens.css`)
- MDX Content Collections (`src/content/work`)
- Motion (Framer) für Nav / Hero / Cards
- Deploy-Ziel: Cloudflare Pages

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Deploy (Cloudflare Pages)

**Live:** https://dennis-portfolio-87g.pages.dev

```bash
npm run build
npx wrangler pages deploy dist --project-name=dennis-portfolio --commit-dirty=true
```

## Struktur

- `src/pages` — Routen (Home, Work, About, Lab, Contact, Legal)
- `src/content/work` — Case Studies (MDX)
- `src/components` — Glass Nav, Hero, Cards, Command Palette
- `public/media` — kuratierte Screenshots
- `public/cv` — CV 2026 (Markdown)
