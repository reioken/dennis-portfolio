// Lädt die generierten Web-Builds aus public/game-builds/<game>/ in den R2-Bucket hoch.
//
//   node scripts/arcade/publish-r2.mjs [--bucket dennisbf-arcade] [--game echo-frequency] [--dry-run] [--force]
//
// Pages nimmt keine Datei über 25 MiB an, deshalb liegen index.wasm/index.pck auf R2 hinter
// arcade.dennisbf.design (siehe public/game-builds/README.md). Nutzt `wrangler r2 object put`
// pro Datei; unveränderte Dateien (Größe + mtime) werden übersprungen.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const ARCADE = path.join(ROOT, 'public', 'game-builds');
const STATE = path.join(ROOT, '.arcade-publish.json');

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const bucket = opt('--bucket', 'dennisbf-arcade');
const only = opt('--game', null);
const dry = flag('--dry-run');
const force = flag('--force');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.pck': 'application/octet-stream',
  '.png': 'image/png',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(abs));
    else out.push(abs);
  }
  return out;
}

if (!existsSync(ARCADE)) {
  console.error(`[arcade] ${ARCADE} fehlt — erst exportieren (npm run arcade:echo).`);
  process.exit(1);
}

const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {};
const games = readdirSync(ARCADE, { withFileTypes: true })
  .filter((e) => e.isDirectory() && (!only || e.name === only))
  .map((e) => e.name);

if (!games.length) {
  console.error('[arcade] Keine Builds gefunden.');
  process.exit(1);
}

let uploaded = 0;
let skipped = 0;
for (const game of games) {
  const dir = path.join(ARCADE, game);
  for (const abs of walk(dir)) {
    const rel = path.relative(ARCADE, abs).split(path.sep).join('/');
    const st = statSync(abs);
    const sig = `${st.size}:${Math.floor(st.mtimeMs)}`;
    if (!force && state[rel] === sig) {
      skipped++;
      continue;
    }
    const type = MIME[path.extname(abs).toLowerCase()] ?? 'application/octet-stream';
    const mb = (st.size / 1048576).toFixed(1);
    console.log(`${dry ? '[dry] ' : ''}put ${bucket}/${rel} (${mb} MiB, ${type})`);
    if (!dry) {
      execFileSync(
        'npx',
        ['wrangler', 'r2', 'object', 'put', `${bucket}/${rel}`, `--file=${abs}`, `--content-type=${type}`, '--cache-control=public, max-age=31536000, immutable'],
        { stdio: 'inherit', shell: process.platform === 'win32' },
      );
      state[rel] = sig;
      writeFileSync(STATE, JSON.stringify(state, null, 2));
    }
    uploaded++;
  }
}
console.log(`[arcade] ${uploaded} hochgeladen, ${skipped} unverändert übersprungen.`);
