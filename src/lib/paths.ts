/** Site base path, always with trailing slash (e.g. `/` or `/portfolio/`). */
export const base = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

/** Join a site-relative path onto the configured base.
    Page routes get a trailing slash (avoids the 308 redirect hop on Pages);
    files, queries and anchors stay untouched. */
export function p(path = '') {
  if (!path || path === '/') return base;
  const clean = path.replace(/^\//, '');
  const joined = `${base}${clean}`;
  if (/\.[a-z0-9]+$/i.test(clean) || clean.includes('?') || clean.includes('#') || joined.endsWith('/')) {
    return joined;
  }
  return `${joined}/`;
}

const LOGO_LIVE_TOKENS = new Set([
  'nexus-splash',
  'berry-laugh',
  'riftcast-cast',
  'mina-heart',
  'fd-flash',
  'websites-stack',
]);

/** Resolve logoLive: keep motion tokens, asset-prefix file paths. */
export function resolveLogoLive(value?: string) {
  if (!value) return undefined;
  if (LOGO_LIVE_TOKENS.has(value)) return value;
  return p(value.replace(/^\//, ''));
}
