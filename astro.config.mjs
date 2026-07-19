// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { fileURLToPath } from 'node:url';
import { buildEnRoutes } from './scripts/en-routes.mjs';
import { hardenCsp } from './scripts/csp-hashes.mjs';

/** Erzeugt nach dem Build crawlbare /en/-Routen + hreflang (siehe scripts/en-routes.mjs) */
const enRoutes = () => ({
  name: 'en-routes',
  hooks: {
    'astro:build:done': async ({ dir }) => {
      await buildEnRoutes(fileURLToPath(dir));
    },
  },
});

/** Ersetzt 'unsafe-inline' in script-src durch Hashes der gebauten Inline-Scripts */
const cspHashes = () => ({
  name: 'csp-hashes',
  hooks: {
    'astro:build:done': async ({ dir }) => {
      await hardenCsp(fileURLToPath(dir));
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
    cspHashes(),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
});
