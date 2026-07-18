/** Allow only safe URL schemes for href/src/style backgrounds. */
export function safeHttpUrl(raw: string, fallback = ''): string {
  const v = String(raw ?? '').trim();
  if (!v) return fallback;
  if (v.startsWith('/') && !v.startsWith('//')) return v;
  if (v.startsWith('./') || v.startsWith('../')) return v;
  try {
    const u = new URL(v, 'https://dennisbf.design');
    if (u.protocol === 'https:' || u.protocol === 'http:') return v;
    if (u.protocol === 'mailto:' || u.protocol === 'tel:') return v;
  } catch {
    /* fall through */
  }
  return fallback;
}

/** Images: https/http/relative/data:image/* only */
export function safeImageUrl(raw: string, fallback = ''): string {
  const v = String(raw ?? '').trim();
  if (!v) return fallback;
  if (v.startsWith('/') && !v.startsWith('//')) return v;
  if (v.startsWith('data:image/')) return v;
  try {
    const u = new URL(v, 'https://dennisbf.design');
    if (u.protocol === 'https:' || u.protocol === 'http:') return v;
  } catch {
    /* fall through */
  }
  return fallback;
}

/** CSS url(...) — reject quotes/parens breakouts */
export function safeCssImageUrl(raw: string, fallback = ''): string {
  const v = safeImageUrl(raw, fallback);
  if (!v) return fallback;
  if (/["')\\\s]/.test(v.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/, ''))) {
    // allow data:image base64; reject other control chars
    if (!v.startsWith('data:image/')) return fallback;
  }
  if (v.includes('"') || v.includes("'") || v.includes(')')) return fallback;
  return v;
}
