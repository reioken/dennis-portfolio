// Hall screens for the Snapsize compare rig: the same page at phone, tablet, laptop and desktop size, composed
// into one image laid out like the rig's four physical screens. The rig's `screen` mesh is one object whose UVs
// span its own bounding box, so one composite lands each capture on its own screen.
//
//   node scripts/assets/snapsize-compare-screens.mjs <capture-dir>            capture, then compose
//   SKIP_CAPTURE=1 node scripts/assets/snapsize-compare-screens.mjs <dir>     compose from existing captures
//
// Layout: .source-assets/models-in/mach-snapsize/screen-layout.json (written by snapsize_gen.py),
// rects normalised 0..1 in image space. Output: public/media/snapsize/screens/<page>.webp.
import fs from 'node:fs';
import sharp from 'sharp';

const dir = process.argv[2];
if (!dir) throw new Error('usage: snapsize-compare-screens.mjs <capture-dir>');
const PAGES = {
  vgm: 'https://vgmbattle.com/',
  nexus: 'https://www.dennisbf.design/nexus/',
  lowlight: 'https://www.dennisbf.design/lowlight/',
  work: 'https://www.dennisbf.design/work/',
};
const SIZES = { phone: [390, 844], tablet: [768, 1024], laptop: [1440, 900], desktop: [1920, 1080] };
const LONG = 1280;          // the hall uses a screen image this size as it is (hallScene fitTexture)
const GAP = '#04050a';      // what the hall paints around a fitted image

if (!process.env.SKIP_CAPTURE) {
  const { chromium } = await import('playwright');
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch();
  for (const [page, url] of Object.entries(PAGES)) for (const [dev, [w, h]] of Object.entries(SIZES)) {
    const phone = dev === 'phone';
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone || dev === 'tablet', reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    await p.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => console.warn('slow load', page, dev));
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${dir}/${page}-${dev}.png` });
    await ctx.close();
  }
  await browser.close();
}

const layout = JSON.parse(fs.readFileSync('.source-assets/models-in/mach-snapsize/screen-layout.json', 'utf8'));
const W = layout.aspect >= 1 ? LONG : Math.round(LONG * layout.aspect);
const H = layout.aspect >= 1 ? Math.round(LONG / layout.aspect) : LONG;
fs.mkdirSync('public/media/snapsize/screens', { recursive: true });
for (const page of Object.keys(PAGES)) {
  const layers = [];
  for (const s of layout.screens) {
    const left = Math.round(s.x * W), top = Math.round(s.y * H);
    const width = Math.round((s.x + s.w) * W) - left, height = Math.round((s.y + s.h) * H) - top;
    const input = await sharp(`${dir}/${page}-${s.name}.png`).resize(width, height, { fit: 'cover', position: 'top' }).toBuffer();
    layers.push({ input, left, top });
  }
  await sharp({ create: { width: W, height: H, channels: 3, background: GAP } })
    .composite(layers).webp({ quality: 86 }).toFile(`public/media/snapsize/screens/${page}.webp`);
  console.log(`screens/${page}.webp ${W}x${H}`);
}
