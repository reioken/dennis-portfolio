import sharp from 'sharp';
const [art, logo] = process.argv.slice(2);
if (!art || !logo) throw new Error('Provide the generated graphic and official transparent logo.');
await sharp(art).resize(768,1152).webp({quality:90}).toFile('public/textures/cabinet-art/quiet-v2/ishikiri-v2.webp');
await sharp(logo).resize({width:1536}).webp({lossless:true}).toFile('public/media/ishikiri/logo-ink.webp');
