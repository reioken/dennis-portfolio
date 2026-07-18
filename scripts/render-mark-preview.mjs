import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const K = 0.5522847498;

function markSvg(sw, color, bg = null) {
  const pad = sw / 2 + 0.5;
  const x0 = pad;
  const y0 = pad;
  const x1 = 100 - pad;
  const y1 = 100 - pad;
  const mid = 50;
  const yA = y0 + (y1 - y0) * 0.437;
  const yB = y0 + (y1 - y0) * 0.681;
  const rx = mid - x0;
  const ryTop = yA - y0;
  const ryBot = y1 - yB;
  const rMid = (yB - yA) / 2;
  const top = `M ${mid} ${y0} C ${mid} ${y0 + ryTop * K}, ${mid - rx * K} ${yA}, ${x0} ${yA}`;
  const midPath = `M ${mid} ${yA} C ${mid - rMid * 2 * K} ${yA}, ${mid - rMid * 2 * K} ${yB}, ${mid} ${yB}`;
  const bot = `M ${x0} ${yB} C ${x0 + rx * K} ${yB}, ${mid} ${y1 - ryBot * K}, ${mid} ${y1}`;
  const bgRect = bg ? `<rect width="100" height="100" fill="${bg}"/>` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  ${bgRect}
  <g stroke="${color}" stroke-width="${sw}" stroke-linecap="square" stroke-linejoin="round">
    <rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}"/>
    <line x1="${mid}" y1="${y0}" x2="${mid}" y2="${y1}"/>
    <line x1="${mid}" y1="${yA}" x2="${x1}" y2="${yA}"/>
    <line x1="${mid}" y1="${yB}" x2="${x1}" y2="${yB}"/>
    <path d="${top}"/>
    <path d="${midPath}"/>
    <path d="${bot}"/>
  </g>
</svg>`;
}

const fav = markSvg(5.2, '#f7f8fc', '#07080c');
writeFileSync('public/favicon.svg', fav);
writeFileSync('public/brand-mark.svg', markSvg(3.6, 'currentColor'));
writeFileSync('public/brand/mark.svg', markSvg(3.6, 'currentColor'));

await sharp(Buffer.from(markSvg(3.2, '#111111', '#ffffff'))).resize(256, 256).png().toFile('public/brand/mark-preview.png');
await sharp(Buffer.from(markSvg(5.8, '#f7f8fc', '#111318'))).resize(64, 64).png().toFile('public/brand/mark-nav-preview.png');
await sharp(Buffer.from(fav)).resize(180, 180).png().toFile('public/apple-touch-icon.png');

const orig = await sharp('public/brand/orig-full.png').resize(256, 256, { fit: 'contain', background: '#fff' }).png().toBuffer();
const ours = await sharp(Buffer.from(markSvg(3.2, '#111111', '#ffffff'))).resize(256, 256).png().toBuffer();
await sharp({ create: { width: 532, height: 256, channels: 3, background: '#eee' } })
  .composite([
    { input: orig, left: 0, top: 0 },
    { input: ours, left: 276, top: 0 },
  ])
  .png()
  .toFile('public/brand/mark-compare.png');
console.log('ok');
