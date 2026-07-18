import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const mask = 'public/brand/mark-white.png';
const size = 64;
const pad = 8;
const inner = size - pad * 2;

const gradientSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${inner}" height="${inner}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ac8bfd"/>
      <stop offset="50%" stop-color="#4a82fe"/>
      <stop offset="100%" stop-color="#dcebff"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
</svg>`);

const mark = await sharp(mask)
  .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .ensureAlpha()
  .toBuffer();

const tinted = await sharp(gradientSvg)
  .composite([{ input: mark, blend: 'dest-in' }])
  .png()
  .toBuffer();

const tile = await sharp({
  create: {
    width: size,
    height: size,
    channels: 4,
    background: { r: 7, g: 8, b: 12, alpha: 1 },
  },
})
  .composite([{ input: tinted, left: pad, top: pad }])
  .png()
  .toBuffer();

await sharp(tile).resize(32, 32).png().toFile('public/favicon-32.png');
await sharp(tile).resize(180, 180).png().toFile('public/apple-touch-icon.png');
await sharp(tile).png().toFile('public/brand/mark-tile.png');

const b64 = tile.toString('base64');
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#07080c"/><image href="data:image/png;base64,${b64}" x="0" y="0" width="64" height="64"/></svg>`;
writeFileSync('public/favicon.svg', faviconSvg);

console.log('favicon assets updated');
