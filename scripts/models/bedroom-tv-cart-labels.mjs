// Cartridge labels for the TV corner, composed from the recorded box art (bedroom-tv-art*.mjs sources).
// SNES PAL labels are wide (≈2.9:1): the whole box art at full label height, its blurred extension behind it.
// N64 labels follow the real PAL cartridge label (61 x 49 mm): the box layout with its NINTENDO64 band, filled edge
// to edge (cover fit trims only the side icons).
// Writes .source-assets/bedroom-tv/labels/<id>-label.png; nothing is cropped away, so titles stay readable.
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
const art = '.source-assets/bedroom-tv', out = `${art}/labels`;
await mkdir(out, { recursive: true });
const snes = ['yoshi', 'link-past', 'mario-world'], n64 = ['smash64', 'ocarina', 'mario64', 'mariokart64'];
for (const id of snes) {
  const src = `${art}/${id}-Named_Boxarts.png`, W = 1180, H = 410;
  const back = await sharp(src).resize(W, H, { fit: 'cover' }).blur(18).modulate({ brightness: .85 }).toBuffer();
  const front = await sharp(src).resize({ height: H - 16, width: W - 16, fit: 'inside' }).toBuffer();
  const meta = await sharp(front).metadata();
  await sharp(back).composite([{ input: front, left: Math.round((W - meta.width) / 2), top: 8 }]).png().toFile(`${out}/${id}-label.png`);
  console.log(id, 'snes', meta.width, meta.height);
}
for (const id of n64) {
  const src = `${art}/${id}-Named_Boxarts.png`, W = 640, H = 514;
  await sharp(src).resize(W, H, { fit: 'cover', position: 'centre' }).png().toFile(`${out}/${id}-label.png`);
  console.log(id, 'n64', W, H);
}
