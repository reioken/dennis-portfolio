/** Small, short-lived cache for likely hall destinations; never a site-wide crawl. */
type PreparedRoute = { document: Document; expires: number };
type Preparation = Event & {
  to: URL;
  signal: AbortSignal;
  formData?: FormData;
  newDocument: Document;
  loader: () => Promise<void>;
};
const prepared = new Map<string, PreparedRoute>();
const inflight = new Map<string, Promise<void>>();
const styles = new Map<string, Promise<boolean>>();
const MAX_ROUTES = 6;
const MAX_AGE = 30_000;

function keyFor(href: string) {
  const url = new URL(href, location.href);
  if (url.origin !== location.origin || url.search) return null;
  url.hash = '';
  return url.href;
}

function warmStyle(href: string): Promise<boolean> {
  const url = new URL(href, location.href);
  // Only Astro's immutable local CSS is needed to unblock its document swap.
  if (url.origin !== location.origin || !url.pathname.startsWith('/_astro/')) return Promise.resolve(false);
  if ([...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].some((link) => link.href === url.href)) return Promise.resolve(true);
  const existing = styles.get(url.href);
  if (existing) return existing;
  const pending = new Promise<boolean>((resolve) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'style';
    link.href = url.href;
    let timer = 0;
    const finish = (ok: boolean) => {
      clearTimeout(timer);
      link.onload = link.onerror = null;
      link.remove();
      if (!ok) styles.delete(url.href);
      resolve(ok);
    };
    link.onload = () => finish(true);
    link.onerror = () => finish(false);
    timer = window.setTimeout(() => finish(false), 8000);
    document.head.append(link);
  });
  styles.set(url.href, pending);
  return pending;
}

/** Warm HTML and its blocking stylesheet set, after the visible room has loaded. */
export function warmHallRoute(href: string): void {
  if (import.meta.env.DEV || !navigator.onLine) return;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (connection?.saveData || /2g/.test(connection?.effectiveType ?? '')) return;
  const key = keyFor(href);
  if (!key || key === keyFor(location.href) || (prepared.get(key)?.expires ?? 0) > performance.now() || inflight.has(key)) return;
  // A fast swipe should not start unbounded speculative requests.
  if (inflight.size >= 3) return;
  const operation = (async () => {
    try {
      const response = await fetch(key, { priority: 'low', signal: AbortSignal.timeout(8000) });
      if (!response.ok || response.redirected || !response.headers.get('content-type')?.includes('text/html')) return;
      if (/no-store|private/i.test(response.headers.get('cache-control') ?? '')) return;
      const parsed = new DOMParser().parseFromString(await response.text(), 'text/html');
      if (!parsed.querySelector('meta[name="astro-view-transitions-enabled"]')) return;
      // Match Astro's default loader; noscript is parsed differently in a detached document.
      parsed.querySelectorAll('noscript').forEach((element) => element.remove());
      const loaded = await Promise.all([...parsed.querySelectorAll<HTMLLinkElement>('head link[rel="stylesheet"]')].map((link) => warmStyle(link.getAttribute('href')!)));
      if (loaded.some((ok) => !ok)) return;
      prepared.delete(key);
      prepared.set(key, { document: parsed, expires: performance.now() + MAX_AGE });
      performance.mark('hall:route-prepared', { detail: { path: new URL(key).pathname } });
      while (prepared.size > MAX_ROUTES) prepared.delete(prepared.keys().next().value!);
    } catch { /* Speculation never changes normal navigation or its error handling. */ }
    finally { inflight.delete(key); }
  })();
  inflight.set(key, operation);
}

/** Do not await unfinished speculation: a cache miss keeps Astro's normal loader. */
export function usePreparedHallRoute(event: Preparation): boolean {
  if (import.meta.env.DEV || event.formData || event.signal.aborted) return false;
  const key = keyFor(event.to.href);
  const entry = key ? prepared.get(key) : undefined;
  if (!entry || entry.expires <= performance.now()) {
    if (key) prepared.delete(key);
    return false;
  }
  event.loader = async () => {
    if (!event.signal.aborted) event.newDocument = entry.document.cloneNode(true) as Document;
  };
  return true;
}
