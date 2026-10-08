import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const albumLengths = JSON.parse(fs.readFileSync(new URL('../../functions/media/music/album-lengths.json',import.meta.url),'utf8'));
const source = fs.readFileSync(new URL('../../functions/media/music/[[path]].js', import.meta.url), 'utf8').replace("import albumLengths from './album-lengths.json';",'').replace('export async function onRequestGet', 'async function onRequestGet');
const runtime = vm.createContext({ Request, Response, Headers, URL, ReadableStream, console,
  albumLengths: {...albumLengths, '/media/music/manifest.m4a':20},
  FixedLengthStream: class extends TransformStream { constructor() { super(); } } });
vm.runInContext(source, runtime);
const onRequestGet = vm.runInContext('onRequestGet', runtime);
const bytes = Uint8Array.from({ length: 20 }, (_, i) => i);
function request(range, { method = 'GET', ifRange, pathname = 'track.m4a', status = 200, size = 20, encoding } = {}) {
  let cancelled = false;
  let offset = 0;
  const body = new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) return controller.close();
      controller.enqueue(bytes.slice(offset, offset + 4)); offset += 4;
    },
    cancel() { cancelled = true; },
  });
  const headers = { 'content-type': 'audio/mp4', etag: '"album-v1"', 'x-content-type-options': 'nosniff' };
  if (size !== null) headers['content-length'] = String(size);
  if (encoding) headers['content-encoding'] = encoding;
  const upstream = new Response(body, { status, headers });
  const incoming = new Headers();
  if (range) incoming.set('Range', range);
  if (ifRange) incoming.set('If-Range', ifRange);
  return { run: () => onRequestGet({request: new Request(`https://preview.test/media/music/${pathname}`, { method, headers: incoming }), next: async request => {
    assert.equal(request.headers.has('range'),false);
    assert.equal(request.headers.has('if-range'),false);
    assert.equal(request.headers.get('accept-encoding'),'identity');
    return upstream;
  }}), cancelled: () => cancelled };
}

test('audio ranges stream exact closed, open-ended, suffix and clamped byte intervals', async () => {
  for (const [range, start, end] of [['bytes=3-8',3,8],['bytes=12-',12,19],['bytes=-5',15,19],['bytes=17-99',17,19],['bytes=-99',0,19]]) {
    const fixture = request(range), response = await fixture.run();
    assert.equal(response.status,206);
    assert.equal(response.headers.get('content-range'),`bytes ${start}-${end}/20`);
    assert.equal(response.headers.get('accept-ranges'),'bytes');
    assert.equal(response.headers.get('x-content-type-options'),'nosniff');
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes.slice(start,end+1));
    if (end < 19) assert.equal(fixture.cancelled(),true);
  }
});
test('unsatisfiable audio ranges return 416 and release the source body', async () => {
  for (const range of ['bytes=20-','bytes=7-2','bytes=-0']) {
    const fixture=request(range), response=await fixture.run();
    assert.equal(response.status,416);
    assert.equal(response.headers.get('content-range'),'bytes */20');
    assert.equal((await response.arrayBuffer()).byteLength,0);
    assert.equal(fixture.cancelled(),true);
  }
});
test('malformed, multiple and oversized numeric ranges preserve the complete response', async () => {
  for (const range of [undefined,'bytes=-','items=0-1','bytes=0-1,3-4','bytes=99999999999999999999-']) {
    const response=await request(range).run();
    assert.equal(response.status,200);
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()),bytes);
  }
});
test('If-Range matches only a strong validator and otherwise returns the whole audio file', async () => {
  for (const [ifRange, status] of [['"album-v1"',206],['"album-v0"',200],['W/"album-v1"',200]]) {
    const response=await request('bytes=0-3',{ifRange}).run();
    assert.equal(response.status,status);
    await response.arrayBuffer();
  }
});
test('non-audio, missing, encoded and unknown-size responses pass through unchanged', async () => {
  for (const options of [{pathname:'cover.webp'},{status:404},{encoding:'gzip'},{size:null}]) {
    const response=await request('bytes=0-3',options).run();
    assert.equal(response.status,options.status??200);
    assert.equal(response.headers.has('content-range'),false);
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()),bytes);
  }
});
test('known album size metadata supports Pages responses without internal Content-Length', async () => {
  const response=await request('bytes=5-9',{pathname:'manifest.m4a',size:null}).run();
  assert.equal(response.status,206);
  assert.equal(response.headers.get('content-range'),'bytes 5-9/20');
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()),bytes.slice(5,10));
});
test('album range size metadata matches all six hosted audio sources', () => {
  assert.equal(Object.keys(albumLengths).length,6);
  for (const [path,size] of Object.entries(albumLengths)) {
    assert.equal(fs.statSync(new URL('../../public'+path,import.meta.url)).size,size,path);
  }
});
