import albumLengths from './album-lengths.json';

/** Pages serves whole files for Range requests. Stream single audio ranges for seeking without buffering the album. */
export async function onRequestGet(context) {
  const range = context.request.headers.get('range');
  const validator = context.request.headers.get('if-range');
  const assetHeaders = new Headers(context.request.headers);
  // Request the complete, unencoded representation so its length is available before slicing.
  assetHeaders.delete('Range');
  assetHeaders.delete('If-Range');
  assetHeaders.set('Accept-Encoding', 'identity');
  const response = await context.next(new Request(context.request, { headers: assetHeaders }));
  const pathname = new URL(context.request.url).pathname;
  if (!pathname.endsWith('.m4a') || response.status !== 200 || !response.body) return response;
  // Pages exposes the full body but no internal Content-Length. This manifest is checked against the actual files.
  const size = Number(response.headers.get('content-length') ?? albumLengths[pathname]);
  if (!Number.isSafeInteger(size) || size < 0 || response.headers.has('content-encoding')) return response;
  const headers = new Headers(response.headers);
  headers.set('Accept-Ranges', 'bytes');
  const whole = () => new Response(response.body, { status: 200, headers });
  if (!range) return whole();
  if (validator && (validator.startsWith('W/') || (validator !== headers.get('etag') && validator !== headers.get('last-modified')))) return whole();
  // Malformed or multiple ranges are ignored; media elements use one range at a time.
  const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim());
  if (!match || (!match[1] && !match[2])) return whole();
  const first = match[1] ? Number(match[1]) : null;
  const last = match[2] ? Number(match[2]) : null;
  if ((first !== null && !Number.isSafeInteger(first)) || (last !== null && !Number.isSafeInteger(last))) return whole();
  const start = first === null ? Math.max(0, size - last) : first;
  const end = first === null || last === null ? size - 1 : Math.min(last, size - 1);
  if (size === 0 || start >= size || end < start || (first === null && last === 0)) {
    await response.body.cancel();
    headers.set('Content-Range', `bytes */${size}`);
    headers.delete('Content-Length');
    return new Response(null, { status: 416, headers });
  }
  const reader = response.body.getReader();
  let offset = 0;
  const sliced = new ReadableStream({
    async pull(controller) {
      while (offset <= end) {
        const { value, done } = await reader.read();
        if (done) throw new Error('Audio asset ended before the requested range');
        const from = Math.max(0, start - offset);
        const to = Math.min(value.byteLength, end + 1 - offset);
        offset += value.byteLength;
        if (to > from) controller.enqueue(value.subarray(from, to));
        if (offset > end) {
          controller.close();
          await reader.cancel();
          return;
        }
        if (to > from) return;
      }
    },
    cancel(reason) { return reader.cancel(reason); },
  });
  // Workers derives Content-Length from FixedLengthStream rather than accepting a manually set length.
  const length = end - start + 1;
  const fixed = new FixedLengthStream(length);
  void sliced.pipeTo(fixed.writable).catch(error => {
    if (error?.name !== 'AbortError') console.warn('[album] Audio range stream interrupted', error);
  });
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.delete('Content-Length');
  return new Response(fixed.readable, { status: 206, headers });
}
