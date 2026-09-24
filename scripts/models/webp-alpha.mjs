// Re-encode only the alpha plane of a lossy WebP: the VP8 (colour) bitstream stays byte-identical, the lossless
// ALPH chunk is swapped for a lossy one (libwebp alpha_quality). The hero machines' mask atlas carries its wear
// zones in alpha, and lossless alpha is about 80 % of that file (measured 2026-09-25 on cab-echo-frequency-v2).
//   node scripts/models/webp-alpha.mjs [--quality 75] < in.webp > out.webp     (stats as JSON on stderr)
// Leaves the input unchanged (and says why) when it has no lossless ALPH chunk or the new chunk would not be smaller.
// sharp only: gzip-models.mjs runs this as a child process, because sharp and @gltf-transform/functions must not
// share a process (two native sharp builds live in node_modules).
import sharp from 'sharp';
import { pathToFileURL } from 'node:url';

/** RIFF chunks of a WebP file: [{ id, start, end }] (end includes the pad byte). */
export function webpChunks(buf) {
  if (buf.length < 12 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const chunks = [];
  for (let o = 12; o + 8 <= buf.length;) {
    const len = buf.readUInt32LE(o + 4);
    const end = o + 8 + len + (len & 1);
    chunks.push({ id: buf.toString('ascii', o, o + 4), start: o, end: Math.min(end, buf.length) });
    o = end;
  }
  return chunks;
}

export async function reencodeAlpha(input, quality = 75) {
  const chunks = webpChunks(input);
  const alph = chunks?.find((c) => c.id === 'ALPH');
  if (!chunks || !alph || !chunks.some((c) => c.id === 'VP8 ')) return { out: input, note: 'no lossy colour + ALPH chunk' };
  // ALPH header byte: reserved(2) | pre-processing(2) | filtering(2) | compression(2). Pre-processing 1 = already
  // level-reduced (lossy); running the pass again would compound the error.
  const header = input[alph.start + 8];
  if ((header >> 4) & 3) return { out: input, note: 'alpha already lossy' };

  const src = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = src.info;
  const encoded = await sharp(src.data, { raw: { width, height, channels: 4 } })
    .webp({ quality: 90, alphaQuality: quality, effort: 6 })
    .toBuffer();
  const fresh = webpChunks(encoded)?.find((c) => c.id === 'ALPH');
  if (!fresh) return { out: input, note: 'encoder wrote no ALPH chunk' };
  const parts = chunks.map((c) => (c.id === 'ALPH' ? encoded.subarray(fresh.start, fresh.end) : input.subarray(c.start, c.end)));
  const body = Buffer.concat(parts);
  const out = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), body]);
  out.writeUInt32LE(out.length - 8, 4);
  if (out.length >= input.length) return { out: input, note: 'not smaller' };

  // Verify: colour identical, alpha within the reported error.
  const dst = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (dst.info.width !== width || dst.info.height !== height) throw new Error('size changed');
  let rgbMax = 0, aMax = 0, aSum = 0;
  for (let i = 0; i < src.data.length; i += 4) {
    for (let k = 0; k < 3; k++) rgbMax = Math.max(rgbMax, Math.abs(src.data[i + k] - dst.data[i + k]));
    const d = Math.abs(src.data[i + 3] - dst.data[i + 3]);
    aMax = Math.max(aMax, d); aSum += d;
  }
  return { out, before: input.length, after: out.length, rgbMaxError: rgbMax, alphaMaxError: aMax, alphaMeanError: +(aSum / (width * height)).toFixed(4) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const i = process.argv.indexOf('--quality');
  const quality = i > 0 ? Number(process.argv[i + 1]) : 75;
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  const { out, ...stats } = await reencodeAlpha(Buffer.concat(chunks), quality);
  process.stderr.write(JSON.stringify(stats) + '\n');
  process.stdout.write(out);
}
