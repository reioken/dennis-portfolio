// Public cover/screenshot references, retained locally for the bedroom TV prop.
// Downloads only the named games; the built GLB embeds a single cover atlas and its CRT image.
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { posix } from 'node:path';
const out = '.source-assets/bedroom-tv';
await mkdir(out, { recursive: true });
const systems = {
  gc: 'Nintendo_-_GameCube', n64: 'Nintendo_-_Nintendo_64',
  snes: 'Nintendo_-_Super_Nintendo_Entertainment_System', gb: 'Nintendo_-_Game_Boy', ds: 'Nintendo_-_Nintendo_DS',
};
const trees = {};
for (const [key, repo] of Object.entries(systems)) {
  if (key === 'ds') { trees[key] = []; continue; } // huge tree; resolve the one named image directly below
  const r = await fetch(`https://api.github.com/repos/libretro-thumbnails/${repo}/git/trees/master?recursive=1`);
  if (!r.ok) throw new Error(`${repo}: ${r.status}`);
  trees[key] = (await r.json()).tree.map(x => x.path);
}
const games = [
  ['melee', 'gc', 'Super Smash Bros. Melee'],
  ['wind-waker', 'gc', 'Legend of Zelda, The - The Wind Waker'],
  ['ocarina', 'n64', 'Legend of Zelda, The - Ocarina of Time'],
  ['yoshi', 'snes', "Super Mario World 2 - Yoshi's Island"],
  ['smash64', 'n64', 'Super Smash Bros.'],
  ['link-past', 'snes', 'Legend of Zelda, The - A Link to the Past'],
  ['links-awakening', 'gb', "Legend of Zelda, The - Link's Awakening"],
  ['mario-ds', 'ds', 'Super Mario 64 DS'],
];
const sources = [], tiles = [];
async function get(id, sys, title, category) {
  const candidates = trees[sys].filter(x => x.startsWith(category + '/') && x.split('/')[1].startsWith(title + ' (') && !/Beta|Proto|GameCube/.test(x));
  const path = candidates.find(x => /\(Europe\)/.test(x)) ?? candidates.find(x => /\(USA\)/.test(x)) ?? candidates[0] ?? (sys === 'ds' ? `${category}/${title} (USA).png` : undefined);
  if (!path) throw new Error(`Missing ${category}: ${title}`);
  let resolved = path, url, data;
  for (let hop = 0; hop < 4; hop++) {
    url = `https://raw.githubusercontent.com/libretro-thumbnails/${systems[sys]}/master/${resolved.split('/').map(encodeURIComponent).join('/')}`;
    const r = await fetch(url); if (!r.ok) throw new Error(`${url}: ${r.status}`);
    data = Buffer.from(await r.arrayBuffer());
    if (data[0] === 137 || data[0] === 255) break;
    resolved = posix.normalize(posix.join(posix.dirname(resolved), data.toString().trim()));
  }
  const local = `${id}-${category}.png`;
  await writeFile(`${out}/${local}`, data);
  sources.push({ id, title, category, url, local, sha256: (await import('node:crypto')).createHash('sha256').update(data).digest('hex') });
  console.log(local, path);
  return data;
}
for (let i = 0; i < games.length; i++) {
  const [id, sys, title] = games[i];
  const data = await get(id, sys, title, 'Named_Boxarts');
  tiles.push({ input: await sharp(data).resize(512, 512, { fit: 'fill' }).png().toBuffer(), left: (i % 4) * 512, top: Math.floor(i / 4) * 512 });
}
await sharp({ create: { width: 2048, height: 1024, channels: 3, background: '#242428' } }).composite(tiles).png().toFile(`${out}/covers.png`);
for (const [id, sys, title] of [games[0], games[6], games[7]]) {
  await get(id, sys, title, 'Named_Snaps');
}
await writeFile(`${out}/sources.json`, JSON.stringify(sources, null, 2) + '\n');
const ds = await sharp(`${out}/mario-ds-Named_Snaps.png`).metadata();
await sharp(`${out}/mario-ds-Named_Snaps.png`).extract({ left: 0, top: 0, width: ds.width, height: ds.height / 2 }).png().toFile(`${out}/ds-top.png`);
await sharp(`${out}/mario-ds-Named_Snaps.png`).extract({ left: 0, top: ds.height / 2, width: ds.width, height: ds.height / 2 }).png().toFile(`${out}/ds-touch.png`);
