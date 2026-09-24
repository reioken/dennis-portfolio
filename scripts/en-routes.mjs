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
const ROUTES = ['work', 'about', 'contact', 'lab', 'arcade', 'impressum', 'privacy'];

/** Englische Titles/Descriptions je Route ('' = Startseite) */
const META_EN = {
  '': {
    title: 'Dennis Bierreth-Fernandez — Art Director & Product Builder',
    desc: 'Art director, UX/UI designer and independent product builder — Floordirekt, NEXUS, Berry and Riftcast.',
  },
  'work/': {
    title: 'Projects — Dennis Bierreth-Fernandez',
    desc: 'Projects by Dennis Bierreth-Fernandez: NEXUS, Berry, Riftcast and Mina — product design, UX/UI, branding and craft.',
  },
  'about/': {
    title: 'About — Dennis Bierreth-Fernandez',
    desc: 'Dennis Bierreth-Fernandez — art director, UX/UI designer and independent product builder. Available for selected freelance projects.',
  },
  'contact/': {
    title: 'Contact — Dennis Bierreth-Fernandez',
    desc: 'Contact Dennis Bierreth-Fernandez for selected freelance projects in art direction, UX/UI, branding, video and digital products.',
  },
  'lab/': {
    title: 'Lab — Dennis Bierreth-Fernandez',
    desc: 'Lab — experiments, WIP and side builds like Carillon (Godot).',
  },
  'arcade/': {
    title: 'Arcade — Dennis Bierreth-Fernandez',
    desc: 'Original games, concepts, screenshots and development progress.',
  },
  'arcade/echo-frequency/': {
    title: 'Echo Frequency — Arcade — Dennis Bierreth-Fernandez',
    desc: 'Echo Frequency — radio mystery game in development. Browser release status and project details.',
  },
  'work/safeplate/': {
    title: 'Essfreude — Dennis Bierreth-Fernandez',
    desc: 'A kitchen field guide for people with dietary restrictions — atlas, dishes, journal, offline and without diagnostic claims.',
  },
  'work/carillon/': {
    title: 'Carillon — Dennis Bierreth-Fernandez',
    desc: 'Survivor-roguelite in Godot 4.7 — forge a build around the Last Ember, then hold the night vigil.',
  },
  'work/echo-frequency/': {
    title: 'Echo Frequency — Dennis Bierreth-Fernandez',
    desc: 'A radio mystery game in Godot — signals, evidence and a pinboard.',
  },
  'work/cab-no-9/': {
    title: 'Cab No. 9 — Dennis Bierreth-Fernandez',
    desc: 'PSX-style supernatural taxi narrative game in Godot 4.7 — drive souls through the afterlife.',
  },
  'work/saute-survivors/': {
    title: 'Sauté Survivors — Dennis Bierreth-Fernandez',
    desc: 'Unity bullet-heaven in a kitchen — Nori versus the dinner rush.',
  },
  'work/lowlight/': {
    title: 'Lowlight — Dennis Bierreth-Fernandez',
    desc: 'Resizable Windows companion for Spotify — Obsidian and Frosted Glass themes.',
  },
  'work/vgm-battle/': {
    title: 'VGM Battle — Dennis Bierreth-Fernandez',
    desc: 'Battle, rank and discover the greatest video game music ever written.',
  },
  'work/riftback/': {
    title: 'Riftback — Dennis Bierreth-Fernandez',
    desc: 'Fan reference for League Classic: builds, champions, items, runes, jungle and tier lists — without invented win rates.',
  },
  'work/briefly/': {
    title: 'Briefly — Dennis Bierreth-Fernandez',
    desc: 'A personal 7:00 news briefing app — eleven rubrics, generated daily.',
  },
  'work/hookline/': {
    title: 'Hookline — Dennis Bierreth-Fernandez',
    desc: 'A studio in the browser: instrumental, lyrics with section tags, a voice, render. Its first song is CEILING.',
  },
  'privacy/': {
    title: 'Privacy — Dennis Bierreth-Fernandez',
    desc: 'Privacy policy for dennisbf.design.',
  },
  'work/nexus/': {
    title: 'NEXUS — Dennis Bierreth-Fernandez',
    desc: 'Premium desktop game library — Steam, Riot, Blizzard and local libraries in one interface.',
  },
  'work/snapsize/': {
    title: 'Snapsize — Dennis Bierreth-Fernandez',
    desc: 'Resize the window to exact device and breakpoint sizes in one click. Sweep through breakpoints, compare sizes side by side, and save screenshots at each size.',
  },
  'work/berry/': {
    title: 'Berry — Dennis Bierreth-Fernandez',
    desc: 'Mobile collector app for card collections — product design, app UI and design system v3.',
  },
  'work/riftcast/': {
    title: 'Riftcast — Dennis Bierreth-Fernandez',
    desc: 'Remote desktop for your own network — mirror, control and play your PC on phone and browser. No cloud account.',
  },
  'work/mina/': {
    title: 'Mina – UX/UI Case Study — Dennis Bierreth-Fernandez',
    desc: 'UX/UI bootcamp case at neuefische — research, wireframes, usability tests and Figma prototypes.',
  },
  'work/forever/': {
    title: 'Forever — Visual Craft — Dennis Bierreth-Fernandez',
    desc: 'Brand communication print & digital, social video, product photography and high-end retouching.',
  },
  'work/visual-craft/': {
    title: 'Logos & Concepts — Dennis Bierreth-Fernandez',
    desc: 'Logo systems, brand mockups and landing concepts — curated craft.',
  },
  'work/web-clients/': {
    title: 'Website Designs — Dennis Bierreth-Fernandez',
    desc: 'Client websites and shop/campaign work — clear hero hierarchy and retail UI.',
  },
  'impressum/': {
    title: 'Legal notice — Dennis Bierreth-Fernandez',
    desc: 'Legal notice (Impressum) for dennisbf.design.',
  },
};

async function collectPages(dir, base = '') {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (['en', 'game-builds'].includes(entry.name) && base === '') continue; // eigene Ausgabe nicht erneut kopieren
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
    out = out.replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${meta.title}$2`);
    out = out.replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${meta.title}$2`);
  }
  if (meta?.desc) {
    out = out.replace(/(<meta name="description" content=")[^"]*(")/, `$1${meta.desc}$2`);
    out = out.replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${meta.desc}$2`);
    out = out.replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${meta.desc}$2`);
  }

  // Cover-/Lightbox-Bilder: data-alt-en → alt (SSR backt sonst Deutsch ein)
  out = out.replace(/<img\b[^>]*>/g, (tag) => {
    const en = tag.match(/\sdata-alt-en="([^"]*)"/);
    if (!en) return tag;
    if (/\salt="[^"]*"/.test(tag)) {
      return tag.replace(/\salt="[^"]*"/, ` alt="${en[1]}"`);
    }
    return tag.replace(/<img\b/, `<img alt="${en[1]}"`);
  });

  // Island-Props: altEn zur aktiven alt machen, damit Hydration zur EN-Kopie passt
  out = out.replace(
    /&quot;alt&quot;:&quot;((?:[^&]|&(?!quot;))*)&quot;,&quot;altEn&quot;:&quot;((?:[^&]|&(?!quot;))*)&quot;/g,
    (_m, _de, en) => `&quot;alt&quot;:&quot;${en}&quot;,&quot;altEn&quot;:&quot;${en}&quot;`,
  );

  // JSON-LD: Case-Description + Breadcrumb „Start" → „Home"
  out = out.replace(
    /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/g,
    (full, open, body, close) => {
      if (!body.includes('"CreativeWork"') && !body.includes('"BreadcrumbList"')) return full;
      let next = body;
      if (body.includes('"CreativeWork"') && meta?.desc) {
        next = next.replace(/"description":"[^"]*"/, `"description":${JSON.stringify(meta.desc)}`);
      }
      if (body.includes('"Person"')) {
        next = next
          .replace(
            /"jobTitle":"[^"]*"/,
            '"jobTitle":"Art Director · UX/UI · Independent Product Builder"',
          )
          .replace(/"Hobby Software Development"/g, '"Independent Product Development"');
      }
      if (body.includes('"BreadcrumbList"')) {
        next = next.replace(/"name":"Start"/, '"name":"Home"');
      }
      return open + next + close;
    },
  );

  out = out.replace(/aria-label="Menü öffnen"/g, 'aria-label="Open menu"');
  out = out.replace(/aria-label="Portfolio-Halle"/g, 'aria-label="Portfolio hall"');
  out = out.replace(/aria-label="Stationen"/g, 'aria-label="Stations"');
  out = out.replace(/aria-label="Station wählen"/g, 'aria-label="Choose station"');
  out = out.replace(/aria-label="Capture (\d+) von (\d+): /g, 'aria-label="Capture $1 of $2: ');
  // Häufige SSR-Aria-Labels in Galerie-Buttons
  out = out.replace(/aria-label="Galerie öffnen — /g, 'aria-label="Open gallery — ');
  out = out.replace(
    /aria-label="Bild (\d+) von (\d+) öffnen: /g,
    'aria-label="Open image $1 of $2: ',
  );
  out = out.replace(/aria-label="Galerie schließen"/g, 'aria-label="Close gallery"');
  out = out.replace(/aria-label="Vorheriges Bild"/g, 'aria-label="Previous image"');
  out = out.replace(/aria-label="Nächstes Bild"/g, 'aria-label="Next image"');
  out = out.replace(/aria-label="Galerie-Vorschaubilder"/g, 'aria-label="Gallery thumbnails"');
  out = out.replace(/aria-label="Projektfilter"/g, 'aria-label="Project filters"');

  return out;
}

export async function buildEnRoutes(distDir) {
  const pages = (await collectPages(distDir)).filter(
    (page) =>
      page.rel === '' ||
      ROUTES.some((route) => page.rel === `${route}/` || page.rel.startsWith(`${route}/`)),
  );
  let count = 0;
  const generatedEnglish = new Set();

  for (const page of pages) {
    const html = await readFile(page.abs, 'utf8');
    // Legacy redirects already have their own localized destination.
    if (/<meta\b[^>]*http-equiv="refresh"/i.test(html)) continue;
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
    generatedEnglish.add(`${SITE}/en/${page.rel}`);
    count++;
  }

  // Sitemap um die /en/-URLs ergänzen
  const sitemapPath = path.join(distDir, 'sitemap-0.xml');
  try {
    const xml = await readFile(sitemapPath, 'utf8');
    if (!xml.includes(`${SITE}/en/`)) {
      const entries = xml.match(/<url>.*?<\/url>/gs) ?? [];
      const enEntries = entries
        .filter((entry) => generatedEnglish.has(entry.match(/<loc>(.*?)<\/loc>/)?.[1]?.replace(`${SITE}/`, `${SITE}/en/`)))
        .map((e) => e.replace(`<loc>${SITE}/`, `<loc>${SITE}/en/`))
        .join('');
      await writeFile(sitemapPath, xml.replace('</urlset>', `${enEntries}</urlset>`));
    }
  } catch {
    console.warn('[en-routes] sitemap-0.xml nicht gefunden — übersprungen');
  }

  console.log(`[en-routes] ${count} EN-Seiten unter /en/ erzeugt, hreflang verlinkt`);
}

