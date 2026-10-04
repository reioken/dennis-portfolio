// Capture the approved booth as a small static phone Contact illustration.
// The desktop room stays live; phones never need WebGL just to contact Dennis.
// node scripts/assets/render-contact-poster.mjs OUT [BASE]
import { chromium } from 'playwright';
import sharp from 'sharp';
import { outDir } from '../qa/hero/_out.mjs';
const out = outDir(process.argv[2], 'render-contact-poster.mjs OUT [BASE]');
const base = process.argv[3] ?? 'https://www.dennisbf.design';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${base}/contact/`);
  await page.waitForFunction(() => document.querySelector('[data-startup-phase="ready"]'), null, { timeout: 45000 });
  await page.waitForTimeout(5000);
  const capture = await page.screenshot({ clip: { x: 100, y: 90, width: 480, height: 880 } });
  await sharp(capture).resize(240, 440).webp({ quality: 85 }).toFile(`${out}/booth.webp`);
  console.log(`${out}/booth.webp`);
} finally {
  await browser.close();
}
