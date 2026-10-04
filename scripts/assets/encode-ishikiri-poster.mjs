import sharp from 'sharp';
const input = process.argv[2];
if (!input) throw new Error('Provide the 780x940 browser capture of the real Ishikiri exhibit.');
await sharp(input).resize(780,940).webp({quality:85}).toFile('public/media/mobile-arcade/ishikiri-v2.webp');
await sharp(input).resize(390,470).webp({quality:82}).toFile('public/media/mobile-arcade/ishikiri-v2-sm.webp');
