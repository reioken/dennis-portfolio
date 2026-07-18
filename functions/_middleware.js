/** Send apex traffic to www so media isn't split across two cache keys. */
export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname === 'dennisbf.design') {
    url.hostname = 'www.dennisbf.design';
    // 308 keeps method/body (needed if anything POSTs to the apex host)
    return Response.redirect(url.toString(), 308);
  }
  return context.next();
}
