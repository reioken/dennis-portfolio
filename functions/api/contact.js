/** Proxy to the contact Worker (Email Routing send_email lives there). */
export async function onRequestPost(context) {
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
