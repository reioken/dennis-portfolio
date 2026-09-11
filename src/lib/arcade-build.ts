import fs from 'node:fs';
import path from 'node:path';
import { p } from './paths';

/** Game documents must never share the portfolio's /arcade/ route namespace. */
export function arcadeBuild(id: string | undefined): string | undefined {
  if (!id || !/^[a-z0-9-]+$/.test(id)) return undefined;
  const base = import.meta.env.PUBLIC_ARCADE_BASE?.replace(/\/+$/, '');
  // A remote release is explicitly enabled after its ready protocol has been verified.
  const released = (import.meta.env.PUBLIC_ARCADE_RELEASES ?? '').split(',').map((v: string) => v.trim());
  if (base && released.includes(id)) {
    try {
      const url = new URL(`${base}/${id}/index.html`);
      if (url.protocol === 'https:' && !url.pathname.startsWith('/arcade/')) return url.href;
    } catch { /* An invalid release configuration stays unavailable. */ }
  }
  const dir = path.join(process.cwd(), 'public', 'game-builds', id);
  try {
    const marker = JSON.parse(fs.readFileSync(path.join(dir, 'portfolio-ready.json'), 'utf8'));
    if (marker.id === id && marker.protocol === 1 && fs.existsSync(path.join(dir, 'index.html'))) return p(`game-builds/${id}/index.html`);
  } catch { /* Missing, incomplete or outdated exports stay unavailable. */ }
  return undefined;
}
