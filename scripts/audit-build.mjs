import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { relativeJsAssets } from './qa/asset-graph.mjs';

const dist = path.resolve('dist');
const siteOrigin = 'https://www.dennisbf.design';
const failures = [];

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function collect(dir, match) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await collect(absolute, match)));
    else if (match(absolute)) out.push(absolute);
  }
  return out;
}

function localTarget(value) {
  if (
    !value ||
    value.startsWith('#') ||
    value.startsWith('mailto:') ||
    value.startsWith('tel:') ||
    value.startsWith('data:') ||
    value.startsWith('blob:')
  ) {
    return null;
  }
  try {
    const url = new URL(value, siteOrigin);
    if (url.origin !== siteOrigin || url.pathname.startsWith('/api/')) return null;
    return decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
}

async function resolvesPublicPath(urlPath) {
  const relative = urlPath.replace(/^\/+/, '');
  const exact = path.join(dist, relative);
  if (await exists(exact)) {
    const info = await stat(exact);
    return info.isDirectory() ? exists(path.join(exact, 'index.html')) : true;
  }
  return exists(path.join(exact, 'index.html'));
}

const htmlFiles = await collect(dist, (file) => file.endsWith('.html'));
const marketingFiles = htmlFiles.filter(
  (file) => !file.includes(`${path.sep}game-builds${path.sep}`) && !file.includes(`${path.sep}studio${path.sep}`) && !file.endsWith(`${path.sep}404.html`),
);

for (const file of marketingFiles) {
  const html = await readFile(file, 'utf8');
  const relative = path.relative(dist, file).replaceAll(path.sep, '/');
  const redirect = html.match(/<meta\b[^>]*http-equiv="refresh"[^>]*content="[^";]*;\s*url=([^">]+)"/i);
  if (redirect) {
    const target = localTarget(redirect[1]);
    if (!target || !(await resolvesPublicPath(target))) failures.push(`${relative}: broken redirect ${redirect[1]}`);
    continue;
  }
  const h1Count = (html.match(/<h1\b/g) ?? []).length;
  if (h1Count !== 1) failures.push(`${relative}: expected one H1, found ${h1Count}`);
  if (!/<link rel="canonical" href="https:\/\/www\.dennisbf\.design\//.test(html)) {
    failures.push(`${relative}: canonical missing`);
  }
  // The standalone English product landing has no translated counterpart.
  const standaloneEnglish = ['lowlight/index.html', 'nexus/index.html', 'rarer/index.html'].includes(relative) && /<html\b[^>]*lang="en"/.test(html);
  if (!standaloneEnglish && (!/hreflang="de"/.test(html) || !/hreflang="en"/.test(html))) {
    failures.push(`${relative}: hreflang pair missing`);
  }

  const refs = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
  for (const ref of refs) {
    const target = localTarget(ref);
    if (target && !(await resolvesPublicPath(target))) {
      failures.push(`${relative}: missing local target ${target}`);
    }
  }
}

for (const forbidden of [
  'studio',
  'en/studio',
  'work/floordirekt',
  'en/work/floordirekt',
  'media/floordirekt',
  'media/me/_ai-portrait',
  'media/process/_ai-raw',
  'media/craft/_ai-logo',
]) {
  if (await exists(path.join(dist, forbidden))) failures.push(`forbidden output present: ${forbidden}`);
}

const sitemap = await readFile(path.join(dist, 'sitemap-0.xml'), 'utf8');
for (const match of sitemap.matchAll(/<loc>(.*?)<\/loc>/g)) {
  const target = localTarget(match[1]);
  if (target && !(await resolvesPublicPath(target))) failures.push(`sitemap links to missing page: ${target}`);
}
if (sitemap.includes('<lastmod>')) failures.push('sitemap contains synthetic lastmod values');
if (sitemap.includes('/studio') || sitemap.includes('/work/floordirekt')) {
  failures.push('sitemap exposes removed Floordirekt Studio routes');
}

async function reachableAssets(entryHtml, extension) {
  const html = await readFile(entryHtml, 'utf8');
  const queue = [
    ...html.matchAll(
      new RegExp(`(?:src|href|component-url|renderer-url)="(/_astro/[^"]+\\.${extension})"`, 'g'),
    ),
  ].map((match) => path.join(dist, match[1].replace(/^\/+/, '')));
  const seen = new Set();

  while (queue.length) {
    const file = queue.pop();
    if (!file || seen.has(file) || !(await exists(file))) continue;
    seen.add(file);
    if (extension !== 'js') continue;
    const source = await readFile(file, 'utf8');
    for (const dependency of relativeJsAssets(source)) {
      queue.push(path.resolve(path.dirname(file), dependency));
    }
  }
  return seen;
}

const home = path.join(dist, 'index.html');
const homeJs = await reachableAssets(home, 'js');
const homeCss = await reachableAssets(home, 'css');
const sumBytes = async (files) => {
  let total = 0;
  for (const file of files) total += (await stat(file)).size;
  return total;
};
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

if (failures.length) {
  console.error(`Build audit failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Build audit passed: ${marketingFiles.length} marketing pages, local links and metadata OK.`);
}
console.log(`Home reachable JS: ${kb(await sumBytes(homeJs))} across ${homeJs.size} files.`);
console.log(`Home CSS: ${kb(await sumBytes(homeCss))} across ${homeCss.size} files.`);
