import sharp from 'sharp';
import { writeFileSync } from 'fs';

const mark = await sharp('public/brand/mark-white.png')
  .resize(48, 48, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

const b64 = mark.toString('base64');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#07080c"/>
  <image href="data:image/png;base64,${b64}" x="8" y="8" width="48" height="48"/>
</svg>`;

writeFileSync('public/favicon.svg', svg);

await sharp('public/brand/mark-tile.png')
  .resize(180, 180)
  .png()
  .toFile('public/apple-touch-icon.png');

console.log('favicon + apple-touch updated');
