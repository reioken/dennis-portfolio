import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

/**
 * CSP-Härtung: ersetzt 'unsafe-inline' in script-src durch sha256-Hashes der
 * tatsächlich gebauten Inline-Scripts (Astro-Island-Loader, Reveal-Boot).
 * Läuft nach en-routes über ALLE dist-HTMLs, dedupliziert die Inhalte und
 * schreibt die Hash-Liste in dist/_headers. style-src behält 'unsafe-inline'
 * (Inline-style-Attribute im Markup — geringes Risiko, hoher Umbauaufwand).
 */

async function walkHtml(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walkHtml(abs)));
    else if (entry.name.endsWith('.html')) out.push(abs);
  }
  return out;
}

export async function hardenCsp(distDir) {
  const files = await walkHtml(distDir);
  const hashes = new Set();
  const scriptRe = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g;

  for (const file of files) {
    const html = await readFile(file, 'utf8');
    let m;
    while ((m = scriptRe.exec(html))) {
      const attrs = m[1];
      const executable = !/\btype=/.test(attrs) || /\btype="module"/.test(attrs);
      if (!executable) continue; // JSON-LD u. ä. werden nie ausgeführt
      const hash = createHash('sha256').update(m[2], 'utf8').digest('base64');
      hashes.add(`'sha256-${hash}'`);
    }
  }

  const headersPath = path.join(distDir, '_headers');
  const headers = await readFile(headersPath, 'utf8');
  if (!headers.includes("script-src 'self' 'unsafe-inline'")) {
    console.warn('[csp] script-src-Muster nicht gefunden — _headers unverändert');
    return;
  }
  const updated = headers.replace(
    "script-src 'self' 'unsafe-inline'",
    `script-src 'self' ${[...hashes].join(' ')}`,
  );
  await writeFile(headersPath, updated);
  console.log(`[csp] 'unsafe-inline' ersetzt durch ${hashes.size} Script-Hashes`);
}
