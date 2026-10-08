// Crisp, intentionally typeset spines and small hardware markings for the real Tripo geometry.
import fs from 'node:fs/promises';
import sharp from 'sharp';
const out = '.source-assets/bedroom-tv-tripo/print';
await fs.mkdir(out, { recursive: true });
const games = [
  ['SUPER SMASH BROS. MELEE', '#242428'], ['THE LEGEND OF ZELDA: THE WIND WAKER', '#244335'],
  ['MARIO KART: DOUBLE DASH!!', '#b12832'], ["LUIGI’S MANSION", '#43535a'],
  ['SUPER MARIO SUNSHINE', '#2870a3'], ['METROID PRIME', '#434753'], ['PIKMIN', '#3f7141'],
  ['THE LEGEND OF ZELDA: OCARINA OF TIME', '#706443'],
];
const escape = s => s.replaceAll('&', '&amp;');
const bands = games.map(([title, colour], i) => `<g transform="translate(0 ${i * 128})">
  <rect width="2048" height="128" fill="#eeeae4"/><rect width="270" height="128" fill="#202126"/>
  <text x="135" y="43" text-anchor="middle" font-family="Arial" font-size="22" fill="white">NINTENDO</text>
  <text x="135" y="83" text-anchor="middle" font-family="Arial" font-size="35" font-weight="bold" fill="white">GAMECUBE</text>
  <text x="325" y="81" font-family="Arial" font-size="51" font-weight="bold" fill="${colour}">${escape(title)}</text>
  <rect x="1920" y="19" width="106" height="90" rx="12" fill="#bc2438"/>
  <text x="1973" y="71" text-anchor="middle" font-family="Arial" font-size="17" fill="white">Nintendo</text>
</g>`).join('');
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="1024">${bands}</svg>`)).png().toFile(`${out}/spines.png`);
const labels = [
 ['SONY', 'TRINITRON', '#aeb2ba'], ['NINTENDO', 'GAMECUBE', '#bfc3cb'],
 ['Nintendo', 'GAME BOY', '#d0d1c9'], ['Nintendo', 'SUPER NINTENDO', '#b3b6bf'],
];
const badges = labels.map(([a,b,c],i)=>`<g transform="translate(0 ${i*256})"><rect width="1024" height="256" fill="${c}"/><text x="512" y="126" text-anchor="middle" font-family="Arial" font-size="${i===0?112:48}" font-weight="bold" fill="#282b35">${a}</text><text x="512" y="201" text-anchor="middle" font-family="Arial" font-size="42" font-weight="bold" fill="#282b35">${b}</text></g>`).join('');
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">${badges}</svg>`)).png().toFile(`${out}/badges.png`);
console.log('Printed eight crisp GameCube spines and four hardware badges');
