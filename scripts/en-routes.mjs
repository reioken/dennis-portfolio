import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * Erzeugt nach dem Build echte, crawlbare /en/-Routen aus den DE-Seiten.
 *
 * Warum so und nicht als doppelte Templates: Die Seiten rendern ohnehin beide
 * Sprachen ins DOM (data-lang-Spans, CSS blendet um). Die EN-Kopie setzt nur
 * html[lang]/[data-lang] auf "en" (damit ist der EN-Text die sichtbare
 * Sprache), lokalisiert Canonical/Title/Description, schreibt interne Links
 * auf /en/-Pfade um (inkl. der serialisierten Island-Props, damit Links nach
 * der Hydration nicht auf DE zurückfallen) und verlinkt beide Versionen per
 * hreflang. Neue Case Studies bekommen ihre EN-Route dadurch automatisch.
 */

const SITE = 'https://www.dennisbf.design';
/** Seitenrouten, die auf /en/ umgeschrieben werden (Assets/API bleiben unberührt) */
const ROUTES = ['work', 'about', 'contact', 'lab', 'impressum', 'privacy'];

/** Englische Titles/Descriptions je Route ('' = Startseite) */
const META_EN = {
  '': {
    desc: 'Art director & UI/UX designer — Floordirekt, NEXUS, Berry, Riftcast.',
  },
  'work/': {
    title: 'Projects — Dennis Bierreth-Fernandez',
    desc: 'Projects by Dennis Bierreth-Fernandez: NEXUS, Berry, Riftcast, Floordirekt Studio — product design, UX/UI, branding and craft.',
  },
  'about/': {
    title: 'About — Dennis Bierreth-Fernandez',
    desc: 'Dennis Bierreth-Fernandez — art director & UI/UX designer. 6+ years agency and in-house: Floordirekt, NEXUS, Berry, Riftcast, Forever, performio.',
  },
  'contact/': {
    title: 'Contact — Dennis Bierreth-Fernandez',
    desc: 'Contact Dennis Bierreth-Fernandez — art direction, UX/UI, branding, video or product. Use the form or email directly.',
  },
  'lab/': {
    title: 'Lab — Dennis Bierreth-Fernandez',
    desc: 'Lab — experiments, WIP and side builds like Ashwake (Godot).',
  },
  'privacy/': {
    title: 'Privacy — Dennis Bierreth-Fernandez',
    desc: 'Privacy policy for dennisbf.design.',
  },
  'impressum/': {
    desc: 'Legal notice (Impressum) for dennisbf.design.',
  },
  'work/nexus/': {
    desc: 'Premium desktop game library — Steam, Riot, Blizzard and local libraries in one interface.',
  },
  'work/berry/': {
    desc: 'Mobile collector app for card collections — product design, app UI and design system v3.',
  },
  'work/riftcast/': {
    desc: 'Remote desktop for your own network — mirror, control and play your PC on phone and browser. No cloud account.',
  },
  'work/floordirekt/': {
    desc: 'Studio workflow and imagery system for shop product images — variants, translations, batch export.',
  },
  'work/mina/': {
    desc: 'UX/UI bootcamp case at neuefische — research, wireframes, usability tests and Figma prototypes.',
  },
  'work/forever/': {
    desc: 'Brand communication print & digital, social video, product photography and high-end retouching.',
  },
  'work/visual-craft/': {
    desc: 'Logo systems, brand mockups and landing concepts — curated craft.',
  },
  'work/web-clients/': {
    desc: 'Client websites and shop/campaign work — clear hero hierarchy and retail UI.',
  },
  'work/ashwake/': {
    desc: 'Godot lab — combat and atmosphere as an ongoing experiment.',
  },
};

async function collectPages(dir, base = '') {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'en' && base === '') continue; // eigene Ausgabe nicht erneut kopieren
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collectPages(abs, `${base}${entry.name}/`)));
    } else if (entry.name === 'index.html') {
      out.push({ abs, rel: base });
    }
  }
  return out;
}

function hreflangBlock(rel) {
  const de = `${SITE}/${rel}`;
  const en = `${SITE}/en/${rel}`;
  return (
    `<link rel="alternate" hreflang="de" href="${de}">` +
    `<link rel="alternate" hreflang="en" href="${en}">` +
    `<link rel="alternate" hreflang="x-default" href="${de}">`
  );
}

function toEnglish(html, rel) {
  let out = html;

  // Sichtbare Sprache serverseitig auf EN stellen
  out = out.replace('<html lang="de" data-lang="de"', '<html lang="en" data-lang="en"');

  // Canonical + og:url auf die /en/-URL
  out = out.replace(
    /(<link rel="canonical" href=")[^"]+(")/,
    `$1${SITE}/en/${rel}$2`,
  );
  out = out.replace(
    /(<meta property="og:url" content=")[^"]+(")/,
    `$1${SITE}/en/${rel}$2`,
  );

  // Interne Seitenlinks → /en/… (Assets, /api, /_astro bleiben unberührt)
  const routeAlt = ROUTES.join('|');
  out = out.replaceAll('href="/"', 'href="/en/"');
  out = out.replace(new RegExp(`href="/(${routeAlt})/`, 'g'), 'href="/en/$1/');
  // …auch in den serialisierten Island-Props (sonst kippen Links nach Hydration auf DE)
  out = out.replaceAll('&quot;/&quot;', '&quot;/en/&quot;');
  out = out.replace(new RegExp(`&quot;/(${routeAlt})/`, 'g'), '&quot;/en/$1/');

  // Title/Description lokalisieren, wo ein EN-Text hinterlegt ist
  const meta = META_EN[rel];
  if (meta?.title) {
    out = out.replace(/<title>[^<]*<\/title>/, `<title>${meta.title}</title>`);
  }
  if (meta?.desc) {
    out = out.replace(/(<meta name="description" content=")[^"]*(")/, `$1${meta.desc}$2`);
    out = out.replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${meta.desc}$2`);
    out = out.replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${meta.desc}$2`);
  }

  return out;
}

export async function buildEnRoutes(distDir) {
  const pages = await collectPages(distDir);
  let count = 0;

  for (const page of pages) {
    const html = await readFile(page.abs, 'utf8');
    const block = hreflangBlock(page.rel);

    // hreflang in die DE-Originalseite
    if (!html.includes('hreflang="de"')) {
      await writeFile(page.abs, html.replace('</head>', `${block}</head>`));
    }

    // EN-Kopie erzeugen
    const enHtml = toEnglish(html, page.rel).replace('</head>', `${block}</head>`);
    const enPath = path.join(distDir, 'en', page.rel, 'index.html');
    await mkdir(path.dirname(enPath), { recursive: true });
    await writeFile(enPath, enHtml);
    count++;
  }

  // Sitemap um die /en/-URLs ergänzen
  const sitemapPath = path.join(distDir, 'sitemap-0.xml');
  try {
    const xml = await readFile(sitemapPath, 'utf8');
    if (!xml.includes(`${SITE}/en/`)) {
      const entries = xml.match(/<url>.*?<\/url>/gs) ?? [];
      const enEntries = entries
        .map((e) => e.replace(`<loc>${SITE}/`, `<loc>${SITE}/en/`))
        .join('');
      await writeFile(sitemapPath, xml.replace('</urlset>', `${enEntries}</urlset>`));
    }
  } catch {
    console.warn('[en-routes] sitemap-0.xml nicht gefunden — übersprungen');
  }

  console.log(`[en-routes] ${count} EN-Seiten unter /en/ erzeugt, hreflang verlinkt`);
}
