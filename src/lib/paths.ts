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
