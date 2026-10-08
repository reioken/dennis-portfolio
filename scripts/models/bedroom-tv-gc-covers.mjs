// Full GameCube case scans (back, spine, front) for the TV corner's case stacks, from GameTDB's public cover
// archive (PAL/EN where available). Crops each scan into its real spine and front cover so the stacks show the
// actual printed sides. Files stay in ignored .source-assets/bedroom-tv/gc/; URLs and hashes are appended to
// scripts/models/bedroom-tv-art.sources.json.
import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const out = '.source-assets/bedroom-tv/gc';
await mkdir(out, { recursive: true });
export const GAMES = [
  ['melee', 'GALP01', 'Super Smash Bros. Melee'], ['wind-waker', 'GZLP01', 'The Legend of Zelda: The Wind Waker'],
  ['double-dash', 'GM4P01', 'Mario Kart: Double Dash!!'], ['luigis-mansion', 'GLMP01', "Luigi's Mansion"],
  ['sunshine', 'GMSP01', 'Super Mario Sunshine'], ['metroid-prime', 'GM8P01', 'Metroid Prime'],
  ['pikmin', 'GPIP01', 'Pikmin'], ['twilight-princess', 'GZ2P01', 'The Legend of Zelda: Twilight Princess'],
  ['mario-party-4', 'GMPP01', 'Mario Party 4'], ['f-zero-gx', 'GFZP01', 'F-Zero GX'],
  ['paper-mario', 'G8MP01', 'Paper Mario: The Thousand-Year Door'], ['animal-crossing', 'GAFP01', 'Animal Crossing'],
];
const sourcesFile = 'scripts/models/bedroom-tv-art.sources.json';
const sources = JSON.parse(await readFile(sourcesFile, 'utf8'));
for (const [id, code, title] of GAMES) {
  let data, url;
  for (const loc of ['EN', 'UK', 'FR', 'DE']) {
    url = `https://art.gametdb.com/wii/coverfullHQ/${loc}/${code}.png`;
    const r = await fetch(url); if (r.ok) { data = Buffer.from(await r.arrayBuffer()); break; }
  }
  if (!data) { console.log('missing', id, code); continue; }
  await writeFile(`${out}/${id}-full.png`, data);
  const { width, height } = await sharp(data).metadata();
  // GameTDB full scans: back | spine | front; the spine is the centred strip of ~5.3 % width.
  const s0 = Math.round(width * .4775), s1 = Math.round(width * .5262), f0 = Math.round(width * .5285);
  await sharp(data).extract({ left: s0, top: 0, width: s1 - s0, height }).png().toFile(`${out}/${id}-spine.png`);
  await sharp(data).extract({ left: f0, top: 0, width: width - f0, height }).png().toFile(`${out}/${id}-front.png`);
  if (!sources.some(s => s.id === 'gc-' + id))
    sources.push({ id: 'gc-' + id, title, category: 'GameTDB coverfullHQ', url, local: `gc/${id}-full.png`, sha256: createHash('sha256').update(data).digest('hex') });
  console.log(id, code, width, height);
}
await writeFile(sourcesFile, JSON.stringify(sources, null, 2) + '\n');
// One atlas for every spine (one material): row r holds game r, rotated so the title reads left to right.
const rows = GAMES.length, W = 1024, RH = Math.floor(1024 / rows);
const tiles = [];
for (let r = 0; r < rows; r++)
  tiles.push({ input: await sharp(`${out}/${GAMES[r][0]}-spine.png`).rotate(-90).resize(W, RH, { fit: 'fill' }).toBuffer(), left: 0, top: r * RH });
await sharp({ create: { width: W, height: 1024, channels: 3, background: '#111' } }).composite(tiles).png().toFile(`${out}/spines-atlas.png`);
await writeFile(`${out}/spines-atlas.json`, JSON.stringify({ rows, rowHeight: RH, size: 1024, games: GAMES.map(g => g[0]) }, null, 2));
console.log('atlas', rows, RH);
