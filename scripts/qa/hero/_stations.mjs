// Shared helper for the hero QA tools: the hall's machine stations, read from src/lib/hall-items.ts so the tools follow
// the lineup instead of hardcoding it. MACHINES = ORDER without CONTENT_ONLY (projects that keep their page and
// directory entry but have no machine). The hall's stops are About, the machines, then Contact.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './_out.mjs';

const src = readFileSync(path.join(ROOT, 'src/lib/hall-items.ts'), 'utf8');
const list = (re, what) => {
  const m = src.match(re);
  if (!m) throw new Error(`${what} not found in src/lib/hall-items.ts; update scripts/qa/hero/_stations.mjs`);
  return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
};

export const ORDER = list(/export const ORDER = \[([\s\S]*?)\];/, 'ORDER');
export const CONTENT_ONLY = list(/const CONTENT_ONLY = new Set\(\[([\s\S]*?)\]\)/, 'CONTENT_ONLY');
export const MACHINES = ORDER.filter(s => !CONTENT_ONLY.includes(s));
/** About + machines + Contact */
export const STOP_COUNT = MACHINES.length + 2;
