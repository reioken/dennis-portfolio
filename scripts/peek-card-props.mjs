import { readFileSync } from 'node:fs';

const html = readFileSync('dist/index.html', 'utf8');
const re = /<astro-island\b([^>]*)>/g;
let m;
while ((m = re.exec(html))) {
  const attrs = m[1];
  if (!attrs.includes('ProjectCard')) continue;
  const propsMatch = attrs.match(/props="([^"]*)"/);
  const raw = propsMatch?.[1]?.replace(/&quot;/g, '"') ?? '';
  try {
    const parsed = JSON.parse(raw);
    // Astro serializes as [type, value] tuples sometimes
    const flat = {};
    for (const [k, v] of Object.entries(parsed)) {
      flat[k] = Array.isArray(v) ? v[1] : v;
    }
    console.log({
      title: flat.title,
      logo: flat.logo,
      cover: flat.cover,
      featured: flat.featured,
    });
  } catch {
    console.log(raw.slice(0, 250));
  }
}
