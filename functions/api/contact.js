/** Proxy to the contact Worker (Email Routing send_email lives there). */
export async function onRequestPost(context) {
  const url = new URL(context.request.url);
  const origin = context.request.headers.get('Origin');
  const fetchSite = context.request.headers.get('Sec-Fetch-Site');
  if ((origin && origin !== url.origin) || (fetchSite && fetchSite !== 'same-origin')) {
    return Response.json(
      { ok: false, error: 'forbidden' },
      { status: 403, headers: { 'cache-control': 'no-store' } },
    );
  }

  const contentLength = Number(context.request.headers.get('Content-Length') || 0);
  if (Number.isFinite(contentLength) && contentLength > 20_000) {
    return Response.json(
      { ok: false, error: 'payload_too_large' },
      { status: 413, headers: { 'cache-control': 'no-store' } },
    );
  }

  const worker = context.env.CONTACT_WORKER;
  if (!worker) {
    return Response.json({ ok: false, error: 'mail_unavailable' }, { status: 503 });
  }
  return worker.fetch(context.request);
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
    },
  });
}
