import sharp from 'sharp';
import { readFileSync } from 'fs';

const inner = readFileSync('public/brand/mark.svg', 'utf8')
  .replace(/<svg[^>]*>/, '')
  .replace('</svg>', '')
  .replace(/fill="currentColor"/g, '')
  .replace(/fill-rule=/g, 'fill-rule=');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 80 80">
  <rect width="80" height="80" fill="#0b0c10"/>
  <g fill="#f4f5f8">${inner}</g>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile('public/brand/mark-preview-render.png');
console.log('preview ok');
