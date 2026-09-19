// Side-panel print for one hall station via the OpenAI Images API.
// usage: OPENAI_API_KEY=… node scripts/assets/generate-side-art.mjs <slug> "<motif sentence>" "<two accent colours>"
// Writes the PNG original to design-mockups/afterimage-textures/quiet-v2/<slug>.png, appends the exact
// prompt to prompts.json there and encodes the 768×1152 runtime WebP the hall loads by slug.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const [slug, motif, accents] = process.argv.slice(2);
const key = process.env.OPENAI_API_KEY;
if (!slug || !motif || !accents) throw new Error('usage: generate-side-art.mjs <slug> "<motif>" "<accents>"');
if (!key) throw new Error('OPENAI_API_KEY missing; nothing was requested.');

const prompt = `Generate a finished production texture artwork sheet for the full SIDE PANEL of a premium dark arcade machine. NOT a cabinet mockup or photo. Portrait 2:3 flat unlit print artwork, edge-to-edge. Project ${slug}. ${motif} Palette: near-black charcoal covering at least 75 percent of the sheet, with ${accents} used sparingly. Modern restrained screenprint illustration: ONE main bold silhouette or graphic motif, two or three broad shapes at most, subtle fine paper grain only. The motif occupies about one third of the area, with large clean areas of charcoal around it. Low visual noise, calm, confident, creative. A continuous composition flowing vertically across the full height, no rectangular picture inset, no borders, no sticker, no repeating patterns. Absolutely no dense ornament, engraving detail, tiny scattered objects, collage, clutter, text, letters, numbers, logos, UI, screenshots, buttons, cabinet, perspective, shadows, lighting, glow or reflections. Keep the focal motif within the central 55 percent width so it survives the shaped cabinet outline. Deliver just the flat portrait artwork.`;

const dir = 'design-mockups/afterimage-textures/quiet-v2';
const models = (process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-2,gpt-image-1').split(',');
// SIDE_ART_FROM=<variant png> promotes an already generated variant instead of requesting a new image
let png = process.env.SIDE_ART_FROM ? fs.readFileSync(process.env.SIDE_ART_FROM) : undefined;
let used = process.env.SIDE_ART_FROM ? (process.env.OPENAI_IMAGE_MODEL ?? models[0]) : undefined;
for (const model of png ? [] : models) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, prompt, size: '1024x1536', quality: 'high', n: 1 }),
  });
  const json = await res.json();
  if (res.ok && json.data?.[0]?.b64_json) { png = Buffer.from(json.data[0].b64_json, 'base64'); used = model; break; }
  console.warn(`${model}: ${res.status} ${json.error?.message ?? 'no image'}`);
}
if (!png) throw new Error('No image was generated.');

const suffix = process.env.SIDE_ART_VARIANT ? `-${process.env.SIDE_ART_VARIANT}` : '';
fs.writeFileSync(path.join(dir, `${slug}${suffix}.png`), png);
if (!suffix) {
  const file = path.join(dir, 'prompts.json');
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  record.prompts = record.prompts.filter((p) => p.slug !== slug);
  record.prompts.push({ slug, prompt, mode: `OpenAI Images API (${used})` });
  fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n');
  await sharp(png).resize(768, 1152, { fit: 'cover' }).webp({ quality: 88 }).toFile(`public/textures/cabinet-art/quiet-v2/${slug}.webp`);
}
console.log(`SIDE_ART ${slug}${suffix} via ${used}`);
