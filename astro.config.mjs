// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { fileURLToPath } from 'node:url';
import { buildEnRoutes } from './scripts/en-routes.mjs';

/** Erzeugt nach dem Build crawlbare /en/-Routen + hreflang (siehe scripts/en-routes.mjs) */
const enRoutes = () => ({
  name: 'en-routes',
  hooks: {
    'astro:build:done': async ({ dir }) => {
      await buildEnRoutes(fileURLToPath(dir));
    },
  },
});

// https://astro.build/config
export default defineConfig({
  site: 'https://www.dennisbf.design',
  base: '/',
  integrations: [
    react(),
    mdx(),
    sitemap({
      serialize: (item) => ({ ...item, lastmod: new Date().toISOString() }),
    }),
    enRoutes(),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
});
