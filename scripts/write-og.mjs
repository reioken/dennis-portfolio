import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const mark = await sharp('public/brand/mark-white.png')
  .resize(240, 240, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
const b64 = mark.toString('base64');

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#07080c"/>
  <image xlink:href="data:image/png;base64,${b64}" x="100" y="195" width="240" height="240"/>
  <text x="380" y="290" fill="#f7f8fc" font-family="Segoe UI, Arial, sans-serif" font-size="42" font-weight="600">Dennis Bierreth-Fernandez</text>
  <text x="380" y="342" fill="#8188a1" font-family="Segoe UI, Arial, sans-serif" font-size="20" letter-spacing="3.5">UX/UI DESIGNER · ART DIRECTOR</text>
</svg>`;

writeFileSync('public/og/default.svg', svg);
console.log('og ok');
