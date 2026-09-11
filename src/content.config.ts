import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const work = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/work' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    role: z.string(),
    year: z.string(),
    timeline: z.string().optional(),
    stack: z.array(z.string()).default([]),
    outcome: z.string().optional(),
    /* Englische Entsprechungen — fehlt eine, fällt die Seite auf Deutsch zurück */
    titleEn: z.string().optional(),
    summaryEn: z.string().optional(),
    roleEn: z.string().optional(),
    yearEn: z.string().optional(),
    timelineEn: z.string().optional(),
    outcomeEn: z.string().optional(),
    tags: z.array(z.enum(['product', 'design', 'archive', 'lab'])).default([]),
    featured: z.boolean().default(false),
    cover: z.string(),
    /** Beschreibender Alt-Text fürs Cover (Fallback: "<Titel> Cover") */
    coverAlt: z.string().optional(),
    coverAltEn: z.string().optional(),
    /** Logo shown on project cards (preferred over cover) */
    logo: z.string().optional(),
    /** Animated logo — only played on card hover */
    logoLive: z.string().optional(),
    gallery: z.array(z.string()).default([]),
    /** Clean app captures for physical displays; marketing compositions stay in the gallery. */
    hallScreens: z.array(z.string()).optional(),
    /** Beschreibende Alt-Texte, index-parallel zu gallery */
    galleryAlts: z.array(z.string()).optional(),
    galleryAltsEn: z.array(z.string()).optional(),
    /** Long-form case study (sliced PDF/deck) rendered as one continuous document
        instead of a thumbnail gallery. Slices must be listed in reading order. */
    document: z
      .object({
        labelDe: z.string(),
        labelEn: z.string(),
        pages: z.array(z.string()).min(1),
      })
      .optional(),
    /** Optional multi-surface galleries (e.g. Riftcast Host / Phone / Browser) */
    surfaces: z
      .array(
        z.object({
          id: z.string(),
          labelDe: z.string(),
          labelEn: z.string(),
          blurbDe: z.string().optional(),
          blurbEn: z.string().optional(),
          variant: z.enum(['phone', 'desktop']).default('desktop'),
          gallery: z.array(z.string()).min(1),
          /** Beschreibende Alt-Texte, index-parallel zu gallery */
          alts: z.array(z.string()).optional(),
          altsEn: z.array(z.string()).optional(),
        }),
      )
      .optional(),
    externalUrl: z.string().url().optional(),
    /** Standalone local product page, separate from the case study. */
    landingUrl: z.string().regex(/^\/[a-z0-9/-]+$/).optional(),
    order: z.number().default(99),
    /* ---- Werkstatt / Launcher (2026-09) ---- */
    /** Lebenszyklus — nie erfinden, lieber 'wip' als 'live' */
    status: z.enum(['live', 'released', 'private', 'wip', 'archived', 'case']).default('wip'),
    /** Plattformen, auf denen das Produkt läuft */
    platform: z.array(z.enum(['desktop', 'mobile', 'web', 'game', 'audio', 'tool', 'print'])).default([]),
    /** Engine/Runtime in einem Wort — Electron, Godot 4.7, Unity, Expo, Tauri, Next.js */
    engine: z.string().optional(),
    /** Aktuelle Version; scripts/werkstatt-scan.mjs liefert beim Deploy ggf. eine frischere */
    version: z.string().optional(),
    /** Produktmarke — der Launcher färbt sich danach (Chamäleon) */
    brand: z
      .object({
        primary: z.string(),
        secondary: z.string().optional(),
        bg: z.string().optional(),
        ink: z.string().optional(),
      })
      .optional(),
    /** Figur/Maskottchen für den Cast-Streifen (transparentes WebP/PNG/SVG) */
    character: z.string().optional(),
    characterName: z.string().optional(),
    /** Spielbar im Browser — Ordner unter public/arcade/<id>/ (generiert, nicht im Git) */
    arcade: z
      .object({
        id: z.string(),
        controlsDe: z.string(),
        controlsEn: z.string(),
        /** Godot mit Threads braucht COOP/COEP */
        threads: z.boolean().default(false),
        aspect: z.string().default('16 / 9'),
        /** Ungefähre Downloadgröße beim Start, z. B. "48 MB" */
        size: z.string().optional(),
      })
      .optional(),
  }),
});

export const collections = { work };
