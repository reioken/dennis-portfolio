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
/** @type {() => import('astro').AstroIntegration} */
const enRoutes = () => ({
  name: 'en-routes',
  hooks: {
    'astro:build:done': async ({ dir }) => {
      await buildEnRoutes(fileURLToPath(dir));
    },
  },
});

/** Ersetzt 'unsafe-inline' in script-src durch Hashes der gebauten Inline-Scripts */
/** @type {() => import('astro').AstroIntegration} */
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
  redirects: {
    '/work/nocturne/': { status: 301, destination: '/work/lowlight/' },
    '/en/work/nocturne/': { status: 301, destination: '/en/work/lowlight/' },
  },
  integrations: [
    react(),
    mdx(),
    sitemap({ filter: (page) => !page.includes('/work/nocturne') }),
    enRoutes(),
    cspHashes(),
  ],
  vite: {
    plugins: [tailwindcss()],
    build: {
      // External modules avoid ClientRouter's data: script sentinel under our CSP.
      assetsInlineLimit: (filePath) => /\.[cm]?js$/.test(filePath) ? false : undefined,
    },
  },
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
});
