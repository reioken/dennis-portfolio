// Lists files under public/models and public/textures whose name appears nowhere in src/ or scripts/.
// usage: node scripts/qa/hero/unref.mjs   (biggest first; a hit here is a candidate, not proof)
import { readdirSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(fileURLToPath(import.meta.url), '../../../..');
function walk(d, out = []) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
// gather all source text
const srcFiles = [];
for (const dir of ['src', 'scripts', 'public/_headers', 'astro.config.mjs', 'package.json']) {
  const p = path.join(ROOT, dir);
  try { statSync(p).isDirectory() ? walk(p, srcFiles) : srcFiles.push(p); } catch {}
}
const blob = srcFiles.filter(f => /\.(ts|tsx|js|mjs|cjs|astro|mdx|md|json|py|css|txt|)$/i.test(f) && statSync(f).size < 4e6)
  .map(f => { try { return readFileSync(f, 'utf8'); } catch { return ''; } }).join('\n');
const targets = [];
for (const d of ['public/models', 'public/textures']) { try { walk(path.join(ROOT, d), targets); } catch {} }
const unref = [];
for (const t of targets) {
  const base = path.basename(t);
  const stem = base.replace(/\.(glb|webp|avif|png|jpg|ktx2|bin|gz|json)$/i, '').replace(/\.bin$/, '');
  if (blob.includes(base) || blob.includes(stem)) continue;
  unref.push([path.relative(ROOT, t).replace(/\\/g, '/'), statSync(t).size]);
}
unref.sort((a, b) => b[1] - a[1]);
let tot = 0;
for (const [f, s] of unref) { tot += s; console.log(`${(s / 1024).toFixed(0).padStart(7)} KB  ${f}`); }
console.log(`\n${unref.length} files, ${(tot / 1048576).toFixed(2)} MB`);
