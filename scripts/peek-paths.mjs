import fs from 'node:fs';
const h = fs.readFileSync(
  'C:/Users/denni/Documents/riftcast/site/portfolio/index.html',
  'utf8',
);
for (const needle of ['media/nexus/hero', 'href="/work', 'brand-mark', 'favicon.svg']) {
  const i = h.indexOf(needle);
  console.log(needle, '→', JSON.stringify(h.slice(Math.max(0, i - 25), i + needle.length + 10)));
}
