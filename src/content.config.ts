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
    tags: z.array(z.enum(['product', 'design', 'archive', 'lab'])).default([]),
    featured: z.boolean().default(false),
    cover: z.string(),
    /** Logo shown on project cards (preferred over cover) */
    logo: z.string().optional(),
    /** Animated logo — only played on card hover */
    logoLive: z.string().optional(),
    gallery: z.array(z.string()).default([]),
    externalUrl: z.string().url().optional(),
    order: z.number().default(99),
  }),
});

export const collections = { work };
