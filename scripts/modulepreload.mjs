/**
 * Flatten the hall's module chain: every page that mounts the Hall island gets `<link rel="modulepreload">` for the
 * island's chunk, its static dependencies and the lazily imported Stage3D bundle (three.js, ~320 KB br), so the
 * browser fetches them from the HTML instead of five hops later (HTML → island runtime → Hall.js → deps → Stage3D).
 * Measured 2026-09-13: Stage3D started 440 ms (fast) / 2.1 s (4G) after navigation; nothing else on the home route
 * is loaded needlessly, so the whole reachable set is preloaded. Runs at astro:build:done before the EN clone.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { relativeJsAssets } from './qa/asset-graph.mjs';

async function htmlFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await htmlFiles(abs)));
    else if (entry.name.endsWith('.html')) out.push(abs);
  }
  return out;
}

/** Reachable chunk paths (site-absolute) from one entry chunk, static and dynamic imports alike. */
async function reachable(distDir, entry, cache) {
  const seen = new Set();
  const queue = [entry];
  while (queue.length) {
    const href = queue.shift();
    if (seen.has(href)) continue;
    seen.add(href);
    let source = cache.get(href);
    if (source === undefined) {
      try { source = await readFile(path.join(distDir, href), 'utf8'); } catch { source = ''; }
      cache.set(href, source);
    }
    for (const rel of relativeJsAssets(source)) queue.push(path.posix.join(path.posix.dirname(href), rel));
  }
  return [...seen];
}

export async function addModulePreloads(distDir) {
  const cache = new Map();
  let pages = 0, links = 0;
  for (const file of await htmlFiles(distDir)) {
    const html = await readFile(file, 'utf8');
    const island = html.match(/component-url="(\/_astro\/Hall\.[^"]+\.js)"/);
    if (!island || html.includes('rel="modulepreload"')) continue;
    const chunks = await reachable(distDir, island[1], cache);
    const tags = chunks.map((href) => `<link rel="modulepreload" href="${href}">`).join('');
    await writeFile(file, html.replace('</head>', `${tags}</head>`), 'utf8');
    pages += 1; links += chunks.length;
  }
  console.log(`[modulepreload] ${pages} hall pages, ${links} links`);
}
