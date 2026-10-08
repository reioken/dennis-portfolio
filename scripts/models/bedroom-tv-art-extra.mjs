// Extra loose-game covers for the v4 TV corner pile (same public libretro source as bedroom-tv-art.mjs).
// Adds files next to the original art and appends their provenance; existing downloads stay untouched.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const out = '.source-assets/bedroom-tv';
const repos = { n64: 'Nintendo_-_Nintendo_64', snes: 'Nintendo_-_Super_Nintendo_Entertainment_System' };
const games = [
  ['mario64', 'n64', 'Super Mario 64'],
  ['mariokart64', 'n64', 'Mario Kart 64'],
  ['mario-world', 'snes', 'Super Mario World'],
  ['dkc', 'snes', 'Donkey Kong Country'],
];
const sourcesFile = 'scripts/models/bedroom-tv-art.sources.json';
const sources = JSON.parse(await readFile(sourcesFile, 'utf8'));
for (const [id, sys, title] of games) {
  if (sources.some(s => s.id === id)) { console.log('kept', id); continue; }
  const r = await fetch(`https://api.github.com/repos/libretro-thumbnails/${repos[sys]}/git/trees/master?recursive=1`);
  if (!r.ok) throw new Error(`${repos[sys]}: ${r.status}`);
  const tree = (await r.json()).tree.map(x => x.path);
  const candidates = tree.filter(x => x.startsWith('Named_Boxarts/') && x.split('/')[1].startsWith(title + ' (') && !/Beta|Proto|Rev|Demo|Kiosk/.test(x));
  const path = candidates.find(x => /\(Europe\)/.test(x)) ?? candidates.find(x => /\(USA\)/.test(x)) ?? candidates[0];
  if (!path) throw new Error('Missing ' + title);
  let resolved = path, url, data;
  for (let hop = 0; hop < 4; hop++) {
    url = `https://raw.githubusercontent.com/libretro-thumbnails/${repos[sys]}/master/${resolved.split('/').map(encodeURIComponent).join('/')}`;
    const res = await fetch(url); if (!res.ok) throw new Error(`${url}: ${res.status}`);
    data = Buffer.from(await res.arrayBuffer());
    if (data[0] === 137 || data[0] === 255) break;
    resolved = resolved.split('/').slice(0, -1).concat(data.toString().trim()).join('/');
  }
  const local = `${id}-Named_Boxarts.png`;
  await writeFile(`${out}/${local}`, data);
  sources.push({ id, title, category: 'Named_Boxarts', url, local, sha256: createHash('sha256').update(data).digest('hex') });
  console.log(local, path);
}
await writeFile(sourcesFile, JSON.stringify(sources, null, 2) + '\n');
