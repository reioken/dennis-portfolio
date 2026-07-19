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
    order: z.number().default(99),
  }),
});

export const collections = { work };
