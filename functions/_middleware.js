/** Send apex traffic to www so media isn't split across two cache keys. */
export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname === 'dennisbf.design') {
    url.hostname = 'www.dennisbf.design';
    return Response.redirect(url.toString(), 301);
  }
  return context.next();
}
