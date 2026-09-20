// The room a hero machine reflects. build-hall-environment.mjs lights the whole hall and is nearly black towards the
// viewer, so a glossy front has nothing to mirror and its surface reads flat. This one puts what stands opposite a
// machine in a real arcade behind the camera: ceiling strips, a row of lit screens in the hall's palette, a broad dim
// fill. Same offline PMREM prefilter and file format; only hero materials use it (src/components/hall/heroMaterial.ts).
//   node scripts/build-hero-environment.mjs  ->  public/textures/hero-environment-v1.bin.gz
import fs from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11'] });
try {
  const page = await browser.newPage();
  await page.route('https://environment.local/**', async route => {
    const name = new URL(route.request().url()).pathname;
    const file = { '/three.js': 'node_modules/three/build/three.module.js', '/three.core.js': 'node_modules/three/build/three.core.js' }[name];
    await route.fulfill({ contentType: file ? 'text/javascript' : 'text/html', body: file ? await fs.readFile(file, 'utf8') : '<script type="importmap">{"imports":{"three":"/three.js"}}</script>' });
  });
  await page.goto('https://environment.local/');
  const result = await page.evaluate(async () => {
    const T = await import('/three.js');
    const r = new T.WebGLRenderer({ antialias: true, alpha: false, stencil: false });
    const generator = new T.PMREMGenerator(r), room = new T.Scene();
    room.background = new T.Color(.008, .010, .016);
    room.add(new T.Mesh(new T.BoxGeometry(14, 8, 18), new T.MeshBasicMaterial({ color: 0x080a10, side: T.BackSide })));
    const lamps = [
      // [position, size, colour, power]; the machine stands at the origin and faces +z
      [[0, 3.8, 1.5], [7, .2, .5], 0xd4dbea, 3.4], [[0, 3.8, 5], [7, .2, .5], 0xd4dbea, 2.2],
      [[-5, 1.8, 0], [.15, 3, 2], 0xb4a5d0, 1.4], [[5, 1, -3], [.15, 2, 1.5], 0xb6cbd5, 1.7],
      [[-4.2, 1.45, 7], [1, .75, .1], 0xb9a6ff, 2.4], [[-2.1, 1.45, 7], [1, .75, .1], 0xa8d8ff, 2.2], [[0, 1.45, 7], [1, .75, .1], 0xffc4dc, 2],
      [[2.1, 1.45, 7], [1, .75, .1], 0xa8d8ff, 2.2], [[4.2, 1.45, 7], [1, .75, .1], 0xb9a6ff, 2.4],
      [[0, 2, 8], [11, 3.4, .1], 0x20242f, 1], [[0, .02, 3], [10, .02, 8], 0x14161d, 1],
    ];
    for (const [pos, size, color, power] of lamps) {
      const m = new T.Mesh(new T.BoxGeometry(...size), new T.MeshBasicMaterial({ color: new T.Color(color).multiplyScalar(power) }));
      m.position.set(...pos);
      room.add(m);
    }
    const target = generator.fromScene(room, .035), pixels = new Uint16Array(target.width * target.height * 4);
    await r.readRenderTargetPixelsAsync(target, 0, 0, target.width, target.height, pixels);
    const bytes = new Uint8Array(pixels.buffer);
    let str = '';
    for (let i = 0; i < bytes.length; i += 8192) str += String.fromCharCode(...bytes.subarray(i, i + 8192));
    const out = { width: target.width, height: target.height, data: btoa(str) };
    target.dispose(); generator.dispose(); r.dispose();
    return out;
  });
  const header = Buffer.alloc(8);
  header.writeUInt32LE(result.width, 0);
  header.writeUInt32LE(result.height, 4);
  const bytes = gzipSync(Buffer.concat([header, Buffer.from(result.data, 'base64')]), { level: 9 });
  await fs.writeFile('public/textures/hero-environment-v1.bin.gz', bytes);
  console.log({ width: result.width, height: result.height, bytes: bytes.length });
} finally { await browser.close(); }
