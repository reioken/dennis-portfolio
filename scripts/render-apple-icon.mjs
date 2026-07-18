import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const mark = readFileSync('public/brand/mark.svg', 'utf8').replaceAll('currentColor', '#f7f8fc');
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
  <rect width="180" height="180" rx="40" fill="#07080c"/>
  <g transform="translate(30 30) scale(1.2)">
    ${mark.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '')}
  </g>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile('public/apple-touch-icon.png');
console.log('apple-touch-icon.png');
