/**
 * Export NEXUS diamond-N mark animation (no wordmark) from the app HTML
 * into a self-contained SVG for the portfolio project cards.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const srcHtml = path.join(
  process.env.USERPROFILE || '',
  'Documents',
  'NEXUS',
  'index.html',
);
const dest = path.join(root, 'public', 'media', 'nexus', 'logo-live.svg');

const html = fs.readFileSync(srcHtml, 'utf8');
const svgStart = html.indexOf('<!-- NEXUS-Logo:');
const defsStart = html.indexOf('<svg width="0"', svgStart);
const symbolEnd = html.indexOf('</symbol>', defsStart) + '</symbol>'.length;
const chunk = html.slice(defsStart, symbolEnd);

// Pull defs + symbol body (drop outer zero-size svg wrapper)
const defsInner = chunk
  .replace(/^[\s\S]*?<defs>/, '')
  .replace(/<\/symbol>[\s\S]*$/, '</symbol>');

const VIOLET = '#ac8bfd';
const BLUE = '#4a82fe';
const ICE = '#dcebff';

let body = defsInner
  .replace(/var\(--logo-violet\)/g, VIOLET)
  .replace(/var\(--logo-blue\)/g, BLUE)
  .replace(/var\(--logo-ice\)/g, ICE)
  .replace(/color-mix\(in srgb,\s*#ac8bfd 70%, #fff\)/g, '#d4c4ff')
  .replace(/color-mix\(in srgb,\s*#dcebff 70%, #fff\)/g, '#f2f7ff')
  .replace(/color-mix\(in srgb,\s*#4a82fe 73%, #000\)/g, '#365fc0')
  .replace(/color-mix\(in srgb,\s*#4a82fe 74%, #000\)/g, '#3560c2')
  .replace(/color-mix\(in srgb,\s*#4a82fe 70%, #000\)/g, '#345bb2')
  .replace(/color-mix\(in srgb,\s*#4a82fe 68%, #000\)/g, '#3358ad')
  .replace(/color-mix\(in srgb,\s*#4a82fe 65%, #000\)/g, '#3154a5')
  .replace(/color-mix\(in srgb,\s*#4a82fe 44%, #000\)/g, '#21396f')
  .replace(/color-mix\(in srgb,\s*#4a82fe 50%, #000\)/g, '#25417f')
  .replace(/color-mix\(in srgb,\s*#4a82fe 52%, #000\)/g, '#264482')
  .replace(/color-mix\(in srgb,\s*#4a82fe 59%, #000\)/g, '#2c4d94')
  .replace(/color-mix\(in srgb,\s*#4a82fe 62%, #000\)/g, '#2e519d')
  .replace(/color-mix\(in srgb,\s*#4a82fe 53%, #000\)/g, '#274686')
  .replace(/color-mix\(in srgb,\s*#4a82fe 58%, #000\)/g, '#2b4c92')
  .replace(/color-mix\(in srgb,\s*#4a82fe 61%, #000\)/g, '#2d509b')
  .replace(/color-mix\(in srgb,\s*#4a82fe 64%, #000\)/g, '#3053a2')
  .replace(/color-mix\(in srgb,\s*#4a82fe 66%, #000\)/g, '#3156a7')
  .replace(/color-mix\(in srgb,\s*#4a82fe 67%, #000\)/g, '#3257aa')
  .replace(/color-mix\(in srgb,\s*#4a82fe 69%, #000\)/g, '#3359af')
  .replace(/color-mix\(in srgb,\s*#4a82fe 71%, #000\)/g, '#345cb4')
  .replace(/color-mix\(in srgb,\s*#4a82fe 75%, #000\)/g, '#3660bf')
  .replace(/color-mix\(in srgb,\s*#ac8bfd 73%, #000\)/g, '#7d66b9')
  .replace(/color-mix\(in srgb,\s*#ac8bfd 74%, #000\)/g, '#7e67bb')
  // leftover color-mix → solid fallbacks
  .replace(/color-mix\([^)]+\)/g, BLUE);

// Expand symbol into a visible root svg (mark only — no NEXUS wordmark)
const symbolMatch = body.match(/<symbol id="nexusMark"[^>]*viewBox="([^"]+)"[^>]*>([\s\S]*?)<\/symbol>/);
if (!symbolMatch) throw new Error('nexusMark symbol not found');
const viewBox = symbolMatch[1];
const markInner = symbolMatch[2];
const defsOnly = body.replace(/<symbol[\s\S]*<\/symbol>/, '');

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none" role="img" aria-label="NEXUS">
  <defs>
${defsOnly}
  </defs>
${markInner}
</svg>
`;

fs.writeFileSync(dest, svg, 'utf8');
console.log('wrote', dest, `(${svg.length} bytes)`);
