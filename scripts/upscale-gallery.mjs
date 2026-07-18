/**
 * AI-upscale case study cover + gallery images with Real-ESRGAN → `@2x.webp`.
 * Skips logos, SVGs, and files that already have a fresh @2x sibling.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const workDir = path.join(root, 'src/content/work');
const exe = path.join(root, 'tools/realesrgan-ncnn-vulkan/realesrgan-ncnn-vulkan.exe');
const tmpDir = path.join(root, 'tools/.upscale-tmp');
const MAX_EDGE = 2880;
const WEBP_Q = 84;

if (!existsSync(exe)) {
  console.error('Real-ESRGAN missing:', exe);
  process.exit(1);
}

mkdirSync(tmpDir, { recursive: true });

function collectPaths() {
  const set = new Set();
  for (const file of readdirSync(workDir).filter((f) => f.endsWith('.mdx'))) {
    const raw = readFileSync(path.join(workDir, file), 'utf8').replace(/^\uFEFF/, '');
    const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fm) {
      console.warn('no frontmatter', file);
      continue;
    }
    const block = fm[1];
    const cover = block.match(/^cover:\s*["']?([^"'\n]+)["']?/m);
    if (cover) set.add(cover[1].trim());
    const gal = block.match(/^gallery:\s*\n((?:[ \t]*-[ \t]*["']?[^"'\n]+["']?\n?)*)/m);
    if (gal) {
      for (const line of gal[1].split('\n')) {
        const m = line.match(/-\s*["']?([^"'\n]+)["']?/);
        if (m) set.add(m[1].trim());
      }
    }
  }
  // Skip brand marks / logos; keep screenshots & craft shots
  return [...set].filter(
    (p) => /\.(webp|jpe?g|png)$/i.test(p) && !/(^|\/)logo(\.|-)|skate-logo/i.test(p),
  );
}

function publicFile(sitePath) {
  return path.join(root, 'public', sitePath.replace(/^\//, ''));
}

function hiPath(sitePath) {
  return sitePath.replace(/(\.\w+)$/, '@2x.webp');
}

function toPngInput(srcAbs, stamp) {
  const out = path.join(tmpDir, `${stamp}-in.png`);
  // Real-ESRGAN reads png/jpg reliably
  return sharp(srcAbs).png().toFile(out).then(() => out);
}

async function upscaleOne(sitePath) {
  const srcAbs = publicFile(sitePath);
  const outSite = hiPath(sitePath);
  const outAbs = publicFile(outSite);

  if (!existsSync(srcAbs)) {
    console.warn('skip missing', sitePath);
    return;
  }

  if (existsSync(outAbs)) {
    const srcStat = (await import('node:fs')).statSync(srcAbs);
    const hiStat = (await import('node:fs')).statSync(outAbs);
    if (hiStat.mtimeMs >= srcStat.mtimeMs && hiStat.size > 20_000) {
      console.log('ok  ', outSite);
      return;
    }
  }

  mkdirSync(path.dirname(outAbs), { recursive: true });
  const stamp = Buffer.from(sitePath).toString('base64url').slice(0, 24);
  const pngIn = await toPngInput(srcAbs, stamp);
  const pngOut = path.join(tmpDir, `${stamp}-out.png`);

  console.log('AI  ', sitePath, '→', outSite);
  execFileSync(
    exe,
    ['-i', pngIn, '-o', pngOut, '-n', 'realesrgan-x4plus', '-s', '2', '-g', '0'],
    { stdio: 'inherit', cwd: path.dirname(exe) },
  );

  let pipeline = sharp(pngOut);
  const meta = await pipeline.metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;
  if (Math.max(w, h) > MAX_EDGE) {
    pipeline = sharp(pngOut).resize({
      width: w >= h ? MAX_EDGE : undefined,
      height: h > w ? MAX_EDGE : undefined,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  await pipeline.webp({ quality: WEBP_Q, effort: 5 }).toFile(outAbs);

  try {
    unlinkSync(pngIn);
    unlinkSync(pngOut);
  } catch {
    /* ignore */
  }
  console.log('done', outSite);
}

const paths = collectPaths();
console.log(`Upscaling ${paths.length} gallery/cover images…`);
for (const p of paths) {
  try {
    await upscaleOne(p);
  } catch (err) {
    console.error('FAIL', p, err?.message || err);
  }
}
console.log('All done.');
