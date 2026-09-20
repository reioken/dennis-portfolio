// Shared helper for the hero QA tools: repo root from this file, plus an out-dir guard.
// Writing into the repo makes Vite reload the dev server mid-capture, so it is refused.
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(fileURLToPath(import.meta.url), '../../../..');

export function outDir(p, usage) {
  if (!p) { console.error('usage: ' + usage); process.exit(2); }
  const abs = path.resolve(p);
  if (abs === ROOT || abs.startsWith(ROOT + path.sep)) {
    console.error(`refusing to write inside the project (${abs}).\nVite reloads the dev server on any file change under ${ROOT}. Pick a dir outside it, e.g. in %TEMP%.`);
    process.exit(2);
  }
  mkdirSync(abs, { recursive: true });
  return abs;
}
