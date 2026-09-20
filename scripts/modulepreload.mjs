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

/**
 * The first view's large files (environment, the claw machine's figure and plush, Blue). Measured live 2026-09-19:
 * the network sat idle from 0.5 s (JS done) to 1.4 s (scene constructed, loaders started) while these 4.5 MB were
 * still to come. `as="fetch" crossorigin` matches three's FileLoader and the environment fetch, so the preloaded
 * response is reused. Phone case pages are native and never start the hall: they get a media condition.
 */
async function firstViewAssets(distDir, html) {
  const blue = (await readFile(path.join(process.cwd(), 'src/components/hall/blueCat.ts'), 'utf8')).match(/BLUE_ASSET_BUILD = '([^']+)'/)?.[1];
  const figure = html.match(/\/models\/dennis\.glb\?v=[0-9a-f]+/)?.[0];
  const wanted = [
    '/textures/hall-environment-v2.bin.gz',
    figure,
    blue && `/models/blue-rigged-${blue}.glb`,
    '/models/plush/pile-back-v1.glb',
    '/models/plush/pile-side-v1.glb',
  ].filter(Boolean);
  const present = [];
  for (const href of wanted) {
    try { await readFile(path.join(distDir, href.split('?')[0])); present.push(href); } catch { /* renamed asset: no preload rather than a 404 */ }
  }
  return present;
}

export async function addModulePreloads(distDir) {
  const cache = new Map();
  let pages = 0, links = 0, assets = 0;
  for (const file of await htmlFiles(distDir)) {
    const html = await readFile(file, 'utf8');
    const island = html.match(/component-url="(\/_astro\/Hall\.[^"]+\.js)"/);
    if (!island || html.includes('rel="modulepreload"')) continue;
    const chunks = await reachable(distDir, island[1], cache);
    const media = /(^|[\\/])work[\\/]/.test(path.relative(distDir, file)) ? ' media="(min-width: 761px)"' : '';
    const firstView = await firstViewAssets(distDir, html);
    const tags = chunks.map((href) => `<link rel="modulepreload" href="${href}">`).join('')
      + firstView.map((href) => `<link rel="preload" as="fetch" crossorigin href="${href}"${media}>`).join('');
    await writeFile(file, html.replace('</head>', `${tags}</head>`), 'utf8');
    pages += 1; links += chunks.length; assets += firstView.length;
  }
  console.log(`[modulepreload] ${pages} hall pages, ${links} links, ${assets} first-view asset preloads`);
}
