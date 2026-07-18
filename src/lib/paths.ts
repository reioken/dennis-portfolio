/** Site base path, always with trailing slash (e.g. `/` or `/portfolio/`). */
export const base = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

/** Join a site-relative path onto the configured base. */
export function p(path = '') {
  if (!path || path === '/') return base;
  const clean = path.replace(/^\//, '');
  return `${base}${clean}`;
}

const LOGO_LIVE_TOKENS = new Set(['nexus-splash', 'berry-laugh']);

/** Resolve logoLive: keep motion tokens, asset-prefix file paths. */
export function resolveLogoLive(value?: string) {
  if (!value) return undefined;
  if (LOGO_LIVE_TOKENS.has(value)) return value;
  return p(value.replace(/^\//, ''));
}
