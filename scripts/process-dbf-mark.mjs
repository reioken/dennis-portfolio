import sharp from 'sharp';
import { copyFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src =
  process.argv[2] ||
  join(
    process.env.USERPROFILE || '',
    '.cursor/projects/c-Users-denni-Projects-dennis-portfolio/assets/dbf-mark-solid-v3.png',
  );
const outDir = join(root, 'public/brand');

copyFileSync(src, join(outDir, 'mark-ai-source.png'));

async function toCleanWhite(size, file) {
  // Upscale → slight blur → hard threshold → downscale for clean edges
  const big = Math.max(size * 2, 1024);
  const { data, info } = await sharp(src)
    .resize(big, big, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
    .blur(0.6)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i++) {
    const lum = 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2];
    const a = lum > 90 ? 255 : 0;
    out[i * 4] = 255;
    out[i * 4 + 1] = 255;
    out[i * 4 + 2] = 255;
    out[i * 4 + 3] = a;
  }

  await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .resize(size, size, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toFile(join(outDir, file));
  console.log('wrote', file);
}

await toCleanWhite(512, 'mark-white.png');
await toCleanWhite(256, 'mark-exact.png');
await toCleanWhite(512, 'mark-mask.png');

await sharp(src)
  .resize(512, 512, { fit: 'contain', background: { r: 7, g: 8, b: 12, alpha: 1 } })
  .png()
  .toFile(join(outDir, 'mark-tile.png'));

const fav = await sharp(join(outDir, 'mark-white.png'))
  .resize(48, 48)
  .png()
  .toBuffer();
writeFileSync(
  join(root, 'public/favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#07080c"/><image href="data:image/png;base64,${fav.toString('base64')}" x="8" y="8" width="48" height="48"/></svg>`,
);

await sharp(join(outDir, 'mark-tile.png')).resize(180, 180).png().toFile(join(root, 'public/apple-touch-icon.png'));

await sharp(join(outDir, 'mark-white.png'))
  .resize(320, 320)
  .flatten({ background: '#0b0c10' })
  .png()
  .toFile(join(outDir, 'mark-preview-render.png'));

console.log('done');
