// One reference image through the OpenAI Images API (e.g. the source picture for a Meshy image-to-3D model).
// usage: OPENAI_API_KEY=… node scripts/assets/generate-image.mjs <out.png> "<prompt>" [size]
import fs from 'node:fs';
const [out, prompt, size = '1024x1024'] = process.argv.slice(2);
const key = process.env.OPENAI_API_KEY;
if (!out || !prompt) throw new Error('usage: generate-image.mjs <out.png> "<prompt>" [size]');
if (!key) throw new Error('OPENAI_API_KEY missing; nothing was requested.');
const res = await fetch('https://api.openai.com/v1/images/generations', {
  method: 'POST',
  headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
  body: JSON.stringify({ model: process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-2', prompt, size, quality: 'high', n: 1 }),
});
const json = await res.json();
if (!res.ok || !json.data?.[0]?.b64_json) throw new Error(`${res.status} ${json.error?.message ?? 'no image'}`);
fs.writeFileSync(out, Buffer.from(json.data[0].b64_json, 'base64'));
fs.writeFileSync(out.replace(/\.png$/, '.prompt.txt'), prompt + '\n');
console.log('IMAGE', out);
