import sharp from 'sharp';

const W = 1200;
const H = 630;

const mark = await sharp('public/brand/mark-white.png')
  .resize(220, 220, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

const svg = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0c14"/>
      <stop offset="55%" stop-color="#07080c"/>
      <stop offset="100%" stop-color="#0c1020"/>
    </linearGradient>
    <radialGradient id="v" cx="18%" cy="30%" r="45%">
      <stop offset="0%" stop-color="#6b5cff" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#6b5cff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="i" cx="88%" cy="70%" r="40%">
      <stop offset="0%" stop-color="#7ec8ff" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#7ec8ff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <rect width="100%" height="100%" fill="url(#v)"/>
  <rect width="100%" height="100%" fill="url(#i)"/>
  <text x="380" y="288" fill="#f7f8fc" font-family="Segoe UI, Arial, sans-serif" font-size="40" font-weight="600">Dennis Bierreth-Fernandez</text>
  <text x="380" y="338" fill="#9aa3b8" font-family="Segoe UI, Arial, sans-serif" font-size="18" letter-spacing="3.2">ART DIRECTOR · UI/UX DESIGNER</text>
  <text x="380" y="390" fill="#6b7289" font-family="Segoe UI, Arial, sans-serif" font-size="16">NEXUS · Berry · Riftcast · Visual Craft</text>
</svg>`);

await sharp(svg)
  .composite([{ input: mark, left: 110, top: 205 }])
  .png()
  .toFile('public/og/default.png');

const meta = await sharp('public/og/default.png').metadata();
console.log(`OG PNG written ${meta.width}x${meta.height}`);
