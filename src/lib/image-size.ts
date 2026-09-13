/** Build-time pixel size of a file under public/ (for width/height and og:image dimensions); cached per path. */
import sharp from 'sharp';
import path from 'node:path';

const cache = new Map<string, { width: number; height: number } | null>();

export async function imageSize(publicPath: string): Promise<{ width: number; height: number } | null> {
  const rel = publicPath.replace(/^\//, '').split('?')[0];
  const hit = cache.get(rel);
  if (hit !== undefined) return hit;
  let dims: { width: number; height: number } | null = null;
  try {
    const meta = await sharp(path.join(process.cwd(), 'public', rel)).metadata();
    if (meta.width && meta.height) dims = { width: meta.width, height: meta.height };
  } catch {
    dims = null;
  }
  cache.set(rel, dims);
  return dims;
}
